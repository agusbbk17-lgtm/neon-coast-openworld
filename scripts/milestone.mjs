import { launchBrowser, startServer } from './browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const milestone = process.argv[2] || 'M1';
console.log('Launching milestone browser:', milestone);
const stopServer = await startServer();
const browser = await launchBrowser(); console.log('Browser ready:', browser.version());
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], warnings = [], external = [];
page.on('pageerror', error => { errors.push(error.message); console.log('Runtime error:', error.message); });
page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.log('Console error:', message.text()); } if (message.type() === 'warning') { warnings.push(message.text()); console.log('Console warning:', message.text()); } });
page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:8080') && !request.url().startsWith('data:')) external.push(request.url()); });
try {
  console.log('Opening Solmar Bay');
  await page.goto('http://127.0.0.1:8080/?seed=solmar-26&quality=low&noaudio&debug&testmode', { waitUntil: 'load' });
  console.log('Page loaded');
  console.log('Initial state:', await page.evaluate(() => ({ ready: Boolean(window.__game?.ready), time: window.__game?.time, fatal: document.querySelector('#fatal').textContent })));
  await page.waitForFunction(() => window.__game?.ready, { timeout: 30000 });
  if (!['M1', 'M2', 'M3'].includes(milestone)) await page.evaluate(() => { const g = window.__game; g.traffic.paused = true; for (const car of g.traffic.cars) car.active = false; });
  if (!['M1', 'M2'].includes(milestone)) {
    await page.evaluate(() => window.__game.menus.show('settings'));
    await page.locator('[data-setting="camera"]').selectOption('Far');
    assert.equal(await page.evaluate(() => window.__game.rig.preset), 'Far');
    await page.locator('[data-setting="camera"]').selectOption('Medium');
    await page.locator('[data-setting="reduceMotion"]').check();
    assert.equal(await page.evaluate(() => window.__game.rig.reduceMotion), true);
    await page.locator('[data-setting="reduceMotion"]').uncheck();
    await page.evaluate(() => window.__game.menus.show('map'));
    await page.locator('#full-map').click({ position: { x: 160, y: 190 } });
    assert.ok(await page.evaluate(() => window.__game.route.length > 0));
    await page.evaluate(() => { const g = window.__game; g.menus.close(false); g.setWaypoint({ x: 320, z: -610 }); });
    assert.ok(await page.evaluate(() => window.__game.save()));
    assert.equal(await page.evaluate(() => window.__game.audio.context), null, 'noaudio creates no AudioContext');
  }
  await page.evaluate(() => window.__game.step(0.4));
  console.log('Boot:', await page.evaluate(() => window.__game.state()));
  const start = await page.evaluate(() => window.__game.player.z);
  const walked = await page.evaluate(() => window.__game.step(1.5, { z: -1 }));
  assert.equal(walked.clipped, false);
  const end = await page.evaluate(() => window.__game.player.z); assert.ok(end < start - 1, 'W moves the player');
  for (const preset of ['Far', 'Near', 'Medium']) {
    await page.keyboard.press('v');
    await page.evaluate(() => window.__game.step(0.15));
    assert.equal(await page.evaluate(() => window.__game.rig.preset), preset);
  }
  await page.evaluate(() => { window.__game.input.keys.add('Mouse2'); });
  await page.evaluate(() => window.__game.step(0.4));
  assert.equal(await page.evaluate(() => window.__game.rig.mode), 'aim');
  await page.evaluate(() => { window.__game.input.keys.delete('Mouse2'); });
  const collision = await page.evaluate(() => {
    const g = window.__game, b = g.world.buildings[2]; g.teleport(b.x, b.z + b.depth / 2 + 0.55, Math.PI);
    g.player.render(1, g.time); g.rig.update(1 / 60, g.player, g.input, g.time);
    return { hits: g.rig.collision.hits, clipped: g.world.collision.contains(g.camera.position, 0.22) };
  });
  assert.ok(collision.hits > 0, 'wall triggers camera collision'); assert.equal(collision.clipped, false, 'camera stays outside solid');
  if (milestone !== 'M1') {
    await page.evaluate(() => { window.__game.teleport(329, 359, 0); window.__game.step(0.3); });
    await page.keyboard.press('e');
    await page.evaluate(() => window.__game.step(0.18));
    assert.equal(await page.evaluate(() => window.__game.player.transition?.mode), 'enter');
    await page.evaluate(() => window.__game.step(0.25));
    assert.equal(await page.evaluate(() => window.__game.player.vehicle?.type), 'sports');
    const driven = await page.evaluate(() => window.__game.step(8, { z: -1 }));
    assert.equal(driven.clipped, false, 'chase camera stays outside buildings');
    assert.ok(driven.state.vehicle.speed > 35, 'car accelerates');
    assert.ok(driven.state.camera.fov > 68, 'driving FOV scales with speed');
    await page.keyboard.press('t'); await page.evaluate(() => window.__game.step(0.25));
    assert.equal(await page.evaluate(() => window.__game.rig.mode), 'phone');
    await page.keyboard.press('t'); await page.evaluate(() => window.__game.step(3, { z: 1 }));
    if (!['M1', 'M2'].includes(milestone)) {
      await page.evaluate(() => { const g = window.__game; g.input.keys.add('KeyV'); g.input.pressed.add('KeyV'); g.step(0.7); });
      assert.equal(await page.evaluate(() => window.__game.rig.mode), 'cinematic');
      await page.evaluate(() => { const g = window.__game; g.input.keys.delete('KeyV'); g.input.released.add('KeyV'); g.step(0.1); g.rig.cinematic = false; });
    }
    await page.keyboard.press('e'); await page.evaluate(() => window.__game.step(0.45));
    assert.equal(await page.evaluate(() => window.__game.player.vehicle), null, 'vehicle exit completes');
    assert.equal(await page.evaluate(() => window.__game.player.transition), null);
    await page.evaluate(() => { const g = window.__game; g.fleet.enter(g.fleet.vehicles[0], true); g.teleport(326, 355, 0); g.step(0.6); });
  }
  if (!['M1', 'M2', 'M3'].includes(milestone)) {
    const ai = await page.evaluate(() => {
      const g = window.__game; g.traffic.paused = false; for (const car of g.traffic.cars) car.active = true;
      const cars = g.traffic.cars.map(car => ({ x: car.x, z: car.z })), people = g.pedestrians.people.map(p => ({ x: p.x, z: p.z }));
      g.teleport(326, 355, 0); g.step(10);
      return { carsMoving: g.traffic.cars.filter((car, i) => Math.hypot(car.x - cars[i].x, car.z - cars[i].z) > 1).length,
        peopleMoving: g.pedestrians.people.filter((p, i) => Math.hypot(p.x - people[i].x, p.z - people[i].z) > 0.5).length };
    });
    assert.ok(ai.carsMoving > 8, 'live traffic moves'); assert.ok(ai.peopleMoving > 12, 'pedestrians walk sidewalks');
    console.log('AI check:', ai);
  }
  await page.evaluate(() => { const g = window.__game; if (!g.player.vehicle) g.teleport(329, 359, 0); else g.teleport(326, 355, 0); g.quality.auto = false; g.step(4.2); g.quality.set('high'); g.renderFrame(); });
  await page.waitForTimeout(1000);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: `test-results/${milestone}.jpg`, type: 'jpeg', quality: 85 });
  const gpu = await page.evaluate(() => { const gl = window.__game.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'Unknown'; });
  const report = { milestone, browser: browser.version(), renderer: gpu, state: await page.evaluate(() => window.__game.state()), errors, warnings, external };
  writeFileSync(`test-results/${milestone}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []); assert.deepEqual(external, []);
} finally { await browser.close(); stopServer(); }
