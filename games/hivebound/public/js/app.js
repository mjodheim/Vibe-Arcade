// Interface layer: screens, HUD, modals and account plumbing. It reads the
// game through hooks and answers with `resolve()` — it never touches the
// simulation itself.

import { api } from './api.js';
import { Hivebound, DEFAULT_CONTROLS } from './game3d.js';
import { CLASSES, SIGILS } from './core/rules.js';
import { currentLanguage, translate } from './i18n.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const screens = $$('.screen');

function showScreen(id) {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(value) {
  return Math.floor(value).toLocaleString(currentLanguage() === 'fr' ? 'fr-FR' : 'en-US');
}
function costText(cost) {
  const icons = { nectar: '🍯', wax: '⬡', pollen: '✿' };
  return Object.entries(cost).map(([key, value]) => `${icons[key]} ${value}`).join(' · ') || 'Free';
}

let user = null;
let lastResult = null;
let pendingDaily = false;
let toastTimer = null;
let titleTimer = null;
let hurtTimer = null;

// ------------------------------------------------------------------ controls

const CONTROL_STORAGE_KEY = 'hivebound.controls.v2';
const CONTROL_ACTIONS = {
  up: 'Move forward', down: 'Move back', left: 'Strafe left', right: 'Strafe right',
  ability: 'Class ability', dash: 'Dash', interact: 'Interact'
};
const DEFAULT_LABELS = { up: 'W', down: 'S', left: 'A', right: 'D', ability: 'Space', dash: 'Shift', interact: 'E' };

function loadControls() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY) || 'null');
    return {
      bindings: { ...DEFAULT_CONTROLS, ...(saved?.bindings || {}) },
      labels: { ...DEFAULT_LABELS, ...(saved?.labels || {}) }
    };
  } catch {
    return { bindings: { ...DEFAULT_CONTROLS }, labels: { ...DEFAULT_LABELS } };
  }
}
let controlConfig = loadControls();
function saveControls() {
  localStorage.setItem(CONTROL_STORAGE_KEY, JSON.stringify(controlConfig));
}
function keyLabel(event) {
  const named = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space', Escape: 'Esc' };
  if (named[event.key]) return named[event.key];
  if (event.key === 'Shift') return event.location === 2 ? 'Right Shift' : 'Shift';
  if (event.key === 'Control') return event.location === 2 ? 'Right Ctrl' : 'Ctrl';
  if (event.key === 'Alt') return event.location === 2 ? 'Right Alt' : 'Alt';
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
}

// -------------------------------------------------------------------- modals

const modal = $('#modal');
const modalContent = $('#modalContent');
const modalClose = $('#modalClose');
let modalOnClose = null;

function openModal(html, { closable = true, onClose = null } = {}) {
  modalContent.innerHTML = html;
  modal.classList.remove('hidden');
  modalClose.style.display = closable ? 'block' : 'none';
  modal.dataset.closable = closable ? '1' : '0';
  modalOnClose = onClose;
}
function closeModal() {
  if (modal.dataset.closable === '0') return;
  modal.classList.add('hidden');
  const callback = modalOnClose;
  modalOnClose = null;
  callback?.();
}
modalClose.onclick = closeModal;
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });

function choiceModal(title, subtitle, options, choose) {
  openModal(`
    <p class="eyebrow">HIVEBOUND</p>
    <h2>${esc(title)}</h2>
    <p class="muted">${esc(subtitle)}</p>
    <div class="choice-grid">${options.map((option, index) => `
      <button class="choice" data-i="${index}" ${option.color ? `style="border-color:${option.color}66"` : ''}>
        <span class="tag" ${option.color ? `style="color:${option.color}"` : ''}>${esc(option.tag || 'CHOICE')}</span>
        <h3>${esc(option.name)}</h3>
        <p>${esc(option.desc)}</p>
      </button>`).join('')}</div>`, { closable: false });
  $$('.choice').forEach(button => {
    button.onclick = () => {
      const option = options[Number(button.dataset.i)];
      modal.classList.add('hidden');
      choose(option.value);
    };
  });
}

function craftModal(options, choose) {
  openModal(`
    <p class="eyebrow">WAX SHRINE</p>
    <h2>Shape what you carried.</h2>
    <p class="muted">Crafting is intentionally small: every choice should matter to the run.</p>
    <div class="craft-list">${options.map((option, index) => `
      <button class="craft-option" data-i="${index}" ${option.affordable ? '' : 'disabled'}>
        <span><b>${esc(option.name)}</b><small>${esc(option.desc)}</small></span>
        <strong>${costText(option.cost)}</strong>
      </button>`).join('')}</div>`, { closable: false });
  $$('.craft-option').forEach(button => {
    button.onclick = () => {
      const option = options[Number(button.dataset.i)];
      if (!option.affordable) return;
      modal.classList.add('hidden');
      choose(option);
    };
  });
}

