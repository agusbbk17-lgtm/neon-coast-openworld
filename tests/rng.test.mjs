import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Random } from '../game/src/core/rng.js';

test('seeded generation is reproducible and forks independent', () => {
  const a = new Random('bay'), b = new Random('bay');
  assert.deepEqual(Array.from({ length: 100 }, () => a.next()), Array.from({ length: 100 }, () => b.next()));
  assert.notEqual(a.fork('traffic').next(), a.fork('buildings').next());
});
