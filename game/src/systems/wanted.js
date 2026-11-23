import { clamp } from '../core/math.js';

export const WANTED_THRESHOLDS = [0, 8, 24, 52, 88, 132];
export class WantedSystem {
  constructor() { this.reset(); }
  reset() { this.heat = 0; this.stars = 0; this.searching = false; this.searchLeft = 0; this.lastCrime = null; this.arrest = 0; }
  report(severity = 8, point = null) {
    if (!Number.isFinite(severity) || severity <= 0) return;
    this.heat = clamp(this.heat + severity, 0, 200);
    for (let level = 1; level <= 5; level++) if (this.heat >= WANTED_THRESHOLDS[level]) this.stars = Math.max(this.stars, level);
    this.searchLeft = 9 + this.stars * 3; this.searching = false; this.lastCrime = point;
  }
  update(dt, seen = false) {
    if (!this.stars) return;
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.25) : 0;
    if (seen) { this.searching = false; this.searchLeft = 9 + this.stars * 3; }
    else { this.searching = true; this.searchLeft = Math.max(0, this.searchLeft - dt); if (this.searchLeft === 0) this.reset(); }
  }
}
