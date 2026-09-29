import { randomBytes } from 'node:crypto';
import { store } from './store.js';
import {
  route, json, readJson, limit, clientIp, normalizeUsername, usernameKey, validateCredentials,
  hashPassword, verifyPassword, sessionToken, publicUser, loadUser, requireUser, runToken, verify,
  boardKey, dayKey, GAMES, HttpError
} from './core.js';

const register = route(async request => {
  await limit(`register:${clientIp(request)}`, 10, 3600);
  const data = await readJson(request);
  const username = normalizeUsername(data.username);
  validateCredentials(username, data.password);
  const { salt, hash } = hashPassword(data.password);
  const user = { id: randomBytes(12).toString('hex'), username, salt, hash, createdAt: new Date().toISOString() };
  // Sign first: a missing ARCADE_SECRET must fail before the name is taken.
  const token = sessionToken(user);
  const created = await store().setNX(`user:${usernameKey(username)}`, JSON.stringify(user));
  if (!created) throw new HttpError(409, 'Ce pseudo est déjà pris.');
  return json(201, { token, user: publicUser(user) });
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
  // Every scored run leaves a 7-day marker: bound how fast one account can mint them.
  await limit(`runs:${user.id}`, 60, 600);
  const data = await readJson(request);
  if (!GAMES[data.game]) throw new HttpError(400, 'Jeu inconnu.');
  // The daily seed comes from the server's UTC day, never the device clock;
  // read the clock once so the signed token and the response agree at midnight.
  const day = dayKey();
  return json(201, { runToken: runToken(user, data.game, data.daily, day), day });
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
  // The run marker records the submitted score. A retry of the same
  // submission (after a timeout or a storage hiccup) replays the idempotent
  // leaderboard writes; a different score for the same run is refused.
  const marker = `run:${run.rid}`;
  if (!(await store().setNX(marker, String(score), 7 * 86400)) && (await store().get(marker)) !== String(score)) {
    throw new HttpError(409, 'Score déjà enregistré pour cette partie.');
  }

  const db = store();
  const all = boardKey(run.game, false);
  const previous = (await db.zscore(all, user.username)) || 0;
  await db.zaddGT(all, user.username, score);
  // Read back what is actually stored: a concurrent submission may have won.
  const best = (await db.zscore(all, user.username)) || score;
  const result = { score, best, newBest: score > previous && score === best, rank: (await db.zrevrank(all, user.username)) + 1 };
  if (run.daily) {
    const daily = boardKey(run.game, true, run.day);
    await db.zaddGT(daily, user.username, score, 3 * 86400);
    result.dailyRank = (await db.zrevrank(daily, user.username)) + 1;
    result.day = run.day;
  }
  return json(201, result);
});

const leaderboard = route(async request => {
  const url = new URL(request.url);
  const game = url.searchParams.get('game');
  if (!GAMES[game]) throw new HttpError(400, 'Jeu inconnu.');
  const daily = url.searchParams.get('daily') === '1';
  const count = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10));
  // A daily run started before UTC midnight is filed under its own day; the
  // client asks for that day so the score it just submitted stays visible.
  const requested = url.searchParams.get('day');
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : dayKey();
  const top = await store().ztop(boardKey(game, daily, day), count);
  return json(200, { game, daily, day: daily ? day : undefined, scores: top.map((s, i) => ({ rank: i + 1, username: s.member, score: s.score })) });
});

export const routes = {
  'POST /api/register': register,
  'POST /api/login': login,
  'GET /api/me': me,
  'POST /api/runs': startRun,
  'POST /api/scores': submitScore,
  'GET /api/scores': leaderboard
};
