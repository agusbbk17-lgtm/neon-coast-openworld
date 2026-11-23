import * as THREE from '../../vendor/three.min.js';
import { distance2D, angleDelta } from '../core/math.js';

// All animated crowd limbs share one instanced box mesh, heads another.
export class CrowdRenderer {
  constructor(scene, materials, capacity = 96) {
    this.capacity = capacity; this.boxesPerPerson = 14; this.dummy = new THREE.Object3D(); this.root = new THREE.Object3D();
    const material = materials.surface('#fff', 0.82);
    this.boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity * this.boxesPerPerson);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), material, capacity);
    this.boxes.castShadow = this.heads.castShadow = this.boxes.receiveShadow = this.heads.receiveShadow = true; scene.add(this.boxes, this.heads);
    this.matrix = new THREE.Matrix4(); this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity * this.boxesPerPerson; i++) { this.boxes.setMatrixAt(i, this.hidden); this.boxes.setColorAt(i, new THREE.Color('#fff')); }
    for (let i = 0; i < capacity; i++) { this.heads.setMatrixAt(i, this.hidden); this.heads.setColorAt(i, new THREE.Color('#fff')); }
  }
  render(people, player, time, alpha) {
    for (let i = 0; i < this.capacity; i++) {
      const npc = people[i], visible = npc && npc.active && distance2D(npc, player) < 145;
      if (!visible) { for (let j = 0; j < this.boxesPerPerson; j++) this.boxes.setMatrixAt(i * this.boxesPerPerson + j, this.hidden); this.heads.setMatrixAt(i, this.hidden); continue; }
      this.root.position.set(npc.previous.x + (npc.x - npc.previous.x) * alpha, (npc.previous.y ?? npc.y) + (npc.y - (npc.previous.y ?? npc.y)) * alpha, npc.previous.z + (npc.z - npc.previous.z) * alpha);
      const yaw = (npc.previous.yaw ?? npc.yaw) + angleDelta(npc.previous.yaw ?? npc.yaw, npc.yaw) * alpha;
      this.root.rotation.set(npc.health <= 0 ? -Math.PI / 2 : 0, yaw, npc.health <= 0 ? 0.15 : 0); this.root.updateMatrix();
      let slot = 0;
      const part = (x, y, z, sx, sy, sz, rx, color) => {
        this.dummy.position.set(x, y, z); this.dummy.scale.set(sx, sy, sz); this.dummy.rotation.set(rx, 0, 0); this.dummy.updateMatrix();
        this.matrix.multiplyMatrices(this.root.matrix, this.dummy.matrix); this.boxes.setMatrixAt(i * this.boxesPerPerson + slot++, this.matrix);
        this.boxes.setColorAt(i * this.boxesPerPerson + slot - 1, new THREE.Color(color));
      };
      const moving = npc.speed > 0.15 && npc.health > 0, phase = time * (npc.speed > 3 ? 11 : 6) + i, stride = moving ? Math.min(npc.speed / 5, 0.65) : 0;
      part(0, 1.21, 0, 0.43, 0.56, 0.26, 0, npc.shirt); part(0, 0.88, 0, 0.36, 0.16, 0.25, 0, npc.pants);
      part(0, 1.80, 0.015, 0.27, 0.08, 0.25, 0, '#302b26'); part(0, 1.69, -0.14, 0.24, 0.035, 0.02, 0, '#25343b');
      for (const side of [-1, 1]) {
        const step = Math.sin(phase + (side < 0 ? Math.PI : 0)) * stride, arm = npc.armed ? 1.35 : -step * 0.8;
        part(side * 0.30, 1.43 - 0.17 * Math.cos(arm), -0.17 * Math.sin(arm), 0.14, 0.34, 0.16, arm, npc.shirt);
        part(side * 0.30, 1.43 - 0.34 * Math.cos(arm) - 0.15 * Math.cos(arm + 0.15), -0.34 * Math.sin(arm) - 0.15 * Math.sin(arm + 0.15), 0.12, 0.30, 0.13, arm + 0.15, npc.skin);
        part(side * 0.12, 0.88 - 0.21 * Math.cos(step), -0.21 * Math.sin(step), 0.18, 0.42, 0.20, step, npc.pants);
        const knee = step + Math.min(0, -step) * 0.6;
        part(side * 0.12, 0.88 - 0.42 * Math.cos(step) - 0.19 * Math.cos(knee), -0.42 * Math.sin(step) - 0.19 * Math.sin(knee), 0.16, 0.38, 0.18, knee, npc.pants);
        part(side * 0.12, 0.08, -0.045, 0.19, 0.13, 0.29, 0, '#263439');
      }
      this.dummy.position.set(0, 1.65, 0); this.dummy.scale.set(0.15, 0.195, 0.15); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix();
      this.matrix.multiplyMatrices(this.root.matrix, this.dummy.matrix); this.heads.setMatrixAt(i, this.matrix); this.heads.setColorAt(i, new THREE.Color(npc.skin));
    }
    this.boxes.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = this.boxes.instanceColor.needsUpdate = this.heads.instanceColor.needsUpdate = true;
    this.boxes.computeBoundingSphere(); this.heads.computeBoundingSphere();
  }
}
