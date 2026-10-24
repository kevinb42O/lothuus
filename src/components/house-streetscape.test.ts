import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitPavingBlock, streetLayout } from './house-streetscape';

function area(polygon:{x:number;z:number}[]){return Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.z-q.x*p.z;},0))/2;}

test('the footpath continues across the left approach and past the neighbouring frontage',()=>{
  for(const x of [-18,-14,-12,-10,-9.1]){
    const split=splitPavingBlock(x,4.55);
    assert.equal(split.road.length,0,`pavement interrupted at x=${x}`);
    assert.equal(split.foot.length,1);
  }
});

test('both staggered bonds are cut at the straight kerb in front of the entrance',()=>{
  let cut=0;
  for(let col=-11;col<=6;col++)for(let row=9;row<=12;row++){
    const x=col*streetLayout.blockWidth,z=4.08+row*streetLayout.blockLength+(Math.abs(col)%2)*streetLayout.blockLength/2;
    const split=splitPavingBlock(x,z);
    const sum=[...split.foot,...split.road].reduce((total,p)=>total+area(p),0);
    assert.ok(Math.abs(sum-area(split.source))<1e-9,'splitting must not leave a hole or overlapping stones');
    for(const polygon of split.foot)for(const p of polygon)assert.ok(p.z<=streetLayout.entranceFront(p.x)+1e-9,'a full-length stone protrudes beyond the kerb');
    if(split.foot.length&&split.road.length&&split.source.every(p=>p.x>streetLayout.entrance.left&&p.x<streetLayout.entrance.right)){
      cut++;
      assert.ok(split.foot.flat().some(p=>Math.abs(p.z-streetLayout.entranceFront(p.x))<1e-8));
    }
  }
  assert.ok(cut>=16,'every entrance column must meet the same straight boundary');
});
