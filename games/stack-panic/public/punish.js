'use strict';

// V1.0 — NO MERCY.
// Until now half of the catalogue was secretly on the player's side: craters,
// wrecking balls, acid and a successful breach all *removed* blocks, so the
// worse the chaos got, the lower the stack went and a run could last forever.
// This layer turns every destructive incident into a hostile one: blocks are
// never simply deleted any more, they are displaced, buried or thrown back on
// top of the stack. On top of that the run itself escalates with time, and a
// rising garbage tide guarantees that every run ends.
//
// It loads right after sabotage.js so the presentation layers (cinematics,
// FX director, 3D hooks) wrap these versions instead of the old ones.

const RUBBLE = COLORS.length;
COLORS.push('#59617a');

state.survivedMs = 0;
state.tideLeft = 0;
state.tideEvery = 0;
state.pushedOut = false;

// Incidents fire faster and last less: the gap between two of them is now
// shorter than most incidents themselves.
EVENT_POOL.forEach(e => { if(e.duration) e.duration = Math.round(e.duration * .72); });
const HOSTILE_COPY = {
  water: 'Les commandes glissent. Chaque mouvement va plus loin que prévu.',
  bomb: 'Le colis explose et renvoie les gravats sur ta pile.',
  tank: 'Chaque obus enterre ta pile sous une rangée de remblai.',
  meteor: 'Les impacts creusent, les éclats retombent par-dessus.',
  wreck: 'La boule arrache le haut de la pile et le rejette n’importe où.',
  acid: 'L’acide ronge exactement les lignes que tu allais finir.',
  gravity: 'Le sol remonte. Ta pile aussi.',
  glitch: 'Gauche est droite. Droite est gauche. L’aperçu ment.',
  duck: 'Le canard inspecte ta prochaine pièce. Elle n’est pas conforme.'
};
EVENT_POOL.forEach(e => { if(HOSTILE_COPY[e.id]) e.desc = HOSTILE_COPY[e.id]; });
const duckEvent = EVENT_POOL.find(e => e.id === 'duck');
if(duckEvent) duckEvent.weight = 12;

// ------------------------------------------------------------------ helpers

function pieceCellSet(){
  const cells = new Set();
  const p = state.piece;
  if(!p) return cells;
  p.matrix.forEach((row, dy) => row.forEach((v, dx) => { if(v) cells.add(`${p.x + dx},${p.y + dy}`); }));
  return cells;
}

function columnTop(x){
  for(let y = 0; y < ROWS; y++) if(state.board[y][x]) return y;
  return ROWS;
}

// Rows are pushed in from the floor. Anything shoved past the ceiling is a
// top-out, exactly like competitive garbage.
function pushGarbageRows(count, hole = rand(COLS)){
  let overflow = false;
  for(let i = 0; i < count; i++){
    const top = state.board.shift();
    if(top.some(Boolean)) overflow = true;
    const row = Array(COLS).fill(RUBBLE);
    row[hole] = 0;
    // Messier garbage once the run is properly on fire.
    if(state.chaos > 60 && rng() < .45) row[(hole + 1 + rand(COLS - 1)) % COLS] = 0;
    state.board.push(row);
    if(rng() < .3) hole = rand(COLS);
  }
  if(state.piece && collides(state.piece, 0, 0)){
    let lift = 0;
    while(lift < count + 1 && collides(state.piece, 0, 0)){ state.piece.y--; lift++; }
    if(collides(state.piece, 0, 0)) overflow = true;
  }
  if(overflow) state.pushedOut = true;
  return count;
}

// Debris lands on the surface, sometimes one or two cells above it: an
// overhang with a hole underneath is exactly what we want the player to hate.
function scatterDebris(count, around = null){
  const avoid = pieceCellSet();
  let placed = 0;
  for(let n = 0; n < count; n++){
    const x = around === null ? rand(COLS) : clamp(around - 2 + rand(5), 0, COLS - 1);
    const top = columnTop(x);
    const gap = rng() < .45 ? 1 + rand(2) : 0;
    const y = top - 1 - gap;
    if(y < 1) { state.pushedOut = state.pushedOut || top <= 1; continue; }
    if(avoid.has(`${x},${y}`)) continue;
    state.board[y][x] = RUBBLE;
    placed++;
  }
  return placed;
}

function checkPushedOut(){
  if(!state.pushedOut || !state.running || state.gameOver) return;
  state.pushedOut = false;
  endGame();
}

// ------------------------------------------------------------------ speed

dropInterval = function(){
  return Math.max(50, 520 - (state.level - 1) * 58 - state.chaos * 1.5);
};

