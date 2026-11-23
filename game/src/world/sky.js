import * as THREE from '../../vendor/three.min.js';

export class Sky {
  constructor(scene) {
    this.material = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      uniforms: { time: { value: 0 }, night: { value: 0 }, sun: { value: new THREE.Vector3(-0.78, 0.2, -0.55).normalize() } },
      vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `precision highp float;varying vec3 vDirection;uniform float time,night;uniform vec3 sun;
      float hash(vec2 p){return fract(sin(dot(p,vec2(91.7,227.1)))*41731.3);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 color=mix(vec3(.95,.68,.43),vec3(.30,.58,.72),pow(h,.4));
      color=mix(color,mix(vec3(.07,.12,.19),vec3(.015,.033,.07),h),night);
      float a=dot(d,sun);color+=vec3(1.,.65,.30)*pow(max(a,0.),22.)*.2*(1.-night);
      color=mix(color,vec3(1.,.88,.55),smoothstep(.9991,.9995,a)*(1.-night));
      vec2 cloud=d.xz/max(.08,d.y)*1.6+time*.003;float n=noise(cloud)*.55+noise(cloud*2.)*.28+noise(cloud*4.)*.17;
      float mask=smoothstep(.57,.78,n)*smoothstep(.02,.18,d.y)*(1.-smoothstep(.65,.95,d.y));
      color=mix(color,mix(vec3(.96,.79,.63),vec3(.14,.17,.23),night),mask*.6);
      float star=step(.9975,hash(floor(d.xz/max(.1,d.y)*400.)))*night*night*smoothstep(.1,.3,d.y);
      gl_FragColor=vec4(color+star,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }` });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), this.material); this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100; scene.add(this.mesh);
  }
  update(time, night, position) { this.mesh.position.copy(position); this.material.uniforms.time.value = time; this.material.uniforms.night.value = night; }
}
