function scheduleNextEvent(now,recovery=0){
  // The calmer the run, the longer the pause. Once the chaos meter climbs, the
  // gaps collapse: at full chaos the next incident is already on its way
  // before you have finished cleaning up after the last one.
  const pressure=1-clamp(state.chaos,0,100)/100*.72;
  const min=Math.max(1800,(9000-state.level*500)*pressure);
  const max=Math.max(3600,(15000-state.level*550)*pressure);
  state.nextEventAt=now+recovery*pressure+min+rng()*(max-min);
}

// Incidents that can really hurt a run. Two of them never happen back to back,
// and none of them fire while the stack is already about to top out.
const HEAVY_EVENTS=['bomb','tank','glitch','miniworld','meteor','wreck','magnet','gravity'];
// Incidents with no effect on the board at all. Once the run is properly out
// of hand they are allowed to run *on top of* whatever else is happening,
// because one catastrophe at a time stopped being the house style.
const SIDE_EVENTS=['duck','ad','sheep','blackout'];
const SIDE_CHAOS=42;
const RECOVERY_MS=3800;
const DANGER_ROWS=5;

function stackInDanger(){ return highestStack()>=ROWS-DANGER_ROWS; }

function updateEvents(t){
  if(!state.activeEvent && !state.mini && t>=state.nextEventAt){ triggerRandomEvent(t); }
  if(state.activeEvent && state.eventUntil && t>=state.eventUntil) endEvent();
  updateSideEvent(t);
  if(!state.activeEvent && !state.mini) state.chaos=Math.max(0,state.chaos-.004);
}

// A second, harmless incident layered over the first. It never touches the
// board — it only makes the screen harder to read at the worst moment.
function updateSideEvent(t){
  if(state.side){
    if(t>=state.side.until) endSideEvent();
    return;
  }
  if(state.mini||state.chaos<SIDE_CHAOS||t<(state.nextSideAt||0))return;
  const pool=EVENT_POOL.filter(e=>SIDE_EVENTS.includes(e.id)&&e.id!==state.activeEvent?.id);
  if(!pool.length){state.nextSideAt=t+6000;return;}
  const e=pool[rand(pool.length)];
  state.side={id:e.id,until:t+e.duration};
  cabinet.classList.add(e.id);
  showBanner(`${e.icon} ${e.name}`,'Et pendant ce temps, en parallèle…');
  if(e.id==='duck') spawnDuck();
  if(e.id==='ad') showAd();
  if(e.id==='sheep') spawnSheep();
  if(e.id==='blackout') spawnSmoke(14);
  state.nextSideAt=t+e.duration+2500+rng()*5000;
}
function endSideEvent(){
  if(!state.side)return;
  const id=state.side.id;
  // The main incident may be using the same class; only drop it if it is not.
  if(state.activeEvent?.id!==id) cabinet.classList.remove(id);
  if(id==='ad') hideAd();
  if(id==='duck') state.duck=null;
  if(id==='sheep') state.sheep=[];
  if(id==='blackout') state.smoke=[];
  state.side=null;
}

function weightedEvent(){
  const recent=state.recentEvents||[];
  const lastWasHeavy=HEAVY_EVENTS.includes(state.eventCooldown);
  const danger=stackInDanger();
  let eligible=EVENT_POOL.filter(e=>{
    if(e.minLevel>state.level) return false;
    if(recent.includes(e.id)) return false;
    // No piling on: not twice in a row, and not while the well is nearly full.
    if(HEAVY_EVENTS.includes(e.id)&&(lastWasHeavy||danger)) return false;
    return true;
  });
  // The breach is the way out of a bad spot, so it stays available when the
  // stack is high — it is the one heavy incident that can save the run.
  if(danger&&!lastWasHeavy){
    const breach=EVENT_POOL.find(e=>e.id==='miniworld'&&e.minLevel<=state.level);
    if(breach&&!recent.includes('miniworld')) eligible=eligible.concat(breach);
  }
  if(!eligible.length) eligible=EVENT_POOL.filter(e=>e.minLevel<=state.level&&e.id!==state.eventCooldown);
  if(!eligible.length) eligible=EVENT_POOL.slice();
  const total=eligible.reduce((s,e)=>s+e.weight,0); let r=rng()*total;
  for(const e of eligible){r-=e.weight;if(r<=0)return e;} return eligible[0];
}

