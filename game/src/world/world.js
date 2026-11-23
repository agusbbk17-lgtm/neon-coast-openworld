import * as THREE from '../../vendor/three.min.js';
import { createMaterials } from '../render/materials.js';
import { Lighting } from '../render/lighting.js';
import { CollisionWorld } from '../systems/collision.js';
import { createTerrain } from './terrain.js';
import { createRoads } from './roads.js';
import { generateBuildings, buildBuildingChunks } from './buildings.js';
import { createProps } from './props.js';
import { Sky } from './sky.js';
import { Water } from './water.js';
import { ChunkStreamer } from './chunks.js';

export class CityWorld {
  constructor(scene, seed) {
    this.scene = scene; this.seed = seed; this.materials = createMaterials(seed);
    this.collision = new CollisionWorld(); this.buildings = generateBuildings(seed);
    this.sky = new Sky(scene); this.water = new Water(scene); createTerrain(scene, this.materials); createRoads(scene, this.materials);
    const chunks = buildBuildingChunks(this.buildings, scene, this.materials, this.collision);
    this.chunks = new ChunkStreamer(chunks, this.buildings, scene, this.materials); createProps(scene, this.materials, seed, this.collision);
    this.lighting = new Lighting(scene, this.materials); scene.fog = new THREE.FogExp2('#cfb99e', 0.0009);
  }
  update(dt, time, player) { this.lighting.update(dt, player); this.chunks.update(dt, player); this.water.update(time, this.lighting.night); }
  render(time, camera) {
    this.sky.material.uniforms.sun.value.copy(this.lighting.sun.position).sub(this.lighting.sun.target.position).normalize();
    this.sky.update(time, this.lighting.night, camera.position);
    this.scene.fog.color.set(this.lighting.night > 0.5 ? '#172d3b' : '#cfb99e');
  }
  configure(settings) { this.chunks.range = settings.range; this.lighting.configure(settings); }
}
