import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signalState } from '../game/src/world/signals.js';
import { AIScheduler, steeringToward } from '../game/src/systems/ai.js';
import { createSidewalkGraph } from '../game/src/world/sidewalks.js';

test('traffic lights alternate with yellow and all-red clearance', () => {
  assert.deepEqual(signalState(0), { ns: 'green', ew: 'red' }); assert.equal(signalState(18).ns, 'yellow');
  assert.deepEqual(signalState(20.5), { ns: 'red', ew: 'red' }); assert.equal(signalState(22).ew, 'green');
  assert.equal(signalState(39).ew, 'yellow'); assert.deepEqual(signalState(42), signalState(0));
});
test('sidewalk corners connect to walkways and crossings', () => {
  const graph = createSidewalkGraph(), route = graph.path('8:7:1', '8:6:1'); assert.ok(route.length >= 2);
  assert.ok(graph.nodes.get('8:7:1').edges.some(edge => edge.to === '8:7:2'));
});
test('time-sliced AI visits every item and respects its budget', () => {
  const scheduler = new AIScheduler(0.1, 2), seen = [];
  for (let i = 0; i < 3; i++) scheduler.update(0.11, [0, 1, 2, 3, 4, 5], value => seen.push(value));
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5]);
});
test('lane controller steers right toward an eastern target', () => {
  const controls = steeringToward({ x: 0, z: 0, yaw: 0, speed: 0 }, { x: 20, z: -20 }, 12);
  assert.ok(controls.steer > 0); assert.ok(controls.throttle > 0);
});
