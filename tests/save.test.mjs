import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSave, writeSave, validateSave, validateSettings, SAVE_KEY } from '../game/src/core/save.js';

test('save round trip preserves progress without trusting malformed values', () => {
  const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const save = { version: 1, seed: 'bay', player: { x: 320, z: 150, cash: 900, vehicle: 'sports' }, completed: ['first-delivery', 'first-delivery', '<script>'], bags: [0, 1, -1, 99] };
  assert.ok(writeSave(save, storage)); const restored = readSave(storage);
  assert.equal(restored.player.cash, 900); assert.deepEqual(restored.completed, ['first-delivery']); assert.deepEqual(restored.bags, [0, 1]);
  storage.setItem(SAVE_KEY, 'broken'); assert.equal(readSave(storage), null);
});
test('restricted storage, unknown schemas and invalid settings fail safely', () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.equal(readSave(storage), null); assert.equal(writeSave({ version: 1, seed: 'a' }, storage), false);
  assert.equal(validateSave({ version: 99 }), null);
  const settings = validateSettings({ fov: Infinity, master: 8, camera: 'First Person', quality: 'evil' });
  assert.equal(settings.fov, 60); assert.equal(settings.master, 1); assert.equal(settings.camera, 'Medium');
  assert.equal(validateSettings(null).camera, 'Medium');
});
test('a throwing localStorage property is caught before any access', () => {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('opaque origin'); } });
  try { assert.equal(readSave(), null); assert.equal(writeSave({ version: 1, seed: 'a' }), false); }
  finally { if (old) Object.defineProperty(globalThis, 'localStorage', old); else delete globalThis.localStorage; }
});