function triggerRandomEvent(t){
  const e=weightedEvent(); state.eventCooldown=e.id;
  state.recentEvents=[e.id,...(state.recentEvents||[])].slice(0,3);
  state.activeEvent=e; state.chaos=clamp(state.chaos+12,0,100);
  showBanner(`${e.icon} ${e.name}`,e.desc); eventTitle.textContent=e.name;eventText.textContent=e.desc;sfx('alert');
  if(e.id==='miniworld'){ setTimeout(()=>beginMiniWorld(),900); return; }
  state.eventUntil=t+e.duration; cabinet.classList.add(e.id);
  if(e.id==='sheep') spawnSheep();
  if(e.id==='water') liquifyBoard();
  if(e.id==='bomb') spawnBomb();
  if(e.id==='tank') spawnTank();
  if(e.id==='blackout') spawnSmoke(18);
  if(e.id==='glitch') glitchBoard();
  if(e.id==='duck') spawnDuck();
  if(e.id==='meteor') spawnMeteors(t);
  if(e.id==='wreck') spawnWreckingBall(t);
  if(e.id==='magnet') startMagnet(t);
  if(e.id==='acid') startAcid(t);
  if(e.id==='gravity') liftStack();
  if(e.id==='bsod') showCrash();
  if(e.id==='ad') showAd();
  rethemeMusic(e.id);
}

function endEvent(){
  if(!state.activeEvent)return;
  const id=state.activeEvent.id;
  cabinet.classList.remove(id);
  if(id==='water') settleWater();
  if(id==='gravity') dropStack();
  if(id==='bsod') hideCrash();
  if(id==='ad') hideAd();
  const wasHeavy=HEAVY_EVENTS.includes(id);
  state.activeEvent=null; state.eventUntil=0; state.bombs=[];
  state.meteors=[]; state.wreck=null; state.magnet=null; state.acid=null;
  if(state.side?.id!=='sheep') state.sheep=[];
  if(state.side?.id!=='blackout') state.smoke=[];
  eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Incident clos. Les techniciens nient toute responsabilité.';
  scheduleNextEvent(performance.now(),wasHeavy?RECOVERY_MS:0); rethemeMusic('base');
}

function showBanner(title,text){
  banner.querySelector('strong').textContent=title;banner.querySelector('span').textContent=text;banner.classList.add('show');
  setTimeout(()=>banner.classList.remove('show'),2600);
}

function spawnSheep(){
  state.sheep=Array.from({length:5+rand(6)},(_,i)=>({x:-45-rand(240)-i*20,y:100+rand(520),vx:1.5+rng()*2.3,bounce:rng()*6,hit:false}));
}
function updateSheep(t){
  state.sheep.forEach(s=>{s.x+=s.vx;s.bounce=Math.sin(t/130+s.y)*5;if(!s.hit&&s.x>70&&s.x<320){
    const bx=clamp(Math.floor(s.x/CELL),0,COLS-1);const by=clamp(Math.floor(s.y/CELL),0,ROWS-1);
    if(state.board[by][bx]){const dir=rng()>.5?1:-1;if(bx+dir>=0&&bx+dir<COLS&&!state.board[by][bx+dir]){state.board[by][bx+dir]=state.board[by][bx];state.board[by][bx]=0;}s.hit=true;state.score+=25;sfx('bleat');}
  }});
  state.sheep=state.sheep.filter(s=>s.x<430);
}

