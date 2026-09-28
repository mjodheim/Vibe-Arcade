import { randomBytes } from 'node:crypto';
import { store } from './_lib/store.js';
import { route, json, readJson, limit, clientIp, normalizeUsername, usernameKey, validateCredentials, hashPassword, sessionToken, publicUser, HttpError } from './_lib/core.js';

export const POST = route(async request => {
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
