import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { sampleHouseEntry, houseWordmarkProjection, collectionPlaneScale, HOUSE_COLLECTION_PLANE_Z, HOUSE_COLLECTION_ARRIVAL_Z, HOUSE_ENTRY_DURATION, houseEntryTiming } from './house-entry';
import { HouseCameraRig } from './house-camera';
import { needsNativeGrid } from './house-device';

test('ten-second entrance carries speed through the door and brakes without a jump',()=>{
  assert.equal(HOUSE_ENTRY_DURATION,10);
  assert.equal(houseEntryTiming(0),0);
  assert.equal(houseEntryTiming(1),1);
  let previous=0,fullyOpenAt=0;
  for(let i=1;i<=10000;i++){
    const time=i/10000,progress=houseEntryTiming(time);
    assert.ok(progress>previous&&progress<=1,'Advance continuously without reversing or overshooting');
    if(!fullyOpenAt&&sampleHouseEntry(progress).z<=7.5)fullyOpenAt=time*HOUSE_ENTRY_DURATION;
    previous=progress;
  }
  assert.ok(fullyOpenAt>=7.5&&fullyOpenAt<=8.2,'Keep the approach readable, then reach the grid within 2.5 seconds of full opening');
  const h=1e-6,speed=(time:number)=>(houseEntryTiming(time+h)-houseEntryTiming(time-h))/(2*h);
  assert.ok(speed(.85)>speed(.6),'Accelerate through the doorway rather than easing out early');
  assert.ok(Math.abs(speed(.95-h)-speed(.95+h))<.001,'Join the short brake without a velocity discontinuity');
  assert.ok((1-houseEntryTiming(1-h))/h<.001,'Arrive at rest for the untransformed live grid');
});

