// Everything that moves: the bee you play, the creatures of the Gloam, the
// projectiles between them and the flashes when those two meet.
// Models are built from primitives at load time and pooled per kind.

import * as THREE from 'three';

// Wings are barely there on purpose: seen from above they used to cover the
// whole body and the bee read as a white blob.
const WING_MATERIAL = () => new THREE.MeshStandardMaterial({
  color: 0xcbdcf0, transparent: true, opacity: 0.2, roughness: 0.2,
  side: THREE.DoubleSide, depthWrite: false
});

function solid(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.65,
    metalness: 0,
    flatShading: options.flat ?? true,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    transparent: Boolean(options.transparent),
    opacity: options.opacity ?? 1
  });
}

function mesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  item.rotation.set(...rotation);
  item.castShadow = true;
  return item;
}

// ------------------------------------------------------------------ the bee

export function buildBee(classDef) {
  const group = new THREE.Group();
  const colors = classDef.colors;
  const bodyMaterial = solid(colors.body, { roughness: 0.55 });
  const stripeMaterial = solid(0x241a12, { roughness: 0.8 });
  const trimMaterial = solid(colors.trim, { roughness: 0.5, emissive: colors.glow, emissiveIntensity: 0.18 });

  const abdomen = mesh(new THREE.SphereGeometry(0.52, 12, 10), bodyMaterial, [0, 0, -0.62], [0.88, 0.8, 1.25]);
  group.add(abdomen);
  // Three fat bands: from behind — which is how you mostly see yourself — the
  // stripes are the only thing that says "bee".
  const bands = [[-0.28, 0.5], [-0.66, 0.46], [-1.0, 0.34]];
  for (const [z, radius] of bands) {
    const stripe = mesh(new THREE.TorusGeometry(radius, 0.13, 6, 16), stripeMaterial, [0, 0, z], [0.95, 0.88, 1], [Math.PI / 2, 0, 0]);
    group.add(stripe);
  }
  const stinger = mesh(new THREE.ConeGeometry(0.12, 0.42, 6), stripeMaterial, [0, 0, -1.42], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  group.add(stinger);

  const thorax = mesh(new THREE.SphereGeometry(0.44, 12, 10), trimMaterial, [0, 0.05, 0.16], [1.02, 1, 1.05]);
  group.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 8), stripeMaterial, [0, 0.02, -0.1], [1, 1, 1], [Math.PI / 2, 0, 0]));
  group.add(thorax);

  const head = mesh(new THREE.SphereGeometry(0.33, 12, 10), solid(0x2a2018, { roughness: 0.6 }), [0, 0.06, 0.66], [1, 0.95, 0.95]);
  group.add(head);
  const eyeMaterial = solid(0x11090c, { roughness: 0.2, emissive: colors.glow, emissiveIntensity: 0.5 });
  group.add(mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeMaterial, [0.18, 0.1, 0.82], [0.8, 1.1, 0.8]));
  group.add(mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeMaterial, [-0.18, 0.1, 0.82], [0.8, 1.1, 0.8]));
  for (const side of [-1, 1]) {
    const antenna = mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.5, 4), stripeMaterial, [side * 0.12, 0.34, 0.78], [1, 1, 1], [-0.7, 0, side * 0.35]);
    group.add(antenna);
  }

  const wings = new THREE.Group();
  const wingGeometry = new THREE.SphereGeometry(0.5, 8, 6);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const wing = mesh(wingGeometry, WING_MATERIAL(), [side * 0.42, 0.42, -0.25 - i * 0.3], [0.26, 0.05, 0.8 - i * 0.18]);
      wing.castShadow = false;
      wing.userData.side = side;
      wing.userData.index = i;
      wings.add(wing);
    }
  }
  group.add(wings);

  const legMaterial = solid(0x1f1712, { roughness: 0.9 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.42, 4), legMaterial, [side * 0.34, -0.3, 0.3 - i * 0.34], [1, 1, 1], [0.3, 0, side * 0.8]);
      leg.castShadow = false;
      group.add(leg);
    }
  }

  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.92, 24),
    new THREE.MeshBasicMaterial({ color: colors.glow, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = -0.85;
  // Drawn through the scenery: behind a pillar or a giant mushroom cap you can
  // still tell where you are.
  aura.material.depthTest = false;
  aura.renderOrder = 6;
  group.add(aura);

  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 16, 12),
    new THREE.MeshBasicMaterial({ color: colors.glow, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shield.visible = false;
  group.add(shield);

  group.userData = { wings, aura, shield, bodyMaterial, trimMaterial };
  return group;
}

// -------------------------------------------------------------- the enemies

function buildMite(tint) {
  const group = new THREE.Group();
  const body = mesh(new THREE.IcosahedronGeometry(0.55, 0), solid(tint, { roughness: 0.8 }), [0, 0.55, 0]);
  group.add(body);
  const spikeMaterial = solid(0x2b1a2a, { roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const spike = mesh(new THREE.ConeGeometry(0.12, 0.5, 4), spikeMaterial,
      [Math.cos(angle) * 0.42, 0.62 + Math.sin(i) * 0.14, Math.sin(angle) * 0.42], [1, 1, 1],
      [Math.cos(angle) * 0.9, 0, -Math.sin(angle) * 0.9]);
    group.add(spike);
  }
  const eye = solid(0xff4a5e, { emissive: 0xff2a44, emissiveIntensity: 2.4, roughness: 0.2 });
  group.add(mesh(new THREE.SphereGeometry(0.11, 6, 6), eye, [0.16, 0.66, 0.42]));
  group.add(mesh(new THREE.SphereGeometry(0.11, 6, 6), eye, [-0.16, 0.66, 0.42]));
  group.userData.body = body;
  return group;
}

function buildHusk(tint) {
  const group = new THREE.Group();
  const material = solid(tint, { roughness: 0.85 });
  const torso = mesh(new THREE.IcosahedronGeometry(0.95, 1), material, [0, 1.05, 0], [1, 1.15, 0.85]);
  group.add(torso);
  const head = mesh(new THREE.IcosahedronGeometry(0.42, 0), solid(0x2c1f2a, { roughness: 0.9 }), [0, 1.95, 0.2]);
  group.add(head);
  const eye = solid(0xffd36a, { emissive: 0xffb43a, emissiveIntensity: 2.2, roughness: 0.3 });
  group.add(mesh(new THREE.SphereGeometry(0.1, 6, 6), eye, [0, 1.98, 0.55], [2.4, 0.5, 0.5]));
  const arms = new THREE.Group();
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.5, 5), material, [side * 0.95, 1.05, 0.1], [1, 1, 1], [0.35, 0, side * 0.25]);
    arms.add(arm);
    const fist = mesh(new THREE.IcosahedronGeometry(0.3, 0), solid(0x33232e, { roughness: 0.95 }), [side * 1.12, 0.35, 0.35]);
    arms.add(fist);
  }
  group.add(arms);
  group.userData.body = torso;
  group.userData.arms = arms;
  return group;
}