scheduleNextEvent = function(now){
  const pressure = 1 - clamp(state.chaos, 0, 100) / 100 * .6;
  const min = Math.max(550, (3000 - state.level * 240) * pressure);
  const max = Math.max(1300, (5400 - state.level * 300) * pressure);
  state.nextEventAt = now + min + rng() * (max - min);
};

// Heavy incidents may chain as soon as the run is warm, and the heaviest ones
// get more likely as chaos rises.
weightedEvent = function(){
  const recent = (state.recentEvents || []).slice(0, 2);
  const lastWasHeavy = HEAVY_EVENTS.includes(state.eventCooldown);
  let eligible = EVENT_POOL.filter(e =>
    e.minLevel <= state.level && !recent.includes(e.id) &&
    !(lastWasHeavy && HEAVY_EVENTS.includes(e.id) && state.chaos < 20)
  );
  if(!eligible.length) eligible = EVENT_POOL.filter(e => e.minLevel <= state.level && e.id !== state.eventCooldown);
  if(!eligible.length) eligible = EVENT_POOL.slice();
  const weighted = eligible.map(e => {
    let weight = e.weight;
    if(HEAVY_EVENTS.includes(e.id)) weight *= 1 + state.chaos / 60;
    if(['tank','gravity','wreck','bomb'].includes(e.id)) weight *= 1.25;
    return {e, weight};
  });
  const total = weighted.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for(const x of weighted){ r -= x.weight; if(r <= 0) return x.e; }
  return weighted[0].e;
};

// Time is a difficulty source of its own: a level every 30 s survived, lines
// level up faster, and chaos creeps up instead of calming down.
function escalate(dt){
  state.survivedMs += dt * 1000;
  const byLines = 1 + Math.floor(state.lines / 6);
  const byTime = 1 + Math.floor(state.survivedMs / 30000);
  state.level = Math.max(state.level, byLines, byTime);
  if(!state.mini) state.chaos = clamp(state.chaos + dt * (1.1 + state.level * .12), 0, 100);
}

// The rising tide: one garbage row from the floor, more and more often.
function tideInterval(){
  return Math.max(4200, 19000 - state.survivedMs * .11 - state.level * 450);
}
function updateTide(dt){
  if(state.mini || !state.piece) return;
  if(!state.tideEvery){ state.tideEvery = tideInterval(); state.tideLeft = state.tideEvery; }
  state.tideLeft -= dt * 1000;
  if(state.tideLeft > 0) return;
  pushGarbageRows(1);
  state.tideEvery = tideInterval();
  state.tideLeft = state.tideEvery;
  screenKick('shake', 180);
  sfx('clank');
  burst(COLS * CELL / 2, ROWS * CELL - 10, 16);
  checkPushedOut();
}

const updateEventsBeforePunish = updateEvents;
updateEvents = function(t, dt = 1/60){
  updateEventsBeforePunish(t, dt);
  if(!state.running || state.paused || state.gameOver) return;
  escalate(dt);
  updateTide(dt);
  checkPushedOut();
};

// Side incidents join in much earlier and are no longer all harmless.
updateSideEvent = function(t){
  if(state.side){
    if(t >= state.side.until) endSideEvent();
    return;
  }
  if(state.mini || state.chaos < 28 || t < (state.nextSideAt || 0)) return;
  const pool = EVENT_POOL.filter(e => ['duck','blackout','sheep','glitch'].includes(e.id) && e.id !== state.activeEvent?.id);
  if(!pool.length){ state.nextSideAt = t + 3000; return; }
  const e = pool[rand(pool.length)];
  state.side = {id:e.id, until:t + e.duration};
  cabinet.classList.add(e.id);
  if(e.id === 'duck') spawnDuck();
  if(e.id === 'blackout') spawnSmoke(14);
  if(e.id === 'sheep') spawnSheep();
  state.nextSideAt = t + e.duration + 1200 + rng() * 2600;
};

// ------------------------------------------------------------------ incidents

function incidentActive(id){ return state.activeEvent?.id === id || state.side?.id === id; }

// 🪖 Every shell is a row of backfill pushed in from the floor.
spawnTank = function(){
  state.tank = {x:-90, y:600, vx:118, shots:0, maxShots:2 + (state.level >= 4 ? 1 : 0) + (state.chaos > 70 ? 1 : 0),
    nextShot:performance.now() + 450, flashUntil:0, shotCol:null};
  spawnSmoke(26);
};
updateTank = function(t, dt = 1/60){
  const q = state.tank;
  if(!q) return;
  q.x += q.vx * dt;
  if(t >= q.nextShot && q.shots < q.maxShots){
    q.nextShot = t + 620;
    q.shots++;
    q.shotCol = rand(COLS);
    q.flashUntil = t + 140;
    pushGarbageRows(1, q.shotCol);
    burst(q.shotCol * CELL + 18, ROWS * CELL - 20, 28);
    screenKick('shake', 260);
    sfx('boom');
    checkPushedOut();
  }
  if(q.x > 450) state.tank = null;
};