function liquifyBoard(){
  state.waterCells=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(state.board[y][x]&&rng()<.28) state.waterCells.push({x,y,color:state.board[y][x],phase:rng()*10});
}
function updateWater(){
  if(!state.activeEvent||state.activeEvent.id!=='water')return;
  if(rng()<.09){
    for(let y=ROWS-2;y>=0;y--)for(let x=0;x<COLS;x++) if(state.board[y][x]&&!state.board[y+1][x]&&rng()<.22){state.board[y+1][x]=state.board[y][x];state.board[y][x]=0;}
  }
}
function settleWater(){ for(let pass=0;pass<ROWS;pass++)for(let y=ROWS-2;y>=0;y--)for(let x=0;x<COLS;x++)if(state.board[y][x]&&!state.board[y+1][x]){state.board[y+1][x]=state.board[y][x];state.board[y][x]=0;} clearLines(); state.waterCells=[]; }

// A delivery of one to three packages, with a fuse short enough to matter.
function spawnBomb(){
  const count=1+(state.level>4?rand(3):rand(2));
  state.bombs=Array.from({length:count},(_,i)=>({
    x:1+rand(COLS-2),y:-1-i*3,vy:.075,armed:false,explodeAt:performance.now()+2600
  }));
}
function updateBombs(t){
  state.bombs.forEach(b=>{if(!b.armed){b.y+=b.vy*(16.6);const iy=Math.floor(b.y);if(iy>=ROWS-1||(iy>=0&&state.board[iy+1]?.[b.x])){b.armed=true;b.y=clamp(iy,0,ROWS-1);b.explodeAt=t+1400;}} else if(t>=b.explodeAt){explodeBomb(b);b.done=true;}}); state.bombs=state.bombs.filter(b=>!b.done);
}
function explodeBomb(b){
  // It always blows a hole. What varies is whether the neighbourhood gets
  // rebuilt in concrete afterwards.
  const y0=Math.floor(b.y);
  const removed=crater(b.x,y0,3);
  const malicious=rng()<.4;
  if(malicious){
    for(let yy=-4;yy<=4;yy++)for(let xx=-4;xx<=4;xx++){
      const x=b.x+xx,y=y0+yy;
      if(x<0||x>=COLS||y<0||y>=ROWS)continue;
      const d=Math.abs(xx)+Math.abs(yy);
      if(d===4&&!state.board[y][x]&&rng()<.55) state.board[y][x]=6;
    }
  }
  state.score+=removed*16;state.chaos=clamp(state.chaos+8,0,100);
  burst(b.x*CELL+18,y0*CELL+18,60);spawnSmoke(6);screenKick('shake',480);sfx('boom');clearLines();
  if(malicious) showBanner('💣 COLIS PIÉGÉ','Les gravats ont été livrés avec le cratère.');
}

function spawnTank(){
  state.tank={x:-90,y:600,vx:1.75,shots:0,nextShot:performance.now()+500};spawnSmoke(26);
}
function updateTank(t){
  if(!state.tank)return;const q=state.tank;q.x+=q.vx;
  if(t>=q.nextShot&&q.shots<4){q.nextShot=t+700;q.shots++;const col=rand(COLS);for(let y=ROWS-1;y>=Math.max(0,ROWS-5-rand(5));y--)state.board[y][col]=0;burst(col*CELL+18,570,28);screenKick('shake',240);sfx('boom');}
  if(q.x>450)state.tank=null;
}
function spawnSmoke(n){state.smoke.push(...Array.from({length:n},()=>({x:rand(360),y:380+rand(340),r:25+rand(55),a:.12+rng()*.2,vx:-.3+rng()*.6,vy:-.2-rng()*.5})));}
function updateSmoke(){state.smoke.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.a*=.995;});state.smoke=state.smoke.filter(s=>s.a>.025);}

function glitchBoard(){
  const rowA=6+rand(10),rowB=6+rand(10);[state.board[rowA],state.board[rowB]]=[state.board[rowB],state.board[rowA]];
  for(let i=0;i<3;i++){const y=5+rand(13);const shift=1+rand(3);state.board[y]=state.board[y].slice(shift).concat(state.board[y].slice(0,shift));}
}
function spawnDuck(){state.duck={x:-50,y:90+rand(450),vx:2.4+rng()*1.7,until:performance.now()+4200};sfx('duck');}

