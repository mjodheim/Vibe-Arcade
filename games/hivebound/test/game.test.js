import test from 'node:test';
import assert from 'node:assert/strict';

// Browser APIs touched by the game constructor / loop.
globalThis.addEventListener ??= () => {};
globalThis.requestAnimationFrame ??= () => 1;
globalThis.cancelAnimationFrame ??= () => {};

const { HiveboundGame } = await import('../public/js/game-patches.js');

function canvas() {
  const noop = () => {};
  return {
    getContext: () => ({
      fillStyle:'', strokeStyle:'', lineWidth:1, globalAlpha:1, shadowColor:'', shadowBlur:0,
      fillRect:noop, beginPath:noop, moveTo:noop, lineTo:noop, stroke:noop, fill:noop,
      arc:noop, ellipse:noop, save:noop, restore:noop, translate:noop
    })
  };
}

function makeGame(classId='thornstrider', hooks={}) {
  const game = new HiveboundGame(canvas(), hooks);
  game.newRun(classId, 123456789, 'test-run', true);
  return game;
}

test('Daily path choices are deterministic for the same seed', () => {
  const a = makeGame('waxguard');
  const b = makeGame('waxguard');
  assert.deepEqual(a.pathChoices().map(x => x.type), b.pathChoices().map(x => x.type));
});

test('Ranged classes respect their advertised attack range', () => {
  const game = makeGame('thornstrider');
  game.state.crit = 0;
  game.rng.next = () => 0.99;
  game.combat = {
    player:{x:0,y:0},
    enemies:[{x:800,y:0,r:10,hp:100,maxHp:100,dead:false}],
    projectiles:[], particles:[]
  };
  game.autoAttack();
  assert.equal(game.combat.projectiles.length, 0);
});

test("Thornstrider Predator's Line increases damage with distance", () => {
  function shotDamage(distance) {
    const game = makeGame('thornstrider');
    game.state.crit = 0;
    game.state.talents.distance = 3;
    game.rng.next = () => 0.99;
    game.combat = {
      player:{x:0,y:0},
      enemies:[{x:distance,y:0,r:10,hp:100,maxHp:100,dead:false}],
      projectiles:[], particles:[]
    };
    game.autoAttack();
    return game.combat.projectiles[0].damage;
  }
  assert.ok(shotDamage(500) > shotDamage(100));
});

test('Maxed talent trees continue through Overflow instead of soft-locking', () => {
  const game = makeGame('waxguard');
  Object.assign(game.state.talents, {
    ferocity:5, fleet:4, heart:4, tempo:5, fortune:4,
    rage:3, cleave:3, thorns:3
  });
  game.running = true;
  const before = game.state.damageMult;
  game.pauseForTalent();
  assert.equal(game.paused, false);
  assert.equal(game.state.talents.overflow, 1);
  assert.ok(game.state.damageMult > before);
});

test('Combat completion waits for a pending level reward before loot', () => {
  let nodeCompleted = false;
  const game = makeGame('waxguard', {
    onLoot(items, choose) { choose(items[0]); },
    onNodeComplete() { nodeCompleted = true; }
  });
  game.running = true;
  game.paused = true;
  game.combat = { type:'combat', player:{x:0,y:0}, enemies:[], projectiles:[], particles:[] };
  game.winCombat(false);
  assert.equal(game.running, true);
  assert.equal(game._pendingWin, 'normal');

  Object.assign(game.state.talents, {
    ferocity:5, fleet:4, heart:4, tempo:5, fortune:4,
    rage:3, cleave:3, thorns:3
  });
  game.pauseForTalent();
  assert.equal(game.running, false);
  assert.equal(game._pendingWin, null);
  assert.equal(nodeCompleted, true);
});

test('Gloam remains bounded after events and pacts', () => {
  const game = makeGame('bloomweaver');
  game.state.gloam = 198;
  game.applyEvent({id:'blood'});
  assert.equal(game.state.gloam, 200);
  game.applyPact({id:'hunger',gloam:20,sigil:'Gloam'});
  assert.equal(game.state.gloam, 200);
});
