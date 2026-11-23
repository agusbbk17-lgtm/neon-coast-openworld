import { clamp } from '../core/math.js';

// Conservative sphere sweep against expanded solids. Tangency counts as a hit.
export function segmentBox(start, end, box, radius = 0) {
  let enter = 0, exit = 1;
  for (const axis of ['x', 'y', 'z']) {
    const low = box.min[axis] - radius, high = box.max[axis] + radius, delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-9) { if (start[axis] < low || start[axis] > high) return null; }
    else {
      let a = (low - start[axis]) / delta, b = (high - start[axis]) / delta;
      if (a > b) [a, b] = [b, a]; enter = Math.max(enter, a); exit = Math.min(exit, b);
      if (enter > exit) return null;
    }
  }
  return enter;
}
export class CollisionWorld {
  constructor(cellSize = 48) { this.cellSize = cellSize; this.cells = new Map(); this.solids = []; }
  add(x, y, z, width, height, depth, tag = 'building') {
    const box = { min: { x: x - width / 2, y: y - height / 2, z: z - depth / 2 },
      max: { x: x + width / 2, y: y + height / 2, z: z + depth / 2 }, tag }; this.solids.push(box);
    for (let i = Math.floor(box.min.x / this.cellSize); i <= Math.floor(box.max.x / this.cellSize); i++)
      for (let j = Math.floor(box.min.z / this.cellSize); j <= Math.floor(box.max.z / this.cellSize); j++) {
        const key = i + ':' + j; if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(box);
      }
    return box;
  }
  query(minX, minZ, maxX, maxZ) {
    const found = new Set();
    for (let i = Math.floor(minX / this.cellSize); i <= Math.floor(maxX / this.cellSize); i++)
      for (let j = Math.floor(minZ / this.cellSize); j <= Math.floor(maxZ / this.cellSize); j++)
        for (const box of this.cells.get(i + ':' + j) || []) found.add(box);
    return found;
  }
  remove(box) {
    this.solids = this.solids.filter(solid => solid !== box);
    for (const [key, values] of this.cells) { const next = values.filter(solid => solid !== box); if (next.length) this.cells.set(key, next); else this.cells.delete(key); }
  }
  sweep(start, end, radius = 0.25) {
    let fraction = 1, hits = 0, solid = null;
    for (const box of this.query(Math.min(start.x, end.x) - radius, Math.min(start.z, end.z) - radius,
      Math.max(start.x, end.x) + radius, Math.max(start.z, end.z) + radius)) {
      const t = segmentBox(start, end, box, radius);
      if (t !== null && t <= fraction) { fraction = t; solid = box; hits++; }
    }
    return { fraction, hits, solid };
  }
  move(entity, dx, dz, radius = 0.38) {
    const originalX = entity.x, originalZ = entity.z, steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / Math.max(radius, 0.1)));
    let hit = false;
    for (let i = 0; i < steps; i++) {
      entity.x += dx / steps; entity.z += dz / steps;
      for (const box of this.query(entity.x - radius, entity.z - radius, entity.x + radius, entity.z + radius)) {
        if (entity.y + 1.6 < box.min.y || entity.y > box.max.y) continue;
        const ox = entity.x - clamp(entity.x, box.min.x, box.max.x), oz = entity.z - clamp(entity.z, box.min.z, box.max.z), length = Math.hypot(ox, oz);
        if (length >= radius) continue; hit = true;
        if (length > 1e-6) { entity.x += ox / length * (radius - length); entity.z += oz / length * (radius - length); }
        else {
          const edges = [Math.abs(entity.x - box.min.x), Math.abs(entity.x - box.max.x), Math.abs(entity.z - box.min.z), Math.abs(entity.z - box.max.z)];
          const side = edges.indexOf(Math.min(...edges));
          if (side === 0) entity.x = box.min.x - radius; if (side === 1) entity.x = box.max.x + radius;
          if (side === 2) entity.z = box.min.z - radius; if (side === 3) entity.z = box.max.z + radius;
        }
      }
    }
    return { hit, dx: entity.x - originalX, dz: entity.z - originalZ };
  }
  contains(point, radius = 0) {
    for (const box of this.query(point.x - radius, point.z - radius, point.x + radius, point.z + radius))
      if (segmentBox(point, point, box, radius) !== null) return true;
    return false;
  }
}
