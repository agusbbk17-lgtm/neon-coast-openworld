import { CITY } from '../data/city.js';

export class Minimap {
  constructor(canvas, game) {
    this.canvas = canvas; this.game = game; this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.base = document.createElement('canvas'); this.base.width = this.base.height = 768;
    const ctx = this.base.getContext('2d', { willReadFrequently: true }), scale = 768 / CITY.size;
    ctx.fillStyle = '#294445'; ctx.fillRect(0, 0, 768, 768);
    ctx.fillStyle = '#357482'; ctx.fillRect((CITY.shore + 750) * scale, 0, 768, 768);
    ctx.fillStyle = '#888475'; ctx.fillRect((350 + 750) * scale, 0, 35 * scale, 768);
    ctx.fillStyle = '#52656a';
    for (const b of game.world.buildings) ctx.fillRect((b.x - b.width / 2 + 750) * scale, (b.z - b.depth / 2 + 750) * scale, b.width * scale, b.depth * scale);
    ctx.strokeStyle = '#c1c6b6'; ctx.lineWidth = CITY.roadWidth * scale;
    for (const x of CITY.streetsX) { ctx.beginPath(); ctx.moveTo((x + 750) * scale, 0); ctx.lineTo((x + 750) * scale, 768); ctx.stroke(); }
    for (const z of CITY.streetsZ) { ctx.beginPath(); ctx.moveTo(25, (z + 750) * scale); ctx.lineTo((345 + 750) * scale, (z + 750) * scale); ctx.stroke(); }
    ctx.fillStyle = '#60866b'; ctx.fillRect(175, 537, 45, 50);
  }
  render() {
    const { game, ctx, canvas } = this, p = game.player, width = canvas.width, height = canvas.height, zoom = p.vehicle ? 0.56 : 0.9;
    ctx.clearRect(0, 0, width, height); ctx.save(); ctx.translate(width / 2, height * 0.62); ctx.rotate(game.rig.yaw);
    ctx.translate(-p.x * zoom, -p.z * zoom);
    const scale = zoom * CITY.size / 768; ctx.drawImage(this.base, -750 * zoom, -750 * zoom, 768 * scale, 768 * scale);
    if (game.route?.length) {
      ctx.strokeStyle = '#ffcf77'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x * zoom, p.z * zoom);
      for (const point of game.route) ctx.lineTo(point.x * zoom, point.z * zoom); ctx.stroke();
    }
    for (const v of game.fleet.vehicles) if (v.active && v !== p.vehicle) {
      ctx.fillStyle = v.type === 'police' && v.siren ? (Math.sin(game.time * 12) > 0 ? '#ff727a' : '#84c7ff') : '#e3daca';
      ctx.fillRect(v.x * zoom - 2, v.z * zoom - 2, 4, 4);
      if (v.siren && game.wanted?.stars) { ctx.fillStyle = '#7bb9ff30'; ctx.beginPath(); ctx.moveTo(v.x * zoom, v.z * zoom); ctx.arc(v.x * zoom, v.z * zoom, 38, -v.yaw - Math.PI / 2 - 0.4, -v.yaw - Math.PI / 2 + 0.4); ctx.fill(); }
    }
    for (const landmark of CITY.landmarks) { ctx.fillStyle = '#8edaca'; ctx.beginPath(); ctx.arc(landmark.x * zoom, landmark.z * zoom, 3.5, 0, Math.PI * 2); ctx.fill(); }
    if (game.waypoint) { ctx.strokeStyle = '#ffcf77'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(game.waypoint.x * zoom, game.waypoint.z * zoom, 7, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore(); ctx.save(); ctx.translate(width / 2, height * 0.62); ctx.rotate(game.rig.yaw - p.yaw);
    ctx.fillStyle = '#f6f0db'; ctx.strokeStyle = '#102f32'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#e3d5ad'; ctx.font = 'bold 11px system-ui'; ctx.fillText('N', 12, 19);
  }
}
