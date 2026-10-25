import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSupabaseUsage } from './usage';
test('provider egress keeps its real billing window, warns before the quota and refuses unavailable data',()=>{
  const subscription={current_period_start:Math.floor(Date.now()/1000)-86400,current_period_end:Math.floor(Date.now()/1000)+86400};
  const sample=parseSupabaseUsage({usages:[{metric:'EGRESS',usage_original:4000000000}]},subscription);
  assert.equal(sample.value,4000000000);assert.equal(sample.level,'warning');assert.equal(sample.limit,5000000000);
  assert.throws(()=>parseSupabaseUsage({usages:[]},subscription));
  assert.throws(()=>parseSupabaseUsage({usages:[{metric:'EGRESS',usage_original:1}]},{current_period_start:1,current_period_end:2}));
});
