// The arcade is published as static files on arcade.mjodheim.be, with no
// account server behind it. These are the rules of the board the game keeps on
// the player's own device instead.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rank, add, best, qualifies, readScores, saveScore, readName, saveName,
  SCORES_KEY, NAME_KEY, MAX_SCORES
} from '../public/js/core/localscores.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; }
  };
}
function run(score, at = '2026-01-01T00:00:00.000Z') {
  return { username: 'Bee', classId: 'waxguard', region: 2, score, at };
}

test('The board is ordered by score, highest first', () => {
  const board = rank([run(10), run(900), run(120)]);
  assert.deepEqual(board.map(entry => entry.score), [900, 120, 10]);
  assert.deepEqual(board.map(entry => entry.rank), [1, 2, 3]);
});

test('A tie keeps the older run ahead, so reading the board twice never reshuffles it', () => {
  const older = run(500, '2026-01-01T10:00:00.000Z');
  const newer = run(500, '2026-01-02T10:00:00.000Z');
  assert.deepEqual(rank([newer, older]).map(entry => entry.at), [older.at, newer.at]);
  assert.deepEqual(rank(rank([newer, older])).map(entry => entry.at), [older.at, newer.at]);
});

test('The board never grows past its limit', () => {
  const many = Array.from({ length: MAX_SCORES + 12 }, (_, i) => run(i));
  const board = rank(many);
  assert.equal(board.length, MAX_SCORES);
  assert.equal(board[0].score, MAX_SCORES + 11);
});

test('Broken entries are dropped instead of poisoning the board', () => {
  const board = rank([run(50), null, { score: 'not a number' }, { score: NaN }, run(70)]);
  assert.deepEqual(board.map(entry => entry.score), [70, 50]);
});

test('A score is stored as a whole, non-negative number', () => {
  const [entry] = rank([{ ...run(12.9), score: 12.9 }]);
  assert.equal(entry.score, 12);
  assert.equal(rank([{ ...run(-5), score: -5 }])[0].score, 0);
});

test('A run qualifies while the board has room, then only by beating the last one', () => {
  const almost = Array.from({ length: MAX_SCORES - 1 }, () => run(1000));
  assert.equal(qualifies(almost, 1), true);
  const full = Array.from({ length: MAX_SCORES }, () => run(1000));
  assert.equal(qualifies(full, 999), false);
  assert.equal(qualifies(full, 1001), true);
});

test('best() reads the top score, and 0 on an empty board', () => {
  assert.equal(best([]), 0);
  assert.equal(best([run(10), run(4000), run(30)]), 4000);
});

test('Saving a run keeps it across reads', () => {
  const storage = fakeStorage();
  saveScore(storage, run(700));
  saveScore(storage, run(2100));
  const board = readScores(storage);
  assert.deepEqual(board.map(entry => entry.score), [2100, 700]);
  assert.equal(best(board), 2100);
});

test('A corrupted store reads as an empty board rather than throwing', () => {
  assert.deepEqual(readScores(fakeStorage({ [SCORES_KEY]: 'not json' })), []);
  assert.deepEqual(readScores(fakeStorage({ [SCORES_KEY]: '{"not":"an array"}' })), []);
  assert.deepEqual(readScores(null), []);
});

test('Storage that refuses to write loses nothing else', () => {
  const hostile = {
    getItem: () => null,
    setItem: () => { throw new Error('quota exceeded'); },
    removeItem: () => { throw new Error('denied'); }
  };
  assert.deepEqual(saveScore(hostile, run(120)).map(entry => entry.score), [120]);
  assert.equal(saveName(hostile, 'Bee'), 'Bee');
});

test('The local nickname is trimmed, capped and removable', () => {
  const storage = fakeStorage();
  assert.equal(saveName(storage, '  Abeille  '), 'Abeille');
  assert.equal(readName(storage), 'Abeille');
  assert.equal(saveName(storage, 'x'.repeat(40)).length, 24);
  assert.equal(saveName(storage, '   '), '');
  assert.equal(NAME_KEY in storage.data, false);
  assert.equal(readName(storage), '');
});

test('add() leaves the board untouched when the entry is unusable', () => {
  const board = rank([run(10)]);
  assert.deepEqual(add(board, { score: 'nope' }).map(entry => entry.score), [10]);
});
