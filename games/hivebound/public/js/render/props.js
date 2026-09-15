// Everything that grows in a glade. Each prop kind is described as a small set
// of parts (geometry + material recipe + local transform); the glade view turns
// every part into one InstancedMesh, so a thousand mushrooms cost a handful of
// draw calls.

import * as THREE from 'three';

const geometryCache = new Map();
function cached(key, build) {
  if (!geometryCache.has(key)) geometryCache.set(key, build());
  return geometryCache.get(key);
}

// A tapered blade, bent slightly so grass does not look like spikes.
function bladeGeometry() {
  const geometry = new THREE.CylinderGeometry(0.012, 0.075, 1, 3, 2, true);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = (y + 0.5);
    position.setX(i, position.getX(i) + t * t * 0.22);
  }
  geometry.translate(0, 0.5, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function capGeometry() {
  const geometry = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
  geometry.scale(1, 0.72, 1);
  return geometry;
}

function petalGeometry() {
  const geometry = new THREE.SphereGeometry(0.28, 5, 3);
  geometry.scale(1, 0.28, 1.8);
  return geometry;
}

const G = {
  blade: () => cached('blade', bladeGeometry),
  cap: () => cached('cap', capGeometry),
  petal: () => cached('petal', petalGeometry),
  stem: () => cached('stem', () => {
    const g = new THREE.CylinderGeometry(0.09, 0.14, 1, 5);
    g.translate(0, 0.5, 0);
    return g;
  }),
  trunk: () => cached('trunk', () => {
    const g = new THREE.CylinderGeometry(0.22, 0.42, 1, 6);
    g.translate(0, 0.5, 0);
    return g;
  }),
  branch: () => cached('branch', () => {
    const g = new THREE.CylinderGeometry(0.05, 0.13, 1, 5);
    g.translate(0, 0.5, 0);
    return g;
  }),
  rock: () => cached('rock', () => new THREE.IcosahedronGeometry(0.5, 0)),
  shard: () => cached('shard', () => new THREE.ConeGeometry(0.32, 1.5, 5)),
  hex: () => cached('hex', () => {
    const g = new THREE.CylinderGeometry(0.62, 0.68, 1, 6);
    g.translate(0, 0.5, 0);
    return g;
  }),
  hexPlate: () => cached('hexPlate', () => new THREE.CylinderGeometry(0.78, 0.7, 0.22, 6)),
  pod: () => cached('pod', () => new THREE.IcosahedronGeometry(0.34, 0)),
  leaf: () => cached('leaf', () => {
    const g = new THREE.SphereGeometry(0.4, 5, 3);
    g.scale(1, 0.12, 1.5);
    return g;
  })
};

// part: { geometry, color, emissive, roughness, offset:[x,y,z], scale:[x,y,z], rotation:[x,y,z], sway }
// `sway` marks parts the wind animates.
export const PROP_KINDS = {
  grass: biome => [
    { geometry: G.blade(), color: tint(biome.ground[1], 1.5), scale: [1, 0.95, 1], sway: 1 },
    { geometry: G.blade(), color: tint(biome.ground[0], 1.35), scale: [0.8, 0.7, 0.8], rotation: [0, 1.1, 0.12], sway: 1 }
  ],
  clover: biome => [
    { geometry: G.stem(), color: tint(biome.ground[1], 1.3), scale: [0.5, 0.55, 0.5] },
    { geometry: G.leaf(), color: tint(biome.ground[1], 1.7), offset: [0, 0.6, 0.18], scale: [1, 1, 1], sway: 0.6 },
    { geometry: G.leaf(), color: tint(biome.ground[1], 1.45), offset: [0.16, 0.58, -0.12], rotation: [0, 2.1, 0.1], sway: 0.6 }
  ],
  fern: biome => [
    { geometry: G.leaf(), color: tint(biome.ground[1], 1.6), offset: [0, 0.35, 0.3], rotation: [0.5, 0, 0], scale: [1.1, 1, 1.6], sway: 0.8 },
    { geometry: G.leaf(), color: tint(biome.ground[1], 1.3), offset: [0.25, 0.3, -0.2], rotation: [0.4, 2.2, 0], scale: [1, 1, 1.4], sway: 0.8 },
    { geometry: G.leaf(), color: tint(biome.ground[0], 1.4), offset: [-0.28, 0.28, -0.1], rotation: [0.45, 4.1, 0], scale: [0.9, 1, 1.3], sway: 0.8 }
  ],
  flower: biome => [
    { geometry: G.stem(), color: tint(biome.ground[1], 1.4), scale: [0.45, 1.3, 0.45], sway: 0.4 },
    { geometry: G.petal(), color: biome.propColors.flower, offset: [0, 1.3, 0], scale: [1, 1, 1], sway: 0.5 },
    { geometry: G.petal(), color: tint(biome.propColors.flower, 0.85), offset: [0, 1.32, 0], rotation: [0, 1.05, 0], sway: 0.5 },
    { geometry: G.petal(), color: tint(biome.propColors.flower, 0.95), offset: [0, 1.28, 0], rotation: [0, 2.1, 0], sway: 0.5 },
    { geometry: G.pod(), color: biome.propColors.glow, emissive: biome.propColors.glow, emissiveIntensity: 0.45, offset: [0, 1.38, 0], scale: [0.5, 0.5, 0.5] }
  ],
  mushroom: biome => [
    { geometry: G.stem(), color: biome.propColors.cap, scale: [0.7, 1.1, 0.7] },
    { geometry: G.cap(), color: biome.propColors.mushroom, offset: [0, 1.05, 0], scale: [1.5, 1.4, 1.5] },
    { geometry: G.pod(), color: tint(biome.propColors.cap, 1.1), offset: [0.3, 1.24, 0.2], scale: [0.26, 0.12, 0.26] }
  ],
  glowcap: biome => [
    { geometry: G.stem(), color: tint(biome.propColors.cap, 0.8), scale: [0.6, 1.6, 0.6] },
    { geometry: G.cap(), color: biome.propColors.glow, emissive: biome.propColors.glow, emissiveIntensity: 0.4, offset: [0, 1.55, 0], scale: [1.7, 1.5, 1.7] },
    { geometry: G.pod(), color: biome.propColors.glow, emissive: biome.propColors.glow, emissiveIntensity: 0.8, offset: [0, 1.5, 0], scale: [0.5, 0.5, 0.5] }
  ],
  rock: biome => [
    { geometry: G.rock(), color: tint(biome.ground[2], 1.7), offset: [0, 0.32, 0], scale: [1.3, 0.85, 1.15], roughness: 0.95 },
    { geometry: G.rock(), color: tint(biome.ground[2], 1.35), offset: [0.4, 0.16, 0.25], scale: [0.6, 0.45, 0.55], roughness: 0.95 }
  ],
  log: biome => [
    { geometry: G.trunk(), color: biome.propColors.wood, offset: [0, 0.3, 0], rotation: [Math.PI / 2, 0, 0.2], scale: [0.8, 2.6, 0.8], roughness: 1 }
  ],
  deadtree: biome => [
    { geometry: G.trunk(), color: biome.propColors.wood, scale: [1, 4.5, 1], roughness: 1 },
    { geometry: G.branch(), color: tint(biome.propColors.wood, 0.85), offset: [0.1, 3.1, 0], rotation: [0, 0, -0.9], scale: [1, 2.2, 1] },
    { geometry: G.branch(), color: tint(biome.propColors.wood, 0.92), offset: [-0.1, 2.6, 0.1], rotation: [0.3, 2, 1.1], scale: [0.9, 1.9, 0.9] },
    { geometry: G.branch(), color: tint(biome.propColors.wood, 0.8), offset: [0, 3.8, -0.1], rotation: [-0.4, 1, 0.4], scale: [0.8, 1.6, 0.8] }
  ],
  crystal: biome => [
    { geometry: G.shard(), color: biome.propColors.crystal, emissive: biome.propColors.crystal, emissiveIntensity: 0.4, offset: [0, 0.75, 0], scale: [1, 1, 1], transparent: true, opacity: 0.88 },
    { geometry: G.shard(), color: tint(biome.propColors.crystal, 0.85), emissive: biome.propColors.crystal, emissiveIntensity: 0.3, offset: [0.35, 0.45, 0.2], rotation: [0.2, 0.6, 0.35], scale: [0.6, 0.7, 0.6], transparent: true, opacity: 0.8 }
  ],
  combpillar: biome => [
    { geometry: G.hex(), color: tint(biome.path, 1.1), scale: [1, 3.2, 1], roughness: 0.8 },
    { geometry: G.hexPlate(), color: tint(biome.propColors.cap, 0.9), offset: [0, 3.2, 0], scale: [1.05, 1, 1.05] },
    { geometry: G.hex(), color: tint(biome.path, 0.9), offset: [0.85, 0, 0.35], scale: [0.55, 1.8, 0.55], roughness: 0.85 }
  ],
  reed: biome => [
    { geometry: G.blade(), color: tint(biome.ground[1], 1.5), scale: [0.55, 3.4, 0.55], sway: 1.4 },
    { geometry: G.blade(), color: tint(biome.ground[0], 1.35), offset: [0.22, 0, 0.16], rotation: [0, 1.4, 0.08], scale: [0.45, 2.6, 0.45], sway: 1.4 },
    { geometry: G.pod(), color: biome.propColors.wood, offset: [0, 3.3, 0], scale: [0.4, 0.9, 0.4] }
  ],
  spore: biome => [
    { geometry: G.stem(), color: tint(biome.ground[1], 1.3), scale: [0.5, 1.4, 0.5] },
    { geometry: G.pod(), color: biome.propColors.glow, emissive: biome.propColors.glow, emissiveIntensity: 0.65, offset: [0, 1.7, 0], scale: [1.3, 1.3, 1.3], sway: 0.9 }
  ]
};

export function tint(hex, factor) {
  const color = new THREE.Color(hex);
  color.multiplyScalar(factor);
  color.r = Math.min(1, color.r);
  color.g = Math.min(1, color.g);
  color.b = Math.min(1, color.b);
  return color.getHex();
}

export function propParts(kind, biome) {
  const build = PROP_KINDS[kind] || PROP_KINDS.rock;
  return build(biome);
}

export function materialFor(part) {
  return new THREE.MeshStandardMaterial({
    color: part.color,
    emissive: part.emissive ?? 0x000000,
    emissiveIntensity: part.emissiveIntensity ?? 1,
    roughness: part.roughness ?? 0.7,
    metalness: 0,
    flatShading: true,
    transparent: Boolean(part.transparent),
    opacity: part.opacity ?? 1
  });
}
