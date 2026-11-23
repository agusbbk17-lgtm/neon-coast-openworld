import { launchBrowser, startServer } from './browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const stopServer = await startServer(), browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [], warnings = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:8080/?quality=high&seed=solmar-26&testmode&noaudio&debug');
  await page.waitForFunction(() => window.__game?.ready); mkdirSync('test-results', { recursive: true });
  await page.evaluate(() => {
    const g = window.__game; g.police.paused = true; g.traffic.paused = true;
    for (const car of g.traffic.cars) car.active = false; for (const npc of g.pedestrians.people) npc.active = false;
    g.menus.show('jobs');
  });
  assert.equal(await page.locator('[data-mission]').count(), 3);
  await page.locator('[data-mission="first-delivery"]').click();
  await page.evaluate(() => window.__game.step(4.7));
  await page.keyboard.press('e'); await page.evaluate(() => window.__game.step(0.5));
  assert.equal(await page.evaluate(() => window.__game.missions.machine.step.type), 'deliver');
  const delivery = await page.evaluate(async () => {
    const { steeringToward } = await import('/src/systems/ai.js');
    const g = window.__game, target = { x: 320, z: -610 }; let clipped = false, ticks = 0;
    while (g.missions.machine.state === 'active' && ticks++ < 3600) {
      const v = g.player.vehicle, d = Math.hypot(v.x - target.x, v.z - target.z), pace = Math.min(40, Math.sqrt(Math.max(0, d - 8) * 26));
      const c = steeringToward(v, target, pace), brake = Math.abs(v.speed) > pace + 0.6;
      const result = g.step(1 / 60, { x: c.steer, z: brake ? 1 : -c.throttle }); clipped ||= result.clipped;
    }
    return { state: g.missions.machine.state, ticks, clipped, completed: [...g.missions.completed], z: g.player.z };
  });
  assert.equal(delivery.state, 'complete'); assert.equal(delivery.clipped, false); assert.ok(delivery.completed.includes('first-delivery'));
  console.log('Delivery:', delivery);
  await page.locator('#mission-board').click(); await page.locator('[data-mission="heat-wave"]').click();
  await page.evaluate(() => window.__game.step(4.7));
  const rival = await page.evaluate(async () => {
    const { steeringToward } = await import('/src/systems/ai.js'); const { heading } = await import('/src/core/math.js');
    const g = window.__game; g.combat.select(3); g.input.keys.add('Mouse2'); let ticks = 0, clipped = false;
    while (g.missions.targetCar.health > 0 && ticks++ < 2400 && g.player.health > 0) {
      const v = g.player.vehicle, target = g.missions.targetCar, d = Math.hypot(v.x - target.x, v.z - target.z), route = g.graph.path(v, target);
      let point = target, pace = d > 65 ? 36 : 16;
      if (route.length > 1) {
        const first = route[0], ahead = (first.x - v.x) * -Math.sin(v.yaw) + (first.z - v.z) * -Math.cos(v.yaw), near = Math.hypot(first.x - v.x, first.z - v.z);
        point = near < 18 || ahead < -5 ? route[1] : first;
        if (near < 65 && ahead > 0) pace = 15;
      }
      const c = steeringToward(v, point, pace); g.rig.yaw = heading(target.x - v.x, target.z - v.z); g.rig.freeLookAge = 0;
      const muzzle = { x: v.x, y: v.y + 0.9, z: v.z }, end = { x: target.x, y: target.y + 0.9, z: target.z };
      if (d < 108 && g.world.collision.sweep(muzzle, end, 0.02).fraction > 0.99) g.input.keys.add('Mouse0'); else g.input.keys.delete('Mouse0');
      const result = g.step(1 / 60, { x: c.steer, z: v.speed > pace + 1 ? 1 : -c.throttle }); clipped ||= result.clipped;
    }
    g.input.keys.delete('Mouse0'); g.input.keys.delete('Mouse2');
    g.step(0.1);
    return { health: g.missions.targetCar.health, state: g.missions.machine.state, step: g.missions.machine.step?.type, ticks, clipped, ammo: g.combat.ammo,
      player: { x: g.player.x, z: g.player.z, health: g.player.health, carHealth: g.player.vehicle?.health }, target: { x: g.missions.targetCar.x, z: g.missions.targetCar.z } };
  });
  console.log('Rival:', rival); assert.equal(rival.health, 0); assert.equal(rival.clipped, false); assert.equal(rival.step, 'escape');
  // The escape gate is checked with an explicit unseen-LOS fixture; the police
  // response itself is independently exercised by combat-check and the smoke.
  const escape = await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 120; i++) { g.wanted.update(0.25, false); g.missions.update(0.25); if (g.missions.machine.state === 'complete') break; } return g.missions.machine.state; });
  assert.equal(escape, 'complete');
  await page.locator('#mission-board').click(); await page.locator('[data-mission="vault-run"]').click();
  await page.evaluate(() => { const g = window.__game; g.teleport(-180, -330, 0); g.step(4.7); });
  assert.equal(await page.evaluate(() => window.__game.missions.machine.step.type), 'interact');
  await page.keyboard.press('e'); await page.evaluate(() => window.__game.step(0.5));
  const bankWalk = await page.evaluate(() => {
    const g = window.__game, points = [{ x: g.player.x, z: -337 }, { x: -125, z: -337 }, { x: -125, z: -330 }];
    let ticks = 0, clipped = false;
    for (const point of points) while (Math.hypot(g.player.x - point.x, g.player.z - point.z) > 0.8 && ticks++ < 1800) {
      g.rig.yaw = Math.atan2(-(point.x - g.player.x), -(point.z - g.player.z)); g.rig.freeLookAge = 0;
      const result = g.step(1 / 60, { z: -1, keys: ['ShiftLeft'] }); clipped ||= result.clipped;
    }
    g.step(0.25); return { x: g.player.x, clipped };
  });
  console.log('Bank walk:', bankWalk);
  assert.equal(bankWalk.clipped, false); assert.ok(bankWalk.x > -132);
  await page.keyboard.down('e'); await page.evaluate(() => window.__game.step(4.2)); await page.keyboard.up('e');
  const bank = await page.evaluate(() => ({ stage: window.__game.missions.machine.step.type, stars: window.__game.wanted.stars, checkpoint: window.__game.missions.machine.checkpoint }));
  assert.equal(bank.stage, 'escape'); assert.ok(bank.stars >= 3); console.log('Bank:', bank);
  await page.evaluate(() => {
    const g = window.__game; g.police.paused = false; g.traffic.paused = false; for (const v of g.traffic.cars) v.active = true;
    for (const npc of g.pedestrians.people) if (npc.faction === 'civilian' && npc.health > 0) npc.active = true;
    g.player.health = 100; g.rig.pitch = 0.12; g.input.keys.delete('Mouse2'); g.step(1); g.renderFrame();
  });
  await page.screenshot({ path: 'test-results/M6.jpg', type: 'jpeg', quality: 85 });
  const completed = await page.evaluate(() => { const g = window.__game; g.police.paused = true; for (let i = 0; i < 120; i++) { g.wanted.update(0.25, false); g.missions.update(0.25); if (g.missions.machine.state === 'complete') break; } return [...g.missions.completed]; });
  assert.deepEqual(completed.sort(), ['first-delivery', 'heat-wave', 'vault-run']);
  const report = { delivery, rival, bankWalk, bank, completed, escapeFixture: 'Unseen LOS supplied to the real WantedSystem; not a manual evasion playthrough.', errors, warnings };
  writeFileSync('test-results/M6.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
} finally { await browser.close(); stopServer(); }
