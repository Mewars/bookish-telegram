import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quoteTaskCommission} from '../src/haltura/commission.ts';
test('fee is taken once from a task and unknown provider cost is never presented as net revenue',()=>{
 const q=quoteTaskCommission(100000,1000);
 assert.equal(q.platformGrossKopecks,10000);assert.equal(q.executorKopecks,90000);
 assert.equal(q.platformNetBeforeTaxKopecks,null);
 assert.equal(quoteTaskCommission(100000,1000,4500).platformNetBeforeTaxKopecks,5500);
 assert.equal(quoteTaskCommission(100,1000,200).platformNetBeforeTaxKopecks,-190);
});
test('kopeck rounding conserves every task amount, including large safe integers',()=>{
 for(const amount of [1,5,99,101,10000,Number.MAX_SAFE_INTEGER])for(const rate of [0,1,500,1000,9999,10000]){
  const q=quoteTaskCommission(amount,rate);assert.equal(q.platformGrossKopecks+q.executorKopecks,amount);
  assert(q.executorKopecks>=0);assert(Number.isSafeInteger(q.platformGrossKopecks));
 }
 for(const amount of [0,-1,NaN,Infinity,1.5,'100',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>quoteTaskCommission(amount,1000));
 for(const rate of [-1,10001,NaN,0.5,'1000'])assert.throws(()=>quoteTaskCommission(100,rate));
 assert.throws(()=>quoteTaskCommission(100,1000,-1));
});
