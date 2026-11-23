import * as THREE from '../vendor/three.min.js';
import { FixedLoop } from './core/loop.js';
import { Input } from './core/input.js';
import { Events } from './core/events.js';
import { CityWorld } from './world/world.js';
import { Player } from './entities/humanoid.js';
import { CameraRig } from './camera/rig.js';
import { QualityManager } from './render/quality.js';
import { PostFX } from './render/postfx.js';
import { districtAt } from './data/city.js';

const params = new URLSearchParams(location.search), canvas = document.querySelector('#viewport');
const fatal = document.querySelector('#fatal'), startedAt = performance.now();
const contextOptions = { alpha: false, powerPreference: 'high-performance' };
const context = canvas.getContext('webgl2', { ...contextOptions, antialias: true })
  || canvas.getContext('webgl2', { ...contextOptions, antialias: false });
if (!context) {
  document.querySelector('#loading').hidden = true; fatal.hidden = false;
  fatal.textContent = 'Sunset Syndicate needs WebGL 2. Enable hardware acceleration in a current desktop browser, then reload.';
} else {
  try { boot(context); }
  catch (error) { fatal.hidden = false; fatal.textContent = 'Solmar Bay could not start: ' + error.message; document.querySelector('#loading').hidden = true; }
}
function boot(context) {
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.info.autoReset = false;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.08, 2600);
  const world = new CityWorld(scene, params.get('seed') || 'solmar-26');
  const player = new Player(scene, world), input = new Input(canvas), events = new Events();
  const rig = new CameraRig(camera, world.collision), postfx = new PostFX(renderer);
  const quality = new QualityManager(renderer, params.get('quality') || 'high', settings => {
    world.configure(settings); postfx.enabled = settings.post; postfx.material.uniforms.aoEnabled.value = settings.ao ? 1 : 0;
    renderer.setSize(innerWidth, innerHeight); postfx.resize();
  });
  let time = 0, notifyTimer = 0, frames = 0, sampleTime = 0;
  const stats = { fps: 0, drawCalls: 0, triangles: 0, bootMs: 0, errors: [], warnings: [] };
  const ui = document.querySelector('#ui');
  ui.innerHTML = '<div class="prototype"><h1>SUNSET SYNDICATE</h1><p>SOLMAR BAY / GOLDEN HOUR</p></div><div class="controls">WASD Walk · Mouse Look · Shift Sprint · Space Jump · C Crouch · V Camera · RMB Aim · X Shoulder · Alt Inspect</div>';
  const debug = document.createElement('div'); debug.className = 'debug'; debug.hidden = !params.has('debug'); ui.append(debug);
  function notify(text) { document.querySelector('#notification').textContent = text; document.querySelector('#notification').classList.add('visible'); notifyTimer = 4; }
  const loop = new FixedLoop(dt => {
    time += dt; input.poll(Boolean(player.vehicle)); rig.handle(input); player.update(dt, input, rig.yaw);
    world.update(dt, time, player); input.endStep();
  }, (alpha, dt, elapsed) => {
    const begin = performance.now(); player.render(alpha, time); rig.update(dt, player, input, time); world.render(time, camera);
    renderer.info.reset(); postfx.render(scene, camera, time, player.speed, world.lighting.night, rig.reduceMotion);
    stats.drawCalls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    frames++; sampleTime += elapsed; if (sampleTime >= 1) { stats.fps = frames / sampleTime; frames = sampleTime = 0; }
    if (time > 3) quality.sample(elapsed * 1000, elapsed); notifyTimer -= dt;
    if (notifyTimer < 0) document.querySelector('#notification').classList.remove('visible');
    if (!debug.hidden) debug.textContent = JSON.stringify({ ...rig.debug, fps: Math.round(stats.fps), draws: stats.drawCalls, district: districtAt(player.x, player.z) }, null, 2);
  });
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); postfx.resize(); };
  window.addEventListener('resize', resize); resize();
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); loop.paused = true; fatal.hidden = false; fatal.textContent = 'Graphics context lost. Waiting for restoration…'; });
  canvas.addEventListener('webglcontextrestored', () => { fatal.hidden = true; loop.paused = false; resize(); });
  window.__game = { ready: true, version: 'M1', scene, renderer, camera, world, player, input, rig, quality, postfx, events, stats, loop,
    notify, get time() { return time; },
    teleport(x, z, yaw = 0) { player.x = x; player.z = z; player.yaw = yaw; player.snapshot(); rig.reset(player); },
    state() { return { player: { x: player.x, y: player.y, z: player.z, state: player.state }, camera: rig.debug, stats: { ...stats }, seed: world.seed }; },
    step(seconds, controls = {}) {
      input.injected = controls; let clipped = false;
      for (let tick = 0; tick < Math.round(seconds * 60); tick++) {
        loop.update(1 / 60); player.render(1, time); rig.update(1 / 60, player, input, time);
        clipped ||= world.collision.contains(camera.position, 0.22);
      }
      input.injected = null; return { clipped, state: this.state() };
    },
    renderFrame() {
      player.render(1, time); rig.update(1 / 60, player, input, time); world.render(time, camera);
      renderer.info.reset(); postfx.render(scene, camera, time, player.speed, world.lighting.night, rig.reduceMotion);
      stats.drawCalls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    },
  };
  window.addEventListener('error', event => stats.errors.push(event.message)); window.addEventListener('unhandledrejection', event => stats.errors.push(String(event.reason)));
  stats.bootMs = performance.now() - startedAt; document.querySelector('#loading').hidden = true;
  if (!params.has('testmode')) loop.start();
  notify('Welcome to Solmar Bay. Click to look around. V changes camera distance.');
}
