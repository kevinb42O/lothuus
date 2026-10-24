/** Shared, reversible entrance choreography. Distances are metres in the real model. */
export const ENTRY_SCROLL_LENGTH = 2.4;
export const HOUSE_ENTRY_DURATION = 10;

/** Keep the facade legible, accelerate through the open door, then brake briefly.
 * The cubic Hermite approach starts moving immediately (speed .65) and joins
 * the final half-second quadratic brake at the same position and speed (1.8).
 * Only time is remapped: door clearance and grid projection share the same path.
 */
export function houseEntryTiming(time:number) {
  const t=Math.max(0,Math.min(1,time));
  if(t>=.95){
    const remaining=(1-t)/.05;
    return 1-.045*remaining*remaining;
  }
  const u=t/.95;
  return .6175*u-.08*u*u+.4175*u*u*u;
}

export function entryEase(start:number,end:number,value:number) {
  const t=Math.max(0,Math.min(1,(value-start)/(end-start)));
  return t*t*(3-2*t);
}

/** Fade the lettering before its perspective scale can exhaust compositor memory. */
export function houseWordmarkProjection(cameraZ:number,fov:number,initialFov:number,compact:boolean) {
  const distance=cameraZ-18;
  const limit=compact?4:8;
  if(distance<=.08)return {scale:1,opacity:0};
  const scale=(sampleHouseEntry(0).z-18)/distance*
    Math.tan(initialFov*Math.PI/360)/Math.tan(fov*Math.PI/360);
  const opacity=entryEase(.08,.7,distance)*(1-entryEase(limit*.75,limit,scale));
  // Reset even an invisible transform: opacity alone can retain a large layer.
  return {scale:opacity===0?1:Math.min(scale,limit),opacity};
}
export function sampleHouseEntry(progress:number) {
  const p=Math.max(0,Math.min(1,progress));
  const z=23.4+(-1-23.4)*p;
  return {
    progress:p,
    // Begin centred, with the closer facade framing of the supplied reference.
    // Descend into the same uninterrupted walk through the doorway.
    x:0,
    y:1.78+1.82*(1-entryEase(.12,.55,p))+.25*entryEase(.75,1,p),
    z,
    // Lift the gaze into the lettering, then gently look down toward the entry.
    // Return to a level optical axis well before the jamb and moving door.
    tilt:1.8*entryEase(0,.18,p)*(1-entryEase(.22,.42,p))-.8*entryEase(.26,.4,p)*(1-entryEase(.4,.6,p)),
    rise:1.35*(1-entryEase(0,.6,p)),
    // Start opening well before the visitor reaches the steps.
    door:(1-entryEase(7.5,10.8,z))*Math.PI*.54,
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
