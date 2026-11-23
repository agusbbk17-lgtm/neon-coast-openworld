import { VEHICLE_TYPES, PAINT_COLORS } from '../data/vehicles.js';
import { createVehicleModel } from './vehicle-model.js';
import { Random } from '../core/rng.js';
import { distance2D, interpolateTransform, lerp, smoothstep } from '../core/math.js';
import { integrateVehicle, resolveVehiclePair } from '../systems/vehicle-physics.js';
import { groundHeight } from '../world/terrain.js';

export class Vehicle {
  constructor(id, type, x, z, yaw, paint, scene, world) {
    this.id = id; this.type = type; this.config = VEHICLE_TYPES[type]; this.x = x; this.z = z; this.y = groundHeight(x, z) + 0.08; this.yaw = yaw;
    this.previous = { x, y: this.y, z, yaw }; this.rendered = { ...this.previous }; this.vx = this.vz = this.vy = 0;
    this.speed = this.steering = this.pitch = this.roll = this.wheelSpin = this.impact = 0; this.health = 100; this.gear = 1; this.rpm = 850;
    this.driver = null; this.doorOpen = 0; this.siren = false; this.active = true; this.ai = null; this.controls = {};
    this.model = createVehicleModel(type, this.config, paint, world.materials); this.mesh = this.model.root; scene.add(this.mesh);
  }
  snapshot() { this.previous = { x: this.x, y: this.y, z: this.z, yaw: this.yaw }; }
  render(alpha, time, night) {
    this.rendered = interpolateTransform(this.previous, this, alpha); this.mesh.position.set(this.rendered.x, this.rendered.y, this.rendered.z);
    this.mesh.rotation.y = this.rendered.yaw; this.model.animate(this, time, night);
  }
}
export class VehicleFleet {
  constructor(scene, world, player, events, notify) {
    this.scene = scene; this.world = world; this.player = player; this.events = events; this.notify = notify;
    this.vehicles = []; this.nextId = 1; this.lastEntered = null; this.enterSerial = 0;
    this.spawn('sports', 326, 355, 0, '#e79a44');
    const rng = new Random(world.seed + ':parked');
    const poses = [[310, 320], [310, 250], [329, 178], [191, 310], [71, 420], [-49, 340], [-171, 150], [329, -150]];
    Object.keys(VEHICLE_TYPES).slice(0, 8).forEach((type, i) => this.spawn(type, poses[i][0], poses[i][1], i % 2 ? Math.PI : 0, type === 'taxi' ? '#e8be55' : type === 'police' ? '#243543' : rng.pick(PAINT_COLORS)));
  }
  spawn(type, x, z, yaw = 0, paint = '#76938f') {
    const vehicle = new Vehicle(this.nextId++, type, x, z, yaw, paint, this.scene, this.world); this.vehicles.push(vehicle); return vehicle;
  }
  nearest(position = this.player, max = 6.5) {
    let nearest = null, distance = max;
    for (const vehicle of this.vehicles) if (vehicle.active && vehicle.health > 0) {
      const d = distance2D(position, vehicle); if (d < distance) { distance = d; nearest = vehicle; }
    }
    return nearest;
  }
  enter(vehicle = this.nearest(), immediate = false) {
    const player = this.player; if (!vehicle || player.vehicle || player.transition || vehicle.health <= 0) return false;
    if (vehicle.driver && vehicle.driver !== 'player') this.events.emit('carjack', { vehicle, driver: vehicle.driver });
    vehicle.ai = null; vehicle.driver = 'player'; vehicle.playerOwned = true; this.lastEntered = vehicle;
    player.aiming = false; player.crouched = false; player.cover = null;
    if (immediate) { player.vehicle = vehicle; player.x = vehicle.x; player.z = vehicle.z; player.y = vehicle.y + 0.2; player.yaw = vehicle.yaw; player.snapshot(); this.enterSerial++; this.events.emit('vehicle-enter', vehicle); return true; }
    player.transition = { mode: 'enter', vehicle, t: 0, from: { x: player.x, y: player.y, z: player.z } };
    return true;
  }
  exit() {
    const player = this.player, vehicle = player.vehicle; if (!vehicle || player.transition) return false;
    if (Math.abs(vehicle.speed) > 9) { this.notify('Slow down before getting out.'); return false; }
    const cos = Math.cos(vehicle.yaw), sin = Math.sin(vehicle.yaw);
    let point = null;
    for (const side of [-1, 1]) {
      const candidate = { x: vehicle.x + cos * side * (vehicle.config.width / 2 + 0.85), y: groundHeight(vehicle.x, vehicle.z) + 0.18,
        z: vehicle.z - sin * side * (vehicle.config.width / 2 + 0.85) };
      if (!this.world.collision.contains({ ...candidate, y: candidate.y + 0.8 }, 0.4)) { point = candidate; break; }
    }
    if (!point) { this.notify('The door is blocked. Move the vehicle.'); return false; }
    player.transition = { mode: 'exit', vehicle, t: 0, from: { x: player.x, y: player.y, z: player.z }, to: point };
    return true;
  }
  transition(dt) {
    const player = this.player, transition = player.transition; if (!transition) return;
    const vehicle = transition.vehicle; transition.t += dt; const t = smoothstep(transition.t / 0.35);
    const target = transition.mode === 'enter' ? { x: vehicle.x, y: vehicle.y + 0.20, z: vehicle.z } : transition.to;
    player.x = lerp(transition.from.x, target.x, t) + Math.sin(t * Math.PI) * Math.cos(vehicle.yaw) * 0.25;
    player.y = lerp(transition.from.y, target.y, t) + Math.sin(t * Math.PI) * 0.20;
    player.z = lerp(transition.from.z, target.z, t); player.yaw = vehicle.yaw; player.state = transition.mode;
    vehicle.doorOpen = Math.sin(t * Math.PI);
    if (transition.t >= 0.35) {
      player.vehicle = transition.mode === 'enter' ? vehicle : null; player.transition = null; vehicle.doorOpen = 0;
      if (!player.vehicle) { vehicle.driver = null; player.speed = 0; player.velocity.x = player.velocity.z = 0; }
      if (transition.mode === 'enter') this.enterSerial++;
      this.events.emit(transition.mode === 'enter' ? 'vehicle-enter' : 'vehicle-exit', vehicle);
    }
  }
  update(dt, input) {
    const player = this.player;
    if ((input.take('KeyE') || input.take('KeyF')) && !player.interacting) { if (player.vehicle) this.exit(); else this.enter(); }
    const axes = input.axes();
    for (const vehicle of this.vehicles) {
      vehicle.snapshot(); if (!vehicle.active) continue;
      let controls = vehicle.controls;
      if (vehicle === player.vehicle) {
        controls = { throttle: input.gamepad ? (input.triggerThrottle || 0) - (axes.z > 0 ? axes.z : 0) : -axes.z,
          brake: input.gamepad ? input.triggerBrake || 0 : 0, steer: axes.x, handbrake: input.down('Space') };
        if (player.transition || player.incapacitated || player.health <= 0) controls = { brake: 1 };
        if (input.take('KeyH')) this.events.emit('horn', vehicle);
        if (vehicle.flipped && input.take('KeyR')) { vehicle.flipped = false; vehicle.roll = 0; }
      }
      if (!vehicle.ai && vehicle !== player.vehicle) controls = {};
      if (distance2D(vehicle, player) < 330 || vehicle === player.vehicle || vehicle.ai) {
        const result = integrateVehicle(vehicle, controls, dt, this.world.collision, this.world.wet || 0);
        if (result.fraction < 1 && result.impact > 2) this.events.emit('impact', result.impact);
      }
    }
    const nearby = this.vehicles.filter(v => v.active && distance2D(v, player) < 160);
    for (let i = 0; i < nearby.length; i++) for (let j = i + 1; j < nearby.length; j++)
      if (distance2D(nearby[i], nearby[j]) < 7) resolveVehiclePair(nearby[i], nearby[j]);
    this.transition(dt);
    if (!player.vehicle && !player.transition) {
      for (const v of nearby) {
        const dx = player.x - v.x, dz = player.z - v.z, cos = Math.cos(v.yaw), sin = Math.sin(v.yaw);
        const x = dx * cos - dz * sin, z = -dx * sin - dz * cos;
        const px = v.config.width / 2 + 0.36 - Math.abs(x), pz = v.config.length / 2 + 0.36 - Math.abs(z);
        if (px > 0 && pz > 0 && Math.abs(player.y - v.y) < 1.2) {
          if (px < pz) { const sign = x < 0 ? -1 : 1; player.x += cos * px * sign; player.z -= sin * px * sign; }
          else { const sign = z < 0 ? -1 : 1; player.x -= sin * pz * sign; player.z -= cos * pz * sign; }
        }
      }
    }
    if (player.vehicle && !player.transition) {
      const v = player.vehicle; player.x = v.x; player.z = v.z; player.y = v.y + 0.2; player.yaw = v.yaw; player.speed = Math.abs(v.speed); player.state = 'drive';
    }
  }
  render(alpha, time) {
    for (const v of this.vehicles) { v.mesh.visible = v.active && distance2D(v, this.player) < 400; if (v.mesh.visible) v.render(alpha, time, this.world.lighting.night); }
    this.player.mesh.visible = (!this.player.vehicle || this.player.transition?.mode === 'exit') && !(this.player.transition?.mode === 'enter' && this.player.transition.t > 0.18);
  }
}
