import { launchBrowser, startServer } from './browser.mjs';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';

const stopServer = await startServer(), browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } }), errors = [], warnings = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:8080/?quality=low&seed=solmar-26&testmode');
  await page.waitForFunction(() => window.__game?.ready);
  assert.equal(await page.evaluate(() => window.__game.audio.context), null, 'audio waits for a gesture');
  await page.evaluate(() => window.__game.menus.show('main'));
  await page.locator('#start-game').click();
  await page.waitForFunction(() => window.__game.audio.started);
  await page.evaluate(() => { const g = window.__game; g.director.active = null; g.step(3, { z: -1 }); g.audio.applyVolumes({ master: 0.2, music: 0.1, effects: 0.3 }); });
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => ({ state: window.__game.audio.context.state, rpm: window.__game.player.vehicle.rpm,
    frequency: window.__game.audio.engine.frequency.value, volume: window.__game.audio.master.gain.value, station: window.__game.radio.current.name }));
  assert.equal(state.state, 'running'); assert.ok(state.frequency > 40); assert.ok(Math.abs(state.volume - 0.2) < 0.02);
  await page.evaluate(() => window.__game.audio.pause(true)); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__game.audio.context.state), 'suspended');
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
  mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/audio.json', JSON.stringify({ state, errors, warnings }, null, 2));
  console.log(JSON.stringify({ state, errors, warnings }, null, 2));
} finally { await browser.close(); stopServer(); }
