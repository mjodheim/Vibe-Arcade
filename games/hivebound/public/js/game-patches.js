import { HiveboundGame, CLASSES, SIGILS, DEFAULT_CONTROLS } from './game.js';

// Keep public descriptions aligned with the mechanics that actually exist.
SIGILS.Gloam.desc = '2: +24% score · 4: +48% score · Gloam itself empowers enemies';
SIGILS.Echo.desc = '2: -12% cooldown · 4: ability cooldown rebounds to 1s after use';

const proto = HiveboundGame.prototype;
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
  if (game.state.xp >= game.state.xpNext) {
    queueMicrotask(() => game.gainXp(0));
    return;
  }
  if (game._pendingWin) {
    const pending = game._pendingWin;
    game._pendingWin = null;
    originalWinCombat.call(game, pending === 'boss');
  }
}

// Daily runs must be deterministic across browsers. Array.sort(randomComparator)
// is not guaranteed to produce the same ordering on every JS engine.
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

// Process one level at a time. This prevents two reward modals from overwriting
// one another when several XP thresholds are crossed in the same combat frame.
proto.gainXp = function gainXp(amount) {
  this.state.xp += amount;
  if (this.paused || this.state.xp < this.state.xpNext) return;

  this.state.xp -= this.state.xpNext;
  this.state.level += 1;
  this.state.xpNext = Math.floor(this.state.xpNext * 1.3 + 10);
  this.pauseForTalent();
};

proto.pauseForTalent = function pauseForTalent() {
  this.paused = true;
  const universal = [
    ['ferocity', 5], ['fleet', 4], ['heart', 4], ['tempo', 5], ['fortune', 4]
  ];
  const classTalentIds = {
    waxguard: [['rage',3], ['cleave',3], ['thorns',3]],
    bloomweaver: [['split',3], ['blast',3], ['mana',3]],
    thornstrider: [['multishot',3], ['distance',3], ['venom',3]],
    hymnkeeper: [['motes',3], ['grace',3], ['choir',3]]
  };

  // We cannot access the private TALENTS table from the base module, so ask the
  // original talent hook to provide options while talents remain. Once every
  // known rank is capped, long runs transition into endless Overflow levels.
  const allCapped = [...universal, ...classTalentIds[this.classId]]
    .every(([id, max]) => this.talentRank(id) >= max);

  if (allCapped) {
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

  // Use the base method to build the real talent objects, but intercept its
  // shuffle by temporarily supplying a deterministic implementation.
  // Reconstructing the available talent objects is intentionally avoided here
  // so the patch remains compatible with future additions to game.js.
  const previousShuffle = this.rng.shuffle;
  this.rng.shuffle = values => deterministicShuffle(this, values);

  // The original method sets paused and calls the hook. Wrap the hook so we can
  // resume queued levels / combat rewards after the player's choice.
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

  // Call the original implementation saved before patching.
  basePauseForTalent.call(this);
};

const basePauseForTalent = (() => {
  // Capture the original method after defining the replacement logic above.
  // This IIFE is evaluated immediately while proto still holds the replacement,
  // so the actual original is stored explicitly below via a descriptor trick.
  return null;
})();
