import * as T from 'three';

// Soil footprints shared by the kerbs and every planting pass. Coordinates are
// estimated from the colour reference; the entrance stays between these beds.
export type PlantingBed = {x:number;z:number;w:number;d:number;frontSlope?:number;rearSlope?:number};
export const plantingBeds = [
  {x:-2.97,z:5.78,w:3.2,d:.78,frontSlope:.17,rearSlope:.17},
  {x:5.64,z:6.55,w:9.75,d:1.9,frontSlope:.18,rearSlope:0},
] as const satisfies readonly PlantingBed[];
// The new street-side photograph shows separate long, narrow tree beds,
// with a clear walking strip between these beds and the house's side wall.
export const sidePlantingBeds=[
  {x:11.17,z:1.2,w:1.40,d:2.9},
  {x:11.17,z:-3.5,w:1.40,d:2.9},
  {x:11.17,z:-8.2,w:1.40,d:2.9},
] as const satisfies readonly PlantingBed[];
export const treeSites = [
  {x:4.16,z:6.35,height:12.1,width:1.16,rotation:.4},
  {x:9.22,z:6.25,height:10.8,width:.83,rotation:2.7},
  {x:10.03,z:6.72,height:11.6,width:.86,rotation:-1.2},
] as const;

export function bedEdges(bed:PlantingBed,x:number) {
  return {rear:bed.z-bed.d/2+(bed.rearSlope??0)*(x-bed.x),front:bed.z+bed.d/2+(bed.frontSlope??0)*(x-bed.x)};
}

export function bedPoint(bed:PlantingBed,u:number,v:number,margin:number) {
  const x=bed.x+(u-.5)*(bed.w-2*margin),edges=bedEdges(bed,x);
  // Margins are perpendicular to each sloping edge, rather than just z offsets.
  const rear=edges.rear+margin*Math.hypot(1,bed.rearSlope??0),front=edges.front-margin*Math.hypot(1,bed.frontSlope??0);
  return {x,z:T.MathUtils.lerp(rear,front,v)};
}

// Fit the entire rotated botanical model inside the soil, rather than only
// checking its origin. Leave room for leaf size and the wind displacement.
export function plantMatrix(bounds:T.Box3,bed:PlantingBed,p:{x:number;z:number;height:number;rotation:number}) {
  const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const c=Math.abs(Math.cos(p.rotation)),s=Math.abs(Math.sin(p.rotation)),margin=.08;
  const width=c*size.x+s*size.z,depth=s*size.x+c*size.z;
  const rearSlope=bed.rearSlope??0,frontSlope=bed.frontSlope??0;
  const minDepth=bed.d-Math.abs(frontSlope-rearSlope)*bed.w/2;
  const slope=Math.max(Math.abs(rearSlope),Math.abs(frontSlope));
  const scale=Math.min(p.height/size.y,(bed.w-2*margin)/width,(minDepth-2*margin*(1+slope))/(depth+slope*width));
  const rx=width*scale/2+margin,rz=depth*scale/2+margin;
  const x=T.MathUtils.clamp(p.x,bed.x-bed.w/2+rx,bed.x+bed.w/2-rx);
  const edges=bedEdges(bed,x);
  const z=T.MathUtils.clamp(p.z,edges.rear+rz+Math.abs(rearSlope)*rx,edges.front-rz-Math.abs(frontSlope)*rx);
  return new T.Matrix4().compose(new T.Vector3(x,.14,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.rotation),new T.Vector3(scale,scale,scale))
    .multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
}
