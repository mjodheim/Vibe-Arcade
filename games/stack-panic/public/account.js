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

  Account.renderChip(document.getElementById('accountChip'));

  function paintPlayer() {
    if (!playerLine) return;
    playerLine.classList.toggle('guest', !Account.loggedIn);
    if (Account.loggedIn) playerLine.textContent = `JOUEUR · ${Account.user.username}`;
    else if (offline) playerLine.textContent = 'SERVEUR DE SCORES HORS-LIGNE · PARTIE NON CLASSÉE';
    else playerLine.textContent = 'INSCRIS-TOI POUR JOUER ET ENREGISTRER TES SCORES';
  }

  async function refreshBoard() {
    if (!boardList) return;
    try {
      const scores = await Account.leaderboard(GAME, boardDaily, 8);
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
  const resetBeforeAccount = resetGame;
  resetGame = function(daily = false) {
    resetBeforeAccount(daily);
    if (scoreStatus) { scoreStatus.textContent = ''; scoreStatus.className = 'score-status'; }
    if (!Account.loggedIn) { state.accountRun = null; return; }
    const run = { token: null, failed: false };
    run.ready = Account.startRun(GAME, daily)
      .then(token => { run.token = token; })
      .catch(err => { run.failed = true; if (err.offline) offline = true; });
    state.accountRun = run;
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
      try {
        const r = await Account.submitScore(run.token, score);
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
