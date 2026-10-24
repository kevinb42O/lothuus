import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeSolids, seedRandom, type HouseMaterials } from './house-architecture';
import { bedEdges, type PlantingBed } from './house-planting';
import { partitionInstances } from './house-rendering';
import { rightContext } from './house-right-context';

// Ground features traced relative to the unchanged facade in the colour photo.
// x runs along the facade; z increases from the facade towards the photographer.
export const streetLayout={
  blockWidth:.118,blockLength:.231,joint:.0035,
  footpathFront:(x:number)=>5.23+.018*x,
  entrance:{left:-1.37,right:.765,front:6.63},
  entranceFront:(x:number)=>6.63+.085*(x-.765),
  paintStart:{x:-4.77,z:5.75},paintEnd:{x:-7.1,z:10.65},
  roadColor:'#4e4740',footpathColor:'#59534c',
};

type GroundPoint={x:number;z:number};
type GroundPolygon=GroundPoint[];
const cornerCurve=new T.QuadraticBezierCurve(new T.Vector2(10.6,8.2),new T.Vector2(12.2,8.1),new T.Vector2(12.2,4.1));
const footpathPolygons:GroundPolygon[]=[
  [{x:-20.3,z:4.09},{x:9.6,z:4.09},{x:9.6,z:streetLayout.footpathFront(9.6)},{x:-20.3,z:streetLayout.footpathFront(-20.3)}],
  [{x:-1.37,z:streetLayout.footpathFront(-1.37)},{x:.765,z:streetLayout.footpathFront(.765)},{x:.765,z:streetLayout.entranceFront(.765)},{x:-1.37,z:streetLayout.entranceFront(-1.37)}],
  [{x:9.07,z:-25},{x:rightContext.kerb,z:-25},{x:rightContext.kerb,z:4.09},{x:9.07,z:4.09}],
  [{x:9.6,z:4.09},{x:12.2,z:4.09},...cornerCurve.getPoints(20).reverse().map(p=>({x:p.x,z:p.y})),{x:9.6,z:5.4}],
  [{x:rightContext.roadOuter,z:-25},{x:21.3,z:-25},{x:21.3,z:6},{x:rightContext.roadOuter,z:6}],
];

function splitAtEdge(polygon:GroundPolygon,a:GroundPoint,b:GroundPoint){
  const inside:GroundPolygon=[],outside:GroundPolygon=[];
  const distance=(p:GroundPoint)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
  for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=distance(p),dq=distance(q);
    (dp>=0?inside:outside).push(p);
    if((dp>=0)!==(dq>=0)){
      const t=dp/(dp-dq),cut={x:T.MathUtils.lerp(p.x,q.x,t),z:T.MathUtils.lerp(p.z,q.z,t)};
      inside.push(cut);outside.push(cut);
    }
  }
  return {inside,outside};
}

function intersect(polygon:GroundPolygon,boundary:GroundPolygon){
  let inside=polygon;const outside:GroundPolygon[]=[];
  for(let i=0;i<boundary.length&&inside.length>=3;i++){
    const split=splitAtEdge(inside,boundary[i],boundary[(i+1)%boundary.length]);
    if(split.outside.length>=3)outside.push(split.outside);inside=split.inside;
  }
  return {inside,outside};
}

/** Cut the actual end stones at the boundary, rather than classifying whole
 * staggered blocks by their centres and leaving a sawtooth pavement edge. */
export function splitPavingBlock(x:number,z:number){
  const hw=(streetLayout.blockWidth-streetLayout.joint)/2,hd=(streetLayout.blockLength-streetLayout.joint)/2;
  const source:GroundPolygon=[{x:x-hw,z:z-hd},{x:x+hw,z:z-hd},{x:x+hw,z:z+hd},{x:x-hw,z:z+hd}];
  let road=[source];const foot:GroundPolygon[]=[];
  for(const boundary of footpathPolygons){
    if(boundary.every(p=>p.x<x-hw)||boundary.every(p=>p.x>x+hw)||boundary.every(p=>p.z<z-hd)||boundary.every(p=>p.z>z+hd))continue;
    const remainder:GroundPolygon[]=[];
    for(const polygon of road){const split=intersect(polygon,boundary);if(split.inside.length>=3)foot.push(split.inside);remainder.push(...split.outside);}
    road=remainder;
  }
  return {source,road,foot};
}