function presentOffer(offer) {
  if (offer.kind === 'craft') {
    craftModal(offer.options, choice => game.resolve(choice));
    return;
  }
  const decorate = {
    talent: option => ({ tag: `${option.tag || 'TALENT'} · RANK ${(game.run.state.talents[option.id] || 0) + 1}`, name: option.name, desc: option.desc, value: option }),
    loot: option => ({ tag: `${option.rarity.toUpperCase()} · ${SIGILS[option.sigil].icon} ${option.sigil}`, name: option.name, desc: option.desc, value: option, color: option.color }),
    event: option => ({ tag: option.tag, name: option.name, desc: option.desc, value: option }),
    pact: option => ({ tag: `PACT · +${option.gloam}% GLOAM`, name: option.name, desc: option.desc, value: option })
  }[offer.kind];
  choiceModal(offer.title, offer.subtitle, offer.options.map(decorate), choice => game.resolve(choice));
}

// ---------------------------------------------------------------------- HUD

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2000);
}

function showGladeTitle(glade) {
  const title = $('#gladeTitle');
  title.querySelector('strong').textContent = glade.biome.name;
  title.querySelector('small').textContent = glade.node.title;
  title.classList.add('show');
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => title.classList.remove('show'), 2600);
}

function damageNumber({ screen, amount, crit, hurt }) {
  if (!screen?.visible) return;
  const layer = $('#damageLayer');
  if (layer.childElementCount > 26) layer.firstElementChild?.remove();
  const element = document.createElement('span');
  element.className = `damage-number${crit ? ' crit' : ''}${hurt ? ' hurt' : ''}`;
  element.textContent = hurt ? `-${Math.round(amount)}` : Math.round(amount);
  element.style.left = `${screen.x}px`;
  element.style.top = `${screen.y}px`;
  layer.append(element);
  setTimeout(() => element.remove(), 900);
}

function updateHud(state) {
  const classDef = CLASSES[state.classId];
  $('#classPortrait').textContent = classDef.icon;
  $('#className').textContent = classDef.name;
  $('#hpText').textContent = `${Math.ceil(state.hp)} / ${Math.ceil(state.maxHp)}`;
  $('#hpBar').style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
  $('#levelText').textContent = `LV ${state.level}`;
  $('#xpBar').style.width = `${(state.xp / state.xpNext) * 100}%`;
  $('#nectarCount').textContent = state.materials.nectar;
  $('#waxCount').textContent = state.materials.wax;
  $('#pollenCount').textContent = state.materials.pollen;
  $('#scoreText').textContent = fmt(state.score);
  $('#multiplierText').textContent = `×${state.multiplier.toFixed(2)}`;
  $('#abilityName').textContent = state.ability.name;
  $('#abilityDesc').textContent = state.ability.desc;
  $('#abilityIcon').textContent = classDef.icon;
  $('#abilityKeyLabel').textContent = controlConfig.labels.ability || 'Space';
  $('#dashKeyLabel').textContent = controlConfig.labels.dash || 'Shift';
  $('#regionLabel').textContent = `Region ${state.region} · Gloam ${Math.round(state.gloam)}%`;

  $('#resonances').innerHTML = Object.entries(SIGILS).map(([name, sigil]) => {
    const count = state.sigils[name] || 0;
    return `<div class="resonance ${count >= 2 ? 'active' : ''}" title="${esc(sigil.desc)}"><span style="color:${sigil.color}">${sigil.icon}</span><b>${count}</b></div>`;
  }).join('');

  $('#relics').innerHTML = state.relics.length
    ? state.relics.slice(-6).map(relic => `<span class="relic-chip" style="border-color:${relic.color}55;color:${relic.color}">${SIGILS[relic.sigil].icon} ${esc(relic.name)}</span>`).join('')
    : '<span class="relic-chip muted">No relics yet.</span>';
}

