import { damping, lerp } from '../core/math.js';

export class CameraCollision {
  constructor(world) { this.world = world; this.distance = 3; this.hits = 0; this.fraction = 1; }
  solve(pivot, desired, dt, immediate = false) {
    const length = Math.hypot(desired.x - pivot.x, desired.y - pivot.y, desired.z - pivot.z), hit = this.world.sweep(pivot, desired, 0.23);
    const safe = Math.max(0.04, length * hit.fraction - (hit.hits ? 0.12 : 0)); this.hits = hit.hits; this.fraction = hit.fraction;
    // Pull in immediately to guarantee safety; ease only the outward movement.
    this.distance = safe < this.distance || immediate ? safe : lerp(this.distance, safe, damping(9, dt));
    const fraction = Math.min(1, this.distance / Math.max(0.01, length));
    return { x: lerp(pivot.x, desired.x, fraction), y: lerp(pivot.y, desired.y, fraction), z: lerp(pivot.z, desired.z, fraction) };
  }
}
