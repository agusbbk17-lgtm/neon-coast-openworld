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
import { VehicleFleet } from './entities/vehicles.js';
import { createEnvironment } from './render/environment.js';
import { createRoadGraph } from './world/graph.js';
import { CameraDirector } from './camera/director.js';
import { AudioEngine } from './systems/audio.js';
import { Radio } from './systems/radio.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { readSave, writeSave } from './core/save.js';
import { TrafficSignals } from './world/signals.js';
import { Traffic } from './systems/traffic.js';
import { Pedestrians } from './entities/pedestrians.js';

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
  const restored = readSave();
  const world = new CityWorld(scene, params.get('seed') || restored?.seed || 'solmar-26');
  const player = new Player(scene, world), input = new Input(canvas), events = new Events();
  const fleet = new VehicleFleet(scene, world, player, events, notify);
  const environment = createEnvironment(renderer, scene);
  const graph = createRoadGraph(), director = new CameraDirector(world.seed), audio = new AudioEngine(params.has('noaudio'), world.seed, events), radio = new Radio(audio, world.seed);
  const rig = new CameraRig(camera, world.collision), postfx = new PostFX(renderer);
  rig.director = director; rig.fallbackVehicle = fleet.vehicles[0]; rig.notify = notify;
  const quality = new QualityManager(renderer, params.get('quality') || 'high', settings => {
    world.configure(settings); postfx.enabled = settings.post; postfx.material.uniforms.aoEnabled.value = settings.ao ? 1 : 0;
    renderer.setSize(innerWidth, innerHeight); postfx.resize();
  });
  let time = 0, notifyTimer = 0, frames = 0, sampleTime = 0, warmup = 0, routeTimer = 0, saveTimer = 12;
  const stats = { fps: 0, drawCalls: 0, triangles: 0, bootMs: 0, errors: [], warnings: [] };
  const ui = document.querySelector('#ui');
  function notify(text) { document.querySelector('#notification').textContent = text; document.querySelector('#notification').classList.add('visible'); notifyTimer = 4; }
  const loop = new FixedLoop(dt => {
    time += dt; input.poll(Boolean(player.vehicle)); rig.handle(input, player, dt);
    if (game.menus) game.menus.settings.camera = rig.preset;
    player.update(dt, input, rig.yaw);
    game.traffic.update(dt); fleet.update(dt, input); game.pedestrians.update(dt); world.update(dt, time, player); director.update(dt); notifyTimer -= dt;
    routeTimer -= dt; if (routeTimer <= 0 && game.waypoint) { game.setWaypoint(game.waypoint); routeTimer = 1; }
    audio.update(dt, game); radio.update(game); saveTimer -= dt;
    if (saveTimer <= 0 && game.hasStarted) { game.save(); saveTimer = 12; }
    input.endStep();
  }, (alpha, dt, elapsed) => {
    if (game.menus.isOpen) director.update(dt);
    const renderTime = Math.max(0, time - loop.step + alpha * loop.step);
    fleet.render(alpha, renderTime); game.pedestrians.render(alpha, renderTime); game.signals.render(); player.render(alpha, renderTime); rig.update(dt, player, input, renderTime); world.render(renderTime, camera);
    renderer.info.reset(); postfx.render(scene, camera, time, player.speed, world.lighting.night, rig.reduceMotion);
    stats.drawCalls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    frames++; sampleTime += elapsed; if (sampleTime >= 1) { stats.fps = frames / sampleTime; frames = sampleTime = 0; }
    warmup += elapsed; if (warmup > 3) quality.sample(elapsed * 1000, elapsed);
    if (notifyTimer < 0) document.querySelector('#notification').classList.remove('visible');
    game.hud.render(dt);
  });
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); postfx.resize(); };
  window.addEventListener('resize', resize); resize();
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); loop.paused = true; fatal.hidden = false; fatal.textContent = 'Graphics context lost. Waiting for restoration…'; });
  canvas.addEventListener('webglcontextrestored', () => { fatal.hidden = true; loop.paused = false; resize(); });
  const game = window.__game = { ready: false, version: 'M4', params, scene, renderer, camera, world, player, input, rig, quality, postfx, events, stats, loop, fleet, environment,
    graph, director, audio, radio, hasStarted: false, waypoint: null, route: [],
    notify, get time() { return time; },
    setWaypoint(point) { this.waypoint = point; this.route = graph.path(player, point).concat(point); },
    save() {
      return writeSave({ version: 1, seed: world.seed, player: { x: player.x, z: player.z, yaw: player.yaw, health: player.health,
        armor: player.armor, cash: player.cash, vehicle: player.vehicle?.type || null }, settings: this.menus?.settings,
        completed: [...(this.missions?.completed || [])], bags: [...(this.activities?.bags || [])], stunts: [...(this.activities?.stunts || [])] });
    },
    teleport(x, z, yaw = 0) {
      player.x = x; player.z = z; player.yaw = yaw;
      if (player.vehicle) { Object.assign(player.vehicle, { x, z, yaw, vx: 0, vz: 0, speed: 0 }); player.vehicle.snapshot(); }
      player.snapshot(); rig.reset(player);
    },
    state() { return { player: { x: player.x, y: player.y, z: player.z, state: player.state, vehicle: player.vehicle?.type || null },
      vehicle: player.vehicle ? { speed: player.vehicle.speed, gear: player.vehicle.gear, health: player.vehicle.health } : null,
      camera: rig.debug, stats: { ...stats }, seed: world.seed }; },
    step(seconds, controls = {}) {
      input.injected = controls; let clipped = false;
      for (let tick = 0; tick < Math.round(seconds * 60); tick++) {
        loop.beforeFrame?.(1 / 60);
        loop.update(1 / 60); fleet.render(1, time); player.render(1, time); rig.update(1 / 60, player, input, time);
        clipped ||= world.collision.contains(camera.position, 0.22);
      }
      input.injected = null; this.hud.render(); return { clipped, state: this.state() };
    },
    renderFrame() {
      fleet.render(1, time); this.pedestrians.render(1); this.signals.render(); player.render(1, time); rig.update(1 / 60, player, input, time); world.render(time, camera);
      renderer.info.reset(); postfx.render(scene, camera, time, player.speed, world.lighting.night, rig.reduceMotion);
      stats.drawCalls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
      this.hud.render(); if (notifyTimer < 0) document.querySelector('#notification').classList.remove('visible');
    },
  };
  game.signals = new TrafficSignals(scene, graph, world.materials); game.traffic = new Traffic(game, game.signals); game.pedestrians = new Pedestrians(game, game.signals);
  game.setWaypoint({ x: 320, z: -610 });
  game.hud = new HUD(ui, game, params.has('debug')); game.menus = new Menus(game, game.hud);
  loop.beforeFrame = dt => { input.poll(Boolean(player.vehicle)); game.menus.handle(input, dt); if (game.menus.isOpen) input.endStep(); };
  document.addEventListener('visibilitychange', () => audio.pause(document.hidden || game.menus.isOpen));
  const firstGesture = event => { if (event.isTrusted && game.hasStarted && !game.menus.isOpen && !audio.started) audio.start(); };
  document.addEventListener('pointerdown', firstGesture); document.addEventListener('keydown', firstGesture);
  window.addEventListener('error', event => stats.errors.push(event.message)); window.addEventListener('unhandledrejection', event => stats.errors.push(String(event.reason)));
  stats.bootMs = performance.now() - startedAt; document.querySelector('#loading').hidden = true;
  game.ready = true;
  if (params.has('testmode')) game.menus.start({ foot: true, intro: false, test: true });
  else if (params.has('continue')) game.menus.start({ load: true });
  if (!params.has('testmode')) loop.start();
  notify('Your Verve Vela is waiting. E to get in; WASD to drive.');
}
