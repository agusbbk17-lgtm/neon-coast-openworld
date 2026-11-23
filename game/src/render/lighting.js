import * as THREE from '../../vendor/three.min.js';
import { clamp } from '../core/math.js';

export class Lighting {
  constructor(scene, materials) {
    this.materials = materials; this.time = 17.35; this.dayLength = 1200;
    this.sun = new THREE.DirectionalLight('#ffd6a0', 3.1); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -65;
    this.sun.shadow.camera.right = this.sun.shadow.camera.top = 65;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 310;
    this.sun.shadow.bias = -0.00016; this.sun.shadow.normalBias = 0.1; this.sun.shadow.radius = 3;
    this.hemisphere = new THREE.HemisphereLight('#b9d6e3', '#b19675', 1.45);
    scene.add(this.sun, this.sun.target, this.hemisphere);
    this.fill = new THREE.DirectionalLight('#b8e6ee', 0.55); this.fill.position.set(120, 80, -30); scene.add(this.fill); this.night = 0;
  }
  update(dt, target) {
    this.time = (this.time + dt * 24 / this.dayLength) % 24;
    const altitude = Math.sin((this.time - 6) / 24 * Math.PI * 2);
    this.night = 1 - clamp((altitude + 0.1) * 4, 0, 1);
    this.sun.position.set(target.x - 130, 28 + Math.max(0, altitude) * 150, target.z - 90);
    this.sun.target.position.set(target.x, 0, target.z);
    this.sun.intensity = 3.1 * (1 - this.night); this.hemisphere.intensity = 1.35 * (1 - this.night) + 0.3;
    this.fill.intensity = 0.35 + this.night * 0.25;
    for (const material of this.materials.facade) material.emissiveIntensity = this.night * 1.1;
    this.materials.neon.emissiveIntensity = 0.3 + this.night * 2;
  }
  configure(settings) {
    const size = settings.shadow || 512;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.mapSize.set(size, size); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.sun.castShadow = settings.shadow > 0;
  }
}
