import * as THREE from '../../vendor/three.min.js';
import { Random } from '../core/rng.js';

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d', { willReadFrequently: true }), width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture;
}
export function createMaterials(seed) {
  const rng = new Random(seed + ':textures');
  const surface = (color, roughness = 0.75, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const asphalt = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#394448'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 18000; i++) {
      const shade = rng.int(38, 90); ctx.fillStyle = `rgba(${shade},${shade + 5},${shade + 7},.28)`;
      ctx.fillRect(rng.int(0, w), rng.int(0, h), 1, 1);
    }
    ctx.strokeStyle = '#465153'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(100, 170); ctx.lineTo(170, 210); ctx.stroke();
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(12, 12);
  const road = surface('#ffffff', 0.92); road.map = asphalt;
  const facade = [];
  const palettes = [['#efe5d0', '#4b7580'], ['#c4d4d2', '#224e63'], ['#f0c8ad', '#44777c'], ['#94afba', '#31536d'], ['#eed9a9', '#647e82'], ['#d1d0cb', '#315965']];
  for (const [wall, glass] of palettes) {
    const map = canvasTexture(256, 512, (ctx, w, h) => {
      ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
      for (let floor = 0; floor < 16; floor++) for (let col = 0; col < 6; col++) {
        const x = col * 42 + 6, y = floor * 32 + 5;
        ctx.fillStyle = '#a8a999'; ctx.fillRect(x - 1, y - 1, 32, 24);
        const gradient = ctx.createLinearGradient(x, y, x + 28, y + 22);
        gradient.addColorStop(0, glass); gradient.addColorStop(0.6, '#88a1aa'); gradient.addColorStop(1, '#355d6b');
        ctx.fillStyle = gradient; ctx.fillRect(x, y, 30, 22);
        ctx.fillStyle = '#d2d9cc'; ctx.fillRect(x + 14, y, 1, 22); ctx.fillRect(x, y + 11, 30, 1);
        ctx.fillStyle = 'rgba(255,255,240,.2)'; ctx.fillRect(x + 2, y + 2, 11, 2);
      }
      ctx.strokeStyle = '#b6b7a6'; for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    });
    const emission = canvasTexture(256, 512, ctx => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 512);
      for (let row = 0; row < 16; row++) for (let col = 0; col < 6; col++) {
        if (rng.next() > 0.58) { ctx.fillStyle = rng.pick(['#ffd089', '#b9eee5', '#ebb797']); ctx.fillRect(col * 42 + 6, row * 32 + 5, 30, 22); }
      }
    });
    facade.push(new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.13, emissiveMap: emission, emissive: '#fff3d9', emissiveIntensity: 0 }));
  }
  const neon = new THREE.MeshStandardMaterial({ color: '#ffb174', emissive: '#ff874f', emissiveIntensity: 0.35, roughness: 0.3 });
  return { surface, road, facade, neon, concrete: surface('#c4c6ba'), cream: surface('#f0dec0'),
    sand: surface('#e7ce9a'), grass: surface('#839765'), leaf: surface('#557b53'), trunk: surface('#8c7053'),
    white: surface('#e9ead7'), yellow: surface('#e1b95c'), metal: surface('#394b50', 0.38, 0.65),
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#799ba1', metalness: 0.18, roughness: 0.12, clearcoat: 1 }),
  };
}
export function signTexture(text, foreground = '#f9d390', background = '#16444c') {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = foreground; ctx.lineWidth = 3; ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${text.length > 12 ? 34 : 46}px system-ui`; ctx.fillText(text, w / 2, h / 2, w - 28);
  });
}
