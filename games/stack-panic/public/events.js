function scheduleNextEvent(now,recovery=0){
  const pressure=state.chaos/100;
  const min=Math.max(6500,15000-state.level*650-pressure*2200);
  const max=Math.max(10500,23000-state.level*700-pressure*3200);
  state.nextEventAt=now+recovery+min+rng()*(max-min);
}

const HEAVY_EVENTS=['bomb','tank','glitch','miniworld'];
const RECOVERY_MS=7000;
const DANGER_ROWS=5;

function stackInDanger(){ return highestStack()>=ROWS-DANGER_ROWS; }
function chancePerFrame(p,dt){ return 1-Math.pow(1-p,Math.max(0,dt)*60); }

function updateEvents(t,dt=1/60){
  if(!state.activeEvent && !state.mini && t>=state.nextEventAt){ triggerRandomEvent(t); }
  if(state.activeEvent && state.eventUntil && t>=state.eventUntil) endEvent();
  if(!state.activeEvent && !state.mini) state.chaos=Math.max(0,state.chaos-.24*dt);
}

function weightedEvent(){
  const recent=state.recentEvents||[];
  const lastWasHeavy=HEAVY_EVENTS.includes(state.eventCooldown);
  const danger=stackInDanger();
  let eligible=EVENT_POOL.filter(e=>{
    if(e.minLevel>state.level) return false;
    if(recent.includes(e.id)) return false;
    if(HEAVY_EVENTS.includes(e.id)&&(lastWasHeavy||danger)) return false;
    return true;
  });
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
  if(e.id==='miniworld'){ setTimeout(()=>{if(state.running&&!state.gameOver)beginMiniWorld();},900); return; }
  state.eventUntil=t+e.duration; cabinet.classList.add(e.id);
  if(e.id==='sheep') spawnSheep();
  if(e.id==='water') liquifyBoard();
  if(e.id==='bomb') spawnBomb();
  if(e.id==='tank') spawnTank();
  if(e.id==='blackout') spawnSmoke(18);
  if(e.id==='glitch') glitchBoard();
  if(e.id==='duck') spawnDuck();
  rethemeMusic(e.id);
}

function endEvent(){
  if(!state.activeEvent)return;
  cabinet.classList.remove(state.activeEvent.id);
  if(state.activeEvent.id==='water') settleWater();
  const wasHeavy=HEAVY_EVENTS.includes(state.activeEvent.id);
  state.activeEvent=null; state.eventUntil=0; state.sheep=[]; state.bombs=[]; state.smoke=[];state.duck=null;
  eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Incident clos. Les techniciens nient toute responsabilité.';
  scheduleNextEvent(performance.now(),wasHeavy?RECOVERY_MS:0); rethemeMusic('base');
}

function showBanner(title,text){
  banner.querySelector('strong').textContent=title;banner.querySelector('span').textContent=text;banner.classList.add('show');
  clearTimeout(state.bannerTimer);
  state.bannerTimer=setTimeout(()=>banner.classList.remove('show'),2600);
}

function spawnSheep(){
  state.sheep=Array.from({length:5+rand(6)},(_,i)=>({
    x:-45-rand(240)-i*20,
    y:100+rand(520),
    vx:90+rng()*138,
    bounce:rng()*6,
    hit:false,
    mood:rand(3)
  }));
}
function updateSheep(t,dt=1/60){
  state.sheep.forEach(s=>{
    s.x+=s.vx*dt;
    s.bounce=Math.sin(t/130+s.y)*5;
    if(!s.hit&&s.x>70&&s.x<320){
      const bx=clamp(Math.floor(s.x/CELL),0,COLS-1);const by=clamp(Math.floor(s.y/CELL),0,ROWS-1);
      if(state.board[by][bx]){
        const dir=rng()>.5?1:-1;
        if(bx+dir>=0&&bx+dir<COLS&&!state.board[by][bx+dir]){
          state.board[by][bx+dir]=state.board[by][bx];
          state.board[by][bx]=0;
        }
        s.hit=true;state.score+=25;sfx('bleat');
      }
    }
  });
  state.sheep=state.sheep.filter(s=>s.x<430);
}

