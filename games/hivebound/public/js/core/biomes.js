// The five faces of the Bloom. Everything visual about a region lives here:
// palette, light, weather, which props grow in it and which creatures crawl out
// of it. The renderer reads this file; the simulation only reads `enemies`.

export const BIOMES = [
  {
    id: 'verdant',
    name: 'Verdant Reach',
    lore: 'Sunlight still reaches the clover here. It will not last.',
    sky: 0x8fc4a8,
    horizon: 0xd9e6b4,
    fog: 0x4e6b4a,
    fogDensity: 0.0040,
    ground: [0x355a34, 0x47702f, 0x243c28],
    path: 0x6d6a3c,
    sun: { color: 0xfff0c4, intensity: 3.0, angle: 0.9, height: 38 },
    hemi: { sky: 0xa8c8f0, ground: 0x2a3a24, intensity: 0.62 },
    bloom: 0.32,
    accent: 0x9ae06a,
    enemyTint: 0xa6d58e,
    propColors: { mushroom: 0xc4523f, cap: 0xe8dcc0, flower: 0xf0d267, wood: 0x6b4a2c, glow: 0xfff0a8, crystal: 0x9ad8b0 },
    ambient: { kind: 'pollen', color: 0xf7f0a8, count: 300, rise: 0.35 },
    props: [
      ['grass', 26], ['clover', 14], ['flower', 7], ['mushroom', 4],
      ['rock', 4], ['log', 2], ['fern', 9], ['combpillar', 1]
    ]
  },
  {
    id: 'mycelian',
    name: 'Mycelian Deep',
    lore: 'The spores remember every bee that breathed them in.',
    sky: 0x2a1a3a,
    horizon: 0x53306b,
    fog: 0x281838,
    fogDensity: 0.0105,
    ground: [0x322544, 0x412a58, 0x1c1428],
    path: 0x5c4a6e,
    sun: { color: 0xc59bff, intensity: 1.5, angle: 2.3, height: 30 },
    hemi: { sky: 0x7a5ca8, ground: 0x241834, intensity: 0.72 },
    bloom: 0.5,
    accent: 0xc98cff,
    enemyTint: 0xda98e9,
    propColors: { mushroom: 0x9a5ccc, cap: 0xc98cff, flower: 0xd7a6ff, wood: 0x4a3358, glow: 0xd7a6ff, crystal: 0xb07cff },
    ambient: { kind: 'spore', color: 0xd7a6ff, count: 300, rise: 0.12 },
    props: [
      ['mushroom', 26], ['glowcap', 12], ['grass', 10], ['crystal', 6],
      ['rock', 5], ['spore', 7], ['deadtree', 3], ['fern', 4]
    ]
  },
  {
    id: 'ashen',
    name: 'Ashen Orchard',
    lore: 'Something burned the blossom. The orchard kept standing anyway.',
    sky: 0x3b1f18,
    horizon: 0xb35a2c,
    fog: 0x3d1d14,
    fogDensity: 0.0095,
    ground: [0x412920, 0x573727, 0x261612],
    path: 0x6b4630,
    sun: { color: 0xffa054, intensity: 2.4, angle: 0.35, height: 22 },
    hemi: { sky: 0xc07a50, ground: 0x2a1410, intensity: 0.55 },
    bloom: 0.45,
    accent: 0xff8a45,
    enemyTint: 0xeaa576,
    propColors: { mushroom: 0x8a4a32, cap: 0xd9773f, flower: 0xff9a4a, wood: 0x3d2a20, glow: 0xff9a4a, crystal: 0xff7a3a },
    ambient: { kind: 'ember', color: 0xff9a4a, count: 260, rise: 1.2 },
    props: [
      ['deadtree', 16], ['rock', 12], ['grass', 8], ['log', 6],
      ['crystal', 4], ['combpillar', 5], ['flower', 2], ['mushroom', 3]
    ]
  },
  {
    id: 'fen',
    name: 'Moonlit Fen',
    lore: 'Still water, and something patient underneath it.',
    sky: 0x101c2e,
    horizon: 0x2b4a6e,
    fog: 0x101e30,
    fogDensity: 0.0115,
    ground: [0x1e3242, 0x27424a, 0x121d26],
    path: 0x3e5a63,
    sun: { color: 0xa8caff, intensity: 1.7, angle: 2.9, height: 44 },
    hemi: { sky: 0x6f8fc4, ground: 0x18242f, intensity: 0.8 },
    bloom: 0.48,
    accent: 0x7fd4ff,
    enemyTint: 0x8bc3dd,
    propColors: { mushroom: 0x4a7f96, cap: 0x8fd8f0, flower: 0x9fe8ff, wood: 0x2c3f47, glow: 0x9fe8ff, crystal: 0x7fd4ff },
    ambient: { kind: 'firefly', color: 0x9fe8ff, count: 220, rise: 0.05 },
    props: [
      ['reed', 24], ['grass', 12], ['rock', 8], ['mushroom', 5],
      ['deadtree', 6], ['crystal', 5], ['log', 4], ['glowcap', 5]
    ]
  },
  {
    id: 'crown',
    name: 'Crownless Garden',
    lore: 'The old hive of the Queen. Gold, and nobody left to wear it.',
    sky: 0x2a2113,
    horizon: 0xc9963d,
    fog: 0x3a2c14,
    fogDensity: 0.0075,
    ground: [0x483921, 0x604c28, 0x2a2112],
    path: 0x8a7038,
    sun: { color: 0xffd98a, intensity: 2.6, angle: 1.7, height: 34 },
    hemi: { sky: 0xd8b878, ground: 0x2a2012, intensity: 0.6 },
    bloom: 0.45,
    accent: 0xf3c968,
    enemyTint: 0xe4c884,
    propColors: { mushroom: 0xb5873a, cap: 0xf0d98d, flower: 0xf6d98d, wood: 0x5c4726, glow: 0xffe6a0, crystal: 0xf3c968 },
    ambient: { kind: 'petal', color: 0xf6d98d, count: 240, rise: -0.25 },
    props: [
      ['combpillar', 18], ['grass', 10], ['flower', 9], ['rock', 7],
      ['crystal', 4], ['deadtree', 4], ['clover', 6], ['mushroom', 3]
    ]
  }
];

