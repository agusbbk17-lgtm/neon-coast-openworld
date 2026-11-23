export class FixedLoop {
  constructor(update, render) {
    this.update = update; this.render = render; this.step = 1 / 60;
    this.accumulator = 0; this.last = 0; this.running = false; this.paused = false;
    this.timeScale = 1; this.frame = this.frame.bind(this);
    document.addEventListener('visibilitychange', () => { this.last = 0; this.accumulator = 0; });
  }
  start() { if (this.running) return; this.running = true; requestAnimationFrame(this.frame); }
  frame(now) {
    if (!this.running) return;
    const elapsed = this.last ? (now - this.last) / 1000 : this.step;
    const dt = Math.min(0.1, elapsed); this.last = now;
    if (!document.hidden) {
      this.beforeFrame?.(dt);
      if (!this.paused) {
        this.accumulator += dt * this.timeScale; let steps = 0;
        while (this.accumulator >= this.step && steps < 6) { this.update(this.step); this.accumulator -= this.step; steps++; }
        if (steps === 6) this.accumulator %= this.step;
      }
      this.render(this.paused ? 1 : this.accumulator / this.step, dt, elapsed);
    }
    requestAnimationFrame(this.frame);
  }
}
