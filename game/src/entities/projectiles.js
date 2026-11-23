import * as THREE from '../../vendor/three.min.js';
import { walkSurfaceHeight } from '../world/terrain.js';

export class GrenadePool {
  constructor(scene, collision, onExplode) {
    this.collision = collision; this.onExplode = onExplode; this.items = Array.from({ length: 12 }, () => ({ active: false })); this.cursor = 0; this.dummy = new THREE.Object3D();
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: '#728756', metalness: 0.4, roughness: 0.5 }), 12);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false; scene.add(this.mesh); this.render();
  }
  throw(position, direction) { Object.assign(this.items[this.cursor++ % 12], { ...position, vx: direction.x * 17, vy: direction.y * 17 + 5.5, vz: direction.z * 17, timer: 2.1, active: true }); }
  update(dt) {
    for (const item of this.items) if (item.active) {
      item.timer -= dt; item.vy -= 14 * dt;
      const end = { x: item.x + item.vx * dt, y: item.y + item.vy * dt, z: item.z + item.vz * dt };
      const hit = this.collision.sweep(item, end, 0.12);
      if (hit.hits) { item.vx *= -0.35; item.vz *= -0.35; } else { item.x = end.x; item.z = end.z; }
      item.y = end.y; const floor = walkSurfaceHeight(item.x, item.z) + 0.11;
      if (item.y < floor) { item.y = floor; item.vy = Math.abs(item.vy) * 0.4; item.vx *= 0.7; item.vz *= 0.7; }
      if (item.timer <= 0) { item.active = false; this.onExplode(item); }
    }
  }
  render() {
    this.items.forEach((item, i) => { this.dummy.position.set(item.x || 0, item.y || 0, item.z || 0); this.dummy.scale.setScalar(item.active ? 1 : 0); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix); });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
