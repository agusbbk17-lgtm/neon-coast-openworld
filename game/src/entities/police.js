import { distance2D, forward } from '../core/math.js';
import { steeringToward } from '../systems/ai.js';
import { box } from '../render/geometry.js';

export class PoliceResponse {
  constructor(game) { this.game = game; this.cruisers = []; this.officers = []; this.blocks = []; this.spawnTimer = 0; this.planTimer = 0; this.seen = false; this.paused = false; }
  clear() {
    for (const cruiser of this.cruisers) { if (!cruiser.playerOwned) cruiser.active = false; cruiser.siren = false; cruiser.ai = null; }
    for (const officer of this.officers) officer.active = false;
    for (const block of this.blocks) { this.game.scene.remove(block.mesh); block.mesh.geometry.dispose(); this.game.world.collision.remove(block.solid); }
    this.blocks = []; this.officers = []; this.seen = false;
  }
  spawnCruiser(index) {
    const g = this.game, p = g.player, node = [...g.graph.nodes.values()].filter(node => distance2D(node, p) > 60 && distance2D(node, p) < 240).sort((a, b) => distance2D(a, p) - distance2D(b, p))[index % 3] || g.graph.nearest(p);
    let cruiser = this.cruisers.find(car => !car.active);
    if (!cruiser) { cruiser = g.fleet.spawn('police', node.x + 3.5, node.z + 8, 0, '#253c4c'); this.cruisers.push(cruiser); }
    Object.assign(cruiser, { x: node.x + 3.5, z: node.z + index * 7 + 7, health: 100, vx: 0, vz: 0, speed: 0, siren: true, active: true, exploded: false, driver: 'police', deployed: false });
    cruiser.ai = { kind: 'police', route: [] }; cruiser.snapshot();
    return cruiser;
  }
  roadblock() {
    const g = this.game, p = g.player, node = g.graph.nearest({ x: p.x, z: p.z - 100 });
    for (const side of [-1, 1]) {
      const x = node.x + side * 6.5, z = node.z - 20;
      const mesh = box(4.3, 0.85, 1, g.world.materials.yellow, x, 0.47, z); g.scene.add(mesh);
      const solid = g.world.collision.add(x, 0.47, z, 4.3, 0.85, 1, 'roadblock'); this.blocks.push({ mesh, solid });
    }
  }
  update(dt) {
    if (this.paused) return;
    const g = this.game, wanted = g.wanted, p = g.player; this.spawnTimer -= dt; this.planTimer -= dt; this.seen = false;
    if (!wanted.stars) { if (this.blocks.length || this.cruisers.some(car => car.active) || this.officers.length) this.clear(); return; }
    const desired = Math.min(6, wanted.stars + 1), live = this.cruisers.filter(car => car.active && car.health > 0 && car.ai?.kind === 'police');
    if (live.length < desired && this.spawnTimer <= 0) { this.spawnCruiser(live.length); this.spawnTimer = 1.2; }
    if (wanted.stars >= 3 && !this.blocks.length) this.roadblock();
    for (const car of this.cruisers) if (car.active && car.health > 0 && car.ai) {
      const distance = distance2D(car, p);
      const start = { x: car.x, y: car.y + 1.3, z: car.z }, end = { x: p.x, y: p.y + 1.3, z: p.z };
      const lineOfSight = distance < 155 && g.world.collision.sweep(start, end, 0.05).fraction >= 0.99;
      if (lineOfSight) this.seen = true;
      if (this.planTimer <= 0) car.ai.route = g.graph.path(car, p);
      let target = { x: p.x, z: p.z };
      if (!lineOfSight && car.ai.route.length > 1) {
        while (car.ai.route.length > 1 && distance2D(car, car.ai.route[0]) < 20) car.ai.route.shift();
        const node = car.ai.route[0]; target = { x: node.x + 3.5, z: node.z };
      }
      car.controls = steeringToward(car, target, distance < 8 ? 5 : Math.min(34, Math.max(23, p.speed + 6)));
      const f = forward(car.yaw), ray = g.world.collision.sweep({ x: car.x, y: car.y + 0.8, z: car.z }, { x: car.x + f.x * 10, y: car.y + 0.8, z: car.z + f.z * 10 }, 0.55);
      if (ray.hits) { car.controls.brake = 0.8; car.controls.steer = Math.sin(g.time) > 0 ? 1 : -1; }
      if (distance < 38 && !car.deployed && (!p.vehicle || Math.abs(p.vehicle.speed) < 6)) {
        car.deployed = true;
        for (const side of [-1, 1]) { const officer = g.pedestrians.spawn(car.x + side * 2.2, car.z + 1, wanted.stars >= 4 ? 'swat' : 'police'); if (officer) this.officers.push(officer); }
      }
    }
    if (this.planTimer <= 0) this.planTimer = 0.7;
    for (const npc of g.pedestrians.people) if (npc.active && npc.health > 0 && npc.armed) {
      npc.shotTimer -= dt; const distance = distance2D(npc, p);
      if (distance < 90 && npc.faction !== 'rival' && g.world.collision.sweep({ x: npc.x, y: npc.y + 1.5, z: npc.z }, { x: p.x, y: p.y + 1.4, z: p.z }, 0.02).fraction > 0.99) this.seen = true;
      if (npc.shotTimer <= 0 && distance < 48 && !p.incapacitated && g.world.collision.sweep({ x: npc.x, y: npc.y + 1.3, z: npc.z }, { x: p.x, y: p.y + 1.2, z: p.z }, 0.03).fraction > 0.99) {
        npc.shotTimer = npc.faction === 'swat' ? 0.6 : 1.25;
        g.combat.particles.tracer({ x: npc.x, y: npc.y + 1.4, z: npc.z }, { x: p.x, y: p.y + 1.2, z: p.z });
        g.audio.noise(0.065, 0.08, 1200);
        if (g.combat.rng.next() < 0.6) p.damage(npc.faction === 'swat' ? 9 : 7);
      }
    }
    const closeOfficer = this.officers.some(npc => npc.active && npc.health > 0 && distance2D(npc, p) < 2.5);
    wanted.arrest = closeOfficer && p.speed < 0.7 && !p.aiming && !g.input.down('Mouse0') ? wanted.arrest + dt : 0;
    if (wanted.arrest > 2.5) g.death.start('BUSTED');
    wanted.update(dt, this.seen);
  }
}
