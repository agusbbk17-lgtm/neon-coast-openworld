import { clamp } from './math.js';

const prevent = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft']);
export const gamepadBindings = vehicle => vehicle
  ? ['Space', 'KeyR', 'KeyR', 'KeyE', 'Mouse2', 'Mouse0', null, null, 'KeyM', 'Escape', 'KeyH', 'KeyB', 'KeyT', 'KeyB', 'KeyV', 'KeyQ']
  : ['Space', 'KeyC', 'KeyR', 'KeyE', 'KeyQ', 'KeyH', 'Mouse2', 'Mouse0', 'KeyM', 'Escape', 'ShiftLeft', 'AltLeft', 'KeyT', 'KeyV', 'KeyX', 'BracketRight'];
export class Input {
  constructor(canvas) {
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set(); this.released = new Set();
    this.look = { x: 0, y: 0 }; this.padMove = { x: 0, z: 0 }; this.padLook = { x: 0, y: 0 };
    this.padButtons = []; this.padHeld = new Set(); this.wheel = 0; this.lastLookTime = 0;
    this.injected = null; this.enabled = true; this.gamepad = false;
    window.addEventListener('keydown', event => {
      if (prevent.has(event.code) && event.target === document.body) event.preventDefault();
      if (!this.keys.has(event.code)) this.pressed.add(event.code); this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => { this.keys.delete(event.code); this.released.add(event.code); });
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('mousemove', event => {
      if (document.pointerLockElement === canvas || (event.buttons & 4)) {
        this.look.x += event.movementX; this.look.y += event.movementY; this.lastLookTime = performance.now();
      }
    });
    canvas.addEventListener('mousedown', event => {
      const key = 'Mouse' + event.button; this.keys.add(key); this.pressed.add(key);
      if (event.button === 0 && this.enabled) this.lock();
    });
    window.addEventListener('mouseup', event => { const key = 'Mouse' + event.button; this.keys.delete(key); this.released.add(key); });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('wheel', event => { event.preventDefault(); this.wheel += Math.sign(event.deltaY); }, { passive: false });
  }
  lock() {
    if (!document.pointerLockElement) {
      try { const result = this.canvas.requestPointerLock(); result?.catch?.(() => {}); } catch { /* Unsupported context. */ }
    }
  }
  poll(vehicle = false) {
    const pad = Array.from(navigator.getGamepads?.() || []).find(value => value?.connected);
    this.gamepad = Boolean(pad);
    if (!pad) { this.padMove.x = this.padMove.z = this.padLook.x = this.padLook.y = 0; this.padHeld.clear(); return; }
    const deadzone = value => Math.abs(value || 0) < 0.15 ? 0 : value;
    this.padMove = { x: deadzone(pad.axes[0]), z: deadzone(pad.axes[1]) };
    this.padLook = { x: deadzone(pad.axes[2]), y: deadzone(pad.axes[3]) };
    const bindings = gamepadBindings(vehicle);
    this.padHeld.clear();
    pad.buttons.forEach((button, index) => {
      const key = bindings[index]; if (!key) return;
      if (button.pressed) this.padHeld.add(key);
      if (button.pressed && !this.padButtons[index]) this.pressed.add(key);
      if (!button.pressed && this.padButtons[index]) this.released.add(key);
      this.padButtons[index] = button.pressed;
    });
    this.triggerThrottle = pad.buttons[7]?.value || 0; this.triggerBrake = pad.buttons[6]?.value || 0;
  }
  down(key) { return this.enabled && (this.injected?.keys?.includes(key) || this.keys.has(key) || this.padHeld.has(key)); }
  take(key) { const yes = this.pressed.has(key); this.pressed.delete(key); return this.enabled && yes; }
  up(key) { const yes = this.released.has(key); this.released.delete(key); return this.enabled && yes; }
  axes() {
    if (!this.enabled) return { x: 0, z: 0 };
    if (this.injected) return { x: this.injected.x || 0, z: this.injected.z || 0 };
    return { x: clamp((this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0) + this.padMove.x, -1, 1),
      z: clamp((this.down('KeyS') ? 1 : 0) - (this.down('KeyW') ? 1 : 0) + this.padMove.z, -1, 1) };
  }
  consumeLook(dt) {
    const result = { x: this.look.x + this.padLook.x * dt * 600, y: this.look.y + this.padLook.y * dt * 600 };
    this.look.x = this.look.y = 0;
    if (Math.abs(result.x) + Math.abs(result.y) > 0.05) this.lastLookTime = performance.now(); return result;
  }
  clear() { this.keys.clear(); this.pressed.clear(); this.released.clear(); this.look.x = this.look.y = 0; }
  endStep() { this.pressed.clear(); this.released.clear(); this.wheel = 0; }
}