export function biomeForRegion(region) {
  return BIOMES[(region - 1) % BIOMES.length];
}

// Creatures of the Gloam. `kind` drives both the model and the behaviour.
export const ENEMIES = {
  mite: {
    kind: 'mite', name: 'Gloam Mite', radius: 0.62, hp: 26, speed: 8.6, damage: 8,
    behaviour: 'chase', xp: 6, score: 10, height: 0.8
  },
  husk: {
    kind: 'husk', name: 'Petal Husk', radius: 1.15, hp: 62, speed: 4.5, damage: 13,
    behaviour: 'chase', xp: 11, score: 18, height: 1.6
  },
  spitter: {
    kind: 'spitter', name: 'Spore Spitter', radius: 0.9, hp: 40, speed: 3.2, damage: 9,
    behaviour: 'kite', xp: 12, score: 22, height: 1.3,
    ranged: { range: 20, cooldown: 2.4, speed: 17, damage: 11 }
  },
  stalker: {
    kind: 'stalker', name: 'Thorn Stalker', radius: 0.85, hp: 48, speed: 6.0, damage: 15,
    behaviour: 'lunge', xp: 14, score: 26, height: 1.2
  },
  guardian: {
    kind: 'guardian', name: 'Region Guardian', radius: 3.4, hp: 1100, speed: 2.6, damage: 24,
    behaviour: 'boss', xp: 80, score: 1500, height: 4.2, boss: true
  }
};

// Which creatures a region can send, and how often.
export function enemyTable(region) {
  const table = [['mite', 58], ['husk', 22], ['spitter', 12], ['stalker', 8]];
  if (region >= 2) { table[1][1] += 6; table[2][1] += 6; }
  if (region >= 3) { table[3][1] += 10; table[0][1] -= 10; }
  if (region >= 4) { table[2][1] += 8; table[0][1] -= 6; }
  return table.filter(([, weight]) => weight > 0);
}

export function pickEnemy(rng, region) {
  const table = enemyTable(region);
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [id, weight] of table) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return table[0][0];
}
