import * as THREE from '../../vendor/three.min.js';
import { Instances } from '../render/geometry.js';

export function signalState(time, offset = 0) {
  const phase = ((time + offset) % 42 + 42) % 42;
  return { ns: phase < 17 ? 'green' : phase < 20 ? 'yellow' : 'red',
    ew: phase >= 21 && phase < 38 ? 'green' : phase >= 38 && phase < 41 ? 'yellow' : 'red' };
}
export class TrafficSignals {
  constructor(scene, graph, materials) {
    this.graph = graph; this.clock = 0; this.nodes = [...graph.nodes.values()]; this.dummy = new THREE.Object3D();
    const material = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff', emissiveIntensity: 1.6, roughness: 0.3 });
    material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor;'); };
    material.customProgramCacheKey = () => 'solmar-signal';
    this.lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 8, 6), material, this.nodes.length * 2); scene.add(this.lights);
    const batch = new Instances(), cube = new THREE.BoxGeometry(1, 1, 1);
    for (const node of this.nodes) {
      batch.add('signal-ew-arm', cube, materials.metal, [node.x + 13, 6.4, node.z + 10], [0.15, 0.15, 6]);
      batch.add('signal-ew-body', cube, materials.metal, [node.x + 13, 5.85, node.z + 7.5], [0.45, 1.2, 0.5]);
    }
    batch.build(scene, false); this.render();
  }
  state(node, time = this.clock) {
    const [i, j] = node.id.split(':').map(Number); return signalState(time, i * 3 + j * 7);
  }
  green(node, direction, time = this.clock) { return this.state(node, time)[Math.abs(direction.x) > Math.abs(direction.z) ? 'ew' : 'ns'] === 'green'; }
  render() {
    const colors = { green: '#45e58b', yellow: '#ffc461', red: '#ff5a47' }, offsets = { green: -0.32, yellow: 0, red: 0.32 };
    this.nodes.forEach((node, index) => {
      const state = this.state(node);
      ['ns', 'ew'].forEach((axis, side) => {
        this.dummy.position.set(node.x + (axis === 'ns' ? 7.5 : 13.27), 5.85 + offsets[state[axis]], node.z + (axis === 'ns' ? 13.27 : 7.5));
        this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix(); this.lights.setMatrixAt(index * 2 + side, this.dummy.matrix);
        this.lights.setColorAt(index * 2 + side, new THREE.Color(colors[state[axis]]));
      });
    });
    this.lights.instanceMatrix.needsUpdate = true; this.lights.instanceColor.needsUpdate = true; this.lights.computeBoundingSphere();
  }
}