function buildSpitter(tint) {
  const group = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.78, 10, 8), solid(tint, { roughness: 0.6 }), [0, 1.2, 0], [1, 0.85, 1]);
  group.add(body);
  const sac = mesh(new THREE.SphereGeometry(0.42, 8, 8), solid(0x9ef0a4, { emissive: 0x6ce07a, emissiveIntensity: 1.8, roughness: 0.3, transparent: true, opacity: 0.85 }), [0, 1.42, -0.32]);
  group.add(sac);
  const snout = mesh(new THREE.ConeGeometry(0.26, 0.9, 6), solid(0x33242e, { roughness: 0.8 }), [0, 1.16, 0.7], [1, 1, 1], [Math.PI / 2, 0, 0]);
  group.add(snout);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.6;
    const leg = mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.2, 4), solid(0x2a1f28, { roughness: 0.9 }),
      [Math.cos(angle) * 0.45, 0.6, Math.sin(angle) * 0.45], [1, 1, 1], [Math.cos(angle) * 0.5, 0, -Math.sin(angle) * 0.5]);
    leg.castShadow = false;
    group.add(leg);
  }
  group.userData.body = body;
  group.userData.sac = sac;
  return group;
}

function buildStalker(tint) {
  const group = new THREE.Group();
  const material = solid(tint, { roughness: 0.55 });
  const body = mesh(new THREE.IcosahedronGeometry(0.5, 1), material, [0, 1.0, 0], [0.85, 0.7, 1.7]);
  group.add(body);
  const head = mesh(new THREE.ConeGeometry(0.3, 0.75, 6), solid(0x241c22, { roughness: 0.7 }), [0, 1.05, 0.9], [1, 1, 1], [Math.PI / 2, 0, 0]);
  group.add(head);
  const eye = solid(0x8affc0, { emissive: 0x4dffa0, emissiveIntensity: 2.6, roughness: 0.2 });
  group.add(mesh(new THREE.SphereGeometry(0.12, 6, 6), eye, [0, 1.16, 1.1], [1.8, 0.35, 0.6]));
  const legs = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const leg = mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.7, 4), solid(0x1d1620, { roughness: 0.9 }),
        [side * 0.5, 0.75, 0.35 - i * 0.7], [1, 1, 1], [0.2, 0, side * 0.75]);
      leg.castShadow = false;
      legs.add(leg);
    }
  }
  group.add(legs);
  const blade = mesh(new THREE.ConeGeometry(0.16, 1.1, 4), solid(0x3a2a3a, { roughness: 0.6 }), [0.45, 1.25, 0.5], [1, 1, 1], [1.2, 0, -0.6]);
  group.add(blade);
  group.userData.body = body;
  group.userData.legs = legs;
  return group;
}

