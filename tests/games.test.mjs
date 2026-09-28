import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function load(file, name){
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(file, 'utf8'), sandbox, { filename:file });
  return sandbox[name];
}
const F = load('games/forbidden-fruit/public/logic.js', 'FruitLogic');
const P = load('games/pigeon-control/public/logic.js', 'PigeonLogic');

// ------------------------------------------------------------------ Forbidden Fruit

test('fruit: same seed, same inputs, same run (daily challenge is fair)', () => {
  const run = () => { const s = F.newGame(1234); for(let i = 0; i < 400; i++) F.update(s, 16, ['up','left','down','right'][Math.floor(i / 40) % 4]); return [s.score, s.over, s.apple.x, s.apple.y, s.snakes.length]; };
  assert.deepEqual(run(), run());
});

test('fruit: a snake finds the apple and eats a player who stands still', () => {
  const s = F.newGame(5);
  while(!s.over && s.time < 20000) F.update(s, 16, null);
  assert.equal(s.over, true, 'idle apple survived 20 s');
  assert.ok(['chaser','ambusher','drunk'].includes(s.cause));
});

test('fruit: snakes that crash explode into seeds and score a kill', () => {
  const s = F.newGame(9);
  const sn = s.snakes[0];
  sn.body = [{x:0,y:5},{x:0,y:6},{x:0,y:7},{x:0,y:8}]; sn.dir = F.DIRS.left;
  const before = s.score;
  F.killSnake(s, sn, 'wall');
  assert.equal(s.kills, 1);
  assert.equal(s.score - before, F.POINTS.KILL_POINTS);
  assert.ok(s.seeds.some(p => p.x === 0 && p.y === 5), 'corpse did not turn into seeds');
});

test('fruit: the apple cannot walk through a snake body, and walking into a head is fatal', () => {
  const s = F.newGame(3);
  const sn = s.snakes[0];
  s.apple.x = 5; s.apple.y = 5;
  sn.body = [{x:7,y:5},{x:6,y:5},{x:6,y:6}];
  assert.equal(F.moveApple(s, F.DIRS.right), false, 'moved into a body segment');
  sn.body = [{x:6,y:5},{x:6,y:6},{x:6,y:7}];
  F.moveApple(s, F.DIRS.right);
  assert.equal(s.over, true);
});

test('fruit: snakes speed up over time but keep a floor', () => {
  const s = F.newGame(1);
  const sn = s.snakes[0];
  const early = F.snakeStepMs(s, sn);
  s.time = 600000;
  assert.ok(F.snakeStepMs(s, sn) < early);
  assert.ok(F.snakeStepMs(s, sn) >= 78);
});

// ------------------------------------------------------------------ Pigeon Control

test('pigeon: a routed pigeon lands on its own monument and scores', () => {
  const s = P.newGame(1);
  const p = P.spawn(s, {x:480, y:400, angle:0, kind:'dove'});
  const fountain = P.STATUES.find(st => st.id === 'fountain');
  assert.equal(P.setPath(s, p.id, [{x:480, y:300}, {x:fountain.x, y:fountain.y}]), 'fountain');
  for(let i = 0; i < 600 && !s.landed; i++) P.update(s, 16);
  assert.equal(s.landed, 1);
  assert.ok(s.score >= P.POINTS.LAND_POINTS);
});

test('pigeon: the wrong monument is not a landing target, ninjas accept any', () => {
  const s = P.newGame(1);
  const city = P.spawn(s, {x:100, y:100, angle:0, kind:'city'});
  const ninja = P.spawn(s, {x:100, y:300, angle:0, kind:'ninja'});
  const kiosk = P.STATUES.find(st => st.id === 'kiosk');
  assert.equal(P.setPath(s, city.id, [{x:kiosk.x, y:kiosk.y}]), null);
  assert.equal(P.setPath(s, ninja.id, [{x:kiosk.x, y:kiosk.y}]), 'kiosk');
});

test('pigeon: two birds touching end the shift', () => {
  const s = P.newGame(1);
  s.nextSpawnAt = Infinity; s.nextGullAt = Infinity; s.nextBreadAt = Infinity;
  const a = P.spawn(s, {x:300, y:300, angle:0, kind:'city'});
  const b = P.spawn(s, {x:360, y:300, angle:Math.PI, kind:'city'});
  a.inside = b.inside = true;
  for(let i = 0; i < 200 && !s.over; i++) P.update(s, 16);
  assert.equal(s.over, true);
  assert.equal(s.cause, 'collision');
});

test('pigeon: streak bonus is capped so scores stay within the server plausibility limit', () => {
  const s = P.newGame(1);
  s.nextSpawnAt = Infinity; s.nextGullAt = Infinity; s.nextBreadAt = Infinity;
  const fountain = P.STATUES.find(st => st.id === 'fountain');
  for(let i = 0; i < 30; i++){
    const p = P.spawn(s, {x:fountain.x, y:fountain.y + 30, angle:0, kind:'dove'});
    P.setPath(s, p.id, [{x:fountain.x, y:fountain.y}]);
    for(let k = 0; k < 60 && s.landed <= i; k++) P.update(s, 16);
  }
  assert.equal(s.landed, 30);
  const perLanding = s.score / s.landed;
  assert.ok(perLanding <= P.POINTS.LAND_POINTS + 5 * P.POINTS.STREAK_BONUS, `per landing ${perLanding}`);
});

test('pigeon: an unattended square ends in a crash', () => {
  const s = P.newGame(2);
  while(!s.over && s.time < 180000) P.update(s, 16);
  assert.equal(s.over, true);
});
