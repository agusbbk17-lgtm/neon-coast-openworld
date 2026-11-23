// SPDX-License-Identifier: MIT
// Package the authored static game with the competition's unchanged SDK.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repository = fileURLToPath(new URL('.', import.meta.url));
const destination = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
if (destination === resolve(repository) || resolve(repository).startsWith(destination + '/')) {
  throw new Error('Output must not be the repository or its ancestor.');
}
mkdirSync(destination, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const source = join(repository, name);
  if (!existsSync(source)) throw new Error(`Missing ${name}/`);
  const target = join(destination, name);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true, dereference: false });
}
const shots = readdirSync(join(destination, 'screenshots')).filter(name => !name.startsWith('.'));
if (shots.length < 3 || shots.length > 4) throw new Error('Provide three or four genuine screenshots.');
writeFileSync(join(destination, 'dossier.json'), buildDossier(destination, {
  text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000,
}));
