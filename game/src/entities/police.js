import { distance2D, forward, clamp } from '../core/math.js';
import { steeringToward, planRoadRoute, roadLookahead, recoverRoadObstacle } from '../systems/ai.js';
import { box } from '../render/geometry.js';
import { groundHeight } from '../world/terrain.js';

export class PoliceResponse {
  constructor(game) { this.game = game; this.cruisers = []; this.officers = []; this.blocks = []; this.spawnTimer = 0; this.planTimer = 0; this.seen = false; this.paused = false; }
  clear() {
    for (const cruiser of this.cruisers) {
      if (!cruiser.playerOwned) cruiser.active = false;
      cruiser.siren = false; cruiser.ai = null; cruiser.controls = {}; cruiser.deployed = false;
      if (cruiser.driver === 'police') cruiser.driver = null;
    }
    for (const officer of this.officers) officer.active = false;
    for (const block of this.blocks) { this.game.scene.remove(block.mesh); block.mesh.geometry.dispose(); this.game.world.collision.remove(block.solid); }
    this.blocks = []; this.officers = []; this.seen = false; this.spawnTimer = this.planTimer = 0; this.game.wanted.arrest = 0;
  }
  spawnCruiser(index) {
    const g = this.game, p = g.player, node = [...g.graph.nodes.values()].filter(node => distance2D(node, p) > 60 && distance2D(node, p) < 240).sort((a, b) => distance2D(a, p) - distance2D(b, p))[index % 3] || g.graph.nearest(p);
    let cruiser = this.cruisers.find(car => !car.playerOwned && (!car.active || car.health <= 0));
    if (!cruiser) { cruiser = g.fleet.spawn('police', node.x + 3.5, node.z + 8, 0, '#253c4c'); this.cruisers.push(cruiser); }
    const yaw = p.z < node.z ? 0 : Math.PI, x = node.x + Math.cos(yaw) * 3.5, z = node.z + index * 7 + 7;
    Object.assign(cruiser, { x, z, y: groundHeight(x, z) + 0.08, yaw, health: 100, vx: 0, vz: 0, vy: 0, speed: 0,
      steering: 0, pitch: 0, roll: 0, wheelSpin: 0, impact: 0, gear: 1, rpm: 850, tyreDamage: false, flipped: false,
      siren: true, active: true, exploded: false, driver: 'police', deployed: false, playerOwned: false, doorOpen: 0 });
    cruiser.ai = { kind: 'police', route: [], cursor: 0, goal: null, recovery: {} }; cruiser.controls = {}; cruiser.snapshot();
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
    if (!wanted.stars) { if (this.blocks.length || this.cruisers.some(car => car.active && car.ai?.kind === 'police') || this.officers.length) this.clear(); return; }
    const desired = Math.min(6, wanted.stars + 1), live = this.cruisers.filter(car => car.active && car.health > 0 && car.ai?.kind === 'police');
    if (live.length < desired && this.spawnTimer <= 0) { this.spawnCruiser(live.length); this.spawnTimer = 1.2; }
    if (wanted.stars >= 3 && !this.blocks.length) this.roadblock();
    const goal = this.planTimer <= 0 ? g.graph.nearest(p) : null;
    for (const car of this.cruisers) if (car.active && car.health > 0 && car.ai?.kind === 'police') {
      const distance = distance2D(car, p);
      const start = { x: car.x, y: car.y + 1.3, z: car.z }, end = { x: p.x, y: p.y + 1.3, z: p.z };
      const lineOfSight = distance < 155 && g.world.collision.sweep(start, end, 0.05).fraction >= 0.99;
      if (lineOfSight) this.seen = true;
      const ai = car.ai, clearance = car.config.width / 2 + 0.25;
      if (this.planTimer <= 0 && (ai.goal !== goal?.id || !ai.route.length || ai.recovery.replan)) {
        ai.route = planRoadRoute(g.graph, car, p, point => g.world.collision.sweep(start,
          { x: point.x, y: start.y, z: point.z }, clearance).fraction >= 0.99);
        ai.cursor = 0; ai.goal = goal?.id; ai.recovery.replan = false;
      }
      const follow = roadLookahead(car, ai.route, Math.min(34, Math.max(23, p.speed + 6)), ai.cursor); ai.cursor = follow.cursor;
      car.controls = follow.controls;
      // Visibility is a sensing ray, not permission to cut a narrow corner.
      // Close-range ramming requires clearance for the full cruiser width.
      if (lineOfSight && distance < 24 && g.world.collision.sweep(start, end, clearance).fraction >= 0.99) {
        car.controls = steeringToward(car, p, distance < 8 ? 5 : 20);
      }
      const f = forward(car.yaw), reach = clamp(6 + car.config.length / 2 + car.speed ** 2 / 36, 10, 38);
      const origin = { x: car.x, y: car.y + 0.8, z: car.z };
      const ray = g.world.collision.sweep(origin, { x: car.x + f.x * reach, y: origin.y, z: car.z + f.z * reach }, clearance);
      if (ray.hits) { car.controls.throttle = 0; car.controls.brake = Math.max(car.controls.brake, ray.fraction < 0.35 ? 1 : 0.65); }
      const rear = g.world.collision.sweep(origin, { x: car.x - f.x * 7, y: origin.y, z: car.z - f.z * 7 }, clearance);
      car.controls = recoverRoadObstacle(ai.recovery, car, dt, Boolean(ray.hits) || !ai.route.length, rear.fraction >= 0.99, car.controls);
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
