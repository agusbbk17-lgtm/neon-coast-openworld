import { launchBrowser, startServer } from './browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const stopServer = await startServer(), browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [], warnings = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:8080/?quality=high&seed=solmar-26&testmode&noaudio');
  await page.waitForFunction(() => window.__game?.ready);
  await page.evaluate(() => { const g = window.__game; g.menus.show('main'); g.step(1); g.renderFrame(); });
  assert.equal(await page.locator('#start-game').isVisible(), true);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/M3-menu.jpg', type: 'jpeg', quality: 82 });
  await page.locator('#start-game').click();
  const intro = await page.evaluate(() => { const g = window.__game; g.step(1); return { mode: g.rig.mode, active: Boolean(g.director.active) }; });
  assert.equal(intro.active, true); assert.equal(intro.mode, 'intro');
  const chase = await page.evaluate(() => window.__game.step(4, { z: -0.4 }));
  assert.equal(chase.clipped, false); assert.equal(chase.state.camera.mode, 'vehicle');
  await page.evaluate(() => window.__game.renderFrame());
  await page.screenshot({ path: 'test-results/M3-opening.jpg', type: 'jpeg', quality: 82 });
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
  const report = { menu: true, cinematicIntro: intro, chase: chase.state.camera, errors, warnings };
  writeFileSync('test-results/ui.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); stopServer(); }
