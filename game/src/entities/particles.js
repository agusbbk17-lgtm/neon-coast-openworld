import * as THREE from '../../vendor/three.min.js';
import { Random } from '../core/rng.js';

export class ParticlePool {
  constructor(scene, seed, capacity = 300) {
    this.rng = new Random(seed + ':particles'); this.items = Array.from({ length: capacity }, () => ({ life: 0 })); this.cursor = 0; this.dummy = new THREE.Object3D();
    const geometry = new THREE.SphereGeometry(1, 6, 4);
    this.sparks = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: '#ffd289', transparent: true, opacity: 0.9, depthWrite: false }), capacity);
    this.smoke = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#8c9795', roughness: 1, transparent: true, opacity: 0.22, depthWrite: false }), capacity);
    this.sparks.frustumCulled = this.smoke.frustumCulled = false; scene.add(this.sparks, this.smoke);
    this.tracers = Array.from({ length: 48 }, () => ({ life: 0 })); this.traceCursor = 0;
    this.lines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.022, 1), new THREE.MeshBasicMaterial({ color: '#ffe8a4', transparent: true, opacity: 0.82 }), 48);
    this.lines.frustumCulled = false; scene.add(this.lines); this.render();
  }
  burst(point, count = 10, strength = 4, smoke = false) {
    for (let i = 0; i < count; i++) {
      const item = this.items[this.cursor++ % this.items.length], duration = smoke ? this.rng.range(1.2, 2.5) : this.rng.range(0.15, 0.6);
      Object.assign(item, { x: point.x, y: point.y, z: point.z, vx: this.rng.range(-strength, strength), vy: this.rng.range(0.5, strength), vz: this.rng.range(-strength, strength), life: duration, maxLife: duration, smoke, size: smoke ? this.rng.range(0.25, 0.8) : this.rng.range(0.03, 0.09) });
    }
  }
  tracer(start, end) { Object.assign(this.tracers[this.traceCursor++ % 48], { start: { ...start }, end: { ...end }, life: 0.06 }); }
  update(dt) {
    for (const item of this.items) if (item.life > 0) { item.life -= dt; item.x += item.vx * dt; item.y += item.vy * dt; item.z += item.vz * dt; item.vy -= (item.smoke ? -0.5 : 12) * dt; }
    for (const item of this.tracers) item.life -= dt;
  }
  render() {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i], size = item.life > 0 ? item.size * (item.smoke ? 1 + (1 - item.life / item.maxLife) * 2 : item.life / item.maxLife) : 0;
      this.dummy.position.set(item.x || 0, item.y || 0, item.z || 0); this.dummy.scale.setScalar(size); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix();
      (item.smoke ? this.smoke : this.sparks).setMatrixAt(i, this.dummy.matrix); this.dummy.scale.setScalar(0); this.dummy.updateMatrix(); (item.smoke ? this.sparks : this.smoke).setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < this.tracers.length; i++) {
      const item = this.tracers[i];
      if (item.life > 0) {
        const a = new THREE.Vector3(item.start.x, item.start.y, item.start.z), b = new THREE.Vector3(item.end.x, item.end.y, item.end.z);
        this.dummy.position.copy(a).lerp(b, 0.5); this.dummy.scale.set(1, 1, a.distanceTo(b)); this.dummy.lookAt(b);
      } else { this.dummy.scale.setScalar(0); }
      this.dummy.updateMatrix(); this.lines.setMatrixAt(i, this.dummy.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = this.smoke.instanceMatrix.needsUpdate = this.lines.instanceMatrix.needsUpdate = true;
  }
}
