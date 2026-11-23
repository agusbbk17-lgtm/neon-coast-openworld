import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QualityManager, QUALITY } from '../game/src/render/quality.js';

function setup(preset = 'high') {
  const applied = [];
  const renderer = { shadowMap: { enabled: false }, setPixelRatio(value) { this.ratio = value; } };
  const quality = new QualityManager(renderer, preset, value => applied.push({ ...value }));
  return { quality, renderer, applied };
}

test('quality presets apply copies without mutating their definitions', () => {
  const { quality, renderer } = setup('ultra');
  assert.equal(renderer.ratio, 1.25);
  assert.equal(renderer.shadowMap.enabled, true);
  quality.settings.ratio = 0.55;
  assert.equal(QUALITY.ultra.ratio, 1.25);
  quality.set('not-a-preset');
  assert.equal(quality.preset, 'high');
  assert.equal(quality.settings.ratio, 1);
});

test('automatic adaptation waits for sustained cost and recovers its budget', () => {
  const { quality, applied } = setup();
  for (let frame = 0; frame < 180; frame++) quality.sample(21, 1 / 60);
  assert.equal(quality.adjustments.length, 0);
  assert.ok(quality.overBudget > 2.9);
  for (let frame = 0; frame < 300; frame++) quality.sample(16, 1 / 60);
  assert.ok(quality.overBudget < 1.1);
  for (let frame = 0; frame < 240; frame++) quality.sample(30, 1 / 60);
  assert.equal(quality.adjustments.length, 1);
  assert.equal(quality.stage, 1);
  assert.ok(applied.length > 1);
});

test('adaptation lowers resolution before shadows and post effects', () => {
  const { quality, renderer } = setup();
  while (quality.settings.ratio > 0.5) {
    assert.equal(quality.degrade(), true);
    assert.equal(quality.stage, 1);
    assert.equal(quality.settings.shadow, 2048);
    assert.equal(quality.settings.post, true);
  }
  quality.degrade();
  assert.equal(quality.stage, 2);
  assert.equal(quality.settings.shadow, 1024);
  quality.degrade();
  assert.equal(quality.settings.shadow, 0);
  assert.equal(renderer.shadowMap.enabled, false);
  assert.equal(quality.settings.post, true);
  quality.degrade();
  assert.equal(quality.stage, 3);
  assert.equal(quality.settings.post, false);
  assert.equal(quality.settings.ao, false);
  assert.equal(quality.degrade(), false);
  assert.equal(quality.settings.ratio, 0.5);
});

test('manual quality does not adapt and invalid measurements are ignored', () => {
  const { quality } = setup();
  quality.auto = false;
  for (let frame = 0; frame < 600; frame++) quality.sample(100, 1 / 60);
  assert.equal(quality.adjustments.length, 0);
  quality.auto = true;
  quality.sample(NaN, 1 / 60);
  quality.sample(Infinity, 1 / 60);
  assert.equal(quality.overBudget, 0);
  quality.set('low');
  assert.equal(quality.stage, 0);
  assert.equal(quality.settings.post, false);
});