export function buildStreetscape(maps:HouseMaterials,beds:readonly PlantingBed[]) {
  const root=new T.Group();root.name='Photo-referenced footpath, roadway, low kerbs and parking hatch';
  const random=seedRandom(28104),transform=new T.Object3D();
  const roadMat=new T.MeshStandardMaterial({color:streetLayout.roadColor,roughness:.96,normalMap:maps.paving.normal,roughnessMap:maps.paving.roughness,normalScale:new T.Vector2(.055,.055)});
  const footMat=roadMat.clone();footMat.color.set(streetLayout.footpathColor);
  const sideRoadMat=roadMat.clone();sideRoadMat.color.set('#3d4143');
  const cutRoadMat=roadMat.clone(),cutFootMat=footMat.clone();cutRoadMat.vertexColors=cutFootMat.vertexColors=true;
  for(const material of [roadMat,footMat,cutRoadMat,cutFootMat,sideRoadMat]){
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 groundPoint = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          groundPoint = instanceMatrix * groundPoint;
        #endif
        groundPoint = modelMatrix * groundPoint;
        vNormalMapUv = groundPoint.xz * 1.4;
        vRoughnessMapUv = groundPoint.xz * 1.4;`);
    };
    material.customProgramCacheKey=()=> 'lothuus-world-ground-detail-v2';
  }
  const roadMatrices:T.Matrix4[]=[],roadColors:T.Color[]=[],footMatrices:T.Matrix4[]=[],footColors:T.Color[]=[];
  let cutPaverCount=0;
  function inBed(x:number,z:number){return beds.some(b=>{if(Math.abs(x-b.x)>b.w/2+.05)return false;const e=bedEdges(b,x);return z>e.rear-.05&&z<e.front+.05;});}
  function cutBlock(polygon:GroundPolygon,foot:boolean,colour:T.Color,height:number){
    cutPaverCount++;
    const shape=new T.Shape();polygon.forEach((p,i)=>i===0?shape.moveTo(p.x,-p.z):shape.lineTo(p.x,-p.z));shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false});geometry.rotateX(-Math.PI/2);geometry.translate(0,height-.06,0);
    const colours=new Float32Array(geometry.getAttribute('position').count*3);for(let i=0;i<colours.length;i+=3){colours[i]=colour.r;colours[i+1]=colour.g;colours[i+2]=colour.b;}geometry.setAttribute('color',new T.BufferAttribute(colours,3));
    const mesh=new T.Mesh(geometry,foot?cutFootMat:cutRoadMat);mesh.receiveShadow=true;root.add(mesh);
  }
  function block(x:number,z:number){
    if(inBed(x,z))return;
    const split=splitPavingBlock(x,z),jitter=(random()-.5)*.0015;
    // The side-street photograph resolves a separate herringbone carriageway.
    // Keep the frontal square's bond, but do not lay that bond over the road.
    if(x>rightContext.kerb&&x<rightContext.roadOuter&&z<4.21&&z> -25&&split.foot.length===0)return;
    random(); // Keep the existing material variation stable after removing boundary rotation.
    // Restrained ash/mauve/sand variation, rather than the old green-grey checkerboard.
    const shade=.75+random()*.22,warm=random();
    const colour=new T.Color().setRGB(shade*(.97+warm*.06),shade*.97,shade*(.94+(1-warm)*.07));
    if(split.road.length===0||split.foot.length===0){
      const foot=split.foot.length>0;
      transform.position.set(x,(foot?.023:.002)-.03+jitter,z);transform.rotation.set(0,0,0);transform.scale.set(1,1,1);transform.updateMatrix();
      (foot?footMatrices:roadMatrices).push(transform.matrix.clone());(foot?footColors:roadColors).push(colour);
    }else{
      for(const polygon of split.road)cutBlock(polygon,false,colour,.002+jitter);
      for(const polygon of split.foot)cutBlock(polygon,true,colour,.023+jitter);
    }
  }
  const {blockWidth:w,blockLength:d,joint}=streetLayout;
  // Long axes point towards the house. Adjacent columns have half-block bonds.
  for(let col=-171;col<=171;col++)for(let row=0;row<83;row++){
    const x=col*w,z=4.08+row*d+(Math.abs(col)%2)*d/2;
    block(x,z);
  }
  // The side street and the recessed left approach meet the square without a threshold.
  for(let col=0;col<104;col++)for(let row=1;row<126;row++){
    const x=9.086+col*w,z=4.08-row*d+((col+77)%2)*d/2;block(x,z);
  }
  for(let col=0;col<32;col++)for(let row=1;row<24;row++)block(-12.862+col*w,4.08-row*d+(Math.abs(col-109)%2)*d/2);
  const geometry=new RoundedBoxGeometry(w-joint,.06,d-joint,1,.003);
  function batch(matrices:T.Matrix4[],colors:T.Color[],material:T.Material,name:string){
    const mesh=new T.InstancedMesh(geometry,material,matrices.length);mesh.name=name;
    matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,colors[i]);});mesh.receiveShadow=true;root.add(partitionInstances(mesh,6));
  }
  batch(roadMatrices,roadColors,roadMat,'Longitudinal weathered road setts');
  batch(footMatrices,footColors,footMat,'Close-set clinker footpath and entrance approach');
  // True 45-degree herringbone, using paired horizontal/vertical dominoes on
  // lattice vectors (2,2) and (1,-1), then rotating that lattice by 45 degrees.
  const herringMatrices:T.Matrix4[]=[],herringColors:T.Color[]=[],module=w*Math.SQRT2;
  for(let col=-2;col<47;col++)for(let row=-83;row<15;row++)for(const variant of [0,1]){
    const x=rightContext.kerb+col*module+w*(variant?1.5:.5)/Math.SQRT2;
    const z=row*module*2+w*(variant?3.5:1.5)/Math.SQRT2;
    const extent=w*1.5/Math.SQRT2;
    if(x-extent<rightContext.kerb+.045||x+extent>rightContext.roadOuter-.045||z< -25||z>4.21)continue;
    transform.position.set(x,-.028,z);transform.rotation.set(0,variant?-Math.PI/4:Math.PI/4,0);transform.scale.set(1,1,1);transform.updateMatrix();herringMatrices.push(transform.matrix.clone());
    const shade=.8+random()*.18;herringColors.push(new T.Color().setRGB(shade*.97,shade,shade*1.01));
  }
  const herring=new T.InstancedMesh(new RoundedBoxGeometry(w-joint,.06,w*2-joint,1,.003),sideRoadMat,herringMatrices.length);herring.name='Side carriageway — diagonal herringbone bricks';herringMatrices.forEach((m,i)=>{herring.setMatrixAt(i,m);herring.setColorAt(i,herringColors[i]);});herring.receiveShadow=true;root.add(partitionInstances(herring,6));
  const kerbMat=new T.MeshStandardMaterial({color:'#777971',roughness:.94,normalMap:maps.paving.normal,normalScale:new T.Vector2(.04,.04)});
  const soilMat=new T.MeshStandardMaterial({color:'#302e23',roughness:1,normalMap:maps.brick.normal,normalScale:new T.Vector2(.4,.4)});
  const geometryCache=new Map<string,T.BufferGeometry>();
  function edge(a:{x:number;z:number},b:{x:number;z:number},width:number,height:number,top:number,material:T.Material,segment=.85){
    const length=Math.hypot(b.x-a.x,b.z-a.z),count=Math.ceil(length/segment),step=length/count;
    const key=`${width},${height},${step}`;
    let g=geometryCache.get(key);if(!g){g=new RoundedBoxGeometry(width,height,step-.004,1,.008);geometryCache.set(key,g);}
    for(let i=0;i<count;i++){
      const t=(i+.5)/count,mesh=new T.Mesh(g,material);mesh.position.set(T.MathUtils.lerp(a.x,b.x,t),top-height/2,T.MathUtils.lerp(a.z,b.z,t));
      mesh.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    }
  }
  for(const bed of beds){
    const left=bed.x-bed.w/2,right=bed.x+bed.w/2,l=bedEdges(bed,left),r=bedEdges(bed,right);
    const corners=[{x:left,z:l.rear},{x:right,z:r.rear},{x:right,z:r.front},{x:left,z:l.front}];
    const shape=new T.Shape();corners.forEach((p,i)=>i===0?shape.moveTo(p.x,-p.z):shape.lineTo(p.x,-p.z));shape.closePath();
    const soil=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:false}),soilMat);soil.rotation.x=-Math.PI/2;soil.receiveShadow=true;root.add(soil);
    for(let i=0;i<4;i++)edge(corners[i],corners[(i+1)%4],.105,.12,.105,kerbMat);
  }
  // The footpath continues past the house on the left. A straight kerb closes
  // the entrance apron between the planter corners, with cut end stones behind it.
  edge({x:-20.3,z:streetLayout.footpathFront(-20.3)},{x:-4.57,z:streetLayout.footpathFront(-4.57)},.12,.075,.04,kerbMat,.85);
  edge({x:streetLayout.entrance.left,z:streetLayout.entranceFront(streetLayout.entrance.left)},{x:streetLayout.entrance.right,z:streetLayout.entranceFront(streetLayout.entrance.right)},.14,.085,.04,kerbMat,.85);
  edge({x:rightContext.kerb,z:4.1},{x:rightContext.kerb,z:-25},.13,.11,.065,kerbMat,.7);
  edge({x:rightContext.roadOuter,z:6},{x:rightContext.roadOuter,z:-25},.12,.10,.065,kerbMat);
  for(let i=0;i<20;i++){const a=cornerCurve.getPoint(i/20),b=cornerCurve.getPoint((i+1)/20);edge({x:a.x,z:a.y},{x:b.x,z:b.y},.13,.11,.065,kerbMat,.5);}
  // Rectangular cast-iron gully immediately inside the rounded corner.
  const gully=new T.Group();gully.name='Corner storm drain with individual grating bars';gully.position.set(12.02,.028,5.12);gully.rotation.y=-.27;
  const iron=new T.MeshStandardMaterial({color:'#252d2c',roughness:.86,metalness:.35});
  const well=new T.Mesh(new T.BoxGeometry(.43,.012,.65),new T.MeshStandardMaterial({color:'#111816',roughness:1}));gully.add(well);
  for(let i=0;i<9;i++){const bar=new T.Mesh(new T.BoxGeometry(.36,.022,.025),iron);bar.position.set(0,.011,-.27+i*.0675);gully.add(bar);}
  for(const side of [-1,1]){const rail=new T.Mesh(new T.BoxGeometry(.033,.025,.65),iron);rail.position.set(side*.205,.012,0);gully.add(rail);}root.add(gully);
  // Narrow drainage/header courses follow the planter fronts, including their
  // different slopes. They do not form a second raised step across the path.
  for(const bed of beds){
    const x1=bed.x-bed.w/2,x2=bed.x+bed.w/2;
    edge({x:x1,z:bedEdges(bed,x1).front+.12},{x:x2,z:bedEdges(bed,x2).front+.12},.115,.035,.012,roadMat,.23);
  }
  const paint=new T.MeshStandardMaterial({color:'#d6d3c9',roughness:.99,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  paint.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vPaintPosition;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvPaintPosition=(modelMatrix*vec4(transformed,1.0)).xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vPaintPosition;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      // Small irregular chips interrupt the paint without a photographic decal.
      float chip = fract(sin(dot(floor(vPaintPosition * 180.0), vec2(12.9898,78.233))) * 43758.5453);
      if (chip > .978) discard;`);
  };paint.customProgramCacheKey=()=> 'lothuus-worn-parking-paint-v1';
  function stripe(a:{x:number;z:number},b:{x:number;z:number},width=.075){
    const length=Math.hypot(b.x-a.x,b.z-a.z),mesh=new T.Mesh(new T.PlaneGeometry(width,length),paint);
    mesh.rotation.set(-Math.PI/2,0,0);mesh.rotateZ(Math.atan2(b.x-a.x,b.z-a.z));mesh.position.set((a.x+b.x)/2,.007,(a.z+b.z)/2);mesh.receiveShadow=true;root.add(mesh);
  }
  const a=streetLayout.paintStart,b=streetLayout.paintEnd;stripe(a,b,.085);
  for(let i=0;i<9;i++){
    const t=.04+i*.112,z=T.MathUtils.lerp(a.z,b.z,t),x=T.MathUtils.lerp(a.x,b.x,t);
    stripe({x:x-1.08-i*.075,z},{x,z},.075);
  }
  // Merging these small solids retains bevels and joints; keep paint receivers
  // separate so mergeSolids cannot turn them into shadow-casting surfaces.
  const marks=root.children.filter(o=>o instanceof T.Mesh&&o.material===paint);marks.forEach(m=>m.removeFromParent());
  mergeSolids(root);root.add(...marks);
  return {root,paverCount:roadMatrices.length+footMatrices.length+herringMatrices.length+cutPaverCount};
}
