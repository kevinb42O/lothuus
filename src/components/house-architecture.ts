import * as T from 'three';
import { buildHouseWindow } from './house-windows';
import { buildFrontDoor } from './house-door';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type MaterialSet = { color:T.Texture; normal:T.Texture; roughness:T.Texture };
export type HouseMaterials = { brick:MaterialSet; roof:Pick<MaterialSet,'normal'>; paving:MaterialSet; windowInteriors?:T.Texture };

export function seedRandom(seed:number) { return () => { seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296; }; }

/** Collapse authored solid details by material; curved mouldings keep their real geometry. */
export function mergeSolids(root:T.Group) {
  root.updateMatrixWorld(true);
  const inverseRoot=root.matrixWorld.clone().invert();
  const batches=new Map<T.Material,T.BufferGeometry[]>();const originals:T.Mesh[]=[];
  const indexed=new Map<T.BufferGeometry,T.BufferGeometry>();
  root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!Array.isArray(o.material)) {
    let source=o.geometry;
    if(!source.index){let cached=indexed.get(source);if(!cached){cached=mergeVertices(source,1e-6);indexed.set(source,cached);}source=cached;}
    const g=source.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverseRoot,o.matrixWorld));
    const a=batches.get(o.material)||[];a.push(g);batches.set(o.material,a);originals.push(o);
  }});
  const old=new Set<T.BufferGeometry>();originals.forEach(o=>{old.add(o.geometry);o.removeFromParent();});old.forEach(g=>g.dispose());indexed.forEach(g=>g.dispose());
  for(const [material,geometries] of batches){const merged=mergeGeometries(geometries,false);if(merged){const m=new T.Mesh(merged,material);m.castShadow=m.receiveShadow=true;root.add(m);}geometries.forEach(g=>g.dispose());}
}

