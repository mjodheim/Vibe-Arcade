'use strict';

// Vibe Arcade account client, shared by every cabinet and the landing page.
// window.ArcadeAccount exposes the session, a sign-in/sign-up modal, run
// tokens, score submission and leaderboards.
(() => {
  const TOKEN_KEY = 'vibe-arcade.session';
  const USER_KEY = 'vibe-arcade.user';
  const listeners = new Set();

  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private mode */ } };

  let token = read(TOKEN_KEY) || '';
  let user = null;
  try { user = JSON.parse(read(USER_KEY) || 'null'); } catch { user = null; }
  if (!token) user = null;

  function setSession(nextToken, nextUser) {
    token = nextToken || '';
    user = nextToken ? nextUser : null;
    write(TOKEN_KEY, token || null);
    write(USER_KEY, user ? JSON.stringify(user) : null);
    listeners.forEach(fn => { try { fn(user); } catch (e) { console.error(e); } });
  }

  class ApiError extends Error {
    constructor(message, status, offline = false) { super(message); this.status = status; this.offline = offline; }
  }

  const REQUEST_TIMEOUT_MS = 8000;
  // Whether the last request found the score server unreachable; cabinets let
  // players through unranked while it is.
  let serverOffline = false;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function request(path, { method = 'GET', body } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    let res;
    // A request that never answers counts as the server being unreachable:
    // nothing in the UI may wait on it forever.
    const timeout = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
    try { res = await fetch(`/api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: timeout }); }
    catch { serverOffline = true; throw new ApiError('Serveur injoignable.', 0, true); }
    const data = await res.json().catch(() => null);
    // No API at all (plain static preview) or storage not configured yet.
    serverOffline = !data || res.status === 404 || res.status === 503;
    if (serverOffline) throw new ApiError(data?.error || 'Serveur de scores indisponible.', res.status, true);
    if (res.status === 401 && token && path !== 'login') setSession('', null);
    if (!res.ok) throw new ApiError(data.error || `Erreur ${res.status}`, res.status);
    return data;
  }

  const api = {
    ApiError,
    get user() { return user; },
    get loggedIn() { return !!(token && user); },
    get offline() { return serverOffline; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async register(username, password) { const d = await request('register', { method: 'POST', body: { username, password } }); setSession(d.token, d.user); return d.user; },
    async login(username, password) { const d = await request('login', { method: 'POST', body: { username, password } }); setSession(d.token, d.user); return d.user; },
    logout() { setSession('', null); },
    async refresh() { if (!token) return null; const d = await request('me'); setSession(token, d.user); return d; },
    async startRun(game, daily = false) { const d = await request('runs', { method: 'POST', body: { game, daily } }); return { token: d.runToken, day: d.day }; },
    // The server accepts an identical retry for the same run, so a transient
    // outage (network, 5xx, 503) is retried with the same token and score
    // instead of losing a finished run. 4xx answers are final.
    async submitScore(runToken, score) {
      for (let attempt = 0; ; attempt++) {
        try { return await request('scores', { method: 'POST', body: { runToken, score } }); }
        catch (err) {
          const transient = err.offline || err.status >= 500;
          if (!transient || attempt >= 2) throw err;
          await wait(1500 * (attempt + 1));
        }
      }
    },
    async leaderboard(game, daily = false, limit = 10, day = '') { return (await request(`scores?game=${encodeURIComponent(game)}&daily=${daily ? 1 : 0}&limit=${limit}${day ? `&day=${encodeURIComponent(day)}` : ''}`)).scores; },
    openModal,
    renderChip
  };

  // ---------------------------------------------------------------- modal

  let modal = null;
  let pending = null;

  function buildModal() {
    const root = document.createElement('div');
    root.className = 'va-auth';
    root.hidden = true;
    root.innerHTML = `
      <div class="va-auth__backdrop" data-close></div>
      <form class="va-auth__card" novalidate>
        <button class="va-auth__x" type="button" data-close aria-label="Fermer">×</button>
        <small class="va-auth__kicker">VIBE ARCADE · COMPTE JOUEUR</small>
        <h2 class="va-auth__title">Inscris-toi pour jouer</h2>
        <p class="va-auth__lead">Un compte = ton pseudo sur les classements et tes scores enregistrés.</p>
        <div class="va-auth__tabs" role="tablist">
          <button type="button" role="tab" data-mode="register" aria-selected="true">Inscription</button>
          <button type="button" role="tab" data-mode="login" aria-selected="false">Connexion</button>
        </div>
        <label>Pseudo<input name="username" autocomplete="username" minlength="3" maxlength="20" required /></label>
        <label>Mot de passe<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
        <p class="va-auth__error" role="alert"></p>
        <button class="va-auth__submit" type="submit">CRÉER MON COMPTE</button>
      </form>`;
    document.body.appendChild(root);

    const form = root.querySelector('form');
    const error = root.querySelector('.va-auth__error');
    const submit = root.querySelector('.va-auth__submit');
    const password = form.elements.password;
    let mode = 'register';

    function setMode(next) {
      mode = next;
      root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
      root.querySelector('.va-auth__title').textContent = mode === 'register' ? 'Inscris-toi pour jouer' : 'Content de te revoir';
      submit.textContent = mode === 'register' ? 'CRÉER MON COMPTE' : 'SE CONNECTER';
      password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
      error.textContent = '';
    }
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close(null)));
    root.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); e.stopPropagation(); });
    root.addEventListener('keyup', e => e.stopPropagation());

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const username = form.elements.username.value;
      error.textContent = '';
      submit.disabled = true;
      try {
        const u = mode === 'register' ? await api.register(username, password.value) : await api.login(username, password.value);
        form.reset();
        close(u);
      } catch (err) {
        // The score server is down: the sign-up gate lets the player through
        // unranked instead of trapping them in this form.
        if (err.offline) { close(null); return; }
        error.textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    });

    return { root, setMode, focus: () => form.elements.username.focus() };
  }

  function close(result) {
    if (!modal) return;
    modal.root.hidden = true;
    const resolve = pending;
    pending = null;
    resolve?.(result);
  }

  function openModal(mode = 'register') {
    if (!modal) modal = buildModal();
    if (pending) close(null);
    modal.setMode(mode);
    modal.root.hidden = false;
    setTimeout(modal.focus, 30);
    return new Promise(resolve => { pending = resolve; });
  }

  // A small "who is playing" chip for any header.
  function renderChip(container) {
    if (!container) return;
    const paint = () => {
      container.innerHTML = '';
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'va-chip';
      if (api.loggedIn) {
        chip.innerHTML = `<i aria-hidden="true">●</i><span></span><b>DÉCONNEXION</b>`;
        chip.querySelector('span').textContent = user.username;
        chip.title = 'Se déconnecter';
        chip.addEventListener('click', () => api.logout());
      } else {
        chip.innerHTML = `<span>CONNEXION</span>`;
        chip.addEventListener('click', () => openModal('login'));
      }
      container.appendChild(chip);
    };
    listeners.add(paint);
    paint();
  }

  window.ArcadeAccount = api;
})();
