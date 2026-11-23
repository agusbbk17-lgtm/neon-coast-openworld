import { test } from 'node:test';
import assert from 'node:assert/strict';
import { damping, dampAngle } from '../game/src/core/math.js';
import { CollisionWorld, segmentBox } from '../game/src/systems/collision.js';
import { CameraCollision } from '../game/src/camera/collision.js';
import { CAMERA_PRESETS } from '../game/src/camera/presets.js';

test('camera damping is independent of 60 versus 144 Hz', () => {
  const integrate = hz => { let x = 0; for (let i = 0; i < hz; i++) x += (10 - x) * damping(1 / 0.12, 1 / hz); return x; };
  assert.ok(Math.abs(integrate(60) - integrate(144)) < 1e-10);
  assert.equal(damping(10, 0), 0); assert.equal(damping(10, -1), 0);
});
test('yaw damping follows the short arc across pi', () => {
  const yaw = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 8, 0.1); assert.ok(yaw > Math.PI - 0.1); assert.ok(yaw < Math.PI + 0.1);
});
test('presets match authored distances exactly', () => {
  assert.deepEqual(CAMERA_PRESETS.Medium, { back: 2.8, right: 0.6, up: 1.7 }); assert.equal(CAMERA_PRESETS.Far.back, 4.2);
});
test('sphere sweep catches wall and parallel segment misses', () => {
  const world = new CollisionWorld(); const wall = world.add(0, 2, 3, 10, 4, 1);
  assert.ok(segmentBox({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: 5 }, wall, 0.23) < 0.5);
  assert.equal(segmentBox({ x: 7, y: 2, z: 0 }, { x: 7, y: 2, z: 5 }, wall), null);
});
test('camera pulls in safely and eases back out', () => {
  const world = new CollisionWorld(); world.add(0, 2, 3, 10, 4, 1);
  const collision = new CameraCollision(world), pivot = { x: 0, y: 2, z: 0 };
  const close = collision.solve(pivot, { x: 0, y: 2, z: 6 }, 1 / 60); assert.ok(close.z < 2.27); assert.ok(!world.contains(close, 0.23));
  const released = collision.solve(pivot, { x: 6, y: 2, z: 0 }, 1 / 60); assert.ok(Math.hypot(released.x, released.z) < 6);
});
test('capsule motion cannot tunnel through a wall', () => {
  const world = new CollisionWorld(); world.add(0, 2, 3, 10, 4, 1); const body = { x: 0, y: 0.1, z: 0 };
  world.move(body, 0, 20, 0.4); assert.ok(body.z <= 2.10001); assert.ok(body.z > 2);
});
