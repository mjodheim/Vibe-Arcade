import test from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../public/js/core/run.js';
import { STEPS_PER_REGION } from '../public/js/core/world.js';
import { talentPool } from '../public/js/core/rules.js';

function newRun(classId = 'waxguard', seed = 123456789, daily = true) {
  const run = new Run({ classId, seed, runId: 'test-run', daily });
  run.start();
  return run;
}

function idle() {
  return { moveX: 0, moveZ: 0, attack: false, ability: false, dash: false };
}

test('A run opens on a fight in the first biome', () => {
  const run = newRun();
  assert.equal(run.glade.node.type, 'combat');
  assert.equal(run.glade.biome.id, 'verdant');
  assert.equal(run.sim.encounter.type, 'combat');
  assert.equal(run.state.region, 1);
});

test('Two runs on the same seed lay out the same route', () => {
  const a = newRun('thornstrider', 4242);
  const b = newRun('thornstrider', 4242);
  assert.deepEqual(a.glade.gates.map(gate => gate.type), b.glade.gates.map(gate => gate.type));
  assert.deepEqual(a.glade.playerStart, b.glade.playerStart);
  assert.equal(a.glade.props.length, b.glade.props.length);
});

test('Different seeds diverge', () => {
  const a = newRun('thornstrider', 1);
  const b = newRun('thornstrider', 2);
  assert.notDeepEqual(a.glade.props[5], b.glade.props[5]);
});

test('A level-up and a cleared node stack instead of overwriting each other', () => {
  const run = newRun();
  run.gainXp(run.state.xpNext); // exactly one level
  assert.equal(run.pending.kind, 'talent');
  run.handle({ type: 'nodeCleared', node: 'combat' });
  assert.equal(run.queue.length, 2, 'both offers are waiting');
  assert.equal(run.sim.paused, true, 'the world holds while you choose');

  run.resolve(run.pending.options[0]);
  assert.equal(run.pending.kind, 'loot');
  assert.equal(run.sim.paused, true);

  run.resolve(run.pending.options[0]);
  assert.equal(run.pending, null);
  assert.equal(run.sim.paused, false, 'play resumes when the last choice is made');
  assert.equal(run.state.relics.length, 1);
});

test('One burst of experience can grant several levels, one talent at a time', () => {
  const run = newRun();
  run.gainXp(5000);
  assert.ok(run.state.level > 2);
  assert.ok(run.queue.length >= 2);
  const first = run.pending;
  run.resolve(first.options[0]);
  assert.notEqual(run.pending, null);
});

test('Overflow replaces the talent screen once everything is maxed', () => {
  const run = newRun();
  for (const talent of talentPool('waxguard')) run.state.talents[talent.id] = talent.max || 3;
  run.gainXp(run.state.xpNext);
  assert.equal(run.pending, null, 'no empty choice screen');
  assert.ok(run.state.talents.overflow >= 1);
});

test('Using a landmark opens the choice it promises', () => {
  const cases = { treasure: 'loot', shrine: 'craft', event: 'event' };
  for (const [nodeType, offerKind] of Object.entries(cases)) {
    const run = newRun();
    run.state.step = 1;
    run.enterNode(nodeType);
    run.sim.player.x = run.glade.poi.x;
    run.sim.player.z = run.glade.poi.z;
    run.sim.updatePrompt();
    run.interact();
    assert.equal(run.pending?.kind, offerKind, `${nodeType} offers ${offerKind}`);
  }
});

test('Walking through a gate moves the run to the chosen node', () => {
  const run = newRun();
  run.sim.unlockGates('test');
  const gate = run.glade.gates[0];
  run.sim.player.x = gate.x;
  run.sim.player.z = gate.z;
  run.step(1 / 60, idle());
  assert.equal(run.state.step, 1);
  assert.equal(run.glade.node.type, gate.type);
  assert.ok(run.state.gloam > 0, 'every step feeds the Gloam');
});

test('The last node of a region is the Guardian', () => {
  const run = newRun();
  run.state.step = STEPS_PER_REGION - 1;
  run.enterNode('combat'); // regenerate the glade so its gates look one step ahead
  run.sim.unlockGates('test');
  const gate = run.glade.gates[0];
  assert.equal(gate.type, 'boss', 'the final gate leads to the Guardian');
  run.sim.player.x = gate.x;
  run.sim.player.z = gate.z;
  run.step(1 / 60, idle());
  assert.equal(run.glade.node.type, 'boss');
  assert.equal(run.sim.enemies.some(enemy => enemy.boss), true);
});

test('Beating a region offers a pact, then opens the next biome', () => {
  const run = newRun();
  run.state.step = STEPS_PER_REGION;
  run.enterNode('boss');
  const score = run.state.score;

  run.travel(run.glade.gates[0]);
  assert.equal(run.pending.kind, 'pact');
  assert.equal(run.state.bosses, 1);
  assert.ok(run.state.score > score, 'the region clear pays out');

  run.resolve(run.pending.options.find(pact => pact.id === 'hunger'));
  assert.equal(run.state.region, 2);
  assert.equal(run.state.step, 0);
  assert.equal(run.glade.biome.id, 'mycelian');
  assert.equal(run.glade.node.type, 'combat');
  assert.ok(run.state.enemyHpMult > 1, 'the pact makes the Gloam stronger');
});

test('Dying ends the run and reports what happened', () => {
  const run = newRun('bloomweaver');
  run.state.kills = 12;
  run.sim.player.invuln = 0;
  run.sim.damagePlayer(10_000, 'test');
  run.step(1 / 60, idle());

  assert.equal(run.finished, true);
  const result = run.result();
  assert.equal(result.runId, 'test-run');
  assert.equal(result.daily, true);
  assert.equal(result.classId, 'bloomweaver');
  assert.equal(result.kills, 12);
  assert.equal(Number.isFinite(result.score), true);
  assert.ok(result.durationMs >= 0);
});

test('A finished run stops simulating', () => {
  const run = newRun();
  run.finished = true;
  const time = run.sim.time;
  run.step(1 / 60, idle());
  assert.equal(run.sim.time, time);
});

test('Relic choices come out of the run seed, so a daily run is the same for everyone', () => {
  const a = newRun('hymnkeeper', 777);
  const b = newRun('hymnkeeper', 777);
  assert.deepEqual(a.rollRelics(3).map(relic => relic.name), b.rollRelics(3).map(relic => relic.name));
});
