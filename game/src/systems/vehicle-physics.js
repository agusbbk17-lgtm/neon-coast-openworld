import { clamp, damping, forward } from '../core/math.js';
import { groundHeight } from '../world/terrain.js';
import { segmentBox } from './collision.js';

// Sweep the rotating hull, not just its centre or yesterday's corner offsets.
export function safeVehicleMotion(vehicle, dx, dz, turn, collision) {
  if (!collision) return 1;
  const { width, length, height } = vehicle.config, radius = Math.hypot(width, length) / 2 + 0.15;
  const solids = [...collision.query(Math.min(vehicle.x, vehicle.x + dx) - radius, Math.min(vehicle.z, vehicle.z + dz) - radius,
    Math.max(vehicle.x, vehicle.x + dx) + radius, Math.max(vehicle.z, vehicle.z + dz) + radius)]
    .filter(box => box.min.y < vehicle.y + height && box.max.y > vehicle.y + 0.08);
  if (!solids.length) return 1;
  const f = forward(vehicle.yaw), endF = forward(vehicle.yaw + turn);
  let fraction = 1;
  const pad = 0.12 + radius * turn * turn / 8;
  for (const end of [-1, 0, 1]) for (const side of [-1, 0, 1]) {
    if (!end && !side) continue;
    const longitudinal = (length / 2 - 0.08) * end, lateral = (width / 2 - 0.08) * side;
    const start = { x: vehicle.x + f.x * longitudinal - f.z * lateral, y: vehicle.y + height * 0.5,
      z: vehicle.z + f.z * longitudinal + f.x * lateral };
    const finish = { x: vehicle.x + dx + endF.x * longitudinal - endF.z * lateral, y: start.y,
      z: vehicle.z + dz + endF.z * longitudinal + endF.x * lateral };
    for (const solid of solids) { const hit = segmentBox(start, finish, solid, pad); if (hit !== null) fraction = Math.min(fraction, hit); }
  }
  const blocked = t => {
    const yaw = vehicle.yaw + turn * t, ax = { x: Math.cos(yaw), z: -Math.sin(yaw) }, az = forward(yaw);
    const x = vehicle.x + dx * t, z = vehicle.z + dz * t;
    return solids.some(box => {
      const hx = (box.max.x - box.min.x) / 2, hz = (box.max.z - box.min.z) / 2;
      const bx = (box.min.x + box.max.x) / 2 - x, bz = (box.min.z + box.max.z) / 2 - z;
      for (const axis of [ax, az, { x: 1, z: 0 }, { x: 0, z: 1 }]) {
        const hull = Math.abs(axis.x * ax.x + axis.z * ax.z) * (width / 2 + 0.02)
          + Math.abs(axis.x * az.x + axis.z * az.z) * (length / 2 + 0.02);
        if (Math.abs(bx * axis.x + bz * axis.z) >= hull + Math.abs(axis.x) * hx + Math.abs(axis.z) * hz) return false;
      }
      return true;
    });
  };
  const steps = Math.max(1, Math.ceil((Math.hypot(dx, dz) + Math.abs(turn) * radius) / 0.16));
  let previous = 0;
  for (let i = 1; i <= steps; i++) {
    const t = Math.min(fraction, i / steps);
    if (blocked(t)) {
      let low = previous, high = t;
      for (let j = 0; j < 10; j++) { const mid = (low + high) / 2; if (blocked(mid)) high = mid; else low = mid; }
      return Math.max(0, low - 0.001);
    }
    previous = t; if (t >= fraction) break;
  }
  return fraction < 1 ? Math.max(0, fraction - 0.002) : 1;
}

