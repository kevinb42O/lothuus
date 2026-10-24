import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { plantingBeds, treeSites, plantMatrix, bedEdges, bedPoint } from './house-planting';

test('rotated and oversized plants fit completely inside either soil footprint',()=>{
  // Deliberately asymmetric, off-centre source geometry catches origin-only
  // containment and the rotated nursery-row regression.
  const bounds=new T.Box3(new T.Vector3(-1.5,-.03,-.2),new T.Vector3(3,1.2,.7));
  for(const bed of plantingBeds)for(let i=0;i<80;i++){
    const matrix=plantMatrix(bounds,bed,{x:bed.x+Math.sin(i)*bed.w,z:bed.z+Math.cos(i)*bed.d,height:.3+i*.03,rotation:i*.13});
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const p=new T.Vector3(x,y,z).applyMatrix4(matrix);
      assert.ok(p.x>=bed.x-bed.w/2+.07999&&p.x<=bed.x+bed.w/2-.07999);
      const edges=bedEdges(bed,p.x);
      assert.ok(p.z>=edges.rear+.07999&&p.z<=edges.front-.07999);
      assert.ok(p.y>=.13999);
    }
  }
});

test('all three tree roots have clearance inside the right bed',()=>{
  const bed=plantingBeds[1];
  for(const site of treeSites){
    assert.ok(Math.abs(site.x-bed.x)+.3<bed.w/2);
    const edges=bedEdges(bed,site.x);
    assert.ok(site.z-.3>edges.rear&&site.z+.3<edges.front);
  }
});

test('planting follows the photographed sloping kerbs with an inset on every edge',()=>{
  for(const bed of plantingBeds)for(let i=0;i<=20;i++)for(let j=0;j<=20;j++){
    const p=bedPoint(bed,i/20,j/20,.27),edges=bedEdges(bed,p.x);
    assert.ok(p.x>=bed.x-bed.w/2+.26999&&p.x<=bed.x+bed.w/2-.26999);
    assert.ok((p.z-edges.rear)/Math.hypot(1,bed.rearSlope)>.26999);
    assert.ok((edges.front-p.z)/Math.hypot(1,bed.frontSlope)>.26999);
  }
});
