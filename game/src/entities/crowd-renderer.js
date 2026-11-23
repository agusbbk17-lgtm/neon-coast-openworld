import * as THREE from '../../vendor/three.min.js';
import { distance2D, angleDelta } from '../core/math.js';

// All animated crowd limbs share one instanced box mesh, heads another.
export class CrowdRenderer {
  constructor(scene, materials, capacity = 96) {
    this.capacity = capacity; this.boxesPerPerson = 15; this.dummy = new THREE.Object3D(); this.root = new THREE.Object3D();
    const material = materials.surface('#fff', 0.82);
    this.boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity * this.boxesPerPerson);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), material, capacity);
    this.boxes.castShadow = this.heads.castShadow = this.boxes.receiveShadow = this.heads.receiveShadow = true; scene.add(this.boxes, this.heads);
    this.matrix = new THREE.Matrix4(); this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    this.styles = Array(capacity).fill(null); this.colors = new Map(); this.bounds = new THREE.Box3();
    this.boxes.boundingSphere = new THREE.Sphere(); this.heads.boundingSphere = new THREE.Sphere();
    this.boxes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const white = this.color('#fff');
    for (let i = 0; i < capacity * this.boxesPerPerson; i++) { this.boxes.setMatrixAt(i, this.hidden); this.boxes.setColorAt(i, white); }
    for (let i = 0; i < capacity; i++) { this.heads.setMatrixAt(i, this.hidden); this.heads.setColorAt(i, white); }
  }
  color(value) {
    if (!this.colors.has(value)) this.colors.set(value, new THREE.Color(value));
    return this.colors.get(value);
  }
  updateStyle(index, npc) {
    const old = this.styles[index];
    if (old?.npc === npc && old.shirt === npc.shirt && old.pants === npc.pants && old.skin === npc.skin) return false;
    const shirt = this.color(npc.shirt), pants = this.color(npc.pants), skin = this.color(npc.skin);
    const colors = [shirt, pants, this.color('#302b26'), this.color('#25343b')];
    for (let side = 0; side < 2; side++) colors.push(shirt, skin, pants, pants, this.color('#263439'));
    colors.push(this.color('#26383c'));
    for (let slot = 0; slot < colors.length; slot++) this.boxes.setColorAt(index * this.boxesPerPerson + slot, colors[slot]);
    this.heads.setColorAt(index, skin); this.styles[index] = { npc, shirt: npc.shirt, pants: npc.pants, skin: npc.skin }; return true;
  }
  render(people, player, time, alpha) {
    this.bounds.makeEmpty(); let colorDirty = false;
    for (let i = 0; i < this.capacity; i++) {
      const npc = people[i], visible = npc && npc.active && distance2D(npc, player) < 145;
      if (!visible) { for (let j = 0; j < this.boxesPerPerson; j++) this.boxes.setMatrixAt(i * this.boxesPerPerson + j, this.hidden); this.heads.setMatrixAt(i, this.hidden); continue; }
      colorDirty = this.updateStyle(i, npc) || colorDirty;
      this.root.position.set(npc.previous.x + (npc.x - npc.previous.x) * alpha, (npc.previous.y ?? npc.y) + (npc.y - (npc.previous.y ?? npc.y)) * alpha, npc.previous.z + (npc.z - npc.previous.z) * alpha);
      this.bounds.expandByPoint(this.root.position);
      const yaw = (npc.previous.yaw ?? npc.yaw) + angleDelta(npc.previous.yaw ?? npc.yaw, npc.yaw) * alpha;
      this.root.rotation.set(npc.health <= 0 ? -Math.PI / 2 : 0, yaw, npc.health <= 0 ? 0.15 : 0); this.root.updateMatrix();
      let slot = 0;
      const part = (x, y, z, sx, sy, sz, rx) => {
        this.dummy.position.set(x, y, z); this.dummy.scale.set(sx, sy, sz); this.dummy.rotation.set(rx, 0, 0); this.dummy.updateMatrix();
        this.matrix.multiplyMatrices(this.root.matrix, this.dummy.matrix); this.boxes.setMatrixAt(i * this.boxesPerPerson + slot++, this.matrix);
      };
      const moving = npc.speed > 0.15 && npc.health > 0, phase = time * (npc.speed > 3 ? 11 : 6) + i, stride = moving ? Math.min(npc.speed / 5, 0.65) : 0;
      part(0, 1.21, 0, 0.43, 0.56, 0.26, 0); part(0, 0.88, 0, 0.36, 0.16, 0.25, 0);
      part(0, 1.80, 0.015, 0.27, 0.08, 0.25, 0); part(0, 1.69, -0.14, 0.24, 0.035, 0.02, 0);
      for (const side of [-1, 1]) {
        const step = Math.sin(phase + (side < 0 ? Math.PI : 0)) * stride, arm = npc.armed ? 1.35 : -step * 0.8;
        part(side * 0.30, 1.43 - 0.17 * Math.cos(arm), -0.17 * Math.sin(arm), 0.14, 0.34, 0.16, arm);
        part(side * 0.30, 1.43 - 0.34 * Math.cos(arm) - 0.15 * Math.cos(arm + 0.15), -0.34 * Math.sin(arm) - 0.15 * Math.sin(arm + 0.15), 0.12, 0.30, 0.13, arm + 0.15);
        part(side * 0.12, 0.88 - 0.21 * Math.cos(step), -0.21 * Math.sin(step), 0.18, 0.42, 0.20, step);
        const knee = step + Math.min(0, -step) * 0.6;
        part(side * 0.12, 0.88 - 0.42 * Math.cos(step) - 0.19 * Math.cos(knee), -0.42 * Math.sin(step) - 0.19 * Math.sin(knee), 0.16, 0.38, 0.18, knee);
        part(side * 0.12, 0.08, -0.045, 0.19, 0.13, 0.29, 0);
      }
      if (npc.armed && npc.health > 0) part(0.3, 1.30, -0.63, 0.10, 0.10, 0.30, 0); else this.boxes.setMatrixAt(i * this.boxesPerPerson + 14, this.hidden);
      this.dummy.position.set(0, 1.65, 0); this.dummy.scale.set(0.15, 0.195, 0.15); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix();
      this.matrix.multiplyMatrices(this.root.matrix, this.dummy.matrix); this.heads.setMatrixAt(i, this.matrix);
    }
    this.boxes.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = true;
    if (colorDirty) this.boxes.instanceColor.needsUpdate = this.heads.instanceColor.needsUpdate = true;
    // Every articulated pose fits within 2.2m of its root, including prone bodies.
    if (this.bounds.isEmpty()) this.boxes.boundingSphere.set(player, 0);
    else { this.bounds.getBoundingSphere(this.boxes.boundingSphere); this.boxes.boundingSphere.radius += 2.2; }
    this.heads.boundingSphere.copy(this.boxes.boundingSphere);
  }
}
