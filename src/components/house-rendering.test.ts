import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { CachedHouseAO, CachedHouseShadow, indexExactGeometry, indexStaticScene, orderHeroInstances, partitionFoliage, partitionInstances } from './house-rendering';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

test('hero depth ordering retains every instance transform and matching colour',()=>{
  const root=new T.Group(),mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),4),matrix=new T.Matrix4(),color=new T.Color();root.add(mesh);
  const expected=new Map<string,string>();
  [1,7,-2,4].forEach((z,i)=>{matrix.makeTranslation(i,0,z);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setRGB(i/4,.5,1));mesh.getColorAt(i,color);expected.set(JSON.stringify(matrix.elements),JSON.stringify(color.toArray()));});
  root.updateMatrixWorld(true);orderHeroInstances(root);
  let previous=Infinity;
  for(let i=0;i<4;i++){mesh.getMatrixAt(i,matrix);mesh.getColorAt(i,color);assert.ok(matrix.elements[14]<=previous);previous=matrix.elements[14];const key=JSON.stringify(matrix.elements);assert.equal(JSON.stringify(color.toArray()),expected.get(key));expected.delete(key);}
  assert.equal(expected.size,0);
  (mesh.material as T.Material).transparent=true;const unchanged=mesh.instanceMatrix.array.slice();root.rotation.y=Math.PI;root.updateMatrixWorld(true);orderHeroInstances(root);assert.deepEqual(mesh.instanceMatrix.array,unchanged);
  (mesh.material as T.Material).transparent=false;orderHeroInstances(root);mesh.getMatrixAt(0,matrix);assert.equal(matrix.elements[14],-2,'Ordering follows the hero world axis, including rotated instance groups');
  mesh.dispose();mesh.geometry.dispose();(mesh.material as T.Material).dispose();
});

test('exact indexing preserves every ordered triangle attribute of rounded paving',()=>{
  const original=new RoundedBoxGeometry(.112,.06,.225,1,.003),indexed=indexExactGeometry(original);
  assert.ok(indexed.index);assert.ok(indexed.getAttribute('position').count<original.getAttribute('position').count);
  for(const [name,source] of Object.entries(original.attributes)){
    const packed=indexed.getAttribute(name);
    for(let i=0;i<indexed.index.count;i++)for(let j=0;j<source.itemSize;j++)assert.equal(packed.array[indexed.index.getX(i)*packed.itemSize+j],source.array[i*source.itemSize+j]);
  }
  assert.deepEqual(indexed.groups,original.groups);
  const scene=new T.Group(),a=new T.Mesh(original),b=new T.Mesh(original);scene.add(a,b);
  indexStaticScene(scene);assert.equal(a.geometry,b.geometry);
  assert.equal(indexExactGeometry(indexed),indexed);
  original.dispose();indexed.dispose();a.geometry.dispose();
});

test('static shadows cache full-resolution depth, retain moving shadows and rebuild after wind',()=>{
  const scene=new T.Scene(),sun=new T.DirectionalLight(),door=new T.Group(),camera=new T.PerspectiveCamera();
  const source=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());source.castShadow=true;door.add(source);scene.add(door,sun);scene.updateMatrixWorld(true);
  sun.shadow.map=new T.WebGLRenderTarget(2048,2048,{depthTexture:new T.DepthTexture(2048,2048,T.UnsignedIntType)});
  let full=0,moving=0,copies=0,target:T.WebGLRenderTarget|null=null;
  const renderer={autoClear:true,shadowMap:{needsUpdate:false},getRenderTarget:()=>target,setRenderTarget:(next:T.WebGLRenderTarget|null)=>{target=next;},initRenderTarget:(cache:T.WebGLRenderTarget)=>{assert.equal(cache.width,2048);assert.equal(cache.depthTexture!.type,T.UnsignedIntType);},copyTextureToTexture:()=>{copies++;},render:(current:T.Scene)=>{
    if(current===scene){full++;assert.equal(door.visible,false);}else{moving++;assert.equal(renderer.autoClear,false);assert.equal(target,sun.shadow.map);const leaf=current.children[0];assert.deepEqual(leaf.matrix.elements,door.matrixWorld.elements);assert.equal((leaf.children[0] as T.Mesh).geometry,source.geometry);assert.equal(((leaf.children[0] as T.Mesh).material as T.Material).side,T.BackSide);}
  }} as unknown as T.WebGLRenderer;
  const cache=new CachedHouseShadow(scene,sun,door);
  try{
    cache.update(renderer,camera,false);assert.equal(full,1);assert.equal(moving,1);assert.equal(copies,2);assert.equal(door.visible,true);assert.equal(renderer.autoClear,true);assert.equal(target,null);
    door.rotation.y=1;door.updateMatrixWorld(true);cache.update(renderer,camera,false);assert.equal(full,1);assert.equal(moving,2);assert.equal(copies,3);
    cache.update(renderer,camera,true);assert.equal(renderer.shadowMap.needsUpdate,true);assert.equal(moving,2);
    cache.update(renderer,camera,false);assert.equal(full,2);assert.equal(moving,3);
  }finally{cache.dispose();sun.shadow.map.dispose();source.geometry.dispose();(source.material as T.Material).dispose();}
});

