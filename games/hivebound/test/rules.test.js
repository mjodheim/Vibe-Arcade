import test from 'node:test';
import assert from 'node:assert/strict';

import { RNG } from '../public/js/core/rng.js';
import {
  CLASSES, MAX_RELICS, createRunState, computeStats, abilityInfo, makeRelic, addRelic,
  applyTalent, talentChoices, allTalentsMaxed, applyOverflow, talentPool,
  craftOptions, applyCraft, eventOptions, applyEvent, pactOptions, applyPact, refreshMultiplier
} from '../public/js/core/rules.js';

function state(classId = 'waxguard') {
  return createRunState(classId);
}

test('Every class exposes the stats the simulation reads', () => {
  for (const [id, def] of Object.entries(CLASSES)) {
    assert.ok(def.base.hp > 0, `${id} needs vitality`);
    assert.ok(def.base.speed > 0, `${id} needs a speed`);
    assert.ok(def.base.range > 0, `${id} needs a range`);
    assert.ok(def.colors.body && def.colors.glow, `${id} needs model colours`);
    if (def.base.projectileSpeed === 0) assert.equal(id, 'waxguard', 'only the melee class has no projectile');
  }
});

test('Relics stack their modifiers into the computed stats', () => {
  const run = state('thornstrider');
  const before = computeStats(run);
  addRelic(run, { id: 'a', name: 'Test', rarity: 'Epic', color: '#fff', sigil: 'Thorn', mods: { damage: 0.5, speed: 0, haste: 0, crit: 0 }, desc: '' });
  const after = computeStats(run);
  assert.ok(after.damage > before.damage * 1.4);
});

test('Two matching sigils awaken a resonance, and the oldest relic is dropped at the cap', () => {
  const run = state('bloomweaver');
  const rng = new RNG(7);
  for (let i = 0; i < MAX_RELICS + 2; i++) {
    const relic = makeRelic(rng);
    relic.sigil = 'Bloom';
    addRelic(run, relic);
  }
  assert.equal(run.relics.length, MAX_RELICS, 'relic count is capped');
  assert.equal(run.sigils.Bloom, MAX_RELICS, 'dropped relics release their sigil');

  const plain = state('bloomweaver');
  assert.ok(computeStats(run).damage > computeStats(plain).damage, 'Bloom resonance raises damage');
});

test('Echo resonance shortens the ability cooldown', () => {
  const run = state('hymnkeeper');
  const before = abilityInfo(run).cd;
  run.sigils.Echo = 2;
  assert.ok(abilityInfo(run).cd < before);
});

test('A maxed talent tree keeps giving through Overflow instead of dead-ending', () => {
  const run = state('waxguard');
  for (const talent of talentPool('waxguard')) run.talents[talent.id] = talent.max || 3;
  assert.equal(allTalentsMaxed(run), true);
  assert.equal(talentChoices(run, new RNG(1)).length, 0);

  const damage = run.damageMult;
  const rank = applyOverflow(run);
  assert.equal(rank, 1);
  assert.ok(run.damageMult > damage);
});

test('Talent choices never offer a talent that is already maxed', () => {
  const run = state('thornstrider');
  run.talents.ferocity = 5;
  const offered = talentChoices(run, new RNG(99), 3);
  assert.equal(offered.some(talent => talent.id === 'ferocity'), false);
  assert.equal(offered.length, 3);
});

test('Talents apply their effect exactly once per rank', () => {
  const run = state('waxguard');
  const heart = talentPool('waxguard').find(talent => talent.id === 'heart');
  const maxHp = run.maxHp;
  applyTalent(run, heart);
  applyTalent(run, heart);
  assert.equal(run.talents.heart, 2);
  assert.equal(run.maxHp, maxHp + 40);
});

test('Crafting refuses what the run cannot pay for', () => {
  const run = state('waxguard');
  const options = craftOptions(run);
  const temper = options.find(option => option.id === 'temper');
  assert.equal(temper.affordable, false);
  assert.equal(applyCraft(run, temper), false);

  run.materials.nectar = 9;
  run.materials.wax = 3;
  const affordable = craftOptions(run).find(option => option.id === 'temper');
  assert.equal(affordable.affordable, true);
  assert.equal(applyCraft(run, affordable), true);
  assert.equal(run.materials.nectar, 4);
});

test('Gloam stays bounded whatever the events and pacts pile on', () => {
  const run = state('bloomweaver');
  run.gloam = 196;
  applyEvent(run, eventOptions().find(option => option.id === 'blood'), new RNG(3));
  assert.equal(run.gloam, 200);
  applyPact(run, pactOptions().find(pact => pact.id === 'hunger'));
  assert.equal(run.gloam, 200);
  assert.ok(run.multiplier > 1);

  run.gloam = -50;
  refreshMultiplier(run);
  assert.equal(run.gloam, 0);
});

test('The Pact of Glass trades vitality for damage without dropping below the floor', () => {
  const run = state('bloomweaver');
  run.maxHp = 45;
  run.hp = 45;
  applyPact(run, pactOptions().find(pact => pact.id === 'glass'));
  assert.equal(run.maxHp, 40);
  assert.ok(run.hp <= run.maxHp);
});

test('Relic generation is deterministic for a given seed', () => {
  const a = Array.from({ length: 5 }, (_, i) => makeRelic(new RNG(1234 + i)).name);
  const b = Array.from({ length: 5 }, (_, i) => makeRelic(new RNG(1234 + i)).name);
  assert.deepEqual(a, b);
});