function liquifyBoard(){
  state.waterCells=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(state.board[y][x]&&rng()<.28) state.waterCells.push({x,y,color:state.board[y][x],phase:fxRng()*10});
}
function updateWater(dt=1/60){
  if(!state.activeEvent||state.activeEvent.id!=='water')return;
  if(chancePerFrame(.09,dt)){
    for(let y=ROWS-2;y>=0;y--)for(let x=0;x<COLS;x++){
      if(state.board[y][x]&&!state.board[y+1][x]&&rng()<.22){
        state.board[y+1][x]=state.board[y][x];state.board[y][x]=0;
      }
    }
  }
}
function settleWater(){
  for(let pass=0;pass<ROWS;pass++)for(let y=ROWS-2;y>=0;y--)for(let x=0;x<COLS;x++){
    if(state.board[y][x]&&!state.board[y+1][x]){state.board[y+1][x]=state.board[y][x];state.board[y][x]=0;}
  }
  clearLines(); state.waterCells=[];
}

function spawnBomb(){
  state.bombs=[{x:1+rand(COLS-2),y:-1,vy:9,armed:false,explodeAt:performance.now()+5200,pulse:0}];
}
function updateBombs(t,dt=1/60){
  state.bombs.forEach(b=>{
    b.pulse+=dt*8;
    if(!b.armed){
      b.y+=b.vy*dt;
      const iy=Math.floor(b.y);
      if(iy>=ROWS-1||(iy>=0&&state.board[iy+1]?.[b.x])){
        b.armed=true;b.y=clamp(iy,0,ROWS-1);b.explodeAt=t+2700;
      }
    } else if(t>=b.explodeAt){explodeBomb(b);b.done=true;}
  });
  state.bombs=state.bombs.filter(b=>!b.done);
}
function explodeBomb(b){
  const good=rng()<.55;
  for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++){
    const x=b.x+xx,y=Math.floor(b.y)+yy;if(x<0||x>=COLS||y<0||y>=ROWS)continue;
    const d=Math.abs(xx)+Math.abs(yy);
    if(d<=2){if(good)state.board[y][x]=0;else if(!state.board[y][x]&&rng()<.7)state.board[y][x]=6;}
  }
  state.score+=good?220:40;state.chaos=clamp(state.chaos+8,0,100);
  burst(b.x*CELL+18,b.y*CELL+18,50);screenKick('shake',450);sfx('boom');clearLines();
}

function spawnTank(){
  state.tank={x:-90,y:600,vx:105,shots:0,nextShot:performance.now()+500,flashUntil:0,shotCol:null};spawnSmoke(26);
}
function updateTank(t,dt=1/60){
  if(!state.tank)return;const q=state.tank;q.x+=q.vx*dt;
  if(t>=q.nextShot&&q.shots<4){
    q.nextShot=t+700;q.shots++;
    const col=rand(COLS);q.shotCol=col;q.flashUntil=t+140;
    for(let y=ROWS-1;y>=Math.max(0,ROWS-5-rand(5));y--)state.board[y][col]=0;
    burst(col*CELL+18,570,28);screenKick('shake',240);sfx('boom');clearLines();
  }
  if(q.x>450)state.tank=null;
}
function spawnSmoke(n){
  state.smoke.push(...Array.from({length:n},()=>({
    x:fxRand(360),y:380+fxRand(340),r:25+fxRand(55),a:.12+fxRng()*.2,
    vx:-18+fxRng()*36,vy:-12-fxRng()*30
  })));
}
function updateSmoke(dt=1/60){
  state.smoke.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.a*=Math.pow(.995,dt*60);});
  state.smoke=state.smoke.filter(s=>s.a>.025);
}