test('spatial batches retain all geometry, transforms, colors and shadow behavior',()=>{
  const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
  const source=new T.InstancedMesh(geometry,material,6),matrix=new T.Matrix4(),color=new T.Color();
  source.castShadow=source.receiveShadow=true;source.customDepthMaterial=new T.MeshDepthMaterial();
  const expected=new Map<string,number[]>();
  for(let i=0;i<6;i++){
    matrix.compose(new T.Vector3(i*3-9,i%2,2),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i*.1),new T.Vector3(1,2,3));
    source.setMatrixAt(i,matrix);source.setColorAt(i,color.setRGB(i/6,.5,.7));
    source.getMatrixAt(i,matrix);source.getColorAt(i,color);expected.set(JSON.stringify(matrix.elements),color.toArray());
  }
  const batches=partitionInstances(source,4,.06);
  assert.ok(batches.children.length>1);
  let total=0;
  for(const object of batches.children){
    const batch=object as T.InstancedMesh;total+=batch.count;
    assert.equal(batch.geometry,geometry);assert.equal(batch.material,material);
    assert.equal(batch.castShadow,true);assert.equal(batch.receiveShadow,true);
    assert.equal(batch.customDepthMaterial,source.customDepthMaterial);
    const paddedRadius=batch.boundingSphere!.radius;batch.computeBoundingSphere();
    assert.ok(Math.abs(paddedRadius-batch.boundingSphere!.radius-.06)<1e-6);
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,matrix);batch.getColorAt(i,color);
      const key=JSON.stringify(matrix.elements);assert.deepEqual(color.toArray(),expected.get(key));expected.delete(key);
    }
    batch.dispose();
  }
  assert.equal(total,6);assert.equal(expected.size,0);
  geometry.dispose();material.dispose();source.customDepthMaterial.dispose();
});

test('foliage partition keeps the exact triangle indices and shared surface attributes',()=>{
  const model=new T.Group(),material=new T.MeshStandardMaterial({name:'tree_leaves'});
  const geometry=new T.BoxGeometry(12,12,12,3,3,3),original=new T.Mesh(geometry,material);
  original.position.set(2,4,-3);original.rotation.y=.7;original.scale.setScalar(2);
  original.castShadow=original.receiveShadow=true;model.add(original);model.updateMatrixWorld(true);
  const originalMatrix=original.matrixWorld.clone(),expected:string[]=[];
  for(let i=0;i<geometry.index!.count;i+=3)expected.push([0,1,2].map(j=>geometry.index!.getX(i+j)).join(','));
  partitionFoliage(model,4);model.updateMatrixWorld(true);
  const actual:string[]=[];
  assert.ok((model.children[0] as T.Group).children.length>1);
  model.traverse(object=>{if(!(object instanceof T.Mesh))return;
    assert.deepEqual(object.matrixWorld.elements,originalMatrix.elements);
    assert.equal(object.material,material);
    for(const [name,attribute] of Object.entries(geometry.attributes))assert.equal(object.geometry.getAttribute(name),attribute);
    const index=object.geometry.index!,position=object.geometry.getAttribute('position'),point=new T.Vector3();
    for(let i=0;i<index.count;i+=3){
      actual.push([0,1,2].map(j=>index.getX(i+j)).join(','));
      for(let j=0;j<3;j++){point.fromBufferAttribute(position,index.getX(i+j));assert.ok(object.geometry.boundingBox!.containsPoint(point));assert.ok(object.geometry.boundingSphere!.containsPoint(point));}
    }
    object.geometry.dispose();
  });
  assert.deepEqual(actual.sort(),expected.sort());material.dispose();
});

test('cached AO skips scene rendering until the camera or viewport invalidates it',()=>{
  const original=GTAOPass.prototype.render;let fullRenders=0,cachedDraws=0;
  GTAOPass.prototype.render=function(){fullRenders++;};
  const ao=new CachedHouseAO(new T.Scene(),new T.PerspectiveCamera(),32,32);
  const target=new T.WebGLRenderTarget(32,32);
  const renderer={autoClear:true,setRenderTarget(){},render(){cachedDraws++;}} as unknown as T.WebGLRenderer;
  const render=()=>ao.render(renderer,target,target,0,false);
  try{
    render();assert.equal(fullRenders,1);
    render();render();assert.equal(fullRenders,1);assert.equal(cachedDraws,4);
    assert.equal(renderer.autoClear,true);
    ao.invalidate();render();assert.equal(fullRenders,2);
    ao.setSize(64,64);render();assert.equal(fullRenders,3);
    render();assert.equal(cachedDraws,6);
  }finally{GTAOPass.prototype.render=original;ao.dispose();target.dispose();}
});


test('exterior glass retains its texture, normals, tint and reflection without screen-space refraction',async()=>{
  const {prepareExteriorGlass}=await import('./house-rendering');
  const color=new T.DataTexture(new Uint8Array([58,86,84,255]),1,1),normals=new T.DataTexture(new Uint8Array([128,128,255,255]),1,1);
  const glass=new T.MeshPhysicalMaterial({color:'#91b4d2',map:color,normalMap:normals,transmission:.12,transparent:true,opacity:.98});
  const reflection=new T.Texture();glass.envMap=reflection;
  const root=new T.Group();root.add(new T.Mesh(new T.PlaneGeometry(),glass));
  prepareExteriorGlass(root);
  assert.equal(glass.transmission,0);assert.equal(glass.map,color);assert.equal(glass.normalMap,normals);
  assert.equal(glass.envMap,reflection);assert.equal(glass.opacity,.98);assert.equal(glass.color.getHexString(),'91b4d2');
});
