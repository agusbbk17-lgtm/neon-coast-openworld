import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WantedSystem } from '../game/src/systems/wanted.js';

test('crimes escalate through five stars and invalid reports are ignored', () => {
  const wanted = new WantedSystem(); wanted.report(NaN); wanted.report(-8); assert.equal(wanted.stars, 0);
  wanted.report(8); assert.equal(wanted.stars, 1); wanted.report(16); assert.equal(wanted.stars, 2);
  wanted.report(28); assert.equal(wanted.stars, 3); wanted.report(36); assert.equal(wanted.stars, 4); wanted.report(44); assert.equal(wanted.stars, 5);
});
test('line of sight resets search and a full unseen timer clears wanted', () => {
  const wanted = new WantedSystem(); wanted.report(52);
  for (let i = 0; i < 100; i++) wanted.update(0.25, true);
  assert.equal(wanted.stars, 3); assert.equal(wanted.searching, false); assert.equal(wanted.searchLeft, 18);
  for (let i = 0; i < 60; i++) wanted.update(0.25, false);
  assert.equal(wanted.stars, 3); assert.ok(wanted.searching);
  for (let i = 0; i < 13; i++) wanted.update(0.25, false);
  assert.equal(wanted.stars, 0); assert.equal(wanted.heat, 0);
});
