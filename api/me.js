import { store } from './_lib/store.js';
import { route, json, requireUser, publicUser, boardKey, GAMES } from './_lib/core.js';

export const GET = route(async request => {
  const user = await requireUser(request);
  const best = {};
  for (const game of Object.keys(GAMES)) best[game] = (await store().zscore(boardKey(game, false), user.username)) || 0;
  return json(200, { user: publicUser(user), best });
});