/** Architectural dimensions are estimated from the reference, not measured survey data. */
export function buildArchitecture(maps:HouseMaterials,suppliedEntrance?:T.Group) {
  const root=new T.Group();root.name='LOTHUUS — solid architectural model';
  const random=seedRandom(34819);
  const mortar=new T.MeshStandardMaterial({color:'#bca772',roughness:1});
  const brick=new T.MeshStandardMaterial({color:'#ffffff',map:maps.brick.color,normalMap:maps.brick.normal,roughnessMap:maps.brick.roughness,normalScale:new T.Vector2(.24,.24),roughness:.92});
  // World aligned PBR maps retain a consistent physical scale across individual masonry units.
  brick.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vec4 materialWorld = vec4(transformed,1.0);
    #ifdef USE_INSTANCING
      materialWorld = instanceMatrix * materialWorld;
    #endif
    materialWorld = modelMatrix * materialWorld;
    #ifdef USE_MAP
      vMapUv = (abs(normal.z)>.5 ? materialWorld.xy : materialWorld.zy) * .52;
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv = (abs(normal.z)>.5 ? materialWorld.xy : materialWorld.zy) * .52;
    #endif
    #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv = (abs(normal.z)>.5 ? materialWorld.xy : materialWorld.zy) * .52;
    #endif`);};
  brick.customProgramCacheKey=()=> 'lothuus-world-brick-v1';
  const stone=new T.MeshStandardMaterial({color:'#aeb2ae',roughness:.83,normalMap:maps.paving.normal,normalScale:new T.Vector2(.055,.055)});
  const lightStone=new T.MeshStandardMaterial({color:'#a5aca8',roughness:.86,normalMap:maps.paving.normal,normalScale:new T.Vector2(.04,.04)});
  const dark=new T.MeshStandardMaterial({color:'#121d25',roughness:.36,metalness:.28});
  const timber=new T.MeshStandardMaterial({color:'#14202a',roughness:.48,normalMap:maps.brick.normal,normalScale:new T.Vector2(.012,.06)});
  const iron=new T.MeshStandardMaterial({color:'#1a2329',roughness:.42,metalness:.78});
  const brass=new T.MeshStandardMaterial({color:'#aa8d49',roughness:.28,metalness:.88});
  const interior=new T.MeshStandardMaterial({color:'#3b3e3a',roughness:1});
  const plaster=new T.MeshStandardMaterial({color:'#a7a69b',roughness:1});
  // Neutral tint lets the existing local reflection probe and recessed curtains
  // supply the pane's colour. Keep the established shader and texture budget.
  // Exterior preparation disables transmission before the first rendered frame.
  const glass=new T.MeshPhysicalMaterial({color:'#bcc9cc',metalness:.05,roughness:.085,transmission:.12,transparent:true,opacity:.42,ior:1.52,thickness:.008,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:1.15});
  glass.name='Actual physical glazing';
  const roofMat=new T.MeshStandardMaterial({color:'#454c4b',roughness:.87,normalMap:maps.roof.normal,normalScale:new T.Vector2(.17,.17),side:T.DoubleSide});
  const redBrick=new T.MeshStandardMaterial({color:'#8c5541',roughness:.95,normalMap:maps.brick.normal,normalScale:new T.Vector2(.3,.3)});
  const boxGeometries=new Map<string,T.BufferGeometry>();
  function box(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,parent:T.Object3D=root,bevel=.008) {
    const radius=Math.min(bevel,w*.2,h*.2,d*.2),key=`${w},${h},${d},${radius}`;
    let geometry=boxGeometries.get(key);
    if(!geometry){geometry=bevel?new RoundedBoxGeometry(w,h,d,1,radius):new T.BoxGeometry(w,h,d);boxGeometries.set(key,geometry);}
    const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  function tube(points:T.Vector3[],radius:number,mat:T.Material,parent:T.Object3D=root) {
    const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(4,points.length*5),radius,6,false),mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  function line(a:number[],b:number[],radius=.015,mat:T.Material=iron,parent:T.Object3D=root) {return tube([new T.Vector3(...a),new T.Vector3(...b)],radius,mat,parent);}
  function outline(points:number[][],radius:number,mat:T.Material,parent:T.Object3D=root){return tube(points.map(p=>new T.Vector3(...p)),radius,mat,parent);}
  const holes:{x:number;y:number;w:number;h:number}[]=[];
  const bays=[-7.2,-4.8,-2.4,0,2.4,4.8,7.2];
  for(const x of bays){if(x!==0)holes.push({x,y:1.02,w:1.3,h:2.4});holes.push({x,y:4.32,w:1.3,h:2.08});}
  holes.push({x:0,y:.25,w:1.46,h:3.18});
  const facade=new T.Shape();facade.moveTo(-9,.05);facade.lineTo(9,.05);facade.lineTo(9,7.16);facade.lineTo(-9,7.16);facade.closePath();
  for(const o of holes){const path=new T.Path();path.moveTo(o.x-o.w/2,o.y);path.lineTo(o.x-o.w/2,o.y+o.h);path.lineTo(o.x+o.w/2,o.y+o.h);path.lineTo(o.x+o.w/2,o.y);path.closePath();facade.holes.push(path);}
  const wall=new T.Mesh(new T.ExtrudeGeometry(facade,{depth:.34,bevelEnabled:false}),mortar);wall.position.z=3.66;wall.castShadow=wall.receiveShadow=true;root.add(wall);
  // Staggered, separate bricks with shallow irregular faces and actual mortar joints.
  const units:{x:number;y:number;w:number;h:number}[]=[];
  const rowHeight=.115,unitWidth=.365;
  for(let row=0;row<Math.ceil(7.16/rowHeight);row++){
    const y=row*rowHeight+rowHeight/2;
    for(let col=-26;col<26;col++){
      const x=col*unitWidth+(row%2)*unitWidth/2;
      if(x-unitWidth/2 < -9||x+unitWidth/2>9||y>7.15)continue;
      if(holes.some(o=>Math.abs(x-o.x)<(o.w+unitWidth)/2+.015&&y>o.y-rowHeight/2&&y<o.y+o.h+rowHeight/2))continue;
      units.push({x,y,w:unitWidth-.005,h:rowHeight-.004});
    }
  }
  const brickGeometry=new T.BoxGeometry(1,1,1);
  const bricks=new T.InstancedMesh(brickGeometry,brick,units.length);bricks.name='Individual staggered facade bricks';
  const transform=new T.Object3D();const tint=new T.Color();
  units.forEach((u,i)=>{
    transform.position.set(u.x,u.y,4+(random()-.5)*.0015);transform.scale.set(u.w,u.h,.010+random()*.002);transform.rotation.z=(random()-.5)*.003;transform.updateMatrix();bricks.setMatrixAt(i,transform.matrix);
    const sample=random(),c=.94+sample*.10;
    // Bake only short-range ambient contact into the existing instance colours.
    // No extra map/pass/attribute, and no directional sunlight baked into the wall.
    let contact=1;
    for(const ledge of [.91,3.94,7.02]){const below=ledge-u.y;if(below>0&&below<.24)contact*=1-.10*Math.pow(1-below/.24,2);}
    for(const opening of holes){
      const dx=Math.max(Math.abs(u.x-opening.x)-opening.w/2,0),dy=Math.max(opening.y-u.y,u.y-opening.y-opening.h,0);
      const gap=Math.hypot(dx,dy);
      if(gap<.17)contact*=1-.085*Math.pow(1-gap/.17,2);
    }
    const warmth=(sample-.5)*.035;
    bricks.setColorAt(i,tint.setRGB(c*contact,c*(.994-warmth*.25)*contact,c*(.975-warmth)*contact));
  });bricks.castShadow=bricks.receiveShadow=true;root.add(bricks);
  // Solid side/rear walls and interior floor plates. Unseen elevations remain conservative.
  box(-8.84,3.6,-.16,.32,7.12,7.7,brick,root,0);box(8.84,3.6,-.16,.32,7.12,7.7,brick,root,0);
  box(0,3.6,-3.84,18,7.12,.32,brick,root,0);
  box(0,.12,0,17.7,.17,7.6,interior,root,0);box(0,3.96,0,17.7,.18,7.6,plaster,root,0);box(0,7.02,0,17.7,.15,7.6,interior,root,0);
  box(0,3.45,-3.53,17.5,6.7,.12,interior,root,0);
  // Dressed stone plinth in separate slabs with real reveals at the entrance.
  for(const side of [-1,1]){
    for(let i=0;i<5;i++)for(let course=0;course<2;course++)box(side*(.87+(i+.5)*1.62),.265+course*.38,4.045,1.607,.37,.14,stone);
    box(side*4.9,.91,4.11,8.2,.095,.29,lightStone);
  }
  box(0,3.94,4.07,18,.092,.2,lightStone);
  // Real frames/curtains in front of one shared, recessed interior atlas.
  const curtain=new T.MeshStandardMaterial({color:'#d4d2ca',roughness:1,side:T.DoubleSide});
  const backdrop=maps.windowInteriors?new T.MeshBasicMaterial({map:maps.windowInteriors,color:'#d4d8d8'}):interior;
  for(const [i,x] of bays.entries()){
    const materials={stone,lightStone,dark,timber,brass,iron,glass,curtain,backdrop};
    if(x!==0)root.add(buildHouseWindow(x,1.02,2.4,i,materials,box));
    root.add(buildHouseWindow(x,4.32,2.08,i+7,materials,box));
  }
  const entrance=suppliedEntrance??buildFrontDoor({glass,stone,lightStone});
  if(suppliedEntrance){
    entrance.traverse(object=>{
      if(!(object instanceof T.Mesh)||Array.isArray(object.material))return;
      if(object.material.name==='Entrance limestone')object.material=stone;
      if(object.material.name==='Entrance light limestone')object.material=lightStone;
    });
  }
  const doorLeaf=entrance.getObjectByName('Opening front door leaf') as T.Group;
  if(!entrance.userData.batched){doorLeaf.removeFromParent();mergeSolids(entrance);mergeSolids(doorLeaf);entrance.add(doorLeaf);}
  // The close-up shows small dark wall fixtures rather than large lanterns.
  for(const side of [-1,1]){
    const fixture=new T.Mesh(new T.CylinderGeometry(.031,.038,.105,10),iron);
    fixture.position.set(side*1.43,3.47,4.07);fixture.castShadow=true;root.add(fixture);
  }
  // Smeedijzeren balcony: stone slab, brackets, bowed balusters, scrolls, rosettes and rails.
  box(0,3.91,4.4,2.23,.16,1.02,lightStone);
  box(0,3.99,4.43,2.29,.035,1.08,stone);
  for(const side of [-1,1]){
    box(side*.76,3.76,4.28,.17,.2,.36,lightStone);
    outline([[side*.76,3.57,4.12],[side*.76,3.67,4.44],[side*.76,3.84,4.61]],.055,lightStone);
  }
  for(const y of [4.05,4.83]){
    line([-1.08,y,4.92],[1.08,y,4.92],.025);
    for(const side of [-1,1])line([side*1.08,y,4.03],[side*1.08,y,4.92],.025);
  }
  line([-1.12,4.87,4.94],[1.12,4.87,4.94],.035);
  for(let i=0;i<15;i++){
    const x=-1.05+i*.15;
    outline([[x,4.04,4.92],[x,4.25,5.005],[x,4.47,4.985],[x,4.84,4.92]],.012,iron);
    if(i%2===0)for(const direction of [-1,1]){
      const points:number[][]=[];for(let j=0;j<=28;j++){const angle=j/28*Math.PI*2.6,r=.12*(1-j/35);points.push([x+direction*Math.cos(angle)*r,4.41+Math.sin(angle)*r,4.99]);}outline(points,.009,iron);
    }
  }
  for(const side of [-1,1])for(let j=0;j<6;j++){
    const z=4.08+j*.16;
    outline([[side*1.08,4.04,z],[side*1.15,4.28,z],[side*1.12,4.54,z],[side*1.08,4.84,z]],.012,iron);
  }
  for(const side of [-1,1]){
    const rose=new T.Mesh(new T.TorusGeometry(.1,.011,5,24),iron);rose.position.set(side*.68,4.63,4.96);root.add(rose);
    for(let j=0;j<5;j++){const angle=j/5*Math.PI*2;line([side*.68,4.63,4.96],[side*.68+Math.cos(angle)*.09,4.63+Math.sin(angle)*.09,4.96],.007);}
  }
  // Timber cornice: multiple actual moulding profiles, corbels and metal gutter.
  for(const [y,w,h,d] of [[6.99,18.12,.12,8.1],[7.1,18.34,.13,8.32],[7.23,18.55,.09,8.53],[7.32,18.78,.09,8.72]])box(0,y,0,w,h,d,dark);
  for(let x=-8.7;x<=8.7;x+=.49){box(x,7.015,4.17,.105,.17,.28,timber);box(x,6.955,4.1,.145,.055,.17,timber);}
  line([-9.42,7.365,4.39],[9.42,7.365,4.39],.073,dark);
  // Hipped roof underlay.
  const roofFaces=[
    [[-9.42,7.36,4.4],[9.42,7.36,4.4],[6.4,9.76,0],[-6.4,9.76,0]],
    [[9.42,7.36,-4.4],[-9.42,7.36,-4.4],[-6.4,9.76,0],[6.4,9.76,0]],
    [[-9.42,7.36,-4.4],[-9.42,7.36,4.4],[-6.4,9.76,0]],
    [[9.42,7.36,4.4],[9.42,7.36,-4.4],[6.4,9.76,0]],
  ];
  for(const vertices of roofFaces){const order=vertices.length===4?[0,1,2,0,2,3]:[0,1,2];const p:number[]=[],uv:number[]=[];for(const i of order){p.push(...vertices[i]);uv.push(vertices[i][0],vertices[i][2]);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();root.add(new T.Mesh(g,new T.MeshStandardMaterial({color:'#282c2b',roughness:1,side:T.DoubleSide})));}
  // Thousands of curved overlapping pantiles. Four real roof slopes, not a tiled photograph.
  const tileG=new T.PlaneGeometry(.285,.39,10,3);const tp=tileG.getAttribute('position');
  for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getY(i);tp.setXYZ(i,x,.024*Math.cos((x/.285+.5)*Math.PI*2)+.008*Math.cos(z/.39*Math.PI),z);}tileG.computeVertexNormals();
  const tileTransforms:T.Matrix4[]=[];const pitch=Math.atan2(2.4,4.4);
  for(const side of [-1,1])for(let row=0;row<16;row++){
    const z=.12+row*.282,width=6.4+z/4.4*3.02;
    for(let x=-width+.14;x<width-.08;x+=.28){transform.position.set(x,9.76-z/4.4*2.4+.045,side*z);transform.rotation.set(side*pitch,0,0);transform.scale.set(1,1,1);transform.updateMatrix();tileTransforms.push(transform.matrix.clone());}
  }
  const hipPitch=Math.atan2(2.4,3.02);
  for(const side of [-1,1])for(let row=0;row<11;row++){
    const q=.1+row*.28,maxZ=q/3.02*4.4;
    for(let z=-maxZ+.14;z<maxZ-.06;z+=.28){transform.position.set(side*(6.4+q),9.76-q/3.02*2.4+.045,z);transform.quaternion.copy(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),side*Math.PI/2).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),hipPitch)));transform.scale.set(1,1,1);transform.updateMatrix();tileTransforms.push(transform.matrix.clone());}
  }
  const tiles=new T.InstancedMesh(tileG,roofMat,tileTransforms.length);tiles.name='Individual curved roof pantiles';
  tileTransforms.forEach((matrix,i)=>{
    tiles.setMatrixAt(i,matrix);
    // Broad, quiet weathering across the slope, with less salt-and-pepper contrast.
    // Evaluated once during construction; the existing instance buffer is reused.
    const x=matrix.elements[12],z=matrix.elements[14],sample=random();
    const patch=Math.sin(x*.73+z*.38)*Math.sin(z*1.12-x*.19);
    const c=.91+sample*.13+patch*.025;
    tiles.setColorAt(i,tint.setRGB(c,c*(.995+patch*.006),c*(.98+patch*.012)));
  });tiles.castShadow=tiles.receiveShadow=true;root.add(tiles);
  // Segmented ridge and hip caps, with a visible overlap on every cap.
  for(let x=-6.35;x<6.4;x+=.3)line([x,9.8,0],[x+.32,9.8,0],.092,roofMat);
  for(const side of [-1,1])for(const z of [-4.4,4.4]){
    const a=new T.Vector3(side*9.42,7.39,z),b=new T.Vector3(side*6.4,9.8,0),length=a.distanceTo(b),n=Math.ceil(length/.3);
    for(let i=0;i<n;i++){const p=a.clone().lerp(b,i/n),q=a.clone().lerp(b,Math.min(1,(i+1.08)/n));tube([p,q],.074,roofMat);}
  }
  // Recessed skylights, including metal flashing, raised frame, glass and seals.
  for(const x of [-6.1,-3.8,-1.5,.8]){
    const group=new T.Group();group.position.set(x,8.16,3.22);group.rotation.x=pitch;root.add(group);
    box(0,-.02,0,1.17,.045,.96,stone,group);box(0,.025,0,1.04,.08,.82,dark,group);
    box(0,.071,0,.88,.008,.65,glass,group,0);
    for(const side of [-1,1]){box(side*.49,.084,0,.032,.026,.83,lightStone,group);box(0,.084,side*.385,1.025,.026,.035,lightStone,group);}
    box(0,.095,.35,.94,.025,.025,dark,group);
  }
  // Brick chimney, projecting cap, two terracotta chimney pots.
  box(-5.7,9.62,-.8,.63,1.4,.68,redBrick);
  for(let row=0;row<13;row++)for(let col=0;col<3;col++)box(-5.7-.22+col*.22+(row%2)*.025,9.02+row*.1,-.45,.207,.092,.02,redBrick,root,.004);
  box(-5.7,10.32,-.8,.77,.1,.81,stone);box(-5.7,10.23,-.8,.7,.06,.75,redBrick);
  const clay=new T.MeshStandardMaterial({color:'#a66445',roughness:.93});
  for(const z of [-1,-.62]){const pot=new T.Mesh(new T.CylinderGeometry(.105,.13,.27,16,1,true),clay);pot.position.set(-5.7,10.49,z);root.add(pot);const opening=new T.Mesh(new T.CircleGeometry(.095,16),interior);opening.rotation.x=-Math.PI/2;opening.position.set(-5.7,10.625,z);root.add(opening);}
  for(const side of [-1,1]){
    outline([[side*9.2,7.35,4.34],[side*9.05,7.08,4.17],[side*9.045,6.8,4.15],[side*9.045,.42,4.15],[side*9,.15,4.42]],.047,stone);
    for(const y of [.85,2.8,4.8,6.7])box(side*9.045,y,4.16,.13,.035,.13,dark);
  }
  mergeSolids(root);
  // Clear glazing admits daylight to the curtains; its opaque shadow was a
  // solid black occluder even after screen-space transmission was disabled.
  root.traverse(object=>{if(object instanceof T.Mesh&&object.material===glass)object.castShadow=false;});
  root.add(entrance);
  return {root,glass,doorLeaf,brickCount:units.length,tileCount:tileTransforms.length};
}
