'use strict';

// V0.7 — the game stops being polite.
// This layer deliberately makes incidents more hostile while preserving two
// invariants: never delete the falling piece and never change the number of
// settled cells during a shuffle.

if (!EVENT_POOL.some(e => e.id === 'shuffle')) {
  EVENT_POOL.push({
    id:'shuffle', name:'RECONFIGURATION NON SOLLICITÉE', icon:'🔀', weight:15,
    minLevel:2, duration:7200,
    desc:'Le système optimise ta pile selon des critères qui ne te concernent pas.'
  });
}
if (!HEAVY_EVENTS.includes('shuffle')) HEAVY_EVENTS.push('shuffle');
if (!HEAVY_EVENTS.includes('sheep')) HEAVY_EVENTS.push('sheep');

state.shuffleEvent = null;

function fallingRows(){
  const rows = new Set();
  const p = state.piece;
  if(!p) return rows;
  p.matrix.forEach((row,dy)=>row.forEach((v,dx)=>{
    if(v){ const y=p.y+dy; if(y>=0&&y<ROWS) rows.add(y); }
  }));
  return rows;
}

function shuffledColumns(count, forbidden = new Set()){
  const cols = Array.from({length:COLS},(_,i)=>i).filter(x=>!forbidden.has(x));
  for(let i=cols.length-1;i>0;i--){ const j=rand(i+1); [cols[i],cols[j]]=[cols[j],cols[i]]; }
  return cols.slice(0,count);
}

