import test from 'node:test';
import assert from 'node:assert/strict';

import { RNG } from '../public/js/core/rng.js';
import { createRunState } from '../public/js/core/rules.js';
import { generateGlade, nodeChoices } from '../public/js/core/world.js';
import { Sim } from '../public/js/core/sim.js';

function setup(classId = 'thornstrider', nodeType = 'combat', seed = 2024) {
  const state = createRunState(classId);
  const rng = new RNG(seed);
  const glade = generateGlade({ seed, region: 1, step: 0, nodeType, nextChoices: nodeChoices(new RNG(seed), 1) });
  const sim = new Sim(state);
  sim.enterGlade(glade, rng);
  return { sim, state, glade, rng };
}

function idle() {
  return { moveX: 0, moveZ: 0, attack: false, ability: false, dash: false };
}

function run(sim, seconds, input = idle()) {
  for (let t = 0; t < seconds * 60; t++) sim.step(1 / 60, input);
}

test('Ranged classes do not fire at something out of range', () => {
  const { sim } = setup('thornstrider');
  sim.enemies = [];
  sim.spawnEnemy('mite', { x: sim.player.x + 45, z: sim.player.z });
  sim.projectiles = [];
  sim.autoAttack(null);
  assert.equal(sim.projectiles.length, 0);
});

test('Holding attack always fires, even with nothing in range', () => {
  const { sim } = setup('bloomweaver');
  sim.enemies = [];
  sim.projectiles = [];
  sim.autoAttack(0);
  assert.equal(sim.projectiles.length, 1);
  assert.equal(sim.projectiles[0].hostile, false);
});

test('The Waxguard cleaves in front of itself, not in a circle around it', () => {
  const { sim } = setup('waxguard');
  sim.enemies = [];
  const front = sim.spawnEnemy('mite', { x: sim.player.x + 4, z: sim.player.z });
  const behind = sim.spawnEnemy('mite', { x: sim.player.x - 4, z: sim.player.z });
  front.appear = 0;
  behind.appear = 0;
  const frontHp = front.hp;
  const behindHp = behind.hp;
  sim.autoAttack(0); // aiming towards +x
  assert.ok(front.hp < frontHp, 'the target in front is hit');
  assert.equal(behind.hp, behindHp, 'the one behind is not');
});

test("Thornstrider's Predator's Line rewards distance", () => {
  function shot(distance) {
    const { sim, state } = setup('thornstrider');
    state.crit = 0;
    state.talents.distance = 3;
    sim.rng = { next: () => 0.99, range: (a, b) => (a + b) / 2, chance: () => false, pick: list => list[0], shuffle: list => list, int: () => 0 };
    sim.enemies = [];
    const enemy = sim.spawnEnemy('mite', { x: sim.player.x + distance, z: sim.player.z });
    enemy.appear = 0;
    sim.projectiles = [];
    sim.autoAttack(null);
    return sim.projectiles[0].damage;
  }
  assert.ok(shot(28) > shot(6));
});

test('A dash makes the bee briefly untouchable', () => {
  const { sim, state } = setup('waxguard');
  sim.step(1 / 60, { ...idle(), dash: true, moveX: 1 });
  assert.ok(sim.player.dashTime > 0);
  assert.ok(sim.player.invuln > 0);
  const hp = state.hp;
  sim.damagePlayer(50, 'test');
  assert.equal(state.hp, hp, 'invulnerable during the dash');

  sim.player.invuln = 0;
  sim.damagePlayer(50, 'test');
  assert.ok(state.hp < hp, 'vulnerable once it ends');
});

test('Dash has a cooldown so it cannot be spammed', () => {
  const { sim } = setup('thornstrider');
  sim.step(1 / 60, { ...idle(), dash: true, moveX: 1 });
  const firstCooldown = sim.player.dashCd;
  run(sim, 0.4, { ...idle(), dash: true, moveX: 1 });
  assert.ok(sim.player.dashCd <= firstCooldown, 'the cooldown runs down, it does not restart');
  assert.ok(sim.player.dashCd > 0);
});

test('Spitters shoot back and their spores hurt', () => {
  const { sim, state } = setup('thornstrider', 'treasure');
  sim.enemies = [];
  const spitter = sim.spawnEnemy('spitter', { x: sim.player.x + 12, z: sim.player.z });
  spitter.appear = 0;
  spitter.shootCd = 0;
  sim.step(1 / 60, idle());
  const hostile = sim.projectiles.filter(shot => shot.hostile);
  assert.ok(hostile.length > 0, 'the spitter fires');

  const hp = state.hp;
  sim.player.invuln = 0;
  hostile[0].x = sim.player.x;
  hostile[0].z = sim.player.z;
  sim.stepProjectiles(1 / 60);
  assert.ok(state.hp < hp);
});

test('Enemies stay inside the glade', () => {
  const { sim } = setup('waxguard');
  sim.enemies = [];
  const enemy = sim.spawnEnemy('mite', { x: 0, z: 0 });
  enemy.appear = 0;
  sim.player.x = 500;
  sim.player.z = 500;
  run(sim, 4);
  assert.ok(Math.hypot(enemy.x, enemy.z) <= 58);
});

