import * as THREE from '../../vendor/three.min.js';
import { Random } from '../core/rng.js';

export class CinematicVehicleCamera {
  constructor(seed) { this.rng = new Random(seed + ':cinematic'); this.index = 0; this.elapsed = 0; this.duration = 4; this.anchor = null; this.enabled = false; }
  frame(vehicle, input, dt) {
    const first = !this.enabled; this.enabled = true; this.elapsed += dt;
    let cut = first;
    if (this.elapsed > this.duration && Math.abs(input.axes().x) < 0.3) { this.index = (this.index + 1) % 4; this.elapsed = 0; this.duration = this.rng.range(3, 6); this.anchor = null; cut = true; }
    const p = vehicle.rendered, f = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) }, r = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
    const offset = this.index === 0 ? [0, 1.07, vehicle.config.length * 0.43]
      : this.index === 1 ? [-1.6, 0.55, vehicle.config.length * 0.75]
      : this.index === 2 ? [vehicle.config.width / 2 + 0.45, 0.6, -vehicle.config.length * 0.22]
      : [8, 0.45, 18];
    const desired = new THREE.Vector3(p.x + r.x * offset[0] + f.x * offset[2], p.y + offset[1], p.z + r.z * offset[0] + f.z * offset[2]);
    if (this.index === 3) { if (!this.anchor) this.anchor = desired.clone(); desired.copy(this.anchor); }
    const target = this.index === 0 || this.index === 2 ? new THREE.Vector3(p.x + f.x * 15, p.y + 0.9, p.z + f.z * 15)
      : new THREE.Vector3(p.x, p.y + 0.65, p.z);
    return { pivot: new THREE.Vector3(p.x, p.y + 0.9, p.z), desired, target, fov: this.index === 3 ? 48 : 65, mode: 'cinematic', forceCut: cut };
  }
  reset() { this.enabled = false; this.elapsed = 0; this.anchor = null; }
}
