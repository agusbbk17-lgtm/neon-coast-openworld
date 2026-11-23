import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrateVehicle, obbOverlap, resolveVehiclePair } from '../game/src/systems/vehicle-physics.js';
import { VEHICLE_TYPES } from '../game/src/data/vehicles.js';
import { CollisionWorld } from '../game/src/systems/collision.js';

const car = (x = 0, z = 0) => ({ config: VEHICLE_TYPES.sports, x, y: 0.08, z, yaw: 0,
  vx: 0, vz: 0, speed: 0, health: 100, steering: 0, pitch: 0, roll: 0, wheelSpin: 0 });
test('eight original vehicle classes have distinct physical definitions', () => {
  assert.equal(Object.keys(VEHICLE_TYPES).length, 8); assert.ok(VEHICLE_TYPES.bike.mass < VEHICLE_TYPES.sports.mass);
});
test('engine accelerates, shifts and braking stops the car', () => {
  const v = car(); for (let i = 0; i < 300; i++) integrateVehicle(v, { throttle: 1 }, 1 / 60);
  assert.ok(v.speed > 45); assert.ok(v.gear >= 4); assert.ok(v.z < -100);
  for (let i = 0; i < 180; i++) integrateVehicle(v, { brake: 1 }, 1 / 60);
  assert.equal(v.speed, 0); assert.ok(Number.isFinite(v.rpm));
});
test('handbrake retains lateral velocity for controllable drift', () => {
  const a = car(), b = car(); a.vx = b.vx = 10; a.vz = b.vz = -20;
  for (let i = 0; i < 20; i++) { integrateVehicle(a, { handbrake: true }, 1 / 60); integrateVehicle(b, {}, 1 / 60); }
  assert.ok(Math.abs(a.vx) > Math.abs(b.vx) * 3);
});
test('OBB contact separates vehicles and applies an impulse', () => {
  const a = car(), b = car(1.4, 0); a.vx = 8;
  assert.ok(obbOverlap(a, b)); assert.ok(resolveVehiclePair(a, b) > 0); assert.ok(!obbOverlap(a, b)); assert.ok(b.vx > 0);
});
test('front-corner sweep prevents driving through a building', () => {
  const v = car(), world = new CollisionWorld(); world.add(0, 2, -15, 20, 4, 2);
  for (let i = 0; i < 150; i++) integrateVehicle(v, { throttle: 1 }, 1 / 60, world);
  assert.ok(v.z > -13); assert.ok(v.health < 100);
});
