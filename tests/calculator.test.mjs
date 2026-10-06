import test from 'node:test';import assert from 'node:assert/strict';import {calculate} from '../public/lib/calculator.js';
test('20% scenario uses post-reduction fuel for dosage',()=>{const r=calculate(10,1000,70,0.2);assert.equal(r.monthlySavings,1400);assert.equal(r.yearlySavings,16800);assert.equal(r.consumptionAfter,8);assert.equal(r.syntonikMlYear,96);});
test('all scenarios and dosage',()=>{for(const [s,savings,dose] of [[0.1,700,108],[0.2,1400,96],[0.3,2100,84]]){const r=calculate(10,1000,70,s);assert.equal(r.monthlySavings,savings);assert.equal(r.syntonikMlYear,dose);}});
test('zero mileage',()=>{const r=calculate(10,0,70,0.2);assert.equal(r.monthlySavings,0);assert.equal(r.syntonikMlYear,0);});
test('invalid input rejected',()=>{for(const args of [[0,1000,70,0.2],[10,-1,70,0.2],[10,1000,NaN,0.2],[10,1000,70,0.5],[Infinity,1000,70,0.2]])assert.throws(()=>calculate(...args),RangeError);});
