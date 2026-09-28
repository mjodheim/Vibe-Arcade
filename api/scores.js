import { store } from './_lib/store.js';
import { route, json, readJson, requireUser, verify, boardKey, GAMES, HttpError } from './_lib/core.js';

export const POST = route(async request => {
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

export const GET = route(async request => {
  const url = new URL(request.url);
  const game = url.searchParams.get('game');
  if (!GAMES[game]) throw new HttpError(400, 'Jeu inconnu.');
  const daily = url.searchParams.get('daily') === '1';
  const count = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10));
  const top = await store().ztop(boardKey(game, daily), count);
  return json(200, { game, daily, scores: top.map((s, i) => ({ rank: i + 1, username: s.member, score: s.score })) });
});
