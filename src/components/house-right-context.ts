import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeSolids, seedRandom, type HouseMaterials } from './house-architecture';

// Measured cross-section from the user's street-side photograph. Buildings
// belong beyond the entire carriageway, never next to LOTHUUS's right wall.
export const rightContext={houseSide:9,walkingEdge:10.45,kerb:12.2,roadOuter:19.1,hedgeX:20.1,oppositeFront:21.3};

export function buildRightContext(maps:HouseMaterials){
  const root=new T.Group();root.name='Open side street, signs, bench and buildings across the carriageway';
  const brick=new T.MeshStandardMaterial({color:'#a0806d',roughness:.97,normalMap:maps.brick.normal,normalScale:new T.Vector2(.08,.08)});
  const mortar=new T.MeshStandardMaterial({color:'#ad9d8b',roughness:1});
  const stone=new T.MeshStandardMaterial({color:'#858b83',roughness:.91});
  const frame=new T.MeshStandardMaterial({color:'#332e29',roughness:.65});
  const dark=new T.MeshStandardMaterial({color:'#202a29',roughness:.72});
  const glass=new T.MeshPhysicalMaterial({color:'#9ca79b',roughness:.13,metalness:.12,transmission:.2,envMapIntensity:.7});
  const roof=new T.MeshStandardMaterial({color:'#5a5850',roughness:.96,normalMap:maps.roof.normal,normalScale:new T.Vector2(.14,.14),side:T.DoubleSide});
  function box(parent:T.Group,name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material){const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,1,.003),mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  // Facades face -X across the road; their nearest vertex is at x=21.3.
  const opposite=new T.Group();opposite.name='Opposite-side frontage beyond the road';opposite.position.x=rightContext.oppositeFront;opposite.rotation.y=-Math.PI/2;
  const openings=[{u:-16,y:.15,w:2.25,h:2.15},{u:-10.2,y:.15,w:.9,h:2.13},{u:-6.6,y:.8,w:1.2,h:1.4},{u:-.8,y:.77,w:1.2,h:1.4},{u:3.9,y:.77,w:1.2,h:1.4},{u:1.5,y:3.65,w:.95,h:.95}];
  function height(u:number){return u< -3?2.85:3+Math.max(0,1-Math.abs(u-1.5)/4.5)*2.6;}
  const shape=new T.Shape();shape.moveTo(-22,0);shape.lineTo(6,0);shape.lineTo(6,3);shape.lineTo(1.5,5.6);shape.lineTo(-3,3);shape.lineTo(-3,2.85);shape.lineTo(-22,2.85);shape.closePath();
  for(const o of openings){const hole=new T.Path();hole.moveTo(o.u-o.w/2,o.y);hole.lineTo(o.u-o.w/2,o.y+o.h);hole.lineTo(o.u+o.w/2,o.y+o.h);hole.lineTo(o.u+o.w/2,o.y);hole.closePath();shape.holes.push(hole);}
  const facade=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false}),mortar);facade.position.z=-.28;facade.castShadow=facade.receiveShadow=true;opposite.add(facade);
  const positions:{u:number;y:number}[]=[];
  for(let row=0;row<86;row++)for(let col=0;col<117;col++){
    const u=-21.88+col*.24+(row%2)*.12,y=.035+row*.065;
    if(u+.117>6||y+.028>Math.min(height(u-.117),height(u+.117))||openings.some(o=>Math.abs(u-o.u)<(o.w+.234)/2&&y>o.y-.03&&y<o.y+o.h+.03))continue;
    positions.push({u,y});
  }
  const units=new T.InstancedMesh(new T.BoxGeometry(.232,.057,.016),brick,positions.length),t=new T.Object3D(),colour=new T.Color(),random=seedRandom(927);
  units.name='Brickwork exclusively across the side street';positions.forEach((p,i)=>{t.position.set(p.u,p.y,.005);t.updateMatrix();units.setMatrixAt(i,t.matrix);const v=.89+random()*.2;units.setColorAt(i,colour.setRGB(v,v*.98,v*.96));});units.castShadow=units.receiveShadow=true;opposite.add(units);
  for(const o of openings){
    box(opposite,'Recessed opposite window or door',o.u,o.y+o.h/2,-.12,o.w-.06,o.h-.04,.035,o.u< -14?stone:o.h>2?dark:glass);
    for(const side of [-1,1])box(opposite,'Opposite jamb',o.u+side*(o.w/2-.025),o.y+o.h/2,.045,.065,o.h+.04,.09,frame);
    for(const y of [o.y,o.y+o.h])box(opposite,'Opposite lintel or sill',o.u,y,.065,o.w+.12,.07,.15,stone);
  }
  box(opposite,'Low annex flat roof',-12.5,2.91,-2.4,19.1,.12,4.8,roof);
  const roofPositions=[[-3,3,.12],[1.5,5.6,.12],[-3,3,-5],[1.5,5.6,-5],[6,3,.12],[6,3,-5]],indices=[0,2,1,2,3,1,1,3,4,3,5,4],p:number[]=[];
  for(const i of indices)p.push(...roofPositions[i]);const roofGeometry=new T.BufferGeometry();roofGeometry.setAttribute('position',new T.Float32BufferAttribute(p,3));roofGeometry.setAttribute('uv',new T.Float32BufferAttribute(indices.flatMap(i=>[roofPositions[i][0],roofPositions[i][2]]),2));roofGeometry.computeVertexNormals();const roofMesh=new T.Mesh(roofGeometry,roof);roofMesh.castShadow=true;opposite.add(roofMesh);
  box(opposite,'Opposite return',-21.86,1.42,-2.45,.28,2.85,4.9,brick);root.add(opposite);
  for(let z=4;z>-24;z-=2.4){box(root,'Opposite low fence post',20.7,.45,z,.09,.9,.09,dark);box(root,'Opposite horizontal rail',20.7,.58,z-1.14,.07,.10,2.34,dark);}
  box(root,'Side pavement bench seat',9.35,.43,-1.35,.42,.085,1.25,stone);
  for(const z of [-1.8,-.9])box(root,'Bench support',9.35,.23,z,.27,.37,.11,dark);
  const sign=new T.Group();sign.name='No-entry, bicycle exception, 50 m and 3.5 t zone';sign.position.set(9.68,0,3.28);sign.rotation.y=Math.PI/2;
  const pole=new T.Mesh(new T.CylinderGeometry(.025,.025,3.75,10),stone);pole.position.y=1.875;pole.castShadow=true;sign.add(pole);
  const white=new T.MeshStandardMaterial({color:'#ecebe2',roughness:.79}),red=new T.MeshStandardMaterial({color:'#b52b32',roughness:.85});
  const rim=new T.Mesh(new T.CircleGeometry(.34,40),white);rim.position.set(0,3.35,.038);sign.add(rim);
  const disc=new T.Mesh(new T.CircleGeometry(.322,40),red);disc.position.set(0,3.35,.043);sign.add(disc);
  const bar=new T.Mesh(new T.PlaneGeometry(.49,.115),white);bar.position.set(0,3.35,.05);sign.add(bar);
  function panel(y:number,w:number,h:number,draw:(ctx:CanvasRenderingContext2D)=>void){
    const board=box(sign,'Traffic sign plate',0,y,.041,w,h,.025,white);if(typeof document==='undefined')return;
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d')!;draw(ctx);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const face=new T.Mesh(new T.PlaneGeometry(w*.96,h*.96),new T.MeshStandardMaterial({map:texture,roughness:.87}));face.position.copy(board.position);face.position.z+=.016;sign.add(face);
  }
  panel(2.79,.55,.48,ctx=>{ctx.fillStyle='#eeeedd';ctx.fillRect(0,0,256,256);ctx.fillStyle='#202828';ctx.strokeStyle='#202828';ctx.textAlign='center';ctx.font='bold 28px Arial';ctx.fillText('UITGEZONDERD',128,54);ctx.lineWidth=5;for(const x of [72,185]){ctx.beginPath();ctx.arc(x,174,35,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(72,174);ctx.lineTo(110,105);ctx.lineTo(155,174);ctx.lineTo(72,174);ctx.lineTo(125,174);ctx.lineTo(150,110);ctx.lineTo(166,110);ctx.stroke();});
  panel(2.43,.55,.22,ctx=>{ctx.fillStyle='#2462a2';ctx.fillRect(0,0,256,256);ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.font='bold 112px Arial';ctx.fillText('50m',128,172);});
  panel(2.01,.55,.58,ctx=>{ctx.fillStyle='#eeeedd';ctx.fillRect(0,0,256,256);ctx.fillStyle='#202828';ctx.textAlign='center';ctx.font='bold 35px Arial';ctx.fillText('ZONE',128,43);ctx.strokeStyle='#b52b32';ctx.lineWidth=12;ctx.beginPath();ctx.arc(128,132,62,0,Math.PI*2);ctx.stroke();ctx.font='bold 49px Arial';ctx.fillText('3,5t',128,149);});
  root.add(sign);mergeSolids(root);return root;
}
