import * as THREE from '../../vendor/three.min.js';
import { clamp, angleDelta, damping, dampAngle, heading, lerp } from '../core/math.js';

export function drivingFrame(rig, player, input, dt, time) {
  const vehicle = player.vehicle || player.transition?.vehicle, p = vehicle.rendered;
  const speed = Math.abs(vehicle.speed), normalized = clamp(speed / vehicle.config.topSpeed, 0, 1), bike = vehicle.type === 'bike';
  const velocityYaw = speed > 3 ? heading(vehicle.vx, vehicle.vz) : p.yaw;
  const headingYaw = p.yaw + angleDelta(p.yaw, velocityYaw) * 0.35;
  if (rig.freeLookAge > 2) rig.yaw = dampAngle(rig.yaw, headingYaw, 4.5, dt);
  const yaw = rig.yaw + (input.down('KeyB') ? Math.PI : 0);
  const presetScale = { Near: 0.79, Medium: 1, Far: 1.26 }[rig.preset];
  const back = vehicle.config.length * (bike ? 1.6 : 1.25) * presetScale * (1 + normalized * 0.15);
  const up = bike ? 1.6 : 1.3 + vehicle.config.height * 0.55;
  rig.pivot.set(p.x, p.y + up, p.z);
  rig.mode = rig.phone ? 'phone' : 'vehicle';
  if (rig.phone) {
    rig.pivot.set(p.x - Math.cos(p.yaw) * 0.32, p.y + vehicle.config.height * 0.85, p.z - Math.cos(p.yaw) * 0.2);
    return { desired: rig.pivot.clone(), target: new THREE.Vector3(rig.pivot.x - Math.sin(yaw) * 9, rig.pivot.y - Math.sin(rig.pitch) * 8, rig.pivot.z - Math.cos(yaw) * 9), fov: rig.baseFov, roll: 0 };
  }
  const desired = new THREE.Vector3(p.x + Math.sin(yaw) * back, rig.pivot.y + 0.7 + Math.sin(rig.pitch) * back * 0.4,
    p.z + Math.cos(yaw) * back);
  const target = new THREE.Vector3(p.x - Math.sin(yaw) * 3.5, p.y + vehicle.config.height * 0.55, p.z - Math.cos(yaw) * 3.5);
  const roll = rig.reduceMotion ? 0 : clamp(vehicle.steering * normalized * 0.18, -Math.PI / 60, Math.PI / 60);
  rig.trauma = Math.max(rig.trauma, Math.min(vehicle.impact / 35, 0.8));
  if (!rig.reduceMotion && rig.trauma > 0.01) {
    desired.x += Math.sin(time * 53) * rig.trauma ** 2 * 0.10; desired.y += Math.sin(time * 61) * rig.trauma ** 2 * 0.07;
  }
  rig.trauma = Math.max(0, rig.trauma - dt * 1.4);
  desired.y -= vehicle.braking && !rig.reduceMotion ? 0.10 * normalized : 0;
  return { desired, target, fov: lerp(rig.baseFov, 78, normalized), roll };
}
