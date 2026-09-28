'use strict';

// PIGEON CONTROL — rendering, route drawing (mouse + multi-touch), audio and
// the arcade cabinet wiring. Rules live in logic.js.
(() => {
  const P = window.PigeonLogic;
  const {W, H} = P;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const screen = document.querySelector('.cab-screen');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;

  const ui = {score:$('score'), landed:$('landed'), streak:$('streak'), time:$('time'), start:$('startPanel'), over:$('overPanel'),
    death:$('deathLine'), final:$('finalScore'), finalStats:$('finalStats'), pause:$('pauseBtn'), sound:$('soundBtn')};

  let game = null, running = false, paused = false, daily = false, last = 0, bestStreak = 0, demo = true;
  let sound = true, audio = null;
  const fx = {feathers:[], texts:[], ripples:[], flash:0, flashColor:'#fff', crashAt:0};
  const drawing = new Map(); // pointerId -> {id, points}
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
    coo: () => { tone(420, .09, 'sine', .05, 0, -120); tone(360, .14, 'sine', .05, .1, -100); },
    land: streak => [523, 659, 784, 1046, 1318].slice(0, 1 + Math.min(4, streak)).forEach((f, i) => tone(f, .1, 'triangle', .04, i * .05)),
    pick: () => tone(700, .04, 'square', .02),
    gull: () => { tone(1200, .25, 'sawtooth', .03, 0, -500); tone(1100, .25, 'sawtooth', .03, .3, -500); },
    bread: () => [880, 988, 1175].forEach((f, i) => tone(f, .1, 'triangle', .03, i * .08)),
    crash: () => { tone(200, .6, 'sawtooth', .08, 0, -170); tone(60, .8, 'square', .06, .05); }
  };

  // ------------------------------------------------------------ input
  function toWorld(e){
    const r = canvas.getBoundingClientRect();
    return {x:(e.clientX - r.left) / r.width * W, y:(e.clientY - r.top) / r.height * H};
  }
  canvas.addEventListener('pointerdown', e => {
    if(!running || paused) return;
    const pt = toWorld(e);
    const p = P.pickPigeon(game, pt.x, pt.y, e.pointerType === 'touch' ? 30 : 18);
    if(!p) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    drawing.set(e.pointerId, {id:p.id, points:[]});
    sfx.pick();
  });
  canvas.addEventListener('pointermove', e => {
    const d = drawing.get(e.pointerId);
    if(!d || !running) return;
    const pt = toWorld(e);
    const prev = d.points[d.points.length - 1];
    if(prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 9) return;
    if(d.points.length > 500) return;
    d.points.push(pt);
    const target = P.setPath(game, d.id, d.points);
    // Snap the end into the monument once the route reaches the right one.
    if(target){
      const st = P.STATUES.find(s => s.id === target);
      d.points.push({x:st.x, y:st.y});
      P.setPath(game, d.id, d.points);
      drawing.delete(e.pointerId);
      sfx.coo();
    }
  });
  const stop = e => drawing.delete(e.pointerId);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  document.addEventListener('keydown', e => {
    if(e.target.closest?.('.va-auth')) return;
    if((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && running) togglePause();
  });

  // ------------------------------------------------------------ lifecycle
  function todaySeed(){
    const d = new Date(), k = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}:pigeon`;
    let h = 2166136261; for(const ch of k){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0;
  }
  function start(isDaily){
    daily = isDaily; demo = false;
    game = P.newGame(isDaily ? todaySeed() : crypto.getRandomValues(new Uint32Array(1))[0]);
    running = true; paused = false; bestStreak = 0; drawing.clear();
    fx.feathers = []; fx.texts = []; fx.ripples = []; fx.flash = 0;
    ui.start.hidden = true; ui.over.hidden = true; ui.pause.textContent = 'PAUSE';
    last = performance.now();
  }
  const DEATH = {
    collision: ['Collision en plein vol. Des plumes partout.', 'Deux pigeons, un seul couloir aérien.', 'La tour de contrôle a regardé ailleurs.'],
    fat: ['Le pigeon obèse n’a pas pu freiner.', 'Trop de miettes, pas assez de freins.'],
    gull: ['La mouette n’a jamais signé le plan de vol.', 'Mouette 1 — Tour de contrôle 0.']
  };
  function gameOver(){
    running = false;
    sfx.crash();
    fx.crashAt = performance.now();
    screen.classList.remove('shake'); void screen.offsetWidth; screen.classList.add('shake');
    const lines = DEATH[game.cause] || DEATH.collision;
    ui.death.textContent = lines[Math.floor(Math.random() * lines.length)];
    ui.final.textContent = pad(game.score);
    ui.finalStats.textContent = `${game.landed} pigeon${game.landed > 1 ? 's' : ''} posé${game.landed > 1 ? 's' : ''} · ${(game.time / 1000).toFixed(0)} s de service · série max ×${bestStreak}`;
    setTimeout(() => { ui.over.hidden = false; }, 1100);
    cabinet.finish(game.score);
  }
  function togglePause(){
    if(!running) return;
    paused = !paused;
    ui.pause.textContent = paused ? 'REPRENDRE' : 'PAUSE';
    drawing.clear();
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
    game:'pigeon-control', start, chip:$('accountChip'),
    playerLine:$('playerLine'), status:$('scoreStatus'), board:$('leaderboard'),
    tabs:[...document.querySelectorAll('[data-board]')]
  });
  $('startBtn').addEventListener('click', () => cabinet.play(false));
  $('dailyBtn').addEventListener('click', () => cabinet.play(true));
  $('againBtn').addEventListener('click', () => cabinet.play(false));
  $('againDailyBtn').addEventListener('click', () => cabinet.play(true));

  // ------------------------------------------------------------ juice
  function feathers(x, y, color, n = 16, speed = 120){
    for(let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2, v = speed * (.3 + Math.random() * .7);
      fx.feathers.push({x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, rot:Math.random() * 6, vr:(Math.random() - .5) * 8, life:1, color});
    }
  }
  function floatText(x, y, text, color){ fx.texts.push({x, y, text, color, life:1}); }
  function consumeEvents(){
    for(const e of game.events){
      if(e.type === 'land'){
        feathers(e.x, e.y, P.KINDS[e.kind].color, 10, 70);
        floatText(e.x, e.y - 30, `+${e.points}${e.streak > 1 ? ` SÉRIE ×${e.streak}` : ''}`, e.streak > 1 ? '#ffd166' : '#ffffff');
        fx.ripples.push({x:e.x, y:e.y, t:0, color:P.KINDS[e.kind].color});
        bestStreak = Math.max(bestStreak, e.streak);
        sfx.land(e.streak);
      }
      if(e.type === 'enter' && !demo) sfx.coo();
      if(e.type === 'gull' && !demo) sfx.gull();
      if(e.type === 'bread'){ floatText(e.x, e.y - 30, 'DU PAIN !!', '#ffd166'); if(!demo) sfx.bread(); }
      if(e.type === 'crash'){
        feathers(e.x, e.y, '#dfe6f2', 60, 260);
        feathers(e.x, e.y, '#8a93a6', 30, 200);
        fx.flash = .7; fx.flashColor = '#ff3b4d';
      }
    }
    game.events.length = 0;
  }

  // ------------------------------------------------------------ background
  const bg = document.createElement('canvas');
  bg.width = W * dpr; bg.height = H * dpr;
  (() => {
    const g = bg.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#2a2d36'; g.fillRect(0, 0, W, H);
    // cobblestones
    for(let y = 0; y < H; y += 14) for(let x = (y / 14) % 2 ? -8 : 0; x < W; x += 18){
      const v = 38 + Math.random() * 16;
      g.fillStyle = `rgb(${v},${v + 2},${v + 8})`;
      g.beginPath(); g.roundRect ? g.roundRect(x + 1, y + 1, 16, 12, 4) : g.rect(x + 1, y + 1, 16, 12); g.fill();
    }
    // grass beds with trees in the corners
    const beds = [[0, 0, 150, 120], [W - 170, 0, 170, 110], [0, H - 90, 110, 90], [W - 120, H - 120, 120, 120], [360, H - 70, 240, 70]];
    for(const [x, y, w, h] of beds){
      g.fillStyle = '#1f4a2a'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 26) : g.rect(x, y, w, h); g.fill();
      for(let i = 0; i < 3; i++){
        const tx = x + 20 + Math.random() * (w - 40), ty = y + 20 + Math.random() * (h - 40), r = 18 + Math.random() * 16;
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(tx + 6, ty + 8, r, 0, Math.PI * 2); g.fill();
        const tg = g.createRadialGradient(tx - r / 3, ty - r / 3, 2, tx, ty, r);
        tg.addColorStop(0, '#5fb35a'); tg.addColorStop(1, '#1e5a2a');
        g.fillStyle = tg; g.beginPath(); g.arc(tx, ty, r, 0, Math.PI * 2); g.fill();
      }
    }
    // benches
    g.fillStyle = '#6b4a2e';
    for(const [x, y, w, h] of [[330, 40, 70, 12], [600, 520, 70, 12], [60, 250, 12, 70], [W - 70, 220, 12, 70]]) g.fillRect(x, y, w, h);
    const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  })();

  // ------------------------------------------------------------ drawing
  function drawStatue(st, t, wanted){
    const pulse = wanted ? .5 + Math.sin(t / 160) * .5 : 0;
    ctx.save(); ctx.translate(st.x, st.y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(6, 8, st.r, st.r * .9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = st.color; ctx.lineWidth = 3 + pulse * 3; ctx.globalAlpha = .55 + pulse * .45;
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t / 40;
    ctx.beginPath(); ctx.arc(0, 0, st.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    if(st.id === 'general'){
      ctx.fillStyle = '#5d6576'; ctx.fillRect(-20, -20, 40, 40);
      ctx.fillStyle = '#8f99ab'; ctx.fillRect(-15, -15, 30, 30);
      ctx.fillStyle = '#c2cad8'; ctx.beginPath(); ctx.arc(0, -2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c2cad8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(18, -16); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-4, -8, 3, 3); // a white stain. Of course.
    }else if(st.id === 'fountain'){
      ctx.fillStyle = '#9fb3c8'; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f7fb8'; ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(160,230,255,.6)'; ctx.lineWidth = 1.5;
      for(let i = 0; i < 3; i++){ const r = ((t / 25 + i * 9) % 27); ctx.globalAlpha = 1 - r / 27; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = '#dff6ff'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }else{
      ctx.fillStyle = '#7a4b2a';
      ctx.beginPath(); for(let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); } ctx.closePath(); ctx.fill();
      for(let i = 0; i < 6; i++){
        ctx.fillStyle = i % 2 ? '#f4e2c4' : '#d9534f';
        ctx.beginPath(); ctx.moveTo(0, 0); const a = i / 6 * Math.PI * 2, b = (i + 1) / 6 * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.lineTo(Math.cos(b) * 24, Math.sin(b) * 24); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPath(p){
    if(!p.path.length) return;
    const color = P.KINDS[p.kind].color;
    ctx.save();
    ctx.strokeStyle = color; ctx.globalAlpha = .75; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); for(const pt of p.path) ctx.lineTo(pt.x, pt.y); ctx.stroke();
    ctx.setLineDash([]);
    const end = p.path[p.path.length - 1];
    ctx.globalAlpha = 1;
    if(p.target){ ctx.fillStyle = '#b9ff66'; ctx.beginPath(); ctx.arc(end.x, end.y, 6, 0, Math.PI * 2); ctx.fill(); }
    else{ ctx.strokeStyle = '#ff5f68'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(end.x - 5, end.y - 5); ctx.lineTo(end.x + 5, end.y + 5); ctx.moveTo(end.x + 5, end.y - 5); ctx.lineTo(end.x - 5, end.y + 5); ctx.stroke(); }
    ctx.restore();
  }

  function drawBird(x, y, angle, r, color, flap, kind, extra = {}){
    if(kind !== 'gull') r *= 1.3; // drawn a bit larger than the hitbox, for readability
    ctx.save(); ctx.translate(x, y);
    // shadow on the ground
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(8, 12, r * 1.2, r * .7, angle, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);
    if(extra.scale) ctx.scale(extra.scale, extra.scale);
    const w = Math.sin(flap) * .5 + .7;
    ctx.fillStyle = kind === 'gull' ? '#e9edf3' : shade(color, -.15);
    for(const s of [-1, 1]){
      ctx.save(); ctx.scale(1, s);
      ctx.beginPath(); ctx.moveTo(-r * .3, r * .2); ctx.quadraticCurveTo(-r * .2, r * (1 + 1.4 * w), -r * 1.1, r * (.6 + 1.2 * w)); ctx.quadraticCurveTo(-r * .8, r * .4, -r * .6, r * .2); ctx.fill();
      if(kind === 'gull'){ ctx.fillStyle = '#2b2f3a'; ctx.beginPath(); ctx.arc(-r * 1.05, r * (.6 + 1.2 * w), 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e9edf3'; }
      ctx.restore();
    }
    // body
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * .72, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(color, -.3); ctx.beginPath(); ctx.moveTo(-r * 1.1, 0); ctx.lineTo(-r * 1.7, -r * .45); ctx.lineTo(-r * 1.7, r * .45); ctx.closePath(); ctx.fill();
    // neck & head
    if(kind === 'city'){ const g = ctx.createLinearGradient(r * .3, -r * .5, r * .9, r * .5); g.addColorStop(0, '#5fd1a0'); g.addColorStop(1, '#a36be0'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r * .65, 0, r * .5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = kind === 'gull' ? '#ffffff' : shade(color, kind === 'dove' ? -.05 : .12);
    ctx.beginPath(); ctx.arc(r * 1.05, 0, r * .45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = kind === 'gull' ? '#ffcc33' : '#e8a13a';
    ctx.beginPath(); ctx.moveTo(r * 1.4, -r * .12); ctx.lineTo(r * 1.4 + (kind === 'gull' ? 10 : 6), 0); ctx.lineTo(r * 1.4, r * .12); ctx.fill();
    ctx.fillStyle = kind === 'gull' ? '#ffcc33' : '#ff7a3d';
    for(const s of [-1, 1]){ ctx.beginPath(); ctx.arc(r * 1.15, s * r * .22, 1.8, 0, Math.PI * 2); ctx.fill(); }
    if(kind === 'ninja'){
      ctx.fillStyle = '#ff3b4d'; ctx.fillRect(r * .8, -r * .45, 4, r * .9);
      ctx.strokeStyle = '#ff3b4d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r * .8, 0); ctx.quadraticCurveTo(0, Math.sin(flap) * 6, -r * .6, Math.sin(flap * 1.3) * 8); ctx.stroke();
    }
    ctx.restore();
  }

  function shade(hex, k){
    const n = parseInt(hex.slice(1), 16), mix = k < 0 ? 0 : 255, a = Math.abs(k);
    const ch = s => Math.round(((n >> s) & 255) * (1 - a) + mix * a);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function edgeArrow(x, y, color, t, label, k = 1){
    const cx = Math.max(24, Math.min(W - 24, x)), cy = Math.max(24, Math.min(H - 24, y));
    const ang = Math.atan2(H / 2 - cy, W / 2 - cx);
    ctx.save(); ctx.translate(cx, cy);
    ctx.globalAlpha = .55 + Math.sin(t / 90) * .45;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    ctx.rotate(ang); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
    if(label){ ctx.fillStyle = color; ctx.font = '900 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy + 32); ctx.textAlign = 'start'; }
  }

  function draw(t, dt){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    const wanted = new Set(game.pigeons.filter(p => p.target && p.state === 'flying').map(p => p.target));
    P.STATUES.forEach(st => drawStatue(st, t, wanted.has(st.id)));

    if(game.bread){
      const b = game.bread;
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.strokeStyle = `rgba(255,209,102,${.5 + Math.sin(t / 120) * .4})`; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e0b068';
      for(let i = 0; i < 14; i++){ const a = i * 2.4, r = 4 + (i * 7) % 18; ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 4, 3); }
      ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🍞', 0, 8); ctx.textAlign = 'start';
      ctx.restore();
    }

    // ripples from landings
    fx.ripples = fx.ripples.filter(r => (r.t += dt / 700) < 1);
    for(const r of fx.ripples){ ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - r.t; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, 40 + r.t * 50, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;

    game.pigeons.forEach(drawPath);
    const danger = P.nearMisses(game);
    for(const p of game.pigeons){
      const k = P.KINDS[p.kind];
      if(p.state === 'landing'){
        const st = P.STATUES.find(s => s.id === p.statue);
        const q = Math.min(1, p.landT / .7);
        drawBird(p.x + (st.x - p.x) * q, p.y + (st.y - p.y) * q, p.angle, p.r, k.color, p.flap * (1 - q), p.kind, {scale:1 - q * .5});
        continue;
      }
      if(danger.has(p.id)){
        ctx.strokeStyle = `rgba(255,59,77,${.6 + Math.sin(t / 60) * .4})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2); ctx.stroke();
      }
      drawBird(p.x, p.y, p.angle, p.r, k.color, p.flap, p.kind);
      if(p.hungry){ ctx.fillStyle = '#ffd166'; ctx.font = '900 11px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText('MIETTES ?!', p.x, p.y - p.r - 10); ctx.textAlign = 'start'; }
    }
    for(const g of game.gulls){
      const onScreen = g.x > -g.r && g.x < W + g.r && g.y > -g.r && g.y < H + g.r;
      if(!onScreen && game.time < g.warnUntil + 4000) edgeArrow(g.x, g.y, '#ff3b4d', t, 'MOUETTE !');
      drawBird(g.x, g.y, g.angle, g.r, '#dfe4ec', g.wing, 'gull');
    }
    for(const inc of game.incoming){
      const k = 1 - (inc.at - game.time) / 1800;
      edgeArrow(inc.x, inc.y, P.KINDS[inc.kind].color === '#2b2f3a' ? '#c9ced8' : P.KINDS[inc.kind].color, t, inc.kind === 'fat' ? 'GROS' : inc.kind === 'ninja' ? 'NINJA' : '', k);
    }

    const s = dt / 1000;
    fx.feathers = fx.feathers.filter(f => (f.life -= s * .8) > 0);
    for(const f of fx.feathers){
      f.x += f.vx * s; f.y += f.vy * s; f.vx *= .97; f.vy *= .97; f.rot += f.vr * s;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = f.life; ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    fx.texts = fx.texts.filter(x => (x.life -= s * .8) > 0);
    ctx.textAlign = 'center';
    for(const x of fx.texts){ ctx.globalAlpha = Math.min(1, x.life * 1.6); ctx.fillStyle = x.color; ctx.font = '900 16px ui-monospace,Menlo,monospace'; ctx.fillText(x.text, x.x, x.y - (1 - x.life) * 36); }
    ctx.globalAlpha = 1; ctx.textAlign = 'start';

    if(game.over && game.crash){
      const k = Math.min(1, (performance.now() - fx.crashAt) / 400);
      ctx.save(); ctx.translate(game.crash.x, game.crash.y); ctx.scale(.6 + k * .5, .6 + k * .5);
      ctx.fillStyle = '#ff3b4d'; ctx.font = '900 38px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 12; ctx.fillText('CRASH !', 0, -30); ctx.restore();
    }
    if(paused){
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = '900 34px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      ctx.fillText('PAUSE', W / 2, H / 2); ctx.textAlign = 'start';
    }
    if(fx.flash > 0){ ctx.globalAlpha = fx.flash; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; fx.flash = Math.max(0, fx.flash - s * 2); }
  }

  function hud(){
    ui.score.textContent = pad(demo ? 0 : game.score);
    ui.landed.textContent = demo ? 0 : game.landed;
    ui.streak.textContent = `×${demo ? 0 : bestStreak}`;
    ui.time.textContent = `${demo ? 0 : Math.floor(game.time / 1000)}s`;
  }

  // Attract mode: a self-driving demo behind the start panel.
  function demoPilot(){
    for(const p of game.pigeons){
      if(p.state !== 'flying' || p.path.length || !p.inside) continue;
      const st = P.STATUES.find(x => P.accepts(x, p.kind));
      P.setPath(game, p.id, [{x:st.x, y:st.y}]);
    }
    if(game.over) game = P.newGame(Math.floor(Math.random() * 1e9));
  }

  function frame(t){
    const dt = Math.min(50, t - last || 16);
    last = t;
    if(demo){ demoPilot(); P.update(game, dt); consumeEvents(); }
    else if(running && !paused){
      let left = dt;
      while(left > 0 && !game.over){ const step = Math.min(16, left); P.update(game, step); left -= step; }
      consumeEvents();
      if(game.over) gameOver();
    }
    draw(t, dt);
    hud();
    requestAnimationFrame(frame);
  }

  game = P.newGame(42);
  // Read-only peek used by the browser tests.
  window.PigeonControl = {snapshot: () => ({running, over:game.over, landed:game.landed, score:game.score, pigeons:game.pigeons.filter(p => p.state === 'flying' && p.inside).map(p => ({id:p.id, x:p.x, y:p.y, kind:p.kind, routed:p.path.length > 0}))})};
  requestAnimationFrame(t => { last = t; frame(t); });
})();