function glitchBoard(){
  const rowA=6+rand(10),rowB=6+rand(10);[state.board[rowA],state.board[rowB]]=[state.board[rowB],state.board[rowA]];
  for(let i=0;i<3;i++){
    const y=5+rand(13);const shift=1+rand(3);
    state.board[y]=state.board[y].slice(shift).concat(state.board[y].slice(0,shift));
  }
  clearLines();screenKick('shake',180);
}
function spawnDuck(){
  state.duck={x:-50,y:90+fxRand(450),vx:145+fxRng()*95,until:performance.now()+4200,bob:fxRng()*6};
  sfx('duck');
}
function updateDuck(t,dt=1/60){
  if(!state.duck)return;
  state.duck.x+=state.duck.vx*dt;
  state.duck.bob+=dt*7;
  if(state.duck.x>430||t>state.duck.until)state.duck=null;
}

function drawSheepSprite(s){
  ctx.save();ctx.translate(s.x,s.y+s.bounce);
  ctx.fillStyle='#eef3ff';
  for(const [x,y,r] of [[-8,0,9],[0,-5,11],[9,0,9],[0,5,11]]){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#171827';ctx.fillRect(10,-6,12,13);
  ctx.fillStyle=s.mood===2?'#ff5ab7':'#43efff';ctx.fillRect(17,-3,3,3);
  ctx.fillStyle='#8a91a8';ctx.fillRect(-8,11,4,8);ctx.fillRect(7,11,4,8);
  ctx.restore();
}
function drawBombSprite(b){
  const x=b.x*CELL+18,y=b.y*CELL+18;
  ctx.save();ctx.translate(x,y);
  const pulse=1+Math.sin(b.pulse||0)*.08;ctx.scale(pulse,pulse);
  ctx.fillStyle='#10121b';ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=b.armed?'#ff5f68':'#ffd166';ctx.lineWidth=3;ctx.stroke();
  ctx.strokeStyle='#ffd166';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(7,-9);ctx.quadraticCurveTo(14,-17,10,-22);ctx.stroke();
  ctx.fillStyle='#ff5f68';ctx.fillRect(8,-24,4,4);
  ctx.restore();
  if(b.armed){
    const remaining=clamp((b.explodeAt-performance.now())/2700,0,1);
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(b.x*CELL+5,b.y*CELL+32,26,4);
    ctx.fillStyle=remaining<.35?'#ff5f68':'#ffd166';ctx.fillRect(b.x*CELL+5,b.y*CELL+32,26*remaining,4);
  }
}
function drawTankSprite(q){
  ctx.save();ctx.translate(q.x,q.y);
  ctx.fillStyle='#1a2117';ctx.fillRect(2,-17,84,18);
  ctx.fillStyle='#7c8a50';ctx.fillRect(8,-35,72,22);ctx.fillRect(28,-49,32,18);
  ctx.fillStyle='#9bac65';ctx.fillRect(53,-44,52,7);
  ctx.fillStyle='#0c100b';
  for(let x=8;x<82;x+=15){ctx.beginPath();ctx.arc(x,-5,7,0,Math.PI*2);ctx.fill();}
  if(q.flashUntil>performance.now()){
    ctx.fillStyle='#ffd166';ctx.beginPath();ctx.moveTo(105,-40);ctx.lineTo(128,-48);ctx.lineTo(119,-36);ctx.lineTo(132,-31);ctx.lineTo(105,-34);ctx.closePath();ctx.fill();
    if(q.shotCol!==null){
      ctx.strokeStyle='rgba(255,209,102,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(105,-40);ctx.lineTo(q.shotCol*CELL+18-q.x,-q.y+590);ctx.stroke();
    }
  }
  ctx.restore();
}
function drawDuckSprite(d){
  ctx.save();ctx.translate(d.x,d.y+Math.sin(d.bob)*5);
  ctx.fillStyle='#ffd166';ctx.fillRect(-11,-8,24,16);ctx.fillRect(7,-14,13,13);
  ctx.fillStyle='#ff9d3d';ctx.fillRect(20,-8,10,5);
  ctx.fillStyle='#10121b';ctx.fillRect(15,-11,3,3);
  ctx.fillStyle='#ffd166';ctx.font='700 10px monospace';ctx.fillText('INSPECTION',-25,24);
  ctx.restore();
}

function drawEventActors(){
  state.sheep.forEach(drawSheepSprite);
  state.bombs.forEach(drawBombSprite);
  if(state.tank)drawTankSprite(state.tank);
  if(state.duck)drawDuckSprite(state.duck);
  state.smoke.forEach(s=>{ctx.save();ctx.globalAlpha=s.a;ctx.fillStyle='#afb4c0';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.restore();});
  state.particles.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.s,p.s);ctx.restore();});
}

