import { launchBrowser, startServer } from './browser.mjs';
import { mkdirSync, readdirSync, unlinkSync, copyFileSync } from 'node:fs';

const stopServer = await startServer(), browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], warnings = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:8080/?seed=solmar-26&quality=high&noaudio&testmode');
  await page.waitForFunction(() => window.__game?.ready);
  mkdirSync('screenshots', { recursive: true }); mkdirSync('docs/verification', { recursive: true });
  for (const name of readdirSync('screenshots')) if (/^(1-start|2-play|3-end)\.jpg$/.test(name)) unlinkSync('screenshots/' + name);
  const poses = [
    { name: '1-coast.jpg', x: 329, z: 359, yaw: 0 },
    { name: '2-city.jpg', x: 60, z: 80, yaw: 0.65 },
    { name: '3-park.jpg', x: -361, z: 358, yaw: -0.25 },
  ];
  for (const pose of poses) {
    console.log('Rendering:', pose.name);
    await page.evaluate(p => { const g = window.__game; g.teleport(p.x, p.z, p.yaw); g.quality.auto = false; g.step(0.6); g.renderFrame(); }, pose);
    await page.screenshot({ path: 'screenshots/' + pose.name, type: 'jpeg', quality: 82, timeout: 180000 });
  }
  copyFileSync('screenshots/1-coast.jpg', 'docs/verification/M1.jpg');
  console.log(JSON.stringify({ errors, warnings, state: await page.evaluate(() => window.__game.state()) }, null, 2));
  if (errors.length || warnings.length) throw new Error('Capture encountered browser diagnostics.');
} finally { await browser.close(); stopServer(); }
