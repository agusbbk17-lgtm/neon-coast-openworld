import { Random } from '../core/rng.js';
import { damping, dampAngle, distance2D, heading } from '../core/math.js';
import { createSidewalkGraph } from '../world/sidewalks.js';
import { CrowdRenderer } from './crowd-renderer.js';
import { walkSurfaceHeight } from '../world/terrain.js';

export class Pedestrians {
  constructor(game, signals) {
    this.game = game; this.signals = signals; this.graph = createSidewalkGraph(); this.rng = new Random(game.world.seed + ':pedestrians'); this.people = [];
    this.renderer = new CrowdRenderer(game.scene, game.world.materials); this.nextId = 1;
    const nodes = [...this.graph.nodes.values()];
    for (let i = 0; i < 56; i++) {
      const node = i < 18 ? this.graph.nodes.get(`8:${i % 10}:${i % 2 ? 1 : 2}`) : this.rng.pick(nodes);
      this.spawn(node.x, node.z, 'civilian', node);
    }
    for (const [x, z] of [[335, 343], [342, 354], [335, 324], [306.1, 339], [306.1, 362], [354, 308]]) {
      const person = this.spawn(x, z); person.target = person.node; person.wait = this.rng.range(0.1, 0.6);
    }
    game.events.on('gunshot', point => this.frighten(point, 100)); game.events.on('explosion', point => this.frighten(point, 150));
    game.events.on('carjack', ({ vehicle }) => {
      this.frighten(vehicle, 35);
      const ejected = this.spawn(vehicle.x - Math.cos(vehicle.yaw) * 1.7, vehicle.z + Math.sin(vehicle.yaw) * 1.7);
      if (ejected) { ejected.fear = 7; ejected.threat = vehicle; }
    });
  }
  spawn(x, z, faction = 'civilian', node = null) {
    if (this.people.length >= this.renderer.capacity) {
      const available = this.people.find(person => !person.active); if (!available) return null; this.people.splice(this.people.indexOf(available), 1);
    }
    const current = node || this.graph.nearest({ x, z });
    const person = { id: this.nextId++, x, z, y: walkSurfaceHeight(x, z), yaw: this.rng.range(0, 6.28), previous: { x, z },
      vx: 0, vz: 0, speed: 0, health: faction === 'civilian' ? 60 : 100, armor: faction === 'swat' ? 40 : 0,
      active: true, faction, armed: faction !== 'civilian', state: 'wander', node: current, target: null, wait: this.rng.range(0, 2), fear: 0,
      shirt: faction === 'civilian' ? this.rng.pick(['#b6d3ce', '#e4c37b', '#c46e61', '#dee4d2', '#547985', '#c6b3cc']) : '#294955',
      pants: this.rng.pick(['#3c535d', '#686763', '#b3b496']), skin: this.rng.pick(['#c58e6a', '#855d43', '#d1ac85', '#ad7255']), shotTimer: 0, deadTime: 0 };
    this.people.push(person); return person;
  }
  frighten(point, radius) {
    for (const npc of this.people) if (npc.active && npc.health > 0 && npc.faction === 'civilian' && distance2D(npc, point) < radius) {
      npc.fear = 8; npc.threat = { x: point.x, z: point.z }; npc.state = 'flee';
      if (this.rng.next() < 0.10) this.game.events.emit('witness-call', { npc, point });
    }
  }
  update(dt) {
    const g = this.game;
    for (const npc of this.people) {
      npc.previous = { x: npc.x, y: npc.y, z: npc.z, yaw: npc.yaw }; if (!npc.active) continue;
      if (npc.health <= 0) { npc.deadTime += dt; npc.y += (0.12 - npc.y) * damping(8, dt); if (npc.deadTime > 25) npc.active = false; continue; }
      npc.fear = Math.max(0, npc.fear - dt); npc.wait -= dt;
      let dx = 0, dz = 0, pace = 1.45;
      const dangerous = g.fleet.vehicles.find(car => car.active && Math.abs(car.speed) > 5 && distance2D(car, npc) < 7);
      if (dangerous && npc.faction === 'civilian') { npc.fear = 2; npc.threat = dangerous; }
      if (npc.fear > 0 && npc.threat) { dx = npc.x - npc.threat.x; dz = npc.z - npc.threat.z; pace = 4.5; npc.state = 'flee'; }
      else if (npc.faction !== 'civilian' && g.wanted?.stars) { dx = g.player.x - npc.x; dz = g.player.z - npc.z; pace = distance2D(npc, g.player) < 18 ? 0 : 3.8; npc.state = 'chase'; }
      else if (npc.wait <= 0) {
        if (!npc.target) { const edge = this.rng.pick(npc.node.edges); npc.target = this.graph.nodes.get(edge.to); }
        dx = npc.target.x - npc.x; dz = npc.target.z - npc.z;
        if (Math.hypot(dx, dz) < 0.6) { npc.node = npc.target; npc.target = null; npc.wait = this.rng.range(0.1, 1.2); }
        else {
          const a = npc.node.id.split(':'), b = npc.target.id.split(':'), crossing = a[0] === b[0] && a[1] === b[1] && a[2] !== b[2];
          if (crossing) {
            const intersection = g.graph.nodes.get(`${a[0]}:${a[1]}`), state = this.signals.state(intersection);
            const crossingAxis = Math.abs(dx) > Math.abs(dz) ? 'ns' : 'ew';
            if (state[crossingAxis] !== 'red') pace = 0;
          }
        }
        npc.state = 'wander';
      }
      const length = Math.hypot(dx, dz), targetYaw = length > 0.01 ? heading(dx, dz) : npc.yaw;
      if (length > 0.01) { dx = dx / length * pace; dz = dz / length * pace; }
      npc.vx += (dx - npc.vx) * damping(8, dt); npc.vz += (dz - npc.vz) * damping(8, dt);
      const move = g.world.collision.move(npc, npc.vx * dt, npc.vz * dt, 0.28); npc.speed = Math.hypot(move.dx, move.dz) / dt;
      if (length > 0.01) npc.yaw = dampAngle(npc.yaw, targetYaw, 8, dt);
      npc.y = walkSurfaceHeight(npc.x, npc.z);
      if (dangerous && distance2D(dangerous, npc) < 1.25 && Math.abs(dangerous.speed) > 8) {
        npc.health = 0; if (dangerous === g.player.vehicle) g.events.emit('crime', { severity: 25, x: npc.x, z: npc.z });
      }
    }
  }
  render(alpha, time = this.game.time) { this.renderer.render(this.people, this.game.player, time, alpha); }
}