test('A combat node runs its waves and then opens the gates', () => {
  const { sim } = setup('waxguard');
  sim.startEncounter('combat');
  const events = [];
  const waves = sim.encounter.waves;
  for (let i = 0; i < 4000 && !sim.cleared; i++) {
    sim.step(1 / 60, idle());
    for (const event of sim.drainEvents()) events.push(event.type);
    // Stand in for a competent player: clear whatever spawned.
    for (const enemy of sim.enemies) if (!enemy.dead && !enemy.wander) sim.killEnemy(enemy);
  }
  assert.equal(sim.cleared, true, 'the encounter finishes');
  assert.equal(sim.encounter.wave, waves, 'every wave was sent');
  assert.ok(events.includes('nodeCleared'));
  assert.ok(events.includes('gatesOpen'));
});

test('Quiet glades are open from the start', () => {
  const { sim } = setup('waxguard', 'shrine');
  assert.equal(sim.cleared, true);
  assert.equal(sim.encounter, null);
});

test('The Guardian changes phase as it loses vitality, and telegraphs its moves', () => {
  const { sim } = setup('waxguard', 'boss');
  sim.startEncounter('boss');
  const boss = sim.enemies.find(enemy => enemy.boss);
  assert.ok(boss, 'the Guardian is there');
  assert.equal(boss.phase, 1);
  boss.appear = 0; // skip the entrance animation

  boss.hp = boss.maxHp * 0.3;
  sim.step(1 / 60, idle());
  assert.equal(boss.phase, 2);
  boss.hp = boss.maxHp * 0.1;
  sim.step(1 / 60, idle());
  assert.equal(boss.phase, 3);

  boss.telegraph = null;
  boss.attackCd = 0;
  sim.drainEvents();
  run(sim, 0.2);
  const telegraphs = sim.events.filter(event => event.type === 'bossTelegraph');
  assert.ok(telegraphs.length > 0, 'the player gets a warning before the hit lands');
});

test('Killing the Guardian clears the node', () => {
  const { sim } = setup('waxguard', 'boss');
  sim.startEncounter('boss');
  const boss = sim.enemies.find(enemy => enemy.boss);
  sim.killEnemy(boss);
  sim.time = 2;
  sim.drainEvents();
  sim.step(1 / 60, idle());
  const types = sim.drainEvents().map(event => event.type);
  assert.ok(types.includes('nodeCleared'));
  assert.equal(sim.cleared, true);
});

test('Walking over a mote collects it exactly once', () => {
  const { sim, state, glade } = setup('waxguard', 'treasure');
  const pickup = glade.pickups[0];
  sim.player.x = pickup.x;
  sim.player.z = pickup.z;
  sim.stepPickups();
  sim.stepPickups();
  assert.equal(state.materials[pickup.kind], 1);
  assert.equal(pickup.taken, true);
});

test('The hidden cache can be found once and pays out', () => {
  const { sim, state, glade } = setup('waxguard', 'treasure', 7);
  glade.secret = { kind: 'relicshard', x: sim.player.x, z: sim.player.z, y: 0, radius: 2.4, taken: false };
  sim.updatePrompt();
  assert.equal(sim.prompt.action, 'secret');
  const score = state.score;
  sim.interact();
  assert.equal(glade.secret.taken, true);
  assert.equal(state.secrets, 1);
  assert.ok(state.score > score);

  sim.updatePrompt();
  assert.equal(sim.prompt, null, 'a found cache stops prompting');
});

test('A landmark can only be used once', () => {
  const { sim, glade } = setup('waxguard', 'shrine');
  sim.player.x = glade.poi.x;
  sim.player.z = glade.poi.z;
  sim.updatePrompt();
  assert.equal(sim.prompt.action, 'poi');
  const result = sim.interact();
  assert.equal(result.node, 'shrine');
  sim.updatePrompt();
  assert.equal(sim.prompt, null);
});

test('Reaching an open gate reports a single travel event', () => {
  const { sim, glade } = setup('waxguard', 'treasure');
  const gate = glade.gates[0];
  sim.player.x = gate.x;
  sim.player.z = gate.z;
  sim.drainEvents();
  sim.checkGates();
  sim.checkGates();
  assert.equal(sim.drainEvents().filter(event => event.type === 'travel').length, 1);
});

test('Gates stay shut while the fight is on', () => {
  const { sim, glade } = setup('waxguard', 'combat');
  sim.startEncounter('combat');
  const gate = glade.gates[0];
  sim.player.x = gate.x;
  sim.player.z = gate.z;
  sim.drainEvents();
  sim.checkGates();
  assert.equal(sim.drainEvents().some(event => event.type === 'travel'), false);
});

test('Event payloads never overwrite the name of the event', () => {
  const { sim } = setup('waxguard');
  sim.emit('nodeCleared', { node: 'combat' });
  const [event] = sim.drainEvents();
  assert.equal(event.type, 'nodeCleared');
  assert.equal(event.node, 'combat');
});
