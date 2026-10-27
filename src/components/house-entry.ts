import { HOUSE_ENTRY_WORDMARK as mark } from './house-entry-wordmark-data';

/** Shared, reversible entrance choreography. Distances are metres in the real model. */
export const ENTRY_SCROLL_LENGTH = 2.4;
export const HOUSE_ENTRY_DURATION = 16;

/** Shot beats in seconds. Nonzero shared tangents carry the camera through each
 * composition; only arrival comes to rest. Progress remains the single source
 * for the camera, door, portal and the real collection's projection.
 */
export const HOUSE_ENTRY_BEATS = [
  {time:0,progress:0,speed:0},
  {time:2.6,progress:.025,speed:.020},
  {time:5.8,progress:.23,speed:.065},
  {time:10,progress:.63,speed:.080},
  {time:13,progress:.86,speed:.060},
  {time:HOUSE_ENTRY_DURATION,progress:1,speed:0},
] as const;

/** Quintic Hermite segments share velocity and zero acceleration at each knot.
 * This time mapping is also used by the video player: render time stays linear.
 */
export function houseEntryTiming(time:number) {
  const seconds=Math.max(0,Math.min(1,time))*HOUSE_ENTRY_DURATION;
  for(let i=1;i<HOUSE_ENTRY_BEATS.length;i++){
    const a=HOUSE_ENTRY_BEATS[i-1],b=HOUSE_ENTRY_BEATS[i];
    if(seconds>b.time)continue;
    const span=b.time-a.time,u=(seconds-a.time)/span;
    const distance=b.progress-a.progress,v0=span*a.speed,v1=span*b.speed;
    const c3=10*distance-6*v0-4*v1,c4=-15*distance+8*v0+7*v1,c5=6*distance-3*v0-3*v1;
    return a.progress+v0*u+c3*u**3+c4*u**4+c5*u**5;
  }
  return 1;
}

/** C2 easing for camera orientation/height; stops without acceleration jumps. */
export function entrySmoother(start:number,end:number,value:number) {
  const t=Math.max(0,Math.min(1,(value-start)/(end-start)));
  return t*t*t*(t*(6*t-15)+10);
}

export function houseEntryYaw(progress:number,initialYaw:number) {
  return initialYaw*(1-entrySmoother(.018,.205,progress));
}

export function entryEase(start:number,end:number,value:number) {
  const t=Math.max(0,Math.min(1,(value-start)/(end-start)));
  return t*t*(3-2*t);
}

export const HOUSE_WORDMARK_Z=18;
export const HOUSE_WORDMARK_Y=3.6;

/** One fixed focal length per viewport, used for the entire take. */
export function houseEntryFov(aspect:number) {
  return 40+10*(1-entryEase(1,1.5,aspect));
}

/** Match the initial loading identity, with the O fixed on the travel axis.
 * The camera initially looks at the complete wordmark; yaw settles toward the
 * real O counter as it approaches. No part of the graphic tracks the screen.
 */
export function houseEntryFraming(width:number,height:number) {
  const fov=houseEntryFov(width/height),distance=23.4-HOUSE_WORDMARK_Z;
  const tangent=Math.tan(fov*Math.PI/360)*width/height;
  // Fit angular bounds, rather than the projected centre point. This keeps both
  // ends equally far from screen centre despite the O being on the travel axis.
  const fit=width/height<.8?.82:.74;
  let low=0,high=.01;
  for(let i=0;i<50;i++){
    const scale=(low+high)/2;
    const left=Math.atan2(-mark.portal.x*scale,distance);
    const right=Math.atan2((mark.width-mark.portal.x)*scale,distance);
    if(Math.tan((right-left)/2)/tangent<fit)low=scale;else high=scale;
  }
  const fontScale=(low+high)/2;
  const yaw=(Math.atan2(-mark.portal.x*fontScale,distance)+Math.atan2((mark.width-mark.portal.x)*fontScale,distance))/2;
  const size=fontScale*height*mark.units/(2*distance*Math.tan(fov*Math.PI/360));
  return {fov,fontScale,yaw,size};
}

/** One optical progression: the destination remains sharp. The near lettering
 * softens once as it approaches; aperture opens smoothly without a second pulse.
 */
export function houseEntryFocus(progress:number,cameraZ:number) {
  return {
    distance:Math.max(.25,cameraZ-3.66),
    strength:1-entryEase(.18,1.1,Math.max(0,cameraZ-HOUSE_WORDMARK_Z)),
    visible:cameraZ>HOUSE_WORDMARK_Z-.75,
  };
}

export function sampleHouseEntry(progress:number) {
  const p=Math.max(0,Math.min(1,progress));
  const z=23.4+(-1-23.4)*p;
  return {
    progress:p,
    // Advance on the doorway axis. Keep the letter passage at its real height,
    // then settle toward the entrance while the gaze turns gently downward.
    x:0,
    y:HOUSE_WORDMARK_Y-1.57*entrySmoother(.27,.64,p),
    z,
    tilt:0-1.4*entrySmoother(.27,.42,p)*(1-entrySmoother(.42,.64,p)),
    rise:0,
    door:(1-entrySmoother(8.8,12.2,z))*Math.PI*.54,
    reveal:entryEase(.92,.995,p),
    lens:entryEase(0,.8,p),
  };
}


/** The live grid occupies a plane well beyond the complete door's inward swing.
 * Its physical width fits the viewport only at the end of the approach.
 */
export const HOUSE_COLLECTION_PLANE_Z=-6;
export const HOUSE_COLLECTION_ARRIVAL_Z=-1;
export function collectionPlaneScale(cameraZ:number,fov:number,arrivalFov:number) {
  const distance=Math.max(.1,cameraZ-HOUSE_COLLECTION_PLANE_Z);
  return (HOUSE_COLLECTION_ARRIVAL_Z-HOUSE_COLLECTION_PLANE_Z)/distance*
    Math.tan(arrivalFov*Math.PI/360)/Math.tan(fov*Math.PI/360);
}
