import * as THREE from '../../vendor/three.min.js';
import { box } from '../render/geometry.js';

export function weaponModels(player, materials) {
  const models = [], metal = materials.surface('#24353c', 0.35, 0.65), grip = materials.surface('#503e2e'), silver = materials.surface('#889697', 0.25, 0.7);
  for (let i = 0; i < 7; i++) {
    const group = new THREE.Group(); group.visible = false; player.rig.limbs.right.elbow.add(group); models.push(group);
    if (i === 0) continue;
    if (i === 1) { const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.024, 0.78, 10), grip); bat.position.y = -0.53; group.add(bat); }
    else if (i === 5) { const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), materials.surface('#6b8253')); mesh.position.y = -0.31; group.add(mesh); }
    else {
      const length = i === 2 ? 0.22 : i === 3 ? 0.36 : 0.60;
      group.add(box(0.09, length, 0.065, metal, 0, -0.31 - length / 2, 0)); group.add(box(0.10, 0.12, 0.15, grip, 0, -0.30, 0.04));
      group.add(box(0.045, length * 0.6, 0.035, silver, 0, -0.40 - length * 0.7, 0));
      if (i === 6) group.add(box(0.06, 0.19, 0.06, metal, 0, -0.45, -0.055));
    }
    group.traverse(object => { if (object.isMesh) object.castShadow = true; });
  }
  return models;
}