// --------------------------------------------------------------- demolition
//
// The incidents below do not merely annoy the stack: they take pieces of it
// away. Each one is destructive in a different shape, so the well never falls
// apart the same way twice.

// A crater centred on a cell: everything within `radius` in Manhattan distance
// stops existing. Returns how many cells were removed.
function crater(cx,cy,radius){
  let removed=0;
  for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){
    if(x<0||x>=COLS||y<0||y>=ROWS)continue;
    if(Math.abs(x-cx)+Math.abs(y-cy)>radius)continue;
    if(state.board[y][x]){state.board[y][x]=0;removed++;}
  }
  return removed;
}

// ☄️ Meteor shower: rocks arrive on a diagonal and punch holes wherever they
// land. Good for your height, terrible for your structure.
function spawnMeteors(t){
  const count=3+rand(4);
  state.meteors=Array.from({length:count},(_,i)=>({
    x:rand(COLS)*CELL+CELL/2,
    y:-80-i*(120+rand(220)),
    vx:(rng()-.5)*2.2,
    vy:5.2+rng()*3.4,
    spin:rng()*6,
    trail:[]
  }));
  screenKick('shake',400);sfx('rumble');
}
function updateMeteors(t){
  if(!state.meteors.length)return;
  state.meteors.forEach(m=>{
    m.x+=m.vx;m.y+=m.vy;m.vy+=.06;m.spin+=.25;
    m.trail.unshift({x:m.x,y:m.y});if(m.trail.length>9)m.trail.pop();
    const cx=clamp(Math.floor(m.x/CELL),0,COLS-1);
    const cy=Math.floor(m.y/CELL);
    const hitStack=cy>=0&&cy<ROWS&&state.board[cy][cx];
    if(hitStack||m.y>ROWS*CELL-6){
      const iy=clamp(cy,0,ROWS-1);
      const removed=crater(cx,iy,2);
      state.score+=removed*12;
      state.chaos=clamp(state.chaos+4,0,100);
      burst(m.x,iy*CELL+CELL/2,42);spawnSmoke(4);
      screenKick('shake',320);sfx('impact');
      m.done=true;
    }
  });
  if(state.meteors.some(m=>m.done)) clearLines();
  state.meteors=state.meteors.filter(m=>!m.done);
}

// 🏗️ Wrecking ball: swings across a three-row band and erases everything in
// its way. The single most destructive incident in the game.
function spawnWreckingBall(t){
  const top=clamp(ROWS-highestStack(),2,ROWS-4);
  state.wreck={x:-70,y:(top+1)*CELL,band:top,dir:1,swing:0,vx:2.6+state.level*.08,hits:0};
  sfx('swing');
}
function updateWreck(t){
  const w=state.wreck;if(!w)return;
  w.x+=w.vx;w.swing+=.09;
  const cx=Math.floor(w.x/CELL);
  if(cx>=0&&cx<COLS){
    let removed=0;
    for(let y=w.band;y<Math.min(ROWS,w.band+3);y++) if(state.board[y][cx]){state.board[y][cx]=0;removed++;}
    if(removed){
      w.hits+=removed;state.score+=removed*9;
      burst(cx*CELL+CELL/2,(w.band+1)*CELL,10);
      if(removed>1){screenKick('shake',140);sfx('clank');}
    }
  }
  if(w.x>COLS*CELL+80){
    state.wreck=null;clearLines();
    if(w.hits)showBanner('🏗️ CHANTIER TERMINÉ',`${w.hits} blocs évacués sans autorisation.`);
  }
}

