import { Random } from '../core/rng.js';
import { distance2D, heading, forward } from '../core/math.js';
import { VEHICLE_TYPES, PAINT_COLORS } from '../data/vehicles.js';
import { AIScheduler, steeringToward } from './ai.js';

export class Traffic {
  constructor(game, signals) {
    this.game = game; this.signals = signals; this.rng = new Random(game.world.seed + ':traffic');
    this.scheduler = new AIScheduler(0.05, 8); this.cars = []; this.paused = false;
    const nodes = [...game.graph.nodes.values()], civilian = Object.keys(VEHICLE_TYPES).filter(type => type !== 'police');
    for (let i = 0; i < 28; i++) {
      const node = i < 13 ? game.graph.nodes.get(`8:${i % 10}`) : this.rng.pick(nodes);
      const edge = i < 13 ? node.edges.find(edge => edge.to.startsWith('8:')) || node.edges[0] : this.rng.pick(node.edges);
      const next = game.graph.nodes.get(edge.to), t = this.rng.range(0.15, 0.82), dx = next.x - node.x, dz = next.z - node.z, length = Math.hypot(dx, dz);
      const x = node.x + dx * t - dz / length * 3.5, z = node.z + dz * t + dx / length * 3.5;
      const type = this.rng.pick(civilian), car = game.fleet.spawn(type, x, z, heading(dx, dz), type === 'taxi' ? '#efc358' : this.rng.pick(PAINT_COLORS));
      car.driver = 'civilian'; car.ai = { kind: 'traffic', from: node, to: next, last: null, targetSpeed: this.rng.range(9, 15), panic: 0, stuck: 0 };
      this.cars.push(car);
    }
    const showcase = [
      { x: 323.5, z: 334, from: '8:8', to: '8:7', yaw: 0 },
      { x: 316.5, z: 319, from: '8:7', to: '8:8', yaw: Math.PI },
      { x: 323.5, z: 300, from: '8:8', to: '8:7', yaw: 0 },
    ];
    showcase.forEach((pose, i) => { const car = this.cars[i]; Object.assign(car, { x: pose.x, z: pose.z, yaw: pose.yaw }); car.snapshot(); car.ai.from = game.graph.nodes.get(pose.from); car.ai.to = game.graph.nodes.get(pose.to); });
    game.events.on('gunshot', point => { for (const car of this.cars) if (car.ai && distance2D(car, point) < 120) car.ai.panic = 7; });
    game.events.on('explosion', point => { for (const car of this.cars) if (car.ai && distance2D(car, point) < 180) car.ai.panic = 10; });
  }
  think(car) {
    if (!car.active || !car.ai || car.ai.kind !== 'traffic') return;
    const g = this.game, ai = car.ai, dir = { x: ai.to.x - ai.from.x, z: ai.to.z - ai.from.z }, length = Math.hypot(dir.x, dir.z);
    const destination = { x: ai.to.x - dir.z / length * 3.5, z: ai.to.z + dir.x / length * 3.5 };
    if (distance2D(car, destination) < 8) {
      const choices = ai.to.edges.filter(edge => edge.to !== ai.from.id); const edge = this.rng.pick(choices.length ? choices : ai.to.edges);
      ai.last = ai.from; ai.from = ai.to; ai.to = g.graph.nodes.get(edge.to); return;
    }
    const toSignal = distance2D(car, ai.to), red = toSignal < 28 && !this.signals.green(ai.to, dir) && ai.panic <= 0;
    let speed = ai.panic > 0 ? 23 : ai.targetSpeed;
    if (red) speed = toSignal > 16 ? Math.min(speed, (toSignal - 15) * 0.55) : 0;
    const f = forward(car.yaw), bumper = { x: car.x + f.x * car.config.length / 2, y: car.y + 0.65, z: car.z + f.z * car.config.length / 2 };
    const rayLength = 5 + Math.abs(car.speed) * 0.65;
    const ray = g.world.collision.sweep(bumper, { x: bumper.x + f.x * rayLength, y: bumper.y, z: bumper.z + f.z * rayLength }, car.config.width * 0.4);
    if (ray.fraction < 1) speed = Math.min(speed, rayLength * ray.fraction * 0.5);
    for (const other of g.fleet.vehicles) {
      if (other === car || !other.active) continue;
      const dx = other.x - car.x, dz = other.z - car.z, along = dx * f.x + dz * f.z, side = Math.abs(dx * -f.z + dz * f.x);
      if (along > 0 && along < rayLength + 4 && side < (car.config.width + other.config.width) / 2 + 0.25) speed = Math.min(speed, Math.max(0, (along - 5) * 0.7));
    }
    if (!g.player.vehicle && distance2D(car, g.player) < 8) speed = 0;
    const controls = steeringToward(car, destination, speed);
    if (speed < 0.2) { controls.throttle = 0; controls.brake = 1; }
    car.controls = controls;
  }
  update(dt) {
    if (this.paused) return;
    this.signals.clock = this.game.time;
    for (const car of this.cars) if (car.ai) { car.ai.panic = Math.max(0, car.ai.panic - dt); }
    this.scheduler.update(dt, this.cars, car => this.think(car));
  }
}
