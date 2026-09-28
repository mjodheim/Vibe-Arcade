'use strict';

// V1.0 visual pass. Presentation only: nothing here reads or writes the game
// RNG, so daily runs stay identical for everyone.
// - crisp HiDPI board and preview
// - beveled glass blocks rendered once per colour and blitted
// - animated well: drifting stars, landing column, pulsing danger zone
// - line-clear sweeps, lock flashes, hard-drop trails, level-up stamp
// - a gauge telegraphing the next garbage row from the floor
(() => {
  const W = COLS * CELL, H = ROWS * CELL;
  const dpr = Math.min(2, Math.max(1, Math.round((window.devicePixelRatio || 1) * 2) / 2));
  canvas.width = W * dpr; canvas.height = H * dpr;
  nextCanvas.width = 144 * dpr; nextCanvas.height = 144 * dpr;

  const fx = {clears:[], locks:[], trails:[], level:{value:1, at:-1e9}, glitchFrames:0, wasGlitch:false};
  const stars = Array.from({length:46}, () => ({x:Math.random() * W, y:Math.random() * H, z:.3 + Math.random() * .7, tw:Math.random() * 6}));
  const now = () => performance.now();

  function shade(hex, amount){
    const n = parseInt(hex.slice(1), 16);
    const mix = amount < 0 ? 0 : 255, k = Math.abs(amount);
    const ch = s => Math.round(((n >> s) & 255) * (1 - k) + mix * k);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  function roundRect(c, x, y, w, h, r){
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  // One pre-rendered sprite per colour, at device resolution.
  const sprites = new Map();
  function sprite(color){
    if(sprites.has(color)) return sprites.get(color);
    const s = CELL * dpr;
    const el = document.createElement('canvas');
    el.width = s; el.height = s;
    const c = el.getContext('2d');
    if(!c || typeof c.drawImage !== 'function'){ sprites.set(color, null); return null; }
    c.scale(dpr, dpr);
    const rubble = color === '#59617a';
    const g = c.createLinearGradient(0, 0, CELL, CELL);
    g.addColorStop(0, shade(color, .38));
    g.addColorStop(.45, color);
    g.addColorStop(1, shade(color, -.45));
    roundRect(c, 1.5, 1.5, CELL - 3, CELL - 3, 6);
    c.fillStyle = g; c.fill();
    // bevel
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255,255,255,.38)';
    c.beginPath(); c.moveTo(5, CELL - 6); c.lineTo(5, 5); c.lineTo(CELL - 6, 5); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.moveTo(6, CELL - 5); c.lineTo(CELL - 5, CELL - 5); c.lineTo(CELL - 5, 6); c.stroke();
    if(rubble){
      c.strokeStyle = 'rgba(10,12,20,.55)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(9, 11); c.lineTo(17, 18); c.lineTo(14, 27); c.moveTo(17, 18); c.lineTo(27, 15); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.28)';
      for(const [x, y] of [[8,8],[CELL-9,8],[8,CELL-9],[CELL-9,CELL-9]]){ c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); }
    }else{
      // glass sheen
      const sheen = c.createLinearGradient(0, 4, 0, CELL / 2);
      sheen.addColorStop(0, 'rgba(255,255,255,.42)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      roundRect(c, 6, 6, CELL - 12, CELL / 2 - 5, 4);
      c.fillStyle = sheen; c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.fillRect(8, 8, 5, 2);
    }
    roundRect(c, 1.5, 1.5, CELL - 3, CELL - 3, 6);
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.22)'; c.stroke();
    sprites.set(color, el);
    return el;
  }

  drawCell = function(c, x, y, color, alpha = 1, scale = 1){
    const img = sprite(color);
    const m = (1 - scale) * CELL / 2, s = CELL * scale;
    c.save();
    c.globalAlpha = alpha;
    if(img) c.drawImage(img, x + m, y + m, s, s);
    else { c.fillStyle = color; c.fillRect(x + m + 2, y + m + 2, s - 4, s - 4); }
    c.restore();
  };

  function landingGhost(){
    const p = state.piece;
    if(!p) return null;
    const ghost = {...p};
    while(!collides(ghost, 0, 1)) ghost.y++;
    return ghost;
  }

  drawBackground = function(){
    const t = now();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0f22'); g.addColorStop(.6, '#070a17'); g.addColorStop(1, '#04050c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // drifting starfield, faster as chaos rises
    const speed = .012 + state.chaos * .0004;
    stars.forEach(s => {
      const y = (s.y + t * speed * s.z) % H;
      ctx.globalAlpha = (.18 + .22 * Math.sin(t / 700 + s.tw)) * s.z;
      ctx.fillStyle = s.z > .8 ? '#9ff6ff' : '#c9b8ff';
      ctx.fillRect(s.x, y, s.z * 1.6, s.z * 1.6);
    });
    ctx.globalAlpha = 1;

    // landing column under the active piece
    const ghost = !state.mini && landingGhost();
    if(ghost){
      const cols = new Set();
      ghost.matrix.forEach(row => row.forEach((v, x) => { if(v) cols.add(ghost.x + x); }));
      const lane = ctx.createLinearGradient(0, 0, 0, H);
      lane.addColorStop(0, 'rgba(67,239,255,0)');
      lane.addColorStop(1, 'rgba(67,239,255,.07)');
      ctx.fillStyle = lane;
      cols.forEach(x => ctx.fillRect(x * CELL, 0, CELL, H));
    }

    // grid as soft dots at intersections
    ctx.fillStyle = 'rgba(120,200,255,.16)';
    for(let x = 1; x < COLS; x++) for(let y = 1; y < ROWS; y++) ctx.fillRect(x * CELL - 1, y * CELL - 1, 2, 2);
    ctx.strokeStyle = 'rgba(67,239,255,.045)'; ctx.lineWidth = 1;
    for(let x = 1; x < COLS; x++){ ctx.beginPath(); ctx.moveTo(x * CELL + .5, 0); ctx.lineTo(x * CELL + .5, H); ctx.stroke(); }

    // danger zone breathes harder when the stack gets close
    const top = state.board.findIndex(row => row.some(Boolean));
    const near = top >= 0 && top <= 6 ? 1 - top / 7 : 0;
    const dangerY = CELL * 5;
    const pulse = .5 + .5 * Math.sin(t / (near ? 140 : 600));
    const dz = ctx.createLinearGradient(0, 0, 0, dangerY);
    dz.addColorStop(0, `rgba(255,70,90,${.05 + near * .22 * pulse})`);
    dz.addColorStop(1, 'rgba(255,70,90,0)');
    ctx.fillStyle = dz; ctx.fillRect(0, 0, W, dangerY);
    ctx.strokeStyle = `rgba(255,95,104,${.18 + near * .5 * pulse})`;
    ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(0, dangerY); ctx.lineTo(W, dangerY); ctx.stroke(); ctx.setLineDash([]);
  };

  drawBoard = function(){
    state.board.forEach((row, y) => row.forEach((v, x) => { if(v) drawCell(ctx, x * CELL, y * CELL, COLORS[v] || COLORS[9], 1); }));
  };

  drawGhostAndPiece = function(){
    const p = state.piece;
    if(!p) return;
    const ghost = landingGhost();
    const color = COLORS[p.color];
    ctx.save();
    ctx.strokeStyle = color; ctx.globalAlpha = .55; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ghost.matrix.forEach((row, y) => row.forEach((v, x) => {
      if(v && ghost.y + y >= 0){
        ctx.fillStyle = color; ctx.globalAlpha = .08; ctx.fillRect((ghost.x + x) * CELL + 3, (ghost.y + y) * CELL + 3, CELL - 6, CELL - 6);
        ctx.globalAlpha = .55; ctx.strokeRect((ghost.x + x) * CELL + 3.5, (ghost.y + y) * CELL + 3.5, CELL - 7, CELL - 7);
      }
    }));
    ctx.restore();
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    p.matrix.forEach((row, y) => row.forEach((v, x) => { if(v && p.y + y >= 0) drawCell(ctx, (p.x + x) * CELL, (p.y + y) * CELL, color, 1, .96); }));
    ctx.restore();
  };

  drawNext = function(){
    nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = nctx.createRadialGradient(72, 72, 8, 72, 72, 100);
    g.addColorStop(0, '#131a33'); g.addColorStop(1, '#070913');
    nctx.fillStyle = g; nctx.fillRect(0, 0, 144, 144);
    if(!state.next) return;
    const m = state.next.matrix, s = 28;
    const ox = (144 - m[0].length * s) / 2, oy = (144 - m.length * s) / 2;
    const color = COLORS[state.next.color];
    nctx.save(); nctx.shadowColor = color; nctx.shadowBlur = 18;
    m.forEach((row, y) => row.forEach((v, x) => { if(v) drawCell(nctx, ox + x * s - (CELL - s) / 2, oy + y * s - (CELL - s) / 2, color, 1, s / CELL); }));
    nctx.restore();
  };

  // ---------------------------------------------------------------- juice

  const clearBeforeVisuals = clearLines;
  clearLines = function(){
    const full = [];
    state.board.forEach((row, y) => { if(row.every(Boolean)) full.push(y); });
    clearBeforeVisuals();
    if(full.length){
      const at = now();
      full.forEach(y => fx.clears.push({y, at, big:full.length >= 4}));
    }
  };

  const mergeBeforeVisuals = merge;
  merge = function(){
    const p = state.piece;
    if(p){
      const cells = [];
      p.matrix.forEach((row, y) => row.forEach((v, x) => { if(v) cells.push({x:p.x + x, y:p.y + y}); }));
      fx.locks.push({cells, at:now()});
    }
    mergeBeforeVisuals();
  };

  const hardDropBeforeVisuals = hardDrop;
  hardDrop = function(){
    const p = state.piece;
    if(p && canInput()){
      const y0 = p.y, cols = new Map();
      p.matrix.forEach((row, y) => row.forEach((v, x) => { if(v && !cols.has(p.x + x)) cols.set(p.x + x, y); }));
      const ghost = landingGhost();
      fx.trails.push({cols:[...cols.keys()], y0:y0 * CELL, y1:(ghost.y + 1) * CELL, color:COLORS[p.color], at:now()});
    }
    hardDropBeforeVisuals();
  };

  function drawJuice(){
    const t = now();
    fx.trails = fx.trails.filter(d => t - d.at < 260);
    fx.trails.forEach(d => {
      const k = 1 - (t - d.at) / 260;
      d.cols.forEach(x => {
        const g = ctx.createLinearGradient(0, d.y0, 0, d.y1);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, d.color);
        ctx.globalAlpha = .45 * k; ctx.fillStyle = g;
        ctx.fillRect(x * CELL + 6, d.y0, CELL - 12, Math.max(0, d.y1 - d.y0));
      });
    });
    ctx.globalAlpha = 1;

    fx.locks = fx.locks.filter(l => t - l.at < 200);
    fx.locks.forEach(l => {
      ctx.globalAlpha = .55 * (1 - (t - l.at) / 200); ctx.fillStyle = '#ffffff';
      l.cells.forEach(c => { if(c.y >= 0) ctx.fillRect(c.x * CELL + 2, c.y * CELL + 2, CELL - 4, CELL - 4); });
    });
    ctx.globalAlpha = 1;

    fx.clears = fx.clears.filter(c => t - c.at < 480);
    fx.clears.forEach(c => {
      const k = (t - c.at) / 480;
      const y = c.y * CELL;
      ctx.globalAlpha = (1 - k) * .9;
      ctx.fillStyle = c.big ? '#ffd166' : '#ffffff';
      ctx.fillRect(0, y + CELL * k * .5, W, CELL * (1 - k));
      ctx.globalAlpha = (1 - k) * .6;
      const sweep = ctx.createLinearGradient(0, 0, W, 0);
      const p = clamp(k * 1.4, 0, 1);
      sweep.addColorStop(Math.max(0, p - .2), 'rgba(67,239,255,0)');
      sweep.addColorStop(p, 'rgba(67,239,255,1)');
      sweep.addColorStop(Math.min(1, p + .02), 'rgba(67,239,255,0)');
      ctx.fillStyle = sweep; ctx.fillRect(0, y - 6, W, CELL + 12);
    });
    ctx.globalAlpha = 1;

    if(state.level !== fx.level.value){
      if(state.level > fx.level.value && state.running) fx.level.at = t;
      fx.level.value = state.level;
    }
    const since = t - fx.level.at;
    if(since < 1300){
      const k = since / 1300;
      ctx.save();
      ctx.globalAlpha = k < .15 ? k / .15 : 1 - (k - .15) / .85;
      ctx.translate(W / 2, H * .42); ctx.scale(1 + k * .25, 1 + k * .25);
      ctx.textAlign = 'center'; ctx.font = '900 34px ui-monospace,Menlo,monospace';
      ctx.shadowColor = '#ff5ab7'; ctx.shadowBlur = 24; ctx.fillStyle = '#ffffff';
      ctx.fillText(`LEVEL ${state.level}`, 0, 0);
      ctx.font = '800 11px ui-monospace,Menlo,monospace'; ctx.shadowBlur = 0; ctx.fillStyle = '#ffd166';
      ctx.fillText('ÇA ACCÉLÈRE', 0, 22);
      ctx.restore();
    }
  }

  // The next garbage row is telegraphed: a gauge along the floor that turns
  // red and starts flashing in the last second and a half.
  function drawTide(){
    if(!state.running || state.gameOver || !state.tideEvery) return;
    const k = clamp(1 - state.tideLeft / state.tideEvery, 0, 1);
    const urgent = state.tideLeft < 1500;
    const blink = urgent && Math.floor(now() / 110) % 2;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H - 5, W, 5);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#59617a'); g.addColorStop(1, urgent ? '#ff5f68' : '#ffd166');
    ctx.fillStyle = g; ctx.fillRect(0, H - 5, W * k, 5);
    if(blink){
      ctx.fillStyle = 'rgba(255,95,104,.22)'; ctx.fillRect(0, H - CELL, W, CELL);
      ctx.fillStyle = '#ff5f68'; ctx.font = '900 12px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      ctx.fillText('▲ ▲ ▲', W / 2, H - 12); ctx.textAlign = 'start';
    }
  }

  draw = function(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    drawBoard();
    if(state.piece && !state.mini) drawGhostAndPiece();
    drawJuice();
    drawEventActors();
    drawTide();
    drawOverlay();
    updateHud();
    const glitch = state.activeEvent?.id === 'glitch' || state.side?.id === 'glitch';
    if(glitch && ++fx.glitchFrames % 7 === 0) drawNext();
    if(glitch !== fx.wasGlitch){ fx.wasGlitch = glitch; drawNext(); }
  };

  const resetBeforeVisuals = resetGame;
  resetGame = function(daily = false){
    fx.clears = []; fx.locks = []; fx.trails = []; fx.level = {value:1, at:-1e9};
    resetBeforeVisuals(daily);
  };
})();
