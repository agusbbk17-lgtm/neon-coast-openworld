import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser, startServer } from './browser.mjs';

const destination = 'test-results';
mkdirSync(destination, { recursive: true });
const stopServer = await startServer();
const browser = await launchBrowser();
const errors = [], warnings = [], externalRequests = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
  if (message.type() === 'warning') warnings.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (!url.startsWith('http://127.0.0.1:8080/') && !url.startsWith('data:')) externalRequests.push(url);
});
const report = { browser: browser.version(), errors, warnings, externalRequests };
function checkpoint(stage) {
  report.stage = stage;
  writeFileSync(`${destination}/M7-smoke.json`, JSON.stringify(report, null, 2));
  console.log(`Smoke: ${stage}`);
}
async function captureCanvas(name) {
  const dataUrl = await page.evaluate(() => window.__game.renderer.domElement.toDataURL('image/jpeg', 0.86));
  writeFileSync(`${destination}/${name}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

try {
  checkpoint('boot');
  await page.goto('http://127.0.0.1:8080/?seed=solmar-26&quality=high&noaudio&testmode&debug');
  await page.waitForFunction(() => window.__game?.ready, { timeout: 45000 });
  report.boot = await page.evaluate(() => {
    const game = window.__game, gl = game.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
    return { milliseconds: game.stats.bootMs, renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'Unavailable', cameraPreset: game.rig.preset, state: game.state() };
  });
  assert.equal(report.boot.cameraPreset, 'Medium');
  assert.equal(report.boot.state.player.vehicle, null);
  checkpoint('walking route');

  // The route isolates movement/camera collision; live AI is checked separately.
  await page.evaluate(() => {
    const game = window.__game;
    game.quality.auto = false;
    game.traffic.paused = true;
    game.police.paused = true;
    for (const car of game.traffic.cars) car.active = false;
    game.rig.yaw = 0; game.rig.freeLookAge = -10;
  });
  report.walkOut = await page.evaluate(() => window.__game.step(3, { z: -1 }));
  assert.equal(report.walkOut.clipped, false);
  assert.ok(report.walkOut.state.player.z < 349);
  await page.evaluate(() => window.__game.renderFrame());
  await page.screenshot({ path: `${destination}/M7-foot.jpg`, type: 'jpeg', quality: 85 });
  report.walkBack = await page.evaluate(() => {
    window.__game.rig.freeLookAge = -10;
    return window.__game.step(3, { z: 1 });
  });
  assert.equal(report.walkBack.clipped, false);
  await page.keyboard.press('e');
  report.entry = await page.evaluate(() => window.__game.step(0.4));
  assert.equal(report.entry.state.player.vehicle, 'sports');
  assert.equal(report.entry.clipped, false);
  report.drive = await page.evaluate(() => {
    const game = window.__game;
    let clipped = false, passedTunnel = false, maxSpeed = 0, nearestBuilding = Infinity;
    const samples = [];
    for (let tick = 0; tick < 1416; tick++) {
      const car = game.player.vehicle;
      const control = car.speed > 43 ? 1 : -1;
      const result = game.step(1 / 60, { z: control });
      clipped ||= result.clipped;
      maxSpeed = Math.max(maxSpeed, Math.abs(car.speed));
      passedTunnel ||= car.z < -502;
      for (const building of game.world.buildings) nearestBuilding = Math.min(nearestBuilding, Math.hypot(car.x - building.x, car.z - building.z));
      if (tick % 120 === 0) samples.push({ seconds: (tick + 1) / 60, x: car.x, z: car.z, camera: { ...game.rig.debug } });
    }
    game.renderFrame();
    return { simulatedSeconds: 23.6, clipped, passedTunnel, maxSpeed, nearestBuilding, samples, state: game.state() };
  });
  assert.equal(report.drive.clipped, false, 'chase camera does not enter a solid on the fixed route');
  assert.equal(report.drive.passedTunnel, true, 'the route crosses the Sunline tunnel');
  assert.ok(report.drive.maxSpeed > 40 && report.drive.maxSpeed < 45);
  assert.ok(report.drive.nearestBuilding < 80, 'the route passes city buildings');
  assert.ok(report.drive.state.stats.drawCalls < 600);
  await page.screenshot({ path: `${destination}/M7-drive.jpg`, type: 'jpeg', quality: 85 });
  checkpoint('tunnel route complete; retry fixtures');

  report.teleportReset = await page.evaluate(() => {
    const game = window.__game;
    game.player.vehicle.driver = null; game.player.vehicle = null;
    game.teleport(-735, 450, 0);
    const hillY = game.player.y;
    game.player.vy = -12; game.player.velocity.x = 8; game.player.velocity.z = -9;
    game.player.speed = 12; game.player.grounded = false;
    game.teleport(329, 359, 0);
    return { hillY, y: game.player.y, grounded: game.player.grounded, speed: game.player.speed,
      verticalVelocity: game.player.vy, velocity: { ...game.player.velocity } };
  });
  assert.ok(report.teleportReset.hillY > 10);
  assert.ok(Math.abs(report.teleportReset.y + 0.005) < 1e-6);
  assert.equal(report.teleportReset.grounded, true);
  assert.equal(report.teleportReset.speed, 0);
  assert.equal(report.teleportReset.verticalVelocity, 0);
  assert.deepEqual(report.teleportReset.velocity, { x: 0, z: 0 });

  report.retryRegression = await page.evaluate(() => {
    const game = window.__game;
    const ride = game.fleet.spawn('sports', 326, 355, 0);
    game.fleet.enter(ride, true);
    game.missions.start('heat-wave'); game.step(4.7);
    const checkpoint = game.missions.machine.checkpoint;
    game.missions.fail('Synthetic retry regression fixture.');
    game.missions.targetCar.health = 0; game.missions.targetCar.exploded = true;
    game.player.health = 12; game.player.incapacitated = true;
    game.missions.retry();
    const result = { fixture: 'Explicit failure and destroyed-rival state; not a mission-completion playthrough.',
      checkpoint, state: game.missions.machine.state, step: game.missions.machine.step.type,
      rivalHealth: game.missions.targetCar.health, rivalActive: game.missions.targetCar.active,
      rivalAi: game.missions.targetCar.ai?.kind, rivalExploded: game.missions.targetCar.exploded,
      playerHealth: game.player.health, incapacitated: game.player.incapacitated };
    ride.active = false;
    if (game.player.vehicle) game.player.vehicle.active = false;
    game.missions.reset(); game.director.active = null; game.director.letterbox = false;
    return result;
  });
  assert.equal(report.retryRegression.checkpoint, 1);
  assert.equal(report.retryRegression.state, 'active');
  assert.equal(report.retryRegression.step, 'chase');
  assert.equal(report.retryRegression.rivalHealth, 72);
  assert.equal(report.retryRegression.rivalActive, true);
  assert.equal(report.retryRegression.rivalAi, 'rival');
  assert.equal(report.retryRegression.rivalExploded, false);
  assert.equal(report.retryRegression.playerHealth, 100);
  assert.equal(report.retryRegression.incapacitated, false);

  report.adaptation = await page.evaluate(() => {
    const quality = window.__game.quality;
    quality.set('high'); quality.auto = true;
    for (let phase = 0; phase < 7; phase++) for (let sample = 0; sample < 17; sample++) quality.sample(35, 0.25);
    const result = { settings: { ...quality.settings }, adjustments: quality.adjustments.slice() };
    quality.set('high'); quality.auto = false;
    return result;
  });
  assert.equal(report.adaptation.settings.ratio, 0.5);
  assert.equal(report.adaptation.settings.shadow, 0);
  assert.equal(report.adaptation.settings.post, false);
  checkpoint('live High 1080p warmup');

  // This is real rendering measured against wall time, not simulated game time.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.bringToFront();
  await page.evaluate(() => {
    const game = window.__game;
    game.menus.start({ intro: false, test: true });
    game.teleport(326, 355, 0);
    game.traffic.paused = false; game.police.paused = false;
    for (const car of game.traffic.cars) car.active = true;
    game.quality.set('high'); game.quality.auto = false;
    game.loop.start();
  });
  await page.waitForTimeout(3000);
  report.warmup = await page.evaluate(() => ({ loopRunning: window.__game.loop.running, documentHidden: document.hidden,
    paused: window.__game.loop.paused, fps: window.__game.stats.fps }));
  checkpoint('live 30-second High 1080p measurement');
  report.performance = await page.evaluate(async () => {
    const game = window.__game, original = game.loop.render, intervals = [], renderCosts = [];
    let previous = 0, drawCalls = 0;
    game.loop.render = function (...args) {
      const before = performance.now();
      original(...args);
      renderCosts.push(performance.now() - before);
      if (previous) intervals.push(before - previous);
      previous = before; drawCalls = Math.max(drawCalls, game.stats.drawCalls);
    };
    const began = performance.now();
    await new Promise(resolve => setTimeout(resolve, 30000));
    const elapsed = performance.now() - began;
    game.loop.render = original;
    game.loop.running = false;
    const ordered = intervals.slice().sort((a, b) => a - b);
    return { viewport: { width: innerWidth, height: innerHeight }, quality: game.quality.preset, automaticQuality: game.quality.auto,
      elapsedMilliseconds: elapsed, frames: renderCosts.length, fps: renderCosts.length * 1000 / elapsed,
      medianFrameMilliseconds: ordered[Math.floor(ordered.length / 2)] ?? null,
      p95FrameMilliseconds: ordered[Math.floor(ordered.length * 0.95)] ?? null,
      averageRenderMilliseconds: renderCosts.reduce((sum, cost) => sum + cost, 0) / Math.max(1, renderCosts.length),
      maximumDrawCalls: drawCalls, state: game.state() };
  });
  const softwareRenderer = /llvmpipe|swiftshader|software/i.test(report.boot.renderer);
  report.performance.hardwareTargetMeasured = !softwareRenderer;
  report.performance.target60FpsMet = !softwareRenderer ? report.performance.fps >= 55 : null;
  report.performance.limitation = softwareRenderer ? 'Software GPU under Xvfb; this result cannot verify midrange laptop GPU performance.' : 'Only the reported renderer and viewport were measured.';
  assert.ok(report.performance.frames > 0 && Number.isFinite(report.performance.fps));
  assert.ok(report.performance.fps > 0 && report.performance.fps < 500, 'measured FPS is finite and plausible');
  assert.ok(report.performance.maximumDrawCalls < 600);
  checkpoint('live measurement complete; context restoration');

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.__game.renderFrame());
  await captureCanvas('M7-live.jpg');
  const contextExtensionAvailable = await page.evaluate(() => {
    const game = window.__game;
    game.menus.show('pause');
    window.__smokeContextExtension = game.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!window.__smokeContextExtension) return false;
    window.__smokeContextExtension.loseContext();
    return true;
  });
  if (contextExtensionAvailable) {
    await page.waitForFunction(() => window.__game.renderer.getContext().isContextLost());
    assert.equal(await page.evaluate(() => window.__game.loop.paused), true);
    assert.equal(await page.locator('#fatal').isVisible(), true);
    await page.evaluate(() => window.__smokeContextExtension.restoreContext());
    await page.waitForFunction(() => !window.__game.renderer.getContext().isContextLost() && document.querySelector('#fatal').hidden, { timeout: 45000 });
    report.contextRestoration = await page.evaluate(() => {
      const game = window.__game;
      const menuStayedPaused = game.loop.paused && game.menus.isOpen;
      game.menus.close(false); game.renderFrame();
      delete window.__smokeContextExtension;
      return { tested: true, menuStayedPaused, drawCalls: game.stats.drawCalls, environmentReady: Boolean(game.scene.environment) };
    });
    assert.equal(report.contextRestoration.menuStayedPaused, true);
    assert.equal(report.contextRestoration.environmentReady, true);
    assert.ok(report.contextRestoration.drawCalls > 0);
    await captureCanvas('M7-restored.jpg');
  } else report.contextRestoration = { tested: false, limitation: 'WEBGL_lose_context is unavailable in this browser.' };
  report.route = { simulatedSeconds: 30, scope: 'Six seconds walking, eased vehicle entry, then 23.6 seconds driving past buildings and through the Sunline tunnel. This route isolates camera safety; it is not a police evasion playthrough.' };
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(externalRequests, []);
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack;
  throw error;
} finally {
  writeFileSync(`${destination}/M7-smoke.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close(); stopServer();
}
