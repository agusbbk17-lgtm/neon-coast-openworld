import * as THREE from '../../vendor/three.min.js';

export class Water {
  constructor(scene) {
    this.material = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, night: { value: 0 } },
      vertexShader: `varying vec3 vWorld;uniform float time;void main(){vec3 p=position;p.z+=sin(p.x*.025+time)*.12+cos(p.y*.031+time*.7)*.1;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `precision highp float;varying vec3 vWorld;uniform float time,night;
      void main(){vec2 p=vWorld.xz;float wave=sin(p.x*.23+time*1.4+sin(p.y*.1))*cos(p.y*.13-time);
      vec3 normal=normalize(vec3(wave*.08,1.,cos(p.y*.17+time)*.07)),view=normalize(cameraPosition-vWorld);
      float f=pow(1.-max(dot(normal,view),0.),3.);vec3 base=mix(vec3(.045,.46,.47),vec3(.52,.73,.71),f);
      float sparkle=pow(max(0.,sin(p.x*.8+p.y*.13+time)*cos(p.y*.9-time)),18.);base+=sparkle*.17;
      float foam=exp(-abs(p.x-467.)*.18)*(wave*.5+.5);base=mix(base,vec3(.85,.86,.73),foam*.7);
      gl_FragColor=vec4(base*mix(1.,.19,night),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 64, 64), this.material);
    this.mesh.rotation.x = -Math.PI / 2; this.mesh.position.set(1655, -0.65, 0); scene.add(this.mesh);
  }
  update(time, night) { this.material.uniforms.time.value = time; this.material.uniforms.night.value = night; }
}