function updateFrame(frame) {
  $('#abilityCd').style.height = `${frame.abilityPct * 100}%`;
  $('#dashCd').style.height = `${frame.dashPct * 100}%`;
  $('#abilitySlot').classList.toggle('ready', frame.abilityPct >= 1);
  $('#dashSlot').classList.toggle('ready', frame.dashPct >= 1);

  const objective = $('#objective');
  if (frame.boss) objective.textContent = 'Defeat the Guardian';
  else if (frame.encounter && !frame.cleared) objective.textContent = `Wave ${Math.max(1, frame.encounter.wave)} / ${frame.encounter.waves}`;
  else if (frame.cleared) objective.textContent = 'Take a gate onward';
  else objective.textContent = 'Explore the glade';

  const bossBar = $('#bossBar');
  bossBar.classList.toggle('hidden', !frame.boss);
  if (frame.boss) {
    $('#bossHp').style.width = `${Math.max(0, (frame.boss.hp / frame.boss.maxHp) * 100)}%`;
    $('#bossName').textContent = frame.boss.name;
    $('#bossPhase').textContent = ['I', 'II', 'III'][frame.boss.phase - 1] || 'I';
  }

  const prompt = $('#prompt');
  if (frame.prompt && frame.promptScreen?.visible) {
    prompt.classList.remove('hidden');
    prompt.style.left = `${frame.promptScreen.x}px`;
    prompt.style.top = `${frame.promptScreen.y}px`;
    prompt.querySelector('kbd').textContent = controlConfig.labels.interact || 'E';
    $('#promptLabel').textContent = frame.prompt.label;
  } else {
    prompt.classList.add('hidden');
  }

  $('#compass').innerHTML = frame.compass.map(mark => `
    <i class="${mark.behind ? 'behind' : ''}" style="left:${50 + mark.offset * 50}%">${mark.icon}<b>${mark.distance}m</b></i>
  `).join('');
}

// --------------------------------------------------------------------- game

const canvas = $('#gameCanvas');
const game = new Hivebound(canvas, {
  onState: updateHud,
  onFrame: updateFrame,
  onToast: toast,
  onOffer: presentOffer,
  onDamage: event => damageNumber(event),
  onPlayerHit: event => {
    const flash = $('#hurtFlash');
    flash.classList.add('on');
    clearTimeout(hurtTimer);
    hurtTimer = setTimeout(() => flash.classList.remove('on'), 90);
    damageNumber({ screen: { x: window.innerWidth / 2, y: window.innerHeight * 0.58, visible: true }, amount: event.amount, hurt: true });
  },
  onGlade: ({ glade }) => {
    $('#biomeLabel').textContent = glade.biome.name;
    $('#nodeLabel').textContent = glade.node.title;
    showGladeTitle(glade);
    toast(glade.biome.lore);
  },
  onInteract: () => game.interact(),
  onEscape: () => togglePause(),
  onEnd: result => showEnd(result)
}, controlConfig.bindings);

function togglePause(force) {
  if (!game.running) return;
  const paused = force ?? !game.paused;
  game.paused = paused;
  $('#pauseOverlay').classList.toggle('hidden', !paused);
  if (!paused) game.last = performance.now();
}

function showEnd(result) {
  lastResult = result;
  game.stop();
  togglePause(false);
  showScreen('endScreen');
  $('#endTitle').textContent = result.bosses
    ? `The Gloam claimed a ${CLASSES[result.classId].name}.`
    : 'The Bloom remembers your first steps.';
  $('#finalScore').textContent = fmt(result.score);
  $('#finalStats').innerHTML = `
    <span>🌿 Region <b>${result.region}</b></span>
    <span>☠ Kills <b>${result.kills}</b></span>
    <span>♛ Bosses <b>${result.bosses}</b></span>
    <span>✦ Level <b>${result.level}</b></span>
    <span>🗝 Secrets <b>${result.secrets || 0}</b></span>
    <span>🌒 Gloam <b>${Math.round(result.gloam)}%</b></span>`;
  $('#submitStatus').textContent = user ? 'Your score can be submitted to the Hive.' : 'Log in to place this run on the leaderboard.';
  $('#submitBtn').textContent = user ? 'Submit Score' : 'Login to Submit';
}

function renderClasses() {
  $('#classGrid').innerHTML = Object.entries(CLASSES).map(([id, classDef]) => `
    <article class="class-card">
      <div class="class-icon">${classDef.icon}</div>
      <span class="role">${classDef.role}</span>
      <h3>${classDef.name}</h3>
      <p>${classDef.description}</p>
      <div class="class-traits">${classDef.traits.map(trait => `<span>✦ ${trait}</span>`).join('')}</div>
      <button class="primary choose-class" data-id="${id}">Choose ${classDef.name}</button>
    </article>`).join('');
  $$('.choose-class').forEach(button => { button.onclick = () => beginRun(button.dataset.id); });
}

