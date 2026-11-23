import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { launchBrowser, startServer } from './browser.mjs';

const stopServer = await startServer(), browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], warnings = [], external = [], shots = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:8080/') && !request.url().startsWith('data:')) external.push(request.url()); });
async function screenshot(name) {
  await page.evaluate(() => window.__game.renderFrame());
  await page.screenshot({ path: 'screenshots/' + name, type: 'jpeg', quality: 82, timeout: 180000 });
  assert.ok(statSync('screenshots/' + name).size < 262144);
  shots.push({ name, state: await page.evaluate(() => window.__game.state()) });
  console.log('Captured:', name);
}
try {
  await page.goto('http://127.0.0.1:8080/?seed=solmar-26&quality=high&noaudio&testmode');
  await page.waitForFunction(() => window.__game?.ready, { timeout: 45000 });
  mkdirSync('screenshots', { recursive: true }); mkdirSync('docs/verification', { recursive: true });
  await page.evaluate(() => {
    const g = window.__game; g.quality.auto = false;
    g.menus.start({ test: true, intro: false }); g.world.lighting.time = 17.10;
    g.missions.start('first-delivery'); g.step(4.7); g.fleet.exit(); g.step(0.4); g.fleet.enter(g.fleet.vehicles[0]); g.step(0.4);
    g.teleport(326, 395, 0); g.step(2, { z: -1 }); g.rig.yaw = -0.13; g.rig.freeLookAge = 0; g.step(0.3);
  });
  await screenshot('1-coast.jpg');
  await page.evaluate(() => {
    const g = window.__game; g.menus.start({ test: true, foot: true, intro: false });
    g.teleport(-180, -332, -Math.PI / 2); g.world.lighting.time = 17.20;
    g.missions.start('vault-run'); g.step(4.7); g.rig.yaw = -Math.PI / 2; g.rig.freeLookAge = 0; g.step(0.3);
  });
  await screenshot('2-city.jpg');
  await page.evaluate(() => {
    const g = window.__game; g.menus.start({ test: true, intro: false });
    g.teleport(-300, 412, 0); g.world.lighting.time = 17.20; g.missions.start('heat-wave'); g.step(4.7);
    g.teleport(-300, 412, 0); g.rig.yaw = -0.36; g.rig.freeLookAge = 0; g.step(0.3);
    g.wanted.report(52, g.player); g.step(2.4);
  });
  await screenshot('3-park.jpg');
  await page.evaluate(() => {
    const g = window.__game; g.menus.start({ test: true, foot: true, intro: false });
    g.teleport(329, 365, 0); g.world.lighting.time = 17.20;
    g.missions.start('vault-run'); g.step(4.7); g.wanted.report(52, g.player); g.step(6);
    g.player.health = 100; g.player.armor = 50;
    g.combat.select(2); g.input.keys.add('Mouse2'); g.rig.yaw = 0; g.rig.freeLookAge = 0; g.step(0.3);
  });
  await screenshot('4-heat.jpg');
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []); assert.deepEqual(external, []);
  writeFileSync('docs/verification/gallery.json', JSON.stringify({ browser: browser.version(), scope: 'Unedited real browser renders of maker-staged gameplay fixtures; not evidence of a manual playthrough.', shots, errors, warnings, external }, null, 2));
} finally { await browser.close(); stopServer(); }
