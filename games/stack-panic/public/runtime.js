'use strict';

// Runtime hardening layer for STACK PANIC.
// Keeps gameplay deterministic across refresh rates while presentation remains free to be noisy.

state.bag = [];
state.fxState = 1;
state.lastFrame = 0;
state.frameDt = 1 / 60;
state.pauseStartedAt = 0;
state.bannerTimer = null;

const gameplaySeedRun = seedRun;
seedRun = function(seed){
  gameplaySeedRun(seed);
  state.bag = [];
  state.fxState = ((state.seed || 1) ^ 0xa5a5a5a5) >>> 0 || 1;
};

function fxRng(){
  let x = state.fxState | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.fxState = x >>> 0;
  return state.fxState / 4294967296;
}
function fxRand(n){ return Math.floor(fxRng() * n); }
function chancePerFrame(p, dt){ return 1 - Math.pow(1 - p, Math.max(0, dt) * 60); }

function refillBag(){
  state.bag = Array.from({length: SHAPES.length}, (_, i) => i);
  for(let i = state.bag.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
  }
}
function nextType(){ if(!state.bag.length) refillBag(); return state.bag.pop(); }
makePiece = function(){
  const type = nextType();
  return {
    matrix: SHAPES[type].map(row => row.slice()),
    x: Math.floor(COLS / 2) - 2,
    y: -1,
    color: 1 + (type % 7),
    type
  };
};

function gravityDrop(){
  if(!canInput()) return;
  if(!collides(state.piece, 0, 1)) state.piece.y++;
  else merge();
  state.lastDrop = performance.now();
}

updateEvents = function(t, dt = 1/60){
  if(!state.activeEvent && !state.mini && t >= state.nextEventAt) triggerRandomEvent(t);
  if(state.activeEvent && state.eventUntil && t >= state.eventUntil) endEvent();
  updateSideEvent(t);
  if(!state.activeEvent && !state.mini) state.chaos = Math.max(0, state.chaos - .24 * dt);
};

// Side incidents must be annoying, not secretly alter the board.
updateSideEvent = function(t){
  if(state.side){
    if(t >= state.side.until) endSideEvent();
    return;
  }
  if(state.mini || state.chaos < SIDE_CHAOS || t < (state.nextSideAt || 0)) return;
  const safeSide = ['duck','ad','blackout','bsod'];
  const pool = EVENT_POOL.filter(e => safeSide.includes(e.id) && e.id !== state.activeEvent?.id);
  if(!pool.length){ state.nextSideAt = t + 6000; return; }
  const e = pool[rand(pool.length)];
  state.side = {id:e.id, until:t + e.duration};
  cabinet.classList.add(e.id);
  showBanner(`${e.icon} ${e.name}`, 'Et pendant ce temps, en parallèle…');
  if(e.id === 'duck') spawnDuck();
  if(e.id === 'ad') showAd();
  if(e.id === 'blackout') spawnSmoke(14);
  if(e.id === 'bsod') showCrash();
  state.nextSideAt = t + e.duration + 2500 + rng() * 5000;
};

endSideEvent = function(){
  if(!state.side) return;
  const id = state.side.id;
  if(state.activeEvent?.id !== id) cabinet.classList.remove(id);
  if(id === 'ad') hideAd();
  if(id === 'duck') state.duck = null;
  if(id === 'blackout') state.smoke = [];
  if(id === 'bsod') hideCrash();
  state.side = null;
};

showBanner = function(title, text){
  banner.querySelector('strong').textContent = title;
  banner.querySelector('span').textContent = text;
  banner.classList.add('show');
  clearTimeout(state.bannerTimer);
  state.bannerTimer = setTimeout(() => banner.classList.remove('show'), 2600);
};

