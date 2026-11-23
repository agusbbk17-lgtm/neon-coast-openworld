import { Minimap } from './minimap.js';
import { FullMap } from './map.js';
import { districtAt } from '../data/city.js';
import { distance2D } from '../core/math.js';

export class HUD {
  constructor(root, game, debug) {
    this.game = game; this.root = root;
    root.innerHTML = `<section id="hud" aria-label="Game status">
      <div class="hud-brand">SUNSET <b>SYNDICATE</b><small id="district"></small></div>
      <div class="objective"><span class="eyebrow">SOLMAR STORIES</span><h2 id="objective-title"></h2><p id="objective-text"></p><span id="objective-distance"></span></div>
      <div class="top-right"><div id="wanted" aria-label="Wanted level"></div><div class="money" id="cash"></div><div class="weapon"><span id="weapon">UNARMED</span><b id="ammo">—</b></div></div>
      <div class="map-widget"><canvas id="minimap" width="230" height="190" aria-label="Rotating minimap and GPS route"></canvas><div class="vitals"><i id="health"></i><i id="armor"></i></div><div class="map-caption">SOLMAR BAY <span>M · MAP</span></div></div>
      <div class="speed-widget" id="speed-widget"><div id="car-name"></div><b id="speed">000</b><span>KM/H <strong id="gear">1</strong></span><div class="car-health"><i id="car-health"></i></div></div>
      <div class="radio-widget" id="radio"><span class="radio-icon">♫</span><div><b id="station"></b><small id="track"></small></div><span class="key">Q</span></div>
      <div id="prompt" class="prompt"></div><div id="crosshair" hidden><i></i><i></i><i></i><i></i></div><div id="hit-marker" hidden>×</div>
      <div id="subtitles" role="status" aria-live="polite"></div><div id="cinema-title"></div><div id="phone" hidden><small>V E R V E · MOBILE</small><b>17:35</b><p>MARA VALE</p><span>Stay on the road. We'll talk.</span></div>
      <div class="letterbox" id="letterbox"><i></i><i></i></div><pre class="debug" id="debug"></pre>
    </section><section id="menu" hidden></section><section id="death-screen" hidden></section>`;
    this.nodes = Object.fromEntries([...root.querySelectorAll('[id]')].map(node => [node.id, node]));
    this.nodes.debug.hidden = !debug;
    this.minimap = new Minimap(this.nodes.minimap, game); this.fullMap = new FullMap(game, this.minimap); this.lastMap = 0;
  }
  render(dt = 0) {
    const g = this.game, p = g.player, n = this.nodes, car = p.vehicle;
    n.hud.hidden = g.menus?.isOpen || false;
    if (n.hud.hidden) return;
    n.district.textContent = districtAt(p.x, p.z); n.cash.textContent = '$ ' + Math.floor(p.cash).toLocaleString('en-US');
    const stars = g.wanted?.stars || 0; n.wanted.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars); n.wanted.classList.toggle('searching', Boolean(stars && g.wanted?.searching));
    n.health.style.width = Math.max(0, p.health) + '%'; n.armor.style.width = Math.max(0, p.armor) + '%';
    const weapon = g.combat?.current; n.weapon.textContent = weapon?.name || 'UNARMED'; n.ammo.textContent = weapon?.magazine ? `${g.combat.ammo} / ${g.combat.reserve}` : '—';
    n['speed-widget'].hidden = !car;
    if (car) { n.speed.textContent = String(Math.round(Math.abs(car.speed) * 3.6)).padStart(3, '0'); n.gear.textContent = car.gear; n['car-name'].textContent = car.config.name.toUpperCase(); n['car-health'].style.width = car.health + '%'; }
    const objective = g.missions?.objective || { title: 'Welcome to Solmar Bay', text: 'Take a drive along the Sunline coast', target: g.waypoint };
    n['objective-title'].textContent = objective.title; n['objective-text'].textContent = objective.text;
    const distance = objective.target ? distance2D(p, objective.target) : 0;
    n['objective-distance'].textContent = distance > 999 ? (distance / 1000).toFixed(2) + ' KM' : distance ? Math.round(distance) + ' M' : '';
    const station = g.radio?.current; n.radio.hidden = !car || !station; n.station.textContent = station?.name || 'RADIO OFF'; n.track.textContent = station ? station.track + ' · ' + station.genre : '';
    const nearby = !car && g.fleet.nearest();
    n.prompt.textContent = p.cover ? 'C · LEAVE COVER  /  RMB · PEEK' : car ? 'E · EXIT   SPACE · HANDBRAKE   V · CAMERA' : nearby ? 'E · ENTER ' + nearby.config.name.toUpperCase() : 'SHIFT · SPRINT   RMB · AIM   ESC · PAUSE';
    n.crosshair.hidden = !p.aiming || Boolean(car); n['hit-marker'].hidden = !(g.combat?.hitTimer > 0);
    const cinematic = g.director.letterbox || g.rig.cinematic;
    n.letterbox.classList.toggle('active', cinematic); n.letterbox.style.setProperty('--bar-size', Math.max(0, (innerHeight - innerWidth / 2.39) / 2) + 'px');
    n['cinema-title'].textContent = g.director.title; n.subtitles.textContent = g.missions?.subtitle || g.director.subtitle || '';
    n.phone.hidden = !g.rig.phone;
    if (!n.debug.hidden) n.debug.textContent = JSON.stringify({ ...g.rig.debug, fps: Math.round(g.stats.fps), calls: g.stats.drawCalls, ratio: g.quality.settings.ratio.toFixed(2) }, null, 2);
    this.lastMap += dt; if (this.lastMap > 0.07 || dt === 0) { this.minimap.render(); this.lastMap = 0; }
  }
}
