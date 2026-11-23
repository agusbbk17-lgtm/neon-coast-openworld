import * as THREE from '../../vendor/three.min.js';
import { CITY } from '../data/city.js';
import { Random } from '../core/rng.js';
import { Instances, box } from '../render/geometry.js';
import { signTexture } from '../render/materials.js';

function palmFrond() {
  const shape = new THREE.BufferGeometry(), vertices = [], indices = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, x = t * 5.4, y = Math.sin(t * Math.PI) * 1.5 - t * 1.5, width = Math.sin(t * Math.PI) * 0.8 + 0.03;
    vertices.push(x, y, -width, x, y + 0.1, width);
    if (i < 8) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  shape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); shape.setIndex(indices); shape.computeVertexNormals(); return shape;
}
export function createProps(scene, materials, seed, collision) {
  const rng = new Random(seed + ':props'), batch = new Instances(), cube = new THREE.BoxGeometry(1, 1, 1);
  const trunk = new THREE.CylinderGeometry(0.18, 0.33, 1, 7), crown = new THREE.SphereGeometry(1, 7, 5), frond = palmFrond();
  const leaf = materials.leaf.clone(); leaf.side = THREE.DoubleSide;
  function palm(x, z, height = 9) {
    batch.add('trunk', trunk, materials.trunk, [x, height / 2, z], [1.3, height, 1.3], [0, rng.range(0, 6.28), 0.035]);
    batch.add('crown', crown, leaf, [x + 0.25, height, z], [0.9, 0.65, 0.9]);
    for (let i = 0; i < 9; i++) batch.add('frond', frond, leaf, [x + 0.25, height, z], [rng.range(0.75, 1.1), 1, 1], [0, i * Math.PI * 2 / 9 + height, rng.range(-0.2, 0.12)]);
  }
  for (let z = -670; z < 710; z += 24) {
    palm(349, z, rng.range(8, 12)); if (z % 48 === 0) palm(394, z + 7, rng.range(7, 10));
    batch.add('bench', cube, materials.trunk, [359, 0.62, z + 10], [1.8, 0.18, 0.6]);
    batch.add('bench-back', cube, materials.trunk, [359.15, 0.96, z + 10], [1.8, 0.75, 0.13]);
    batch.add('bin', cube, materials.metal, [343, 0.65, z + 8], [0.65, 1.3, 0.65]);
    batch.add('rail', cube, materials.cream, [368, 0.95, z], [0.11, 0.11, 24]);
    batch.add('post', cube, materials.cream, [368, 0.5, z], [0.14, 1, 0.14]);
  }
  for (const x of CITY.streetsX.slice(1)) for (let z = -640; z < 690; z += 52) {
    if (CITY.streetsZ.some(v => Math.abs(v - z) < 20)) continue;
    const side = x === 320 ? -1 : 1, lx = x + side * 14;
    batch.add('lamp', trunk, materials.metal, [lx, 4.2, z], [0.38, 8.4, 0.38]);
    batch.add('arm', cube, materials.metal, [lx - side, 8.25, z], [2.3, 0.16, 0.16]);
    batch.add('light', cube, materials.neon, [lx - side * 2, 8.1, z], [1, 0.1, 0.45]);
    if (x !== 320) palm(lx + side * 5, z + 15, rng.range(6.5, 9));
  }
  for (const x of CITY.streetsX) for (const z of CITY.streetsZ) {
    const sx = x + 13, sz = z + 13;
    batch.add('signalpole', trunk, materials.metal, [sx, 3.3, sz], [0.55, 6.6, 0.55]);
    batch.add('signalarm', cube, materials.metal, [sx - 3, 6.4, sz], [6, 0.15, 0.15]);
    batch.add('signalbody', cube, materials.metal, [sx - 5.5, 5.85, sz], [0.5, 1.2, 0.45]);
  }
  for (let i = 0; i < 28; i++) {
    const x = rng.range(-402, -320), z = rng.range(310, 406);
    batch.add('park-trunk', trunk, materials.trunk, [x, 2.7, z], [1.5, 5.4, 1.5]);
    batch.add('park-tree', crown, leaf, [x, 6, z], [3, 3.7, 3]);
  }
  for (let i = 0; i < 38; i++) batch.add('container', cube, materials.surface('#8bafb0'),
    [252 + (i % 5) * 11, 1.9 + Math.floor(i / 20) * 3.8, -682 + Math.floor(i / 5) % 4 * 14], [9, 3.8, 5], [0, 0, 0], rng.pick(['#c7774d', '#61878a', '#b7a26c', '#68727c']));
  for (const z of [-605, -650]) {
    batch.add('pier', cube, materials.concrete, [430, 0.4, z], [126, 1.2, 13]);
    batch.add('crane', cube, materials.yellow, [364, 14, z], [2, 28, 2]);
    batch.add('crane-arm', cube, materials.yellow, [377, 28, z], [31, 1.5, 2]);
    batch.add('boat', cube, materials.cream, [457, 0.2, z + 17], [12, 3, 27]);
    batch.add('cabin', cube, materials.glass, [457, 2.9, z + 14], [7, 3, 9]);
  }
  batch.add('overpass', cube, materials.concrete, [-706, 6.7, -120], [20, 1, 760]);
  for (let z = -460; z < 270; z += 50) batch.add('pillar', cube, materials.concrete, [-706, 3.3, z], [3, 6.6, 5]);
  batch.add('tunnel-roof', cube, materials.concrete, [320, 7.5, -470], [27, 1, 64]);
  collision.add(320, 7.5, -470, 27, 1, 64, 'tunnel-roof');
  for (const side of [-1, 1]) {
    batch.add('tunnel-wall', cube, materials.concrete, [320 + side * 14, 3.7, -470], [1, 7.4, 64]);
    collision.add(320 + side * 14, 3.7, -470, 1, 7.4, 64, 'tunnel-wall');
  }
  batch.build(scene);
  const sign = signTexture('SOLMAR BAY');
  const signMaterial = new THREE.MeshStandardMaterial({ map: sign, roughness: 0.5, emissiveMap: sign, emissive: '#ffd592', emissiveIntensity: 0.15 });
  scene.add(box(20, 4, 0.4, signMaterial, 343, 8, 285));
  for (let i = 0; i < 6; i++) scene.add(box(1.2, 5.5, 1.2, materials.cream, -140 + i * 6, 2.75, -317));
  scene.add(box(36, 1.2, 8, materials.cream, -125, 6, -318));
  const bank = signTexture('SOLMAR EXCHANGE', '#e5bf77', '#1f3e48');
  scene.add(box(28, 2.5, 0.3, new THREE.MeshStandardMaterial({ map: bank, roughness: 0.65 }), -125, 7.8, -314));
}
