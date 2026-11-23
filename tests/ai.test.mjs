import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signalState } from '../game/src/world/signals.js';
import { AIScheduler, steeringToward, planRoadRoute, roadLookahead, recoverRoadObstacle } from '../game/src/systems/ai.js';
import { createSidewalkGraph } from '../game/src/world/sidewalks.js';
import { WaypointGraph } from '../game/src/world/graph.js';
import { PoliceResponse } from '../game/src/entities/police.js';

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

function squareRoads() {
  return new WaypointGraph().add('a', 0, 0).add('b', 0, -100).add('c', 100, -100).add('d', 100, 0)
    .connect('a', 'b').connect('b', 'c').connect('c', 'd').connect('d', 'a');
}
test('road planning enters through the forward endpoint instead of a nearer node behind', () => {
  const graph = squareRoads(), vehicle = { x: 3.5, z: -40, yaw: 0, speed: 15 };
  assert.equal(graph.nearest(vehicle).id, 'a');
  const route = planRoadRoute(graph, vehicle, 'c');
  assert.deepEqual(route[0], { x: 0, z: -40 }); assert.equal(route[1].id, 'b');
  const follow = roadLookahead(vehicle, route, 30);
  assert.equal(follow.cursor, 1); assert.ok(follow.point.z < vehicle.z); assert.ok(Math.abs(follow.controls.steer) < 0.1);
});
test('legacy routes skip their behind-start node only when the car is on that road segment', () => {
  const graph = squareRoads(), route = graph.path('a', 'c');
  const moving = roadLookahead({ x: 3.5, z: -40, yaw: 0, speed: 15 }, route, 30);
  assert.equal(moving.cursor, 1); assert.ok(moving.point.z < -40);
  const offRoad = roadLookahead({ x: 40, z: -40, yaw: 0, speed: 0 }, route, 30);
  assert.equal(offRoad.cursor, 0);
});
test('road approach candidates honor full-width clearance and reject unreachable starts', () => {
  const graph = squareRoads(), vehicle = { x: 3.5, z: -40, yaw: 0, speed: 10 };
  assert.deepEqual(planRoadRoute(graph, vehicle, 'c', () => false), []);
  const accepted = planRoadRoute(graph, vehicle, 'c', point => point.x === 100);
  assert.equal(accepted[0].x, 100); assert.equal(accepted[1].id, 'c');
});
test('lookahead brakes before a right-angle junction and limits acceleration out of it', () => {
  const graph = squareRoads(), route = graph.path('a', 'c');
  const inbound = roadLookahead({ x: 3.5, z: -80, yaw: 0, speed: 34 }, route, 34, 1);
  assert.ok(inbound.pace < 25); assert.ok(inbound.controls.brake > 0.8); assert.ok(inbound.point.z >= -100);
  const exiting = roadLookahead({ x: 3.5, z: -97, yaw: -0.8, speed: 10 }, route, 34, 1);
  assert.equal(exiting.cursor, 2); assert.ok(exiting.pace < 12); assert.ok(exiting.point.x > 3.5);
  const straight = roadLookahead({ x: 3.5, z: -80, yaw: 0, speed: 34 }, [route[0], route[1], { x: 0, z: -200 }], 34, 1);
  assert.equal(straight.pace, 34);
});
test('blocked wheels reverse briefly, stop for a rear obstacle and request a fresh route', () => {
  const state = {}, vehicle = { x: 0, z: 0, speed: 0 }, normal = { steer: 0.8, throttle: 0, brake: 1 };
  let controls;
  for (let tick = 0; tick < 60; tick++) controls = recoverRoadObstacle(state, vehicle, 1 / 60, true, true, normal);
  assert.ok(controls.throttle < 0); assert.ok(state.reverseRemaining > 0); assert.equal(controls.steer, -0.8);
  for (let tick = 0; tick < 80; tick++) recoverRoadObstacle(state, vehicle, 1 / 60, false, true, normal);
  assert.equal(state.reverseRemaining, 0); assert.equal(state.replan, true); assert.ok(state.cooldown > 0);
  state.reverseRemaining = 1;
  const stopped = recoverRoadObstacle(state, vehicle, 1 / 60, true, false, normal);
  assert.equal(stopped.throttle, 0); assert.equal(stopped.brake, 1); assert.equal(state.reverseRemaining, 0);
});
test('moving vehicles do not enter stuck recovery merely because an obstacle is sensed', () => {
  const state = {}, vehicle = { x: 0, z: 0, speed: 8 }, normal = { steer: 0, throttle: 0, brake: 0.65 };
  for (let tick = 0; tick < 120; tick++) { vehicle.z -= 0.1; recoverRoadObstacle(state, vehicle, 1 / 60, true, true, normal); }
  assert.ok(!state.reverseRemaining); assert.ok(state.stallTime < 0.1);
});
test('pooled police reset physical damage and clearing preserves a stolen player car', () => {
  const game = { player: { x: 0, z: 0 }, graph: squareRoads(), wanted: { arrest: 2 }, scene: {}, world: { collision: {} } };
  const response = new PoliceResponse(game), recycled = { active: false, playerOwned: false, health: 0, y: 22, yaw: 1,
    vy: 12, tyreDamage: true, flipped: true, snapshot() { this.previous = { x: this.x, y: this.y, z: this.z, yaw: this.yaw }; } };
  response.cruisers.push(recycled); assert.equal(response.spawnCruiser(0), recycled);
  assert.equal(recycled.y, 0.08); assert.equal(recycled.previous.y, recycled.y); assert.equal(recycled.vy, 0);
  assert.equal(recycled.health, 100); assert.equal(recycled.tyreDamage, false); assert.equal(recycled.flipped, false);
  const stolen = { active: true, playerOwned: true, driver: 'player', ai: null }; response.cruisers.push(stolen);
  response.spawnTimer = 2; response.planTimer = 0.7; response.clear();
  assert.equal(recycled.active, false); assert.equal(stolen.active, true); assert.equal(stolen.driver, 'player');
  assert.equal(response.spawnTimer, 0); assert.equal(response.planTimer, 0); assert.equal(game.wanted.arrest, 0);
});
