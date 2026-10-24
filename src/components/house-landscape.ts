import * as T from 'three';
import { buildStreetGround } from './house-ground';
import { buildStreetscape } from './house-streetscape';
import { buildLeftContext } from './house-left-context';
import { buildRightContext, rightContext } from './house-right-context';
import { plantingBeds, sidePlantingBeds, treeSites, bedPoint, plantMatrix, type PlantingBed } from './house-planting';
import { partitionFoliage, partitionInstances } from './house-rendering';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seedRandom, type HouseMaterials } from './house-architecture';

export type WindUniforms={uWindTime:{value:number};uWindStrength:{value:number}};

export async function buildLandscape(maps:HouseMaterials,mobile:boolean,wind:WindUniforms) {
  const root=new T.Group();root.name='Street, planting beds and real 3D vegetation';
  const manager=new T.LoadingManager();
  if(mobile)manager.setURLModifier(url=>url.replace('/house/models/textures/','/house/models/textures/mobile/'));
  const random=seedRandom(71233),loader=new GLTFLoader(manager);
  const modelNames=[mobile?'tree_small_02-low':'tree_small_02','tree_small_02-low','shrub_02','shrub_03','grass_medium_02'];
  const requests=new Map<string,Promise<T.Group>>();
  const models=await Promise.all(modelNames.map(name=>{let request=requests.get(name);if(!request){request=loader.loadAsync(`/house/models/${name}.glb`).then(g=>g.scene);requests.set(name,request);}return request;}));
  // Both authored tree variants have identical materials, samplers and image bytes.
  // Share the source materials before prepareModel clones their per-tree wind uniforms.
  if(models[0]!==models[1]){
    const shared=new Map<string,T.Material>();
    models[0].traverse(object=>{if(object instanceof T.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])shared.set(material.name,material);});
    models[1].traverse(object=>{if(object instanceof T.Mesh)object.material=Array.isArray(object.material)?object.material.map(material=>shared.get(material.name)??material):shared.get(object.material.name)??object.material;});
  }
  // Botanical GLBs contain a row of alternative specimens, not one plant.
  // Use a single specimen so scaling cannot scatter the whole nursery row.
  for(let i=2;i<models.length;i++){const specimen=new T.Group();specimen.add(models[i].children[0].clone(true));models[i]=specimen;}
  const streetGround=buildStreetGround(maps.paving);
  const beds=plantingBeds;
  const streetscape=buildStreetscape(maps,[...beds,...sidePlantingBeds]);
  // Retain the existing crown/leaf realization when resurfacing the street.
  // Before streetscape extraction, the original 158 × 174 pavers consumed
  // three samples each from the foliage's generator.
  for(let i=0;i<158*174*3;i++)random();
  const transform=new T.Object3D();
  root.add(streetGround,streetscape.root,buildLeftContext(maps),buildRightContext(maps));

  function addWind(material:T.MeshStandardMaterial,height:number,leaf:boolean) {
    material.userData.houseWind=true;material.defines={...material.defines,HOUSE_WIND_ACTIVE:0};
    material.transparent=false;material.alphaTest=.45;material.side=T.DoubleSide;material.depthWrite=true;
    if(leaf){material.color.multiplyScalar(1.3);material.roughness=.78;}
    const vertex=(shader:T.WebGLProgramParametersWithUniforms)=>{
      Object.assign(shader.uniforms,wind,{uPlantHeight:{value:height},uLeaf:{value:leaf?1:0}});
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nuniform float uWindTime;uniform float uWindStrength;uniform float uPlantHeight;uniform float uLeaf;`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #if HOUSE_WIND_ACTIVE == 1
        float flex=pow(clamp(position.y/uPlantHeight,0.0,1.0),2.0);
        float gust=sin(uWindTime*.75+position.y*.8+position.x*.3);
        float flutter=sin(uWindTime*2.4+position.x*8.0+position.z*7.0);
        transformed.x += uWindStrength*flex*(gust*.035+flutter*.009*uLeaf);
        transformed.z += uWindStrength*flex*gust*.012;
        #endif
      `);
    };
    material.onBeforeCompile=shader=>{vertex(shader);if(leaf){shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * .09;`);}};
    material.customProgramCacheKey=()=>`lothuus-vegetation-${leaf?'leaves':'wood'}-v1`;
    return vertex;
  }
  function prepareModel(model:T.Group) {
    const bounds=new T.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;
    model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];
      if(mats.some(m=>/trunk/i.test(m.name))){
        const geometry=o.geometry.clone(),p=geometry.getAttribute('position');geometry.computeBoundingBox();const bb=geometry.boundingBox!;const limit=bb.min.y+(bb.max.y-bb.min.y)*.38;const bins=32;
        const sums=Array.from({length:bins},()=>({x:0,z:0,n:0}));
        for(let i=0;i<p.count;i++){if(p.getY(i)>limit)continue;const k=Math.min(bins-1,Math.floor((p.getY(i)-bb.min.y)/(limit-bb.min.y)*bins));sums[k].x+=p.getX(i);sums[k].z+=p.getZ(i);sums[k].n++;}
        for(let i=0;i<p.count;i++){if(p.getY(i)>limit)continue;const k=Math.min(bins-1,Math.floor((p.getY(i)-bb.min.y)/(limit-bb.min.y)*bins));const b=sums[k];if(!b.n)continue;const f=.62+.38*Math.pow((p.getY(i)-bb.min.y)/(limit-bb.min.y),4);p.setX(i,b.x/b.n+(p.getX(i)-b.x/b.n)*f);p.setZ(i,b.z/b.n+(p.getZ(i)-b.z/b.n)*f);}
        geometry.computeVertexNormals();o.geometry=geometry;
      }
      const prepared=mats.map(m=>{const mat=(m as T.MeshStandardMaterial).clone();const leaf=/leav|shrub|grass/i.test(mat.name);const patch=addWind(mat,height,leaf);if(mat.map){mat.map.anisotropy=8;mat.map.needsUpdate=true;}const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:T.DoubleSide});depth.userData.houseWind=true;depth.defines={...depth.defines,HOUSE_WIND_ACTIVE:0};depth.onBeforeCompile=patch;depth.customProgramCacheKey=()=>`plant-shadow-${leaf}`;o.customDepthMaterial=depth;return mat;});o.material=Array.isArray(o.material)?prepared:prepared[0];}});
    // Anchor trees at the centre of the lowest trunk section. The canopy's
    // bounding-box centre is offset from the roots and moves with rotation.
    model.updateMatrixWorld(true);const foot=new T.Box3(),point=new T.Vector3();
    model.traverse(o=>{if(o instanceof T.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];if(!mats.some(m=>/trunk/i.test(m.name)))return;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(point.y<bounds.min.y+height*.025)foot.expandByPoint(point);}}});
    const anchor=foot.isEmpty()?bounds.getCenter(new T.Vector3()):foot.getCenter(new T.Vector3());
    partitionFoliage(model,height/3);
    return {model,bounds,height,anchor};
  }
  const treeHigh=prepareModel(models[0]);const treeLow=models[1]===models[0]?treeHigh:prepareModel(models[1]);
  function tree(model:typeof treeHigh,x:number,z:number,height:number,width:number,rotation:number) {
    const group=new T.Group();const copy=model.model.clone(true);const center=model.anchor;copy.position.set(-center.x,-model.bounds.min.y,-center.z);group.add(copy);
    group.scale.set(height/model.height*width,height/model.height,height/model.height);group.position.set(x,.1,z);group.rotation.y=rotation;root.add(group);return group;
  }
  treeSites.forEach((site,i)=>tree(i===0?treeHigh:treeLow,site.x,site.z,site.height,site.width,site.rotation));
  // Reuse the reduced tree model for background garden depth.
  for(const [x,z,height,rotation] of [[11.17,1.2,9,.7],[11.17,-3.5,8.5,2.1],[11.17,-8.2,8,4.3]])
    tree(treeLow,x,z,height,.48,rotation);

  // Reuse complete plant geometry with instancing, retaining leaf/branch materials and normals.
  function plantBatch(model:T.Group,placements:{x:number;z:number;height:number;rotation:number}[],bed:PlantingBed) {
    const prepared=prepareModel(model);model.updateMatrixWorld(true);
    model.traverse(o=>{if(o instanceof T.Mesh){const m=new T.InstancedMesh(o.geometry,o.material,placements.length);m.castShadow=m.receiveShadow=true;
      placements.forEach((p,i)=>{m.setMatrixAt(i,plantMatrix(prepared.bounds,bed,p).multiply(o.matrixWorld));});m.customDepthMaterial=o.customDepthMaterial;root.add(partitionInstances(m,2,.08));
    }});
  }
  const hedge=Array.from({length:58},(_,i)=>({x:rightContext.hedgeX+(random()-.5)*.08,z:3.3-i*.46,height:.46+random()*.14,rotation:random()*Math.PI*2}));

  const shrubs:{x:number;z:number;height:number;rotation:number}[]=[];
  for(const bed of beds)for(let x=bed.x-bed.w/2+.42;x<bed.x+bed.w/2-.38;x+=.56)for(const row of [0,1]){if(bed===beds[1]&&x>6&&row===1&&Math.round(x/.56)%2===0)continue;const point=bedPoint(bed,(x-bed.x+bed.w/2)/bed.w,row,.36);shrubs.push({x:point.x+(random()-.5)*.08,z:point.z,height:(bed===beds[0] ? .48 : .65)+random()*.17,rotation:random()*Math.PI*2});}
  // Dense boxwood volumes are built from separate curved leaves, not low-detail blobs.
  const leafShape=new T.Shape();leafShape.moveTo(0,-.5);leafShape.bezierCurveTo(-.48,-.28,-.48,.2,0,.5);leafShape.bezierCurveTo(.48,.2,.48,-.28,0,-.5);
  const leafGeometry=new T.ShapeGeometry(leafShape,3);const lp=leafGeometry.getAttribute('position');
  for(let i=0;i<lp.count;i++)lp.setZ(i,Math.sin((lp.getY(i)+.5)*Math.PI)*.1+Math.abs(lp.getX(i))*.12);leafGeometry.computeVertexNormals();
  const leafMat=new T.MeshStandardMaterial({color:'#294b13',roughness:.72,side:T.DoubleSide});
  addWind(leafMat,.8,true);
  const leafCount=shrubs.length*(mobile?700:1500),boxwood=new T.InstancedMesh(leafGeometry,leafMat,leafCount);boxwood.name='Dense boxwood with individually curved leaves';
  let leafIndex=0;const leafColor=new T.Color();
  for(const shrub of shrubs)for(let i=0;i<(mobile?700:1500);i++){
    const azimuth=random()*Math.PI*2,vertical=random()*1.8-1,radius=.82+random()*.18;
    const horizontal=Math.sqrt(1-vertical*vertical);
    transform.position.set(shrub.x+Math.cos(azimuth)*horizontal*.34*radius,.14+shrub.height*.5+vertical*shrub.height*.5*radius,shrub.z+Math.sin(azimuth)*horizontal*.32*radius);
    transform.rotation.set(random()*Math.PI,random()*Math.PI*2,random()*Math.PI*2);
    const length=.05+random()*.02;transform.scale.set(length*.66,length, length);transform.updateMatrix();boxwood.setMatrixAt(leafIndex,transform.matrix);
    const shade=.7+random()*.42;boxwood.setColorAt(leafIndex,leafColor.setRGB(shade,shade,shade*(.75+random()*.2)));leafIndex++;
  }
  boxwood.castShadow=boxwood.receiveShadow=true;root.add(partitionInstances(boxwood,4,.06));
  // The three side beds have low clipped volumes, not scalloped rows of
  // separate spherical shrubs. Fill the top and four edges with real leaves.
  const sidePerBed=mobile?4000:9000,sideLeaves=new T.InstancedMesh(leafGeometry,leafMat,sidePlantingBeds.length*sidePerBed);let sideIndex=0;
  for(const bed of sidePlantingBeds)for(let i=0;i<sidePerBed;i++){
    const u=random(),v=random(),surface=i%5;
    let x=bed.x+(u-.5)*(bed.w-.17),z=bed.z+(v-.5)*(bed.d-.17),y=.14+random()*.44;
    if(surface===0)y=.60-Math.pow((x-bed.x)/(bed.w/2),4)*.035-Math.pow((z-bed.z)/(bed.d/2),4)*.035;
    else if(surface<3)x=bed.x+(surface===1?-1:1)*(bed.w/2-.09);
    else z=bed.z+(surface===3?-1:1)*(bed.d/2-.09);
    transform.position.set(x+(random()-.5)*.025,y,z+(random()-.5)*.025);transform.rotation.set(random()*Math.PI,random()*Math.PI*2,random()*Math.PI*2);const length=.047+random()*.02;transform.scale.set(length*.7,length,length);transform.updateMatrix();sideLeaves.setMatrixAt(sideIndex,transform.matrix);const shade=.72+random()*.31;sideLeaves.setColorAt(sideIndex,leafColor.setRGB(shade,shade,shade*.78));sideIndex++;
  }
  sideLeaves.name='Clipped low shrubs in the three separate side tree beds';sideLeaves.castShadow=sideLeaves.receiveShadow=true;root.add(partitionInstances(sideLeaves,4,.06));
  // Low continuous planting at the far edge of the street, separated from
  // LOTHUUS by the entire clear carriageway.
  const hedgePerPlant=mobile?300:650,hedgeLeaves=new T.InstancedMesh(leafGeometry,leafMat,hedge.length*hedgePerPlant);
  let hedgeIndex=0;
  for(const p of hedge)for(let i=0;i<hedgePerPlant;i++){
    transform.position.set(p.x+(random()-.5)*.69,.13+random()*p.height,p.z+(random()-.5)*.55);transform.rotation.set(random()*Math.PI,random()*Math.PI*2,random()*Math.PI*2);const length=.045+random()*.025;transform.scale.set(length*.7,length,length);transform.updateMatrix();hedgeLeaves.setMatrixAt(hedgeIndex,transform.matrix);const shade=.7+random()*.35;hedgeLeaves.setColorAt(hedgeIndex,leafColor.setRGB(shade,shade,shade*.8));hedgeIndex++;
  }
  hedgeLeaves.name='Low hedge on the opposite pavement';hedgeLeaves.castShadow=hedgeLeaves.receiveShadow=true;root.add(partitionInstances(hedgeLeaves,4,.06));
  // The reference has dense broadleaf crowns. Rebuild that density with real, lobed
  // leaves around the scanned branching skeleton, rather than scaling up sparse foliage.
  const mapleShape=new T.Shape();mapleShape.moveTo(0,-.5);
  for(const [x,y] of [[-.08,-.22],[-.4,-.29],[-.29,-.05],[-.48,.08],[-.15,.13],[0,.5],[.15,.13],[.48,.08],[.29,-.05],[.4,-.29],[.08,-.22],[0,-.5]])mapleShape.lineTo(x,y);
  const mapleGeometry=new T.ShapeGeometry(mapleShape,1);const mp=mapleGeometry.getAttribute('position');
  for(let i=0;i<mp.count;i++)mp.setZ(i,Math.sin((mp.getY(i)+.5)*Math.PI)*.09+Math.abs(mp.getX(i))*.13);mapleGeometry.computeVertexNormals();
  const canopyMat=new T.MeshStandardMaterial({name:'broadleaf-canopy',color:'#36561b',roughness:.78,side:T.DoubleSide});addWind(canopyMat,12,true);
  const crowns=[...treeSites.map((site,i)=>({x:site.x,y:i===0?9:8.8,z:site.z,rx:i===0?4.2:2.5,ry:i===0?4:3.2,rz:2.5,clusters:i===0?54:28})),...sidePlantingBeds.map((bed,i)=>({x:bed.x,y:6.4-i*.25,z:bed.z,rx:.93,ry:2.5-i*.12,rz:1.05,clusters:24}))];
  const perCluster=mobile?190:450,canopyCount=crowns.reduce((a,c)=>a+c.clusters*perCluster,0);
  const canopyLeaves=new T.InstancedMesh(mapleGeometry,canopyMat,canopyCount);canopyLeaves.name='Dense broadleaf crowns — separate lobed leaves';
  let canopyIndex=0;
  function ball(){let x,y,z;do{x=random()*2-1;y=random()*2-1;z=random()*2-1;}while(x*x+y*y+z*z>1);return{x,y,z};}
  for(const crown of crowns)for(let cluster=0;cluster<crown.clusters;cluster++){
    const q=ball(),cx=crown.x+q.x*crown.rx,cy=crown.y+q.y*crown.ry,cz=crown.z+q.z*crown.rz;
    for(let i=0;i<perCluster;i++){
      const p=ball();transform.position.set(cx+p.x*.82,cy+p.y*.67,cz+p.z*.74);transform.rotation.set(random()*Math.PI,random()*Math.PI*2,random()*Math.PI*2);
      const length=.12+random()*.055;transform.scale.set(length*.9,length,length);transform.updateMatrix();canopyLeaves.setMatrixAt(canopyIndex,transform.matrix);
      const shade=.68+random()*.42;canopyLeaves.setColorAt(canopyIndex,leafColor.setRGB(shade*(1+random()*.1),shade,shade*.78));canopyIndex++;
    }
  }
  canopyLeaves.castShadow=canopyLeaves.receiveShadow=true;root.add(partitionInstances(canopyLeaves,6,.06));

  // Sparse botanical models add small shoots above the compact evergreen mass.
  for(const bed of beds)plantBatch(models[2].clone(true),shrubs.filter(p=>Math.abs(p.x-bed.x)<bed.w/2).filter((_,i)=>i%5===0).map(p=>({...p,height:p.height*.7})),bed);

  const herbs:{x:number;z:number;height:number;rotation:number}[]=[];
  for(let i=0;i<110;i++)herbs.push({...bedPoint(beds[1],Math.pow(random(),1.35),random(),.3),height:.65+random()*.6,rotation:random()*6.28});
  plantBatch(models[3],herbs,beds[1]);
  const grasses:{x:number;z:number;height:number;rotation:number}[]=[];
  for(let i=0;i<32;i++)grasses.push({...bedPoint(beds[1],.78+random()*.2,random(),.35),height:.55+random()*.45,rotation:random()*6.28});
  plantBatch(models[4],grasses,beds[1]);
  // Pale, fine-bladed tussocks around the two right trunks are a distinct
  // layer in the reference, above the low green foreground perennials.
  const grassPositions:number[]=[],grassNormals:number[]=[];
  for(let clump=0;clump<13;clump++){
    const p=bedPoint(beds[1],.73+random()*.25,.2+random()*.58,.3);
    for(let blade=0;blade<(mobile?45:90);blade++){
      const angle=random()*Math.PI*2,h=.48+random()*.54,bend=.12+random()*.27;
      const bx=p.x+(random()-.5)*.23,bz=p.z+(random()-.5)*.23,width=.008+random()*.009;
      const points=[0,.34,.69,1].map(t=>new T.Vector3(bx+Math.cos(angle)*bend*t*t,.12+h*t,bz+Math.sin(angle)*bend*t*t));
      const side=new T.Vector3(-Math.sin(angle)*width,0,Math.cos(angle)*width);
      for(let segment=0;segment<3;segment++){
        const a=points[segment],b=points[segment+1],wa=side.clone().multiplyScalar(1-segment/3),wb=side.clone().multiplyScalar(1-(segment+1)/3);
        for(const q of [a.clone().sub(wa),b.clone().sub(wb),a.clone().add(wa),a.clone().add(wa),b.clone().sub(wb),b.clone().add(wb)]){grassPositions.push(q.x,q.y,q.z);grassNormals.push(Math.cos(angle),.2,Math.sin(angle));}
      }
    }
  }
  const goldenGrassGeometry=new T.BufferGeometry();goldenGrassGeometry.setAttribute('position',new T.Float32BufferAttribute(grassPositions,3));goldenGrassGeometry.setAttribute('normal',new T.Float32BufferAttribute(grassNormals,3));goldenGrassGeometry.computeVertexNormals();
  const goldenGrassMaterial=new T.MeshStandardMaterial({color:'#8d8756',roughness:.92,side:T.DoubleSide});addWind(goldenGrassMaterial,1.2,true);
  const goldenGrass=new T.Mesh(goldenGrassGeometry,goldenGrassMaterial);goldenGrass.name='Fine straw-coloured tussocks around the right trunks';goldenGrass.castShadow=goldenGrass.receiveShadow=true;root.add(goldenGrass);
  // Larger curved foliage breaks up the repeated boxwood balls towards the
  // right-hand kerb, as in the mixed green planting of the photograph.
  const broadShape=new T.Shape();broadShape.moveTo(0,-.5);broadShape.bezierCurveTo(-.48,-.28,-.47,.28,0,.6);broadShape.bezierCurveTo(.47,.28,.48,-.28,0,-.5);
  const broadGeometry=new T.ShapeGeometry(broadShape,4),bp=broadGeometry.getAttribute('position');for(let i=0;i<bp.count;i++)bp.setZ(i,Math.sin((bp.getY(i)+.5)*Math.PI)*.16+Math.abs(bp.getX(i))*.12);broadGeometry.computeVertexNormals();
  const broadMaterial=new T.MeshStandardMaterial({color:'#355822',roughness:.83,side:T.DoubleSide});addWind(broadMaterial,.85,true);
  const broadCount=mobile?1100:2400,broadLeaves=new T.InstancedMesh(broadGeometry,broadMaterial,broadCount);
  for(let i=0;i<broadCount;i++){
    const cluster=i%16,u=.52+(cluster/15)*.44,p=bedPoint(beds[1],u,.83,.32),az=random()*Math.PI*2,r=Math.sqrt(random())*.28,h=.2+random()*.44;
    transform.position.set(p.x+Math.cos(az)*r,h,p.z+Math.sin(az)*r);transform.rotation.set(-.4+random()*1.4,random()*Math.PI*2,random()*Math.PI*2);const length=.12+random()*.11;transform.scale.set(length*.9,length,length);transform.updateMatrix();broadLeaves.setMatrixAt(i,transform.matrix);
    const tint=.76+random()*.34;broadLeaves.setColorAt(i,leafColor.setRGB(tint*.97,tint,tint*.76));
  }
  broadLeaves.name='Mixed broadleaf perennials along the right front kerb';broadLeaves.castShadow=broadLeaves.receiveShadow=true;root.add(partitionInstances(broadLeaves,3,.08));
  // Fine, airy white flowers above the low shrubs, with stems and separate petals.
  const stems:T.BufferGeometry[]=[];const flowerTransforms:T.Matrix4[]=[];
  for(let i=0;i<260;i++){
    const {x,z}=bedPoint(beds[1],Math.pow(random(),1.4),random(),.27),h=.62+random()*.66;
    const curve=new T.CatmullRomCurve3([new T.Vector3(x,.3,z),new T.Vector3(x+.08,h*.6,z+.03),new T.Vector3(x+(random()-.5)*.25,h,z)]);
    stems.push(new T.TubeGeometry(curve,4,.003,3,false));
    for(let j=0;j<5;j++){
      const p=curve.getPoint(.55+j*.09);
      for(let petal=0;petal<4;petal++){const angle=petal*Math.PI/2;transform.position.set(p.x+Math.cos(angle)*.012,p.y+Math.sin(angle)*.012,p.z);transform.rotation.set(random(),random(),random());transform.scale.set(.012,.007,.006);transform.updateMatrix();flowerTransforms.push(transform.matrix.clone());}
    }
  }
  const stemGeometry=mergeGeometries(stems);stems.forEach(g=>g.dispose());if(stemGeometry)root.add(new T.Mesh(stemGeometry,new T.MeshStandardMaterial({color:'#68733d',roughness:1})));
  const flowers=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:'#e7e8d8',roughness:.88,side:T.DoubleSide}),flowerTransforms.length);flowerTransforms.forEach((m,i)=>flowers.setMatrixAt(i,m));flowers.receiveShadow=true;root.add(flowers);
  const windMaterials=new Set<T.MeshStandardMaterial|T.MeshDepthMaterial>();
  root.traverse(object=>{if(object instanceof T.Mesh){for(const material of Array.isArray(object.material)?object.material:[object.material])if(material.userData.houseWind)windMaterials.add(material as T.MeshStandardMaterial);if(object.customDepthMaterial?.userData.houseWind)windMaterials.add(object.customDepthMaterial as T.MeshDepthMaterial);}});
  function setWindEnabled(enabled:boolean){for(const material of windMaterials){const value=enabled?1:0;if(material.defines?.HOUSE_WIND_ACTIVE!==value){material.defines={...material.defines,HOUSE_WIND_ACTIVE:value};material.needsUpdate=true;}}}
  return {root,paverCount:streetscape.paverCount,setWindEnabled};
}