async function beginRun(classId) {
  try {
    const run = await api.startRun(pendingDaily);
    showScreen('gameScreen');
    // The canvas only has a size once its screen is visible.
    requestAnimationFrame(() => {
      game.view.resize();
      game.newRun(classId, run.seed, run.runId, run.daily);
      pendingDaily = false;
    });
  } catch (error) {
    // Not an alert(): text outside the document can never be translated.
    showScreen('classScreen');
    toast(translate(`Could not start run: ${error.message}`));
  }
}

// ----------------------------------------------------------------- settings

function applyControlPreset(name) {
  const presets = {
    qwerty: { bindings: { ...DEFAULT_CONTROLS }, labels: { ...DEFAULT_LABELS } },
    azerty: { bindings: { ...DEFAULT_CONTROLS }, labels: { ...DEFAULT_LABELS, up: 'Z', left: 'Q' } },
    arrows: {
      bindings: { ...DEFAULT_CONTROLS, up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
      labels: { ...DEFAULT_LABELS, up: '↑', down: '↓', left: '←', right: '→' }
    }
  };
  controlConfig = { bindings: { ...presets[name].bindings }, labels: { ...presets[name].labels } };
  game.setControls(controlConfig.bindings);
  saveControls();
  renderControls();
}

function renderControls(message = '') {
  modalContent.innerHTML = `
    <p class="eyebrow">CONTROLS</p>
    <h2>Make the Hive yours.</h2>
    <p class="muted">Click a binding, then press the key you want. Escape cancels. Move with the keyboard, aim with the mouse, hold left click to attack, right-drag to turn the camera.</p>
    <div class="control-list">${Object.entries(CONTROL_ACTIONS).map(([action, label]) => `
      <div class="control-row"><span>${esc(label)}</span>
      <button class="secondary control-bind" data-action="${action}">${esc(controlConfig.labels[action] || controlConfig.bindings[action])}</button></div>`).join('')}</div>
    <div class="control-presets">
      <button class="ghost control-preset" data-preset="qwerty">WASD</button>
      <button class="ghost control-preset" data-preset="azerty">ZQSD</button>
      <button class="ghost control-preset" data-preset="arrows">Arrows</button>
    </div>
    <p id="controlMessage" class="muted">${esc(message)}</p>`;

  $$('.control-preset').forEach(button => { button.onclick = () => applyControlPreset(button.dataset.preset); });
  $$('.control-bind').forEach(button => {
    button.onclick = () => {
      const action = button.dataset.action;
      button.textContent = 'Press a key…';
      button.classList.add('listening');
      const capture = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.code === 'Escape') { renderControls('Binding unchanged.'); return; }
        const conflict = Object.entries(controlConfig.bindings).find(([other, code]) => other !== action && code === event.code);
        if (conflict) { renderControls(`${keyLabel(event)} is already assigned to ${CONTROL_ACTIONS[conflict[0]]}.`); return; }
        controlConfig.bindings[action] = event.code;
        controlConfig.labels[action] = keyLabel(event);
        game.setControls(controlConfig.bindings);
        saveControls();
        renderControls(`${CONTROL_ACTIONS[action]} → ${controlConfig.labels[action]}`);
      };
      addEventListener('keydown', capture, { once: true, capture: true });
    };
  });
}

function openControls() {
  const wasPaused = game.paused;
  if (game.running) game.paused = true;
  openModal('', { onClose: () => { if (game.running) { game.paused = wasPaused; game.last = performance.now(); } } });
  renderControls();
}

function syncQualityButtons() {
  $$('.quality').forEach(button => button.classList.toggle('active', button.dataset.quality === game.view.quality));
  $('#audioBtn').textContent = game.audio.enabled ? '🔊' : '🔇';
}

// ----------------------------------------------------------------- account

