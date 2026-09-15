// Run rules: who you are, what you carry, how numbers turn into power.
// Pure data and pure functions — no DOM, no WebGL, no timers. The simulation
// and the tests both build on this file.

// Distances and speeds are expressed in world units (1 unit ≈ one bee length).
export const CLASSES = {
  waxguard: {
    name: 'Waxguard',
    role: 'WARRIOR OF THE HIVE',
    icon: '🛡️',
    subtitle: 'Close combat · armour · retaliation',
    description: 'Stand inside the swarm. Your wax armour hardens under pressure and your stinger turns pain into momentum.',
    ability: 'Bastion of Wax',
    abilityDesc: 'Become invulnerable briefly and blast nearby enemies.',
    abilityCooldown: 11,
    colors: { body: 0xe0a83c, trim: 0x8a5a24, glow: 0xffd98a },
    base: { hp: 150, damage: 22, speed: 8.2, attackRate: 0.62, crit: 0.05, range: 6.2, projectileSpeed: 0 },
    traits: ['Melee cleave', 'Highest vitality', 'Damage taken fuels fury']
  },
  bloomweaver: {
    name: 'Bloomweaver',
    role: 'POLLEN MAGE',
    icon: '🔮',
    subtitle: 'Spells · area damage · chain reactions',
    description: 'Shape forbidden pollen into volatile spells. Fragile at first; terrifying once Resonances begin to chain.',
    ability: 'Superbloom',
    abilityDesc: 'Detonate a ring of arcane seeds around you.',
    abilityCooldown: 9,
    colors: { body: 0x8f5cc8, trim: 0x4a2c72, glow: 0xd7a6ff },
    base: { hp: 92, damage: 18, speed: 7.7, attackRate: 0.48, crit: 0.09, range: 26, projectileSpeed: 30 },
    traits: ['Long range', 'Explosive spell synergies', 'Low vitality']
  },
  thornstrider: {
    name: 'Thornstrider',
    role: 'RANGER OF THE WILD',
    icon: '🏹',
    subtitle: 'Speed · critical hits · poison',
    description: 'Never stop moving. Thorn arrows reward distance, tempo and risky routes through the Bloom.',
    ability: 'Briarstep',
    abilityDesc: 'Dash through danger and fire a radial thorn volley.',
    abilityCooldown: 8,
    colors: { body: 0x5fae7a, trim: 0x2a5c40, glow: 0xb6f5c2 },
    base: { hp: 108, damage: 15, speed: 9.7, attackRate: 0.31, crit: 0.16, range: 30, projectileSpeed: 42 },
    traits: ['Fastest movement', 'Rapid ranged attacks', 'Critical build specialist']
  },
  hymnkeeper: {
    name: 'Hymnkeeper',
    role: 'ROYAL CANTOR',
    icon: '✨',
    subtitle: 'Motes · healing · blessings',
    description: 'Carry the old song of the Queen. Sacred motes fight beside you while every blessing can become a weapon.',
    ability: 'Queen’s Chorus',
    abilityDesc: 'Heal and summon a burst of homing royal motes.',
    abilityCooldown: 12,
    colors: { body: 0xe3c874, trim: 0x8a6a28, glow: 0xfff4c4 },
    base: { hp: 118, damage: 16, speed: 7.8, attackRate: 0.55, crit: 0.07, range: 24, projectileSpeed: 26 },
    traits: ['Self healing', 'Homing attacks', 'Scales with blessings']
  }
};

export const SIGILS = {
  Wax: { icon: '⬡', desc: '2: +18% armour · 4: retaliation nova', color: '#e0b85c' },
  Bloom: { icon: '✿', desc: '2: +18% damage · 4: kills can explode', color: '#b286e8' },
  Thorn: { icon: '✦', desc: '2: +12% speed · 4: +22% crit damage', color: '#83d397' },
  Echo: { icon: '◉', desc: '2: -12% cooldown · 4: ability cooldown rebounds to 1s after use', color: '#72b8df' },
  Gloam: { icon: '◆', desc: '2: +24% score · 4: +48% score · Gloam itself empowers enemies', color: '#df647f' }
};

