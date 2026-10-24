import * as T from 'three';
import { sampleHouseEntry } from './house-entry';

export type HouseView = 'front'|'angle'|'door'|'gate'|'street';
type Pose = { position: readonly [number,number,number]; target: readonly [number,number,number]; rise: number };

// Metres. Keep the optical axis level and frame the upper storeys with lens rise.
export const HOUSE_CAMERA_POSES: Record<HouseView,Pose> = {
  front: {position:[.15,1.78,22.2],target:[0,1.78,1.1],rise:2.65},
  angle: {position:[-11.8,1.85,22.8],target:[-.6,1.85,1.5],rise:2.55},
  door: {position:[0,1.72,10.2],target:[0,1.72,4.05],rise:.22},
  gate: {position:[-9.2,1.72,11.6],target:[-11,1.72,-.1],rise:.33},
  street: {position:[16,1.78,13],target:[12,1.78,-4.5],rise:.95},
};

/** Exact critically damped spring; independent of display refresh rate. */
export function stepCameraSpring(value:number, velocity:number, goal:number, dt:number, omega=7) {
  const offset=value-goal, c=velocity+omega*offset, decay=Math.exp(-omega*dt);
  return [goal+(offset+c*dt)*decay,(velocity-omega*c*dt)*decay] as const;
}

/** An interruptible physical camera rig. Controls retain ownership during a drag. */
export class HouseCameraRig {
  readonly goalPosition=new T.Vector3();
  readonly goalTarget=new T.Vector3();
  private positionVelocity=new T.Vector3();
  private targetVelocity=new T.Vector3();
  private riseVelocity=0;
  private rise=0;
  private goalRise=0;
  private transitioning=false;
  private filmTime=0;
  private filmOrigin=new T.Vector3();
  private filmTarget=new T.Vector3();
  private filmRise=0;
  filming=false;
  scrollControlled=false;
  scrollProgress=0;
  private goalScroll=0;
  private scrollVelocity=0;

  scrollTo(progress:number,immediate=false) {
    this.stop();this.scrollControlled=true;
    this.goalScroll=T.MathUtils.clamp(progress,0,1);
    if(immediate){this.scrollProgress=this.goalScroll;this.scrollVelocity=0;this.applyScroll();}
  }

  private applyScroll() {
    const pose=sampleHouseEntry(this.scrollProgress);
    this.camera.position.set(pose.x,pose.y,pose.z);
    const targetZ=T.MathUtils.lerp(1.1,-1,pose.lens);
    this.target.set(0,pose.y+Math.tan(T.MathUtils.degToRad(pose.tilt))*(pose.z-targetZ),targetZ);
    this.rise=pose.rise;this.project();
  }

  constructor(readonly camera:T.PerspectiveCamera, readonly target:T.Vector3) {}

  move(view:HouseView, immediate=false) {
    this.filming=false;this.filmTime=0;
    const pose=HOUSE_CAMERA_POSES[view];
    this.goalPosition.fromArray(pose.position);this.goalTarget.fromArray(pose.target);this.goalRise=pose.rise;
    if(immediate){
      this.camera.position.copy(this.goalPosition);this.target.copy(this.goalTarget);this.rise=this.goalRise;
      this.positionVelocity.setScalar(0);this.targetVelocity.setScalar(0);this.riseVelocity=0;
      this.transitioning=false;this.project();
    }else this.transitioning=true;
  }

  dolly(factor:number, min:number, max:number, immediate=false) {
    const base=this.transitioning?this.goalPosition:this.camera.position;
    this.goalPosition.copy(base).sub(this.target);
    this.goalPosition.setLength(T.MathUtils.clamp(this.goalPosition.length()*factor,min,max)).add(this.target);
    this.goalTarget.copy(this.target);this.goalRise=this.rise;this.filming=false;this.filmTime=0;
    if(immediate){this.camera.position.copy(this.goalPosition);this.stop();this.project();}
    else this.transitioning=true;
  }

