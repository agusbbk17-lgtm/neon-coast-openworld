import { CITY } from '../data/city.js';

export class FullMap {
  constructor(game, minimap) { this.game = game; this.minimap = minimap; }
  attach(canvas) {
    this.canvas = canvas;
    canvas.addEventListener('click', event => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * CITY.size - 750;
      const z = (event.clientY - rect.top) / rect.height * CITY.size - 750;
      this.game.setWaypoint({ x, z }); this.render(); this.game.notify('Waypoint set. Follow the gold GPS route.');
    });
    this.render();
  }
  render() {
    if (!this.canvas) return;
    const c = this.canvas, ctx = c.getContext('2d', { willReadFrequently: true }), scale = c.width / CITY.size;
    ctx.drawImage(this.minimap.base, 0, 0, c.width, c.height);
    if (this.game.route?.length) {
      ctx.strokeStyle = '#ffcb70'; ctx.lineWidth = 3; ctx.beginPath();
      this.game.route.forEach((point, i) => { const x = (point.x + 750) * scale, y = (point.z + 750) * scale; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
    }
    for (const landmark of CITY.landmarks) {
      const x = (landmark.x + 750) * scale, z = (landmark.z + 750) * scale;
      ctx.fillStyle = '#f4e9ce'; ctx.font = 'bold 11px system-ui'; ctx.fillText(landmark.name, x + 7, z - 3);
      ctx.fillStyle = '#8be7d0'; ctx.fillRect(x - 3, z - 3, 6, 6);
    }
    const p = this.game.player; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc((p.x + 750) * scale, (p.z + 750) * scale, 6, 0, Math.PI * 2); ctx.fill();
    if (this.game.waypoint) { const q = this.game.waypoint; ctx.strokeStyle = '#ffcb70'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc((q.x + 750) * scale, (q.z + 750) * scale, 8, 0, Math.PI * 2); ctx.stroke(); }
  }
}