// 🧲 Industrial magnet: every row slides to one wall. Your careful terraces
// become one slab, and whatever was holding an overhang up is gone.
function startMagnet(t){
  state.magnet={dir:rng()<.5?-1:1,nextPull:t,pulls:0};
  sfx('hum');
}
function updateMagnet(t){
  const m=state.magnet;if(!m||t<m.nextPull)return;
  m.nextPull=t+260;m.pulls++;
  let moved=0;
  for(let y=0;y<ROWS;y++){
    const row=state.board[y];
    if(m.dir<0){
      for(let x=1;x<COLS;x++) if(row[x]&&!row[x-1]){row[x-1]=row[x];row[x]=0;moved++;}
    }else{
      for(let x=COLS-2;x>=0;x--) if(row[x]&&!row[x+1]){row[x+1]=row[x];row[x]=0;moved++;}
    }
  }
  if(moved){sfx('clank');clearLines();}
  if(m.pulls>2&&!moved) state.magnet=null;
}

// 🧪 Acid rain: eats the stack from underneath, which is exactly where you
// were relying on it.
function startAcid(t){ state.acid={nextBite:t+400,bites:0}; sfx('sizzle'); }
function updateAcid(t){
  const a=state.acid;if(!a||t<a.nextBite)return;
  a.nextBite=t+620;a.bites++;
  let eaten=0;
  // Lower rows dissolve first: acid pools at the bottom of the well.
  for(let y=ROWS-1;y>=0&&eaten<6;y--){
    const chance=.05+(y/ROWS)*.22;
    for(let x=0;x<COLS;x++){
      if(state.board[y][x]&&rng()<chance){
        state.board[y][x]=0;eaten++;
        state.particles.push({x:x*CELL+CELL/2,y:y*CELL+CELL/2,vx:(rng()-.5)*1.4,vy:-.6-rng(),life:.7,s:3+rand(3),color:'#b9ff66'});
      }
    }
  }
  if(eaten){state.score+=eaten*4;sfx('sizzle');clearLines();}
}

// 🙃 Gravity inversion: the stack detaches and floats. Pieces then fall into
// the gap underneath it, which is either the save of your run or the end of
// it. The lift is capped so the mass can never be pushed into the ceiling.
function liftStack(){
  const headroom=ROWS-highestStack()-2;
  const lift=clamp(2+rand(3),0,Math.max(0,headroom));
  state.lifted=lift;
  if(!lift){showBanner('🙃 GRAVITÉ RÉSILIÉE','La pile est déjà au plafond. Elle reste où elle est.');return;}
  for(let i=0;i<lift;i++){ state.board.shift(); state.board.push(Array(COLS).fill(0)); }
  state.chaos=clamp(state.chaos+6,0,100);
  screenKick('shake',300);sfx('warp');
}
function dropStack(){
  if(!state.lifted)return;
  state.lifted=0;
  // Everything that was floating comes down at once.
  for(let pass=0;pass<ROWS;pass++)
    for(let y=ROWS-2;y>=0;y--)
      for(let x=0;x<COLS;x++)
        if(state.board[y][x]&&!state.board[y+1][x]){state.board[y+1][x]=state.board[y][x];state.board[y][x]=0;}
  burst(180,600,36);screenKick('shake',420);sfx('impact');clearLines();
}

// 💀 A convincing crash screen. The game does not stop behind it — that is
// the joke, and the danger.
function showCrash(){
  const el=document.getElementById('crash');
  if(!el)return;
  el.querySelector('.crash-code').textContent=`STOP 0x${rand(0xffffff).toString(16).toUpperCase().padStart(6,'0')}`;
  el.hidden=false;sfx('crash');
}
function hideCrash(){ const el=document.getElementById('crash'); if(el)el.hidden=true; }

// 📺 A commercial break, in the middle of your board, because someone has to
// pay for all this.
const AD_COPY=[
  ['BLOCS PREMIUM','Les mêmes blocs, mais avec un abonnement mensuel.'],
  ['ASSURANCE PILE','Couvre tout sauf les moutons, les bombes et les tanks.'],
  ['MÉTÉORES™','Livraison depuis l’espace en moins de 24 h.'],
  ['CANARD PRO','Inspectez vos propres piles. Sans formation.']
];
function showAd(){
  const el=document.getElementById('advert');
  if(!el)return;
  const [title,line]=AD_COPY[rand(AD_COPY.length)];
  el.querySelector('strong').textContent=title;
  el.querySelector('span').textContent=line;
  el.hidden=false;sfx('jingle');
}
function hideAd(){ const el=document.getElementById('advert'); if(el)el.hidden=true; }