spawnSheep = function(){
  state.sheep = Array.from({length:5 + rand(6)}, (_, i) => ({
    x:-45 - rand(240) - i * 20,
    y:100 + rand(520),
    vx:90 + rng() * 138,
    bounce:fxRng() * 6,
    hit:false,
    mood:fxRand(3)
  }));
};
updateSheep = function(t, dt = 1/60){
  state.sheep.forEach(s => {
    s.x += s.vx * dt;
    s.bounce = Math.sin(t / 130 + s.y) * 5;
    if(!s.hit && s.x > 70 && s.x < 320){
      const bx = clamp(Math.floor(s.x / CELL), 0, COLS - 1);
      const by = clamp(Math.floor(s.y / CELL), 0, ROWS - 1);
      if(state.board[by][bx]){
        const dir = rng() > .5 ? 1 : -1;
        if(bx + dir >= 0 && bx + dir < COLS && !state.board[by][bx + dir]){
          state.board[by][bx + dir] = state.board[by][bx];
          state.board[by][bx] = 0;
        }
        s.hit = true;
        state.score += 25;
        sfx('bleat');
      }
    }
  });
  state.sheep = state.sheep.filter(s => s.x < 430);
};

updateWater = function(dt = 1/60){
  if(!state.activeEvent || state.activeEvent.id !== 'water') return;
  if(chancePerFrame(.09, dt)){
    for(let y = ROWS - 2; y >= 0; y--) for(let x = 0; x < COLS; x++){
      if(state.board[y][x] && !state.board[y + 1][x] && rng() < .22){
        state.board[y + 1][x] = state.board[y][x];
        state.board[y][x] = 0;
      }
    }
  }
};

const originalSpawnBomb = spawnBomb;
spawnBomb = function(){
  originalSpawnBomb();
  state.bombs.forEach(b => { b.vy = 13 + rng() * 3; b.pulse = 0; });
};
updateBombs = function(t, dt = 1/60){
  state.bombs.forEach(b => {
    b.pulse = (b.pulse || 0) + dt * 8;
    if(!b.armed){
      b.y += b.vy * dt;
      const iy = Math.floor(b.y);
      if(iy >= ROWS - 1 || (iy >= 0 && state.board[iy + 1]?.[b.x])){
        b.armed = true;
        b.y = clamp(iy, 0, ROWS - 1);
        b.explodeAt = t + 1400;
      }
    }else if(t >= b.explodeAt){
      explodeBomb(b);
      b.done = true;
    }
  });
  state.bombs = state.bombs.filter(b => !b.done);
};

spawnTank = function(){
  state.tank = {x:-90,y:600,vx:105,shots:0,nextShot:performance.now()+500,flashUntil:0,shotCol:null};
  spawnSmoke(26);
};
updateTank = function(t, dt = 1/60){
  if(!state.tank) return;
  const q = state.tank;
  q.x += q.vx * dt;
  if(t >= q.nextShot && q.shots < 4){
    q.nextShot = t + 700;
    q.shots++;
    const col = rand(COLS);
    q.shotCol = col;
    q.flashUntil = t + 140;
    for(let y = ROWS - 1; y >= Math.max(0, ROWS - 5 - rand(5)); y--) state.board[y][col] = 0;
    burst(col * CELL + 18, 570, 28);
    screenKick('shake', 240);
    sfx('boom');
    clearLines();
  }
  if(q.x > 450) state.tank = null;
};

spawnSmoke = function(n){
  state.smoke.push(...Array.from({length:n}, () => ({
    x:fxRand(360), y:380 + fxRand(340), r:25 + fxRand(55), a:.12 + fxRng() * .2,
    vx:-18 + fxRng() * 36, vy:-12 - fxRng() * 30
  })));
};
updateSmoke = function(dt = 1/60){
  state.smoke.forEach(s => {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.a *= Math.pow(.995, dt * 60);
  });
  state.smoke = state.smoke.filter(s => s.a > .025);
};

const originalSpawnMeteors = spawnMeteors;
spawnMeteors = function(t){
  originalSpawnMeteors(t);
  state.meteors.forEach(m => {
    m.vx *= 60;
    m.vy *= 60;
    m.spin *= .1;
  });
};
updateMeteors = function(t, dt = 1/60){
  if(!state.meteors.length) return;
  state.meteors.forEach(m => {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.vy += 216 * dt;
    m.spin += 15 * dt;
    m.trail.unshift({x:m.x,y:m.y});
    if(m.trail.length > 9) m.trail.pop();
    const cx = clamp(Math.floor(m.x / CELL), 0, COLS - 1);
    const cy = Math.floor(m.y / CELL);
    const hitStack = cy >= 0 && cy < ROWS && state.board[cy][cx];
    if(hitStack || m.y > ROWS * CELL - 6){
      const iy = clamp(cy, 0, ROWS - 1);
      const removed = crater(cx, iy, 2);
      state.score += removed * 12;
      state.chaos = clamp(state.chaos + 4, 0, 100);
      burst(m.x, iy * CELL + CELL / 2, 42);
      spawnSmoke(4);
      screenKick('shake', 320);
      sfx('impact');
      m.done = true;
    }
  });
  if(state.meteors.some(m => m.done)) clearLines();
  state.meteors = state.meteors.filter(m => !m.done);
};

