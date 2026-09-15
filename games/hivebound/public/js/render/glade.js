// Turns one generated glade into geometry: ground, vegetation, the landmark in
// the middle, the gates at the far end and everything worth walking towards.

import * as THREE from 'three';
import { propParts, materialFor, tint } from './props.js';
import { translate } from '../i18n.js';

const WIND_CHUNK = `
  float swayHeight = max(transformed.y, 0.0);
  float swayPhase = uTime * 1.7 + swayOrigin.x * 0.38 + swayOrigin.z * 0.29;
  transformed.x += sin(swayPhase) * swayHeight * uSway * 0.11;
  transformed.z += cos(swayPhase * 0.83) * swayHeight * uSway * 0.08;
`;

function applyWind(material, amount, timeUniform) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uSway = { value: amount };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uTime;\nuniform float uSway;\nvoid main() {')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swayOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 swayOrigin = vec3(0.0);
        #endif
        ${WIND_CHUNK}`);
  };
  material.customProgramCacheKey = () => `wind-${amount}`;
}

function emissiveMaterial(color, intensity = 1.6, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    transparent: opacity < 1,
    opacity,
    flatShading: true
  });
}

function labelTexture(icon, title, risk) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);
  ctx.textAlign = 'center';
  ctx.font = '96px system-ui, "Segoe UI Emoji", sans-serif';
  ctx.fillText(icon, 256, 110);
  ctx.fillStyle = '#f7f1df';
  ctx.font = 'bold 40px "Trebuchet MS", system-ui, sans-serif';
  ctx.fillText(translate(title).toUpperCase(), 256, 172);
  ctx.fillStyle = '#e0b85c';
  ctx.font = '28px "Trebuchet MS", system-ui, sans-serif';
  ctx.fillText(translate(risk), 256, 214);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class GladeView {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.quality = quality;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.time = { value: 0 };
    this.disposables = [];
    this.animated = [];
  }

  clear() {
    this.root.traverse(object => {
      if (object.isInstancedMesh || object.isMesh || object.isPoints) {
        object.geometry?.dispose?.();
        const material = object.material;
        if (Array.isArray(material)) material.forEach(m => m.dispose());
        else material?.dispose?.();
      }
    });
    for (const texture of this.disposables) texture.dispose();
    this.disposables = [];
    this.animated = [];
    this.root.clear();
    this.pickupMeshes = new Map();
    this.gateMeshes = [];
  }

  build(glade) {
    this.clear();
    this.glade = glade;
    this.biome = glade.biome;
    this.buildTerrain(glade);
    this.buildProps(glade);
    this.buildLandmark(glade);
    this.buildGates(glade);
    this.buildPickups(glade);
    this.buildAmbient(glade);
  }

  // ------------------------------------------------------------------ ground

  buildTerrain(glade) {
    const geometry = new THREE.PlaneGeometry(glade.extent, glade.extent, glade.grid, glade.grid);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);

    const low = new THREE.Color(glade.biome.ground[2]);
    const mid = new THREE.Color(glade.biome.ground[0]);
    const high = new THREE.Color(glade.biome.ground[1]);
    const color = new THREE.Color();

    for (let i = 0; i < position.count; i++) {
      const height = glade.heights[i];
      position.setY(i, height);
      const x = position.getX(i);
      const z = position.getZ(i);
      const radius = Math.hypot(x, z);

      const blend = Math.max(0, Math.min(1, (height + 2.5) / 6));
      color.copy(low).lerp(mid, Math.min(1, blend * 1.6));
      if (blend > 0.55) color.lerp(high, (blend - 0.55) / 0.45);

      // Dry patches: low-frequency waves keep the ground from reading as one
      // flat sheet of colour.
      const patch = Math.sin(x * 0.09 + z * 0.05) * Math.cos(z * 0.07 - x * 0.04);
      color.lerp(low, Math.max(0, patch) * 0.45);
      color.lerp(high, Math.max(0, -patch) * 0.3);

      // The rim reads darker, like a wall of undergrowth.
      if (radius > glade.playRadius) color.multiplyScalar(0.62);
      // A worn trail around the landmark.
      if (radius < 13) color.lerp(new THREE.Color(glade.biome.path), 0.4 * (1 - radius / 13));

      const variation = 0.86 + ((i * 37) % 23) / 70;
      colors[i * 3] = color.r * variation;
      colors[i * 3 + 1] = color.g * variation;
      colors[i * 3 + 2] = color.b * variation;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      flatShading: true
    }));
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.terrain = mesh;
  }

  // -------------------------------------------------------------- vegetation

  buildProps(glade) {
    const byKind = new Map();
    for (const prop of glade.props) {
      if (!byKind.has(prop.kind)) byKind.set(prop.kind, []);
      byKind.get(prop.kind).push(prop);
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const castShadows = this.quality !== 'low';

    for (const [kind, props] of byKind) {
      const parts = propParts(kind, glade.biome);
      parts.forEach((part, partIndex) => {
        const material = materialFor(part);
        if (part.sway) applyWind(material, part.sway, this.time);
        const mesh = new THREE.InstancedMesh(part.geometry, material, props.length);
        mesh.castShadow = castShadows && kind !== 'grass';
        mesh.receiveShadow = false;
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        for (let i = 0; i < props.length; i++) {
          const prop = props[i];
          const offset = part.offset || [0, 0, 0];
          const scale = part.scale || [1, 1, 1];
          const rotation = part.rotation || [0, 0, 0];
          dummy.position.set(
            prop.x + offset[0] * prop.scale,
            prop.y + offset[1] * prop.scale,
            prop.z + offset[2] * prop.scale
          );
          dummy.rotation.set(rotation[0] + prop.tilt, rotation[1] + prop.rotation, rotation[2]);
          dummy.scale.set(scale[0] * prop.scale, scale[1] * prop.scale, scale[2] * prop.scale);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          color.setHex(part.color).multiplyScalar(prop.shade);
          mesh.setColorAt(i, color);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.userData.partIndex = partIndex;
        this.root.add(mesh);
      });
    }
  }

  // ---------------------------------------------------------------- landmark

  buildLandmark(glade) {
    const group = new THREE.Group();
    const { x, z } = glade.poi;
    group.position.set(x, glade.heightAt(x, z), z);
    const accent = glade.biome.accent;

    const builders = {
      rift: () => this.buildRift(group, accent),
      cache: () => this.buildCache(group),
      shrine: () => this.buildShrine(group),
      petal: () => this.buildPetal(group, accent),
      throne: () => this.buildThrone(group, accent)
    };
    (builders[glade.poi.kind] || builders.rift)();

    this.root.add(group);
    this.landmark = group;

    if (glade.secret) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), emissiveMaterial(0xf3c968, 2.4));
      shard.position.set(glade.secret.x, glade.secret.y + 0.7, glade.secret.z);
      shard.castShadow = false;
      this.root.add(shard);
      this.secretMesh = shard;
      this.animated.push({ mesh: shard, kind: 'spin', base: glade.secret.y + 0.7 });
    }
  }

  buildRift(group, accent) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 32),
      new THREE.MeshBasicMaterial({ color: 0x120a18, transparent: true, opacity: 0.92 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.06;
    group.add(disc);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 8, 40), emissiveMaterial(0xdf647f, 2.2));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.25;
    group.add(ring);
    this.animated.push({ mesh: ring, kind: 'rotate', speed: 0.45 });

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 3.2, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 13;
    group.add(beam);
    this.animated.push({ mesh: beam, kind: 'pulse', base: 1 });

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.4, 4), emissiveMaterial(0x6b3a52, 0.8));
      shard.position.set(Math.cos(angle) * 5.4, 1.4, Math.sin(angle) * 5.4);
      shard.rotation.z = Math.cos(angle) * 0.3;
      shard.rotation.x = Math.sin(angle) * 0.3;
      shard.castShadow = this.quality !== 'low';
      group.add(shard);
    }
  }

  buildCache(group) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.7, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xc89a46, roughness: 0.6, flatShading: true })
    );
    base.position.y = 0.75;
    base.castShadow = true;
    group.add(base);

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(2.55, 2.4, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8c268, roughness: 0.45, flatShading: true })
    );
    lid.position.y = 1.7;
    lid.castShadow = true;
    group.add(lid);
    this.animated.push({ mesh: lid, kind: 'bob', base: 1.7, amount: 0.12, speed: 1.4 });

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 6), emissiveMaterial(0xffd36a, 1.8));
      cell.position.set(Math.cos(angle) * 1.4, 1.98, Math.sin(angle) * 1.4);
      group.add(cell);
    }
  }

  buildShrine(group) {
    const slab = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 0.8, 6),
      new THREE.MeshStandardMaterial({ color: 0xd9b25e, roughness: 0.75, flatShading: true })
    );
    slab.position.y = 0.4;
    slab.receiveShadow = true;
    group.add(slab);

    const altar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.5, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xe6c476, roughness: 0.55, flatShading: true })
    );
    altar.position.y = 1.7;
    altar.castShadow = true;
    group.add(altar);

    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), emissiveMaterial(0xffd98a, 3));
    flame.position.y = 3.3;
    group.add(flame);
    this.animated.push({ mesh: flame, kind: 'flicker', base: 3.3 });

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.4;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 3.4, 6),
        new THREE.MeshStandardMaterial({ color: 0xcfa54e, roughness: 0.7, flatShading: true })
      );
      pillar.position.set(Math.cos(angle) * 3.1, 1.7, Math.sin(angle) * 3.1);
      pillar.castShadow = true;
      group.add(pillar);
      const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), emissiveMaterial(0xffe7a8, 2.4));
      tip.position.set(Math.cos(angle) * 3.1, 3.7, Math.sin(angle) * 3.1);
      group.add(tip);
    }
  }

  buildPetal(group, accent) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 4.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x5d7a4a, roughness: 0.8, flatShading: true })
    );
    stem.position.y = 2.1;
    stem.castShadow = true;
    group.add(stem);

    const petals = new THREE.Group();
    petals.position.y = 4.3;
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 6),
        new THREE.MeshStandardMaterial({ color: tint(accent, 1.1), roughness: 0.5, flatShading: true, side: THREE.DoubleSide })
      );
      petal.scale.set(0.5, 0.18, 1.35);
      petal.position.set(Math.cos(angle) * 1.5, 0, Math.sin(angle) * 1.5);
      petal.rotation.y = -angle;
      petal.rotation.z = 0.35;
      petal.castShadow = true;
      petals.add(petal);
    }
    group.add(petals);
    this.animated.push({ mesh: petals, kind: 'rotate', speed: 0.12 });

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), emissiveMaterial(0xffe6a0, 2.6));
    core.position.y = 4.5;
    group.add(core);
    this.animated.push({ mesh: core, kind: 'flicker', base: 4.5 });
  }

  buildThrone(group, accent) {
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(12, 13.4, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x6d5c42, roughness: 0.92, flatShading: true })
    );
    dais.position.y = -0.45;
    dais.receiveShadow = true;
    group.add(dais);

    // A ring of old wax runes: the arena should read as a place, not a slab.
    const runes = new THREE.Mesh(
      new THREE.RingGeometry(9.4, 10.6, 40),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    runes.rotation.x = -Math.PI / 2;
    runes.position.y = 0.16;
    group.add(runes);
    this.animated.push({ mesh: runes, kind: 'rotate', speed: 0.06 });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.1, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a3c2a, roughness: 0.9, flatShading: true })
      );
      pillar.position.set(Math.cos(angle) * 13, 3.2, Math.sin(angle) * 13);
      pillar.castShadow = true;
      group.add(pillar);

      const brazier = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), emissiveMaterial(accent, 2.8));
      brazier.position.set(Math.cos(angle) * 13, 7.1, Math.sin(angle) * 13);
      group.add(brazier);
      this.animated.push({ mesh: brazier, kind: 'flicker', base: 7.1 });
    }
  }

  // ------------------------------------------------------------------- gates

  buildGates(glade) {
    this.gateMeshes = [];
    for (const gate of glade.gates) {
      const group = new THREE.Group();
      group.position.set(gate.x, gate.y, gate.z);
      group.rotation.y = -gate.angle;

      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(3.4, 0.42, 8, 24, Math.PI),
        new THREE.MeshStandardMaterial({ color: tint(glade.biome.path, 1.2), roughness: 0.7, flatShading: true })
      );
      arch.position.y = 0.2;
      arch.castShadow = true;
      group.add(arch);

      const curtain = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 3.6),
        new THREE.MeshBasicMaterial({
          color: gate.type === 'boss' ? 0xdf647f : glade.biome.accent,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      curtain.position.y = 1.8;
      group.add(curtain);

      const texture = labelTexture(gate.icon, gate.title, gate.risk);
      this.disposables.push(texture);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 3),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
      );
      sign.position.y = 6.2;
      group.add(sign);

      this.root.add(group);
      this.gateMeshes.push({ group, curtain, sign, gate });
      this.animated.push({ mesh: curtain, kind: 'curtain', base: 1.8 });
    }
  }

  setGatesOpen(open) {
    for (const entry of this.gateMeshes) {
      entry.curtain.material.opacity = open ? 0.42 : 0.12;
      entry.curtain.material.color.setHex(open ? (entry.gate.type === 'boss' ? 0xff8a9a : this.biome.accent) : 0x55555f);
    }
  }

  // ----------------------------------------------------------------- pickups

  buildPickups(glade) {
    this.pickupMeshes = new Map();
    for (const pickup of glade.pickups) this.addPickup(pickup);
  }

  addPickup(pickup) {
    const color = { nectar: 0xffd36a, wax: 0xe0b85c, pollen: 0xc98cff }[pickup.kind] || 0xffd36a;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), emissiveMaterial(color, 2.6));
    const y = (pickup.y ?? 0) + 0.9;
    mesh.position.set(pickup.x, y, pickup.z);
    this.root.add(mesh);
    this.pickupMeshes.set(pickup, mesh);
    this.animated.push({ mesh, kind: 'bob', base: y, amount: 0.22, speed: 2.2 });
  }

  syncPickups(glade) {
    for (const pickup of glade.pickups) {
      if (!this.pickupMeshes.has(pickup) && !pickup.taken) this.addPickup(pickup);
      const mesh = this.pickupMeshes.get(pickup);
      if (mesh && pickup.taken) {
        mesh.visible = false;
      }
    }
    if (this.secretMesh && glade.secret?.taken) this.secretMesh.visible = false;
  }

  // ----------------------------------------------------------------- ambient

  buildAmbient(glade) {
    const spec = glade.biome.ambient;
    const count = this.quality === 'low' ? Math.floor(spec.count * 0.35) : spec.count;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 150;
      positions[i * 3 + 1] = Math.random() * 26;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 150;
      seeds[i] = Math.random() * 10;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.time,
        uColor: { value: new THREE.Color(spec.color) },
        uRise: { value: spec.rise },
        uSize: { value: spec.kind === 'ember' ? 2.4 : spec.kind === 'petal' ? 5.5 : 3.4 }
      },
      vertexShader: `
        attribute float seed;
        uniform float uTime;
        uniform float uRise;
        uniform float uSize;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * uRise * 2.0, 26.0);
          p.x += sin(uTime * 0.5 + seed * 6.28) * 1.6;
          p.z += cos(uTime * 0.42 + seed * 4.2) * 1.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * (34.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
          vAlpha = 0.35 + 0.65 * abs(sin(uTime * 1.2 + seed * 3.0));
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, glow * vAlpha * 0.55);
        }`
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.root.add(points);
    this.ambient = points;
  }

  update(dt, elapsed, playerPosition) {
    this.time.value = elapsed;
    for (const entry of this.animated) {
      const { mesh, kind } = entry;
      if (kind === 'rotate') mesh.rotation.y += dt * (entry.speed || 0.5);
      else if (kind === 'spin') {
        mesh.rotation.y += dt * 1.6;
        mesh.position.y = entry.base + Math.sin(elapsed * 2) * 0.18;
      } else if (kind === 'bob') {
        mesh.position.y = entry.base + Math.sin(elapsed * (entry.speed || 2)) * (entry.amount || 0.2);
        mesh.rotation.y += dt * 1.1;
      } else if (kind === 'flicker') {
        const pulse = 0.85 + Math.sin(elapsed * 6.2 + entry.base) * 0.1 + Math.sin(elapsed * 11.3) * 0.05;
        mesh.scale.setScalar(pulse);
        mesh.position.y = entry.base + Math.sin(elapsed * 1.7) * 0.1;
      } else if (kind === 'pulse') {
        mesh.material.opacity = 0.09 + Math.abs(Math.sin(elapsed * 1.3)) * 0.1;
        mesh.rotation.y += dt * 0.2;
      } else if (kind === 'curtain') {
        mesh.position.y = entry.base + Math.sin(elapsed * 1.6) * 0.08;
      }
    }

    // Signs always face the player.
    for (const entry of this.gateMeshes || []) {
      entry.sign.lookAt(playerPosition.x, entry.sign.getWorldPosition(new THREE.Vector3()).y, playerPosition.z);
    }

    if (this.ambient) {
      this.ambient.position.x = Math.round(playerPosition.x / 150) * 150;
      this.ambient.position.z = Math.round(playerPosition.z / 150) * 150;
    }
  }
}