function drawEventActors(){
  state.sheep.forEach(s=>{ctx.save();ctx.translate(s.x,s.y+s.bounce);ctx.font='30px sans-serif';ctx.fillText('🐑',-15,12);ctx.restore();});
  state.bombs.forEach(b=>{ctx.font='30px sans-serif';ctx.fillText('💣',b.x*CELL+2,b.y*CELL+28);if(b.armed){ctx.fillStyle='rgba(255,95,104,.75)';ctx.fillRect(b.x*CELL+5,b.y*CELL+32,26,3);}});
  if(state.tank){ctx.save();ctx.translate(state.tank.x,state.tank.y);ctx.font='62px sans-serif';ctx.fillText('🪖',0,0);ctx.fillStyle='#7c8a50';ctx.fillRect(8,-25,76,24);ctx.fillStyle='#1d2614';ctx.fillRect(18,-36,32,14);ctx.restore();}
  if(state.duck){state.duck.x+=state.duck.vx;ctx.save();ctx.translate(state.duck.x,state.duck.y);ctx.font='38px sans-serif';ctx.fillText('🦆',0,0);ctx.font='700 11px monospace';ctx.fillStyle='#ffd166';ctx.fillText('INSPECTION',-12,18);ctx.restore();if(state.duck.x>420)state.duck=null;}
  state.meteors.forEach(m=>{
    ctx.save();
    m.trail.forEach((p,i)=>{ctx.globalAlpha=.35*(1-i/m.trail.length);ctx.fillStyle=i<3?'#ffd166':'#ff7a59';ctx.beginPath();ctx.arc(p.x,p.y,11-i,0,Math.PI*2);ctx.fill();});
    ctx.globalAlpha=1;ctx.translate(m.x,m.y);ctx.rotate(m.spin);
    ctx.font='30px sans-serif';ctx.fillText('☄️',-16,10);
    ctx.restore();
  });
  if(state.wreck){
    const w=state.wreck;const anchorY=w.y-120;const sway=Math.sin(w.swing)*16;
    ctx.save();
    ctx.strokeStyle='rgba(200,206,220,.8)';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(w.x-sway,anchorY);ctx.lineTo(w.x,w.y);ctx.stroke();
    ctx.fillStyle='#8a8f9c';ctx.beginPath();ctx.arc(w.x,w.y,21,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.arc(w.x-7,w.y-7,7,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  if(state.magnet){
    const m=state.magnet;const x=m.dir<0?6:COLS*CELL-46;
    ctx.save();ctx.globalAlpha=.85;ctx.font='34px sans-serif';ctx.fillText('🧲',x,ROWS*CELL/2);
    ctx.globalAlpha=.16;ctx.strokeStyle='#43efff';ctx.lineWidth=2;
    for(let i=1;i<5;i++){ctx.beginPath();ctx.arc(m.dir<0?0:COLS*CELL,ROWS*CELL/2,i*44,-Math.PI/2,Math.PI/2,m.dir>0);ctx.stroke();}
    ctx.restore();
  }
  if(state.acid){
    ctx.save();ctx.globalAlpha=.2;ctx.fillStyle='#b9ff66';
    for(let i=0;i<26;i++){const x=rand(COLS*CELL);const y=rand(ROWS*CELL);ctx.fillRect(x,y,2,9);}
    ctx.restore();
  }
  state.smoke.forEach(s=>{ctx.save();ctx.globalAlpha=s.a;ctx.fillStyle='#afb4c0';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.restore();});
  state.particles.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.s,p.s);ctx.restore();});
}

function burst(x,y,n=25){for(let i=0;i<n;i++)state.particles.push({x,y,vx:-3+rng()*6,vy:-4+rng()*7,life:.6+rng()*.4,s:2+rand(5),color:COLORS[1+rand(7)]});}
function updateParticles(){state.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.life-=.018;});state.particles=state.particles.filter(p=>p.life>0);}