const originalSpawnWreckingBall = spawnWreckingBall;
spawnWreckingBall = function(t){
  originalSpawnWreckingBall(t);
  if(state.wreck) state.wreck.vx *= 60;
};
updateWreck = function(t, dt = 1/60){
  const w = state.wreck;
  if(!w) return;
  w.x += w.vx * dt;
  w.swing += 5.4 * dt;
  const cx = Math.floor(w.x / CELL);
  if(cx >= 0 && cx < COLS){
    let removed = 0;
    for(let y = w.band; y < Math.min(ROWS, w.band + 3); y++){
      if(state.board[y][cx]){ state.board[y][cx] = 0; removed++; }
    }
    if(removed){
      w.hits += removed;
      state.score += removed * 9;
      burst(cx * CELL + CELL / 2, (w.band + 1) * CELL, 10);
      if(removed > 1){ screenKick('shake', 140); sfx('clank'); }
    }
  }
  if(w.x > COLS * CELL + 80){
    state.wreck = null;
    clearLines();
    if(w.hits) showBanner('🏗️ CHANTIER TERMINÉ', `${w.hits} blocs évacués sans autorisation.`);
  }
};

spawnDuck = function(){
  state.duck = {x:-50,y:90+fxRand(450),vx:145+fxRng()*95,until:performance.now()+4200,bob:fxRng()*6};
  sfx('duck');
};
function updateDuck(t, dt = 1/60){
  if(!state.duck) return;
  state.duck.x += state.duck.vx * dt;
  state.duck.bob += dt * 7;
  if(state.duck.x > 430 || t > state.duck.until) state.duck = null;
}

burst = function(x, y, n = 25){
  for(let i = 0; i < n; i++) state.particles.push({
    x, y,
    vx:-180 + fxRng() * 360,
    vy:-240 + fxRng() * 420,
    life:.6 + fxRng() * .4,
    s:2 + fxRand(5),
    color:COLORS[1 + fxRand(7)]
  });
};
updateParticles = function(dt = 1/60){
  state.particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 288 * dt;
    p.life -= 1.08 * dt;
  });
  state.particles = state.particles.filter(p => p.life > 0);
};

