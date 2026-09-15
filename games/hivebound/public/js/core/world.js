// Glade generation. One node of a run = one glade: a bowl of terrain with a
// landmark in the middle, things worth finding in the grass, and gates at the
// far end that show you what you are walking into next.
//
// Pure data: the simulation walks it, the renderer builds meshes from it, and
// the tests can generate a hundred of them without a browser.

import { RNG, makeNoise2D, fbm } from './rng.js';
import { biomeForRegion } from './biomes.js';

export const GRID = 96;
export const EXTENT = 190;
export const PLAY_RADIUS = 58;
const RIM_RADIUS = 76;

export const NODE_TYPES = {
  combat: { type: 'combat', icon: '⚔️', title: 'Gloam Swarm', desc: 'Survive an escalating swarm and gather materials.', risk: 'Normal risk', poi: 'rift' },
  elite: { type: 'elite', icon: '☠️', title: 'Marked Predator', desc: 'Stronger enemies, richer relics and more score.', risk: 'High risk · better loot', poi: 'rift' },
  treasure: { type: 'treasure', icon: '🗝️', title: 'Forgotten Comb', desc: 'Choose a relic from an abandoned royal cache.', risk: 'Safe · no combat', poi: 'cache' },
  shrine: { type: 'shrine', icon: '⬡', title: 'Wax Shrine', desc: 'Spend gathered materials to permanently shape this run.', risk: 'Crafting', poi: 'shrine' },
  event: { type: 'event', icon: '🌒', title: 'Whispering Petal', desc: 'A strange choice: power always asks for something back.', risk: 'Unknown', poi: 'petal' },
  boss: { type: 'boss', icon: '♛', title: 'Guardian', desc: 'End the region. The next Bloom will be more corrupted.', risk: 'BOSS · huge score', poi: 'throne' }
};

export const STEPS_PER_REGION = 4;

export function nodeChoices(rng, step) {
  if (step >= STEPS_PER_REGION) return [{ ...NODE_TYPES.boss }];
  const pool = [NODE_TYPES.combat, NODE_TYPES.elite, NODE_TYPES.treasure, NODE_TYPES.shrine, NODE_TYPES.event];
  const choices = rng.shuffle(pool).slice(0, 3);
  // The first glade of a region always offers a fight, so a run cannot open
  // with three free nodes in a row.
  if (step === 0 && !choices.some(c => c.type === 'combat')) choices[0] = NODE_TYPES.combat;
  return choices.map(c => ({ ...c }));
}

function heightField(rng, region) {
  const noise = makeNoise2D(rng.int(1, 0x7fffffff));
  const detail = makeNoise2D(rng.int(1, 0x7fffffff));
  const heights = new Float32Array((GRID + 1) * (GRID + 1));
  const half = EXTENT / 2;
  const roughness = 1 + region * 0.08;

  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      const x = -half + (i / GRID) * EXTENT;
      const z = -half + (j / GRID) * EXTENT;
      const radius = Math.hypot(x, z);

      let h = (fbm(noise, x * 0.035 + 11, z * 0.035 + 7, 4) - 0.5) * 5.2 * roughness;
      h += (fbm(detail, x * 0.14, z * 0.14, 2) - 0.5) * 1.1;

      // A flat heart for fighting, a rising rim so the glade feels enclosed.
      const flatten = Math.min(1, Math.max(0, (radius - 8) / 16));
      h *= 0.25 + 0.75 * flatten;
      if (radius > PLAY_RADIUS) {
        const t = Math.min(1, (radius - PLAY_RADIUS) / (RIM_RADIUS - PLAY_RADIUS));
        h += t * t * 26;
      }
      heights[j * (GRID + 1) + i] = h;
    }
  }
  return heights;
}

export function sampleHeight(heights, x, z) {
  const half = EXTENT / 2;
  const fx = ((x + half) / EXTENT) * GRID;
  const fz = ((z + half) / EXTENT) * GRID;
  const i = Math.max(0, Math.min(GRID - 1, Math.floor(fx)));
  const j = Math.max(0, Math.min(GRID - 1, Math.floor(fz)));
  const tx = Math.max(0, Math.min(1, fx - i));
  const tz = Math.max(0, Math.min(1, fz - j));
  const row = GRID + 1;
  const h00 = heights[j * row + i];
  const h10 = heights[j * row + i + 1];
  const h01 = heights[(j + 1) * row + i];
  const h11 = heights[(j + 1) * row + i + 1];
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

function weightedProp(rng, props) {
  const total = props.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [kind, weight] of props) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return props[0][0];
}