function buildGuardian(tint, accent) {
  const group = new THREE.Group();
  const shell = solid(tint, { roughness: 0.5 });
  const dark = solid(0x261c26, { roughness: 0.8 });

  const body = mesh(new THREE.IcosahedronGeometry(2.6, 1), shell, [0, 3.2, 0], [1.1, 0.9, 1.35]);
  group.add(body);
  const carapace = mesh(new THREE.SphereGeometry(2.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), solid(accent, { roughness: 0.35, emissive: accent, emissiveIntensity: 0.3 }), [0, 3.8, -0.4], [1.25, 1.2, 1.5]);
  group.add(carapace);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 1),
    new THREE.MeshStandardMaterial({ color: 0xff8aa0, emissive: 0xff4a6a, emissiveIntensity: 2.4, roughness: 0.3, flatShading: true })
  );
  core.position.set(0, 3.3, 1.7);
  group.add(core);

  const head = mesh(new THREE.IcosahedronGeometry(1.15, 0), dark, [0, 3.4, 2.6]);
  group.add(head);
  for (const side of [-1, 1]) {
    const horn = mesh(new THREE.ConeGeometry(0.28, 2.2, 5), solid(accent, { roughness: 0.4 }), [side * 0.7, 4.6, 2.4], [1, 1, 1], [-0.5, 0, side * 0.45]);
    group.add(horn);
    const eye = mesh(new THREE.SphereGeometry(0.22, 6, 6), solid(0xffe08a, { emissive: 0xffc24a, emissiveIntensity: 2.6, roughness: 0.2 }), [side * 0.45, 3.6, 3.4]);
    group.add(eye);
  }

  const legs = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = mesh(new THREE.CylinderGeometry(0.18, 0.1, 3.6, 5), dark,
        [side * 2.1, 1.7, 1.4 - i * 1.5], [1, 1, 1], [0.25, 0, side * 0.55]);
      legs.add(leg);
    }
  }
  group.add(legs);

  const wings = new THREE.Group();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), WING_MATERIAL());
    wing.scale.set(0.3, 0.1, 1.1);
    wing.position.set(side * 1.7, 5, -1.2);
    wing.rotation.z = side * 0.4;
    wings.add(wing);
  }
  group.add(wings);

  group.userData = { body, core, legs, wings, carapace };
  return group;
}

const BUILDERS = { mite: buildMite, husk: buildHusk, spitter: buildSpitter, stalker: buildStalker, guardian: buildGuardian };

