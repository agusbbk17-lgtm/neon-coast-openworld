import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Browser automation is development tooling, not a shipped game dependency.
const localTools = resolve('../tooling/browser');
export async function startServer() {
  const base = 'http://127.0.0.1:8080/';
  try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return () => {}; } catch { /* Start an owned local server. */ }
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const child = spawn(process.execPath, ['serve.ts'], { cwd: repository, stdio: ['ignore', 'inherit', 'inherit'] });
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return () => child.kill('SIGTERM'); } catch { /* Wait for listen. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill('SIGTERM'); throw new Error('Local server did not start.');
}
export async function launchBrowser() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(resolve(localTools, 'browsers'))) process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(localTools, 'browsers');
  const require = createRequire(import.meta.url);
  let playwright;
  try { playwright = require('playwright'); }
  catch { playwright = require(resolve(localTools, 'node_modules/playwright')); }
  const mesa = process.env.SOLMAR_TEST_GPU === 'mesa';
  const args = ['--no-sandbox', '--disable-gpu-sandbox', '--disable-gpu-watchdog', '--use-gl=angle'];
  if (mesa) args.push('--use-angle=gl', '--ignore-gpu-blocklist', '--disable-gpu-driver-bug-workarounds', '--disable-accelerated-2d-canvas', '--disable-features=SkiaGraphite,Vulkan');
  else args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  return playwright.chromium.launch({ headless: !mesa, args, ...(process.env.SOLMAR_BROWSER ? { executablePath: process.env.SOLMAR_BROWSER } : {}) });
}