function scatterProps(rng, biome, heights, blocked) {
  const props = [];
  const attempts = 2600;
  const grassShare = 0.52;

  for (let n = 0; n < attempts; n++) {
    const angle = rng.next() * Math.PI * 2;
    // Bias outward: the rim should read as a wall of vegetation.
    const radius = Math.sqrt(rng.next()) * (RIM_RADIUS - 2);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const clear = blocked.some(b => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r);
    if (clear) continue;

    const forceGrass = rng.next() < grassShare && radius < PLAY_RADIUS + 6;
    const kind = forceGrass ? 'grass' : weightedProp(rng, biome.props);
    if (kind !== 'grass' && radius < 16 && rng.next() < 0.75) continue;

    props.push({
      kind,
      x,
      z,
      y: sampleHeight(heights, x, z),
      scale: kind === 'grass'
        ? rng.range(0.7, 1.5)
        : rng.range(0.6, 1.15) * (radius > PLAY_RADIUS ? 1.8 : radius > 34 ? 1.25 : 1),
      rotation: rng.next() * Math.PI * 2,
      tilt: rng.range(-0.11, 0.11),
      variant: rng.int(0, 3),
      shade: rng.range(0.82, 1.18)
    });
  }
  return props;
}

function ringPoints(rng, count, minRadius, maxRadius) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const radius = rng.range(minRadius, maxRadius);
    points.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
  }
  return points;
}

/**
 * Build one glade.
 * @param {object} options
 * @param {number} options.seed      run seed mixed with region/step
 * @param {number} options.region    1-based region index
 * @param {number} options.step      0-based node index inside the region
 * @param {string} options.nodeType  key of NODE_TYPES
 * @param {boolean} options.last     true when this glade ends the region
 */
export function generateGlade({ seed, region, step, nodeType, nextChoices = [] }) {
  const rng = new RNG(seed);
  const biome = biomeForRegion(region);
  const node = NODE_TYPES[nodeType] || NODE_TYPES.combat;
  const heights = heightField(rng, region);

  const poi = { kind: node.poi, x: 0, z: -2, radius: node.poi === 'throne' ? 12 : 3.4 };
  const playerStart = { x: rng.range(-4, 4), z: PLAY_RADIUS * 0.66 };

  const gates = nextChoices.map((choice, index) => {
    const spread = nextChoices.length === 1 ? 0 : (index - (nextChoices.length - 1) / 2) * 0.46;
    const angle = -Math.PI / 2 + spread;
    const radius = PLAY_RADIUS - 5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return { ...choice, x, z, y: sampleHeight(heights, x, z), angle: angle + Math.PI / 2, radius: 3.6 };
  });

  const blocked = [
    { x: poi.x, z: poi.z, r: node.poi === 'throne' ? 15 : 8.5 },
    { x: playerStart.x, z: playerStart.z, r: 6 },
    ...gates.map(g => ({ x: g.x, z: g.z, r: 7 }))
  ];

  const props = scatterProps(rng, biome, heights, blocked);

  const pickups = [];
  const motes = rng.int(5, 9);
  for (let i = 0; i < motes; i++) {
    const angle = rng.next() * Math.PI * 2;
    const radius = rng.range(14, PLAY_RADIUS - 6);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const roll = rng.next();
    pickups.push({
      kind: roll < 0.62 ? 'nectar' : roll < 0.84 ? 'wax' : 'pollen',
      x, z, y: sampleHeight(heights, x, z)
    });
  }

  // Something to actually find when you leave the obvious route.
  let secret = null;
  if (node.poi !== 'throne' && rng.chance(0.42)) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(PLAY_RADIUS - 12, PLAY_RADIUS - 2);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    secret = { kind: 'relicshard', x, z, y: sampleHeight(heights, x, z), radius: 2.4, taken: false };
  }

  return {
    seed, region, step, node, biome,
    heights,
    grid: GRID,
    extent: EXTENT,
    playRadius: PLAY_RADIUS,
    rimRadius: RIM_RADIUS,
    poi,
    gates,
    props,
    pickups,
    secret,
    playerStart,
    spawnPoints: ringPoints(rng, 14, 24, PLAY_RADIUS - 8),
    wanderers: node.poi === 'rift' || node.poi === 'throne' ? 0 : rng.int(2, 4),
    heightAt(x, z) { return sampleHeight(heights, x, z); }
  };
}
