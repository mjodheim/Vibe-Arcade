import { route, json, readJson, requireUser, runToken, GAMES, HttpError } from './_lib/core.js';

// A run must be opened by a logged-in player before it can be scored. The
// token is signed, time-stamped and single use.
export const POST = route(async request => {
  const user = await requireUser(request);
  const data = await readJson(request);
  if (!GAMES[data.game]) throw new HttpError(400, 'Jeu inconnu.');
  return json(201, { runToken: runToken(user, data.game, data.daily) });
});
