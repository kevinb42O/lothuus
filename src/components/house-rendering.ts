import * as T from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** The hero always looks down -Z. Draw the nearest opaque leaves/stones first,
 * so depth testing rejects covered surfaces before their PBR fragment shader.
 * Only draw order changes: every original matrix, colour and triangle remains.
 */
export function orderHeroInstances(root:T.Object3D){
  const matrix=new T.Matrix4();
  root.traverse(object=>{
    if(!(object instanceof T.InstancedMesh)||!object.count)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    if(materials.some(material=>material.transparent||!material.depthWrite))return;
    const source=object.instanceMatrix.array.slice(),colors=object.instanceColor?.array.slice();
    const inverse=object.matrixWorld.clone().invert(),direction=new T.Vector3(0,0,1).transformDirection(inverse);
    const order=Array.from({length:object.count},(_,index)=>index);
    order.sort((a,b)=>direction.x*(source[b*16+12]-source[a*16+12])+direction.y*(source[b*16+13]-source[a*16+13])+direction.z*(source[b*16+14]-source[a*16+14]));
    order.forEach((sourceIndex,index)=>{
      matrix.fromArray(source,sourceIndex*16);object.setMatrixAt(index,matrix);
      if(colors)object.instanceColor!.array.set(colors.subarray(sourceIndex*3,sourceIndex*3+3),index*3);
    });
    object.instanceMatrix.needsUpdate=true;if(object.instanceColor)object.instanceColor.needsUpdate=true;
  });
}

/** Share only bit-for-bit equal vertices. Rounded instanced stones otherwise
 * repeat the same vertex shader work for every triangle of every stone.
 * Indices retain triangle order; normals, UV seams and every attribute survive.
 */
export function indexExactGeometry(source:T.BufferGeometry){
  if(source.index||source.morphAttributes.position)return source;
  const attributes=Object.entries(source.attributes);
  if(attributes.some(([,attribute])=>attribute instanceof T.InterleavedBufferAttribute||attribute instanceof T.InstancedBufferAttribute))return source;
  const vertices:number[]=[],indices:number[]=[],unique=new Map<string,number>();
  for(let i=0;i<source.getAttribute('position').count;i++){
    const key=attributes.map(([,attribute])=>Array.from(attribute.array.slice(i*attribute.itemSize,(i+1)*attribute.itemSize),value=>Object.is(value,-0)?'-0':String(value)).join(',')).join('|');
    let index=unique.get(key);
    if(index===undefined){index=vertices.length;unique.set(key,index);vertices.push(i);}
    indices.push(index);
  }
  if(vertices.length===indices.length)return source;
  const geometry=source.clone();
  for(const [name,attribute] of attributes){
    const values=attribute.array.slice(0,vertices.length*attribute.itemSize);
    vertices.forEach((original,i)=>{for(let j=0;j<attribute.itemSize;j++)values[i*attribute.itemSize+j]=attribute.array[original*attribute.itemSize+j];});
    const compact=new T.BufferAttribute(values,attribute.itemSize,attribute.normalized);compact.name=attribute.name;compact.setUsage((attribute as T.BufferAttribute).usage);compact.gpuType=(attribute as T.BufferAttribute).gpuType;geometry.setAttribute(name,compact);
  }
  geometry.setIndex(indices);return geometry;
}

export function indexStaticScene(root:T.Object3D){
  const indexed=new Map<T.BufferGeometry,T.BufferGeometry>();
  root.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    const source=object.geometry;
    // Large scanned/baked meshes are already indexed. Bound initialization work.
    if(source.index||source.getAttribute('position').count>20000)return;
    let geometry=indexed.get(source);if(!geometry){geometry=indexExactGeometry(source);indexed.set(source,geometry);}
    object.geometry=geometry;
  });
  indexed.forEach((geometry,source)=>{if(geometry!==source)source.dispose();});
}

/** Reuse the exact static PCF depth buffer; rasterize only the moving door over it.
 * Depth is copied on the GPU at the original shadow resolution, without readback,
 * approximation, a second light, or changes to the receiving PBR materials.
 * Wind invalidates the cache and uses Three's complete shadow pass as usual.
 */
