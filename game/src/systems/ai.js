import { clamp, angleDelta, heading } from '../core/math.js';

export class AIScheduler {
  constructor(interval = 0.06, budget = 6) { this.interval = interval; this.budget = budget; this.elapsed = 0; this.cursor = 0; }
  update(dt, items, callback) {
    this.elapsed += dt; if (this.elapsed < this.interval || !items.length) return; this.elapsed %= this.interval;
    for (let i = 0; i < Math.min(this.budget, items.length); i++) { const item = items[this.cursor++ % items.length]; callback(item); }
  }
}
export function steeringToward(vehicle, point, targetSpeed) {
  const desired = heading(point.x - vehicle.x, point.z - vehicle.z), error = angleDelta(vehicle.yaw, desired);
  const desiredSpeed = targetSpeed * clamp(1 - Math.abs(error) * 0.38, 0.35, 1);
  return { steer: clamp(-error * 2.3, -1, 1), throttle: vehicle.speed < desiredSpeed ? 0.85 : 0,
    brake: vehicle.speed > desiredSpeed + 1.5 ? 0.3 : 0, handbrake: false };
}
