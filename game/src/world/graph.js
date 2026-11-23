import { CITY } from '../data/city.js';
import { distance2D } from '../core/math.js';

export class WaypointGraph {
  constructor() { this.nodes = new Map(); }
  add(id, x, z) { this.nodes.set(id, { id, x, z, edges: [] }); return this; }
  connect(a, b, bidirectional = true) {
    const from = this.nodes.get(a), to = this.nodes.get(b); if (!from || !to) throw new Error('Unknown waypoint.');
    if (!from.edges.some(edge => edge.to === b)) from.edges.push({ to: b, cost: distance2D(from, to) });
    if (bidirectional && !to.edges.some(edge => edge.to === a)) to.edges.push({ to: a, cost: distance2D(from, to) });
    return this;
  }
  nearest(point) {
    let result = null, best = Infinity;
    for (const node of this.nodes.values()) { const distance = distance2D(point, node); if (distance < best) { best = distance; result = node; } }
    return result;
  }
  path(start, destination) {
    const from = typeof start === 'string' ? this.nodes.get(start) : this.nearest(start);
    const to = typeof destination === 'string' ? this.nodes.get(destination) : this.nearest(destination);
    if (!from || !to) return [];
    const open = new Set([from.id]), costs = new Map([[from.id, 0]]), parents = new Map();
    while (open.size) {
      let current = null, best = Infinity;
      for (const id of open) { const cost = costs.get(id) + distance2D(this.nodes.get(id), to); if (cost < best) { best = cost; current = id; } }
      if (current === to.id) {
        const route = [this.nodes.get(current)];
        while (parents.has(current)) { current = parents.get(current); route.unshift(this.nodes.get(current)); }
        return route;
      }
      open.delete(current);
      for (const edge of this.nodes.get(current).edges) {
        const cost = costs.get(current) + edge.cost;
        if (cost < (costs.get(edge.to) ?? Infinity)) { costs.set(edge.to, cost); parents.set(edge.to, current); open.add(edge.to); }
      }
    }
    return [];
  }
}
export function createRoadGraph() {
  const graph = new WaypointGraph();
  CITY.streetsX.forEach((x, i) => CITY.streetsZ.forEach((z, j) => graph.add(`${i}:${j}`, x, z)));
  CITY.streetsX.forEach((_, i) => CITY.streetsZ.forEach((_, j) => {
    if (i + 1 < CITY.streetsX.length) graph.connect(`${i}:${j}`, `${i + 1}:${j}`);
    if (j + 1 < CITY.streetsZ.length) graph.connect(`${i}:${j}`, `${i}:${j + 1}`);
  }));
  return graph;
}
