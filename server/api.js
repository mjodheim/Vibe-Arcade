import { randomBytes } from 'node:crypto';
import { store } from './store.js';
import {
  route, json, readJson, limit, clientIp, normalizeUsername, usernameKey, validateCredentials,
  hashPassword, verifyPassword, sessionToken, publicUser, loadUser, requireUser, runToken, verify,
  boardKey, GAMES, HttpError
} from './core.js';

const register = route(async request => {
  await limit(`register:${clientIp(request)}`, 10, 3600);
  const data = await readJson(request);
  const username = normalizeUsername(data.username);
  validateCredentials(username, data.password);
  const { salt, hash } = hashPassword(data.password);
  const user = { id: randomBytes(12).toString('hex'), username, salt, hash, createdAt: new Date().toISOString() };
  const created = await store().setNX(`user:${usernameKey(username)}`, JSON.stringify(user));
  if (!created) throw new HttpError(409, 'Ce pseudo est déjà pris.');
  return json(201, { token: sessionToken(user), user: publicUser(user) });
});

const login = route(async request => {
  await limit(`login:${clientIp(request)}`, 20, 600);
  const data = await readJson(request);
  const user = await loadUser(usernameKey(data.username));
  if (!user || !verifyPassword(data.password, user)) throw new HttpError(401, 'Pseudo ou mot de passe incorrect.');
  return json(200, { token: sessionToken(user), user: publicUser(user) });
});

const me = route(async request => {
  const user = await requireUser(request);
  const best = {};
  for (const game of Object.keys(GAMES)) best[game] = (await store().zscore(boardKey(game, false), user.username)) || 0;
  return json(200, { user: publicUser(user), best });
});

// A run must be opened by a logged-in player before it can be scored. The
// token is signed, time-stamped and single use.
const startRun = route(async request => {
  const user = await requireUser(request);
  const data = await readJson(request);
  if (!GAMES[data.game]) throw new HttpError(400, 'Jeu inconnu.');
  return json(201, { runToken: runToken(user, data.game, data.daily) });
});

const submitScore = route(async request => {
  const user = await requireUser(request);
  const data = await readJson(request);
  const run = verify(data.runToken);
  if (!run || run.typ !== 'run' || run.uid !== user.id) throw new HttpError(400, 'Partie invalide.');
  const rules = GAMES[run.game];
  const score = Math.floor(Number(data.score));
  const elapsed = (Date.now() - run.t) / 1000;
  if (!Number.isFinite(score) || score < 0 || score > rules.max) throw new HttpError(400, 'Score invalide.');
  if (score > rules.burst + elapsed * rules.perSecond) throw new HttpError(400, 'Score refusé : partie trop courte pour ce total.');
  if (!(await store().setNX(`run:${run.rid}`, '1', 7 * 86400))) throw new HttpError(409, 'Score déjà enregistré pour cette partie.');

  const db = store();
  const all = boardKey(run.game, false);
  const previous = (await db.zscore(all, user.username)) || 0;
  await db.zaddGT(all, user.username, score);
  const result = { score, best: Math.max(previous, score), newBest: score > previous, rank: (await db.zrevrank(all, user.username)) + 1 };
  if (run.daily) {
    const daily = boardKey(run.game, true, run.day);
    await db.zaddGT(daily, user.username, score, 3 * 86400);
    result.dailyRank = (await db.zrevrank(daily, user.username)) + 1;
  }
  return json(201, result);
});

const leaderboard = route(async request => {
  const url = new URL(request.url);
  const game = url.searchParams.get('game');
  if (!GAMES[game]) throw new HttpError(400, 'Jeu inconnu.');
  const daily = url.searchParams.get('daily') === '1';
  const count = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10));
  const top = await store().ztop(boardKey(game, daily), count);
  return json(200, { game, daily, scores: top.map((s, i) => ({ rank: i + 1, username: s.member, score: s.score })) });
});

export const routes = {
  'POST /api/register': register,
  'POST /api/login': login,
  'GET /api/me': me,
  'POST /api/runs': startRun,
  'POST /api/scores': submitScore,
  'GET /api/scores': leaderboard
};
