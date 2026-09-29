'use strict';

// Arcade cabinet kit: sign-up gate, run tokens, score submission and a
// leaderboard widget, so a new game only has to call play() and finish().
//
//   const cab = ArcadeCabinet.create({
//     game: 'forbidden-fruit',
//     start: daily => startTheGame(daily),
//     playerLine, status, board, tabs      // optional elements
//   });
//   button.onclick = () => cab.play();       // gated behind an account
//   cab.finish(score);                        // at game over
(() => {
  const Account = window.ArcadeAccount;
  const pad = n => String(n).padStart(6, '0');

  function create({ game, start, playerLine, status, board, tabs = [], chip }) {
    let offline = false;
    let daily = false;
    let lastDailyDay = ''; // UTC day of the last daily run submitted from this page
    let run = null;

    if (chip) Account?.renderChip(chip);

    function paintPlayer() {
      if (!playerLine) return;
      playerLine.classList.toggle('guest', !Account?.loggedIn);
      if (Account?.loggedIn) playerLine.textContent = `JOUEUR · ${Account.user.username}`;
      else if (offline || !Account) playerLine.textContent = 'SERVEUR DE SCORES HORS-LIGNE · PARTIE NON CLASSÉE';
      else playerLine.textContent = 'INSCRIS-TOI POUR JOUER ET ENREGISTRER TES SCORES';
    }

    function setStatus(text, kind = '') {
      if (!status) return;
      status.textContent = text;
      status.className = `score-status ${kind}`;
    }

    let boardRequest = 0;
    async function refreshBoard() {
      if (!board || !Account) return paintPlayer();
      // Only the latest request may paint: a slow answer for the other tab
      // must not overwrite the one the player is looking at.
      const ticket = ++boardRequest;
      try {
        const scores = await Account.leaderboard(game, daily, 8, daily ? lastDailyDay : '');
        if (ticket !== boardRequest) return;
        offline = false;
        board.replaceChildren();
        if (!scores.length) {
          const li = document.createElement('li');
          li.className = 'empty';
          li.textContent = daily ? 'Personne n’a encore joué aujourd’hui.' : 'Aucun score. La place est libre.';
          board.appendChild(li);
        }
        for (const s of scores) {
          const li = document.createElement('li');
          if (Account.user && s.username === Account.user.username) li.className = 'me';
          const name = document.createElement('span'); name.textContent = s.username;
          const pts = document.createElement('b'); pts.textContent = pad(s.score);
          li.append(name, pts);
          board.appendChild(li);
        }
      } catch (err) {
        if (ticket !== boardRequest) return;
        if (err.offline) offline = true;
        const li = document.createElement('li');
        li.className = 'empty'; li.textContent = 'Classement indisponible.';
        board.replaceChildren(li);
      }
      paintPlayer();
    }

    tabs.forEach(tab => tab.addEventListener('click', () => {
      daily = tab.dataset.board === 'daily';
      tabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      refreshBoard();
    }));

    // Today's UTC day according to this device, used only when the server
    // cannot be reached (the run is then unranked anyway).
    const localDay = () => new Date().toISOString().slice(0, 10);

    async function begin(isDaily) {
      setStatus('');
      run = null;
      if (!Account?.loggedIn) return start(isDaily, localDay());
      const r = { token: null, failed: false, daily: isDaily };
      r.ready = Account.startRun(game, isDaily)
        .then(res => { r.token = res.token; r.day = res.day; })
        .catch(err => { r.failed = true; if (err.offline) offline = true; });
      run = r;
      // A daily run is seeded from the server's day, so every player gets the
      // same board and changing the device clock picks nothing; a free run
      // starts right away.
      if (isDaily) {
        await Promise.race([r.ready, new Promise(resolve => setTimeout(resolve, 4000))]);
        if (run !== r) return;
      }
      // If the server was too slow, the board comes from the device's day and
      // the run stays unranked unless that turns out to be the server's day.
      r.seedDay = r.day || localDay();
      start(isDaily, r.seedDay);
    }

    async function play(isDaily = false) {
      if (!Account || Account.loggedIn || offline) return begin(isDaily);
      const user = await Account.openModal('register');
      if (user || offline) begin(isDaily);
    }

    async function finish(score) {
      const r = run;
      run = null;
      if (!r) { setStatus(offline || !Account ? 'Hors-ligne : score non enregistré.' : 'Connecte-toi pour enregistrer tes scores.', 'warn'); return null; }
      setStatus('Envoi du score…');
      await r.ready;
      if (r.failed || !r.token) { setStatus('Serveur de scores injoignable : score non enregistré.', 'warn'); return null; }
      if (r.daily && r.day !== r.seedDay) { setStatus('Défi joué sur une autre grille que celle du jour : score non classé.', 'warn'); return null; }
      try {
        const res = await Account.submitScore(r.token, Math.floor(score));
        if (res.day) lastDailyDay = res.day;
        const where = res.dailyRank ? `#${res.dailyRank} du jour · #${res.rank} au général` : `#${res.rank} au général`;
        setStatus(`${res.newBest ? 'NOUVEAU RECORD PERSO · ' : ''}Score enregistré · ${where}`, 'ok');
        refreshBoard();
        return res;
      } catch (err) {
        setStatus(err.message, 'warn');
        return null;
      }
    }

    Account?.onChange(() => { paintPlayer(); refreshBoard(); });
    paintPlayer();
    refreshBoard();
    if (Account?.loggedIn) Account.refresh().catch(() => {});
    return { play, finish, refreshBoard, get loggedIn() { return !!Account?.loggedIn; } };
  }

  window.ArcadeCabinet = { create };
})();
