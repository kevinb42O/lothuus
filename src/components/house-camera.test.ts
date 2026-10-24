import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { HouseCameraRig, HOUSE_CAMERA_POSES, stepCameraSpring } from './house-camera';

test('camera spring follows the same physical trajectory at 30, 60 and 144 Hz',()=>{
  function simulate(hz:number){let value=0,velocity=0;for(let i=0;i<hz;i++)[value,velocity]=stepCameraSpring(value,velocity,10,1/hz);return value;}
  assert.ok(Math.abs(simulate(30)-simulate(144))<1e-10);
  assert.ok(Math.abs(simulate(60)-simulate(144))<1e-10);
});

test('lens rise frames the facade while preserving parallel verticals and inverse projection',()=>{
  const camera=new T.PerspectiveCamera(36,1604/981,.12,360),target=new T.Vector3(),rig=new HouseCameraRig(camera,target);
  rig.move('front',true);camera.lookAt(target);camera.updateMatrixWorld();
  assert.equal(camera.position.y,target.y);
  const lower=new T.Vector3(0,0,4).project(camera),upper=new T.Vector3(0,8,4).project(camera);
  assert.ok(Math.abs(lower.x-upper.x)<1e-5);
  const center=new T.Vector3(0,4.43,1.1).project(camera);
  assert.ok(Math.abs(center.y)<.002);
  const identity=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.projectionMatrixInverse);
  identity.elements.forEach((value,i)=>assert.ok(Math.abs(value-(i%5===0?1:0))<1e-10));
});

test('preset changes can be retargeted midflight without a position jump',()=>{
  const camera=new T.PerspectiveCamera(),target=new T.Vector3(),rig=new HouseCameraRig(camera,target);
  rig.move('front',true);rig.move('door');rig.tick(.2);
  const interrupted=camera.position.clone();rig.move('gate');assert.deepEqual(camera.position,interrupted);
  for(let i=0;i<300;i++)rig.tick(1/60);
  assert.ok(camera.position.distanceTo(new T.Vector3(...HOUSE_CAMERA_POSES.gate.position))<1e-5);
});

test('film begins at the current pose, pauses in place and never resumes after a drag',()=>{
  const camera=new T.PerspectiveCamera(),target=new T.Vector3(),rig=new HouseCameraRig(camera,target);
  rig.move('front',true);const start=camera.position.clone();rig.film(true);
  assert.deepEqual(camera.position,start);
  for(let i=0;i<180;i++)rig.tick(1/60);
  assert.ok(camera.position.z<start.z-2);assert.ok(camera.position.x<start.x);
  rig.stop();const end=camera.position.clone();assert.equal(rig.tick(1),false);assert.deepEqual(camera.position,end);
  rig.film(true);assert.deepEqual(camera.position,end);
});

test('dolly respects distance limits and repeated zoom clicks accumulate smoothly',()=>{
  const camera=new T.PerspectiveCamera(),target=new T.Vector3(),rig=new HouseCameraRig(camera,target);
  rig.move('front',true);const initial=camera.position.clone(),distance=camera.position.distanceTo(target);
  rig.dolly(.85,5,48);rig.dolly(.85,5,48);
  assert.deepEqual(camera.position,initial);
  for(let i=0;i<300;i++)rig.tick(1/60);
  assert.ok(Math.abs(camera.position.distanceTo(target)-distance*.85*.85)<1e-5);
  rig.dolly(.001,5,48,true);assert.ok(Math.abs(camera.position.distanceTo(target)-5)<1e-10);
  rig.dolly(100,5,48,true);assert.ok(Math.abs(camera.position.distanceTo(target)-48)<1e-10);
});


test('entrance take opens before the threshold, crosses it, finishes and can replay',()=>{
  const camera=new T.PerspectiveCamera(),target=new T.Vector3(),rig=new HouseCameraRig(camera,target);
  rig.move('front',true);rig.film(true);
  for(let i=0;i<600;i++)rig.tick(1/60);
  assert.ok(camera.position.z>5.6);assert.ok(rig.doorOpening>.99);
  rig.film(false);const paused=camera.position.clone();rig.tick(1);assert.deepEqual(camera.position,paused);
  rig.film(true);rig.tick(.01);assert.ok(camera.position.distanceTo(paused)<.01);
  for(let i=0;i<250;i++)rig.tick(1/60);
  assert.ok(camera.position.z<3.66);assert.equal(rig.filming,false);assert.equal(rig.entranceFade,1);
  rig.film(true);assert.deepEqual(camera.position.toArray(),[...HOUSE_CAMERA_POSES.front.position]);
});

test('reduced motion reaches the entrance outcome immediately and side views stay visible',()=>{
  const camera=new T.PerspectiveCamera(),rig=new HouseCameraRig(camera,new T.Vector3());
  rig.move('front',true);rig.film(true,true);
  assert.equal(rig.filming,false);assert.equal(rig.entranceFade,1);assert.equal(rig.doorOpening,1);
  rig.move('street',true);assert.equal(rig.entranceFade,0);assert.equal(rig.doorOpening,0);
});