function drawSheepSprite(s){
  ctx.save(); ctx.translate(s.x, s.y + s.bounce);
  ctx.fillStyle = '#eef3ff';
  for(const [x,y,r] of [[-8,0,9],[0,-5,11],[9,0,9],[0,5,11]]){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
  ctx.fillStyle = '#171827'; ctx.fillRect(10,-6,12,13);
  ctx.fillStyle = s.mood === 2 ? '#ff5ab7' : '#43efff'; ctx.fillRect(17,-3,3,3);
  ctx.fillStyle = '#8a91a8'; ctx.fillRect(-8,11,4,8); ctx.fillRect(7,11,4,8);
  ctx.restore();
}
function drawBombSprite(b){
  const x = b.x * CELL + 18, y = b.y * CELL + 18;
  ctx.save(); ctx.translate(x,y);
  const pulse = 1 + Math.sin(b.pulse || 0) * .08; ctx.scale(pulse,pulse);
  ctx.fillStyle = '#10121b'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = b.armed ? '#ff5f68' : '#ffd166'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7,-9); ctx.quadraticCurveTo(14,-17,10,-22); ctx.stroke();
  ctx.fillStyle = '#ff5f68'; ctx.fillRect(8,-24,4,4); ctx.restore();
  if(b.armed){
    const remaining = clamp((b.explodeAt - performance.now()) / 1400, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(b.x*CELL+5,b.y*CELL+32,26,4);
    ctx.fillStyle = remaining < .35 ? '#ff5f68' : '#ffd166'; ctx.fillRect(b.x*CELL+5,b.y*CELL+32,26*remaining,4);
  }
}
function drawTankSprite(q){
  ctx.save(); ctx.translate(q.x,q.y);
  ctx.fillStyle='#1a2117'; ctx.fillRect(2,-17,84,18);
  ctx.fillStyle='#7c8a50'; ctx.fillRect(8,-35,72,22); ctx.fillRect(28,-49,32,18);
  ctx.fillStyle='#9bac65'; ctx.fillRect(53,-44,52,7);
  ctx.fillStyle='#0c100b'; for(let x=8;x<82;x+=15){ctx.beginPath();ctx.arc(x,-5,7,0,Math.PI*2);ctx.fill();}
  if(q.flashUntil > performance.now()){
    ctx.fillStyle='#ffd166';ctx.beginPath();ctx.moveTo(105,-40);ctx.lineTo(128,-48);ctx.lineTo(119,-36);ctx.lineTo(132,-31);ctx.lineTo(105,-34);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
function drawDuckSprite(d){
  ctx.save();ctx.translate(d.x,d.y+Math.sin(d.bob)*5);
  ctx.fillStyle='#ffd166';ctx.fillRect(-11,-8,24,16);ctx.fillRect(7,-14,13,13);
  ctx.fillStyle='#ff9d3d';ctx.fillRect(20,-8,10,5);ctx.fillStyle='#10121b';ctx.fillRect(15,-11,3,3);
  ctx.fillStyle='#ffd166';ctx.font='700 10px monospace';ctx.fillText('INSPECTION',-25,24);ctx.restore();
}

drawEventActors = function(){
  state.sheep.forEach(drawSheepSprite);
  state.bombs.forEach(drawBombSprite);
  if(state.tank) drawTankSprite(state.tank);
  if(state.duck) drawDuckSprite(state.duck);
  state.meteors.forEach(m => {
    ctx.save();
    m.trail.forEach((p,i)=>{ctx.globalAlpha=.35*(1-i/m.trail.length);ctx.fillStyle=i<3?'#ffd166':'#ff7a59';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,11-i),0,Math.PI*2);ctx.fill();});
    ctx.globalAlpha=1;ctx.translate(m.x,m.y);ctx.rotate(m.spin);ctx.font='30px sans-serif';ctx.fillText('☄️',-16,10);ctx.restore();
  });
  if(state.wreck){
    const w=state.wreck,anchorY=w.y-120,sway=Math.sin(w.swing)*16;
    ctx.save();ctx.strokeStyle='rgba(200,206,220,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w.x-sway,anchorY);ctx.lineTo(w.x,w.y);ctx.stroke();
    ctx.fillStyle='#8a8f9c';ctx.beginPath();ctx.arc(w.x,w.y,21,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.arc(w.x-7,w.y-7,7,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  if(state.magnet){
    const m=state.magnet,x=m.dir<0?6:COLS*CELL-46;ctx.save();ctx.globalAlpha=.85;ctx.font='34px sans-serif';ctx.fillText('🧲',x,ROWS*CELL/2);
    ctx.globalAlpha=.16;ctx.strokeStyle='#43efff';ctx.lineWidth=2;for(let i=1;i<5;i++){ctx.beginPath();ctx.arc(m.dir<0?0:COLS*CELL,ROWS*CELL/2,i*44,-Math.PI/2,Math.PI/2,m.dir>0);ctx.stroke();}ctx.restore();
  }
  if(state.acid){
    ctx.save();ctx.globalAlpha=.2;ctx.fillStyle='#b9ff66';for(let i=0;i<26;i++){ctx.fillRect(fxRand(COLS*CELL),fxRand(ROWS*CELL),2,9);}ctx.restore();
  }
  state.smoke.forEach(s=>{ctx.save();ctx.globalAlpha=s.a;ctx.fillStyle='#afb4c0';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.restore();});
  state.particles.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.s,p.s);ctx.restore();});
};

drawOverlay = function(){
  octx.clearRect(0,0,overlay.width,overlay.height);
  if(state.activeEvent?.id==='glitch'||state.side?.id==='glitch'){
    for(let i=0;i<8;i++){
      const y=fxRand(720);
      octx.fillStyle=`rgba(${fxRand(2)?255:67},${fxRand(2)?90:239},255,.08)`;
      octx.fillRect(fxRand(40)-20,y,360,2+fxRand(9));
    }
  }
  if(state.activeEvent?.id==='blackout'||state.side?.id==='blackout'){
    const px=state.piece?clamp((state.piece.x+1.5)*CELL,55,305):180;
    const py=state.piece?clamp((state.piece.y+2)*CELL,80,640):480;
    const g=octx.createRadialGradient(px,py,32,px,py,230);
    g.addColorStop(0,'rgba(0,0,0,.06)');g.addColorStop(.34,'rgba(0,0,0,.3)');g.addColorStop(1,'rgba(0,0,0,.9)');
    octx.fillStyle=g;octx.fillRect(0,0,360,720);
  }
  if(state.mini) drawMini();
};

const originalBeginMiniWorld = beginMiniWorld;
beginMiniWorld = function(){
  if(!state.running || state.gameOver) return;
  if(state.paused){ setTimeout(beginMiniWorld, 120); return; }
  originalBeginMiniWorld();
  if(state.mini) state.mini.targetX = (fxRng() - .5) * 5;
};

const originalDrawMiniHud = drawMiniHud;
drawMiniHud = function(m){
  originalDrawMiniHud(m);
  const guide=window.Breach?.guide?.(),pos=window.Breach?.peek?.();
  if(!guide||!pos) return;
  const angle=Math.atan2(guide.y-pos.y,guide.x-pos.x);
  octx.save();octx.translate(314,96);octx.rotate(angle);octx.fillStyle='#43efff';octx.beginPath();octx.moveTo(11,0);octx.lineTo(-6,-6);octx.lineTo(-3,0);octx.lineTo(-6,6);octx.closePath();octx.fill();octx.restore();
};

const originalUpdateHud = updateHud;
updateHud = function(){
  originalUpdateHud();
  const topRow=state.board.findIndex(row=>row.some(Boolean));
  cabinet.classList.toggle('danger-high',topRow>=0&&topRow<=4&&!state.mini);
};

function shiftTimers(delta){
  state.lastDrop += delta;
  state.nextEventAt += delta;
  if(state.eventUntil) state.eventUntil += delta;
  if(state.side?.until) state.side.until += delta;
  if(state.nextSideAt) state.nextSideAt += delta;
  state.bombs.forEach(b=>{if(b.explodeAt)b.explodeAt+=delta;});
  if(state.tank?.nextShot) state.tank.nextShot+=delta;
  if(state.tank?.flashUntil) state.tank.flashUntil+=delta;
  if(state.duck?.until) state.duck.until+=delta;
  if(state.magnet?.nextPull) state.magnet.nextPull+=delta;
  if(state.acid?.nextBite) state.acid.nextBite+=delta;
  if(state.mini){state.mini.started+=delta;state.mini.last=performance.now();}
}

togglePause = function(){
  if(!state.running||state.gameOver)return;
  const now=performance.now();
  if(!state.paused){
    state.paused=true;state.pauseStartedAt=now;pauseBtn.textContent='RESUME';Music.setEnabled(false);
    showBanner('⏸ PAUSED','La catastrophe attend poliment.');
  }else{
    const delta=Math.max(0,now-state.pauseStartedAt);state.paused=false;state.pauseStartedAt=0;shiftTimers(delta);state.lastFrame=now;
    pauseBtn.textContent='PAUSE';Music.setEnabled(state.sound);showBanner('▶ RESUMED','La catastrophe reprend.');
  }
};

const baseEndGame = endGame;
endGame = function(){
  baseEndGame();
  state.pauseStartedAt=0;
};

const baseResetGame = resetGame;
resetGame = function(daily=false){
  baseResetGame(daily);
  state.lastFrame=performance.now();state.pauseStartedAt=0;pauseBtn.textContent='PAUSE';
};

update = function(t){
  const dt=state.lastFrame?clamp((t-state.lastFrame)/1000,0,.05):1/60;
  state.lastFrame=t;state.frameDt=dt;state.time=t;
  if(state.running&&!state.paused&&!state.gameOver){
    if(!state.mini&&t-state.lastDrop>dropInterval())gravityDrop();
    updateEvents(t,dt);updateParticles(dt);updateSheep(t,dt);updateBombs(t,dt);updateTank(t,dt);updateWater(dt);
    updateMeteors(t,dt);updateWreck(t,dt);updateMagnet(t,dt);updateAcid(t,dt);updateSmoke(dt);updateDuck(t,dt);
    if(state.mini)updateMini(t);
  }
  draw();requestAnimationFrame(update);
};
