import { CITY } from '../data/city.js';
import { walkSurfaceHeight } from '../world/terrain.js';

export class RespawnSystem {
  constructor(game) { this.game = game; this.phase = null; this.timer = 0; }
  start(label = 'WASTED') {
    if (this.phase) return; const g = this.game;
    this.phase = label; this.timer = 0; g.player.incapacitated = true; g.input.enabled = false; g.input.clear();
    g.missions?.fail(label === 'BUSTED' ? 'Caught by Solmar police.' : 'You were taken down.');
    const node = g.hud.nodes['death-screen']; node.hidden = false; node.innerHTML = `<div><h1>${label}</h1><p>${label === 'BUSTED' ? 'The city always keeps receipts.' : 'The coast gets another sunrise.'}</p><small>Returning to the Sunline…</small></div>`;
    g.audio.tone(90, 0.6, 0.09, 'sine');
  }
  update(dt) {
    const g = this.game, p = g.player; if (p.health <= 0 && !this.phase) this.start();
    if (!this.phase) return; this.timer += dt;
    if (this.timer < 3.5) return;
    if (p.vehicle) p.vehicle.driver = null;
    Object.assign(p, { vehicle: null, transition: null, incapacitated: false, health: 100, armor: 25, cash: Math.max(0, p.cash - 150), cover: null, scoped: false, aiming: false, vy: 0, grounded: true });
    p.velocity.x = p.velocity.z = 0; g.wanted.reset(); g.police.clear(); g.rig.phone = g.rig.cinematic = false; g.director.active = null;
    g.teleport(CITY.spawn.x, CITY.spawn.z, CITY.spawn.yaw); p.y = walkSurfaceHeight(p.x, p.z) - 0.055; p.snapshot();
    g.hud.nodes['death-screen'].hidden = true; this.phase = null; g.input.enabled = !g.menus.isOpen; g.save();
  }
}
