import { DEFAULT_SETTINGS, readSave, validateSettings } from '../core/save.js';
import { CITY } from '../data/city.js';

export class Menus {
  constructor(game, hud) {
    this.game = game; this.hud = hud; this.root = hud.nodes.menu; this.isOpen = false; this.page = 'main'; this.padOld = []; this.padCooldown = 0;
    this.settings = validateSettings(readSave()?.settings || DEFAULT_SETTINGS);
    if (game.params.get('quality')) this.settings = validateSettings({ ...this.settings, quality: game.params.get('quality') });
    this.applySettings(); this.show('main');
  }
  applySettings() {
    const g = this.game, s = this.settings;
    if (g.quality.preset !== s.quality) g.quality.set(s.quality);
    g.quality.auto = s.autoQuality; g.rig.setPreset(s.camera); g.rig.baseFov = s.fov; g.rig.sensitivity = s.sensitivity;
    g.rig.reduceMotion = s.reduceMotion; g.rig.handheld = s.handheld; g.audio.applyVolumes(s);
    if (s.reduceMotion) { g.director.active = null; g.director.letterbox = false; g.rig.cinematic = false; }
  }
  show(page = 'pause') {
    this.page = page; this.isOpen = true; this.root.hidden = false; this.game.loop.paused = true;
    this.game.input.enabled = false; this.game.input.clear(); this.game.audio.pause(true); this.game.director.menu = page === 'main';
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.nodes.hud.hidden = true;
    if (page === 'main') this.main(); else if (page === 'settings') this.settingsPage(); else if (page === 'map') this.mapPage(); else if (page === 'jobs' && this.game.missions) this.game.missions.menu(this.root); else this.pausePage();
    this.root.querySelector('button')?.focus();
  }
  close(lock = true) {
    this.isOpen = false; this.root.hidden = true; this.hud.nodes.hud.hidden = false;
    this.game.loop.paused = false; this.game.director.menu = false; this.game.input.clear(); this.game.input.enabled = true;
    this.game.audio.pause(false);
    if (lock && navigator.userActivation?.isActive) this.game.input.lock();
  }
  main() {
    const saved = readSave();
    this.root.innerHTML = `<div class="menu-shade"></div><main class="main-menu"><div class="sun-logo"></div><p class="eyebrow">A SOLMAR BAY STORY</p><h1 class="brand">SUNSET<span>SYNDICATE</span></h1><p class="tagline">Paradise has a price.<br>Find your own way through the city.</p><div class="menu-actions"><button class="primary" id="start-game">ENTER SOLMAR BAY <span>→</span></button>${saved ? '<button id="continue-game">CONTINUE STORY</button>' : ''}<button id="open-settings">SETTINGS</button></div><p class="menu-note">Original city. Procedural everything.<br>Keyboard + mouse / gamepad · Audio starts when you play.</p></main><div class="menu-location">26° N / SOLMAR BAY <b>GOLDEN HOUR</b></div>`;
    this.root.querySelector('#start-game').onclick = () => this.start();
    this.root.querySelector('#continue-game')?.addEventListener('click', () => this.start({ load: true }));
    this.root.querySelector('#open-settings').onclick = () => this.show('settings');
  }
  start(options = {}) {
    const g = this.game, saved = options.load ? readSave() : null;
    if (saved && saved.seed !== g.world.seed) {
      const url = new URL(location.href); url.searchParams.set('seed', saved.seed); url.searchParams.set('continue', '1'); location.href = url.href; return;
    }
    this.close(!options.test);
    g.hasStarted = true;
    g.director.active = null; g.director.title = ''; g.director.subtitle = ''; g.director.letterbox = false;
    if (saved) {
      Object.assign(g.player, saved.player); g.player.vehicle = null;
      g.teleport(saved.player.x, saved.player.z, saved.player.yaw);
      if (saved.player.vehicle) { const car = g.fleet.spawn(saved.player.vehicle, saved.player.x, saved.player.z, saved.player.yaw); g.fleet.enter(car, true); }
      g.missions?.restore(saved.completed); g.activities?.restore(saved.bags, saved.stunts);
    } else {
      g.player.health = 100; g.player.armor = 35; g.player.cash = 250;
      g.missions?.reset(); g.wanted?.reset(); g.player.vehicle = null; g.player.transition = null;
      g.teleport(CITY.spawn.x, CITY.spawn.z, CITY.spawn.yaw);
      if (!options.foot) g.fleet.enter(g.fleet.vehicles[0], true);
    }
    if (options.intro !== false && !this.settings.reduceMotion) g.director.start('SOLMAR BAY', g.player.vehicle || g.player, 'MARA VALE: Sunshine is free. Everything else has a price.');
    if (!options.test && navigator.userActivation?.isActive) g.audio.start().then(started => { if (started) g.audio.tone(420, 0.09, 0.08); });
    g.player.snapshot(); g.rig.reset(g.player); g.hud.render();
  }
  pausePage() {
    this.root.innerHTML = `<div class="modal"><p class="eyebrow">SUNSET SYNDICATE</p><h1>Take a breath.</h1><p class="muted">Solmar Bay will still be here.</p><div class="pause-actions"><button class="primary" data-action="resume">RESUME</button><button data-action="map">CITY MAP</button>${this.game.missions ? '<button data-action="jobs">STORIES & ACTIVITIES</button>' : ''}<button data-action="settings">SETTINGS</button><button data-action="save">SAVE GAME</button><button data-action="main">MAIN MENU</button></div><div class="controls-grid"><span>WASD · Move / drive</span><span>Mouse · Look</span><span>E / F · Enter / exit</span><span>V · Camera preset</span><span>RMB · Aim · X · Shoulder</span><span>Space · Jump / handbrake</span><span>1–5 / Wheel · Weapons</span><span>Q · Radio · H · Horn</span><span>T · Driver phone view</span><span>Alt · Standing inspect</span></div></div>`;
    this.root.querySelectorAll('[data-action]').forEach(button => { button.onclick = () => {
      const action = button.dataset.action;
      if (action === 'resume') this.close(); else if (action === 'save') this.game.notify(this.game.save() ? 'Story saved on this device.' : 'Saving is unavailable in this browser.'); else this.show(action);
    }; });
  }
  settingsPage() {
    const s = this.settings, select = (key, choices) => `<select data-setting="${key}">${choices.map(value => `<option value="${value}" ${s[key] === value ? 'selected' : ''}>${value.toUpperCase()}</option>`).join('')}</select>`;
    const slider = (label, key, min, max, step) => `<label>${label}<input aria-label="${label}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
    const check = (label, key) => `<label>${label}<input data-setting="${key}" type="checkbox" ${s[key] ? 'checked' : ''}></label>`;
    this.root.innerHTML = `<div class="modal settings"><p class="eyebrow">MAKE IT YOUR OWN</p><h1>Settings</h1><div class="settings-columns"><div><h2>Display & camera</h2><label>Quality ${select('quality', ['low', 'med', 'high', 'ultra'])}</label><label>Camera distance ${select('camera', ['Near', 'Medium', 'Far'])}</label>${slider('Vertical FOV', 'fov', 50, 85, 1)}${slider('Look sensitivity', 'sensitivity', 0.25, 3, 0.05)}${check('Automatic quality', 'autoQuality')}${check('Reduce motion', 'reduceMotion')}${check('Handheld sway', 'handheld')}</div><div><h2>Sound</h2>${slider('Master volume', 'master', 0, 1, 0.05)}${slider('Music volume', 'music', 0, 1, 0.05)}${slider('Effects volume', 'effects', 0, 1, 0.05)}<p class="muted">All engines, ambience and radio music are synthesized.<br>No recorded music or external assets.</p><p class="muted">Camera: V · Shoulder: X<br>Hold V in a car for cinematic mode.<br>Reduce motion disables sway and impact shake.</p></div></div><button id="settings-back" class="primary">BACK</button></div>`;
    this.root.querySelectorAll('[data-setting]').forEach(input => { input.oninput = () => {
      const key = input.dataset.setting; this.settings[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      this.settings = validateSettings(this.settings); this.applySettings(); this.game.save();
    }; });
    this.root.querySelector('#settings-back').onclick = () => this.show(this.game.hasStarted ? 'pause' : 'main');
  }
  mapPage() {
    this.root.innerHTML = '<div class="modal map-modal"><p class="eyebrow">THE WHOLE COAST IS YOURS</p><h1>Solmar Bay</h1><p class="muted">Click anywhere to set your GPS waypoint.</p><canvas id="full-map" width="600" height="600" aria-label="City map: click to set a waypoint"></canvas><button class="primary" id="map-back">BACK</button></div>';
    this.hud.fullMap.attach(this.root.querySelector('#full-map')); this.root.querySelector('#map-back').onclick = () => this.close();
  }
  handle(input, dt) {
    this.padCooldown = Math.max(0, this.padCooldown - dt);
    if (input.pressed.delete('Escape')) { if (this.isOpen && this.game.hasStarted) this.close(); else this.show(this.game.hasStarted ? 'pause' : 'main'); }
    if (input.pressed.delete('KeyM')) { if (this.isOpen && this.page === 'map') this.close(); else this.show('map'); }
    if (!this.isOpen) {
      if (input.take('KeyQ')) { const station = this.game.radio.cycle(); this.game.notify(station ? station.name + ' · ' + station.genre : 'Radio off.'); }
      return;
    }
    const pad = Array.from(navigator.getGamepads?.() || []).find(pad => pad?.connected); if (!pad) return;
    const controls = [...this.root.querySelectorAll('button,select,input')]; if (!controls.length) return;
    let index = Math.max(0, controls.indexOf(document.activeElement));
    if (this.padCooldown === 0 && (pad.buttons[12]?.pressed || pad.buttons[13]?.pressed || Math.abs(pad.axes[1]) > 0.6)) {
      index = (index + (pad.buttons[12]?.pressed || pad.axes[1] < -0.6 ? -1 : 1) + controls.length) % controls.length;
      controls[index].focus(); this.padCooldown = 0.18;
    }
    if (this.padCooldown === 0 && (pad.buttons[14]?.pressed || pad.buttons[15]?.pressed || Math.abs(pad.axes[0]) > 0.6)) {
      const control = controls[index], direction = pad.buttons[14]?.pressed || pad.axes[0] < -0.6 ? -1 : 1;
      if (control.type === 'range') control.value = Math.max(Number(control.min), Math.min(Number(control.max), Number(control.value) + direction * Number(control.step || 1)));
      if (control.tagName === 'SELECT') control.selectedIndex = Math.max(0, Math.min(control.options.length - 1, control.selectedIndex + direction));
      control.dispatchEvent(new Event('input', { bubbles: true })); this.padCooldown = 0.18;
    }
    if (pad.buttons[0]?.pressed && !this.padOld[0]) controls[index].click();
    this.padOld = pad.buttons.map(button => button.pressed);
  }
}
