import * as THREE from '../../vendor/three.min.js';
import { CITY } from '../data/city.js';
import { Instances } from '../render/geometry.js';

export function createRoads(scene, materials) {
  const batch = new Instances(), cube = new THREE.BoxGeometry(1, 1, 1), width = CITY.roadWidth;
  for (const x of CITY.streetsX) {
    batch.add('road', cube, materials.road, [x, -0.01, 10], [width, 0.12, 1450]);
    for (let z = -709; z < 730; z += 12) {
      if (CITY.streetsZ.some(cross => Math.abs(cross - z) < 17)) continue;
      for (const side of [-0.24, 0.24]) batch.add('yellow', cube, materials.yellow, [x + side, 0.057, z], [0.13, 0.012, 6]);
      for (const side of [-5.5, 5.5]) batch.add('line', cube, materials.white, [x + side, 0.057, z], [0.14, 0.012, 5]);
    }
    for (const side of [-1, 1]) batch.add('edge', cube, materials.white, [x + side * (width / 2 - 0.6), 0.056, 10], [0.15, 0.01, 1450]);
  }
  for (const z of CITY.streetsZ) {
    batch.add('road', cube, materials.road, [-171, -0.02, z], [1070, 0.12, width]);
    for (let x = -700; x < 345; x += 12) {
      if (CITY.streetsX.some(cross => Math.abs(cross - x) < 17)) continue;
      for (const side of [-0.22, 0.22]) batch.add('yellow', cube, materials.yellow, [x, 0.058, z + side], [6, 0.012, 0.13]);
      for (const side of [-5.5, 5.5]) batch.add('line', cube, materials.white, [x, 0.058, z + side], [5, 0.012, 0.14]);
    }
    for (const x of CITY.streetsX) for (const side of [-1, 1]) for (let mark = -8; mark <= 8; mark += 2)
      batch.add('zebra', cube, materials.white, [x + side * 15, 0.065, z + mark], [3.6, 0.01, 0.8]);
  }
  for (let xi = 0; xi < CITY.streetsX.length - 1; xi++) for (let zi = 0; zi < CITY.streetsZ.length - 1; zi++) {
    const xa = CITY.streetsX[xi], xb = CITY.streetsX[xi + 1], za = CITY.streetsZ[zi], zb = CITY.streetsZ[zi + 1];
    const cx = (xa + xb) / 2, cz = (za + zb) / 2, w = xb - xa - width, d = zb - za - width;
    batch.add('walk', cube, materials.concrete, [cx, 0.085, cz], [w, 0.18, d]);
    batch.add('block', cube, materials.grass, [cx, 0.18, cz], [w - 12, 0.04, d - 12]);
  }
  batch.add('boardwalk', cube, materials.cream, [355, 0.10, 30], [12, 0.22, 1390]);
  batch.add('seawall', cube, materials.concrete, [366, 0.30, 20], [0.7, 0.9, 1420]); batch.build(scene, false);
}