function scrambleSettledRows(rowCount = 3){
  const protectedRows = fallingRows();
  const candidates=[];
  for(let y=2;y<ROWS;y++){
    if(protectedRows.has(y)) continue;
    const filled=state.board[y].filter(Boolean).length;
    if(filled>=2 && filled<COLS) candidates.push(y);
  }
  for(let i=candidates.length-1;i>0;i--){const j=rand(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const picked=candidates.slice(0,Math.min(rowCount,candidates.length));
  let moved=0;
  for(const y of picked){
    const values=state.board[y].filter(Boolean);
    const next=Array(COLS).fill(0);
    const positions=shuffledColumns(values.length);
    values.forEach((v,i)=>next[positions[i]]=v);
    for(let x=0;x<COLS;x++) if(next[x]!==state.board[y][x]) moved++;
    state.board[y]=next;
  }
  return moved;
}

function liftBadlyPlacedBlocks(count = 2){
  const protectedRows=fallingRows();
  let moved=0;
  for(let n=0;n<count;n++){
    const sources=[];
    for(let y=6;y<ROWS;y++) for(let x=0;x<COLS;x++) if(state.board[y][x]) sources.push({x,y});
    if(!sources.length) break;
    const src=sources[rand(sources.length)];
    const targets=[];
    for(let dy=2;dy<=5;dy++){
      const ty=src.y-dy;
      if(ty<2||protectedRows.has(ty)) continue;
      for(let dx=-3;dx<=3;dx++){
        const tx=src.x+dx;
        if(tx>=0&&tx<COLS&&!state.board[ty][tx]) targets.push({x:tx,y:ty});
      }
    }
    if(!targets.length) continue;
    const dst=targets[rand(targets.length)];
    state.board[dst.y][dst.x]=state.board[src.y][src.x];
    state.board[src.y][src.x]=0;
    moved++;
  }
  return moved;
}

function sabotagePulse(rows=3,lifts=2,label='PILE RECONFIGURÉE'){
  const shuffled=scrambleSettledRows(rows);
  const lifted=liftBadlyPlacedBlocks(lifts);
  if(!shuffled&&!lifted) return false;
  state.chaos=clamp(state.chaos+4,0,100);
  screenKick('shake',360);
  burst(180,420,28+rows*5);
  sfx('crash');
  if(window.StackPanicFX?.lensPulse) window.StackPanicFX.lensPulse(.7);
  showBanner(`🔀 ${label}`,`${shuffled} positions brassées · ${lifted} blocs remontés.`);
  return true;
}

// Faster baseline, then chaos itself squeezes the reaction window further.
dropInterval = function(){
  return Math.max(72, 590 - (state.level-1)*62 - state.chaos*1.15);
};

// Shorter calm periods. A heavy incident still gets a breath, but no longer a
// multi-second safety blanket just because it was dangerous.
scheduleNextEvent = function(now,recovery=0){
  const pressure=1-clamp(state.chaos,0,100)/100*.8;
  const min=Math.max(1200,(6800-state.level*430)*pressure);
  const max=Math.max(2500,(10800-state.level*470)*pressure);
  state.nextEventAt=now+Math.min(recovery,1200)*pressure+min+rng()*(max-min);
};

// No more automatic mercy near the ceiling. Back-to-back heavy incidents are
// only suppressed while chaos is still relatively low.
weightedEvent = function(){
  const recent=state.recentEvents||[];
  const lastWasHeavy=HEAVY_EVENTS.includes(state.eventCooldown);
  let eligible=EVENT_POOL.filter(e=>{
    if(e.minLevel>state.level) return false;
    if(recent.includes(e.id)) return false;
    if(lastWasHeavy&&HEAVY_EVENTS.includes(e.id)&&state.chaos<55) return false;
    return true;
  });
  if(!eligible.length) eligible=EVENT_POOL.filter(e=>e.minLevel<=state.level&&e.id!==state.eventCooldown);
  if(!eligible.length) eligible=EVENT_POOL.slice();
  const weighted=eligible.map(e=>{
    let weight=e.weight;
    if(HEAVY_EVENTS.includes(e.id)) weight*=1+state.chaos/95;
    if(e.id==='shuffle') weight*=1+state.chaos/80;
    if(e.id==='sheep') weight*=1.15;
    return {e,weight};
  });
  const total=weighted.reduce((s,x)=>s+x.weight,0);let r=rng()*total;
  for(const x of weighted){r-=x.weight;if(r<=0)return x.e;}
  return weighted[0].e;
};

spawnSheep = function(){
  state.sheep=Array.from({length:12+rand(9)},(_,i)=>({
    x:-55-rand(320)-i*14,
    y:80+rand(570),
    vx:130+rng()*185,
    bounce:fxRng()*6,
    hits:0,
    mood:fxRand(3)
  }));
};

function sheepShove(bx,by){
  if(!state.board[by]?.[bx]) return false;
  const color=state.board[by][bx];
  const dirs=rng()>.5?[1,-1]:[-1,1];
  for(const dir of dirs){
    const distance=1+rand(3);
    const tx=bx+dir*distance;
    if(tx>=0&&tx<COLS&&!state.board[by][tx]){
      state.board[by][tx]=color;state.board[by][bx]=0;return true;
    }
  }
  // If there is nowhere to shove into, swap with a neighbour instead.
  const tx=clamp(bx+(rng()>.5?1:-1),0,COLS-1);
  if(tx!==bx){[state.board[by][tx],state.board[by][bx]]=[state.board[by][bx],state.board[by][tx]];return true;}
  return false;
}

updateSheep = function(t,dt=1/60){
  let impacts=0;
  state.sheep.forEach(s=>{
    s.x+=s.vx*dt;
    s.bounce=Math.sin(t/115+s.y)*7;
    if(s.x>55&&s.x<335&&s.hits<2){
      const bx=clamp(Math.floor(s.x/CELL),0,COLS-1);
      const by=clamp(Math.floor(s.y/CELL),0,ROWS-1);
      if(state.board[by]?.[bx]&&sheepShove(bx,by)){
        s.hits++;impacts++;
        s.x+=18;
        sfx('bleat');
        burst(bx*CELL+CELL/2,by*CELL+CELL/2,9);
      }
    }
  });
  if(impacts>=2 && rng()<.28) scrambleSettledRows(1);
  state.sheep=state.sheep.filter(s=>s.x<440);
};

function startShuffleSabotage(t){
  state.shuffleEvent={next:t+450,pulses:0,max:3+(state.chaos>70?1:0)};
  rethemeMusic('glitch');
}
function updateShuffleSabotage(t){
  const q=state.shuffleEvent;
  if(!q||state.activeEvent?.id!=='shuffle'||t<q.next||q.pulses>=q.max) return;
  q.pulses++;
  q.next=t+950+rand(550);
  sabotagePulse(2+rand(3),1+rand(3),`BRASSAGE ${q.pulses}/${q.max}`);
}

const triggerBeforeSabotage=triggerRandomEvent;
triggerRandomEvent=function(t){
  triggerBeforeSabotage(t);
  if(state.activeEvent?.id==='shuffle') startShuffleSabotage(t);
};

const updateEventsBeforeSabotage=updateEvents;
updateEvents=function(t,dt=1/60){
  updateEventsBeforeSabotage(t,dt);
  updateShuffleSabotage(t);
};

const endEventBeforeSabotage=endEvent;
endEvent=function(){
  const id=state.activeEvent?.id;
  if(id==='sheep') sabotagePulse(3+(state.chaos>65?1:0),2,'RUÉE TERMINÉE, PILE PIÉTINÉE');
  if(id==='shuffle'){
    if(state.shuffleEvent && state.shuffleEvent.pulses<state.shuffleEvent.max) sabotagePulse(3,2,'DERNIÈRE OPTIMISATION');
    state.shuffleEvent=null;
  }
  endEventBeforeSabotage();
};

const resetBeforeSabotage=resetGame;
resetGame=function(daily=false){
  state.shuffleEvent=null;
  resetBeforeSabotage(daily);
};
