import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adsenseClient,adsenseSlot} from '../../src/lib/ads.ts';
test('only a valid publisher identifier can load the verification script',()=>{
  assert.equal(adsenseClient('pub-1972487168739114'),'ca-pub-1972487168739114');
  assert.equal(adsenseClient('invalid'),undefined);
});
test('placement names never become ad unit identifiers without an account mapping',()=>{
  assert.equal(adsenseSlot('jobs-top-1',undefined),undefined);
  assert.equal(adsenseSlot('jobs-top-1','{"jobs-top-1":"not-an-id"}'),undefined);
  assert.equal(adsenseSlot('jobs-top-1','invalid-json'),undefined);
});