export class CachedHouseShadow {
  private cache:T.WebGLRenderTarget|null=null;
  private readonly movingScene=new T.Scene();
  private readonly movingCopy:T.Object3D;
  private readonly materials=new Map<T.Material,T.MeshDepthMaterial>();
  private valid=false;

  constructor(private readonly scene:T.Scene,private readonly sun:T.DirectionalLight,private readonly moving:T.Object3D){
    this.movingCopy=moving.clone(true);this.movingCopy.matrixAutoUpdate=false;
    this.movingCopy.traverse(object=>{
      if(!(object instanceof T.Mesh))return;
      object.visible=object.visible&&object.castShadow;
      const depth=(source:T.Material)=>{
        let material=this.materials.get(source);
        if(!material){
          const surface=source as T.MeshStandardMaterial;
          const opposite=source.side===T.FrontSide?T.BackSide:source.side===T.BackSide?T.FrontSide:T.DoubleSide;
          material=new T.MeshDepthMaterial({side:source.shadowSide??opposite,map:surface.map,alphaMap:surface.alphaMap,alphaTest:source.alphaTest,wireframe:surface.wireframe});
          material.visible=source.visible;this.materials.set(source,material);
        }
        return material;
      };
      object.material=Array.isArray(object.material)?object.material.map(depth):depth(object.material);
    });
    this.movingScene.add(this.movingCopy);
  }

  invalidate(){this.valid=false;}

  update(renderer:T.WebGLRenderer,camera:T.Camera,wind:boolean){
    if(wind){this.invalidate();renderer.shadowMap.needsUpdate=true;return;}
    const shadow=this.sun.shadow,previousTarget=renderer.getRenderTarget();
    if(!this.valid){
      const visible=this.moving.visible;this.moving.visible=false;
      try{renderer.shadowMap.needsUpdate=true;shadow.needsUpdate=true;renderer.render(this.scene,camera);}
      finally{this.moving.visible=visible;renderer.setRenderTarget(previousTarget);}
      const map=shadow.map!;
      if(!this.cache||this.cache.width!==map.width||this.cache.height!==map.height){
        this.cache?.dispose();this.cache=new T.WebGLRenderTarget(map.width,map.height,{depthTexture:new T.DepthTexture(map.width,map.height,map.depthTexture!.type)});
        renderer.initRenderTarget(this.cache);
      }
      renderer.copyTextureToTexture(map.depthTexture!,this.cache.depthTexture!);this.valid=true;
    }
    renderer.copyTextureToTexture(this.cache!.depthTexture!,shadow.map!.depthTexture!);
    this.moving.updateWorldMatrix(true,false);
    this.movingCopy.matrix.copy(this.moving.matrixWorld);this.movingCopy.matrixWorldNeedsUpdate=true;
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.setRenderTarget(shadow.map as T.WebGLRenderTarget);renderer.render(this.movingScene,shadow.camera);}
    finally{renderer.autoClear=autoClear;renderer.setRenderTarget(previousTarget);}
    renderer.shadowMap.needsUpdate=false;
  }

  dispose(){this.cache?.dispose();this.materials.forEach(material=>material.dispose());}
}

/** Keep every instance, but cull small spatial batches independently in every camera/pass. */
export function partitionInstances(mesh:T.InstancedMesh, cellSize:number, windPadding=0) {
  const cells=new Map<string,number[]>(),matrix=new T.Matrix4(),position=new T.Vector3();
  for(let i=0;i<mesh.count;i++) {
    mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
    const key=`${Math.floor(position.x/cellSize)},${Math.floor(position.y/cellSize)},${Math.floor(position.z/cellSize)}`;
    const cell=cells.get(key);if(cell)cell.push(i);else cells.set(key,[i]);
  }
  const group=new T.Group();group.name=mesh.name;const color=new T.Color();
  for(const [key,indices] of cells) {
    const batch=new T.InstancedMesh(mesh.geometry,mesh.material,indices.length);
    batch.name=`${mesh.name} / ${key}`;batch.castShadow=mesh.castShadow;batch.receiveShadow=mesh.receiveShadow;
    batch.customDepthMaterial=mesh.customDepthMaterial;
    indices.forEach((source,i)=>{mesh.getMatrixAt(source,matrix);batch.setMatrixAt(i,matrix);if(mesh.instanceColor){mesh.getColorAt(source,color);batch.setColorAt(i,color);}});
    batch.computeBoundingBox();batch.computeBoundingSphere();
    if(windPadding){batch.boundingBox!.expandByScalar(windPadding);batch.boundingSphere!.radius+=windPadding;}
    group.add(batch);
  }
  // Instance buffers belong to each batch; the original shared geometry/material stay alive.
  mesh.dispose();
  return group;
}

