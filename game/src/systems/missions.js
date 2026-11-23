import * as THREE from '../../vendor/three.min.js';
import { MISSION_DEFINITIONS } from '../data/missions.js';
import { MissionStateMachine } from './mission-state.js';
import { distance2D } from '../core/math.js';
import { steeringToward } from './ai.js';
import { walkSurfaceHeight } from '../world/terrain.js';

export class MissionSystem {
  constructor(game) {
    this.game = game; this.machine = new MissionStateMachine(); this.completed = new Set(); this.targetCar = null; this.pendingResults = false; this.paid = false; this.checkpointPose = null; this.rivalRoute = [];
    this.marker = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: '#f8c777', emissive: '#ffc26b', emissiveIntensity: 1.8, roughness: 0.4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.10, 6, 40), material); ring.rotation.x = Math.PI / 2; this.marker.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 10, 6), material); beam.position.y = 5; this.marker.add(beam);
    this.marker.visible = false; game.scene.add(this.marker);
    game.events.on('new-game', ({ loaded, test }) => { if (!loaded && !test) this.start('first-delivery', false); });
  }
  context() {
    const g = this.game;
    return { player: g.player, inVehicle: Boolean(g.player.vehicle), speed: g.player.vehicle?.speed || 0, enterSerial: g.fleet.enterSerial,
      target: this.targetCar, targetHealth: this.targetCar?.health ?? 100, wanted: g.wanted.stars, dead: g.player.health <= 0 || g.player.incapacitated, interact: g.input.down('KeyE') || g.input.down('KeyF') };
  }
  get objective() {
    if (!this.machine.definition || this.machine.state === 'idle') return null;
    const step = this.machine.step;
    if (!step) return { title: this.machine.definition.name, text: 'Story complete. J opens Mara’s board.', target: null };
    const progress = step.type === 'interact' ? ` ${this.machine.progress.toFixed(1)} / ${step.duration}s` : '';
    return { title: this.machine.definition.name, text: step.text + progress, target: step.dynamic ? this.targetCar : step.target || null };
  }
  get subtitle() { return this.machine.state === 'intro' ? this.machine.definition?.intro : this.machine.stepTime < 5 ? this.machine.step?.dialogue || '' : ''; }
  restore(ids) { this.reset(); this.completed = new Set(ids); }
  reset() {
    this.completed.clear(); this.machine.cancel(); if (this.targetCar) this.targetCar.active = false;
    this.targetCar = null; this.marker.visible = false; this.pendingResults = false; this.checkpointPose = null; this.rivalRoute = [];
  }
  start(id, closeMenu = true) {
    const definition = MISSION_DEFINITIONS.find(mission => mission.id === id); if (!definition) return false;
    const g = this.game; if (closeMenu) g.menus.close(false);
    g.wanted.reset(); g.police.clear(); g.player.health = Math.max(g.player.health, 85); g.player.incapacitated = false;
    this.machine.start(definition, this.context()); this.pendingResults = false; this.paid = false; this.checkpointPose = null;
    if (this.targetCar) this.targetCar.active = false; this.targetCar = null;
    if (id === 'heat-wave') this.resetRival();
    g.director.start(definition.name.toUpperCase(), g.player.vehicle || g.player, definition.intro, 4.5); this.enterStep(); return true;
  }
  resetRival() {
    const g = this.game, node = g.graph.nearest({ x: g.player.x, z: g.player.z - 105 });
    this.targetCar ||= this.rivalSlot ||= g.fleet.spawn('muscle', node.x + 3.5, node.z + 20, 0, '#c5654c');
    Object.assign(this.targetCar, { x: node.x + 3.5, z: node.z + 20, yaw: 0, health: 72, driver: 'rival', active: true,
      vx: 0, vz: 0, vy: 0, speed: 0, impact: 0, steering: 0, exploded: false, flipped: false, tyreDamage: false, engineDamage: false,
      ai: { kind: 'rival' }, controls: {} });
    this.targetCar.y = walkSurfaceHeight(this.targetCar.x, this.targetCar.z); this.targetCar.snapshot();
    const goals = ['8:0', '0:0', '0:10', '8:10'], route = []; let from = node;
    for (const goal of goals) { const segment = g.graph.path(from, goal); route.push(...segment); from = g.graph.nodes.get(goal); }
    this.rivalRoute = route;
  }
  enterStep() {
    const g = this.game, step = this.machine.step;
    if (step?.minHeat) g.wanted.report(Math.max(0, step.minHeat - g.wanted.heat), g.player);
    const target = step?.dynamic ? this.targetCar : step?.target;
    g.setWaypoint(target || null);
    this.marker.visible = Boolean(target);
  }
  updateInputs(input) {
    const step = this.machine.step;
    this.game.player.interacting = this.machine.state === 'active' && step?.type === 'interact' && !this.game.player.vehicle && distance2D(this.game.player, step.target) < step.radius && (input.down('KeyE') || input.down('KeyF'));
  }
  preUpdate() {
    if (this.targetCar?.active && this.targetCar.health > 0 && this.targetCar.ai?.kind === 'rival' && this.rivalRoute.length) {
      while (this.rivalRoute.length > 1 && distance2D(this.targetCar, this.rivalRoute[0]) < 12) this.rivalRoute.shift();
      if (this.rivalRoute.length === 1 && distance2D(this.targetCar, this.rivalRoute[0]) < 12) this.rivalRoute = this.game.graph.path(this.rivalRoute[0], '8:0');
      const point = this.rivalRoute[0]; this.targetCar.controls = steeringToward(this.targetCar, { x: point.x + 3.5, z: point.z }, 20);
    }
  }
  update(dt) {
    const g = this.game, before = this.machine.index, oldState = this.machine.state;
    this.machine.update(dt, this.context());
    if (this.machine.index !== before) {
      if (this.machine.checkpoint === this.machine.index) this.checkpointPose = { x: g.player.x, z: g.player.z, yaw: g.player.yaw, vehicle: g.player.vehicle?.type || null };
      this.enterStep();
    }
    if (oldState !== 'complete' && this.machine.state === 'complete') {
      const id = this.machine.definition.id, reward = this.completed.has(id) ? 0 : this.machine.definition.reward;
      g.player.cash += reward; this.completed.add(id); this.paid = true; this.reward = reward; this.pendingResults = true; this.marker.visible = false; g.save();
    }
    if (oldState !== 'failed' && this.machine.state === 'failed') this.pendingResults = true;
    if (this.pendingResults && !g.death.phase) { this.pendingResults = false; this.results(); }
    const target = this.objective?.target;
    if (target && this.marker.visible) this.marker.position.set(target.x, walkSurfaceHeight(target.x, target.z) + 0.2, target.z);
  }
  fail(reason) { this.machine.fail(reason); if (this.machine.state === 'failed') this.pendingResults = true; }
  retry() {
    const g = this.game; g.menus.close(false); g.wanted.reset(); g.police.clear(); g.player.health = 100; g.player.armor = 35;
    g.player.incapacitated = false; g.player.transition = null; g.player.interacting = false;
    if (this.checkpointPose) {
      if (g.player.vehicle) g.player.vehicle.driver = null;
      g.player.vehicle = null; const pose = this.checkpointPose; g.teleport(pose.x, pose.z, pose.yaw);
      if (pose.vehicle) g.fleet.enter(g.fleet.spawn(pose.vehicle, pose.x, pose.z, pose.yaw), true);
    }
    if (this.machine.definition?.id === 'heat-wave' && this.machine.checkpoint < 3) this.resetRival();
    this.machine.retry(this.context()); this.pendingResults = false; this.enterStep();
  }
  results() {
    const g = this.game, success = this.machine.state === 'complete'; g.menus.show('pause'); g.menus.page = 'results';
    g.menus.root.innerHTML = `<div class="modal mission-results"><p class="eyebrow">${success ? 'STORY COMPLETE' : 'CHECKPOINT AVAILABLE'}</p><h1>${this.machine.definition.name}</h1><p class="muted">${success ? 'A little more of Solmar belongs to you.' : this.machine.reason}</p><div class="result-stats"><b>${success ? '$ ' + this.reward.toLocaleString('en-US') : 'RETRY'}</b><span>${this.machine.elapsed.toFixed(1)}s · ${this.completed.size} / 3 stories</span></div><div class="pause-actions">${success ? '<button class="primary" id="mission-continue">CONTINUE</button>' : '<button class="primary" id="mission-retry">RETRY CHECKPOINT</button>'}<button id="mission-board">MARA’S BOARD</button></div></div>`;
    g.menus.root.querySelector('#mission-continue')?.addEventListener('click', () => { this.machine.cancel(); g.menus.close(); });
    g.menus.root.querySelector('#mission-retry')?.addEventListener('click', () => this.retry());
    g.menus.root.querySelector('#mission-board').onclick = () => g.menus.show('jobs');
  }
  menu(root) {
    root.innerHTML = `<div class="modal"><p class="eyebrow">MARA VALE · SOLMAR STORIES</p><h1>Paradise has a price.</h1><p class="muted">Rian Calder is a courier with one borrowed car and a city full of bad bargains.</p><div class="mission-cards">${MISSION_DEFINITIONS.map(mission => `<article><span class="eyebrow">${this.completed.has(mission.id) ? 'COMPLETED ✓' : 'STORY'}</span><h2>${mission.name}</h2><p>${mission.description}</p><b>$ ${mission.reward.toLocaleString('en-US')}</b><button data-mission="${mission.id}">START STORY →</button></article>`).join('')}</div><button id="jobs-back" class="primary">BACK</button></div>`;
    root.querySelectorAll('[data-mission]').forEach(button => { button.onclick = () => this.start(button.dataset.mission); });
    root.querySelector('#jobs-back').onclick = () => this.game.menus.close();
  }
}
