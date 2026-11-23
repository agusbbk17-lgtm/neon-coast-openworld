import * as THREE from '../../vendor/three.min.js';
import { Instances } from '../render/geometry.js';

export class ChunkStreamer {
  constructor(chunks, records, scene, materials) {
    this.chunks = chunks; this.range = 620; this.timer = 0; this.visible = 0;
    const batch = new Instances(), cube = new THREE.BoxGeometry(1, 1, 1), horizonMaterial = materials.surface('#93aab0');
    for (const b of records) if (b.height > 28) batch.add('horizon', cube, horizonMaterial,
      [b.x, b.height / 2, b.z], [b.width * 0.997, b.height * 0.998, b.depth * 0.997]);
    this.horizon = new THREE.Group(); batch.build(this.horizon, false); scene.add(this.horizon);
  }
  update(dt, position) {
    this.timer -= dt; if (this.timer > 0) return; this.timer = 0.35; this.visible = 0;
    for (const chunk of this.chunks) {
      const distance = Math.hypot(chunk.x - position.x, chunk.z - position.z); chunk.group.visible = distance < this.range;
      if (chunk.group.visible) this.visible++;
      for (const mesh of chunk.group.children) mesh.castShadow = distance < 130;
    }
  }
}
