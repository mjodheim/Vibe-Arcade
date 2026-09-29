'use strict';

// FORBIDDEN FRUIT — rendering, input, audio and the arcade cabinet wiring.
// All rules live in logic.js.
(() => {
  const L = window.FruitLogic;
  const CELL = 30, SIZE = L.W * CELL;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const screen = document.querySelector('.cab-screen');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;

  const ui = {score:$('score'), time:$('time'), kills:$('kills'), combo:$('combo'), start:$('startPanel'), over:$('overPanel'),
    death:$('deathLine'), final:$('finalScore'), finalStats:$('finalStats'), pause:$('pauseBtn'), sound:$('soundBtn')};

  const STEP = 16;
  let stepAcc = 0;
  let game = null, running = false, paused = false, daily = false, last = 0, bestCombo = 0;
  let sound = true, audio = null;
  const fx = {particles:[], texts:[], flash:0, flashColor:'#fff', confusedTint:0};
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
    seed: () => tone(880, .06, 'triangle', .04),
    pepin: () => [660, 880, 1320].forEach((f, i) => tone(f, .12, 'triangle', .04, i * .06)),
    kill: combo => { tone(90, .4, 'sawtooth', .07, 0, -60); [523, 659, 784, 1046].slice(0, 1 + Math.min(3, combo)).forEach((f, i) => tone(f, .14, 'square', .03, .05 + i * .06)); },
    spawn: () => tone(140, .5, 'sawtooth', .04, 0, 120),
    eaten: () => { tone(300, .6, 'sawtooth', .07, 0, -260); tone(70, .7, 'square', .05, .1); },
    hiss: () => tone(2000, .15, 'sawtooth', .01, 0, -1200)
  };

  // ------------------------------------------------------------ input
  const held = [];
  const KEYS = {ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', z:'up', s:'down', a:'left', q:'left', d:'right'};
  const dirOfKey = e => KEYS[e.key] || KEYS[e.key.toLowerCase?.()];
  function press(dir){ const i = held.indexOf(dir); if(i >= 0) held.splice(i, 1); held.push(dir); }
  function release(dir){ const i = held.indexOf(dir); if(i >= 0) held.splice(i, 1); }
  const currentInput = () => held[held.length - 1] || null;

  document.addEventListener('keydown', e => {
    if(e.target.closest?.('.va-auth')) return;
    if((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && running){ togglePause(); return; }
    const dir = dirOfKey(e);
    if(!dir) return;
    if(running) e.preventDefault();
    press(dir);
  });
  document.addEventListener('keyup', e => { const dir = dirOfKey(e); if(dir) release(dir); });
  window.addEventListener('blur', () => { held.length = 0; });

  document.querySelectorAll('.cab-dpad button').forEach(btn => {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); btn.classList.add('on'); press(dir); });
    const up = () => { btn.classList.remove('on'); release(dir); };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
  });

  // Swipe on the board: hold the finger down to keep moving in that direction.
  let swipe = null;
  canvas.addEventListener('pointerdown', e => { swipe = {x:e.clientX, y:e.clientY, dir:null}; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if(!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if(Math.hypot(dx, dy) < 16) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if(dir !== swipe.dir){ if(swipe.dir) release(swipe.dir); press(dir); swipe.dir = dir; }
    swipe.x = e.clientX; swipe.y = e.clientY;
  });
  const endSwipe = () => { if(swipe?.dir) release(swipe.dir); swipe = null; };
  canvas.addEventListener('pointerup', endSwipe); canvas.addEventListener('pointercancel', endSwipe);

  // ------------------------------------------------------------ lifecycle
  // Daily seed from the UTC day handed over by the arcade cabinet (the server's
  // day when online), so everyone plays the same board.
  function daySeed(day){
    const k = `${day}:fruit`;
    let h = 2166136261; for(const ch of k){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0;
  }

  function start(isDaily, day){
    daily = isDaily;
    game = L.newGame(isDaily ? daySeed(day) : crypto.getRandomValues(new Uint32Array(1))[0]);
    running = true; paused = false; bestCombo = 0; held.length = 0;
    fx.particles = []; fx.texts = []; fx.flash = 0;
    ui.start.hidden = true; ui.over.hidden = true; ui.pause.textContent = 'PAUSE';
    last = performance.now(); stepAcc = 0;
    sfx.spawn();
  }

  const DEATH = {
    chaser: ['Le Chasseur t’a eue.', 'Croquée par le Chasseur.', 'Le Chasseur ne lâche jamais.'],
    ambusher: ['L’Embusqué t’attendait au tournant.', 'Tu es allée exactement où il voulait.', 'Embuscade réussie. Pas pour toi.'],
    drunk: ['Le Bourré t’a eue par accident.', 'Il ne visait même pas.', 'Hic. Crounch.']
  };

  function gameOver(){
    running = false;
    sfx.eaten();
    screen.classList.remove('shake'); void screen.offsetWidth; screen.classList.add('shake');
    const lines = DEATH[game.cause] || DEATH.chaser;
    ui.death.textContent = lines[Math.floor(Math.random() * lines.length)];
    ui.final.textContent = pad(game.score);
    ui.finalStats.textContent = `${(game.time / 1000).toFixed(1)} s de survie · ${game.kills} serpent${game.kills > 1 ? 's' : ''} K.O. · combo max ×${bestCombo}`;
    setTimeout(() => { ui.over.hidden = false; }, 700);
    cabinet.finish(game.score);
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    ui.pause.textContent = paused ? 'REPRENDRE' : 'PAUSE';
    if(!paused){ last = performance.now(); held.length = 0; }
  }
  ui.pause.addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => { if(document.hidden && running && !paused) togglePause(); });
  ui.sound.addEventListener('click', () => {
    sound = !sound;
    ui.sound.textContent = `SON : ${sound ? 'ON' : 'OFF'}`;
    ui.sound.setAttribute('aria-pressed', String(sound));
  });

  const cabinet = window.ArcadeCabinet.create({
    game:'forbidden-fruit', start, chip:$('accountChip'),
    playerLine:$('playerLine'), status:$('scoreStatus'), board:$('leaderboard'),
    tabs:[...document.querySelectorAll('[data-board]')]
  });
  $('startBtn').addEventListener('click', () => cabinet.play(false));
  $('dailyBtn').addEventListener('click', () => cabinet.play(true));
  $('againBtn').addEventListener('click', () => cabinet.play(false));
  $('againDailyBtn').addEventListener('click', () => cabinet.play(true));

  // ------------------------------------------------------------ events → juice
  const center = c => ({x:c.x * CELL + CELL / 2, y:c.y * CELL + CELL / 2});
  function burst(x, y, color, n = 18, speed = 180){
    for(let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2, v = speed * (.3 + Math.random() * .7);
      fx.particles.push({x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:1, color, s:2 + Math.random() * 4});
    }
  }
  function floatText(x, y, text, color){ fx.texts.push({x, y, text, color, life:1}); }

  function consumeEvents(){
    for(const e of game.events){
      const p = center(e);
      if(e.type === 'seed'){ burst(p.x, p.y, '#c98b4a', 8, 90); floatText(p.x, p.y, '+25', '#ffd9a8'); sfx.seed(); }
      if(e.type === 'pepin'){ burst(p.x, p.y, '#ffd166', 30, 220); floatText(p.x, p.y, 'CONFUSION !', '#ffd166'); fx.flash = .5; fx.flashColor = '#ffd166'; sfx.pepin(); }
      if(e.type === 'kill'){
        burst(p.x, p.y, e.color, 46, 260);
        floatText(p.x, p.y, `+${e.points}${e.combo > 1 ? ` ×${e.combo}` : ''}`, e.color);
        bestCombo = Math.max(bestCombo, e.combo);
        fx.flash = .35; fx.flashColor = e.color;
        screen.classList.remove('shake'); void screen.offsetWidth; screen.classList.add('shake');
        sfx.kill(e.combo);
      }
      if(e.type === 'spawn' && game.time > 100){ burst(p.x, p.y, '#ffffff', 20, 120); sfx.spawn(); }
      if(e.type === 'eaten'){ burst(p.x, p.y, '#ff4d5e', 60, 280); fx.flash = .8; fx.flashColor = '#ff2d3d'; }
      if(e.type === 'snakeSeed') sfx.hiss();
    }
    game.events.length = 0;
  }

  // ------------------------------------------------------------ drawing
  const grass = document.createElement('canvas');
  grass.width = SIZE * dpr; grass.height = SIZE * dpr;
  (() => {
    const g = grass.getContext('2d');
    g.scale(dpr, dpr);
    for(let y = 0; y < L.H; y++) for(let x = 0; x < L.W; x++){
      g.fillStyle = (x + y) % 2 ? '#0c1d10' : '#0f2413';
      g.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
    g.strokeStyle = 'rgba(160,255,140,.10)'; g.lineWidth = 1.2;
    for(let i = 0; i < 260; i++){
      const x = Math.random() * SIZE, y = Math.random() * SIZE;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 4, y - 4 - Math.random() * 4); g.stroke();
    }
    const v = g.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * .3, SIZE / 2, SIZE / 2, SIZE * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = v; g.fillRect(0, 0, SIZE, SIZE);
  })();

  function drawSeed(p, t){
    const c = center(p);
    if(p.kind === 'pepin'){
      const pulse = 1 + Math.sin(t / 150) * .15;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(pulse, pulse);
      ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 18; ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 9, .5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-2, -3, 1.5, 3, .5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }else{
      ctx.fillStyle = '#c98b4a';
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 3.5, 5.5, .6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(c.x - 1.5, c.y - 3, 1.5, 2);
    }
  }

  function drawSnake(sn, t){
    const dead = !sn.alive;
    const alpha = dead ? Math.max(0, 1 - (game.time - sn.deadAt) / 700) : 1;
    if(alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    const pts = sn.body.map(center);
    const confused = game.time < game.confusedUntil;
    // body: a thick tapering line from tail to head
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for(let i = pts.length - 1; i > 0; i--){
      const k = 1 - i / pts.length;
      ctx.strokeStyle = shade(sn.color, -.55 + k * .55);
      ctx.lineWidth = 12 + k * 12;
      ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i - 1].x, pts[i - 1].y); ctx.stroke();
    }
    // scales
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for(let i = 1; i < pts.length; i += 1) if(i % 2){ ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 3, 0, Math.PI * 2); ctx.fill(); }
    // head
    const h = pts[0], d = sn.dir;
    ctx.shadowColor = sn.color; ctx.shadowBlur = dead ? 0 : 16;
    ctx.fillStyle = sn.color;
    ctx.beginPath(); ctx.ellipse(h.x, h.y, 14, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // tongue flick
    if(!dead && Math.sin(t / 90 + sn.id) > .6){
      ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 2;
      const tx = h.x + d.x * 14, ty = h.y + d.y * 14;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + d.x * 8, ty + d.y * 8);
      ctx.lineTo(tx + d.x * 11 + d.y * 3, ty + d.y * 11 + d.x * 3);
      ctx.moveTo(tx + d.x * 8, ty + d.y * 8); ctx.lineTo(tx + d.x * 11 - d.y * 3, ty + d.y * 11 - d.x * 3); ctx.stroke();
    }
    // eyes looking at the apple
    const a = center(game.apple);
    const look = Math.atan2(a.y - h.y, a.x - h.x);
    const side = {x:-d.y, y:d.x};
    for(const s of [-1, 1]){
      const ex = h.x + d.x * 4 + side.x * 6 * s, ey = h.y + d.y * 4 + side.y * 6 * s;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      if(confused || dead){
        ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(ex - 2.5, ey - 2.5); ctx.lineTo(ex + 2.5, ey + 2.5); ctx.moveTo(ex + 2.5, ey - 2.5); ctx.lineTo(ex - 2.5, ey + 2.5); ctx.stroke();
      }else{
        ctx.beginPath(); ctx.arc(ex + Math.cos(look) * 2, ey + Math.sin(look) * 2, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if(!dead && sn.personality === 'drunk' && Math.sin(t / 400 + sn.id) > .85){
      ctx.fillStyle = '#ffd166'; ctx.font = '800 11px ui-monospace,monospace'; ctx.fillText('hic!', h.x + 10, h.y - 16);
    }
    if(!dead && confused){ ctx.fillStyle = '#ffd166'; ctx.font = '900 14px ui-monospace,monospace'; ctx.fillText('?', h.x - 4, h.y - 18); }
    ctx.restore();
  }

  function nearestHead(){
    let best = Infinity;
    for(const sn of game.snakes) if(sn.alive) best = Math.min(best, Math.abs(sn.body[0].x - game.apple.x) + Math.abs(sn.body[0].y - game.apple.y));
    return best;
  }

  function drawApple(t){
    const c = center(game.apple);
    const danger = nearestHead();
    const scared = danger <= 4;
    const shake = scared ? (Math.random() - .5) * 2.4 : 0;
    ctx.save(); ctx.translate(c.x + shake, c.y + Math.sin(t / 180) * 1.2); ctx.scale(1.25, 1.25);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 12, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 15);
    g.addColorStop(0, '#ff8a8f'); g.addColorStop(.5, '#ff2d3d'); g.addColorStop(1, '#8a0f1a');
    ctx.fillStyle = g; ctx.shadowColor = '#ff2d3d'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.bezierCurveTo(12, -17, 20, 2, 7, 12); ctx.quadraticCurveTo(0, 15, -7, 12); ctx.bezierCurveTo(-20, 2, -12, -17, 0, -9); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(1, -15, 3, -17); ctx.stroke();
    ctx.fillStyle = '#6ddf5a'; ctx.beginPath(); ctx.ellipse(7, -15, 6, 3, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-6, -4, 2.5, 4, .4, 0, Math.PI * 2); ctx.fill();
    // face
    let look = {x:0, y:0};
    let best = Infinity;
    for(const sn of game.snakes) if(sn.alive){
      const h = sn.body[0], dist = Math.abs(h.x - game.apple.x) + Math.abs(h.y - game.apple.y);
      if(dist < best){ best = dist; const ang = Math.atan2(h.y - game.apple.y, h.x - game.apple.x); look = {x:Math.cos(ang) * 1.6, y:Math.sin(ang) * 1.6}; }
    }
    for(const s of [-1, 1]){
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 4.5, 0, scared ? 4 : 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * 4.5 + look.x, look.y, scared ? 1.4 : 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#3a0508'; ctx.lineWidth = 1.5; ctx.beginPath();
    if(scared){ ctx.ellipse(0, 6, 2.6, 2.2, 0, 0, Math.PI * 2); } else { ctx.arc(0, 4, 3, .2, Math.PI - .2); }
    ctx.stroke();
    if(scared){
      ctx.fillStyle = '#8fd8ff';
      const drop = (t / 300) % 1;
      ctx.globalAlpha = 1 - drop;
      ctx.beginPath(); ctx.ellipse(12, -6 + drop * 10, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function shade(hex, k){
    const n = parseInt(hex.slice(1), 16), mix = k < 0 ? 0 : 255, a = Math.abs(k);
    const ch = s => Math.round(((n >> s) & 255) * (1 - a) + mix * a);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function draw(t, dt){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(grass, 0, 0, SIZE, SIZE);
    if(!game){ return; }

    const confused = game.time < game.confusedUntil;
    if(confused){ ctx.fillStyle = `rgba(255,209,102,${.06 + Math.sin(t / 120) * .03})`; ctx.fillRect(0, 0, SIZE, SIZE); }

    game.seeds.forEach(p => drawSeed(p, t));
    game.snakes.forEach(sn => drawSnake(sn, t));
    drawApple(t);

    // particles & floating text
    const k = dt / 1000;
    fx.particles = fx.particles.filter(p => (p.life -= k * 1.6) > 0);
    for(const p of fx.particles){
      p.x += p.vx * k; p.y += p.vy * k; p.vx *= .96; p.vy *= .96;
      ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    fx.texts = fx.texts.filter(x => (x.life -= k * .9) > 0);
    ctx.textAlign = 'center';
    for(const x of fx.texts){
      ctx.globalAlpha = Math.min(1, x.life * 1.5); ctx.fillStyle = x.color;
      ctx.font = '900 16px ui-monospace,Menlo,monospace'; ctx.fillText(x.text, x.x, x.y - (1 - x.life) * 40);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'start';

    // danger vignette
    const danger = nearestHead();
    if(running && danger <= 3){
      const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * .35, SIZE / 2, SIZE / 2, SIZE * .72);
      g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, `rgba(255,40,60,${(.35 - danger * .08) * (.7 + Math.sin(t / 90) * .3)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
    }
    if(running && game.incoming){
      ctx.fillStyle = `rgba(255,209,102,${.6 + Math.sin(t / 80) * .4})`;
      ctx.font = '900 14px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      ctx.fillText('⚠ SERPENT EN APPROCHE', SIZE / 2, 22); ctx.textAlign = 'start';
    }
    if(paused){
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#fff'; ctx.font = '900 34px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      ctx.fillText('PAUSE', SIZE / 2, SIZE / 2); ctx.textAlign = 'start';
    }
    if(fx.flash > 0){
      ctx.globalAlpha = fx.flash; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, SIZE, SIZE); ctx.globalAlpha = 1;
      fx.flash = Math.max(0, fx.flash - k * 2.4);
    }
  }

  function hud(){
    if(!game) return;
    ui.score.textContent = pad(game.score);
    ui.time.textContent = `${(game.time / 1000).toFixed(1)}s`;
    ui.kills.textContent = game.kills;
    ui.combo.textContent = `×${bestCombo}`;
  }

  function frame(t){
    const dt = Math.min(50, t - last || 16);
    last = t;
    if(running && !paused){
      // Fixed 16 ms steps: the seeded daily run must not depend on the display's frame rate.
      stepAcc += dt;
      while(stepAcc >= STEP && !game.over){ L.update(game, STEP, currentInput()); stepAcc -= STEP; }
      consumeEvents();
      if(game.over) gameOver();
    }
    draw(t, dt);
    hud();
    requestAnimationFrame(frame);
  }

  // Attract mode behind the start panel: a harmless demo board.
  game = L.newGame(7);
  requestAnimationFrame(t => { last = t; frame(t); });
})();