export const TALENTS = {
  universal: [
    { id: 'ferocity', name: 'Feral Memory', desc: '+12% damage.', max: 5, apply: s => { s.damageMult += 0.12; } },
    { id: 'fleet', name: 'Wingbeat', desc: '+8% movement speed.', max: 4, apply: s => { s.speedMult += 0.08; } },
    { id: 'heart', name: 'Royal Jelly Heart', desc: '+20 max vitality and heal 20.', max: 4, apply: s => { s.maxHp += 20; s.hp = Math.min(s.maxHp, s.hp + 20); } },
    { id: 'tempo', name: 'Quickened Pulse', desc: 'Attack 8% faster.', max: 5, apply: s => { s.attackRateMult *= 0.92; } },
    { id: 'fortune', name: 'Golden Instinct', desc: '+5% critical chance.', max: 4, apply: s => { s.crit += 0.05; } }
  ],
  waxguard: [
    { id: 'rage', name: 'Hornet Temper', desc: 'Damage rises as vitality falls.', tag: 'WAXGUARD', max: 3 },
    { id: 'cleave', name: 'Many Against One', desc: '+18% melee reach.', tag: 'WAXGUARD', max: 3 },
    { id: 'thorns', name: 'Hard Wax', desc: 'Contact damage hurts attackers.', tag: 'WAXGUARD', max: 3 }
  ],
  bloomweaver: [
    { id: 'split', name: 'Forked Pollen', desc: 'Bolts have a chance to split.', tag: 'BLOOMWEAVER', max: 3 },
    { id: 'blast', name: 'Unstable Bloom', desc: 'Projectile impacts deal splash damage.', tag: 'BLOOMWEAVER', max: 3 },
    { id: 'mana', name: 'Nectar Current', desc: 'Superbloom recharges faster.', tag: 'BLOOMWEAVER', max: 3 }
  ],
  thornstrider: [
    { id: 'multishot', name: 'Twin Thorn', desc: 'Fire additional arrows.', tag: 'THORNSTRIDER', max: 3 },
    { id: 'distance', name: 'Predator’s Line', desc: 'Long shots deal more damage.', tag: 'THORNSTRIDER', max: 3 },
    { id: 'venom', name: 'Night Venom', desc: 'Critical hits poison.', tag: 'THORNSTRIDER', max: 3 }
  ],
  hymnkeeper: [
    { id: 'motes', name: 'Second Voice', desc: 'Attacks may summon an extra royal mote.', tag: 'HYMNKEEPER', max: 3 },
    { id: 'grace', name: 'Grace Returned', desc: 'Kills sometimes restore vitality.', tag: 'HYMNKEEPER', max: 3 },
    { id: 'choir', name: 'Endless Hymn', desc: 'Queen’s Chorus gains more motes.', tag: 'HYMNKEEPER', max: 3 }
  ]
};

export function talentPool(classId) {
  return [...TALENTS.universal, ...TALENTS[classId]];
}

const RARITIES = [
  { name: 'Common', weight: 56, mult: 1, color: '#c9c4c8' },
  { name: 'Rare', weight: 28, mult: 1.45, color: '#68aee7' },
  { name: 'Epic', weight: 12, mult: 2.05, color: '#b47ce6' },
  { name: 'Legendary', weight: 4, mult: 3.0, color: '#efbd55' }
];

const ITEM_PREFIX = ['Ancient', 'Royal', 'Gilded', 'Hollow', 'Thornbound', 'Moonlit', 'Ashen', 'Singing', 'Forbidden', 'Glass'];
const ITEM_CORE = ['Stinger', 'Carapace', 'Petal', 'Charm', 'Crown', 'Vial', 'Needle', 'Bell', 'Lantern', 'Heart'];

export const MAX_RELICS = 8;

export function createRunState(classId) {
  const base = CLASSES[classId].base;
  return {
    classId,
    hp: base.hp,
    maxHp: base.hp,
    damageMult: 1,
    speedMult: 1,
    attackRateMult: 1,
    crit: base.crit,
    level: 1,
    xp: 0,
    xpNext: 30,
    score: 0,
    multiplier: 1,
    region: 1,
    step: 0,
    gloam: 0,
    kills: 0,
    elites: 0,
    bosses: 0,
    secrets: 0,
    enemyHpMult: 1,
    enemySpeedMult: 1,
    startedAt: Date.now(),
    materials: { nectar: 0, wax: 0, pollen: 0 },
    talents: {},
    relics: [],
    sigils: { Wax: 0, Bloom: 0, Thorn: 0, Echo: 0, Gloam: 0 }
  };
}

