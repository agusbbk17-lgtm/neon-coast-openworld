import * as THREE from '../../vendor/three.min.js';
import { WEAPONS } from '../data/weapons.js';
import { Random } from '../core/rng.js';
import { distance2D, forward, clamp } from '../core/math.js';
import { raySphere, rayVehicle } from './hitscan.js';
import { ParticlePool } from '../entities/particles.js';
import { GrenadePool } from '../entities/projectiles.js';
import { weaponModels } from '../entities/weapons.js';

export class CombatSystem {
  constructor(game) {
    this.game = game; this.index = 2; this.ammunition = WEAPONS.map(weapon => weapon.magazine); this.reserves = WEAPONS.map(weapon => weapon.reserve);
    this.cooldown = this.reloadTimer = this.hitTimer = this.meleeTimer = 0; this.rng = new Random(game.world.seed + ':combat');
    this.particles = new ParticlePool(game.scene, game.world.seed); this.grenades = new GrenadePool(game.scene, game.world.collision, point => this.explode(point));
    this.models = weaponModels(game.player, game.world.materials); this.decals = []; this.decalCursor = 0;
    this.decalMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.065, 7), new THREE.MeshBasicMaterial({ color: '#26323a', transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 96);
    this.decalMesh.frustumCulled = false; game.scene.add(this.decalMesh); this.dummy = new THREE.Object3D();
    this.hidden = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < 96; i++) this.decalMesh.setMatrixAt(i, this.hidden);
    this.shockwaves = []; this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 48), new THREE.MeshBasicMaterial({ color: '#ffcb7d', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; game.scene.add(this.ring);
    game.events.on('crime', ({ severity, x, z }) => game.wanted.report(severity, { x, z }));
    game.events.on('carjack', ({ vehicle }) => game.wanted.report(12, vehicle));
    game.events.on('witness-call', ({ point }) => game.wanted.report(8, point));
  }
  get current() { return WEAPONS[this.index]; }
  get ammo() { return this.ammunition[this.index]; }
  get reserve() { return this.reserves[this.index]; }
  select(index) { this.index = (index + WEAPONS.length) % WEAPONS.length; this.reloadTimer = 0; this.game.player.scoped = false; }
  reload() {
    if (this.current.magazine && this.ammo < this.current.magazine && this.reserve > 0 && !this.reloadTimer) { this.reloadTimer = this.index === 4 ? 1.7 : 1.2; this.game.audio.tone(250, 0.10, 0.04); }
  }
  update(dt, input) {
    const g = this.game, p = g.player;
    this.cooldown = Math.max(0, this.cooldown - dt); this.hitTimer = Math.max(0, this.hitTimer - dt); this.meleeTimer = Math.max(0, this.meleeTimer - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { const count = Math.min(this.current.magazine - this.ammo, this.reserve); this.ammunition[this.index] += count; this.reserves[this.index] -= count; }
    }
    for (let i = 0; i < 5; i++) if (input.take('Digit' + (i + 1))) this.select(i);
    if (input.take('BracketRight')) this.select(this.index + 1);
    if (input.wheel) this.select(this.index + Math.sign(input.wheel));
    if (input.take('KeyR')) this.reload();
    if (p.vehicle) p.aiming = input.down('Mouse2');
    p.scoped = this.current.scoped && p.aiming && !p.vehicle;
    if (input.down('Mouse0') && !this.cooldown && !this.reloadTimer && p.health > 0 && !p.incapacitated && !p.transition && !g.menus.isOpen) this.fire();
    if (this.meleeTimer > 0) p.state = 'melee';
    this.models.forEach((model, i) => { model.visible = i === this.index && !p.vehicle; });
    this.grenades.update(dt); this.particles.update(dt);
    for (const v of g.fleet.vehicles) if (v.active && v.health < 26 && v.health > 0 && distance2D(v, p) < 180) {
      v.burnTimer = (v.burnTimer || 0) + dt;
      if (v.burnTimer > 0.3) { v.burnTimer = 0; this.particles.burst({ x: v.x, y: v.y + 1.3, z: v.z - 1.2 }, 3, 0.6, true); v.health = Math.max(0, v.health - 0.3); }
    }
    for (const v of g.fleet.vehicles) if (v.active && v.health <= 0 && !v.exploded) { v.exploded = true; this.explode({ x: v.x, y: v.y + 0.6, z: v.z }, v); }
    if (this.shockwaves.length) { const wave = this.shockwaves[0]; wave.time += dt; if (wave.time > 0.6) this.shockwaves.shift(); }
  }
  fire() {
    const g = this.game, p = g.player, weapon = this.current; this.cooldown = weapon.interval;
    if (weapon.magazine && this.ammo <= 0) { this.reload(); return; }
    p.recoil = 1;
    if (weapon.kind === 'melee') {
      this.meleeTimer = 0.32; g.audio.noise(0.09, 0.07, 450);
      const targets = g.pedestrians.people.filter(npc => npc.active && npc.health > 0 && distance2D(npc, p) < weapon.range).sort((a, b) => distance2D(a, p) - distance2D(b, p));
      if (targets[0]) this.hit(targets[0], weapon.damage, { x: targets[0].x, y: targets[0].y + 1, z: targets[0].z }, false);
      return;
    }
    this.ammunition[this.index]--; let origin = g.camera.position.clone(), direction = g.camera.getWorldDirection(new THREE.Vector3());
    if (p.vehicle) {
      const facing = forward(g.rig.yaw), v = p.vehicle;
      origin = new THREE.Vector3(p.x + facing.x * v.config.length * 0.52, v.y + v.config.height * 0.72, p.z + facing.z * v.config.length * 0.52);
      direction = new THREE.Vector3(facing.x, -(g.rig.pitch - 0.12) * 0.5, facing.z).normalize();
      const hostile = g.fleet.vehicles.filter(car => car.active && car.health > 0 && car !== v && ['rival', 'police'].includes(car.ai?.kind) && distance2D(car, p) < 110)
        .find(car => direction.dot(new THREE.Vector3(car.x - origin.x, car.y + car.config.height * 0.6 - origin.y, car.z - origin.z).normalize()) > 0.985);
      if (hostile) direction.lerp(new THREE.Vector3(hostile.x - origin.x, hostile.y + hostile.config.height * 0.6 - origin.y, hostile.z - origin.z).normalize(), 0.82).normalize();
    }
    if (weapon.kind === 'grenade') { this.grenades.throw({ x: p.x, y: p.y + 1.4, z: p.z }, direction); g.wanted.report(12, p); if (!this.ammo) this.reload(); return; }
    g.wanted.report(8, p); g.events.emit('gunshot', { x: p.x, z: p.z });
    g.audio.noise(0.11, 0.21, this.index === 4 ? 600 : 1450); g.audio.tone(this.index === 4 ? 75 : 120, 0.07, 0.09, 'triangle');
    const muzzle = { x: p.x + direction.x * 0.7, y: p.y + 1.4, z: p.z + direction.z * 0.7 }; this.particles.burst(muzzle, 3, 0.4);
    for (let pellet = 0; pellet < weapon.pellets; pellet++) {
      const aim = direction.clone(); const spread = weapon.spread * (p.aiming ? 0.4 : 1.3);
      aim.x += this.rng.range(-spread, spread); aim.y += this.rng.range(-spread, spread); aim.z += this.rng.range(-spread, spread); aim.normalize();
      if (g.input.gamepad && p.aiming) {
        const assist = g.pedestrians.people.find(npc => npc.active && npc.faction !== 'civilian' && npc.health > 0 && distance2D(npc, p) < 60 && aim.dot(new THREE.Vector3(npc.x - origin.x, npc.y + 1.1 - origin.y, npc.z - origin.z).normalize()) > 0.995);
        if (assist) aim.lerp(new THREE.Vector3(assist.x - origin.x, assist.y + 1.1 - origin.y, assist.z - origin.z).normalize(), 0.3).normalize();
      }
      this.trace(origin, aim, weapon.range, weapon.damage, muzzle);
    }
  }
  trace(origin, direction, range, damage, muzzle = origin) {
    const g = this.game, end = origin.clone().addScaledVector(direction, range), wall = g.world.collision.sweep(origin, end, 0.015);
    let nearest = wall.fraction * range, target = null, headshot = false;
    for (const npc of g.pedestrians.people) if (npc.active && npc.health > 0) {
      const head = raySphere(origin, direction, { x: npc.x, y: npc.y + 1.65, z: npc.z }, 0.20, nearest);
      const body = raySphere(origin, direction, { x: npc.x, y: npc.y + 1.0, z: npc.z }, 0.48, nearest);
      const t = head ?? body;
      if (t !== null && t < nearest) { nearest = t; target = npc; headshot = head !== null; }
    }
    for (const vehicle of g.fleet.vehicles) if (vehicle.active && vehicle !== g.player.vehicle) {
      const t = rayVehicle(origin, direction, vehicle, nearest); if (t !== null && t < nearest) { nearest = t; target = vehicle; headshot = false; }
    }
    const point = origin.clone().addScaledVector(direction, nearest); this.particles.tracer(muzzle, point);
    if (target) this.hit(target, damage, point, headshot);
    else if (wall.hits) {
      this.particles.burst(point, 5, 2); const box = wall.solid;
      const faces = [['x', box.min.x, -1], ['x', box.max.x, 1], ['y', box.min.y, -1], ['y', box.max.y, 1], ['z', box.min.z, -1], ['z', box.max.z, 1]];
      const face = faces.sort((a, b) => Math.abs(point[a[0]] - a[1]) - Math.abs(point[b[0]] - b[1]))[0];
      const normal = new THREE.Vector3(); normal[face[0]] = face[2]; this.dummy.position.copy(point).addScaledVector(normal, 0.03); this.dummy.scale.set(1, 1, 1); this.dummy.lookAt(point.clone().add(normal)); this.dummy.updateMatrix();
      this.decalMesh.setMatrixAt(this.decalCursor++ % 96, this.dummy.matrix); this.decalMesh.instanceMatrix.needsUpdate = true;
    }
    return { target, point, headshot };
  }
  hit(target, amount, point, headshot) {
    const g = this.game; this.hitTimer = 0.16; this.particles.burst(point, 7, 1.8);
    if (target.config) {
      target.health = Math.max(0, target.health - amount * 0.65); if (point.y - target.y < 0.7) target.tyreDamage = true;
    } else {
      const damage = amount * (headshot ? 2.2 : 1), armor = Math.min(target.armor, damage * 0.5); target.armor -= armor;
      target.health = Math.max(0, target.health - damage + armor);
      g.wanted.report(target.faction === 'civilian' ? 15 : target.faction === 'rival' ? 2 : 20, target);
      if (target.health <= 0) { g.player.cash += target.faction === 'rival' ? 90 : 0; g.events.emit('kill', { target, point, headshot }); }
    }
    g.events.emit('damage', { target, amount, point });
  }
  explode(point, source = null) {
    const g = this.game; this.particles.burst(point, 55, 10); this.particles.burst(point, 22, 3, true); this.shockwaves.push({ ...point, time: 0 });
    g.events.emit('explosion', point); g.audio.noise(0.5, 0.35, 350); g.rig.trauma = Math.min(1, 12 / Math.max(1, distance2D(point, g.player)));
    if (!source || source.driver === 'player' || source.ai?.kind === 'rival') g.wanted.report(20, point);
    const distance = distance2D(point, g.player); if (distance < 9) g.player.damage(80 * (1 - distance / 9));
    for (const npc of g.pedestrians.people) if (npc.active && npc.health > 0 && distance2D(npc, point) < 9) this.hit(npc, 95 * (1 - distance2D(npc, point) / 9), point, false);
    for (const car of g.fleet.vehicles) if (car !== source && car.active && distance2D(car, point) < 10) { car.health = Math.max(0, car.health - 80 * (1 - distance2D(car, point) / 10)); }
  }
  render() {
    this.particles.render(); this.grenades.render();
    this.ring.visible = Boolean(this.shockwaves.length);
    if (this.ring.visible) { const wave = this.shockwaves[0]; this.ring.position.set(wave.x, 0.12, wave.z); this.ring.scale.setScalar(0.2 + wave.time * 24); this.ring.material.opacity = 0.5 * (1 - wave.time / 0.6); }
  }
}
