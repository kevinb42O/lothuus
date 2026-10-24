import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { buildLeftContext, leftContext as c } from './house-left-context';

function fixture(){const set={color:new T.Texture(),normal:new T.Texture(),roughness:new T.Texture()};const root=buildLeftContext({brick:set,roof:set,paving:set});root.updateMatrixWorld(true);return root;}
function hit(root:T.Group,x:number,y:number,z=1.0){return new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,0,-1)).intersectObject(root,true)[0];}
function dispose(root:T.Group){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.InstancedMesh)o.dispose();}});geometries.forEach(g=>g.dispose());materials.forEach(m=>{for(const value of Object.values(m))if(value instanceof T.Texture)value.dispose();m.dispose();});}

test('the gate has two opaque lower leaves and genuinely open upper ironwork',()=>{
  const root=fixture();
  for(const x of [-12.1,-11.5,-10.4,-9.6])assert.ok(Math.abs(hit(root,x,.6)!.point.z-c.front)<.07,'lower sheet must close the gateway');
  // Search multiple adjacent samples: narrow iron bars and scrolls are expected,
  // but the upper field must not be filled by the old wall/door or a fake pane.
  let open=0;for(let x=c.openingLeft+.2;x<c.openingRight-.2;x+=.041){const h=hit(root,x,1.6);if(!h||h.point.z<c.front-.3)open++;}
  assert.ok(open>45,'the upper gate must be predominantly see-through');dispose(root);
});

test('the canopy is boarded above the eave and open below, behind the gate',()=>{
  const root=fixture(),centre=(c.openingLeft+c.openingRight)/2;
  const gable=hit(root,centre,3.7,-.6);assert.ok(gable&&Math.abs(gable.point.z-c.canopyFront)<.08,'solid triangular front gable missing');
  const passage=hit(root,centre+.3,1.7,-.6);assert.ok(!passage||passage.point.z<c.canopyRear,'old entrance infill blocks the passage');
  const roofHits=new T.Raycaster(new T.Vector3(centre,6,-5),new T.Vector3(0,-1,0)).intersectObject(root,true);assert.ok(roofHits[0]&&roofHits[0].point.y>4.4,'pitched carport must continue in depth');dispose(root);
});

test('the low yellow boundary wall meets the left gatepost',()=>{
  const root=fixture();assert.ok(hit(root,-13.2,1.3)!.point.z>.1);assert.ok(hit(root,c.openingLeft-.1,2.5)!.point.z>c.front);dispose(root);
});


test('the entrance remains recessed behind the main facade with a clear forecourt',()=>{
  const root=fixture();
  assert.ok(c.facadeFront-c.front>3.5,'gate must be behind the facade, never at the footpath');
  const x=(c.openingLeft+c.openingRight)/2;
  const gate=hit(root,x+.3,.6,4.1);assert.ok(gate&&gate.point.z<.3,'forecourt must remain clear all the way to the recessed gate');
  for(const z of [.8,2,3.8]){
    const floor=new T.Raycaster(new T.Vector3(x,1,z),new T.Vector3(0,-1,0)).intersectObject(root,true)[0];
    assert.ok(floor&&floor.point.y<.04&&floor.point.y>-.03,'inham must be paved between gate and footpath');
  }
  dispose(root);
});

test('sky above the low boundary and canopy has no invented neighbouring wall',()=>{
  const root=fixture();
  for(const y of [3.2,4.8,6])for(const z of [-3,-1,1]){
    const hits=new T.Raycaster(new T.Vector3(-12.3,y,z),new T.Vector3(-1,0,0),0,2).intersectObject(root,true);
    assert.equal(hits.length,0,'a tall blank wall must not rise behind the gate roof');
  }
  dispose(root);
});