export function talentRank(state, id) {
  return state.talents[id] || 0;
}

export function resonance(state, sigil, count = 2) {
  return (state.sigils[sigil] || 0) >= count;
}

export function computeStats(state) {
  const def = CLASSES[state.classId];
  const base = def.base;
  let damage = base.damage * state.damageMult;
  let speed = base.speed * state.speedMult;
  let attackRate = base.attackRate * state.attackRateMult;
  let crit = state.crit;
  let cooldown = 1;

  for (const relic of state.relics) {
    damage *= 1 + relic.mods.damage;
    speed *= 1 + relic.mods.speed;
    attackRate *= 1 - relic.mods.haste;
    crit += relic.mods.crit;
  }

  if (resonance(state, 'Bloom')) damage *= 1.18;
  if (resonance(state, 'Thorn')) speed *= 1.12;
  if (resonance(state, 'Echo')) cooldown = 0.88;
  if (state.classId === 'waxguard' && talentRank(state, 'rage')) {
    damage *= 1 + (1 - state.hp / state.maxHp) * 0.18 * talentRank(state, 'rage');
  }

  const meleeReach = state.classId === 'waxguard' ? 1 + 0.18 * talentRank(state, 'cleave') : 1;

  return {
    damage,
    speed,
    attackRate: Math.max(0.12, attackRate),
    crit: Math.min(0.75, crit),
    critDamage: resonance(state, 'Thorn', 4) ? 2.13 : 1.75,
    range: base.range * meleeReach,
    projectileSpeed: base.projectileSpeed,
    cooldown,
    armour: resonance(state, 'Wax') ? 0.82 : 1
  };
}

export function abilityInfo(state) {
  const def = CLASSES[state.classId];
  let cd = def.abilityCooldown * computeStats(state).cooldown;
  if (state.classId === 'bloomweaver') cd *= 1 - 0.1 * talentRank(state, 'mana');
  return { name: def.ability, desc: def.abilityDesc, cd };
}

export function refreshMultiplier(state) {
  state.gloam = Math.max(0, Math.min(200, state.gloam));
  state.multiplier = 1 + state.gloam / 100 + (state.sigils.Gloam || 0) * 0.12;
  return state.multiplier;
}

export function applyTalent(state, talent) {
  state.talents[talent.id] = talentRank(state, talent.id) + 1;
  if (talent.apply) talent.apply(state);
  return state.talents[talent.id];
}

// Every talent maxed used to soft-lock the level-up screen with zero choices.
// Overflow keeps long runs moving instead.
export function allTalentsMaxed(state) {
  return talentPool(state.classId).every(t => talentRank(state, t.id) >= (t.max || 3));
}

export function applyOverflow(state) {
  state.talents.overflow = (state.talents.overflow || 0) + 1;
  state.damageMult += 0.04;
  state.maxHp += 4;
  state.hp = Math.min(state.maxHp, state.hp + 4);
  return state.talents.overflow;
}

export function talentChoices(state, rng, count = 3) {
  const pool = talentPool(state.classId).filter(t => talentRank(state, t.id) < (t.max || 3));
  return rng.shuffle(pool).slice(0, count);
}

export function makeRelic(rng) {
  const roll = rng.next() * 100;
  let acc = 0;
  let rarity = RARITIES[0];
  for (const candidate of RARITIES) {
    acc += candidate.weight;
    if (roll <= acc) { rarity = candidate; break; }
  }

  const sigil = rng.pick(Object.keys(SIGILS));
  const mods = { damage: 0, speed: 0, haste: 0, crit: 0 };
  const kind = rng.int(0, 3);
  if (kind === 0) mods.damage = 0.06 * rarity.mult;
  if (kind === 1) mods.speed = 0.045 * rarity.mult;
  if (kind === 2) mods.haste = 0.04 * rarity.mult;
  if (kind === 3) mods.crit = 0.025 * rarity.mult;

  return {
    id: `${rng.int(0, 0xffffff).toString(16)}-${rng.int(0, 0xffffff).toString(16)}`,
    name: `${rng.pick(ITEM_PREFIX)} ${rng.pick(ITEM_CORE)}`,
    rarity: rarity.name,
    color: rarity.color,
    sigil,
    mods,
    desc: describeMods(mods)
  };
}