function openAuth() {
  if (user) {
    openModal(`
      <p class="eyebrow">HIVE PROFILE</p>
      <h2>${esc(user.username)}</h2>
      <p class="muted">Best score: ${fmt(user.bestScore || 0)} · Hive essence: ${fmt(user.essence || 0)}</p>
      <button class="secondary" id="logoutBtn">Log out</button>`);
    $('#logoutBtn').onclick = () => {
      api.token = '';
      user = null;
      refreshAccount();
      modal.classList.add('hidden');
    };
    return;
  }
  openModal(`
    <p class="eyebrow">HIVE ACCOUNT</p>
    <h2>Carry your scores between games.</h2>
    <div class="auth-grid">
      <form id="loginForm"><h3>Login</h3>
        <input name="username" placeholder="Username" required>
        <input name="password" type="password" placeholder="Password" required>
        <button class="primary">Enter the Hive</button></form>
      <form id="registerForm"><h3>Create account</h3>
        <input name="username" minlength="3" maxlength="24" placeholder="Username" required>
        <input name="password" minlength="6" type="password" placeholder="Password" required>
        <button class="secondary">Create</button></form>
    </div>
    <p id="authError" class="muted"></p>`);
  $('#loginForm').onsubmit = event => authSubmit(event, 'login');
  $('#registerForm').onsubmit = event => authSubmit(event, 'register');
}

async function authSubmit(event, mode) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    user = await api[mode](data.get('username'), data.get('password'));
    refreshAccount();
    modal.classList.add('hidden');
    if (lastResult) showEnd(lastResult);
  } catch (error) {
    $('#authError').textContent = error.message;
  }
}

function refreshAccount() {
  $('#accountBtn').textContent = user ? `🐝 ${user.username}` : 'Guest';
}

async function openLeaderboard(daily = false) {
  openModal(`
    <p class="eyebrow">GLOBAL HIVE</p>
    <h2>Leaderboard</h2>
    <div class="leaderboard-toggle">
      <button id="allScores" class="secondary ${daily ? '' : 'active'}">All-time</button>
      <button id="dailyScores" class="secondary ${daily ? 'active' : ''}">Daily Hive</button>
    </div>
    <div id="leaderboardBody"><p class="muted">Loading…</p></div>`);
  $('#allScores').onclick = () => openLeaderboard(false);
  $('#dailyScores').onclick = () => openLeaderboard(true);
  try {
    const scores = await api.leaderboard(daily);
    $('#leaderboardBody').innerHTML = scores.length
      ? `<table class="leaderboard"><thead><tr><th>#</th><th>Player</th><th>Class</th><th>Region</th><th>Score</th></tr></thead><tbody>${
        scores.map(score => `<tr><td>${score.rank}</td><td>${esc(score.username)}</td><td>${esc(CLASSES[score.classId]?.name || score.classId)}</td><td>${score.region}</td><td><b>${fmt(score.score)}</b></td></tr>`).join('')
      }</tbody></table>`
      : '<p class="muted">No score yet. The first legend could be you.</p>';
  } catch (error) {
    $('#leaderboardBody').innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

// ------------------------------------------------------------------- wiring

$('#newRunBtn').onclick = () => { pendingDaily = false; showScreen('classScreen'); };
$('#dailyRunBtn').onclick = () => { pendingDaily = true; showScreen('classScreen'); };
$$('.back-home').forEach(button => { button.onclick = () => showScreen('homeScreen'); });
$('#leaderboardBtn').onclick = () => openLeaderboard(false);
$('#settingsBtn').onclick = openControls;
$('#accountBtn').onclick = openAuth;
$('#againBtn').onclick = () => { pendingDaily = false; showScreen('classScreen'); };
$('#resumeBtn').onclick = () => togglePause(false);
$('#pauseControlsBtn').onclick = openControls;
$('#quitBtn').onclick = () => {
  if (!game.run) return;
  const result = game.run.result();
  showEnd(result);
};
$$('.quality').forEach(button => {
  button.onclick = () => { game.setQuality(button.dataset.quality); syncQualityButtons(); };
});
$('#audioBtn').onclick = () => { game.audio.start(); game.audio.toggle(); syncQualityButtons(); };

$('#submitBtn').onclick = async () => {
  if (!lastResult) return;
  if (!user) { openAuth(); return; }
  const button = $('#submitBtn');
  button.disabled = true;
  try {
    const response = await api.submitScore(lastResult);
    user = response.user;
    refreshAccount();
    $('#submitStatus').textContent = `Score submitted. Your best: ${fmt(user.bestScore)}.`;
    button.textContent = 'Submitted ✓';
  } catch (error) {
    $('#submitStatus').textContent = error.message;
    button.disabled = false;
  }
};

renderClasses();
syncQualityButtons();
(async () => {
  if (api.token) {
    try { user = await api.me(); } catch { api.token = ''; }
  }
  refreshAccount();
})();

// Automated smoke tests drive the game through this handle; it only exists
// when the page is opened with ?debug=1.
if (new URLSearchParams(location.search).has('debug')) window.__hivebound = game;
