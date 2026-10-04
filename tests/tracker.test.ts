import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDragons, parseCollection, rankChange } from '../lib/collection';
import { validateDataset } from '../lib/ditlep';
import seed from '../data/rankings.json';
import type { Dragon } from '../lib/types';
const dragons = seed.dragons as Dragon[];
test('real source snapshot is complete with unique identifiers and all role scores', () => {
  validateDataset(dragons, dragons.length);
  assert.ok(dragons.length > 2000);
  for(const d of dragons) {for(const rank of Object.values(d.ranks)) assert.ok(Number.isFinite(rank) && rank > 0);for(const score of Object.values(d.scores)) assert.ok(Number.isFinite(score));}
});
test('incomplete and duplicate refreshes cannot replace a valid snapshot', () => {
  assert.throws(()=>validateDataset(dragons.slice(0,3),dragons.length));
  assert.throws(()=>validateDataset([dragons[0],dragons[0]],2));
  assert.throws(()=>validateDataset(dragons.slice(0,10),10,dragons.length));
});
test('rank changes distinguish improvement, decline, unchanged and unknown', () => {
  assert.equal(rankChange(2,5),3);assert.equal(rankChange(10,5),-5);assert.equal(rankChange(5,5),0);assert.equal(rankChange(5),null);
});
test('owned includes newly acquired, summon stays separate, role order is global', () => {
  const collection = {[dragons[0].id]:{status:'acquired' as const,acquiredAt:null},[dragons[1].id]:{status:'summon' as const,acquiredAt:null}};
  const options = {query:'',list:'owned',rarity:'',element:'',mode:'damage' as const,changesOnly:false,previous:{}};
  assert.deepEqual(filterDragons(dragons,collection,options).map(d=>d.id),[dragons[0].id]);
  assert.deepEqual(filterDragons(dragons,collection,{...options,list:'summon'}).map(d=>d.id),[dragons[1].id]);
  const all=filterDragons(dragons,collection,{...options,list:'all'});
  assert.equal(all[0].ranks.damage,1);
});
test('changes filter excludes dragons without a previous snapshot',()=>{
  const options={query:'',list:'all',rarity:'',element:'',mode:'overall' as const,changesOnly:true,previous:{[dragons[0].id]:{...dragons[0].ranks,overall:5}}};
  assert.deepEqual(filterDragons(dragons,{},options).map(d=>d.id),[dragons[0].id]);
});
test('backup validation rejects malformed entries before changing storage', () => {
  assert.throws(()=>parseCollection({'123':{status:'hacked'}}));
  assert.throws(()=>parseCollection({'bad-id':{status:'owned'}}));
  assert.throws(()=>parseCollection({'123':{status:'owned',acquiredAt:'invalid'}}));
  assert.deepEqual(parseCollection({'123':{status:'owned',acquiredAt:null}}),{'123':{status:'owned',acquiredAt:null}});
});
