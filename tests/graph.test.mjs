import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WaypointGraph, createRoadGraph } from '../game/src/world/graph.js';

test('road graph returns a contiguous shortest route and nearest waypoint', () => {
  const graph = createRoadGraph(), path = graph.path('8:7', '8:0'); assert.equal(path.length, 8);
  assert.equal(graph.nearest({ x: 322, z: 293 }).id, '8:7');
  for (let i = 1; i < path.length; i++) assert.ok(path[i - 1].edges.some(edge => edge.to === path[i].id));
});
test('disconnected routes are empty and costs choose the cheaper detour', () => {
  const graph = new WaypointGraph(); graph.add('a', 0, 0).add('b', 1, 0).add('c', 2, 0).add('d', 0, 20).add('isolated', 100, 100);
  graph.connect('a', 'b').connect('b', 'c').connect('a', 'd').connect('d', 'c');
  assert.deepEqual(graph.path('a', 'c').map(node => node.id), ['a', 'b', 'c']); assert.deepEqual(graph.path('a', 'isolated'), []);
});
