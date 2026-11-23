import * as THREE from '../../vendor/three.min.js';
import { CITY, BRANDS } from '../data/city.js';
import { Random } from '../core/rng.js';
import { Instances, BoxBatch, box } from '../render/geometry.js';
import { signTexture } from '../render/materials.js';

export function generateBuildings(seed) {
  const rng = new Random(seed + ':buildings'), records = [];
  for (let xi = 0; xi < CITY.streetsX.length - 1; xi++) for (let zi = 0; zi < CITY.streetsZ.length - 1; zi++) {
    const xa = CITY.streetsX[xi], xb = CITY.streetsX[xi + 1], za = CITY.streetsZ[zi], zb = CITY.streetsZ[zi + 1];
    const cx = (xa + xb) / 2, cz = (za + zb) / 2;
    if (cx > -420 && cx < -300 && cz > 300 && cz < 430) continue;
    const downtown = cx > -310 && cx < 140 && cz > -460 && cz < 150, industrial = cz < -480, coastal = cx > 180;
    const rows = downtown ? 2 : 3, columns = 2;
    for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
      const x = xa + 29 + i * (xb - xa - 58), z = za + 31 + j * ((zb - za - 62) / Math.max(1, rows - 1));
      const width = rng.range(22, downtown ? 34 : 29), depth = rng.range(19, rows === 3 ? 25 : 35);
      const height = industrial ? rng.range(7, 17) : downtown ? rng.range(30, 105) : coastal ? rng.range(15, 44) : rng.range(8, 24);
      records.push({ x, z, width, depth, height, style: rng.int(0, 5), downtown, industrial, coastal,
        sign: rng.pick(BRANDS), accent: rng.pick(['#e6a97d', '#5fa1a2', '#e7d6b4', '#acbcbc']) });
    }
  }
  return records;
}
export function buildBuildingChunks(records, scene, materials, collision) {
  const chunks = new Map(), cube = new THREE.BoxGeometry(1, 1, 1);
  for (const b of records) {
    const key = Math.floor(b.x / 120) + ':' + Math.floor(b.z / 140);
    if (!chunks.has(key)) chunks.set(key, { x: b.x, z: b.z, group: new THREE.Group(), records: [] });
    chunks.get(key).records.push(b); collision.add(b.x, b.height / 2 + 0.2, b.z, b.width, b.height, b.depth);
  }
  for (const chunk of chunks.values()) {
    const instances = new Instances(), roofs = new BoxBatch();
    for (const b of chunk.records) {
      instances.add('facade' + b.style, cube, materials.facade[b.style], [b.x, b.height / 2 + 0.2, b.z], [b.width, b.height, b.depth]);
      roofs.add(b.x, b.height + 0.6, b.z, b.width + 1, 0.7, b.depth + 1, b.accent);
      roofs.add(b.x, b.height + 1.4, b.z, b.width * 0.55, 1.5, b.depth * 0.55, '#c3c3b5');
      if (b.downtown) {
        for (const side of [-1, 1]) roofs.add(b.x + side * (b.width / 2 + 0.16), b.height / 2, b.z, 0.4, b.height, b.depth + 0.4, '#e9d8b8');
        roofs.add(b.x, b.height + 4, b.z, b.width * 0.5, 6, b.depth * 0.5, '#71939f');
      } else {
        roofs.add(b.x, 3.2, b.z + b.depth / 2 + 0.8, b.width + 1, 0.5, 3, b.accent);
        roofs.add(b.x, 1.5, b.z + b.depth / 2 + 0.04, b.width - 2, 2.7, 0.12, '#3f6469');
      }
      roofs.add(b.x + 4, b.height + 2, b.z - 3, 3, 2, 4, '#697775');
    }
    instances.build(chunk.group); chunk.group.add(roofs.build(materials.roof)); scene.add(chunk.group);
  }
  const rng = new Random('city-signs');
  for (const b of records.filter(b => b.coastal || b.downtown).filter((_, i) => i % 3 === 0)) {
    const map = signTexture(b.sign, '#ffe5b1', rng.pick(['#16434a', '#794b4e', '#376d70']));
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.55, emissiveMap: map, emissive: '#fff2cf', emissiveIntensity: 0.25 });
    scene.add(box(Math.min(b.width - 2, 15), 3.5, 0.25, material, b.x, Math.min(b.height - 2, 7), b.z + b.depth / 2 + 0.25));
  }
  return Array.from(chunks.values());
}
