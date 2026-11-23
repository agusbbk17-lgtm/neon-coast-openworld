import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raySphere, rayVehicle } from '../game/src/systems/hitscan.js';
import { VEHICLE_TYPES } from '../game/src/data/vehicles.js';
import { WEAPONS } from '../game/src/data/weapons.js';

test('hitscan finds a sphere in range and rejects misses and targets behind', () => {
  const origin = { x: 0, y: 1, z: 0 }, direction = { x: 0, y: 0, z: -1 };
  assert.equal(raySphere(origin, direction, { x: 0, y: 1, z: -10 }, 1, 20), 9);
  assert.equal(raySphere(origin, direction, { x: 0, y: 1, z: 10 }, 1, 20), null);
  assert.equal(raySphere(origin, direction, { x: 3, y: 1, z: -10 }, 1, 20), null);
});
test('vehicle ray tests respect rotated OBB dimensions', () => {
  const vehicle = { x: 0, y: 0, z: -10, yaw: 0, config: VEHICLE_TYPES.sedan };
  const origin = { x: 0, y: 0.7, z: 0 }, direction = { x: 0, y: 0, z: -1 };
  assert.ok(Math.abs(rayVehicle(origin, direction, vehicle, 20) - 7.65) < 1e-8);
  vehicle.yaw = Math.PI / 2; assert.ok(rayVehicle(origin, direction, vehicle, 20) > 9);
});
test('original loadout supports melee, automatic, pellets, grenades and a scope', () => {
  assert.equal(WEAPONS.length, 7); assert.equal(WEAPONS[0].kind, 'melee'); assert.equal(WEAPONS[5].kind, 'grenade');
  assert.ok(WEAPONS[4].pellets > 1); assert.ok(WEAPONS[6].scoped); assert.ok(WEAPONS[3].interval < WEAPONS[2].interval);
});
