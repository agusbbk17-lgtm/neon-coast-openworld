import * as THREE from '../../vendor/three.min.js';

// Original fused pass: edge smoothing, depth occlusion, bloom, color grade,
// film grain, vignette and speed-driven peripheral streaks.
const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment = `precision highp float;
uniform sampler2D colorTexture,depthTexture;uniform vec2 resolution;
uniform float time,speed,night,aoEnabled,reduceMotion,cameraNear,cameraFar,focusDistance,focusStrength;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 px=1./resolution;vec3 c=texture2D(colorTexture,vUv).rgb;
vec3 n=texture2D(colorTexture,vUv+vec2(0.,px.y)).rgb,s=texture2D(colorTexture,vUv-vec2(0.,px.y)).rgb;
vec3 e=texture2D(colorTexture,vUv+vec2(px.x,0.)).rgb,w=texture2D(colorTexture,vUv-vec2(px.x,0.)).rgb;
float edge=length(n-s)+length(e-w);c=mix(c,(n+s+e+w+c*2.)/6.,clamp(edge*.36,0.,.55));
float d=texture2D(depthTexture,vUv).r,occ=0.;vec3 glow=vec3(0.);vec2 radial=vUv-.5;
float eyeDepth=cameraNear*cameraFar/(cameraFar-d*(cameraFar-cameraNear));
float coc=clamp(abs(eyeDepth-focusDistance)/max(eyeDepth,.1)*focusStrength,0.,4.);
if(coc>.15){vec3 blur=texture2D(colorTexture,vUv+px*vec2(coc,coc)).rgb+texture2D(colorTexture,vUv+px*vec2(-coc,coc)).rgb+texture2D(colorTexture,vUv-px*vec2(coc,coc)).rgb+texture2D(colorTexture,vUv+px*vec2(coc,-coc)).rgb;c=mix(c,blur*.25,clamp(coc*.25,0.,.8));}
for(int i=0;i<8;i++){float angle=float(i)*.785398;vec2 off=vec2(cos(angle),sin(angle));
float nd=texture2D(depthTexture,vUv+off*px*3.).r;occ+=step(.000035,d-nd)*step(d-nd,.004);
vec3 b=texture2D(colorTexture,vUv+off*px*5.).rgb;glow+=max(b-vec3(.78),vec3(0.));}
c*=1.-occ*.017*aoEnabled;c+=glow*.035;
float motion=clamp(speed/58.,0.,1.)*(1.-reduceMotion)*.035;
c=mix(c,texture2D(colorTexture,vUv-radial*motion).rgb,motion*6.*smoothstep(.18,.64,length(radial)));
c*=mix(vec3(1.018,1.,.965),vec3(.91,1.02,1.08),night);
c*=.90+.10*smoothstep(.78,.15,length(radial));c+=(hash(vUv*resolution+time)-.5)*.0025;
gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export class PostFX {
  constructor(renderer) {
    this.renderer = renderer; this.enabled = true;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthTexture: new THREE.DepthTexture(1, 1),
    });
    this.material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
      uniforms: { colorTexture: { value: this.target.texture }, depthTexture: { value: this.target.depthTexture },
        resolution: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, speed: { value: 0 },
        night: { value: 0 }, aoEnabled: { value: 1 }, reduceMotion: { value: 0 }, cameraNear: { value: 0.08 }, cameraFar: { value: 2600 },
        focusDistance: { value: 12 }, focusStrength: { value: 0.04 } }, depthTest: false, depthWrite: false });
    this.scene = new THREE.Scene(); this.camera = new THREE.Camera(); this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }
  resize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2()); this.target.setSize(size.x, size.y);
    this.material.uniforms.resolution.value.copy(size);
  }
  render(scene, camera, time, speed, night, reduceMotion) {
    const u = this.material.uniforms; u.time.value = time; u.speed.value = Math.abs(speed); u.night.value = night; u.reduceMotion.value = reduceMotion ? 1 : 0;
    u.cameraNear.value = camera.near; u.cameraFar.value = camera.far; u.focusDistance.value = this.focusDistance || 12; u.focusStrength.value = reduceMotion ? 0 : this.focusStrength ?? 0.04;
    if (!this.enabled) { this.renderer.setRenderTarget(null); this.renderer.render(scene, camera); return; }
    this.renderer.setRenderTarget(this.target); this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.camera);
  }
}