function burst(x,y,n=25){
  for(let i=0;i<n;i++)state.particles.push({
    x,y,vx:-180+fxRng()*360,vy:-240+fxRng()*420,life:.6+fxRng()*.4,
    s:2+fxRand(5),color:COLORS[1+fxRand(7)]
  });
}
function updateParticles(dt=1/60){
  state.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=288*dt;p.life-=1.08*dt;});
  state.particles=state.particles.filter(p=>p.life>0);
}

function drawOverlay(){
  octx.clearRect(0,0,overlay.width,overlay.height);
  if(state.activeEvent?.id==='glitch'){
    for(let i=0;i<8;i++){
      const y=fxRand(720);
      octx.fillStyle=`rgba(${fxRand(2)?255:67},${fxRand(2)?90:239},255,.08)`;
      octx.fillRect(fxRand(40)-20,y,360,2+fxRand(9));
    }
  }
  if(state.activeEvent?.id==='blackout'){
    const px=state.piece?clamp((state.piece.x+1.5)*CELL,55,305):180;
    const py=state.piece?clamp((state.piece.y+2)*CELL,80,640):480;
    const g=octx.createRadialGradient(px,py,32,px,py,230);
    g.addColorStop(0,'rgba(0,0,0,.06)');g.addColorStop(.34,'rgba(0,0,0,.3)');g.addColorStop(1,'rgba(0,0,0,.9)');
    octx.fillStyle=g;octx.fillRect(0,0,360,720);
  }
  if(state.mini) drawMini();
}

function beginMiniWorld(){
  state.activeEvent=null;state.eventUntil=0;state.inputLocked=true;cabinet.classList.add('miniworld');
  const height=highestStack(); const density=boardDensity();
  state.mini={started:performance.now(),duration:16000,playerX:0,playerZ:0,velX:0,targetX:(fxRng()-.5)*5,targetZ:-18-density*8,success:false,done:false,height,density,orbs:3,keys:{},three:false,last:performance.now(),metresLeft:0,bumps:0};
  const breachCanvas=document.getElementById('breach');
  if(window.Breach&&breachCanvas){
    try{
      window.Breach.start({canvas:breachCanvas,board:state.board,cols:COLS,rows:ROWS,height,density,duration:state.mini.duration});
      state.mini.three=true;
    }catch(err){ console.warn('3D breach unavailable, falling back to the flat tunnel',err); state.mini.three=false; }
  }
  eventTitle.textContent='MICRO-WORLD BREACH';eventText.textContent='Traverse le tunnel. Les parois viennent de ta pile.';
  showBanner('🌀 MICRO-WORLD BREACH','Flèches / WASD pour piloter · ESPACE pour booster.');rethemeMusic('miniworld');sfx('warp');
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
  const frames=Math.max(.1,state.frameDt*60);
  m.velX+=((right?1:0)-(left?1:0))*.018*frames;
  m.velX*=Math.pow(.88,frames);
  m.playerX=clamp(m.playerX+m.velX*frames,-4.8,4.8);
  m.playerZ-=((.055+(up ? .04 : 0)-(down ? .025 : 0))*frames);
  const corridor=3.6-m.density*2.2; const wave=Math.sin(m.playerZ*.34)*(.7+m.height*.025);
  if(Math.abs(m.playerX-wave)>corridor){m.playerZ+=.13*frames;m.velX*=-.5;sfx('bump');}
  if(m.playerZ<=m.targetZ){m.success=true;finishMini();}
  else if(t-m.started>m.duration){finishMini();}
}