export class ActorPool {
  constructor(scene) {
    this.scene = scene;
    this.pools = new Map();
    this.active = new Map();
  }

  setBiome(biome) {
    this.biome = biome;
    for (const [, pool] of this.pools) {
      for (const item of pool) this.scene.remove(item);
    }
    this.pools.clear();
  }

  acquire(enemy) {
    const kind = enemy.kind;
    const pool = this.pools.get(kind) || [];
    let model = pool.pop();
    if (!model) {
      const builder = BUILDERS[kind] || buildMite;
      model = builder(this.biome.enemyTint, this.biome.accent);
      model.traverse(node => { if (node.isMesh) node.material = node.material.clone(); });
    }
    model.visible = true;
    this.scene.add(model);
    this.pools.set(kind, pool);
    this.active.set(enemy, model);
    return model;
  }

  release(enemy) {
    const model = this.active.get(enemy);
    if (!model) return;
    this.active.delete(enemy);
    this.scene.remove(model);
    model.visible = false;
    const pool = this.pools.get(enemy.kind) || [];
    pool.push(model);
    this.pools.set(enemy.kind, pool);
  }

  sync(enemies, elapsed, dt) {
    const seen = new Set();
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      seen.add(enemy);
      const model = this.active.get(enemy) || this.acquire(enemy);
      const appear = enemy.appear > 0 ? 1 - enemy.appear / 0.55 : 1;
      const eliteScale = enemy.elite ? 1.3 : 1;
      const scale = Math.max(0.05, appear) * eliteScale * (enemy.boss ? 1 : 1);

      model.position.set(enemy.x, enemy.y, enemy.z);
      model.rotation.y = -enemy.facing + Math.PI / 2;
      const squash = enemy.flash > 0 ? 1 + enemy.flash * 1.6 : 1;
      model.scale.set(scale * squash, scale * (2 - squash), scale * squash);

      const data = model.userData;
      if (data.body) {
        const material = data.body.material;
        if (material.emissive) {
          material.emissiveIntensity = enemy.flash > 0 ? 3.5 : (enemy.elite ? 0.55 : 0);
          if (enemy.flash > 0) material.emissive.setHex(0xffffff);
          else material.emissive.setHex(enemy.elite ? 0xf0b55c : 0x000000);
        }
      }

      if (enemy.kind === 'mite') {
        model.position.y += Math.abs(Math.sin(elapsed * 9 + enemy.spawnTime * 5)) * 0.22;
        model.rotation.z = Math.sin(elapsed * 6) * 0.12;
      } else if (enemy.kind === 'husk' && data.arms) {
        data.arms.rotation.x = Math.sin(elapsed * 3 + enemy.spawnTime) * 0.35;
        model.rotation.z = Math.sin(elapsed * 1.6 + enemy.spawnTime) * 0.07;
      } else if (enemy.kind === 'spitter') {
        model.position.y += 0.35 + Math.sin(elapsed * 2.4 + enemy.spawnTime) * 0.18;
        if (data.sac) data.sac.material.emissiveIntensity = 1.4 + (1 - Math.min(1, enemy.shootCd)) * 2.2;
      } else if (enemy.kind === 'stalker' && data.legs) {
        data.legs.rotation.x = Math.sin(elapsed * 11) * 0.22;
        model.rotation.x = enemy.lunging > 0 ? -0.35 : 0;
      } else if (enemy.boss) {
        model.position.y += Math.sin(elapsed * 1.4) * 0.22;
        if (data.core) {
          const heat = enemy.phase === 3 ? 4.5 : enemy.phase === 2 ? 3.2 : 2.2;
          data.core.material.emissiveIntensity = heat + Math.sin(elapsed * 7) * 0.6;
          data.core.rotation.y += dt * 1.4;
        }
        if (data.wings) {
          data.wings.children.forEach((wing, i) => {
            wing.rotation.x = Math.sin(elapsed * 14 + i) * 0.3;
          });
        }
        if (enemy.telegraph) {
          const t = 1 - enemy.telegraph.time;
          model.scale.multiplyScalar(1 + Math.sin(t * 18) * 0.02);
        }
      }
    }

