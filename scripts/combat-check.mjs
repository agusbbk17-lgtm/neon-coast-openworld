import { launchBrowser, startServer } from './browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const stopServer = await startServer(), browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [], warnings = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:8080/?quality=high&seed=solmar-26&testmode&noaudio&debug');
  await page.waitForFunction(() => window.__game?.ready);
  const shots = await page.evaluate(() => {
    const g = window.__game; g.traffic.paused = true; g.police.paused = true;
    for (const car of g.traffic.cars) car.active = false; for (const npc of g.pedestrians.people) npc.active = false;
    g.rig.pitch = 0; g.input.keys.add('Mouse2'); g.step(0.6);
    const direction = g.camera.getWorldDirection(g.camera.position.clone()), distance = 18;
    const point = g.camera.position.clone().addScaledVector(direction, distance);
    const npc = g.pedestrians.spawn(point.x, point.z, 'rival'); npc.wait = 1000;
    g.input.keys.add('Mouse0'); g.step(0.8); g.input.keys.delete('Mouse0');
    return { health: npc.health, wanted: g.wanted.stars, ammo: g.combat.ammo };
  });
  assert.equal(shots.health, 0, 'aimed hitscan eliminates a rival'); assert.ok(shots.wanted >= 1); assert.ok(shots.ammo < 12);
  const reload = await page.evaluate(() => { const g = window.__game; g.combat.ammunition[2] = 0; g.input.pressed.add('KeyR'); g.step(1.4); return { ammo: g.combat.ammo, reserve: g.combat.reserve }; });
  assert.equal(reload.ammo, 12); assert.ok(reload.reserve < 96);
  const scope = await page.evaluate(() => { const g = window.__game; g.combat.select(6); g.step(1); return { mode: g.rig.mode, fov: g.camera.fov, distance: g.rig.debug.distance }; });
  assert.equal(scope.mode, 'scope'); assert.ok(Math.abs(scope.fov - 25) < 0.2); assert.ok(scope.distance < 0.15);
  const melee = await page.evaluate(() => { const g = window.__game; g.input.keys.delete('Mouse2'); g.combat.select(1); const npc = g.pedestrians.spawn(g.player.x, g.player.z - 1.5, 'rival'); npc.wait = 1000; g.input.keys.add('Mouse0'); g.step(0.6); g.input.keys.delete('Mouse0'); return npc.health; });
  assert.ok(melee < 100);
  await page.evaluate(() => { const g = window.__game; g.player.health = 0; g.step(0.2); });
  assert.equal(await page.evaluate(() => window.__game.death.phase), 'WASTED');
  await page.evaluate(() => window.__game.step(3.6)); assert.equal(await page.evaluate(() => window.__game.player.health), 100);
  await page.evaluate(() => { window.__game.death.start('BUSTED'); window.__game.step(3.6); });
  assert.equal(await page.evaluate(() => window.__game.death.phase), null);
  const grenade = await page.evaluate(() => { const g = window.__game; g.combat.select(5); g.input.keys.add('Mouse0'); g.step(0.05); g.input.keys.delete('Mouse0'); g.step(2.2); return { active: g.combat.grenades.items.some(item => item.active), sparks: g.combat.particles.items.filter(item => item.life > 0).length }; });
  assert.equal(grenade.active, false); assert.ok(grenade.sparks > 0);
  const cover = await page.evaluate(() => {
    const g = window.__game, b = g.world.buildings[2]; g.input.keys.delete('Mouse2'); g.teleport(b.x, b.z + b.depth / 2 + 0.65, 0);
    g.input.pressed.add('KeyC'); g.step(0.1); const active = Boolean(g.player.cover); g.input.keys.add('Mouse2'); g.step(0.2);
    const clipped = g.world.collision.contains(g.camera.position, 0.22); g.input.keys.add('ShiftLeft'); g.step(0.1); g.input.keys.delete('ShiftLeft'); g.input.keys.delete('Mouse2');
    g.teleport(329, 359, 0); return { active, clipped, exited: !g.player.cover };
  });
  assert.equal(cover.active, true); assert.equal(cover.clipped, false); assert.equal(cover.exited, true);
  const chase = await page.evaluate(() => {
    const g = window.__game; g.player.health = 100; g.wanted.reset(); g.police.paused = false; g.wanted.report(52, g.player); g.step(3.8);
    return { stars: g.wanted.stars, cruisers: g.police.cruisers.filter(car => car.active).length, blocks: g.police.blocks.length };
  });
  assert.ok(chase.stars >= 3); assert.ok(chase.cruisers >= 3); assert.ok(chase.blocks > 0);
  await page.evaluate(() => {
    const g = window.__game; g.traffic.paused = false; for (const car of g.traffic.cars) car.active = true; for (const npc of g.pedestrians.people) if (npc.faction === 'civilian' && npc.health > 0) npc.active = true;
    g.combat.select(2); g.input.keys.add('Mouse2'); g.rig.pitch = 0.10; g.step(0.3); g.renderFrame();
  });
  mkdirSync('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/M5-combat.jpg', type: 'jpeg', quality: 85 });
  const report = { shots, reload, scope, grenade, cover, chase, state: await page.evaluate(() => window.__game.state()), errors, warnings };
  writeFileSync('test-results/M5-combat.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
} finally { await browser.close(); stopServer(); }