test('iOS selects the native grid, including other browsers and iPad desktop mode',()=>{
  for(const userAgent of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140 Mobile Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
  ])assert.equal(needsNativeGrid({userAgent,maxTouchPoints:5}),true);
  assert.equal(needsNativeGrid({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',maxTouchPoints:0}),false);
  assert.equal(needsNativeGrid({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140',maxTouchPoints:10}),false);
  assert.equal(needsNativeGrid({userAgent:'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile',maxTouchPoints:5}),false);
});

test('lettering stays bounded across the camera crossing on portrait and desktop screens',()=>{
  for(const [compact,initialFov,limit] of [[true,110,4],[false,36,8]] as const){
    const initial=houseWordmarkProjection(23.4,initialFov,initialFov,compact);
    assert.deepEqual(initial,{scale:1,opacity:1});
    let previousOpacity=1;
    for(let i=0;i<=10000;i++){
      const p=i/10000,pose=sampleHouseEntry(p);
      const fov=initialFov+((compact?46:36)-initialFov)*pose.lens;
      const projection=houseWordmarkProjection(pose.z,fov,initialFov,compact);
      assert.ok(Number.isFinite(projection.scale)&&projection.scale<=limit);
      assert.ok(projection.opacity<=previousOpacity);
      if(projection.opacity===0)assert.equal(projection.scale,1);
      previousOpacity=projection.opacity;
    }
    for(const z of [18.08,18,17.99,-1])assert.deepEqual(houseWordmarkProjection(z,46,initialFov,compact),{scale:1,opacity:0});
  }
});

test('scroll enters continuously, opens the door early and reveals products at the threshold',()=>{
  let previous=sampleHouseEntry(0);
  for(let i=1;i<=1000;i++){
    const pose=sampleHouseEntry(i/1000);
    assert.ok(pose.z<previous.z);assert.ok(pose.door>=previous.door);assert.ok(pose.reveal>=previous.reveal);
    if(pose.reveal>0)assert.ok(pose.z<4.4,'Collection appears only when the camera reaches the doorway');
    if(pose.z<7.5)assert.ok(pose.door>Math.PI/2,'Leaf is fully out of the path before the steps');
    previous=pose;
  }
  assert.ok(sampleHouseEntry(.65).door>.1,'Door starts opening at a distance');
  assert.equal(previous.reveal,1);assert.ok(previous.z<3.66);
});

test('the scroll spring is independent of refresh rate and can reverse without jumping',()=>{
  function run(hz:number){
    const camera=new T.PerspectiveCamera(),rig=new HouseCameraRig(camera,new T.Vector3());
    rig.scrollTo(0,true);rig.scrollTo(.7);
    for(let i=0;i<hz;i++)rig.tick(1/hz);
    return {camera,rig};
  }
  const a=run(30),b=run(144);
  assert.ok(a.camera.position.distanceTo(b.camera.position)<1e-9);
  const before=a.camera.position.clone(),progress=a.rig.scrollProgress;
  a.rig.scrollTo(.2);assert.deepEqual(a.camera.position,before);
  for(let i=0;i<120;i++)a.rig.tick(1/60);
  assert.ok(a.rig.scrollProgress<progress);assert.ok(a.camera.position.z>before.z);
  assert.ok(Math.abs(a.rig.scrollProgress-.2)<1e-5);
});

test('fast scroll boundary changes settle synchronously and scrolling back closes the door',()=>{
  const camera=new T.PerspectiveCamera(),rig=new HouseCameraRig(camera,new T.Vector3());
  rig.scrollTo(1,true);assert.equal(sampleHouseEntry(rig.scrollProgress).reveal,1);
  assert.ok(camera.position.z<3.66);assert.equal(rig.tick(1/60),false);
  rig.scrollTo(0,true);assert.equal(sampleHouseEntry(rig.scrollProgress).door,0);
  assert.equal(sampleHouseEntry(rig.scrollProgress).reveal,0);assert.equal(camera.position.z,23.4);
});


test('the collection sits beyond the door swing and reaches its natural scale only after walking inside',()=>{
  assert.ok(HOUSE_COLLECTION_PLANE_Z<0,'The collection is several metres behind the doorway at z=3.66');
  const atDoor=collectionPlaneScale(4,36,36);
  assert.ok(atDoor<=.5,'Products still look distant at the threshold');
  for(const fov of [36,46])assert.equal(collectionPlaneScale(HOUSE_COLLECTION_ARRIVAL_Z,fov,fov),1);
  assert.ok(collectionPlaneScale(8,36,36)<atDoor);
  assert.ok(collectionPlaneScale(1,36,36)>atDoor);
  assert.equal(sampleHouseEntry(1).z,HOUSE_COLLECTION_ARRIVAL_Z);
});


test('the entrance starts elevated and centred, then descends straight into a clear doorway',()=>{
  const start=sampleHouseEntry(0),end=sampleHouseEntry(1);
  assert.equal(start.x,0);assert.ok(start.y>3.5);assert.equal(start.z,23.4);assert.equal(end.x,0);assert.ok(Math.abs(end.y-2.03)<1e-12);
  let previous=start;
  for(let i=1;i<=1000;i++){
    const pose=sampleHouseEntry(i/1000);
    assert.equal(pose.x,0,'Stay directly in front of the doorway throughout the approach');
    if(pose.door>0)assert.ok(Math.abs(pose.x)<.1,'Align before the door starts opening');
    if(pose.z<5)assert.equal(pose.x,0,'Clear the jamb and inward-swinging leaf');
    if(i<=550)assert.ok(pose.y<=previous.y,'Descend smoothly to walking height');
    previous=pose;
  }
});


test('the lettering approach tilts the actual camera, then levels before the door',()=>{
  const camera=new T.PerspectiveCamera(36,16/9,.12,360),target=new T.Vector3(),rig=new HouseCameraRig(camera,target);
  assert.equal(sampleHouseEntry(0).tilt,0);
  rig.scrollTo(.18,true);
  assert.ok(target.y>camera.position.y,'The rig looks up into the lettering');
  assert.ok(Math.abs(Math.atan2(target.y-camera.position.y,camera.position.z-target.z)*180/Math.PI-1.8)<1e-9);
  rig.scrollTo(.4,true);
  assert.ok(target.y<camera.position.y,'The gaze settles downward toward the entrance');
  rig.scrollTo(.65,true);
  assert.equal(target.y,camera.position.y,'The doorway approach is level again');
});
