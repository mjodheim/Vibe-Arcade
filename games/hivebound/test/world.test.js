import test from 'node:test';
import assert from 'node:assert/strict';

import { RNG } from '../public/js/core/rng.js';
import { generateGlade, nodeChoices, sampleHeight, NODE_TYPES, PLAY_RADIUS, STEPS_PER_REGION } from '../public/js/core/world.js';
import { BIOMES, biomeForRegion, enemyTable, pickEnemy } from '../public/js/core/biomes.js';

function glade(overrides = {}) {
  return generateGlade({
    seed: 424242,
    region: 1,
    step: 0,
    nodeType: 'combat',
    nextChoices: nodeChoices(new RNG(424242), 1),
    ...overrides
  });
}

test('The same seed always generates the same glade', () => {
  const a = glade();
  const b = glade();
  assert.equal(a.props.length, b.props.length);
  assert.deepEqual(a.props[0], b.props[0]);
  assert.deepEqual(a.props.at(-1), b.props.at(-1));
  assert.deepEqual(a.pickups, b.pickups);
  assert.deepEqual(a.playerStart, b.playerStart);
  assert.equal(Boolean(a.secret), Boolean(b.secret));
});

test('A different seed generates a different glade', () => {
  const a = glade();
  const b = glade({ seed: 99 });
  assert.notDeepEqual(a.props[10], b.props[10]);
});

test('Everything placed in a glade sits inside the bowl', () => {
  const area = glade({ nodeType: 'treasure' });
  for (const pickup of area.pickups) {
    assert.ok(Math.hypot(pickup.x, pickup.z) < PLAY_RADIUS, 'pickups stay reachable');
  }
  for (const gate of area.gates) {
    assert.ok(Math.hypot(gate.x, gate.z) < PLAY_RADIUS, 'gates stay inside the play area');
  }
  assert.ok(Math.hypot(area.playerStart.x, area.playerStart.z) < PLAY_RADIUS);
});

test('Nothing grows on top of the landmark or the gates', () => {
  const area = glade({ nodeType: 'shrine' });
  for (const prop of area.props) {
    const toPoi = Math.hypot(prop.x - area.poi.x, prop.z - area.poi.z);
    assert.ok(toPoi > 3, 'the landmark clearing stays clear');
    for (const gate of area.gates) {
      assert.ok(Math.hypot(prop.x - gate.x, prop.z - gate.z) > 3, 'gates stay walkable');
    }
  }
});

test('Props sit on the ground, not floating above or buried under it', () => {
  const area = glade();
  for (const prop of area.props.slice(0, 200)) {
    assert.ok(Math.abs(prop.y - area.heightAt(prop.x, prop.z)) < 1e-6);
  }
});

test('The terrain is continuous and rises into a rim', () => {
  const area = glade();
  const centre = area.heightAt(0, 0);
  const nearby = area.heightAt(0.4, 0.4);
  assert.ok(Math.abs(centre - nearby) < 1.5, 'no cliffs between neighbouring samples');
  assert.ok(area.heightAt(0, -72) > centre + 8, 'the rim walls the glade in');
  assert.equal(area.heightAt(0, 0), sampleHeight(area.heights, 0, 0));
});

test('Sampling outside the terrain grid stays finite', () => {
  const area = glade();
  for (const [x, z] of [[-500, 0], [500, 0], [0, 500], [1e6, -1e6]]) {
    assert.equal(Number.isFinite(area.heightAt(x, z)), true);
  }
});

test('Gate choices are deterministic, and a region always opens with a fight', () => {
  for (let seed = 1; seed < 40; seed++) {
    const first = nodeChoices(new RNG(seed), 0);
    const again = nodeChoices(new RNG(seed), 0);
    assert.deepEqual(first.map(node => node.type), again.map(node => node.type));
    assert.ok(first.some(node => node.type === 'combat'), 'the first node of a region offers combat');
    assert.equal(first.length, 3);
  }
});

test('The end of a region offers the Guardian and nothing else', () => {
  const choices = nodeChoices(new RNG(5), STEPS_PER_REGION);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].type, 'boss');
  assert.equal(NODE_TYPES.boss.poi, 'throne');
});

test('Combat glades hold their landmark; peaceful ones let you walk past it', () => {
  assert.equal(glade({ nodeType: 'combat' }).poi.kind, 'rift');
  assert.equal(glade({ nodeType: 'treasure' }).poi.kind, 'cache');
  assert.equal(glade({ nodeType: 'shrine' }).poi.kind, 'shrine');
  assert.equal(glade({ nodeType: 'event' }).poi.kind, 'petal');
  assert.ok(glade({ nodeType: 'treasure' }).wanderers > 0, 'quiet glades still have wildlife');
  assert.equal(glade({ nodeType: 'combat' }).wanderers, 0, 'fights bring their own crowd');
});

test('Regions cycle through every biome', () => {
  for (let region = 1; region <= BIOMES.length; region++) {
    assert.equal(biomeForRegion(region).id, BIOMES[region - 1].id);
  }
  assert.equal(biomeForRegion(BIOMES.length + 1).id, BIOMES[0].id);
});

test('Every biome carries the palette the renderer needs', () => {
  for (const biome of BIOMES) {
    for (const key of ['sky', 'horizon', 'fog', 'path', 'accent', 'enemyTint']) {
      assert.equal(typeof biome[key], 'number', `${biome.id}.${key}`);
    }
    assert.equal(biome.ground.length, 3, `${biome.id} needs three ground tones`);
    for (const key of ['mushroom', 'cap', 'flower', 'wood', 'glow', 'crystal']) {
      assert.equal(typeof biome.propColors[key], 'number', `${biome.id}.propColors.${key}`);
    }
    assert.ok(biome.props.length >= 6, `${biome.id} needs a varied prop mix`);
  }
});

test('Deeper regions send tougher creatures', () => {
  const early = Object.fromEntries(enemyTable(1));
  const late = Object.fromEntries(enemyTable(4));
  assert.ok(late.stalker > early.stalker);
  assert.ok(late.mite < early.mite);
  const picked = new Set(Array.from({ length: 60 }, (_, i) => pickEnemy(new RNG(i + 1), 4)));
  assert.ok(picked.size > 1, 'the spawn table is not stuck on one creature');
});