function drawOverlay(){
  octx.clearRect(0,0,overlay.width,overlay.height);
  if(state.activeEvent?.id==='glitch'||state.side?.id==='glitch'){
    for(let i=0;i<8;i++){const y=rand(720);octx.fillStyle=`rgba(${rand(2)?255:67},${rand(2)?90:239},255,.08)`;octx.fillRect(rand(40)-20,y,360,2+rand(9));}
  }
  if(state.activeEvent?.id==='blackout'||state.side?.id==='blackout'){
    const g=octx.createRadialGradient(180,480,35,180,480,240);g.addColorStop(0,'rgba(0,0,0,.12)');g.addColorStop(1,'rgba(0,0,0,.84)');octx.fillStyle=g;octx.fillRect(0,0,360,720);
  }
  if(state.mini) drawMini();
}

function beginMiniWorld(){
  state.activeEvent=null;state.eventUntil=0;state.inputLocked=true;cabinet.classList.add('miniworld');
  const height=highestStack(); const density=boardDensity();
  state.mini={started:performance.now(),duration:16000,playerX:0,playerZ:0,velX:0,targetX:(rng()-.5)*5,targetZ:-18-density*8,success:false,done:false,height,density,orbs:3,keys:{},three:false,last:performance.now(),metresLeft:0,bumps:0};
  // The tunnel is built in 3D from the player's own stack. If WebGL is missing,
  // the original flat tunnel still runs: the breach never blocks a run.
  const breachCanvas=document.getElementById('breach');
  if(window.Breach&&breachCanvas){
    try{
      window.Breach.start({canvas:breachCanvas,board:state.board,cols:COLS,rows:ROWS,height,density,duration:state.mini.duration});
      state.mini.three=true;
    }catch(err){ console.warn('3D breach unavailable, falling back to the flat tunnel',err); state.mini.three=false; }
  }
  eventTitle.textContent='MICRO-WORLD BREACH';eventText.textContent='Traverse le tunnel. Les parois viennent de ta pile.';
  showBanner('🌀 MICRO-WORLD BREACH','Flèches / WASD : trouve la sortie avant la fermeture.');rethemeMusic('miniworld');sfx('warp');
}

function highestStack(){for(let y=0;y<ROWS;y++)if(state.board[y].some(Boolean))return ROWS-y;return 0;}
function boardDensity(){let n=0;state.board.forEach(r=>r.forEach(v=>n+=!!v));return n/(ROWS*COLS);}

function updateMini(t){
  const m=state.mini;if(!m)return;
  const left=!!(m.keys.ArrowLeft||m.keys.a),right=!!(m.keys.ArrowRight||m.keys.d),up=!!(m.keys.ArrowUp||m.keys.w),down=!!(m.keys.ArrowDown||m.keys.s);
  if(m.three){
    const dt=Math.min(.05,(t-m.last)/1000||0); m.last=t;
    const info=window.Breach.update(dt,{left,right,up,down,boost:!!m.keys[' ']});
    if(info){
      m.metresLeft=info.metresLeft; m.remaining=info.remaining; m.bumps=info.bumps;
      if(info.done&&!m.done){ m.success=info.success; finishMini(); }
    }
    return;
  }
  m.velX+=((right?1:0)-(left?1:0))*.018;
  m.velX*=.88;
  m.playerX=clamp(m.playerX+m.velX,-4.8,4.8);
  m.playerZ-=.055+(up ? .04 : 0)-(down ? .025 : 0);
  const corridor=3.6-m.density*2.2; const wave=Math.sin(m.playerZ*.34)*(.7+m.height*.025);
  if(Math.abs(m.playerX-wave)>corridor){m.playerZ+=.13;m.velX*=-.5;sfx('bump');}
  if(m.playerZ<=m.targetZ){m.success=true;finishMini();}
  else if(t-m.started>m.duration){finishMini();}
}

