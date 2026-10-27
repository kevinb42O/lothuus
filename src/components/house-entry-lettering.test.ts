import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import * as T from 'three';
import { buildEntryLettering } from './house-entry-lettering';
import { HOUSE_WORDMARK_Y, HOUSE_WORDMARK_Z, houseEntryFraming } from './house-entry';

// SVGLoader uses the browser parser; geometry/raycast checks run headlessly.
const dom=new JSDOM('');
globalThis.DOMParser=dom.window.DOMParser;

test('the world-space O has real clearance and its solid strokes remain opaque',()=>{
  const lettering=buildEntryLettering();
  for(const [width,height] of [[1440,900],[390,844]]){
    lettering.frame(width,height);
    const counter=new T.Raycaster(new T.Vector3(0,HOUSE_WORDMARK_Y,23.4),new T.Vector3(0,0,-1));
    assert.equal(counter.intersectObject(lettering.root,true).length,0,'The camera travels through a geometric hole');
    const glyph=lettering.root.children[1] as T.Mesh<T.ExtrudeGeometry,T.Material[]>;
    const bounds=new T.Box3().setFromObject(glyph),size=bounds.getSize(new T.Vector3());
    assert.ok(size.z/size.y>.35&&size.z/size.y<.5,'The sculptural letters have readable physical depth at both aspect ratios');
    const edge=new T.Raycaster(new T.Vector3(bounds.min.x+size.x*.1,HOUSE_WORDMARK_Y,23.4),new T.Vector3(0,0,-1));
    assert.ok(edge.intersectObject(glyph,true).length>0,'The near edge is real geometry');
    for(const material of glyph.material){assert.equal(material.opacity,1);assert.equal(material.transparent,false);}
    const before=lettering.root.matrixWorld.clone();
    for(const z of [20,18.2,18.02,17.9]){
      counter.ray.origin.z=z;counter.intersectObject(lettering.root,true);
      assert.deepEqual(lettering.root.matrixWorld,before,'The brand does not shift to follow the camera');
    }
    assert.ok(bounds.min.z<HOUSE_WORDMARK_Z&&bounds.max.z>=HOUSE_WORDMARK_Z);
  }
  lettering.root.traverse(object=>{if(object instanceof T.Mesh){object.geometry.dispose();for(const material of object.material)material.dispose();}});
});

test('the complete sculptural title is centred and comfortably fits desktop and portrait',()=>{
  const lettering=buildEntryLettering();
  for(const [width,height] of [[1920,1200],[720,1560]]){
    lettering.frame(width,height);
    const {fov,yaw}=houseEntryFraming(width,height);
    const camera=new T.PerspectiveCamera(fov,width/height,.04,360);
    camera.position.set(0,HOUSE_WORDMARK_Y,23.4);
    camera.lookAt(Math.tan(yaw)*(23.4+6),HOUSE_WORDMARK_Y,-6);camera.updateMatrixWorld(true);
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    lettering.root.traverse(object=>{
      if(!(object instanceof T.Mesh))return;
      const positions=object.geometry.getAttribute('position'),point=new T.Vector3();
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld).project(camera);
        minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
      }
    });
    assert.ok(minX>-.9&&maxX<.9,'Leave breathing room around the entire brand');
    assert.ok(maxX-minX>1.4,'Give LOTHUUS a substantial opening composition');
    assert.ok(Math.abs((minX+maxX)/2)<.04,'Centre the actual visible volume');
    assert.ok(Math.abs((minY+maxY)/2)<.015,'Keep the title vertically centred');
  }
  const materials=new Set<T.Material>();
  lettering.root.traverse(object=>{if(object instanceof T.Mesh){object.geometry.dispose();object.material.forEach((m:T.Material)=>materials.add(m));}});
  materials.forEach(m=>m.dispose());
});
