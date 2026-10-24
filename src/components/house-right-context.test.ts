import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { buildRightContext, rightContext } from './house-right-context';
import { sidePlantingBeds, bedEdges } from './house-planting';

test('the entire side carriageway is clear of neighbouring building geometry',()=>{
  const set={color:new T.Texture(),normal:new T.Texture(),roughness:new T.Texture()};
  const root=buildRightContext({brick:set,roof:set,paving:set});root.updateMatrixWorld(true);
  // Sweep the actual geometry at wheel, body and head height. A frontage at
  // z=-1.1 across the street, as in the rejected version, fails every sweep.
  for(let x=rightContext.kerb+.15;x<rightContext.roadOuter-.1;x+=.45)for(const y of [.2,1.2,2.3]){
    const hits=new T.Raycaster(new T.Vector3(x,y,5),new T.Vector3(0,0,-1),0,30).intersectObject(root,true);
    assert.equal(hits.length,0,`street blocked at x=${x}, y=${y}`);
  }
  assert.ok(rightContext.oppositeFront-rightContext.roadOuter>2,'opposite houses need their own verge and setback');
});

test('side tree beds leave a continuous walking strip and never protrude into the road',()=>{
  for(const bed of sidePlantingBeds){
    assert.ok(bed.x-bed.w/2>=rightContext.walkingEdge);
    assert.ok(bed.x+bed.w/2<rightContext.kerb-.15);
    const edges=bedEdges(bed,bed.x);assert.ok(edges.front>edges.rear);
  }
});