/** Spatially cull scanned foliage without changing any vertex, normal, UV or triangle. */
export function partitionFoliage(model:T.Group, cellSize:number) {
  const originals:T.Mesh[]=[];
  model.traverse(object=>{if(object instanceof T.Mesh&&!Array.isArray(object.material)&&/leav/i.test(object.material.name)&&object.geometry.index)originals.push(object);});
  const vertex=new T.Vector3(),center=new T.Vector3();
  for(const original of originals){
    const source=original.geometry,index=source.index!,positions=source.getAttribute('position');
    const cells=new Map<string,number[]>();
    for(let i=0;i<index.count;i+=3){
      center.set(0,0,0);
      for(let j=0;j<3;j++)center.add(vertex.fromBufferAttribute(positions,index.getX(i+j)));
      center.multiplyScalar(1/3);
      const key=`${Math.floor(center.x/cellSize)},${Math.floor(center.y/cellSize)},${Math.floor(center.z/cellSize)}`;
      let cell=cells.get(key);if(!cell){cell=[];cells.set(key,cell);}cell.push(index.getX(i),index.getX(i+1),index.getX(i+2));
    }
    const group=new T.Group();group.name=original.name;group.position.copy(original.position);group.quaternion.copy(original.quaternion);group.scale.copy(original.scale);
    for(const indices of cells.values()){
      const geometry=new T.BufferGeometry();
      // Share attribute buffers across cells. Only the triangle index lists are partitioned.
      for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
      geometry.setIndex(indices);const box=new T.Box3();
      for(const i of indices)box.expandByPoint(vertex.fromBufferAttribute(positions,i));
      geometry.boundingBox=box.expandByScalar(.06);geometry.boundingSphere=box.getBoundingSphere(new T.Sphere());
      const mesh=new T.Mesh(geometry,original.material);mesh.castShadow=original.castShadow;mesh.receiveShadow=original.receiveShadow;mesh.customDepthMaterial=original.customDepthMaterial;group.add(mesh);
    }
    original.parent!.add(group);original.removeFromParent();source.dispose();
  }
}

/** GTAO's normal override ignores wind shaders, so its result is static until the camera changes. */
export class CachedHouseAO extends GTAOPass {
  private invalid=true;
  private readonly cachedQuad=new FullScreenQuad();

  invalidate(){this.invalid=true;}

  override setSize(width:number,height:number){super.setSize(width,height);this.invalidate();}

  override render(renderer:T.WebGLRenderer,writeBuffer:T.WebGLRenderTarget,readBuffer:T.WebGLRenderTarget,deltaTime:number,maskActive:boolean) {
    if(this.invalid){super.render(renderer,writeBuffer,readBuffer,deltaTime,maskActive);this.invalid=false;return;}
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);
    this.copyMaterial.uniforms.tDiffuse.value=readBuffer.texture;
    this.copyMaterial.blending=T.NoBlending;this.cachedQuad.material=this.copyMaterial;this.cachedQuad.render(renderer);
    this.blendMaterial.uniforms.intensity.value=this.blendIntensity;
    this.blendMaterial.uniforms.tDiffuse.value=this.gtaoMap;
    this.cachedQuad.material=this.blendMaterial;this.cachedQuad.render(renderer);
    renderer.autoClear=autoClear;
  }

  override dispose(){super.dispose();this.cachedQuad.dispose();this.gtaoMaterial.dispose();this.blendMaterial.dispose();}
}


/** Exterior glass keeps its authored tint, pebble normals and real reflections.
 * Screen-space refraction is unnecessary here and conflicts with the cached
 * multipass scene, leaving window panes black and privacy panes untextured.
 */
export function prepareExteriorGlass(root:T.Object3D) {
  root.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(material instanceof T.MeshPhysicalMaterial&&material.transmission>0){material.transmission=0;material.needsUpdate=true;}
    }
  });
}