function finishMini(){
  const m=state.mini;if(!m||m.done)return;m.done=true;
  if(m.three&&window.Breach) window.Breach.stop(document.getElementById('breach'));
  if(m.success){
    const clear=2+rand(3);
    for(let i=0;i<clear;i++){state.board.pop();state.board.unshift(Array(COLS).fill(0));}
    state.score+=750+clear*180;state.chaos=clamp(state.chaos-18,0,100);
    showBanner('✅ BREACH SEALED',`${clear} couches structurelles supprimées.`);sfx('success');
  }else{
    const add=1+rand(2);
    for(let i=0;i<add;i++){state.board.shift();state.board.push(Array.from({length:COLS},()=>rng()<.72?8:0));}
    state.chaos=clamp(state.chaos+16,0,100);
    showBanner('❌ BREACH COLLAPSED',`${add} couche(s) parasite(s) ajoutée(s).`);sfx('fail');
  }
  setTimeout(()=>{
    state.mini=null;state.inputLocked=false;cabinet.classList.remove('miniworld');
    scheduleNextEvent(performance.now(),RECOVERY_MS);rethemeMusic('base');
    eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Tu es revenu dans la grille. Ne demande pas comment.';
    if(collides(state.piece,0,0))endGame();
  },1100);
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
  const elapsed=performance.now()-m.started, remain=Math.max(0,m.duration-elapsed);octx.fillStyle='rgba(0,0,0,.52)';octx.fillRect(18,18,324,88);octx.fillStyle='#fff';octx.font='900 18px monospace';octx.fillText('STRUCTURAL BREACH',30,45);octx.fillStyle='#ffd166';octx.font='800 13px monospace';octx.fillText(`EXIT ${Math.max(0,Math.ceil((m.playerZ-m.targetZ)*4))}m   T-${(remain/1000).toFixed(1)}`,30,72);octx.fillStyle='#8ea0c0';octx.font='700 10px monospace';octx.fillText('ARROWS/WASD STEER · SPACE BOOST',30,93);
  octx.restore();
}

function drawMiniHud(m){
  const remain=m.remaining!==undefined?m.remaining:Math.max(0,m.duration-(performance.now()-m.started));
  octx.save();
  octx.fillStyle='rgba(0,0,0,.58)';octx.fillRect(18,18,324,96);
  octx.fillStyle='#fff';octx.font='900 18px monospace';octx.fillText('STRUCTURAL BREACH',30,45);
  octx.fillStyle=remain<4000?'#ff5ab7':'#ffd166';octx.font='800 13px monospace';
  octx.fillText(`EXIT ${m.metresLeft||0}m   T-${(remain/1000).toFixed(1)}`,30,72);
  if(m.bumps){octx.fillStyle='rgba(255,90,183,.9)';octx.font='700 11px monospace';octx.fillText(`IMPACTS ${m.bumps}`,250,72);}
  octx.fillStyle='#8ea0c0';octx.font='700 10px monospace';octx.fillText('ARROWS/WASD STEER · SPACE BOOST',30,96);
  const guide=window.Breach?.guide?.(),pos=window.Breach?.peek?.();
  if(guide&&pos){
    const angle=Math.atan2(guide.y-pos.y,guide.x-pos.x);
    const cx=310,cy=94;
    octx.save();octx.translate(cx,cy);octx.rotate(angle);
    octx.fillStyle='#43efff';octx.beginPath();octx.moveTo(11,0);octx.lineTo(-6,-6);octx.lineTo(-3,0);octx.lineTo(-6,6);octx.closePath();octx.fill();octx.restore();
  }
  octx.restore();
}
