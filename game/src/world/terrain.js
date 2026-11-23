import * as THREE from '../../vendor/three.min.js';
import { CITY } from '../data/city.js';
import { clamp } from '../core/math.js';

export function groundHeight(x, z) {
  if (x > CITY.shore) return -0.75;
  if (CITY.streetsX.some(street => Math.abs(street - x) < 17) || CITY.streetsZ.some(street => Math.abs(street - z) < 17)) return 0;
  const hill = Math.exp(-((x + 748) ** 2 / 6400 + (z - 450) ** 2 / 32000)) * 22; return Math.max(0, hill - 0.5);
}
export function walkSurfaceHeight(x, z) {
  if (x >= CITY.shore && x < 470) return -0.22;
  const onRoad = CITY.streetsX.some(street => Math.abs(street - x) < CITY.roadWidth / 2)
    || (x < 345 && CITY.streetsZ.some(street => Math.abs(street - z) < CITY.roadWidth / 2));
  return groundHeight(x, z) + (onRoad ? 0.05 : 0.18);
}
export function createTerrain(scene, materials) {
  const geometry = new THREE.PlaneGeometry(1570, 1570, 96, 96); geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position, colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i); positions.setY(i, groundHeight(x, z) - 0.08);
    const color = new THREE.Color(x > 358 ? '#e6cb97' : x < -620 ? '#8a9a66' : '#a8af8c');
    color.multiplyScalar(0.94 + clamp(Math.sin(x * 0.12) * Math.cos(z * 0.07), -0.06, 0.06)); colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 })); mesh.receiveShadow = true; scene.add(mesh);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(120, 1500), materials.sand); beach.rotation.x = -Math.PI / 2;
  beach.position.set(415, -0.22, 0); beach.receiveShadow = true; scene.add(beach);
}
