export class CoverSystem {
  constructor(game) { this.game = game; }
  handle(input) {
    const player = this.game.player; if (player.vehicle || !input.take('KeyC')) return;
    if (player.cover) { player.cover = null; player.crouched = false; return; }
    player.crouched = !player.crouched;
    let nearest = null, distance = 1.3;
    for (const box of this.game.world.collision.query(player.x - 1.5, player.z - 1.5, player.x + 1.5, player.z + 1.5)) {
      if (box.max.y < player.y + 1) continue;
      const x = Math.max(box.min.x, Math.min(box.max.x, player.x)), z = Math.max(box.min.z, Math.min(box.max.z, player.z)), d = Math.hypot(x - player.x, z - player.z);
      if (d < distance) { distance = d; nearest = { box, normal: { x: (player.x - x) / Math.max(d, 0.01), z: (player.z - z) / Math.max(d, 0.01) } }; }
    }
    if (nearest) player.cover = nearest;
  }
  update(input) { if (this.game.player.cover && (input.down('ShiftLeft') || Math.abs(input.axes().z) > 0.5)) { this.game.player.cover = null; this.game.player.crouched = false; } }
}
