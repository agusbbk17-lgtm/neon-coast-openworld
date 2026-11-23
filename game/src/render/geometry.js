import * as THREE from '../../vendor/three.min.js';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const boxPositions = unitBox.attributes.position.array, boxNormals = unitBox.attributes.normal.array;
const boxIndices = unitBox.index.array;

export function box(width, height, depth, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; return mesh;
}
export class Instances {
  constructor() { this.batches = new Map(); this.dummy = new THREE.Object3D(); }
  add(key, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], color = null) {
    if (!this.batches.has(key)) this.batches.set(key, { geometry, material, entries: [] });
    this.batches.get(key).entries.push({ position, scale, rotation, color });
  }
  build(parent, shadows = true) {
    const meshes = [];
    for (const batch of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.entries.length);
      mesh.castShadow = shadows; mesh.receiveShadow = true;
      batch.entries.forEach((entry, index) => {
        this.dummy.position.fromArray(entry.position); this.dummy.scale.fromArray(entry.scale);
        this.dummy.rotation.set(...entry.rotation); this.dummy.updateMatrix(); mesh.setMatrixAt(index, this.dummy.matrix);
        if (entry.color) mesh.setColorAt(index, new THREE.Color(entry.color));
      });
      mesh.computeBoundingSphere(); parent.add(mesh); meshes.push(mesh);
    }
    return meshes;
  }
}
// Merge transformed boxes into one indexed geometry with per-vertex colors.
export class BoxBatch {
  constructor() { this.positions = []; this.normals = []; this.colors = []; this.indices = []; this.color = new THREE.Color(); }
  add(x, y, z, width, height, depth, color) {
    const start = this.positions.length / 3, p = boxPositions, n = boxNormals, c = this.color.set(color);
    for (let i = 0; i < p.length; i += 3) {
      this.positions.push(p[i] * width + x, p[i + 1] * height + y, p[i + 2] * depth + z);
      this.normals.push(n[i], n[i + 1], n[i + 2]); this.colors.push(c.r, c.g, c.b);
    }
    for (const index of boxIndices) this.indices.push(start + index);
  }
  build(material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3)); geometry.setIndex(this.indices);
    geometry.computeBoundingSphere(); const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true; return mesh;
  }
}
