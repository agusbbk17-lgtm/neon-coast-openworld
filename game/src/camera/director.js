import * as THREE from '../../vendor/three.min.js';
import { clamp, smoothstep } from '../core/math.js';
import { CinematicVehicleCamera } from './cinematic.js';

export function splinePoint(points, t) {
  const position = clamp(t, 0, 1) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(position)), u = position - i;
  const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
  return b.map((value, axis) => 0.5 * (2 * value + (-a[axis] + c[axis]) * u +
    (2 * a[axis] - 5 * value + 4 * c[axis] - d[axis]) * u * u + (-a[axis] + 3 * value - 3 * c[axis] + d[axis]) * u * u * u));
}
export class CameraDirector {
  constructor(seed = 'solmar') { this.active = null; this.menu = false; this.menuTime = 0; this.letterbox = false; this.title = ''; this.subtitle = ''; this.vehicleCamera = new CinematicVehicleCamera(seed); this.cinematic = false; }
  start(title, subject, subtitle = '', duration = 4.5) {
    this.active = { title, subject, subtitle, time: 0, duration,
      points: [[19, 7, 14], [9, 4, -7], [-2, 3.3, 9], [0, 3.0, 6.0]] };
    this.title = title; this.subtitle = subtitle;
  }
  update(dt) {
    this.menuTime += dt;
    if (this.active) { this.active.time += dt; if (this.active.time >= this.active.duration) { this.active = null; this.title = ''; this.subtitle = ''; } }
    this.letterbox = Boolean(this.active);
  }
  frame(player, fallbackVehicle, reduceMotion, input, dt) {
    if (this.menu) {
      const subject = fallbackVehicle?.rendered || player.rendered, angle = -0.75 + (reduceMotion ? 0 : Math.sin(this.menuTime * 0.12) * 0.1);
      return { pivot: new THREE.Vector3(subject.x, subject.y + 0.7, subject.z),
        desired: new THREE.Vector3(subject.x + Math.sin(angle) * 17, subject.y + 5.5, subject.z + Math.cos(angle) * 17),
        target: new THREE.Vector3(subject.x, subject.y + 0.65, subject.z), fov: 48, mode: 'menu' };
    }
    if (!this.active || reduceMotion) {
      if (this.cinematic && player.vehicle && !reduceMotion) return this.vehicleCamera.frame(player.vehicle, input, dt);
      this.vehicleCamera.reset(); return null;
    }
    const shot = this.active, subject = shot.subject.rendered || player.rendered;
    const offset = splinePoint(shot.points, smoothstep(shot.time / shot.duration));
    return { pivot: new THREE.Vector3(subject.x, subject.y + 0.9, subject.z),
      desired: new THREE.Vector3(subject.x + offset[0], subject.y + offset[1], subject.z + offset[2]),
      target: new THREE.Vector3(subject.x, subject.y + 0.7, subject.z - 0.7), fov: 52 + 8 * clamp(shot.time / shot.duration, 0, 1), mode: 'intro' };
  }
}