  film(enabled:boolean, immediate=false) {
    if(!enabled){this.filming=false;return;}
    if(this.filmTime===0||this.filmTime>=14){
      if(this.filmTime>=14)this.move('front',true);
      this.filmTime=0;
      this.filmOrigin.copy(this.camera.position);this.filmTarget.copy(this.target);this.filmRise=this.rise;
    }
    this.transitioning=false;this.filming=true;
    if(immediate)this.tick(14);
  }

  get entranceFade(){return (1-T.MathUtils.smoothstep(Math.abs(this.camera.position.x),.65,1.5))*(1-T.MathUtils.smoothstep(this.camera.position.z,3.05,3.85));}
  get doorOpening(){
    const lateral=T.MathUtils.smoothstep(Math.abs(this.camera.position.x),.65,1.8);
    return (1-lateral)*(1-T.MathUtils.smoothstep(this.camera.position.z,7.5,10.8));
  }

  stop() {
    this.scrollControlled=false;
    this.filming=false;this.filmTime=0;this.transitioning=false;
    this.positionVelocity.setScalar(0);this.targetVelocity.setScalar(0);this.riseVelocity=0;
  }

  project() {
    this.camera.updateProjectionMatrix();
    const distance=this.camera.position.distanceTo(this.target);
    const shift=this.rise/(Math.max(distance,.1)*Math.tan(T.MathUtils.degToRad(this.camera.fov/2)));
    this.camera.projectionMatrix.elements[9]+=shift;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  tick(dt:number) {
    if(this.scrollControlled){
      if(this.scrollProgress===this.goalScroll&&Math.abs(this.scrollVelocity)<1e-6)return false;
      [this.scrollProgress,this.scrollVelocity]=stepCameraSpring(this.scrollProgress,this.scrollVelocity,this.goalScroll,dt,12);
      if(Math.abs(this.scrollProgress-this.goalScroll)<1e-5&&Math.abs(this.scrollVelocity)<1e-4){this.scrollProgress=this.goalScroll;this.scrollVelocity=0;}
      this.applyScroll();return true;
    }
    if(!this.transitioning&&!this.filming)return false;
    // Time is supplied only while visible; returning to the tab never skips a take.
    if(this.filming){
      this.filmTime+=dt;
      const ease=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
      const align=ease(this.filmTime/6);
      const near=ease((this.filmTime-6)/4);
      const enter=ease((this.filmTime-10)/4);
      this.camera.position.copy(this.filmOrigin).lerp(new T.Vector3(0,1.85,7.8),align);
      if(this.filmTime>6)this.camera.position.set(0,1.85+enter*.18,T.MathUtils.lerp(7.8,5.65,near));
      if(this.filmTime>10)this.camera.position.z=T.MathUtils.lerp(5.65,2.85,enter);
      this.target.copy(this.filmTarget).lerp(new T.Vector3(0,1.85,-1),align);
      if(this.filmTime>6)this.target.set(0,this.camera.position.y,-1);
      this.rise=T.MathUtils.lerp(this.filmRise,0,align);
      this.positionVelocity.setScalar(0);this.targetVelocity.setScalar(0);this.riseVelocity=0;
      if(this.filmTime>=14)this.filming=false;
      this.project();return true;
    }

    const omega=this.filming?3:7;
    for(const axis of ['x','y','z'] as const){
      [this.camera.position[axis],this.positionVelocity[axis]]=stepCameraSpring(this.camera.position[axis],this.positionVelocity[axis],this.goalPosition[axis],dt,omega);
      [this.target[axis],this.targetVelocity[axis]]=stepCameraSpring(this.target[axis],this.targetVelocity[axis],this.goalTarget[axis],dt,omega);
    }
    [this.rise,this.riseVelocity]=stepCameraSpring(this.rise,this.riseVelocity,this.goalRise,dt,omega);
    if(!this.filming&&this.camera.position.distanceToSquared(this.goalPosition)<1e-7&&this.target.distanceToSquared(this.goalTarget)<1e-7&&Math.abs(this.rise-this.goalRise)<1e-5){
      this.camera.position.copy(this.goalPosition);this.target.copy(this.goalTarget);this.rise=this.goalRise;this.stop();
    }
    this.project();return true;
  }
}
