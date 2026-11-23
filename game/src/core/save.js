import { clamp } from './math.js';

export const SAVE_KEY = 'sunset-syndicate.save.v1';
export const DEFAULT_SETTINGS = { quality: 'high', camera: 'Medium', fov: 60, sensitivity: 1,
  master: 0.55, music: 0.40, effects: 0.70, reduceMotion: false, handheld: true, finishingShots: true, autoQuality: true };
const finite = (value, fallback, low, high) => Number.isFinite(value) ? clamp(value, low, high) : fallback;
export function validateSettings(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return { quality: ['low', 'med', 'high', 'ultra'].includes(value.quality) ? value.quality : 'high',
    camera: ['Near', 'Medium', 'Far'].includes(value.camera) ? value.camera : 'Medium',
    fov: finite(value.fov, 60, 50, 85), sensitivity: finite(value.sensitivity, 1, 0.25, 3),
    master: finite(value.master, 0.55, 0, 1), music: finite(value.music, 0.40, 0, 1), effects: finite(value.effects, 0.70, 0, 1),
    reduceMotion: value.reduceMotion === true, handheld: value.handheld !== false, finishingShots: value.finishingShots !== false, autoQuality: value.autoQuality !== false };
}
export function validateSave(value) {
  if (!value || value.version !== 1 || typeof value.seed !== 'string' || value.seed.length > 96) return null;
  const p = value.player || {}, allowed = ['first-delivery', 'heat-wave', 'vault-run', 'coast-race', 'ridge-race'];
  return { version: 1, seed: value.seed,
    player: { x: finite(p.x, 329, -762, 746), z: finite(p.z, 359, -727, 745), yaw: finite(p.yaw, 0, -10000, 10000),
      health: finite(p.health, 100, 1, 100), armor: finite(p.armor, 35, 0, 100), cash: Math.floor(finite(p.cash, 250, 0, 10000000)),
      vehicle: ['sedan', 'sports', 'muscle', 'suv', 'pickup', 'bike', 'police', 'taxi'].includes(p.vehicle) ? p.vehicle : null },
    completed: [...new Set((Array.isArray(value.completed) ? value.completed : []).filter(id => allowed.includes(id)))],
    bags: [...new Set((Array.isArray(value.bags) ? value.bags : []).filter(id => Number.isInteger(id) && id >= 0 && id < 20))],
    stunts: [...new Set((Array.isArray(value.stunts) ? value.stunts : []).filter(id => Number.isInteger(id) && id >= 0 && id < 10))],
    settings: validateSettings(value.settings),
  };
}
export function readSave(storage) {
  try { storage ??= globalThis.localStorage; const text = storage?.getItem(SAVE_KEY); return text ? validateSave(JSON.parse(text)) : null; } catch { return null; }
}
export function writeSave(value, storage) {
  try { storage ??= globalThis.localStorage; const safe = validateSave(value); if (!safe || !storage) return false; storage.setItem(SAVE_KEY, JSON.stringify(safe)); return true; } catch { return false; }
}