function finishMini(){
  const m=state.mini;if(!m||m.done)return;m.done=true;
  if(m.three&&window.Breach) window.Breach.stop(document.getElementById('breach'));
  if(m.success){
    const clear=2+rand(3);for(let i=0;i<clear;i++){state.board.pop();state.board.unshift(Array(COLS).fill(0));}state.score+=750+clear*180;state.chaos=clamp(state.chaos-18,0,100);showBanner('✅ BREACH SEALED',`${clear} couches structurelles supprimées.`);sfx('success');
  }else{
    const add=1+rand(2);for(let i=0;i<add;i++){state.board.shift();state.board.push(Array.from({length:COLS},()=>rng()<.72?8:0));}state.chaos=clamp(state.chaos+16,0,100);showBanner('❌ BREACH COLLAPSED',`${add} couche(s) parasite(s) ajoutée(s).`);sfx('fail');
  }
  setTimeout(()=>{state.mini=null;state.inputLocked=false;cabinet.classList.remove('miniworld');scheduleNextEvent(performance.now(),RECOVERY_MS);rethemeMusic('base');eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Tu es revenu dans la grille. Ne demande pas comment.';if(collides(state.piece,0,0))endGame();},1100);
}

function drawMini(){
  const m=state.mini;if(!m)return;
  if(m.three){ drawMiniHud(m); return; }
  octx.save();octx.fillStyle='rgba(2,4,10,.94)';octx.fillRect(0,0,360,720);
  const horizon=235;octx.fillStyle='#0a1021';octx.fillRect(0,horizon,360,485);
  for(let i=0;i<28;i++){
    const z=(i+(Math.abs(m.playerZ)%1))*1.3;const perspective=1/(.3+z*.12);const cy=horizon+z*16;const offset=Math.sin((m.playerZ-i)*.34)*(18+m.height*1.2);
    const half=clamp((118-m.density*75)*perspective*2.5,30,160);
    octx.strokeStyle=`rgba(67,239,255,${clamp(.55-i*.016,.08,.5)})`;octx.lineWidth=1.2;octx.strokeRect(180+offset-half,cy,half*2,42*perspective+8);
  }
  const px=180+m.playerX*22;octx.fillStyle='#ff5ab7';octx.beginPath();octx.moveTo(px,585);octx.lineTo(px-10,610);octx.lineTo(px+10,610);octx.closePath();octx.fill();
  octx.shadowColor='#43efff';octx.shadowBlur=18;octx.fillStyle='#43efff';octx.beginPath();octx.arc(180+m.targetX*12,horizon+30,8,0,Math.PI*2);octx.fill();octx.shadowBlur=0;
  const elapsed=performance.now()-m.started, remain=Math.max(0,m.duration-elapsed);octx.fillStyle='rgba(0,0,0,.52)';octx.fillRect(18,18,324,72);octx.fillStyle='#fff';octx.font='900 18px monospace';octx.fillText('STRUCTURAL BREACH',30,45);octx.fillStyle='#ffd166';octx.font='800 13px monospace';octx.fillText(`EXIT ${Math.max(0,Math.ceil((m.playerZ-m.targetZ)*4))}m   T-${(remain/1000).toFixed(1)}`,30,72);
  octx.restore();
}

function drawMiniHud(m){
  const remain=m.remaining!==undefined?m.remaining:Math.max(0,m.duration-(performance.now()-m.started));
  octx.save();
  octx.fillStyle='rgba(0,0,0,.52)';octx.fillRect(18,18,324,72);
  octx.fillStyle='#fff';octx.font='900 18px monospace';octx.fillText('STRUCTURAL BREACH',30,45);
  octx.fillStyle=remain<4000?'#ff5ab7':'#ffd166';octx.font='800 13px monospace';
  octx.fillText(`EXIT ${m.metresLeft||0}m   T-${(remain/1000).toFixed(1)}`,30,72);
  if(m.bumps){octx.fillStyle='rgba(255,90,183,.9)';octx.font='700 11px monospace';octx.fillText(`IMPACTS ${m.bumps}`,250,72);}
  octx.restore();
}
