import { clamp, angleDelta, heading, forward, distance2D } from '../core/math.js';

export class AIScheduler {
  constructor(interval = 0.06, budget = 6) { this.interval = interval; this.budget = budget; this.elapsed = 0; this.cursor = 0; }
  update(dt, items, callback) {
    this.elapsed += dt; if (this.elapsed < this.interval || !items.length) return; this.elapsed %= this.interval;
    for (let i = 0; i < Math.min(this.budget, items.length); i++) { const item = items[this.cursor++ % items.length]; callback(item); }
  }
}
export function steeringToward(vehicle, point, targetSpeed) {
  const desired = heading(point.x - vehicle.x, point.z - vehicle.z), error = angleDelta(vehicle.yaw, desired);
  const desiredSpeed = targetSpeed * clamp(1 - Math.abs(error) * 0.38, 0.35, 1);
  return { steer: clamp(-error * 2.3, -1, 1), throttle: vehicle.speed < desiredSpeed ? 0.85 : 0,
    brake: vehicle.speed > desiredSpeed + 1.5 ? 0.3 : 0, handbrake: false };
}

function segmentProjection(point, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), x = dx / length, z = dz / length;
  const along = (point.x - a.x) * x + (point.z - a.z) * z;
  return { x: a.x + x * clamp(along, 0, length), z: a.z + z * clamp(along, 0, length), dx: x, dz: z, along, length,
    lateral: Math.abs((point.x - a.x) * -z + (point.z - a.z) * x) };
}

// Enter the road graph through a reachable edge projection, then its forward
// endpoint. Replanning never sends a mid-block cruiser back to a nearer node.
export function planRoadRoute(graph, vehicle, destination, canApproach = () => true) {
  const facing = forward(vehicle.yaw), candidates = [];
  for (const a of graph.nodes.values()) for (const edge of a.edges) {
    if (a.id > edge.to) continue;
    const b = graph.nodes.get(edge.to), projected = segmentProjection(vehicle, a, b);
    const alignment = facing.x * projected.dx + facing.z * projected.dz;
    const anchor = alignment >= 0 ? b : a;
    candidates.push({ projected, anchor, score: distance2D(vehicle, projected) + 8 * (1 - Math.abs(alignment)) });
  }
  candidates.sort((a, b) => a.score - b.score);
  for (const candidate of candidates) {
    if (!canApproach(candidate.projected)) continue;
    const route = graph.path(candidate.anchor.id, destination); if (!route.length) continue;
    return [{ x: candidate.projected.x, z: candidate.projected.z }, ...route];
  }
  return [];
}

function cornerSpeed(a, b, c) {
  const incoming = segmentProjection(b, a, b), outgoing = segmentProjection(c, b, c);
  const bend = Math.acos(clamp(incoming.dx * outgoing.dx + incoming.dz * outgoing.dz, -1, 1));
  return bend > 0.3 ? Math.max(5, 12 / (1 + bend * 0.4)) : Infinity;
}

export function roadLookahead(vehicle, route, targetSpeed, cursor = 0, laneOffset = 3.5) {
  if (!route.length) return { cursor: 0, arrived: false, point: vehicle, pace: 0, controls: { throttle: 0, brake: 1, steer: 0 } };
  cursor = clamp(cursor, 0, route.length - 1);
  if (cursor === 0 && route.length > 1 && distance2D(route[0], route[1]) > 0.01) {
    const progress = segmentProjection(vehicle, route[0], route[1]);
    if (progress.along > 0 && progress.along < progress.length && progress.lateral < 12) cursor = 1;
  }
  while (cursor < route.length - 1 && distance2D(vehicle, route[cursor]) < 7) cursor++;
  const node = route[cursor], previous = route[cursor - 1], next = route[cursor + 1];
  let point = { x: node.x, z: node.z }, pace = targetSpeed;
  const arrived = cursor === route.length - 1 && distance2D(vehicle, node) < 8;
  if (previous && distance2D(previous, node) > 0.01) {
    const segment = segmentProjection(vehicle, previous, node), remaining = Math.max(0, segment.length - segment.along);
    const along = clamp(segment.along + clamp(8 + Math.abs(vehicle.speed) * 0.35, 8, 20), 0, segment.length);
    const lane = laneOffset * clamp((segment.length - along) / 10, 0, 1);
    point = { x: previous.x + segment.dx * along - segment.dz * lane, z: previous.z + segment.dz * along + segment.dx * lane };
    if (next) pace = Math.min(pace, Math.sqrt(cornerSpeed(previous, node, next) ** 2 + 24 * remaining));
    if (cursor > 1 && distance2D(route[cursor - 2], previous) > 0.01) {
      pace = Math.min(pace, Math.sqrt(cornerSpeed(route[cursor - 2], previous, node) ** 2 + 16 * Math.max(0, segment.along)));
    }
  }
  const controls = arrived ? { throttle: 0, brake: 1, steer: 0 } : steeringToward(vehicle, point, pace);
  if (!arrived) controls.brake = Math.max(controls.brake, clamp((vehicle.speed - pace) / 10, 0, 1));
  return { cursor, arrived, point, pace, controls };
}

// Recovery has a finite reverse window and cooldown; clear rear space is
// mandatory. Actual displacement, not engine speed, detects blocked wheels.
export function recoverRoadObstacle(state, vehicle, dt, blocked, rearClear, controls) {
  dt = clamp(dt, 0, 0.1);
  const movement = state.lastX === undefined ? 0 : Math.hypot(vehicle.x - state.lastX, vehicle.z - state.lastZ);
  state.lastX = vehicle.x; state.lastZ = vehicle.z;
  state.cooldown = Math.max(0, (state.cooldown || 0) - dt);
  if (state.reverseRemaining > 0) {
    state.reverseRemaining = Math.max(0, state.reverseRemaining - dt);
    if (!rearClear) { state.reverseRemaining = 0; state.cooldown = 1; return { throttle: 0, brake: 1, steer: 0 }; }
    if (state.reverseRemaining > 0) return { throttle: -0.7, brake: 0, steer: state.reverseSteer, handbrake: false };
    state.cooldown = 1.5; state.stallTime = 0; state.replan = true;
  }
  state.stallTime = blocked && movement < dt * 0.7 ? (state.stallTime || 0) + dt : Math.max(0, (state.stallTime || 0) - dt * 2);
  if (state.stallTime > 0.8 && !state.cooldown && rearClear) {
    state.recoveries = (state.recoveries || 0) + 1; state.reverseRemaining = 1.15;
    state.reverseSteer = Math.abs(controls.steer) > 0.2 ? -controls.steer : state.recoveries % 2 ? 0.75 : -0.75;
    return { throttle: -0.7, brake: 0, steer: state.reverseSteer, handbrake: false };
  }
  return controls;
}
