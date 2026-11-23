import * as THREE from '../../vendor/three.min.js';
import { box } from '../render/geometry.js';
import { clamp, dampAngle, damping, heading, interpolateTransform } from '../core/math.js';
import { walkSurfaceHeight } from '../world/terrain.js';
import { CITY } from '../data/city.js';

// Procedural articulated skeleton: pivots at hips, shoulders, elbows and knees.
export function createHumanoid(materials, options = {}) {
  const root = new THREE.Group(), skin = materials.surface(options.skin || '#b98460', 0.8);
  const shirt = materials.surface(options.shirt || '#ede3cc'), pants = materials.surface(options.pants || '#253e4a');
  const shoes = materials.surface('#263337'), hair = materials.surface('#2b2826');
  const body = new THREE.Group(); body.position.y = 0.89; root.add(body);
  body.add(box(0.45, 0.57, 0.25, shirt, 0, 0.31, 0)); body.add(box(0.34, 0.15, 0.24, pants, 0, 0.02, 0));
  const head = new THREE.Group(); head.position.y = 0.76; body.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin); face.scale.set(0.87, 1.15, 0.86); face.castShadow = true; head.add(face);
  head.add(box(0.29, 0.1, 0.28, hair, 0, 0.14, 0.018)); head.add(box(0.28, 0.045, 0.03, materials.metal, 0, 0.02, -0.145));
  const limbs = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.31, 0.58, 0); body.add(arm);
    arm.add(box(0.15, 0.34, 0.16, shirt, 0, -0.16, 0));
    const elbow = new THREE.Group(); elbow.position.y = -0.33; arm.add(elbow);
    elbow.add(box(0.12, 0.29, 0.13, skin, 0, -0.13, 0)); elbow.add(box(0.11, 0.11, 0.13, skin, 0, -0.30, 0));
    const leg = new THREE.Group(); leg.position.set(side * 0.12, 0.01, 0); body.add(leg);
    leg.add(box(0.18, 0.43, 0.2, pants, 0, -0.20, 0)); const knee = new THREE.Group(); knee.position.y = -0.4; leg.add(knee);
    knee.add(box(0.16, 0.39, 0.18, pants, 0, -0.17, 0)); knee.add(box(0.18, 0.13, 0.30, shoes, 0, -0.38, -0.05));
    limbs[side < 0 ? 'left' : 'right'] = { arm, elbow, leg, knee };
  }
  return { root, body, head, limbs, materials: [skin, shirt, pants, shoes, hair] };
}
export function animateHumanoid(rig, state, time, speed, aim = false) {
  const { body, limbs } = rig, moving = speed > 0.2, crouch = state === 'crouch', dead = state === 'death', drive = state === 'drive';
  const phase = time * (speed > 5 ? 12 : 8), stride = moving ? Math.min(speed / 6, 1) * 0.7 : 0;
  body.position.y = dead ? 0.27 : drive ? 0.72 : crouch ? 0.62 : 0.89 + Math.sin(phase * 2) * stride * 0.04;
  body.rotation.x = dead ? -Math.PI / 2 : moving && speed > 5 ? 0.1 : 0;
  body.rotation.z = moving ? Math.sin(phase) * 0.035 : Math.sin(time * 1.5) * 0.015;
  for (const [key, sign] of [['left', -1], ['right', 1]]) {
    const limb = limbs[key], step = Math.sin(phase + (sign < 0 ? Math.PI : 0)) * stride;
    limb.leg.rotation.x = drive ? 1.1 : crouch ? 0.7 + step : step;
    limb.knee.rotation.x = drive ? -1.2 : crouch ? -1 : Math.min(0, -step) * 0.6;
    limb.arm.rotation.x = aim || drive ? 1.35 : -step * 0.8;
    limb.arm.rotation.z = aim ? sign * -0.15 : sign * 0.05; limb.elbow.rotation.x = aim ? 0.25 : drive ? 0.6 : 0.15;
  }
  if (state === 'jump' || state === 'fall') { limbs.left.arm.rotation.z = -0.6; limbs.right.arm.rotation.z = 0.6; }
  if (state === 'melee') limbs.right.arm.rotation.x = 1.9 + Math.sin(time * 18) * 0.7;
}
export class Player {
  constructor(scene, world) {
    Object.assign(this, CITY.spawn); this.previous = { ...CITY.spawn }; this.vy = 0; this.velocity = { x: 0, z: 0 };
    this.speed = 0; this.state = 'idle'; this.grounded = true; this.health = 100; this.armor = 35; this.cash = 250;
    this.vehicle = null; this.aiming = false; this.rig = createHumanoid(world.materials); this.mesh = this.rig.root; scene.add(this.mesh);
    this.world = world; this.crouched = false; this.transition = null; this.recoil = 0; this.cover = null; this.rendered = { ...CITY.spawn };
  }
  snapshot() { this.previous = { x: this.x, y: this.y, z: this.z, yaw: this.yaw }; }
  update(dt, input, cameraYaw) {
    this.snapshot(); if (this.vehicle || this.transition || this.health <= 0 || this.incapacitated) return;
    const axes = input.axes(), magnitude = Math.min(1, Math.hypot(axes.x, axes.z)); this.aiming = input.down('Mouse2');
    if (input.take('KeyC')) this.crouched = !this.crouched;
    const sprint = input.down('ShiftLeft') && !this.aiming && !this.crouched, pace = this.crouched ? 2.1 : this.aiming ? 2.7 : sprint ? 8.6 : 4.5;
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw); let dx = axes.x * cos + axes.z * sin, dz = -axes.x * sin + axes.z * cos;
    const length = Math.hypot(dx, dz); if (length > 1) { dx /= length; dz /= length; }
    this.velocity.x += (dx * pace - this.velocity.x) * damping(16, dt); this.velocity.z += (dz * pace - this.velocity.z) * damping(16, dt);
    const moved = this.world.collision.move(this, this.velocity.x * dt, this.velocity.z * dt); this.speed = Math.hypot(moved.dx, moved.dz) / dt;
    if (this.aiming) this.yaw = dampAngle(this.yaw, cameraYaw, 18, dt); else if (magnitude > 0.05) this.yaw = dampAngle(this.yaw, heading(dx, dz), 12, dt);
    if (input.take('Space') && this.grounded) { this.vy = 6.3; this.grounded = false; }
    this.vy -= 18 * dt; this.y += this.vy * dt; const floor = walkSurfaceHeight(this.x, this.z) - 0.055;
    if (this.y <= floor) { this.y = floor; this.vy = 0; this.grounded = true; }
    this.x = clamp(this.x, -768, 449); this.z = clamp(this.z, -733, 749);
    this.state = !this.grounded ? this.vy > 0 ? 'jump' : 'fall' : this.crouched ? 'crouch' : this.aiming ? 'aim' : this.speed > 6 ? 'sprint' : this.speed > 0.3 ? 'walk' : 'idle';
    this.recoil = Math.max(0, this.recoil - dt * 6);
  }
  render(alpha, time) {
    this.rendered = interpolateTransform(this.previous, this, alpha); this.mesh.position.set(this.rendered.x, this.rendered.y, this.rendered.z); this.mesh.rotation.y = this.rendered.yaw;
    animateHumanoid(this.rig, this.health <= 0 ? 'death' : this.vehicle ? 'drive' : this.state, time, this.speed, this.aiming);
    if (this.recoil > 0 && this.aiming) this.rig.limbs.right.arm.rotation.x += this.recoil * 0.15;
  }
  fade(opacity) {
    for (const material of this.rig.materials) {
      const translucent = opacity < 0.98; if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
      material.opacity = opacity;
    }
  }
  damage(amount) { const absorbed = Math.min(this.armor, amount * 0.6); this.armor -= absorbed; this.health = Math.max(0, this.health - (amount - absorbed)); }
}