export function integrateVehicle(vehicle, controls, dt, collision = null, wet = 0) {
  dt = clamp(dt, 0, 1 / 30); const config = vehicle.config, f = forward(vehicle.yaw), right = { x: -f.z, z: f.x };
  let longitudinal = vehicle.vx * f.x + vehicle.vz * f.z, lateral = vehicle.vx * right.x + vehicle.vz * right.z;
  let throttle = clamp(controls.throttle || 0, -1, 1), brake = clamp(controls.brake || 0, 0, 1);
  if (throttle < 0 && longitudinal > 1) { brake = Math.max(brake, -throttle); throttle = 0; }
  if (vehicle.health <= 0 || vehicle.flipped) throttle = 0;
  const acceleration = throttle * config.acceleration - Math.sign(longitudinal) * (0.10 + 0.0015 * longitudinal ** 2);
  const before = longitudinal; longitudinal += acceleration * dt;
  const deceleration = (brake * 24 + (controls.handbrake ? 6 : 0)) * dt;
  longitudinal = Math.sign(longitudinal) * Math.max(0, Math.abs(longitudinal) - deceleration);
  if (Math.abs(longitudinal) < 0.05 && !throttle) longitudinal = 0;
  longitudinal = clamp(longitudinal, -13, config.topSpeed * Math.max(0.25, vehicle.health / 100));
  const maxSteer = 0.57 / (1 + Math.abs(longitudinal) * 0.10);
  vehicle.steering += (clamp(controls.steer || 0, -1, 1) * maxSteer - vehicle.steering) * damping(12, dt);
  const grip = (controls.handbrake ? 1.5 : config.grip) * (1 - wet * 0.35) * (vehicle.tyreDamage ? 0.5 : 1);
  lateral *= Math.exp(-grip * dt);
  const turn = -Math.tan(vehicle.steering) * longitudinal / (config.length * 0.58) * dt;
  const oldYaw = vehicle.yaw; vehicle.yaw += turn;
  const oldLateral = lateral;
  lateral = (longitudinal * Math.sin(turn) + oldLateral * Math.cos(turn)) * Math.exp(-grip * dt);
  longitudinal = longitudinal * Math.cos(turn) - oldLateral * Math.sin(turn);
  const facing = forward(vehicle.yaw), r = { x: -facing.z, z: facing.x };
  vehicle.vx = facing.x * longitudinal + r.x * lateral; vehicle.vz = facing.z * longitudinal + r.z * lateral;
  let dx = vehicle.vx * dt, dz = vehicle.vz * dt;
  vehicle.yaw = oldYaw;
  const fraction = safeVehicleMotion(vehicle, dx, dz, turn, collision);
  vehicle.yaw = oldYaw + turn * fraction;
  vehicle.impact = Math.max(0, (vehicle.impact || 0) - dt * 10);
  if (fraction < 1) {
    const speed = Math.hypot(vehicle.vx, vehicle.vz); vehicle.impact = speed;
    vehicle.health = Math.max(0, vehicle.health - speed * 0.35);
    vehicle.vx *= -0.22; vehicle.vz *= -0.22; dx *= fraction; dz *= fraction;
  }
  vehicle.x += dx; vehicle.z += dz;
  vehicle.x = clamp(vehicle.x, -762, 446); vehicle.z = clamp(vehicle.z, -727, 745);
  vehicle.speed = longitudinal; vehicle.braking = brake > 0.1 || controls.handbrake;
  vehicle.pitch += (clamp((longitudinal - before) / Math.max(dt, 0.001) * 0.008, -0.12, 0.12) - vehicle.pitch) * damping(6, dt);
  const targetRoll = config.width < 1 ? clamp(-vehicle.steering * longitudinal * 0.06, -0.42, 0.42) : clamp(vehicle.steering * longitudinal * 0.025, -0.10, 0.10);
  vehicle.roll += (targetRoll - vehicle.roll) * damping(6, dt);
  vehicle.wheelSpin += longitudinal / 0.35 * dt;
  vehicle.gear = longitudinal < -0.1 ? 'R' : Math.max(1, Math.min(6, Math.floor(Math.abs(longitudinal) / config.topSpeed * 6) + 1));
  vehicle.rpm = 850 + Math.abs(throttle) * 1000 + (Math.abs(longitudinal) / (config.topSpeed / 6) % 1) * 5100;
  vehicle.vy = (vehicle.vy || 0) - 18 * dt; vehicle.y += vehicle.vy * dt;
  const floor = groundHeight(vehicle.x, vehicle.z) + 0.08;
  if (vehicle.y < floor) { vehicle.y = floor; vehicle.vy = 0; }
  return { impact: vehicle.impact, fraction };
}
export function obbOverlap(a, b) {
  const ax = { x: Math.cos(a.yaw), z: -Math.sin(a.yaw) }, az = forward(a.yaw);
  const bx = { x: Math.cos(b.yaw), z: -Math.sin(b.yaw) }, bz = forward(b.yaw);
  const dx = b.x - a.x, dz = b.z - a.z; let depth = Infinity, normal = null;
  for (const axis of [ax, az, bx, bz]) {
    const dot = (u, v) => u.x * v.x + u.z * v.z;
    const radiusA = Math.abs(dot(axis, ax)) * a.config.width / 2 + Math.abs(dot(axis, az)) * a.config.length / 2;
    const radiusB = Math.abs(dot(axis, bx)) * b.config.width / 2 + Math.abs(dot(axis, bz)) * b.config.length / 2;
    const projection = dx * axis.x + dz * axis.z, overlap = radiusA + radiusB - Math.abs(projection);
    if (overlap <= 1e-7) return null;
    if (overlap < depth) { depth = overlap; const sign = projection < 0 ? -1 : 1; normal = { x: axis.x * sign, z: axis.z * sign }; }
  }
  return { depth, normal };
}
export function resolveVehiclePair(a, b, collision = null) {
  const contact = obbOverlap(a, b); if (!contact) return 0;
  const { normal, depth } = contact, totalMass = a.config.mass + b.config.mass;
  const da = depth * b.config.mass / totalMass, db = depth * a.config.mass / totalMass;
  const fa = safeVehicleMotion(a, -normal.x * da, -normal.z * da, 0, collision), fb = safeVehicleMotion(b, normal.x * db, normal.z * db, 0, collision);
  a.x -= normal.x * da * fa; a.z -= normal.z * da * fa;
  b.x += normal.x * db * fb; b.z += normal.z * db * fb;
  const relative = (b.vx - a.vx) * normal.x + (b.vz - a.vz) * normal.z; if (relative >= 0) return 0;
  const impulse = -relative * 1.15 / (1 / a.config.mass + 1 / b.config.mass);
  a.vx -= impulse / a.config.mass * normal.x; a.vz -= impulse / a.config.mass * normal.z;
  b.vx += impulse / b.config.mass * normal.x; b.vz += impulse / b.config.mass * normal.z;
  a.health = Math.max(0, a.health + relative * 0.25); b.health = Math.max(0, b.health + relative * 0.25);
  a.impact = b.impact = -relative; return -relative;
}
