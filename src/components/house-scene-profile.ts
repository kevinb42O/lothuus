import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { CachedHouseAO, CachedHouseShadow, indexStaticScene, prepareExteriorGlass } from './house-rendering';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { sampleHouseEntry, collectionPlaneScale, HOUSE_COLLECTION_PLANE_Z } from './house-entry';
import { HouseCameraRig, stepCameraSpring, type HouseView } from './house-camera';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildArchitecture, type MaterialSet } from './house-architecture';
import { buildLandscape, type WindUniforms } from './house-landscape-wide-baseline';
import { decodeHouseEntrance } from './house-entrance-binary';

type View=HouseView;
export type HouseScene={dispose:()=>void;view:(view:View)=>void;zoom:(factor:number)=>void;wind:(enabled:boolean)=>void;film:(enabled:boolean)=>void;scroll:(progress:number,immediate?:boolean)=>void};
export type HouseCollectionProjection={x:number;y:number;scale:number};
type HouseSceneOptions={mode?:'explorer'|'hero';onLoadProgress?:(progress:number)=>void;onProgress?:(progress:number,collection?:HouseCollectionProjection)=>void};

/** True, independently lit 3D geometry. The reference photograph is never loaded by this renderer. */
export async function mountHouse(element:HTMLElement,onFilmChange?:(playing:boolean,entered?:boolean)=>void,options:HouseSceneOptions={}):Promise<HouseScene> {
  const hero=options.mode==='hero';
  options.onLoadProgress?.(.12);
  const mobile=element.clientWidth<600;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:hero,powerPreference:'high-performance'});
  const dpr=Math.min(window.devicePixelRatio,hero?(mobile?1:1.25):mobile?1.5:1.6);
  renderer.setPixelRatio(dpr);renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  const loader=new T.TextureLoader();const loaded:T.Texture[]=[];
  async function map(name:string,color=false){const t=await loader.loadAsync(`/house/materials/${name}.webp`);if(color)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());loaded.push(t);return t;}
  async function materialSet(prefix:string,names=['color','normal','roughness']):Promise<MaterialSet>{const [color,normal,roughness]=await Promise.all(names.map((name,i)=>map(`${prefix}-${name}`,i===0)));return{color,normal,roughness};}
  let environment:T.DataTexture,sky:T.Texture,brick:MaterialSet,roof:MaterialSet,paving:MaterialSet;
  try{[environment,brick,roof,paving,sky]=await Promise.all([new HDRLoader().loadAsync('/house/materials/daylight.hdr'),materialSet('yellow_bricks'),materialSet('grey_roof_tiles'),materialSet('paving',['color','normalgl','roughness']),loader.loadAsync('/house/materials/front-street-backdrop.webp')]);}
  catch(error){loaded.forEach(t=>t.dispose());renderer.dispose();throw error;}
  options.onLoadProgress?.(.4);
  loaded.push(environment);environment.mapping=T.EquirectangularReflectionMapping;
  sky.colorSpace=T.SRGBColorSpace;sky.wrapS=T.MirroredRepeatWrapping;sky.repeat.x=3;sky.offset.x=-1;loaded.push(sky);
  const scene=new T.Scene();scene.background=new T.Color('#bad1e2');
  scene.backgroundRotation.y=.8;scene.environmentRotation.y=.8;
  const pmrem=new T.PMREMGenerator(renderer),ambient=pmrem.fromEquirectangular(environment);scene.environment=ambient.texture;scene.environmentIntensity=1.15;
  // Distant scenery occupies a fixed world plane. Nearby geometry supplies real
  // parallax; this photograph never tracks the screen or projects onto the house.
  const backdrop=new T.Mesh(new T.PlaneGeometry(720,120),new T.MeshBasicMaterial({map:sky,fog:false}));
  backdrop.name='Distant street — fixed world backdrop';backdrop.position.set(0,46,-88);
  scene.add(backdrop);
  scene.fog=new T.Fog('#bacbd0',95,180);
  const sun=new T.DirectionalLight('#fff2dd',3.2);sun.position.set(-10,19,13);sun.target.position.set(0,2,3);
  sun.castShadow=true;sun.shadow.mapSize.set(mobile?2048:4096,mobile?2048:4096);sun.shadow.camera.left=-19;sun.shadow.camera.right=19;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-12;sun.shadow.camera.near=.5;sun.shadow.camera.far=65;
  sun.shadow.bias=-.00008;sun.shadow.normalBias=.014;sun.shadow.radius=2.2;scene.add(sun,sun.target);
  // This is the accepted builder's geometry, including the latest refined ironwork.
  // Loading its baked buffers avoids expensive contour triangulation on the main thread.
  let entrance:T.Group|undefined;
  try{
    const response=await fetch('/house/models/entrance.bin.gz');
    if(!response.ok||!response.body)throw new Error('Entrance asset unavailable');
    const json=decodeHouseEntrance(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    entrance=new T.ObjectLoader().parse(json) as T.Group;
    entrance.traverse(object=>{
      if(!(object instanceof T.Mesh))return;
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        // ObjectLoader assigns the shared Source after constructing each texture.
        // Mark that final source dirty so procedural glass maps upload on first use.
        for(const value of Object.values(material))if(value instanceof T.Texture)value.needsUpdate=true;
      }
    });
  }catch{/* The authored builder remains the fallback when the cache is unavailable. */}
  const house=buildArchitecture({brick,roof,paving},entrance);scene.add(house.root);
  prepareExteriorGlass(house.root);options.onLoadProgress?.(.58);
  const windUniforms:WindUniforms={uWindTime:{value:0},uWindStrength:{value:0}};
  let landscape:Awaited<ReturnType<typeof buildLandscape>>;
  try{landscape=await buildLandscape({brick,roof,paving},mobile,windUniforms);scene.add(landscape.root);}
  catch(error){disposeScene(scene);loaded.forEach(t=>t.dispose());ambient.dispose();pmrem.dispose();renderer.dispose();throw error;}
  options.onLoadProgress?.(.8);
  indexStaticScene(scene);
  scene.updateMatrixWorld(true);scene.traverse(object=>{object.matrixAutoUpdate=false;});
  house.doorLeaf.matrixAutoUpdate=true;
  let doorVelocity=0;
  // A local reflection probe includes the modeled trees and the actual surrounding geometry.
  // The HDR sky supplies lighting; it is not a photograph projected onto the house.
  const probeTarget=new T.WebGLCubeRenderTarget(mobile?128:256,{type:T.HalfFloatType,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});
  const probe=new T.CubeCamera(.1,90,probeTarget);probe.position.set(0,3.6,4.6);scene.add(probe);
  house.glass.visible=false;renderer.shadowMap.needsUpdate=true;probe.update(renderer,scene);house.glass.visible=true;
  const localReflection=pmrem.fromCubemap(probeTarget.texture);house.glass.envMap=localReflection.texture;house.glass.envMapIntensity=1.3;house.glass.needsUpdate=true;pmrem.dispose();
  options.onLoadProgress?.(.9);
  const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Echt 3D-model van de buitenkant van LOTHUUS, met gemodelleerde gevel, dakpannen, balkon, straat, planten en bomen. Sleep om het huis vanuit een andere hoek te bekijken.');canvas.dataset.scene='geometric-3d';element.append(canvas);
  const camera=new T.PerspectiveCamera(36,1,.12,360);camera.filmGauge=36;
  const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=true;controls.dampingFactor=.085;controls.rotateSpeed=.32;
  controls.minDistance=.35;controls.maxDistance=48;controls.minPolarAngle=Math.PI*.12;controls.maxPolarAngle=Math.PI*.5;controls.cursorStyle='grab';
  const rig=new HouseCameraRig(camera,controls.target);
  if(hero){controls.enabled=false;canvas.style.pointerEvents='none';canvas.setAttribute('aria-label','3D-model van LOTHUUS. Scroll naar beneden om door de voordeur naar de collectie te gaan.');}
  // Vertical swipes continue to scroll the page; horizontal swipes orbit the real model.
  canvas.style.touchAction='pan-y';
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:mobile?0:4});
  if(hero)target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const composer=new EffectComposer(renderer,target);const renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);
  const ao=new CachedHouseAO(scene,camera,1,1);ao.updateGtaoMaterial({radius:.18,distanceExponent:1,thickness:.18});ao.updatePdMaterial({radius:3,lumaPhi:10,depthPhi:2,normalPhi:3});ao.blendIntensity=.22;composer.addPass(ao);
  // Sun shadows and PBR lighting remain; avoid another geometry pass during the scroll journey.
  if(hero)ao.enabled=false;
  // A cheap coverage pass preserves the complete moving door, even where it
  // swings behind the entrance plane. The live DOM grid shows through the rest.
  const doorMaskTarget=hero?new T.WebGLRenderTarget(1,1,{samples:mobile?0:4}):null;
  const doorMaskScene=new T.Scene(),doorMaskMaterial=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,toneMapped:false});
  doorMaskScene.overrideMaterial=doorMaskMaterial;
  const doorMaskLeaf=hero?house.doorLeaf.clone(true):null;
  if(doorMaskLeaf){doorMaskLeaf.matrixAutoUpdate=false;doorMaskScene.add(doorMaskLeaf);}
  const originalClearColor=new T.Color();
  const shadowCache=new CachedHouseShadow(scene,sun,house.doorLeaf);
  // Optical edge falloff in linear light, before the single output transform.
  const lens=new ShaderPass({
    name:'House photographic lens',uniforms:{tDiffuse:{value:null},entranceFade:{value:0},portalEnabled:{value:hero?1:0},tSceneDepth:{value:null},tDoorMask:{value:null},inverseProjection:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D tDiffuse; uniform float entranceFade; uniform float portalEnabled;
      uniform sampler2D tSceneDepth; uniform sampler2D tDoorMask;
      uniform mat4 inverseProjection; uniform mat4 cameraWorld; varying vec2 vUv;
      void main(){
        vec4 image=texture2D(tDiffuse,vUv);
        vec2 p=(vUv-.5)*2.;float edge=smoothstep(.25,1.55,dot(p,p));
        float alpha=image.a;
        if(portalEnabled>.5){
          vec3 eye=cameraWorld[3].xyz;
          vec4 projected=inverseProjection*vec4(vUv*2.-1.,1.,1.);
          vec3 ray=normalize((cameraWorld*vec4(projected.xyz/projected.w,0.)).xyz);
          // The real entrance opening: just behind the facade's deep stone reveal.
          float distanceToEntrance=(3.66-eye.z)/min(ray.z,-.00001);
          vec3 hit=eye+ray*distanceToEntrance;
          float inside=step(abs(hit.x),.715)*step(.405,hit.y)*step(hit.y,3.425);
          float depth=texture2D(tSceneDepth,vUv).x;
          vec4 surface=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);
          vec3 surfaceWorld=(cameraWorld*vec4(surface.xyz/surface.w,1.)).xyz;
          // Keep the stone frame, steps and any other geometry in front of the hole.
          float inFront=1.-step(distanceToEntrance-.025,length(surfaceWorld-eye));
          float door=texture2D(tDoorMask,vUv).r;
          float opening=inside*(1.-inFront)*(1.-door);
          if(eye.z<=3.66)opening=1.-door;
          alpha*=1.-opening;
        }
        vec3 color=mix(image.rgb*(1.-.115*edge),vec3(.0025,.0033,.0037),entranceFade);
        gl_FragColor=vec4(color*alpha,alpha);
      }`,
  });lens.uniforms.tDoorMask.value=doorMaskTarget?.texture??null;composer.addPass(lens);
  const output=new OutputPass();composer.addPass(output);
  let profileMode='full';
  const profileEvent=(event:Event)=>{profileMode=(event as CustomEvent).detail;dirty=true;invalidate();};
  element.addEventListener('profile-mode',profileEvent);
  const basics=new Map<T.Material,T.MeshBasicMaterial>();
  const profileGL=renderer.getContext() as WebGL2RenderingContext,ext=profileGL.getExtension('EXT_disjoint_timer_query_webgl2');
  let profileSamples:number[]=[];
  const profile=(query:WebGLQuery)=>{if(!profileGL.getQueryParameter(query,profileGL.QUERY_RESULT_AVAILABLE)){setTimeout(()=>profile(query),30);return;}profileSamples.push(profileGL.getQueryParameter(query,profileGL.QUERY_RESULT)/1e6);if(profileSamples.length>40)profileSamples.shift();canvas.dataset.gpuProfile=JSON.stringify({mode:profileMode,ms:profileSamples.reduce((s,v)=>s+v,0)/profileSamples.length});profileGL.deleteQuery(query);};
  let capturePending=false;
  const captureImage=document.createElement('img');captureImage.id='house-capture';captureImage.hidden=true;element.append(captureImage);
  const capture=()=>{capturePending=true;dirty=true;invalidate();};element.addEventListener('house-capture',capture);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let lastTick=0;
  let disposed=false,visible=false,frame=0,lastFrame=0,lastShadow=0,shadowDirty=true,dirty=true,windEnabled=false,renderedFrames=0;
  const renderSamples:{calls:number;triangles:number;interval:number}[]=[];
  function render(time:number){windUniforms.uWindTime.value=time*.001;windUniforms.uWindStrength.value=windEnabled&&!reduced.matches?1:0;const shadowUpdate=shadowDirty||(windEnabled&&!reduced.matches&&time-lastShadow>140);if(process.env.NODE_ENV==='development'){renderer.info.autoReset=false;renderer.info.reset();}
    if(shadowUpdate){shadowCache.update(renderer,camera,windEnabled&&!reduced.matches);lastShadow=time;shadowDirty=false;}
    lens.uniforms.entranceFade.value=hero?0:rig.entranceFade;
    if(doorMaskTarget&&doorMaskLeaf){
      house.doorLeaf.updateWorldMatrix(true,false);camera.updateMatrixWorld(true);
      doorMaskLeaf.matrix.copy(house.doorLeaf.matrixWorld);doorMaskLeaf.matrixWorldNeedsUpdate=true;
      renderer.getClearColor(originalClearColor);const clearAlpha=renderer.getClearAlpha(),previousTarget=renderer.getRenderTarget();
      renderer.setRenderTarget(doorMaskTarget);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(doorMaskScene,camera);
      renderer.setRenderTarget(previousTarget);renderer.setClearColor(originalClearColor,clearAlpha);
      lens.uniforms.tSceneDepth.value=composer.readBuffer.depthTexture;
      lens.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
      lens.uniforms.cameraWorld.value.copy(camera.matrixWorld);
    }
    const hidden:T.Object3D[]=[],materials:{mesh:T.Mesh;material:T.Material|T.Material[]}[]=[];
    if(profileMode==='no-planting'){
      for(const child of landscape.root.children)if(!/ground|paving|footpath|context|canopy|weathered|wall|neighbour/i.test(child.name)||/Dense|Clipped|Low hedge|tussocks|perennials|flowers/.test(child.name)){if(child.visible){child.visible=false;hidden.push(child);}}
    }
    if(profileMode==='no-paving')landscape.root.traverse(o=>{if(o.visible&&/road setts|clinker footpath|herringbone bricks/.test(o.name)){o.visible=false;hidden.push(o);}});
    if(profileMode==='basic')scene.traverse(o=>{if(o instanceof T.Mesh){materials.push({mesh:o,material:o.material});const basic=(m:T.Material)=>{let b=basics.get(m);if(!b){const sm=m as T.MeshStandardMaterial;b=new T.MeshBasicMaterial({color:sm.color??0xffffff,map:sm.map,alphaMap:sm.alphaMap,alphaTest:m.alphaTest,side:m.side,transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite});basics.set(m,b);}return b;};o.material=Array.isArray(o.material)?o.material.map(basic):basic(o.material);}});
    const query=ext?profileGL.createQuery():null;if(query)profileGL.beginQuery(ext.TIME_ELAPSED_EXT,query);
    composer.render();
    if(capturePending){captureImage.src=canvas.toDataURL('image/png');capturePending=false;}
    if(query){profileGL.endQuery(ext.TIME_ELAPSED_EXT);setTimeout(()=>profile(query),30);}
    hidden.forEach(o=>o.visible=true);materials.forEach(({mesh,material})=>mesh.material=material);
    if(process.env.NODE_ENV==='development'){
      renderSamples.push({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,interval:lastFrame?time-lastFrame:0});if(renderSamples.length>60)renderSamples.shift();
      canvas.dataset.renderStats=JSON.stringify({frames:++renderedFrames,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,samples:renderSamples.length,fps:1000/(renderSamples.reduce((s,x)=>s+x.interval,0)/renderSamples.filter(x=>x.interval>0).length),averageCalls:renderSamples.reduce((s,x)=>s+x.calls,0)/renderSamples.length,averageTriangles:renderSamples.reduce((s,x)=>s+x.triangles,0)/renderSamples.length,shadow:shadowUpdate});
    }
    dirty=false;}
  const collectionCenter=new T.Vector3();
  function reportProgress(){
    camera.updateMatrixWorld(true);
    collectionCenter.set(0,2.03,HOUSE_COLLECTION_PLANE_Z).project(camera);
    options.onProgress?.(rig.scrollProgress,{
      x:collectionCenter.x*element.clientWidth/2,
      y:-collectionCenter.y*element.clientHeight/2,
      scale:collectionPlaneScale(camera.position.z,camera.fov,camera.aspect<1?46:36),
    });
  }
  function animate(time:number){
    frame=0;if(disposed||!visible||document.hidden){lastTick=0;return;}
    const dt=lastTick?Math.min((time-lastTick)/1000,.25):1/60;lastTick=time;
    const wasFilming=rig.filming,traveling=rig.tick(dt);
    if(wasFilming&&!rig.filming)onFilmChange?.(false,true);
    // Orbit constraints must not pull the authored walk back out of the doorway.
    const moved=traveling||hero?(camera.lookAt(controls.target),false):controls.update(dt),wind=windEnabled&&!reduced.matches;
    const oldAngle=house.doorLeaf.rotation.y;
    const opening=hero?sampleHouseEntry(rig.scrollProgress).door:rig.doorOpening*Math.PI*.54;
    if(hero||reduced.matches){house.doorLeaf.rotation.y=opening;doorVelocity=0;}
    else [house.doorLeaf.rotation.y,doorVelocity]=stepCameraSpring(oldAngle,doorVelocity,opening,dt,5);
    const doorMoving=Math.abs(house.doorLeaf.rotation.y-oldAngle)>1e-6;
    if(doorMoving){house.doorLeaf.updateMatrix();shadowDirty=true;}
    lens.uniforms.entranceFade.value=hero?0:rig.entranceFade;
    if(traveling||doorMoving)ao.invalidate();
    if(moved||traveling||doorMoving)dirty=true;
    if(time-lastFrame>=1000/(mobile?30:60)-.5&&(dirty||moved||traveling||doorMoving||wind)){
      // Project/paint the collection only when its matching 3D frame is drawn.
      // On compact screens, extra RAF ticks used to repaint the photo wall
      // between GPU frames, doubling DOM work and briefly misaligning the portal.
      if(hero){fitView();reportProgress();if(process.env.NODE_ENV==='development'){canvas.dataset.entryProgress=String(rig.scrollProgress);canvas.dataset.doorAngle=String(house.doorLeaf.rotation.y);}}
      render(time);lastFrame=time;
    }
    if(moved||traveling||doorMoving||wind||dirty)invalidate();else lastTick=0;
  }
  function invalidate(){if(!disposed&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(animate);}
  function change(){ao.invalidate();dirty=true;invalidate();}controls.addEventListener('change',change);
  function interrupt(){rig.stop();onFilmChange?.(false);dirty=true;invalidate();}
  controls.addEventListener('start',interrupt);
  let activeView:View='front';
  function fitView(){
    const referenceAspect=activeView==='door'?.7:1604/981;
    const wide=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(18))*Math.max(1,referenceAspect/camera.aspect)));
    camera.fov=hero?T.MathUtils.lerp(wide,camera.aspect<1?46:36,sampleHouseEntry(rig.scrollProgress).lens):wide;
    rig.project();ao.invalidate();
  }
  let initialized=false;
  function view(value:View){
    activeView=value;fitView();
    // Flush residual orbit inertia before the rig takes ownership.
    controls.enableDamping=false;controls.update();controls.enableDamping=true;
    rig.move(value,!initialized||reduced.matches);initialized=true;
    controls.update();onFilmChange?.(false);dirty=true;invalidate();
  }
  function film(enabled:boolean){
    controls.enableDamping=false;controls.update();controls.enableDamping=true;
    rig.film(enabled,reduced.matches);onFilmChange?.(rig.filming,enabled&&!rig.filming&&rig.entranceFade===1);dirty=true;invalidate();
  }
  let compact=mobile;
  function resize(){const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;camera.aspect=w/h;
    fitView();ao.invalidate();renderer.setSize(w,h,false);composer.setSize(w,h);doorMaskTarget?.setSize(Math.round(w*dpr),Math.round(h*dpr));if(compact!==(w<600)){compact=w<600;if(!hero)view('front');}dirty=true;render(performance.now());}
  function motionPreference(){if(reduced.matches)interrupt();lastTick=0;shadowDirty=true;dirty=true;invalidate();}reduced.addEventListener('change',motionPreference);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(element);
  const visibility=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);if(visible){dirty=true;invalidate();}else{cancelAnimationFrame(frame);frame=0;lastTick=0;}});visibility.observe(element);
  function documentVisibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;lastTick=0;}else{dirty=true;invalidate();}}
  document.addEventListener('visibilitychange',documentVisibility);
  function contextLost(event:Event){event.preventDefault();element.dispatchEvent(new CustomEvent('house-context-lost'));}canvas.addEventListener('webglcontextlost',contextLost);
  view('front');if(hero){rig.scrollTo(0,true);camera.lookAt(controls.target);}resize();if(!hero&&!reduced.matches)film(true);
  options.onLoadProgress?.(1);
  canvas.dataset.bricks=String(house.brickCount);canvas.dataset.roofTiles=String(house.tileCount);canvas.dataset.pavers=String(landscape.paverCount);
  return{
    view,film,
    scroll(progress,immediate=false){
      rig.scrollTo(progress,immediate);dirty=true;invalidate();
      if(immediate){
        house.doorLeaf.rotation.y=sampleHouseEntry(rig.scrollProgress).door;house.doorLeaf.updateMatrix();
        shadowDirty=true;camera.lookAt(controls.target);fitView();reportProgress();
      }
    },
    zoom(factor){onFilmChange?.(false);rig.dolly(factor,controls.minDistance,controls.maxDistance,reduced.matches);dirty=true;invalidate();},
    wind(enabled){windEnabled=enabled;shadowDirty=true;dirty=true;invalidate();},
    dispose(){element.removeEventListener('house-capture',capture);captureImage.remove();element.removeEventListener('profile-mode',profileEvent);disposed=true;cancelAnimationFrame(frame);controls.removeEventListener('change',change);controls.removeEventListener('start',interrupt);controls.dispose();reduced.removeEventListener('change',motionPreference);resizeObserver.disconnect();visibility.disconnect();document.removeEventListener('visibilitychange',documentVisibility);canvas.removeEventListener('webglcontextlost',contextLost);renderPass.dispose();ao.dispose();shadowCache.dispose();lens.dispose();output.dispose();composer.dispose();doorMaskTarget?.dispose();doorMaskMaterial.dispose();probeTarget.dispose();localReflection.dispose();ambient.dispose();disposeScene(scene);loaded.forEach(t=>t.dispose());sun.shadow.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();},
  };
}
function disposeScene(scene:T.Scene){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh){if(o instanceof T.InstancedMesh)o.dispose();geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o.customDepthMaterial)materials.add(o.customDepthMaterial);}});materials.forEach(m=>{for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);m.dispose();});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());}
