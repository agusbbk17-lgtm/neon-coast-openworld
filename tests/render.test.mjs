import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../game/vendor/three.min.js';
import { BoxBatch } from '../game/src/render/geometry.js';
import { ChunkStreamer } from '../game/src/world/chunks.js';
import { CrowdRenderer } from '../game/src/entities/crowd-renderer.js';
import { createVehicleModel } from '../game/src/entities/vehicle-model.js';
import { VEHICLE_TYPES } from '../game/src/data/vehicles.js';
import { Lighting } from '../game/src/render/lighting.js';

const surfaces = { surface: () => new THREE.MeshStandardMaterial() };
function assertInstanceBounds(mesh) {
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), positions = mesh.geometry.attributes.position;
  for (let instance = 0; instance < mesh.count; instance++) {
    mesh.getMatrixAt(instance, matrix); if (Math.abs(matrix.determinant()) < 1e-9) continue;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
      assert.ok(point.distanceTo(mesh.boundingSphere.center) <= mesh.boundingSphere.radius + 1e-5);
    }
  }
}
test('cached box template preserves merged dimensions, normals and index offsets', () => {
  const batch = new BoxBatch(); batch.add(3, 5, -7, 2.7, 4.1, 1.3, '#e79a44'); batch.add(0, 0, 0, 1, 1, 1, '#243543');
  const mesh = batch.build(new THREE.MeshStandardMaterial()), expected = new THREE.BoxGeometry(2.7, 4.1, 1.3);
  const position = mesh.geometry.attributes.position, normal = mesh.geometry.attributes.normal;
  for (let i = 0; i < expected.attributes.position.count; i++) {
    assert.ok(Math.abs(position.getX(i) - expected.attributes.position.getX(i) - 3) < 1e-6);
    assert.ok(Math.abs(position.getY(i) - expected.attributes.position.getY(i) - 5) < 1e-6);
    assert.ok(Math.abs(position.getZ(i) - expected.attributes.position.getZ(i) + 7) < 1e-6);
    assert.equal(normal.getX(i), expected.attributes.normal.getX(i));
  }
  assert.equal(position.count, 48); assert.equal(mesh.geometry.index.count, 72);
  assert.ok([...mesh.geometry.index.array.slice(36)].every(index => index >= 24));
});
test('horizon buildings reuse one material allocation', () => {
  let allocations = 0;
  const records = Array.from({ length: 20 }, (_, i) => ({ x: i * 30, z: 0, width: 10, depth: 12, height: 50 }));
  const streamer = new ChunkStreamer([], records, new THREE.Scene(), { surface: () => { allocations++; return new THREE.MeshStandardMaterial(); } });
  assert.equal(allocations, 1); assert.equal(streamer.horizon.children[0].count, 20);
});
test('crowd conservative bounds enclose moving and prone poses; colors stay cached', () => {
  const renderer = new CrowdRenderer(new THREE.Scene(), surfaces, 3), player = { x: 400, y: 0, z: 300 };
  const make = (x, z, y, health) => ({ x, z, y, previous: { x: x - 0.1, z, y, yaw: 1 }, yaw: 1.2,
    active: true, health, armed: true, speed: 4.5, shirt: '#c46e61', pants: '#686763', skin: '#c58e6a' });
  const people = [make(400, 300, 0, 100), make(490, 290, 21, 0)];
  for (let frame = 0; frame < 24; frame++) {
    renderer.render(people, player, frame * 0.1, 0.5); assertInstanceBounds(renderer.boxes); assertInstanceBounds(renderer.heads);
  }
  const version = renderer.boxes.instanceColor.version, cache = renderer.colors.size;
  renderer.render(people, player, 3, 1); assert.equal(renderer.boxes.instanceColor.version, version); assert.equal(renderer.colors.size, cache);
  people[0].shirt = '#b6d3ce'; renderer.render(people, player, 3.1, 1); assert.ok(renderer.boxes.instanceColor.version > version);
});
test('wheel bounds remain safe across steering, roll and spin without rescanning', () => {
  for (const type of ['sports', 'suv', 'bike', 'police']) {
    const model = createVehicleModel(type, VEHICLE_TYPES[type], '#e79a44', surfaces), sphere = model.tires.boundingSphere;
    for (let i = 0; i < 24; i++) {
      model.animate({ steering: Math.sin(i) * 0.6, wheelSpin: i, health: 100, roll: 0.2, pitch: 0.1 }, i, 0);
      assertInstanceBounds(model.tires); assertInstanceBounds(model.rims); assert.equal(model.tires.boundingSphere, sphere);
    }
  }
});
test('night disables sun shadow work and daylight honors the quality setting', () => {
  const lighting = new Lighting(new THREE.Scene(), { facade: [], neon: {} }), target = { x: 10, z: 20 };
  lighting.configure({ shadow: 2048 }); lighting.time = 0; lighting.update(0, target);
  assert.equal(lighting.sun.intensity, 0); assert.equal(lighting.sun.castShadow, false);
  lighting.time = 12; lighting.update(0, target); assert.equal(lighting.sun.castShadow, true);
  lighting.configure({ shadow: 0 }); lighting.update(0, target); assert.equal(lighting.sun.castShadow, false);
});
