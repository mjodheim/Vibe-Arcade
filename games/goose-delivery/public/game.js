'use strict';

// GOOSE DELIVERY — rendering, input (keyboard + touch joystick), audio and the
// arcade cabinet wiring. Rules live in logic.js.
(() => {
  const G = window.GooseLogic;
  const {W, H} = G;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const screen = document.querySelector('.cab-screen');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;

  const ui = {score:$('score'), clock:$('clock'), deliveries:$('deliveries'), combo:$('combo'), start:$('startPanel'), over:$('overPanel'),
    death:$('deathLine'), final:$('finalScore'), finalStats:$('finalStats'), pause:$('pauseBtn'), sound:$('soundBtn'), honk:$('honkBtn')};

  const STEP = 16;
  let stepAcc = 0;
  let game = null, running = false, paused = false, daily = false, last = 0, demo = true;
  let sound = true, audio = null;
  const fx = {rings:[], texts:[], dust:[], flash:0, flashColor:'#fff', shakeUntil:0};
  const pad = n => String(Math.floor(n)).padStart(6, '0');

  // ------------------------------------------------------------ audio
  function tone(freq, dur = .08, type = 'square', gain = .03, when = 0, slide = 0){
    if(!sound) return;
    try{
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if(audio.state === 'suspended') audio.resume();
      const t = audio.currentTime + when, o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + .02);
    }catch{ /* no audio */ }
  }
  const sfx = {
    honk: () => { tone(330, .22, 'sawtooth', .08, 0, -60); tone(342, .22, 'square', .04, 0, -70); },
    pickup: () => tone(520, .08, 'triangle', .05, 0, 200),
    deliver: combo => [523, 659, 784, 1046, 1318, 1568].slice(0, 2 + Math.min(4, combo)).forEach((f, i) => tone(f, .12, 'triangle', .05, i * .06)),
    baguette: () => tone(880, .1, 'triangle', .05),
    drop: () => tone(200, .25, 'square', .05, 0, -120),
    car: () => { tone(420, .3, 'square', .06); tone(80, .5, 'sawtooth', .07, .05, -40); },
    siren: () => [880, 660, 880, 660].forEach((f, i) => tone(f, .18, 'sine', .04, i * .2)),
    slip: () => tone(600, .4, 'sine', .05, 0, -450),
    tick: () => tone(1200, .04, 'square', .02)
  };

  // ------------------------------------------------------------ input
  const keys = new Set();
  const KEYMAP = {ArrowUp:'u', ArrowDown:'d', ArrowLeft:'l', ArrowRight:'r', w:'u', z:'u', s:'d', a:'l', q:'l', d:'r'};
  let honkQueued = false;
  document.addEventListener('keydown', e => {
    if(e.target.closest?.('.va-auth')) return;
    if((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && running){ togglePause(); return; }
    if(e.key === ' ' || e.key === 'Shift' || e.key === 'k' || e.key === 'K'){ if(running) e.preventDefault(); if(!e.repeat) honkQueued = true; return; }
    const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()];
    if(k){ keys.add(k); if(running) e.preventDefault(); }
  });
  document.addEventListener('keyup', e => { const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()]; if(k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());

  // Touch: drag anywhere on the map as a floating joystick.
  let stick = null;
  canvas.addEventListener('pointerdown', e => {
    if(e.pointerType === 'mouse') return;
    stick = {id:e.pointerId, ox:e.clientX, oy:e.clientY, x:0, y:0};
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if(!stick || e.pointerId !== stick.id) return;
    const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, len = Math.hypot(dx, dy);
    const max = 46;
    stick.x = len > 6 ? dx / Math.max(len, max) : 0;
    stick.y = len > 6 ? dy / Math.max(len, max) : 0;
    if(len > max){ stick.ox = e.clientX - dx / len * max; stick.oy = e.clientY - dy / len * max; }
  });
  const endStick = e => { if(stick && e.pointerId === stick.id) stick = null; };
  canvas.addEventListener('pointerup', endStick); canvas.addEventListener('pointercancel', endStick);
  ui.honk.addEventListener('pointerdown', e => { e.preventDefault(); honkQueued = true; });

  function readInput(){
    let x = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
    let y = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
    if(stick){ x = stick.x; y = stick.y; }
    const honk = honkQueued; honkQueued = false;
    return {x, y, honk};
  }

  // ------------------------------------------------------------ lifecycle
  // Daily seed from the UTC day handed over by the arcade cabinet (the server's
  // day when online), so everyone plays the same board.
  function daySeed(day){
    const k = `${day}:goose`;
    let h = 2166136261; for(const ch of k){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0;
  }
  function start(isDaily, day){
    daily = isDaily; demo = false;
    game = G.newGame(isDaily ? daySeed(day) : crypto.getRandomValues(new Uint32Array(1))[0]);
    running = true; paused = false; keys.clear(); honkQueued = false;
    fx.rings = []; fx.texts = []; fx.dust = []; fx.flash = 0;
    ui.start.hidden = true; ui.over.hidden = true; ui.pause.textContent = 'PAUSE';
    last = performance.now(); stepAcc = 0;
  }
  const LINES = [
    'La tournée est terminée. Le client aussi.', 'Colis livré en retard. L’oie n’a aucun regret.',
    'Service client : « HONK ».', 'L’entreprise vous remercie pour votre chaos.'
  ];
  function gameOver(){
    running = false;
    sfx.drop();
    ui.death.textContent = LINES[Math.floor(Math.random() * LINES.length)];
    ui.final.textContent = pad(game.score);
    ui.finalStats.textContent = `${game.deliveries} colis livré${game.deliveries > 1 ? 's' : ''} · série max ×${game.bestCombo} · ${(game.time / 1000).toFixed(0)} s de tournée`;
    setTimeout(() => { ui.over.hidden = false; }, 700);
    cabinet.finish(game.score);
  }
  function togglePause(){
    if(!running) return;
    paused = !paused;
    ui.pause.textContent = paused ? 'REPRENDRE' : 'PAUSE';
    keys.clear();
    if(!paused) last = performance.now();
  }
  ui.pause.addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => { if(document.hidden && running && !paused) togglePause(); });
  ui.sound.addEventListener('click', () => {
    sound = !sound;
    ui.sound.textContent = `SON : ${sound ? 'ON' : 'OFF'}`;
    ui.sound.setAttribute('aria-pressed', String(sound));
  });

  const cabinet = window.ArcadeCabinet.create({
    game:'goose-delivery', start, chip:$('accountChip'),
    playerLine:$('playerLine'), status:$('scoreStatus'), board:$('leaderboard'),
    tabs:[...document.querySelectorAll('[data-board]')]
  });
  $('startBtn').addEventListener('click', () => cabinet.play(false));
  $('dailyBtn').addEventListener('click', () => cabinet.play(true));
  $('againBtn').addEventListener('click', () => cabinet.play(false));
  $('againDailyBtn').addEventListener('click', () => cabinet.play(true));

  // ------------------------------------------------------------ events → juice
  function floatText(x, y, text, color, size = 16){ fx.texts.push({x, y, text, color, size, life:1}); }
  function dust(x, y, color, n = 12, speed = 100){
    for(let i = 0; i < n; i++){ const a = Math.random() * Math.PI * 2, v = speed * (.3 + Math.random() * .7); fx.dust.push({x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:1, color}); }
  }
  function consumeEvents(){
    for(const e of game.events){
      if(e.type === 'honk'){ fx.rings.push({x:e.x, y:e.y, t:0}); floatText(e.x, e.y - 30, 'HONK!', '#ffffff', 22); if(!demo) sfx.honk(); }
      if(e.type === 'pickup'){ floatText(e.x, e.y - 26, 'COLIS !', '#ffd166'); if(!demo) sfx.pickup(); }
      if(e.type === 'deliver'){
        dust(e.x, e.y, '#b9ff66', 26, 160);
        floatText(e.x, e.y - 30, `+${e.points}  +${(e.bonus / 1000).toFixed(1)}s`, '#b9ff66', 18);
        if(e.combo > 1) floatText(e.x, e.y - 52, `SÉRIE ×${e.combo}`, '#ffd166', 14);
        if(!demo) sfx.deliver(e.combo);
      }
      if(e.type === 'baguette'){ floatText(e.x, e.y - 20, '+50 🥖 +1.5s', '#ffd9a8'); if(!demo) sfx.baguette(); }
      if(e.type === 'drop' && !demo) sfx.drop();
      if(e.type === 'bump') floatText(e.x, e.y - 30, 'AÏE, LE COLIS', '#ff9d6b');
      if(e.type === 'car'){ floatText(e.x, e.y - 30, 'SPLAT −5s', '#ff4d5e', 20); fx.flash = .5; fx.flashColor = '#ff4d5e'; fx.shakeUntil = performance.now() + 350; if(!demo) sfx.car(); }
      if(e.type === 'cop'){ floatText(e.x, e.y - 30, '🚨 POLICE', '#43efff', 18); if(!demo) sfx.siren(); }
      if(e.type === 'copSlip'){ floatText(e.x, e.y - 30, 'GLISSADE !', '#43efff'); if(!demo) sfx.slip(); }
      if(e.type === 'arrest'){ floatText(e.x, e.y - 30, 'ARRÊTÉE −8s', '#43efff', 20); fx.flash = .4; fx.flashColor = '#43efff'; fx.shakeUntil = performance.now() + 300; }
      if(e.type === 'copLeaves') floatText(e.x, e.y - 30, 'bon… ça va pour cette fois', '#9aa4bd', 12);
    }
    game.events.length = 0;
  }

  // ------------------------------------------------------------ static town
  const town = document.createElement('canvas');
  town.width = W * dpr; town.height = H * dpr;
  (() => {
    const g = town.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#2f6b3a'; g.fillRect(0, 0, W, H);
    for(let i = 0; i < 900; i++){ g.fillStyle = Math.random() < .5 ? 'rgba(120,200,110,.12)' : 'rgba(0,0,0,.08)'; g.fillRect(Math.random() * W, Math.random() * H, 2, 3); }
    // pavements
    g.fillStyle = '#b8b2a3';
    g.fillRect(0, G.ROAD_H.y1 - 22, W, 22); g.fillRect(0, G.ROAD_H.y2, W, 22);
    g.fillRect(G.ROAD_V.x1 - 22, 0, 22, H); g.fillRect(G.ROAD_V.x2, 0, 22, H);
    for(const h of G.HOUSES){ g.fillRect(h.x - 10, h.y - 10, h.w + 20, h.h + 20); g.fillRect(h.doorX - 14, Math.min(h.doorY, h.y + h.h / 2) - 4, 28, Math.abs(h.doorY - (h.y + h.h / 2)) + 12); }
    g.strokeStyle = 'rgba(0,0,0,.1)';
    for(let x = 0; x < W; x += 22){ g.beginPath(); g.moveTo(x, G.ROAD_H.y1 - 22); g.lineTo(x, G.ROAD_H.y1); g.moveTo(x, G.ROAD_H.y2); g.lineTo(x, G.ROAD_H.y2 + 22); g.stroke(); }
    // roads
    g.fillStyle = '#34363d';
    g.fillRect(0, G.ROAD_H.y1, W, G.ROAD_H.y2 - G.ROAD_H.y1);
    g.fillRect(G.ROAD_V.x1, 0, G.ROAD_V.x2 - G.ROAD_V.x1, H);
    g.strokeStyle = '#f2d15a'; g.lineWidth = 3; g.setLineDash([22, 18]);
    g.beginPath(); g.moveTo(0, (G.ROAD_H.y1 + G.ROAD_H.y2) / 2); g.lineTo(G.ROAD_V.x1, (G.ROAD_H.y1 + G.ROAD_H.y2) / 2);
    g.moveTo(G.ROAD_V.x2, (G.ROAD_H.y1 + G.ROAD_H.y2) / 2); g.lineTo(W, (G.ROAD_H.y1 + G.ROAD_H.y2) / 2);
    g.moveTo((G.ROAD_V.x1 + G.ROAD_V.x2) / 2, 0); g.lineTo((G.ROAD_V.x1 + G.ROAD_V.x2) / 2, G.ROAD_H.y1);
    g.moveTo((G.ROAD_V.x1 + G.ROAD_V.x2) / 2, G.ROAD_H.y2); g.lineTo((G.ROAD_V.x1 + G.ROAD_V.x2) / 2, H); g.stroke(); g.setLineDash([]);
    // crosswalks
    g.fillStyle = 'rgba(255,255,255,.75)';
    for(let i = 0; i < 6; i++){
      g.fillRect(G.ROAD_V.x1 - 36, G.ROAD_H.y1 + 6 + i * 12, 30, 7); g.fillRect(G.ROAD_V.x2 + 6, G.ROAD_H.y1 + 6 + i * 12, 30, 7);
      g.fillRect(G.ROAD_V.x1 + 6 + i * 12, G.ROAD_H.y1 - 36, 7, 30); g.fillRect(G.ROAD_V.x1 + 6 + i * 12, G.ROAD_H.y2 + 6, 7, 30);
    }
    // houses: top-down roofs
    for(const h of G.HOUSES){
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(h.x + 8, h.y + 10, h.w, h.h);
      g.fillStyle = h.roof; g.fillRect(h.x, h.y, h.w, h.h);
      const mid = h.y + h.h / 2;
      g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(h.x + h.w, h.y); g.lineTo(h.x + h.w - 24, mid); g.lineTo(h.x + 24, mid); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(h.x, h.y + h.h); g.lineTo(h.x + h.w, h.y + h.h); g.lineTo(h.x + h.w - 24, mid); g.lineTo(h.x + 24, mid); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(h.x + 24, mid); g.lineTo(h.x + h.w - 24, mid); g.stroke();
      g.fillStyle = '#6a6f7a'; g.fillRect(h.x + h.w - 38, h.y + 16, 16, 16); // chimney
      g.fillStyle = '#ffffff'; g.font = '900 20px ui-monospace,Menlo,monospace'; g.textAlign = 'center'; g.fillText(h.id, h.x + h.w / 2, mid + 7);
      // mailbox
      g.fillStyle = '#2b2f3a'; g.fillRect(h.doorX + 18, h.doorY - 6, 10, 12); g.fillStyle = '#ff4d5e'; g.fillRect(h.doorX + 18, h.doorY - 8, 10, 4);
    }
    g.textAlign = 'start';
  })();

  // ------------------------------------------------------------ sprites
  function drawGoose(g, t){
    const moving = Math.hypot(g.vx, g.vy) > 20;
    const honking = game.time - g.honkAt < 280;
    ctx.save(); ctx.translate(g.x, g.y);
    if(g.invuln && Math.floor(t / 90) % 2) ctx.globalAlpha = .45;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(4, 8, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(g.face);
    if(g.squashed){ ctx.scale(1.5, .45); }
    const waddle = moving ? Math.sin(t / 60) * .12 : 0;
    ctx.rotate(waddle);
    // feet
    ctx.fillStyle = '#ff9d3d';
    if(moving){ const f = Math.sin(t / 60) * 5; ctx.fillRect(-4 + f, -9, 7, 4); ctx.fillRect(-4 - f, 5, 7, 4); }
    // body
    const body = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18);
    body.addColorStop(0, '#ffffff'); body.addColorStop(1, '#d6dbe6');
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-2, 0, 16, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c3c9d6'; ctx.beginPath(); ctx.ellipse(-6, -6, 9, 4, -.3, 0, Math.PI * 2); ctx.ellipse(-6, 6, 9, 4, .3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e6e9f0'; ctx.beginPath(); ctx.moveTo(-17, -4); ctx.lineTo(-24, 0); ctx.lineTo(-17, 4); ctx.fill();
    // neck & head, stretched while honking
    const neck = honking ? 22 : 14;
    ctx.strokeStyle = '#f4f6fb'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(neck, 0); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(neck + 3, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9d3d';
    if(honking){ ctx.beginPath(); ctx.moveTo(neck + 8, -3); ctx.lineTo(neck + 17, -6); ctx.lineTo(neck + 9, 0); ctx.lineTo(neck + 17, 6); ctx.lineTo(neck + 8, 3); ctx.fill(); }
    else{ ctx.beginPath(); ctx.moveTo(neck + 8, -3); ctx.lineTo(neck + 15, 0); ctx.lineTo(neck + 8, 3); ctx.fill(); }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(neck + 4, -3, 1.5, 0, Math.PI * 2); ctx.arc(neck + 4, 3, 1.5, 0, Math.PI * 2); ctx.fill();
    // the parcel, held in the beak
    if(g.carrying){ ctx.fillStyle = '#b8793d'; ctx.fillRect(neck + 10, -8, 14, 16); ctx.strokeStyle = '#f2d15a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(neck + 17, -8); ctx.lineTo(neck + 17, 8); ctx.stroke(); }
    ctx.restore();
    if(g.stun && !g.squashed){ ctx.fillStyle = '#ffd166'; ctx.font = '12px sans-serif'; ctx.fillText('💫', g.x - 7, g.y - 20); }
  }

  function drawPed(p, t){
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(3, 5, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    const bob = p.flee ? Math.sin(t / 40) * 2 : 0;
    ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.ellipse(0, bob, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39e'; ctx.beginPath(); ctx.arc(0, bob, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(0, bob - 1, 4.5, Math.PI, 0); ctx.fill();
    if(p.baguette){ ctx.save(); ctx.rotate(.7); ctx.fillStyle = '#d9a35b'; ctx.fillRect(6, -2, 20, 5); ctx.restore(); }
    ctx.restore();
    if(p.flee){ ctx.fillStyle = '#fff'; ctx.font = '900 12px ui-monospace,monospace'; ctx.fillText('!!', p.x - 5, p.y - 14); }
  }

  function drawCop(c, t){
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(3, 5, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
    if(c.stun) ctx.rotate(Math.sin(t / 50) * .6);
    ctx.fillStyle = '#1f3a8a'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39e'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f1f55'; ctx.beginPath(); ctx.arc(0, 0, 6.5, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
    ctx.fillStyle = Math.floor(t / 150) % 2 ? '#43efff' : '#ff4d5e'; ctx.beginPath(); ctx.arc(0, -12, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if(c.stun){ ctx.fillStyle = '#43efff'; ctx.font = '12px sans-serif'; ctx.fillText('💫', c.x - 7, c.y - 20); }
  }

  function drawCar(c){
    ctx.save(); ctx.translate(c.x, c.y);
    if(!c.horizontal) ctx.rotate(Math.PI / 2);
    const dir = c.horizontal ? Math.sign(c.vx) : Math.sign(c.vy);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-28, -12, 60, 30);
    ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-30, -15, 60, 30, 7) : ctx.rect(-30, -15, 60, 30); ctx.fill();
    ctx.fillStyle = 'rgba(20,30,50,.75)'; ctx.fillRect(dir > 0 ? 6 : -18, -11, 12, 22); ctx.fillRect(dir > 0 ? -18 : 8, -10, 9, 20);
    ctx.fillStyle = '#fff6a8'; ctx.fillRect(dir > 0 ? 27 : -30, -12, 3, 6); ctx.fillRect(dir > 0 ? 27 : -30, 6, 3, 6);
    ctx.restore();
  }

  function drawObjective(t){
    const g = game.goose;
    const goal = g.carrying ? {x:game.target.doorX, y:game.target.doorY} : game.parcel;
    if(!goal) return;
    // pulsing marker
    const r = 18 + Math.sin(t / 150) * 4;
    ctx.strokeStyle = g.carrying ? '#b9ff66' : '#ffd166'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(goal.x, goal.y, r, 0, Math.PI * 2); ctx.stroke();
    if(!g.carrying){
      ctx.save(); ctx.translate(game.parcel.x, game.parcel.y + Math.sin(t / 200) * 2);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-9, -5, 22, 16);
      ctx.fillStyle = '#b8793d'; ctx.fillRect(-11, -9, 22, 18);
      ctx.strokeStyle = '#f2d15a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke();
      ctx.restore();
    }else{
      ctx.fillStyle = '#b9ff66'; ctx.font = '900 13px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      ctx.fillText(`LIVRER → ${game.target.id}`, goal.x, goal.y + (game.target.door === 'bottom' ? 38 : -30)); ctx.textAlign = 'start';
    }
    // compass arrow around the goose
    const a = Math.atan2(goal.y - g.y, goal.x - g.x), d = Math.hypot(goal.y - g.y, goal.x - g.x);
    if(d > 70){
      ctx.save(); ctx.translate(g.x + Math.cos(a) * 34, g.y + Math.sin(a) * 34); ctx.rotate(a);
      ctx.fillStyle = g.carrying ? '#b9ff66' : '#ffd166';
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -7); ctx.lineTo(-2, 0); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function draw(t, dt){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if(performance.now() < fx.shakeUntil) ctx.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);
    ctx.drawImage(town, 0, 0, W, H);
    for(const it of game.items){
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(.6 + Math.sin(t / 300) * .1);
      ctx.fillStyle = '#d9a35b'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-14, -3.5, 28, 7, 3) : ctx.rect(-14, -3.5, 28, 7); ctx.fill();
      ctx.strokeStyle = '#a8742e'; ctx.lineWidth = 1.2; for(const k of [-7, 0, 7]){ ctx.beginPath(); ctx.moveTo(k - 2, -3); ctx.lineTo(k + 2, 3); ctx.stroke(); }
      ctx.restore();
    }
    drawObjective(t);
    game.peds.forEach(p => drawPed(p, t));
    if(game.cop) drawCop(game.cop, t);
    drawGoose(game.goose, t);
    game.cars.forEach(drawCar);

    const s = dt / 1000;
    fx.rings = fx.rings.filter(r => (r.t += s * 2.2) < 1);
    for(const r of fx.rings){
      ctx.strokeStyle = `rgba(255,255,255,${1 - r.t})`; ctx.lineWidth = 4 * (1 - r.t) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, G.HONK_RADIUS * r.t, 0, Math.PI * 2); ctx.stroke();
    }
    fx.dust = fx.dust.filter(d => (d.life -= s * 1.4) > 0);
    for(const d of fx.dust){ d.x += d.vx * s; d.y += d.vy * s; d.vx *= .94; d.vy *= .94; ctx.globalAlpha = d.life; ctx.fillStyle = d.color; ctx.fillRect(d.x, d.y, 4, 4); }
    ctx.globalAlpha = 1;
    fx.texts = fx.texts.filter(x => (x.life -= s * .9) > 0);
    ctx.textAlign = 'center';
    for(const x of fx.texts){
      ctx.globalAlpha = Math.min(1, x.life * 1.6); ctx.fillStyle = x.color; ctx.font = `900 ${x.size}px ui-monospace,Menlo,monospace`;
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4; ctx.strokeText(x.text, x.x, x.y - (1 - x.life) * 34); ctx.fillText(x.text, x.x, x.y - (1 - x.life) * 34);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'start';

    // the clock, big and nervous when it runs low
    if(!demo){
      const secs = game.timeLeft / 1000, low = secs < 10;
      ctx.textAlign = 'center'; ctx.font = `900 ${low ? 34 + Math.sin(t / 80) * 3 : 28}px ui-monospace,Menlo,monospace`;
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 6; ctx.strokeText(secs.toFixed(1), W / 2, 40);
      ctx.fillStyle = low ? '#ff4d5e' : '#ffffff'; ctx.fillText(secs.toFixed(1), W / 2, 40); ctx.textAlign = 'start';
      // nuisance meter
      const n = Math.min(1, game.nuisance / 60);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(W - 170, 16, 150, 12);
      ctx.fillStyle = n > .75 ? '#ff4d5e' : '#43efff'; ctx.fillRect(W - 170, 16, 150 * n, 12);
      ctx.fillStyle = '#fff'; ctx.font = '800 10px ui-monospace,Menlo,monospace'; ctx.fillText(game.cop ? '🚨 POLICE EN CHASSE' : 'NUISANCE', W - 170, 42);
    }
    if(stick){
      const r = canvas.getBoundingClientRect();
      const ox = (stick.ox - r.left) / r.width * W, oy = (stick.oy - r.top) / r.height * H;
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, oy, 46 * W / r.width, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(ox + stick.x * 46 * W / r.width, oy + stick.y * 46 * W / r.width, 16, 0, Math.PI * 2); ctx.fill();
    }
    if(paused){
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = '900 34px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      ctx.fillText('PAUSE', W / 2, H / 2); ctx.textAlign = 'start';
    }
    if(fx.flash > 0){ ctx.globalAlpha = fx.flash; ctx.fillStyle = fx.flashColor; ctx.fillRect(-10, -10, W + 20, H + 20); ctx.globalAlpha = 1; fx.flash = Math.max(0, fx.flash - s * 2.2); }
  }

  let lastTick = 0;
  function hud(){
    ui.score.textContent = pad(demo ? 0 : game.score);
    ui.clock.textContent = demo ? '60.0s' : `${(game.timeLeft / 1000).toFixed(1)}s`;
    ui.deliveries.textContent = demo ? 0 : game.deliveries;
    ui.combo.textContent = `×${demo ? 0 : game.bestCombo}`;
    if(running && !paused && game.timeLeft < 5000){
      const sec = Math.ceil(game.timeLeft / 1000);
      if(sec !== lastTick){ lastTick = sec; sfx.tick(); }
    }
  }

  // Attract mode: a goose that knows exactly where it is going (mostly).
  function demoInput(){
    const g = game.goose;
    const goal = g.carrying ? {x:game.target.doorX, y:game.target.doorY} : game.parcel;
    const out = {x:0, y:0, honk:Math.random() < .006};
    if(goal){ const dx = goal.x - g.x, dy = goal.y - g.y, l = Math.hypot(dx, dy) || 1; out.x = dx / l; out.y = dy / l; }
    return out;
  }

  function frame(t){
    const dt = Math.min(50, t - last || 16);
    last = t;
    if(demo){
      G.update(game, dt, demoInput()); consumeEvents();
      if(game.over || game.time > 40000) game = G.newGame(Math.floor(Math.random() * 1e9));
    }else if(running && !paused){
      // Fixed 16 ms steps: the seeded daily run must not depend on the display's frame rate.
      const input = readInput();
      stepAcc += dt;
      let first = true;
      while(stepAcc >= STEP && !game.over){ G.update(game, STEP, first ? input : {...input, honk:false}); first = false; stepAcc -= STEP; }
      if(first && input.honk) honkQueued = true; // no step ran this frame: keep the honk for the next one
      consumeEvents();
      if(game.over) gameOver();
    }
    draw(t, dt);
    hud();
    requestAnimationFrame(frame);
  }

  game = G.newGame(99);
  window.GooseDelivery = {snapshot: () => ({running, over:game.over, score:game.score, deliveries:game.deliveries, timeLeft:game.timeLeft, goose:{x:game.goose.x, y:game.goose.y, carrying:game.goose.carrying}, parcel:game.parcel, target:game.target && {x:game.target.doorX, y:game.target.doorY}})};
  requestAnimationFrame(t => { last = t; frame(t); });
})();
