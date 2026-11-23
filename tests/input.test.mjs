import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gamepadBindings } from '../game/src/core/input.js';

test('controller triggers aim/fire on foot but throttle/brake do not shoot in vehicles', () => {
  const foot = gamepadBindings(false), car = gamepadBindings(true);
  assert.equal(foot[6], 'Mouse2'); assert.equal(foot[7], 'Mouse0');
  assert.equal(car[6], null); assert.equal(car[7], null); assert.equal(car[5], 'Mouse0');
  assert.equal(foot[13], 'KeyV'); assert.equal(car[14], 'KeyV'); assert.equal(car[12], 'KeyT');
});
