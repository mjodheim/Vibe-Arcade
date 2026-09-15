// Hivebound is published twice: with its account server (Docker, `node
// server.js`) and as plain static files on arcade.mjodheim.be, where there is
// no server to talk to. Instead of showing a login form that cannot work, the
// game keeps its own leaderboard on the device. This module owns that board.
//
// It is pure in the sense the rest of core/ is: no DOM, no `localStorage`
// reached for directly. Storage is passed in, so the tests drive it with a
// plain object.

export const SCORES_KEY = 'hivebound.local-scores.v1';
export const NAME_KEY = 'hivebound.local-name.v1';
export const MAX_SCORES = 20;

function clean(entry) {
  const score = Number(entry?.score);
  if (!Number.isFinite(score)) return null;
  return {
    username: String(entry.username || 'Guest').slice(0, 24),
    classId: String(entry.classId || ''),
    region: Math.max(1, Math.floor(Number(entry.region) || 1)),
    score: Math.max(0, Math.floor(score)),
    at: String(entry.at || new Date().toISOString())
  };
}

// Highest first; equal scores keep the older run ahead, so a tie never
// reshuffles the board when it is read again.
export function rank(entries, limit = MAX_SCORES) {
  return entries
    .map(clean)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.at.localeCompare(b.at))
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function add(entries, entry, limit = MAX_SCORES) {
  const candidate = clean(entry);
  return candidate ? rank([...entries, candidate], limit) : rank(entries, limit);
}

export function best(entries) {
  return entries.reduce((highest, entry) => Math.max(highest, Number(entry?.score) || 0), 0);
}

// A run only reaches the board if it beats the worst entry, or the board is
// not full yet — the same rule the player would expect from an arcade.
export function qualifies(entries, score, limit = MAX_SCORES) {
  const board = rank(entries, limit);
  if (board.length < limit) return true;
  return Math.floor(Number(score) || 0) > board[board.length - 1].score;
}

// ------------------------------------------------------------------ storage
// Every read and write is guarded: private windows, disabled site data and
// full quotas all throw, and none of that is worth losing a run over.

export function readScores(storage) {
  try {
    const raw = storage?.getItem(SCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? rank(parsed) : [];
  } catch {
    return [];
  }
}

export function saveScore(storage, entry) {
  const next = add(readScores(storage), entry);
  try {
    storage?.setItem(SCORES_KEY, JSON.stringify(next));
  } catch {
    // The board stays in memory for this session; nothing else to do.
  }
  return next;
}

export function readName(storage) {
  try {
    return String(storage?.getItem(NAME_KEY) || '').slice(0, 24);
  } catch {
    return '';
  }
}

export function saveName(storage, name) {
  const clean = String(name || '').trim().slice(0, 24);
  try {
    clean ? storage?.setItem(NAME_KEY, clean) : storage?.removeItem(NAME_KEY);
  } catch {
    // Same as above: the name simply will not survive the reload.
  }
  return clean;
}
