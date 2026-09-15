import { HiveboundGame, CLASSES, SIGILS, DEFAULT_CONTROLS } from './game.js';

// Keep public descriptions aligned with mechanics that actually exist.
SIGILS.Gloam.desc = '2: +24% score · 4: +48% score · Gloam itself empowers enemies';
SIGILS.Echo.desc = '2: -12% cooldown · 4: ability cooldown rebounds to 1s after use';

const proto = HiveboundGame.prototype;
const originalPauseForTalent = proto.pauseForTalent;
const originalWinCombat = proto.winCombat;
const originalRender = proto.render;
const originalApplyEvent = proto.applyEvent;
const originalApplyPact = proto.applyPact;

function deterministicShuffle(game, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(game.rng.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function continueAfterTalent(game) {
  if (!game.running) return;

  // If one XP burst crossed several thresholds, resolve rewards one at a time.
  if (game.state.xp >= game.state.xpNext) {
    queueMicrotask(() => game.gainXp(0));
    return;
  }

  // A combat can end in the same frame that a level-up occurs. Defer loot until
  // the talent choice is resolved so the two modals never overwrite each other.
  if (game._pendingWin) {
    const pending = game._pendingWin;
    game._pendingWin = null;
    originalWinCombat.call(game, pending === 'boss');
  }
}

// Daily runs must be deterministic across browsers. Array.sort(randomComparator)
// does not guarantee identical ordering across JS engines.
proto.pathChoices = function pathChoices() {
  if (this.state.step >= 4) {
    return [{
      type: 'boss', icon: '♛', title: `Guardian of ${this.biome().name}`,
      desc: 'End the region. The next Bloom will be more corrupted.',
      risk: 'BOSS · huge score'
    }];
  }

  const pool = [
    { type:'combat', icon:'⚔️', title:'Gloam Swarm', desc:'Survive an escalating swarm and gather materials.', risk:'Normal risk' },
    { type:'elite', icon:'☠️', title:'Marked Predator', desc:'Stronger enemies, richer relics and more score.', risk:'High risk · better loot' },
    { type:'treasure', icon:'🗝️', title:'Forgotten Comb', desc:'Choose a relic from an abandoned royal cache.', risk:'Safe · no combat' },
    { type:'shrine', icon:'⬡', title:'Wax Shrine', desc:'Spend gathered materials to permanently shape this run.', risk:'Crafting' },
    { type:'event', icon:'🌒', title:'Whispering Petal', desc:'A strange choice: power always asks for something back.', risk:'Unknown' }
  ];

  const choices = deterministicShuffle(this, pool).slice(0, 3);
  if (this.state.step === 0 && !choices.some(x => x.type === 'combat')) choices[0] = pool[0];
  return choices;
};

// Process one level at a time. Extra XP remains queued until the current talent
// has been selected, which keeps long runs stable.
proto.gainXp = function gainXp(amount) {
  this.state.xp += amount;
  if (this.paused || this.state.xp < this.state.xpNext) return;

  this.state.xp -= this.state.xpNext;
  this.state.level += 1;
  this.state.xpNext = Math.floor(this.state.xpNext * 1.3 + 10);
  this.pauseForTalent();
};

proto.pauseForTalent = function pauseForTalent() {
  const knownCaps = {
    waxguard: [
      ['ferocity',5], ['fleet',4], ['heart',4], ['tempo',5], ['fortune',4],
      ['rage',3], ['cleave',3], ['thorns',3]
    ],
    bloomweaver: [
      ['ferocity',5], ['fleet',4], ['heart',4], ['tempo',5], ['fortune',4],
      ['split',3], ['blast',3], ['mana',3]
    ],
    thornstrider: [
      ['ferocity',5], ['fleet',4], ['heart',4], ['tempo',5], ['fortune',4],
      ['multishot',3], ['distance',3], ['venom',3]
    ],
    hymnkeeper: [
      ['ferocity',5], ['fleet',4], ['heart',4], ['tempo',5], ['fortune',4],
      ['motes',3], ['grace',3], ['choir',3]
    ]
  };

  const allCapped = knownCaps[this.classId]
    .every(([id, max]) => this.talentRank(id) >= max);

  // Endless runs used to soft-lock here because the choice modal had zero
  // buttons once every talent was maxed. Overflow gives infinite progression.
  if (allCapped) {
    this.paused = true;
    this.state.talents.overflow = (this.state.talents.overflow || 0) + 1;
    this.state.damageMult += 0.04;
    this.state.maxHp += 4;
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + 4);
    this.toast(`Overflow ${this.state.talents.overflow}: +4% damage · +4 vitality`);
    this.paused = false;
    this.last = performance.now();
    continueAfterTalent(this);
    return;
  }

  // The base engine owns the actual talent objects. Temporarily replace only
  // its shuffle with Fisher-Yates so seeded runs remain deterministic.
  const previousShuffle = this.rng.shuffle;
  this.rng.shuffle = values => deterministicShuffle(this, values);

  const originalHook = this.hooks.onTalent;
  this.hooks.onTalent = (options, choose) => {
    const wrappedChoose = talent => {
      choose(talent);
      this.hooks.onTalent = originalHook;
      this.rng.shuffle = previousShuffle;
      continueAfterTalent(this);
    };

    if (originalHook) originalHook(options, wrappedChoose);
    else if (options[0]) wrappedChoose(options[0]);
  };

  originalPauseForTalent.call(this);
};

proto.winCombat = function winCombat(boss = false) {
  if (!this.running) return;
  if (this.paused) {
    if (boss || !this._pendingWin) this._pendingWin = boss ? 'boss' : 'normal';
    return;
  }
  return originalWinCombat.call(this, boss);
};

// Ranged classes now respect their advertised range. Predator's Line was
// previously displayed as a Thornstrider talent but had no gameplay effect.
proto.autoAttack = function autoAttack() {
  const c = this.combat;
  const p = c.player;
  const enemy = this.nearestEnemy();
  if (!enemy) return;

  const st = this.stats();
  const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
  if (this.classId !== 'waxguard' && distance > st.range) return;

  const crit = this.rng.next() < st.crit;
  let damage = st.damage * (crit ? st.critDamage : 1);

  if (this.classId === 'thornstrider') {
    const rank = this.talentRank('distance');
    if (rank) damage *= 1 + (0.12 * rank * Math.min(1, distance / st.range));
  }

  if (this.classId === 'waxguard') {
    for (const target of c.enemies) {
      if (Math.hypot(target.x - p.x, target.y - p.y) <= st.range) {
        this.hitEnemy(target, damage, crit);
      }
    }
    this.particleRing(p.x, p.y, st.range, '#efc661');
    return;
  }

  const count = this.classId === 'thornstrider' ? 1 + this.talentRank('multishot') : 1;
  for (let i = 0; i < count; i++) {
    const angle = Math.atan2(enemy.y - p.y, enemy.x - p.x) + (i - (count - 1) / 2) * 0.12;
    this.projectile(p.x, p.y, angle, damage, {
      speed: st.projectileSpeed,
      crit,
      poison: this.classId === 'thornstrider' && crit && this.talentRank('venom'),
      splash: this.classId === 'bloomweaver' && this.talentRank('blast') > 0,
      homing: this.classId === 'hymnkeeper'
    });
  }

  if (this.classId === 'bloomweaver' && this.talentRank('split') && this.rng.next() < 0.16 * this.talentRank('split')) {
    const baseAngle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
    this.projectile(p.x, p.y, baseAngle + 0.3, damage * 0.7, { speed: st.projectileSpeed });
    this.projectile(p.x, p.y, baseAngle - 0.3, damage * 0.7, { speed: st.projectileSpeed });
  }

  if (this.classId === 'hymnkeeper' && this.talentRank('motes') && this.rng.next() < 0.14 * this.talentRank('motes')) {
    this.projectile(p.x, p.y, this.rng.next() * Math.PI * 2, damage * 0.7, { speed: st.projectileSpeed, homing: true });
  }
};

// The base engine already queued ring particles but never drew or expired them.
// Render them as lightweight combat feedback without changing the simulation.
proto.particleRing = function particleRing(x, y, radius, color) {
  if (!this.combat) return;
  this.combat.particles.push({ x, y, r: radius, color, born: performance.now(), duration: 320 });
};

proto.render = function render() {
  originalRender.call(this);
  if (!this.combat?.particles?.length) return;

  const now = performance.now();
  const ctx = this.ctx;
  const active = [];
  for (const particle of this.combat.particles) {
    const progress = (now - particle.born) / particle.duration;
    if (progress >= 1) continue;
    active.push(particle);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = 3 - progress * 2;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r * (0.65 + progress * 0.35), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  this.combat.particles = active;
};

// Keep corruption bounded even when an event and a pact land above the normal
// node-based cap.
proto.applyEvent = function applyEvent(option) {
  originalApplyEvent.call(this, option);
  this.state.gloam = Math.min(200, this.state.gloam);
  this.state.multiplier = 1 + this.state.gloam / 100 + (this.state.sigils.Gloam || 0) * 0.12;
};

proto.applyPact = function applyPact(pact) {
  originalApplyPact.call(this, pact);
  this.state.gloam = Math.min(200, this.state.gloam);
  this.state.multiplier = 1 + this.state.gloam / 100 + (this.state.sigils.Gloam || 0) * 0.12;
};

export { HiveboundGame, CLASSES, SIGILS, DEFAULT_CONTROLS };
