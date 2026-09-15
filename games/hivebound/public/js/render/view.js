// The window into the Bloom: renderer, sky, light, fog, bloom and the camera
// rig that follows the bee. Everything here is presentation — it reads the
// simulation and never writes to it.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SKY_VERTEX = `
varying vec3 vWorld;
void main() {
  vWorld = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 bottom;
varying vec3 vWorld;
void main() {
  float h = vWorld.y;
  vec3 color = h > 0.0
    ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.65))
    : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.5));
  gl_FragColor = vec4(color, 1.0);
}`;

export const QUALITY = {
  low: { shadows: false, shadowSize: 512, bloom: false, pixelRatio: 1, ambient: 0.4 },
  medium: { shadows: true, shadowSize: 1024, bloom: true, pixelRatio: 1.25, ambient: 0.75 },
  high: { shadows: true, shadowSize: 2048, bloom: true, pixelRatio: 1.6, ambient: 1 }
};

export class View {
  constructor(canvas, quality = 'high') {
    this.canvas = canvas;
    this.quality = QUALITY[quality] ? quality : 'high';
    const settings = QUALITY[this.quality];

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.2, 520);

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(320, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x0b0910) },
          horizon: { value: new THREE.Color(0x24303a) },
          bottom: { value: new THREE.Color(0x05060a) }
        },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT
      })
    );
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = settings.shadows;
    this.sun.shadow.mapSize.set(settings.shadowSize, settings.shadowSize);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // A warm halo travelling with the player so the bee never sinks into the
    // dark biomes.
    this.playerLight = new THREE.PointLight(0xffd98a, 1.0, 22, 1.7);
    this.scene.add(this.playerLight);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    // A high threshold keeps the glow on lanterns and spell light instead of
    // washing every lit surface into white.
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.5, 0.68);
    this.bloomPass.enabled = settings.bloom;
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.sunOffsetX = 40;
    this.sunOffsetZ = 40;
    this.sunHeight = 40;
    this.cameraYaw = Math.PI / 2;
    this.cameraPitch = -0.56;
    this.cameraDistance = 14;
    this.cameraTarget = new THREE.Vector3();
    this.cameraPosition = new THREE.Vector3(0, 12, 20);
    this.shake = 0;
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.raycaster = new THREE.Raycaster();
    this.resize();
  }

  setQuality(name) {
    if (!QUALITY[name] || name === this.quality) return;
    this.quality = name;
    const settings = QUALITY[name];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
    this.renderer.shadowMap.enabled = settings.shadows;
    this.sun.castShadow = settings.shadows;
    this.sun.shadow.mapSize.set(settings.shadowSize, settings.shadowSize);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.bloomPass.enabled = settings.bloom;
    this.resize();
  }

  applyBiome(biome) {
    const settings = QUALITY[this.quality];
    this.scene.fog = new THREE.FogExp2(biome.fog, biome.fogDensity);
    this.sky.material.uniforms.top.value.setHex(biome.sky);
    this.sky.material.uniforms.horizon.value.setHex(biome.horizon);
    this.sky.material.uniforms.bottom.value.setHex(biome.fog);

    this.hemi.color.setHex(biome.hemi.sky);
    this.hemi.groundColor.setHex(biome.hemi.ground);
    this.hemi.intensity = biome.hemi.intensity * (0.75 + settings.ambient * 0.35);

    this.sun.color.setHex(biome.sun.color);
    this.sun.intensity = biome.sun.intensity;
    // The sun travels with the camera target so the shadow box always covers
    // the player rather than the middle of the map.
    this.sunOffsetX = Math.cos(biome.sun.angle) * 48;
    this.sunOffsetZ = Math.sin(biome.sun.angle) * 48;
    this.sunHeight = biome.sun.height;
    this.sun.position.set(this.sunOffsetX, this.sunHeight, this.sunOffsetZ);

    this.bloomPass.strength = biome.bloom;
  }

  // Aim: where the pointer meets the ground at the player's feet.
  pointerToGround(ndcX, ndcY, height) {
    this.groundPlane.constant = -height;
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit) ? hit : null;
  }

  orbit(dx, dy) {
    this.cameraYaw -= dx * 0.0032;
    this.cameraPitch = Math.max(-1.05, Math.min(-0.22, this.cameraPitch - dy * 0.0022));
  }

  zoom(delta) {
    this.cameraDistance = Math.max(8, Math.min(26, this.cameraDistance + delta * 0.012));
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  updateCamera(player, dt) {
    const targetY = player.y + 1.9;
    this.cameraTarget.lerp(new THREE.Vector3(player.x, targetY, player.z), Math.min(1, dt * 9));

    const horizontal = Math.cos(this.cameraPitch) * this.cameraDistance;
    const desired = new THREE.Vector3(
      this.cameraTarget.x + Math.cos(this.cameraYaw) * horizontal,
      this.cameraTarget.y - Math.sin(this.cameraPitch) * this.cameraDistance,
      this.cameraTarget.z + Math.sin(this.cameraYaw) * horizontal
    );
    this.cameraPosition.lerp(desired, Math.min(1, dt * 7));

    this.shake = Math.max(0, this.shake - dt * 2.6);
    const shake = this.shake * this.shake * 0.42;
    this.camera.position.copy(this.cameraPosition);
    if (shake > 0.0005) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.camera.position.z += (Math.random() - 0.5) * shake;
    }
    this.camera.lookAt(this.cameraTarget);

    this.sky.position.copy(this.camera.position);
    this.sun.position.set(this.cameraTarget.x + this.sunOffsetX, this.sunHeight, this.cameraTarget.z + this.sunOffsetZ);
    this.sun.target.position.copy(this.cameraTarget);
    this.sun.target.updateMatrixWorld();
    this.playerLight.position.set(player.x, player.y + 2.4, player.z);
  }

  // Screen position of a world point, for DOM overlays (prompts, damage).
  project(x, y, z) {
    const vector = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (vector.x * 0.5 + 0.5) * this.width,
      y: (-vector.y * 0.5 + 0.5) * this.height,
      visible: vector.z < 1
    };
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  render() {
    if (QUALITY[this.quality].bloom) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