    for (const [enemy] of this.active) {
      if (!seen.has(enemy)) this.release(enemy);
    }
  }
}

// ---------------------------------------------------------------- projectiles

export class ProjectileView {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = new Map();
    this.geometry = new THREE.SphereGeometry(0.28, 8, 6);
  }

  colorFor(shot, biome) {
    if (shot.hostile) return 0x9ef06a;
    return {
      waxguard: 0xffd36a,
      bloomweaver: 0xc98cff,
      thornstrider: 0x9ef0a4,
      hymnkeeper: 0xffe9a8
    }[shot.kind] || biome.accent;
  }

  sync(projectiles, biome, dt) {
    const seen = new Set();
    for (const shot of projectiles) {
      seen.add(shot);
      let model = this.active.get(shot);
      if (!model) {
        model = this.pool.pop();
        if (!model) {
          model = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }));
          model.frustumCulled = false;
        }
        model.material.color.setHex(this.colorFor(shot, biome));
        model.visible = true;
        this.scene.add(model);
        this.active.set(shot, model);
      }
      model.position.set(shot.x, shot.y, shot.z);
      const speed = Math.hypot(shot.vx, shot.vz);
      const stretch = Math.min(3.2, 1 + speed * 0.05);
      model.scale.set(shot.radius * 2.2, shot.radius * 2.2, shot.radius * 2.2 * stretch);
      model.rotation.y = Math.atan2(shot.vx, shot.vz);
    }
    for (const [shot, model] of this.active) {
      if (seen.has(shot)) continue;
      this.active.delete(shot);
      this.scene.remove(model);
      this.pool.push(model);
    }
  }
}

// -------------------------------------------------------------------- bursts

export class EffectsView {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.sparks = [];
    this.ringGeometry = new THREE.RingGeometry(0.75, 1, 28);
    this.sparkGeometry = new THREE.IcosahedronGeometry(0.16, 0);
  }

  ring(x, y, z, radius, color, duration = 0.45) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const item = new THREE.Mesh(this.ringGeometry, material);
    item.rotation.x = -Math.PI / 2;
    item.position.set(x, y + 0.25, z);
    item.scale.setScalar(radius * 0.25);
    this.scene.add(item);
    this.rings.push({ mesh: item, life: duration, max: duration, radius });
  }

  burst(x, y, z, color, count = 7, power = 5) {
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const spark = new THREE.Mesh(this.sparkGeometry, material);
      spark.position.set(x, y, z);
      const angle = Math.random() * Math.PI * 2;
      const pitch = Math.random() * 0.9;
      const speed = power * (0.4 + Math.random() * 0.8);
      this.scene.add(spark);
      this.sparks.push({
        mesh: spark,
        vx: Math.cos(angle) * Math.cos(pitch) * speed,
        vy: Math.sin(pitch) * speed,
        vz: Math.sin(angle) * Math.cos(pitch) * speed,
        life: 0.5 + Math.random() * 0.3,
        max: 0.8
      });
    }
  }

  update(dt) {
    for (const entry of this.rings) {
      entry.life -= dt;
      const t = 1 - entry.life / entry.max;
      entry.mesh.scale.setScalar(entry.radius * (0.25 + t * 0.85));
      entry.mesh.material.opacity = Math.max(0, 0.85 * (1 - t));
      if (entry.life <= 0) {
        this.scene.remove(entry.mesh);
        entry.mesh.material.dispose();
      }
    }
    this.rings = this.rings.filter(entry => entry.life > 0);

    for (const spark of this.sparks) {
      spark.life -= dt;
      spark.vy -= 14 * dt;
      spark.mesh.position.x += spark.vx * dt;
      spark.mesh.position.y += spark.vy * dt;
      spark.mesh.position.z += spark.vz * dt;
      spark.mesh.material.opacity = Math.max(0, spark.life / spark.max);
      spark.mesh.scale.setScalar(Math.max(0.2, spark.life * 2));
      if (spark.life <= 0) {
        this.scene.remove(spark.mesh);
        spark.mesh.material.dispose();
      }
    }
    this.sparks = this.sparks.filter(spark => spark.life > 0);
  }
}
