import * as THREE from '../../vendor/three.min.js';

// Authored analytic environment texture: broad sky, sun and ground reflections.
// PMREM belongs to the allowed rendering dependency; no image is loaded.
export function createEnvironment(renderer, scene) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [position, color] of [[0, '#91bcca'], [0.38, '#d4c6aa'], [0.49, '#eda55e'], [0.52, '#c4b895'], [0.7, '#6a766e'], [1, '#24363b']]) sky.addColorStop(position, color);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
  const sun = ctx.createRadialGradient(150, 110, 0, 150, 110, 65);
  sun.addColorStop(0, '#ffecd2'); sun.addColorStop(0.18, '#ffe4b6'); sun.addColorStop(1, '#f5d6aa00');
  ctx.fillStyle = sun; ctx.fillRect(70, 40, 160, 150);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#46616a' : '#779095'; ctx.fillRect(i * 43, 129, 24, 10 + i % 4 * 9); }
  const texture = new THREE.CanvasTexture(canvas); texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace;
  const generator = new THREE.PMREMGenerator(renderer), result = generator.fromEquirectangular(texture);
  scene.environment = result.texture; scene.environmentIntensity = 0.55;
  texture.dispose(); generator.dispose(); return result;
}
