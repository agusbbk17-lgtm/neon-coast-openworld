import * as THREE from '../../vendor/three.min.js';
import { CAMERA_PRESETS, PRESET_NAMES } from './presets.js';
import { CameraCollision } from './collision.js';
import { clamp, damping, dampAngle, lerp } from '../core/math.js';
import { drivingFrame } from './vehicle-cam.js';

export class CameraRig {
  constructor(camera, collision) {
    this.camera = camera; this.collision = new CameraCollision(collision); this.yaw = 0; this.pitch = 0.12;
    this.preset = 'Medium'; this.shoulder = 1; this.mode = 'foot'; this.aimBlend = 0;
    this.pivot = new THREE.Vector3(); this.smoothed = new THREE.Vector3(); this.started = false;
    this.fov = 60; this.baseFov = 60; this.sensitivity = 1; this.reduceMotion = false; this.freeLookAge = 5;
    this.trauma = 0; this.cinematic = false; this.phone = false; this.intro = 0; this.debug = {};
    this.positionLag = 1 / 0.12; this.rotationLag = 1 / 0.06;
    this.oldRotation = new THREE.Quaternion(); this.desiredRotation = new THREE.Quaternion();
    this.vHeld = -1; this.vToggled = false;
    this.handheld = true; this.director = null; this.fallbackVehicle = null;
    this.trackingVehicle = null; this.lastVehiclePosition = new THREE.Vector3();
  }
  setPreset(name) { if (CAMERA_PRESETS[name]) this.preset = name; }
  cycle() { this.setPreset(PRESET_NAMES[(PRESET_NAMES.indexOf(this.preset) + 1) % PRESET_NAMES.length]); }
  handle(input, player, dt = 1 / 60) {
    if (input.take('KeyX')) this.shoulder *= -1;
    if (input.take('KeyV')) {
      if (player?.vehicle) { this.vHeld = 0; this.vToggled = false; } else this.cycle();
    }
    if (player?.vehicle && this.vHeld >= 0 && input.down('KeyV')) {
      this.vHeld += dt;
      if (this.vHeld >= 0.6 && !this.vToggled) {
        this.cinematic = !this.cinematic; this.vToggled = true;
        if (this.cinematic && !this.cinematicHintSeen) { this.notify?.('Cinematic camera: steering is harder. Hold V to return.'); this.cinematicHintSeen = true; }
      }
    }
    if (input.up('KeyV') && player?.vehicle) { if (this.vHeld >= 0 && !this.vToggled) this.cycle(); this.vHeld = -1; }
    if (input.take('KeyT') && player?.vehicle) this.phone = !this.phone;
    if (!player?.vehicle && !player?.transition) { this.phone = false; this.cinematic = false; }
  }
  update(dt, player, input, time) {
    const look = input.consumeLook(dt); this.yaw -= look.x * 0.0026 * this.sensitivity;
    this.pitch = clamp(this.pitch + look.y * 0.0024 * this.sensitivity, -Math.PI / 3, Math.PI * 5 / 12);
    this.freeLookAge = Math.abs(look.x) + Math.abs(look.y) > 0.03 ? 0 : this.freeLookAge + dt;
    if (!player.vehicle && this.freeLookAge > 1.5 && player.speed > 0.5 && !player.aiming) this.yaw = dampAngle(this.yaw, player.yaw, 2.4, dt);
    this.aimBlend = lerp(this.aimBlend, player.aiming ? 1 : 0, damping(15, dt));
    const preset = CAMERA_PRESETS[this.preset], p = player.rendered; this.mode = player.aiming ? 'aim' : 'foot';
    const inspect = input.down('AltLeft') && player.speed < 0.15 && !player.vehicle;
    let back = lerp(preset.back, 1.35, this.aimBlend), side = lerp(preset.right, 0.52, this.aimBlend) * this.shoulder;
    const height = preset.up + (player.crouched ? -0.4 : 0); this.pivot.set(p.x, p.y + height, p.z);
    if (inspect) { this.mode = 'inspect'; back = 0.05; side = 0; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let desired = new THREE.Vector3(p.x + sin * back * Math.cos(this.pitch) + cos * side,
      this.pivot.y + Math.sin(this.pitch) * back, p.z + cos * back * Math.cos(this.pitch) - sin * side);
    let target = new THREE.Vector3(p.x - sin * 8, this.pivot.y - Math.sin(this.pitch) * 8, p.z - cos * 8);
    let goalFov = inspect ? this.baseFov : lerp(this.baseFov + (player.state === 'sprint' ? 6 : 0), 45, this.aimBlend), roll = 0;
    if (player.vehicle || player.transition) {
      const vehicle = player.vehicle || player.transition.vehicle, vp = vehicle.rendered;
      if (this.trackingVehicle === vehicle) this.smoothed.add(new THREE.Vector3(vp.x, vp.y, vp.z).sub(this.lastVehiclePosition));
      this.trackingVehicle = vehicle; this.lastVehiclePosition.set(vp.x, vp.y, vp.z);
      const frame = drivingFrame(this, player, input, dt, time); desired = frame.desired; target = frame.target; goalFov = frame.fov; roll = frame.roll;
    } else this.trackingVehicle = null;
    if (!this.reduceMotion && this.handheld && !player.vehicle) desired.y += Math.sin(time * 1.4) * 0.01 + (player.state === 'sprint' ? Math.sin(time * 13) * 0.045 : 0);
    if (this.director) this.director.cinematic = this.cinematic;
    const directed = this.director?.frame(player, this.fallbackVehicle, this.reduceMotion, input, dt);
    if (directed) { this.pivot.copy(directed.pivot); desired = directed.desired; target = directed.target; goalFov = directed.fov; this.mode = directed.mode; roll = 0; }
    const first = !this.started || directed?.forceCut;
    if (first) { this.smoothed.copy(desired); this.started = true; } this.smoothed.lerp(desired, damping(this.positionLag, dt));
    const safe = this.collision.solve(this.pivot, this.smoothed, dt, Boolean(directed?.forceCut)); this.camera.position.set(safe.x, Math.max(0.32, safe.y), safe.z);
    this.oldRotation.copy(this.camera.quaternion); this.camera.lookAt(target); this.camera.rotateZ(roll); this.desiredRotation.copy(this.camera.quaternion);
    if (!first) this.camera.quaternion.copy(this.oldRotation).slerp(this.desiredRotation, damping(this.rotationLag, dt));
    this.fov = lerp(this.fov, goalFov, damping(16, dt)); this.camera.fov = this.fov; this.camera.updateProjectionMatrix();
    const distance = this.camera.position.distanceTo(this.pivot); player.fade(inspect || this.phone ? 0 : clamp((distance - 0.2) / 0.4, 0, 1));
    this.debug = { mode: this.mode, preset: this.preset, distance: +distance.toFixed(2), fov: +this.fov.toFixed(1), collisionHits: this.collision.hits };
  }
  reset(player) { this.started = false; this.yaw = player.yaw; this.pitch = 0.12; this.freeLookAge = 5; }
}
