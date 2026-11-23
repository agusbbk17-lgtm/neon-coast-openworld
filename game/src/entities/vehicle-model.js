import * as THREE from '../../vendor/three.min.js';
import { BoxBatch, box } from '../render/geometry.js';
import { signTexture } from '../render/materials.js';

function loft(slices) {
  const vertices = [], indices = [];
  for (const [z, width, bottom, top] of slices) {
    const corners = [[-width * 0.8, bottom], [width * 0.8, bottom], [width, bottom + 0.13],
      [width, top - 0.12], [width * 0.82, top], [-width * 0.82, top], [-width, top - 0.12], [-width, bottom + 0.13]];
    for (const [x, y] of corners) vertices.push(x, y, z);
  }
  for (let row = 0; row < slices.length - 1; row++) for (let i = 0; i < 8; i++) {
    const a = row * 8 + i, b = row * 8 + (i + 1) % 8, c = a + 8, d = b + 8;
    indices.push(a, c, b, b, c, d);
  }
  for (let i = 1; i < 7; i++) { indices.push(0, i, i + 1); const a = (slices.length - 1) * 8; indices.push(a, a + i + 1, a + i); }
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function createVehicleModel(type, config, paint, materials) {
  const root = new THREE.Group(), chassis = new THREE.Group(); root.add(chassis);
  const w = config.width / 2, l = config.length / 2, sport = type === 'sports', bike = type === 'bike';
  const paintMaterial = new THREE.MeshPhysicalMaterial({ color: paint, roughness: sport ? 0.2 : 0.29, metalness: 0.55,
    clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.25 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({ color: '#284a58', roughness: 0.13, metalness: 0.45, clearcoat: 1 });
  const bodyHeight = bike ? 0.85 : sport ? 0.8 : 1.02, y = bike ? 0.4 : type === 'suv' || type === 'pickup' ? 0.48 : 0.32;
  const body = new THREE.Mesh(loft([[-l, w * 0.75, y, bodyHeight * 0.82], [-l * 0.7, w, y, bodyHeight],
    [l * 0.6, w, y, bodyHeight], [l, w * 0.88, y + 0.05, bodyHeight * 0.94]]), paintMaterial);
  body.castShadow = body.receiveShadow = true; chassis.add(body);
  let cabin = null;
  if (!bike) {
    const roof = config.height;
    cabin = new THREE.Mesh(loft([[-l * 0.38, w * 0.88, bodyHeight - 0.04, bodyHeight + 0.06],
      [-l * 0.10, w * 0.74, bodyHeight, roof], [l * (type === 'pickup' ? 0.14 : 0.48), w * 0.74, bodyHeight, roof],
      [l * (type === 'pickup' ? 0.24 : 0.65), w * 0.86, bodyHeight - 0.04, bodyHeight + 0.05]]), glassMaterial);
    cabin.castShadow = true; chassis.add(cabin);
    chassis.add(box(w * 1.49, 0.06, l * (type === 'pickup' ? 0.4 : 0.62), paintMaterial, 0, roof + 0.01, l * 0.15));
  }
  const detail = new BoxBatch();
  for (const side of [-1, 1]) {
    detail.add(side * w * 0.74, bodyHeight * 0.8, -l - 0.01, w * 0.4, 0.12, 0.055, '#e6efe4');
    detail.add(side * w * 0.75, bodyHeight * 0.8, l + 0.02, w * 0.4, 0.14, 0.07, '#cd4839');
    if (!bike) {
      detail.add(side * w * 1.08, bodyHeight + 0.21, -l * 0.1, 0.22, 0.13, 0.31, paint);
      detail.add(side * w * 1.12, bodyHeight + 0.21, -l * 0.06, 0.06, 0.10, 0.25, '#adc1c0');
      detail.add(side * w * 1.004, bodyHeight * 0.87, l * 0.2, 0.035, 0.06, 0.22, '#bac3bf');
      detail.add(side * w * 0.87, y + 0.05, l * 0.1, 0.09, 0.12, l * 1.45, '#25343a');
    }
  }
  detail.add(0, y + 0.18, -l - 0.012, w * 1.13, 0.18, 0.08, '#1c2a30');
  detail.add(0, y + 0.2, l + 0.025, w * 0.46, 0.14, 0.04, '#c9d4d0');
  detail.add(0, y - 0.05, -l, w * 1.6, 0.07, 0.2, '#1a292c');
  if (sport || type === 'muscle') {
    detail.add(0, bodyHeight + 0.17, l * 0.86, w * 1.7, 0.09, 0.26, paint);
    for (const side of [-1, 1]) detail.add(side * w * 0.65, bodyHeight + 0.05, l * 0.86, 0.08, 0.2, 0.10, '#253438');
  }
  if (type === 'pickup') detail.add(0, bodyHeight + 0.01, l * 0.63, w * 1.58, 0.045, l * 0.6, '#394547');
  if (type === 'police') {
    detail.add(0, config.height + 0.15, 0.05, w * 1.12, 0.1, 0.4, '#25343a');
    for (const side of [-1, 1]) detail.add(side * w, bodyHeight * 0.7, 0.2, 0.07, 0.37, l * 0.7, '#e5e8e1');
  }
  if (bike) { detail.add(0, 1.07, 0.18, 0.44, 0.12, 0.7, '#202f33'); detail.add(0, 1.15, -0.45, 0.76, 0.05, 0.06, '#aeb8b5'); }
  const details = detail.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.25 })); chassis.add(details);
  const radius = type === 'suv' || type === 'pickup' ? 0.42 : bike ? 0.36 : 0.33;
  const wheelPositions = bike ? [[0, radius, -l * 0.73], [0, radius, l * 0.74]]
    : [-1, 1].flatMap(side => [-1, 1].map(end => [side * (w + 0.015), radius, end * l * 0.64]));
  const tireMaterial = materials.surface('#202728', 0.95), rimMaterial = materials.surface('#bcc6c4', 0.25, 0.85);
  const tires = new THREE.InstancedMesh(new THREE.CylinderGeometry(radius, radius, bike ? 0.16 : 0.26, 20), tireMaterial, wheelPositions.length);
  const rims = new THREE.InstancedMesh(new THREE.CylinderGeometry(radius * 0.60, radius * 0.60, bike ? 0.17 : 0.28, 12), rimMaterial, wheelPositions.length);
  const wheelReach = Math.max(...wheelPositions.map(position => Math.hypot(position[0], position[2])));
  // These local bounds enclose every steering/spin angle without rescanning instance matrices.
  tires.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, radius, 0), wheelReach + Math.hypot(radius, bike ? 0.08 : 0.13));
  rims.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, radius, 0), wheelReach + Math.hypot(radius * 0.6, bike ? 0.085 : 0.14));
  tires.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rims.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tires.castShadow = rims.castShadow = true; chassis.add(tires, rims);
  const door = new THREE.Group(); door.position.set(-w * 1.005, bodyHeight * 0.6, -l * 0.21); chassis.add(door);
  if (!bike) door.add(box(0.075, bodyHeight * 0.62, l * 0.62, paintMaterial, 0, 0, l * 0.31));
  const headlights = new THREE.MeshStandardMaterial({ color: '#fff2cc', emissive: '#fff1bf', emissiveIntensity: 0.5, roughness: 0.25 });
  const tails = new THREE.MeshStandardMaterial({ color: '#e95a43', emissive: '#ff3525', emissiveIntensity: 0.45 });
  const lightParts = new THREE.Group();
  for (const side of [-1, 1]) {
    lightParts.add(box(w * 0.4, 0.06, 0.065, headlights, side * w * 0.7, bodyHeight * 0.8, -l - 0.05));
    lightParts.add(box(w * 0.4, 0.075, 0.065, tails, side * w * 0.7, bodyHeight * 0.8, l + 0.06));
  }
  chassis.add(lightParts);
  let lightbar = null;
  if (type === 'police') {
    lightbar = [new THREE.MeshStandardMaterial({ color: '#e96562', emissive: '#ff2441', emissiveIntensity: 1 }),
      new THREE.MeshStandardMaterial({ color: '#6eafde', emissive: '#249aff', emissiveIntensity: 1 })];
    for (let i = 0; i < 2; i++) chassis.add(box(w * 0.5, 0.14, 0.35, lightbar[i], (i ? 1 : -1) * w * 0.3, config.height + 0.22, 0.05));
  }
  if (type === 'taxi') {
    const map = signTexture('CAB', '#252e2e', '#fbd275');
    chassis.add(box(0.68, 0.25, 0.32, new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), 0, config.height + 0.18, 0));
  }
  const dummy = new THREE.Object3D();
  function animate(vehicle, time, night) {
    chassis.rotation.set(vehicle.pitch || 0, 0, vehicle.roll || 0);
    door.rotation.y = -(vehicle.doorOpen || 0) * 1.1;
    body.scale.z = 1 - (1 - vehicle.health / 100) * 0.055;
    headlights.emissiveIntensity = 0.4 + night * 2; tails.emissiveIntensity = vehicle.braking ? 2.8 : 0.4 + night;
    if (lightbar) lightbar.forEach((material, i) => { material.emissiveIntensity = vehicle.siren && Math.sin(time * 15 + i * Math.PI) > 0 ? 4 : 0.1; });
    wheelPositions.forEach((position, i) => {
      dummy.position.fromArray(position); dummy.rotation.set(0, position[2] < 0 ? vehicle.steering : 0, Math.PI / 2);
      dummy.rotateY((vehicle.wheelSpin || 0)); dummy.updateMatrix(); tires.setMatrixAt(i, dummy.matrix); rims.setMatrixAt(i, dummy.matrix);
    });
    tires.instanceMatrix.needsUpdate = rims.instanceMatrix.needsUpdate = true;
  }
  return { root, chassis, body, door, animate, paintMaterial, tires, rims };
}
