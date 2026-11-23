import { clamp } from '../core/math.js';

export const QUALITY = {
  low: { ratio: 0.65, shadow: 0, range: 440, post: false, ao: false },
  med: { ratio: 0.85, shadow: 1024, range: 530, post: true, ao: false },
  high: { ratio: 1, shadow: 2048, range: 620, post: true, ao: true },
  ultra: { ratio: 1.25, shadow: 2048, range: 700, post: true, ao: true },
};
export class QualityManager {
  constructor(renderer, preset = 'high', onChange = () => {}) {
    this.renderer = renderer; this.onChange = onChange; this.auto = true; this.overBudget = 0;
    this.stage = 0; this.adjustments = []; this.set(preset);
  }
  set(preset) {
    this.preset = QUALITY[preset] ? preset : 'high'; this.settings = { ...QUALITY[this.preset] };
    this.stage = 0; this.overBudget = 0; this.apply();
  }
  apply() {
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5) * this.settings.ratio);
    this.renderer.shadowMap.enabled = this.settings.shadow > 0; this.onChange(this.settings);
  }
  sample(milliseconds, dt) {
    if (!this.auto || !Number.isFinite(milliseconds)) return;
    const measured = Math.min(0.25, dt);
    this.overBudget = clamp(this.overBudget + (milliseconds > 20 ? measured : -measured * 0.4), 0, 5);
    if (this.overBudget >= 4) { this.degrade(); this.overBudget = 0; }
  }
  degrade() {
    if (this.settings.ratio > 0.5) { this.settings.ratio = Math.max(0.5, this.settings.ratio - 0.15); this.stage = 1; }
    else if (this.settings.shadow > 0) { this.settings.shadow = this.settings.shadow > 1024 ? 1024 : 0; this.stage = 2; }
    else if (this.settings.post) { this.settings.ao = false; this.settings.post = false; this.stage = 3; }
    else return false;
    this.adjustments.push({ stage: this.stage, ratio: this.settings.ratio, shadows: this.settings.shadow, post: this.settings.post });
    this.apply(); return true;
  }
}
