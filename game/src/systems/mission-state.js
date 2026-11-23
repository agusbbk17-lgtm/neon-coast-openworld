import { distance2D, clamp } from '../core/math.js';

export class MissionStateMachine {
  constructor() { this.cancel(); }
  cancel() { this.definition = null; this.state = 'idle'; this.index = 0; this.elapsed = 0; this.stepTime = 0; this.progress = 0; this.checkpoint = 0; this.reason = ''; this.baselineEntry = 0; }
  start(definition, context = {}, skipIntro = false) {
    this.cancel(); this.definition = definition; this.state = skipIntro ? 'active' : 'intro'; this.introLeft = 4.5; this.baselineEntry = context.enterSerial || 0;
  }
  get step() { return this.definition?.steps[this.index] || null; }
  fail(reason) { if (this.state === 'active' || this.state === 'intro') { this.state = 'failed'; this.reason = reason; } }
  retry(context = {}) {
    if (!this.definition) return;
    this.index = Math.min(this.checkpoint, this.definition.steps.length - 1); this.state = 'active'; this.stepTime = this.progress = 0; this.reason = ''; this.baselineEntry = context.enterSerial || 0;
  }
  update(dt, context) {
    if (!this.definition || !['active', 'intro'].includes(this.state)) return;
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.25) : 0;
    if (context.dead) { this.fail('You were taken down.'); return; }
    if (this.state === 'intro') { this.introLeft -= dt; if (this.introLeft <= 0) this.state = 'active'; return; }
    this.elapsed += dt; this.stepTime += dt; const step = this.step;
    if (step.limit && this.stepTime > step.limit) { this.fail('Time ran out.'); return; }
    const target = step.dynamic ? context.target : step.target, near = target && distance2D(context.player, target) < (step.radius || 10);
    let complete = false;
    switch (step.type) {
      case 'goto': case 'timed': complete = near; break;
      case 'enter': complete = context.inVehicle && (!step.newEntry || context.enterSerial > this.baselineEntry); break;
      case 'deliver': complete = near && context.inVehicle && Math.abs(context.speed || 0) < 6; break;
      case 'chase': complete = context.inVehicle && (near || context.targetHealth <= 0); break;
      case 'destroy': complete = context.targetHealth <= 0; break;
      case 'escape': complete = context.wanted === 0; break;
      case 'survive': complete = this.stepTime >= step.duration && !context.dead; break;
      case 'interact':
        this.progress = near && !context.inVehicle && context.interact ? this.progress + dt : Math.max(0, this.progress - dt * 0.5);
        complete = this.progress >= step.duration; break;
      default: this.fail('Unknown mission objective.'); return;
    }
    if (complete) {
      if (step.checkpoint) this.checkpoint = this.index + 1;
      this.index++; this.stepTime = this.progress = 0;
      if (this.index >= this.definition.steps.length) this.state = 'complete';
    }
  }
}
