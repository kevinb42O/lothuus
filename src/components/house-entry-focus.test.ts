import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { frameEntryLetterCamera, HouseEntryFocusPass } from './house-entry-focus';
import { houseEntryFocus, sampleHouseEntry } from './house-entry';

test('overscan preserves the real house camera projection after cropping',()=>{
  for(const [width,height] of [[1440,900],[390,844]]){
    const source=new T.PerspectiveCamera(40,width/height,.04,360),extended=new T.PerspectiveCamera();
    source.position.set(0,3.6,23.4);source.lookAt(.4,3.7,18);source.updateMatrixWorld(true);
    const padding=62;frameEntryLetterCamera(source,extended,width,height,padding);extended.updateMatrixWorld(true);
    for(const point of [new T.Vector3(0,3.6,18),new T.Vector3(.5,3.8,18),new T.Vector3(-.2,3.2,17.99)]){
      const original=point.clone().project(source),expanded=point.clone().project(extended);
      const x=((expanded.x+1)/2*(width+padding*2)-padding)/width;
      const y=((expanded.y+1)/2*(height+padding*2)-padding)/height;
      assert.ok(Math.abs(x-(original.x+1)/2)<1e-12&&Math.abs(y-(original.y+1)/2)<1e-12);
    }
  }
});

test('rendered defocus stays zero at a distance and increases continuously until the letters pass',()=>{
  const camera=new T.PerspectiveCamera(),pass=new HouseEntryFocusPass(new T.Scene(),camera,()=>{},48);
  pass.setSize(1440,900);
  let radius=0;
  for(let i=0;i<=1000;i++){
    const p=i/1000,pose=sampleHouseEntry(p),focus=houseEntryFocus(p,pose.z);
    camera.position.set(pose.x,pose.y,pose.z);pass.setFocus(focus.distance,focus.strength,focus.visible);
    if(pose.z>=19.1)assert.equal(pass.blurRadius,0,'Keep the brand readable until the final approach');
    if(pass.active){assert.ok(pass.blurRadius>=radius);assert.ok(pass.blurRadius<=48);radius=pass.blurRadius;}
    if(pose.door>0)assert.equal(pass.active,false);
  }
  assert.equal(radius,48);pass.dispose();
});
