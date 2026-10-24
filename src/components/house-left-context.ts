import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeSolids, seedRandom, type HouseMaterials } from './house-architecture';

// Estimated in the existing house's metre scale. The new street-level reference
// supersedes the narrow doorway inferred from the old distant photograph.
export const leftContext={
  front:.16,facadeFront:4,facadeSetback:3.80,openingLeft:-12.62,openingRight:-9.12,gateBottom:.08,
  panelTop:1.06,railTop:2.20,spearTop:2.47,
  canopyFront:-1.08,canopyRear:-9.7,eaves:2.77,ridge:4.58,
};

/** Solid iron leaves below, open ironwork above, and an open covered passage.
 * Photograph is reference only: every detail here is independently lit geometry. */
export function buildLeftContext(maps:HouseMaterials){
  const root=new T.Group();root.name='Left entrance — double iron gate and covered passage';
  // Author the entrance assembly locally; register it 3.80 m behind the
  // main facade. No invented tall neighbour wall rises behind the canopy.
  const setback=leftContext.facadeSetback;
  const c={...leftContext,front:leftContext.front+setback,canopyFront:leftContext.canopyFront+setback,canopyRear:leftContext.canopyRear+setback};
  const random=seedRandom(3519),centre=(c.openingLeft+c.openingRight)/2;
  const iron=new T.MeshStandardMaterial({color:'#292a27',roughness:.67,metalness:.65});
  const panel=new T.MeshStandardMaterial({color:'#272927',roughness:.77,metalness:.35});
  const brass=new T.MeshStandardMaterial({color:'#9c8852',roughness:.56,metalness:.7});
  const timber=new T.MeshStandardMaterial({color:'#33312b',roughness:.94});
  const boards=[timber,...['#39362e','#302f2b','#413a2e','#35352f'].map(color=>new T.MeshStandardMaterial({color,roughness:.94}))];
  const roof=new T.MeshStandardMaterial({color:'#242827',roughness:.91,metalness:.2,side:T.DoubleSide});
  const stone=new T.MeshStandardMaterial({color:'#8d8c81',roughness:.96,normalMap:maps.paving.normal,normalScale:new T.Vector2(.08,.08)});
  const mortar=new T.MeshStandardMaterial({color:'#787467',roughness:1});
  const yellow=new T.MeshStandardMaterial({color:'#a7824e',roughness:.97,normalMap:maps.brick.normal,roughnessMap:maps.brick.roughness,normalScale:new T.Vector2(.16,.16)});
  // Continuous physical texture scale on both the front and return faces.
  // UVs from a unit box otherwise squeeze an entire brick atlas into each brick.
  yellow.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vec4 masonryPosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
      masonryPosition=instanceMatrix*masonryPosition;
    #endif
    masonryPosition=modelMatrix*masonryPosition;
    vec2 masonryUv=(abs(normal.z)>.5?masonryPosition.xy:masonryPosition.zy)*1.4;
    vNormalMapUv=masonryUv;
    vRoughnessMapUv=masonryUv;
  `);};
  yellow.customProgramCacheKey=()=> 'left-weathered-masonry-v1';
  const cache=new Map<string,T.BufferGeometry>();
  function mesh(name:string,geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
  function box(name:string,x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material){const key=`${w},${h},${d}`;let g=cache.get(key);if(!g){g=new T.BoxGeometry(w,h,d);cache.set(key,g);}return mesh(name,g,material,x,y,z);}
  function line(name:string,a:number[],b:number[],radius=.012,material:T.Material=iron){const p=new T.Vector3(...a),q=new T.Vector3(...b),m=mesh(name,new T.CylinderGeometry(radius,radius,p.distanceTo(q),6),material);m.position.copy(p).lerp(q,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize());return m;}
  function curve(name:string,points:T.Vector3[],radius=.009,material:T.Material=iron){return mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(10,points.length*2),radius,5,false),material);}
  function scroll(x:number,y:number,radius:number,direction=1,material:T.Material=iron,z=c.front+.035){const points:T.Vector3[]=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*2.4,r=radius*(1-i/29);points.push(new T.Vector3(x+direction*Math.cos(a)*r,y+Math.sin(a)*r,z));}curve('Hand-forged spiral',points,.009,material);}
  function spear(x:number,y:number,z:number,material:T.Material=iron,scale=1){line('Spear neck',[x,y-.10*scale,z],[x,y,z],.009*scale,material);const s=new T.Shape();s.moveTo(0,.105*scale);s.lineTo(-.027*scale,.014*scale);s.lineTo(0,-.018*scale);s.lineTo(.027*scale,.014*scale);s.closePath();mesh('Forged pointed finial',new T.ExtrudeGeometry(s,{depth:.014,bevelEnabled:false}),material,x,y,z-.007);}
  // Separate leaves and a centre seam; no solid wall behind the open ironwork.
  const span=c.openingRight-c.openingLeft,half=span/2;
  for(const side of [-1,1]){
    const x=centre+side*half/2;
    box('Opaque lower gate leaf',x,(c.gateBottom+c.panelTop)/2,c.front,half-.028,c.panelTop-c.gateBottom,.045,panel);
    for(const edge of [-1,1])box('Gate leaf upright',x+edge*(half/2-.022),1.14,c.front+.01,.036,2.12,.055,iron);
    for(const y of [c.gateBottom,c.panelTop,1.23,2.12,c.railTop])box('Gate horizontal rail',x,y,c.front+.016,half-.02,.027,.047,iron);
    // Very shallow diagonal reinforcing seams visible in the solid sheet.
    line('Lower panel diagonal seam',[x-half/2+.07,.14,c.front+.026],[x+half/2-.07,c.panelTop-.08,c.front+.026],.004,iron);
    for(let i=0;i<11;i++){
      const bx=x-half/2+.09+i*(half-.18)/10;
      line('Slender gate baluster',[bx,1.08,c.front],[bx,2.35,c.front],.009);
      spear(bx,2.35+(i%2)*.025,c.front);
      scroll(bx+.035,2.17,.063);
      for(const dir of [-1,1])curve('Lower ornamental pointed loop',[new T.Vector3(bx+dir*.042,1.225,c.front+.03),new T.Vector3(bx+dir*.045,1.12,c.front+.03),new T.Vector3(bx,1.075,c.front+.03)],.006);
    }
    for(const y of [.34,1.35,2.05]){box('Gate strap hinge',centre+side*(half-.055),y,c.front+.045,.13,.035,.035,iron);line('Hinge pin',[centre+side*(half+.014),y-.065,c.front],[centre+side*(half+.014),y+.065,c.front],.018);}
    for(const y of [1.47,1.82]){scroll(x,y,.10,side,brass);scroll(x+.09*side,y-.10,.08,-side,brass);}
  }
  box('Central lock case',centre+.042,1.085,c.front+.05,.07,.15,.04,iron);
  line('Brass gate handle',[centre+.025,1.12,c.front+.09],[centre+.14,1.12,c.front+.09],.013,brass);
  spear(centre,2.43,c.front,brass,1.45);
  for(const dir of [-1,1])scroll(centre+dir*.045,2.40,.07,dir,brass);
  // Dark square posts with moulded capitals and stone bases.
  for(const x of [c.openingLeft-.10,c.openingRight+.10]){
    box('Gate post',x,1.26,c.front,.16,2.52,.18,iron);
    box('Gate post stone foot',x,.065,c.front,.23,.13,.24,stone);
    box('Gate capital lower collar',x,2.46,c.front,.23,.065,.25,iron);
    box('Gate capital projecting top',x,2.55,c.front,.29,.10,.29,iron);
    box('Gate capital rim',x,2.61,c.front,.31,.035,.31,stone);
    for(const dir of [-1,1])scroll(x+dir*.11,2.39,.07,dir,brass);
  }
  // Fine, recessed grey joints and rounded brick edges on ALL exposed faces.
  // The earlier version left bare mortar on the end faces and used a flat
  // triangular neighbouring volume above the canopy; neither belongs here.
  const masonry:{x:number;y:number;z:number;w:number;h:number;d:number}[]=[];
  function masonryWall(name:string,x:number,z:number,w:number,h:number,d:number){
    box(`${name} recessed mortar core`,x,h/2,z,w-.012,h,d-.012,mortar);
    const course=.061,length=.224,joint=.008,brickDepth=.024;
    const rows=Math.floor(h/course);
    function face(centre:number,width:number,plane:number,side:boolean){
      for(let row=0;row<rows;row++){
        const start=centre-width/2,end=centre+width/2;
        for(let edge=start-length+(row%2)*length/2;edge<end;edge+=length){
          const a=Math.max(start+.003,edge+joint/2),b=Math.min(end-.003,edge+length-joint/2);
          if(b-a<.018)continue;
          const u=(a+b)/2,y=.033+row*course;
          masonry.push({x:side?plane:u,y,z:side?u:plane,w:side?brickDepth:b-a,h:course-joint,d:side?b-a:brickDepth});
        }
      }
    }
    face(x,w,z+d/2,false);face(x,w,z-d/2,false);
    face(z,d,x+w/2,true);face(z,d,x-w/2,true);
    // Shallow weathered coping, segmented rather than a thick white beam.
    const count=Math.ceil(Math.max(w,d)/.85),alongX=w>d;
    for(let i=0;i<count;i++){
      const step=(alongX?w:d)/count;
      box(`${name} coping slab`,alongX?x-w/2+(i+.5)*step:x,h+.035,alongX?z:z-d/2+(i+.5)*step,alongX?step-.004:w+.07,.07,alongX?d+.07:step-.004,stone);
    }
    box(`${name} dark foot`,x,.065,z,w+.015,.13,d+.015,stone);
  }
  masonryWall('Low street boundary',-14.49,3.85,3.48,2.44,.25);
  masonryWall('Gate masonry pier',-12.82,3.85,.30,2.54,.35);
  masonryWall('Passage left wall',-12.79,-1.03,.23,2.68,9.8);
  const transform=new T.Object3D(),tint=new T.Color();
  // Gabled carport: solid vertical boarding only ABOVE the eave. Below it
  // stays open right through to the garden, with rafters visible underneath.
  const left=c.openingLeft-.06,right=-8.99,ridgeX=(left+right)/2;
  const gable=new T.Shape();gable.moveTo(left,c.eaves);gable.lineTo(right,c.eaves);gable.lineTo(ridgeX,c.ridge);gable.closePath();
  mesh('Dark triangular boarded canopy gable',new T.ExtrudeGeometry(gable,{depth:.075,bevelEnabled:false}),timber,0,0,c.canopyFront-.075);
  for(let x=left+.022;x<right;x+=.082){const top=c.eaves+(c.ridge-c.eaves)*(1-Math.abs((x-ridgeX)/((right-left)/2)));if(top<=c.eaves)continue;box('Vertical gable board',x,(c.eaves+top)/2,c.canopyFront+.008,.071,top-c.eaves,.025,boards[Math.floor(random()*boards.length)]);}
  for(const [x,y] of [[left,c.eaves],[right,c.eaves]]){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x,y,c.canopyFront,ridgeX,c.ridge,c.canopyFront,ridgeX,c.ridge,c.canopyRear,x,y,c.canopyFront,ridgeX,c.ridge,c.canopyRear,x,y,c.canopyRear],3));g.computeVertexNormals();mesh('Pitched canopy roof sheet',g,roof);
    line('Straight gable edge trim',[x,y,c.canopyFront+.035],[ridgeX,c.ridge,c.canopyFront+.035],.038);
    box('Straight canopy gutter',x,c.eaves-.035,(c.canopyFront+c.canopyRear)/2,.11,.12,c.canopyFront-c.canopyRear+.12,iron);
    box('Long canopy bearing beam',x,c.eaves-.14,(c.canopyFront+c.canopyRear)/2,.12,.20,c.canopyFront-c.canopyRear,timber);
  }
  box('Gable lower fascia',ridgeX,c.eaves-.02,c.canopyFront+.025,right-left+.10,.14,.13,iron);
  line('Canopy ridge cap',[ridgeX,c.ridge+.02,c.canopyFront+.04],[ridgeX,c.ridge+.02,c.canopyRear],.045);
  for(let z=c.canopyFront-.13;z>=c.canopyRear;z-=.84){
    for(const x of [left+.06,right-.06])line('Exposed canopy rafter',[x,c.eaves-.08,z],[ridgeX,c.ridge-.09,z],.039,timber);
    box('Canopy cross tie',ridgeX,c.eaves-.17,z,right-left-.07,.10,.08,timber);
  }
  for(const z of [c.canopyFront-.20,-1.5,c.canopyRear+.15]){
    box('Canopy support at left wall',left+.08,1.30,z,.12,2.60,.12,timber);
    line('Canopy diagonal knee brace',[left+.08,2.10,z],[left+.70,c.eaves-.19,z],.035,timber);
  }
  line('Straight canopy drainpipe',[left+.015,.12,c.canopyFront-.04],[left+.015,c.eaves,c.canopyFront-.04],.033);
  // Continuous shaded passage paving and the small patch of garden glimpsed behind.
  const paving=new T.MeshStandardMaterial({color:'#8d887a',map:maps.paving.color,roughness:.97});
  box('Paved floor through gate',centre,-.021,-.92,span,.04,10.15,paving);
  const lawn=new T.MeshStandardMaterial({color:'#527634',roughness:1});box('Garden visible through covered passage',centre,-.025,-8,span,.045,4,lawn);
  const leaf=new T.MeshStandardMaterial({color:'#36562a',roughness:1});
  for(let i=0;i<17;i++)mesh('Garden shrubs behind gate',new T.IcosahedronGeometry(.24+random()*.18,1),leaf,centre-1.5+random()*3,.34+random()*.35,-7.6-random()*1.3);
  const bin=new T.MeshStandardMaterial({color:'#55584b',roughness:.94});
  for(const z of [-.9,-1.6]){box('Dark wheelie bin in passage',-9.48,.46,z,.47,.86,.48,bin);box('Bin lid',-9.48,.91,z,.50,.055,.51,iron);}
  // Street objects visible at left: pale service door, timber enclosure, two bikes.
  const pale=new T.MeshStandardMaterial({color:'#c2c9c6',roughness:.9});box('Partly visible pale service door',-16.05,1.02,4.02,.55,1.92,.035,pale);
  box('Timber street bin enclosure',-15.85,.48,4.39,.78,.94,.56,boards[3]);
  for(let i=0;i<7;i++)box('Enclosure upright board',-16.18+i*.108,.48,4.685,.095,.91,.026,boards[i%boards.length]);
  function bike(cx:number,z:number,color:string,angle:number,pannier=false){
    // Build around the origin, then rotate the complete bicycle as one group.
    const start=root.children.length,paint=new T.MeshStandardMaterial({color,roughness:.56,metalness:.45});
    const tyre=new T.MeshStandardMaterial({color:'#222725',roughness:.96});
    for(const x of [-.51,.51]){
      mesh('Bicycle tyre',new T.TorusGeometry(.325,.023,7,40),tyre,x,.35,0);
      mesh('Bicycle wheel rim',new T.TorusGeometry(.302,.008,5,40),stone,x,.35,.003);
      for(let i=0;i<16;i++){const a=i/16*Math.PI*2;line('Bicycle spoke',[x,.35,0],[x+Math.cos(a)*.297,.35+Math.sin(a)*.297,0],.0025,stone);}
    }
    for(const [a,b] of [[[-.51,.35,0],[-.19,.77,0]],[[-.19,.77,0],[.04,.35,0]],[[.04,.35,0],[-.51,.35,0]],[[-.19,.77,0],[.35,.79,0]],[[.35,.79,0],[.04,.35,0]],[[.35,.79,0],[.51,.35,0]],[[-.19,.77,0],[-.23,.91,0]],[[.35,.79,0],[.31,1.05,0]]] as number[][][])line('Bicycle frame tube',a,b,.016,paint);
    box('Bicycle saddle',-.24,.93,0,.23,.05,.15,tyre);
    line('Bicycle handlebar',[.31,1.05,-.20],[.31,1.05,.20],.013,iron);
    line('Bicycle crank',[.04,.35,-.055],[-.04,.22,-.055],.012,stone);box('Bicycle pedal',-.04,.22,-.085,.13,.025,.07,tyre);
    box('Bicycle luggage rack',-.48,.74,0,.42,.026,.25,iron);
    if(pannier)for(const side of [-1,1])box('Black bicycle pannier',-.49,.56,side*.18,.32,.34,.15,tyre);
    const parts=root.children.slice(start),group=new T.Group();group.name='Parked bicycle';parts.forEach(p=>group.add(p));group.position.set(cx,.012,z);group.rotation.set(0,angle,-.10);root.add(group);
  }
  bike(-12.20,6.55,'#873345',Math.PI/2-.12,true);bike(-12.24,5.08,'#659b91',Math.PI/2+.08);
  // The inham extends from the street back to the recessed gate. The left
  // boundary turns towards the street; the house itself bounds its right side.
  masonryWall('Inham left return',-12.79,5.91,.25,2.44,3.86);
  const bricks=new T.InstancedMesh(new RoundedBoxGeometry(1,1,1,1,.035),yellow,masonry.length);
  bricks.name='Weathered yellow masonry — bonded courses and finished returns';
  masonry.forEach((p,i)=>{
    transform.position.set(p.x,p.y,p.z);transform.scale.set(p.w,p.h,p.d);transform.updateMatrix();bricks.setMatrixAt(i,transform.matrix);
    const shade=.86+random()*.24;tint.setRGB(shade,shade*(.96+random()*.045),shade*(.89+random()*.08));bricks.setColorAt(i,tint);
  });bricks.castShadow=bricks.receiveShadow=true;root.add(bricks);
  const approachUnits:T.Matrix4[]=[];
  for(let col=0;col<29;col++)for(let row=0;row<17;row++){
    transform.position.set(c.openingLeft+.062+col*.118,.003,4.10+row*.231+(col%2)*.1155);
    if(transform.position.z>7.81)continue;
    transform.scale.set(1,1,1);transform.updateMatrix();approachUnits.push(transform.matrix.clone());
  }
  const approach=new T.InstancedMesh(new T.BoxGeometry(.114,.045,.227),paving,approachUnits.length);approach.name='Recessed forecourt pavers between footpath and gate';
  approachUnits.forEach((m,i)=>{approach.setMatrixAt(i,m);const v=.85+random()*.24;approach.setColorAt(i,tint.setRGB(v,v*.97,v*.94));});approach.castShadow=approach.receiveShadow=true;root.add(approach);
  mergeSolids(root);
  root.position.z=-setback;
  root.userData.gatePlane=leftContext.front;
  root.userData.facadePlane=leftContext.facadeFront;
  return root;
}