// ☄️ Each impact digs a small crater and throws more debris back than it dug.
updateMeteors = function(t, dt = 1/60){
  if(!state.meteors.length) return;
  state.meteors.forEach(m => {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.vy += 216 * dt;
    m.spin += 15 * dt;
    m.trail.unshift({x:m.x, y:m.y});
    if(m.trail.length > 9) m.trail.pop();
    const cx = clamp(Math.floor(m.x / CELL), 0, COLS - 1);
    const cy = Math.floor(m.y / CELL);
    const hitStack = cy >= 0 && cy < ROWS && state.board[cy][cx];
    if(hitStack || m.y > ROWS * CELL - 6){
      const iy = clamp(cy, 0, ROWS - 1);
      const dug = crater(cx, iy, 1);
      scatterDebris(dug + 2, cx);
      state.chaos = clamp(state.chaos + 5, 0, 100);
      burst(m.x, iy * CELL + CELL / 2, 42);
      spawnSmoke(4);
      screenKick('shake', 320);
      sfx('impact');
      m.done = true;
    }
  });
  if(state.meteors.some(m => m.done)){ clearLines(); checkPushedOut(); }
  state.meteors = state.meteors.filter(m => !m.done);
};

// 🏗️ The wrecking ball rips cells out of the top of the stack and flings
// every one of them somewhere else. Nothing is evacuated any more.
updateWreck = function(t, dt = 1/60){
  const w = state.wreck;
  if(!w) return;
  w.x += w.vx * dt;
  w.swing += 5.4 * dt;
  const cx = Math.floor(w.x / CELL);
  if(cx >= 0 && cx < COLS && cx !== w.lastCol){
    w.lastCol = cx;
    let ripped = 0;
    for(let y = w.band; y < Math.min(ROWS, w.band + 3); y++){
      if(state.board[y][cx] && rng() < .7){ state.board[y][cx] = 0; ripped++; }
    }
    if(ripped){
      w.hits += ripped;
      scatterDebris(ripped + (rng() < .5 ? 1 : 0));
      burst(cx * CELL + CELL / 2, (w.band + 1) * CELL, 12);
      screenKick('shake', 140);
      sfx('clank');
    }
  }
  if(w.x > COLS * CELL + 80){ state.wreck = null; clearLines(); checkPushedOut(); }
};

// 🧪 Acid goes for the rows you were about to complete.
updateAcid = function(t){
  const a = state.acid;
  if(!a || t < a.nextBite) return;
  a.nextBite = t + 520;
  a.bites++;
  const targets = [];
  for(let y = 0; y < ROWS; y++){
    const filled = state.board[y].filter(Boolean).length;
    if(filled >= 6 && filled < COLS) targets.push(y);
  }
  let eaten = 0;
  targets.sort((a, b) => state.board[b].filter(Boolean).length - state.board[a].filter(Boolean).length);
  for(const y of targets.slice(0, 2)){
    const cells = [];
    for(let x = 0; x < COLS; x++) if(state.board[y][x]) cells.push(x);
    const x = cells[rand(cells.length)];
    state.board[y][x] = 0;
    eaten++;
    state.particles.push({x:x * CELL + CELL / 2, y:y * CELL + CELL / 2, vx:(rng() - .5) * 80, vy:-40 - rng() * 60, life:.7, s:3 + rand(3), color:'#b9ff66'});
  }
  if(eaten) sfx('sizzle');
};

// 💣 Always malicious: the crater is refilled with interest.
explodeBomb = function(b){
  const y0 = Math.floor(b.y);
  const removed = crater(b.x, y0, 2);
  scatterDebris(removed + 3, b.x);
  state.chaos = clamp(state.chaos + 8, 0, 100);
  burst(b.x * CELL + 18, y0 * CELL + 18, 60);
  spawnSmoke(6);
  screenKick('shake', 480);
  sfx('boom');
  clearLines();
  checkPushedOut();
};

// 🙃 The floor rises and never comes back down.
liftStack = function(){
  const rows = 2 + rand(2) + (state.chaos > 75 ? 1 : 0);
  state.lifted = 0;
  pushGarbageRows(rows);
  state.chaos = clamp(state.chaos + 6, 0, 100);
  screenKick('shake', 300);
  sfx('warp');
  checkPushedOut();
};
dropStack = function(){ state.lifted = 0; };

// 💧 The blocks stay put; your controls do not.
liquifyBoard = function(){ state.waterCells = []; };
updateWater = function(){};
settleWater = function(){ state.waterCells = []; };

