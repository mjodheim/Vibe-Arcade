import { route, json, readJson, limit, clientIp, usernameKey, loadUser, verifyPassword, sessionToken, publicUser, HttpError } from './_lib/core.js';

export const POST = route(async request => {
  await limit(`login:${clientIp(request)}`, 20, 600);
  const data = await readJson(request);
  const user = await loadUser(usernameKey(data.username));
  if (!user || !verifyPassword(data.password, user)) throw new HttpError(401, 'Pseudo ou mot de passe incorrect.');
  return json(200, { token: sessionToken(user), user: publicUser(user) });
});
