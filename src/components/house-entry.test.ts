import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { sampleHouseEntry, houseEntryFocus, houseEntryFraming, HOUSE_WORDMARK_Z, HOUSE_WORDMARK_Y, collectionPlaneScale, HOUSE_COLLECTION_PLANE_Z, HOUSE_COLLECTION_ARRIVAL_Z, HOUSE_ENTRY_DURATION, houseEntryTiming, HOUSE_ENTRY_BEATS, houseEntryFov } from './house-entry';
import { HouseCameraRig } from './house-camera';
import { needsNativeGrid } from './house-device';

test('sixteen-second shot reveals the door, carries continuous speed and arrives at rest',()=>{
  assert.equal(HOUSE_ENTRY_DURATION,16);
  assert.equal(houseEntryTiming(0),0);
  assert.equal(houseEntryTiming(1),1);
  let previous=0,fullyOpenAt=0;
  for(let i=1;i<=10000;i++){
    const time=i/10000,progress=houseEntryTiming(time);
    assert.ok(progress>previous&&progress<=1,'Advance continuously without reversing or overshooting');
    if(!fullyOpenAt&&sampleHouseEntry(progress).door>=Math.PI*.54-1e-6)fullyOpenAt=time*HOUSE_ENTRY_DURATION;
    previous=progress;
  }
  assert.ok(fullyOpenAt>=9&&fullyOpenAt<=11,'Allow the door reveal before crossing the threshold');
  const h=1e-6,speed=(time:number)=>(houseEntryTiming(time+h)-houseEntryTiming(time-h))/(2*h);
  for(const beat of HOUSE_ENTRY_BEATS.slice(1,-1)){
    const time=beat.time/HOUSE_ENTRY_DURATION;
    assert.ok(Math.abs(speed(time-h)-speed(time+h))<.001,'Preserve velocity at every shot beat');
  }
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

test('the lettering stays sharp until close to the lens, then softens only once',()=>{
  assert.equal(houseEntryFocus(0,23.4).strength,0);
  let previous=0;
  for(let i=0;i<=1000;i++){
    const p=i/1000,pose=sampleHouseEntry(p),focus=houseEntryFocus(p,pose.z);
    if(pose.z-HOUSE_WORDMARK_Z>=1.1)assert.equal(focus.strength,0,'Do not blur the word from a distance');
    if(focus.visible){
      assert.ok(focus.strength>=previous,'No blur-unblur-blur pulse during the letter passage');
      previous=focus.strength;
    }
    if(pose.door>0)assert.equal(focus.visible,false,'The optical letter layer is gone before the portal opens');
  }
  assert.equal(houseEntryFocus(.2,18.18).strength,1);
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


test('the forward camera changes its gaze while physically clearing the O and door',()=>{
  const start=sampleHouseEntry(0),end=sampleHouseEntry(1);
  assert.equal(start.x,0);assert.equal(start.y,HOUSE_WORDMARK_Y);assert.equal(start.z,23.4);
  assert.equal(end.x,0);assert.ok(Math.abs(end.y-2.03)<1e-12);
  const crossing=(23.4-HOUSE_WORDMARK_Z)/24.4;
  const atLetter=sampleHouseEntry(crossing);
  assert.equal(atLetter.y,HOUSE_WORDMARK_Y);assert.equal(atLetter.tilt,0);
  assert.equal(sampleHouseEntry(.09).tilt,0,'Hold the centred title without an introductory nod');
  assert.ok(sampleHouseEntry(.39).tilt<0,'Lower the gaze toward the entrance after passing');
  for(let i=0;i<=1000;i++){
    const pose=sampleHouseEntry(i/1000);
    assert.equal(pose.x,0,'No lateral camera sweep');
    if(pose.z<7.5)assert.equal(pose.tilt,0,'Settle the gaze before crossing the doorway');
  }
});

test('fixed viewport lenses keep the live collection projection aligned at arrival',()=>{
  for(const aspect of [390/844,768/1024,1,1.2,16/9,21/9]){
    const fov=houseEntryFov(aspect),camera=new T.PerspectiveCamera(fov,aspect,.12,360);
    const target=new T.Vector3(),rig=new HouseCameraRig(camera,target);
    for(const progress of [0,.2,.5,.8,1]){
      rig.scrollTo(progress,true);camera.lookAt(target);camera.updateMatrixWorld(true);
      assert.equal(camera.fov,fov);
      if(progress===1){
        const center=new T.Vector3(0,2.03,HOUSE_COLLECTION_PLANE_Z).project(camera);
        assert.ok(Math.abs(center.x)<1e-12&&Math.abs(center.y)<1e-12);
        assert.equal(collectionPlaneScale(camera.position.z,fov,fov),1);
      }
    }
  }
  assert.equal(houseEntryFov(16/9),40);assert.equal(houseEntryFov(390/844),50);
});


test('the whole doorway fits when the opening completes on desktop and portrait screens',()=>{
  const progress=(23.4-8.8)/24.4;
  for(const aspect of [390/844,768/1024,16/9,21/9]){
    const camera=new T.PerspectiveCamera(houseEntryFov(aspect),aspect,.12,360);
    const target=new T.Vector3(),rig=new HouseCameraRig(camera,target);
    rig.scrollTo(progress,true);camera.lookAt(target);camera.updateMatrixWorld(true);
    for(const x of [-.715,.715])for(const y of [.405,3.425]){
      const corner=new T.Vector3(x,y,3.66).project(camera);
      assert.ok(Math.abs(corner.x)<1&&Math.abs(corner.y)<1,'See the entire opening at the reveal');
    }
  }
});


test('yaw frames the full brand, then aligns with the fixed O without moving the lettering',()=>{
  for(const [width,height] of [[1440,900],[390,844],[768,1024]]){
    const framing=houseEntryFraming(width,height);
    const camera=new T.PerspectiveCamera(framing.fov,width/height,.04,360),target=new T.Vector3();
    const rig=new HouseCameraRig(camera,target);rig.frameEntry(framing.yaw);rig.scrollTo(0,true);
    assert.ok(target.x>0,'Look toward the centre of the complete wordmark at first');
    rig.scrollTo(.21,true);camera.lookAt(target);camera.updateMatrixWorld(true);
    const counter=new T.Vector3(0,HOUSE_WORDMARK_Y,HOUSE_WORDMARK_Z).project(camera);
    assert.ok(Math.abs(counter.x)<1e-9&&Math.abs(counter.y)<1e-9,'Pass through the actual counter on the camera axis');
    assert.equal(camera.position.x,0);assert.equal(target.x,0);
  }
});

test('camera timing, height and orientation have continuous acceleration at authored joins',()=>{
  const h=1e-5;
  const acceleration=(f:(t:number)=>number,t:number)=>(f(t+h)-2*f(t)+f(t-h))/(h*h);
  for(const beat of HOUSE_ENTRY_BEATS.slice(1,-1)){
    const time=beat.time/HOUSE_ENTRY_DURATION;
    assert.ok(Math.abs(acceleration(houseEntryTiming,time-h)-acceleration(houseEntryTiming,time+h))<.08,
      `No acceleration kick at ${beat.time}s`);
  }
  for(const p of [.27,.42,.64])for(const key of ['y','tilt'] as const){
    const f=(value:number)=>sampleHouseEntry(value)[key];
    assert.ok(Math.abs(acceleration(f,p-h)-acceleration(f,p+h))<2,'No height/pitch acceleration step');
  }
});
