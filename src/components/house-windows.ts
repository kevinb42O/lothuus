import * as T from 'three';

export type WindowBox=(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material,parent:T.Object3D,bevel?:number)=>T.Mesh;
type WindowMaterials={stone:T.Material;lightStone:T.Material;dark:T.Material;timber:T.Material;brass:T.Material;iron:T.Material;glass:T.Material;curtain:T.Material;backdrop:T.Material};

/** The four portrait room crops share one 256×128 texture with 2px gutters. */
export function interiorGeometry(width:number,height:number,variant:number){
  const geometry=new T.PlaneGeometry(width,height),uv=geometry.getAttribute('uv');
  const sourceAspect=59/123,targetAspect=width/height;
  const cropU=Math.min(1,targetAspect/sourceAspect),cropV=Math.min(1,sourceAspect/targetAspect);
  for(let i=0;i<uv.count;i++){
    const u=.5+(uv.getX(i)-.5)*cropU,v=.5+(uv.getY(i)-.5)*cropV;
    uv.setXY(i,(variant*64+2.5+u*59)/256,(2.5+v*123)/128);
  }
  return geometry;
}

/** Eight horizontal segments describe two soft folds; no redundant vertical grid. */
export function curtainGeometry(width:number,height:number){
  const geometry=new T.PlaneGeometry(width,height,8,1),position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++)position.setZ(i,Math.cos((position.getX(i)/width+.5)*Math.PI*4)*.022);
  geometry.computeVertexNormals();return geometry;
}

/** A static casement pose is merged with the facade after construction. */
export function buildHouseWindow(x:number,bottom:number,h:number,index:number,m:WindowMaterials,makeBox:WindowBox){
  const root=new T.Group();root.name=`${bottom<2?'Ground':'Upper'} floor window ${x}`;root.position.set(x,bottom,0);
  const w=1.3,transom=h*.735,tilted=bottom<2&&x===-2.4;
  const box=(xx:number,y:number,z:number,ww:number,hh:number,d:number,material:T.Material,parent:T.Object3D=root,bevel=.008)=>makeBox(xx,y,z,ww,hh,d,material,parent,bevel);
  const room=new T.Mesh(interiorGeometry(w+.22,h+.16,(bottom<2?0:2)+index%2),m.backdrop);
  room.name='Recessed interior';room.position.set(0,h/2,2.9);root.add(room);
  for(const side of [-1,1]){
    box(side*(w/2+.065),h/2,4.055,.135,h+.23,.23,m.lightStone);
    box(side*(w/2-.035),h/2,3.83,.09,h+.015,.16,m.dark);
    box(side*(w/2-.105),h/2,3.795,.04,h-.13,.11,m.timber);
    for(const y of [.23,h*.58])box(side*(w/2-.085),y,3.9,.018,.09,.025,m.iron);
    const width=.22+(index%3)*.035+(side===1?.015:0);
    const curtain=new T.Mesh(curtainGeometry(width,h+.06),m.curtain);
    curtain.name=`Full-height ${side<0?'left':'right'} curtain`;
    curtain.position.set(side*(w/2-width/2-.055),h/2,3.24);curtain.receiveShadow=true;root.add(curtain);
    if(tilted&&side===1){
      const leaf=new T.Group();leaf.name='Inward tilted lower casement';
      const paneHeight=h*.67,paneWidth=.555;
      leaf.position.set(side*.32,h*.025,3.82);leaf.rotation.x=-T.MathUtils.degToRad(7);root.add(leaf);
      box(0,paneHeight/2,-.065,paneWidth,paneHeight,.008,m.glass,leaf,0);
      for(const edge of [-1,1]){
        box(edge*(paneWidth/2+.0175),paneHeight/2,-.015,.035,paneHeight+.07,.085,m.timber,leaf,0);
        box(0,edge<0?-.0175:paneHeight+.0175,-.015,paneWidth,.035,.085,m.timber,leaf,0);
      }
      box(-.277,h*.345,.04,.025,.13,.03,m.brass,leaf);
    }else{
      box(side*.32,h*.36,3.755,.555,h*.67,.008,m.glass,root,0);
      box(side*.043,h*.37,3.86,.025,.13,.03,m.brass);
    }
  }
  box(0,h+.067,4.055,w+.27,.135,.23,m.lightStone);
  box(0,-.038,4.125,w+.35,.11,.39,m.lightStone);
  box(0,-.105,4.09,w+.27,.035,.27,m.stone);
  box(0,.055,3.83,w,.11,.16,m.dark);box(0,h-.058,3.83,w,.115,.16,m.dark);
  box(0,transom,3.86,w,.087,.18,m.dark);box(0,h*.36,3.865,.064,h*.72,.17,m.dark);
  box(0,transom+(h-transom)/2-.015,3.755,w-.16,h-transom-.12,.008,m.glass,root,0);
  return root;
}