const moveBeforePunish = move;
move = function(dx){
  const dir = incidentActive('glitch') ? -dx : dx;
  moveBeforePunish(dir);
  if(incidentActive('water') && rng() < .55) moveBeforePunish(dir);
};
const rotateBeforePunish = rotatePiece;
rotatePiece = function(){
  rotateBeforePunish();
  if(incidentActive('water') && rng() < .3) rotateBeforePunish();
};

// 🦆 The inspection now has consequences: the next piece is replaced by an
// S or a Z, and it stays replaced.
const spawnDuckBeforePunish = spawnDuck;
spawnDuck = function(){
  spawnDuckBeforePunish();
  if(!state.next) return;
  const type = rng() < .5 ? 3 : 4;
  state.next = {matrix:SHAPES[type].map(r => r.slice()), x:Math.floor(COLS / 2) - 2, y:-1, color:1 + type, type};
  drawNext();
};

// 📼 While reality buffers, the preview shows the wrong piece.
const drawNextBeforePunish = drawNext;
drawNext = function(){
  if(!incidentActive('glitch') || !state.next) return drawNextBeforePunish();
  const real = state.next;
  const fake = (real.type + 1 + fxRand(SHAPES.length - 1)) % SHAPES.length;
  state.next = {...real, matrix:SHAPES[fake].map(r => r.slice()), color:1 + fake};
  drawNextBeforePunish();
  state.next = real;
};

// 🌀 Sealing a breach buys one row, not four. Failing it costs three.
finishMini = function(){
  const m = state.mini;
  if(!m || m.done) return;
  m.done = true;
  if(m.three && window.Breach) window.Breach.stop(document.getElementById('breach'));
  if(m.success){
    state.board.pop();
    state.board.unshift(Array(COLS).fill(0));
    state.score += 600;
    state.chaos = clamp(state.chaos - 6, 0, 100);
    sfx('success');
  }else{
    pushGarbageRows(2 + rand(2));
    state.chaos = clamp(state.chaos + 16, 0, 100);
    sfx('fail');
  }
  setTimeout(() => {
    state.mini = null;
    state.inputLocked = false;
    cabinet.classList.remove('miniworld');
    scheduleNextEvent(performance.now());
    rethemeMusic('base');
    eventTitle.textContent = 'SYSTEM NOMINAL';
    eventText.textContent = 'Tu es revenu dans la grille. Ne demande pas comment.';
    if(state.pushedOut || collides(state.piece, 0, 0)){ state.pushedOut = false; endGame(); }
  }, 1100);
};

// ------------------------------------------------------------------ frame loop

// Gravity is accumulated instead of "one drop per animation frame": at 50 ms
// per row the old loop rounded every drop up to the next frame and threw away
// missed ones, so late-game speed depended on the display (30/60/144 Hz) and
// slowed down on dropped frames. A long stall (tab switch) never teleports the
// piece more than a few rows.
gravityDrop = function(){
  if(!canInput()) return;
  const now = performance.now();
  const every = dropInterval();
  for(let n = 0; n < 4 && now - state.lastDrop >= every; n++){
    if(!collides(state.piece, 0, 1)){ state.piece.y++; state.lastDrop += every; }
    else{ merge(); state.lastDrop = now; return; }
  }
  if(now - state.lastDrop >= every) state.lastDrop = now;
};

// Same frame as runtime.js, but nothing touches the board or the score once a
// top-out has ended the run mid-frame: the submitted score is the final one.
update = function(t){
  const dt = state.lastFrame ? clamp((t - state.lastFrame) / 1000, 0, .05) : 1/60;
  state.lastFrame = t; state.frameDt = dt; state.time = t;
  const live = () => state.running && !state.paused && !state.gameOver;
  if(live()){
    if(!state.mini && t - state.lastDrop > dropInterval()) gravityDrop();
    if(live()) updateEvents(t, dt);
    if(live()){
      updateSheep(t, dt); updateBombs(t, dt); updateTank(t, dt); updateWater(dt);
      updateMeteors(t, dt); updateWreck(t, dt); updateMagnet(t, dt); updateAcid(t, dt); updateDuck(t, dt);
      if(state.mini) updateMini(t);
    }
  }
  if(state.running && !state.paused){ updateParticles(dt); updateSmoke(dt); }
  draw();
  requestAnimationFrame(update);
};

// ------------------------------------------------------------------ lifecycle

const resetBeforePunish = resetGame;
resetGame = function(daily = false){
  state.survivedMs = 0;
  state.tideEvery = 0;
  state.tideLeft = 0;
  state.pushedOut = false;
  resetBeforePunish(daily);
  scheduleNextEvent(performance.now() + 1500);
};

window.StackPanicPunish = {pushGarbageRows, scatterDebris, tideInterval, RUBBLE};
