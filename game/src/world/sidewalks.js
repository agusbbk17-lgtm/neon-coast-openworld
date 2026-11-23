import { CITY } from '../data/city.js';
import { WaypointGraph } from './graph.js';

export function createSidewalkGraph() {
  const graph = new WaypointGraph(), signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  CITY.streetsX.forEach((x, i) => CITY.streetsZ.forEach((z, j) => signs.forEach(([sx, sz], q) => graph.add(`${i}:${j}:${q}`, x + sx * 13.9, z + sz * 13.9))));
  CITY.streetsX.forEach((_, i) => CITY.streetsZ.forEach((_, j) => {
    for (let q = 0; q < 4; q++) graph.connect(`${i}:${j}:${q}`, `${i}:${j}:${(q + 1) % 4}`);
    if (j + 1 < CITY.streetsZ.length) { graph.connect(`${i}:${j}:2`, `${i}:${j + 1}:1`); graph.connect(`${i}:${j}:3`, `${i}:${j + 1}:0`); }
    if (i + 1 < CITY.streetsX.length) { graph.connect(`${i}:${j}:1`, `${i + 1}:${j}:0`); graph.connect(`${i}:${j}:2`, `${i + 1}:${j}:3`); }
  }));
  return graph;
}