export function describeMods(mods) {
  const parts = [];
  if (mods.damage) parts.push(`+${Math.round(mods.damage * 100)}% damage`);
  if (mods.speed) parts.push(`+${Math.round(mods.speed * 100)}% speed`);
  if (mods.haste) parts.push(`+${Math.round(mods.haste * 100)}% attack speed`);
  if (mods.crit) parts.push(`+${Math.round(mods.crit * 100)}% crit`);
  return parts.join(' · ');
}

export function addRelic(state, relic) {
  if (state.relics.length >= MAX_RELICS) {
    const dropped = state.relics.shift();
    state.sigils[dropped.sigil] = Math.max(0, state.sigils[dropped.sigil] - 1);
  }
  state.relics.push(relic);
  state.sigils[relic.sigil] = (state.sigils[relic.sigil] || 0) + 1;
  refreshMultiplier(state);
  return relic;
}

export function craftOptions(state) {
  return [
    { id: 'temper', name: 'Temper the Stinger', desc: '+10% damage for this run.', cost: { nectar: 5, wax: 1 } },
    { id: 'harden', name: 'Harden the Carapace', desc: '+25 max vitality and heal 25.', cost: { nectar: 3, wax: 3 } },
    { id: 'distill', name: 'Distill Moon Pollen', desc: '+5% critical chance and +4% movement.', cost: { nectar: 4, pollen: 2 } },
    { id: 'leave', name: 'Leave the Shrine', desc: 'Save your materials.', cost: {} }
  ].map(option => ({
    ...option,
    affordable: Object.entries(option.cost).every(([key, value]) => state.materials[key] >= value)
  }));
}

export function applyCraft(state, option) {
  if (!option || !option.affordable) return false;
  for (const [key, value] of Object.entries(option.cost)) state.materials[key] -= value;
  if (option.id === 'temper') state.damageMult += 0.1;
  if (option.id === 'harden') { state.maxHp += 25; state.hp = Math.min(state.maxHp, state.hp + 25); }
  if (option.id === 'distill') { state.crit += 0.05; state.speedMult += 0.04; }
  return true;
}

export function eventOptions() {
  return [
    { id: 'blood', name: 'Drink Black Nectar', desc: '+22% damage, lose 20% current vitality, +8 Gloam.', tag: 'POWER / COST' },
    { id: 'memory', name: 'Hear the Dead Queen', desc: 'Gain a random talent, +6 Gloam.', tag: 'KNOWLEDGE / RISK' },
    { id: 'refuse', name: 'Close the Petal', desc: 'Nothing happens. Perhaps that is wisdom.', tag: 'SAFE' }
  ];
}

export function applyEvent(state, option, rng) {
  let gainedTalent = null;
  if (option.id === 'blood') {
    state.damageMult += 0.22;
    state.hp = Math.max(1, state.hp * 0.8);
    state.gloam += 8;
  }
  if (option.id === 'memory') {
    const pool = talentPool(state.classId).filter(t => talentRank(state, t.id) < (t.max || 3));
    if (pool.length) {
      gainedTalent = rng.pick(pool);
      applyTalent(state, gainedTalent);
    }
    state.gloam += 6;
  }
  refreshMultiplier(state);
  return gainedTalent;
}

export function pactOptions() {
  return [
    { id: 'hunger', name: 'Pact of Hunger', desc: 'Enemies gain 30% vitality. Score multiplier rises sharply.', gloam: 20, sigil: 'Gloam' },
    { id: 'glass', name: 'Pact of Glass', desc: '+28% damage, but lose 18 max vitality.', gloam: 12, sigil: 'Bloom' },
    { id: 'flight', name: 'Pact of Wings', desc: '+14% speed and attack speed. Enemies move 12% faster.', gloam: 10, sigil: 'Thorn' }
  ];
}

export function applyPact(state, pact) {
  if (pact.id === 'glass') {
    state.damageMult += 0.28;
    state.maxHp = Math.max(40, state.maxHp - 18);
    state.hp = Math.min(state.hp, state.maxHp);
  }
  if (pact.id === 'flight') {
    state.speedMult += 0.14;
    state.attackRateMult *= 0.86;
    state.enemySpeedMult *= 1.12;
  }
  if (pact.id === 'hunger') state.enemyHpMult *= 1.3;
  state.gloam += pact.gloam;
  state.sigils[pact.sigil] = (state.sigils[pact.sigil] || 0) + 1;
  refreshMultiplier(state);
}
