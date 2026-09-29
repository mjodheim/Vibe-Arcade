'use strict';

// Accounts for STACK PANIC: you sign up to play, and every run is submitted
// to the arcade leaderboard. If the score server cannot be reached at all
// (static preview, outage) the cabinet still runs, clearly marked unranked.
(() => {
  const Account = window.ArcadeAccount;
  if (!Account) return;
  const GAME = 'stack-panic';

  const playerLine = document.getElementById('playerLine');
  const scoreStatus = document.getElementById('scoreStatus');
  const boardList = document.getElementById('leaderboard');
  const boardTabs = document.querySelectorAll('[data-board]');
  let offline = false;
  let boardDaily = false;
  let lastDailyDay = ''; // UTC day of the last daily run submitted from this page

  Account.renderChip(document.getElementById('accountChip'));

  function paintPlayer() {
    if (!playerLine) return;
    playerLine.classList.toggle('guest', !Account.loggedIn);
    if (Account.loggedIn) playerLine.textContent = `JOUEUR · ${Account.user.username}`;
    else if (offline) playerLine.textContent = 'SERVEUR DE SCORES HORS-LIGNE · PARTIE NON CLASSÉE';
    else playerLine.textContent = 'INSCRIS-TOI POUR JOUER ET ENREGISTRER TES SCORES';
  }

  let boardRequest = 0;
  async function refreshBoard() {
    if (!boardList) return;
    // Only the latest request may paint (tabs can be toggled faster than the API answers).
    const ticket = ++boardRequest;
    try {
      const scores = await Account.leaderboard(GAME, boardDaily, 8, boardDaily ? lastDailyDay : '');
      if (ticket !== boardRequest) return;
      offline = false;
      boardList.innerHTML = '';
      if (!scores.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = boardDaily ? 'Personne n’a encore survécu aujourd’hui.' : 'Aucun score. La place est libre.';
        boardList.appendChild(li);
      }
      scores.forEach(s => {
        const li = document.createElement('li');
        if (Account.user && s.username === Account.user.username) li.className = 'me';
        const name = document.createElement('span'); name.textContent = s.username;
        const pts = document.createElement('b'); pts.textContent = formatScore(s.score);
        li.append(name, pts);
        boardList.appendChild(li);
      });
    } catch (err) {
      if (ticket !== boardRequest) return;
      if (err.offline) offline = true;
      boardList.innerHTML = '<li class="empty">Classement indisponible.</li>';
    }
    paintPlayer();
  }

  boardTabs.forEach(tab => tab.addEventListener('click', () => {
    boardDaily = tab.dataset.board === 'daily';
    boardTabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    refreshBoard();
  }));

  // Sign-up gate in front of every way of starting a run.
  const startButtons = ['startBtn', 'dailyBtn', 'restartBtn'];
  document.addEventListener('click', async event => {
    const btn = event.target.closest?.('button');
    if (!btn || !startButtons.includes(btn.id)) return;
    if (Account.loggedIn || offline) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const user = await Account.openModal('register');
    if (user || offline) btn.click();
  }, true);

  Account.onChange(() => { paintPlayer(); refreshBoard(); });

  // Every run asks the server for a signed, single-use run token.
  state.accountRun = null;
  let prefetched = null;
  function openRun(daily) {
    const run = { token: null, failed: false, day: '', daily };
    run.ready = Account.startRun(GAME, daily)
      .then(res => { run.token = res.token; run.day = res.day; })
      .catch(err => { run.failed = true; if (err.offline) offline = true; });
    return run;
  }

  // Daily boards are seeded from the server's UTC day, not the device clock,
  // so everyone gets the same pieces and a changed clock picks nothing.
  let serverDay = '';
  const deviceTodaySeed = todaySeed;
  todaySeed = function(d) {
    return d === undefined && serverDay ? deviceTodaySeed(new Date(`${serverDay}T12:00:00Z`)) : deviceTodaySeed(d);
  };

  // A logged-in daily start first opens the run to learn that day.
  let startingDaily = false;
  document.addEventListener('click', async event => {
    const btn = event.target.closest?.('button');
    if (!btn || !Account.loggedIn || !startButtons.includes(btn.id)) return;
    // While a daily start waits for the server, swallow any other start click
    // (double-click, or the free button) so only one game begins.
    if (startingDaily) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const daily = btn.id === 'dailyBtn' || (btn.id === 'restartBtn' && state.daily);
    if (!daily) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    startingDaily = true;
    const run = openRun(true);
    await Promise.race([run.ready, new Promise(resolve => setTimeout(resolve, 4000))]);
    serverDay = run.day || serverDay;
    prefetched = run;
    startingDaily = false;
    ensureAudio();
    resetGame(true);
  }, true);

  const resetBeforeAccount = resetGame;
  resetGame = function(daily = false) {
    resetBeforeAccount(daily);
    if (scoreStatus) { scoreStatus.textContent = ''; scoreStatus.className = 'score-status'; }
    const run = prefetched && daily ? prefetched : null;
    prefetched = null;
    if (!Account.loggedIn) { state.accountRun = null; return; }
    state.accountRun = run || openRun(daily);
    // The day the board was actually seeded from (device day if the server was too slow).
    state.accountRun.seedDay = serverDay || new Date().toISOString().slice(0, 10);
  };

  function setStatus(text, kind) {
    if (!scoreStatus) return;
    scoreStatus.textContent = text;
    scoreStatus.className = `score-status ${kind || ''}`;
  }

  const endBeforeAccount = endGame;
  endGame = function() {
    endBeforeAccount();
    const run = state.accountRun;
    state.accountRun = null;
    const score = state.score;
    if (!run) { setStatus(offline ? 'Hors-ligne : score non enregistré.' : 'Connecte-toi pour enregistrer tes scores.', 'warn'); return; }
    setStatus('Envoi du score…', '');
    run.ready.then(async () => {
      if (run.failed || !run.token) { setStatus('Serveur de scores injoignable : score non enregistré.', 'warn'); return; }
      if (run.daily && run.day !== run.seedDay) { setStatus('Défi joué sur une autre grille que celle du jour : score non classé.', 'warn'); return; }
      try {
        const r = await Account.submitScore(run.token, score);
        if (r.day) lastDailyDay = r.day;
        const where = r.dailyRank ? `#${r.dailyRank} du jour · #${r.rank} au général` : `#${r.rank} au général`;
        setStatus(`${r.newBest ? 'NOUVEAU RECORD PERSO · ' : ''}Score enregistré · ${where}`, 'ok');
        refreshBoard();
      } catch (err) {
        setStatus(err.message, 'warn');
      }
    });
  };

  paintPlayer();
  refreshBoard();
  if (Account.loggedIn) Account.refresh().catch(() => {});
})();
