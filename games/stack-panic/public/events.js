function scheduleNextEvent(now){
  const min=Math.max(7000,15000-state.level*650); const max=Math.max(11000,23000-state.level*700);
  state.nextEventAt=now+min+Math.random()*(max-min);
}

function updateEvents(t){
  if(!state.activeEvent && !state.mini && t>=state.nextEventAt){ triggerRandomEvent(t); }
  if(state.activeEvent && state.eventUntil && t>=state.eventUntil) endEvent();
  if(!state.activeEvent && !state.mini) state.chaos=Math.max(0,state.chaos-.004);
}

function weightedEvent(){
  const eligible=EVENT_POOL.filter(e=>e.minLevel<=state.level && e.id!==state.eventCooldown);
  const total=eligible.reduce((s,e)=>s+e.weight,0); let r=Math.random()*total;
  for(const e of eligible){r-=e.weight;if(r<=0)return e;} return eligible[0];
}

function triggerRandomEvent(t){
  const e=weightedEvent(); state.eventCooldown=e.id; state.activeEvent=e; state.chaos=clamp(state.chaos+12,0,100);
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
  rethemeMusic(e.id);
}

function endEvent(){
  if(!state.activeEvent)return;
  cabinet.classList.remove(state.activeEvent.id);
  if(state.activeEvent.id==='water') settleWater();
  state.activeEvent=null; state.eventUntil=0; state.sheep=[]; state.bombs=[]; state.smoke=[];
  eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Incident clos. Les techniciens nient toute responsabilité.';
  scheduleNextEvent(performance.now()); rethemeMusic('base');
}

function showBanner(title,text){
  banner.querySelector('strong').textContent=title;banner.querySelector('span').textContent=text;banner.classList.add('show');
  setTimeout(()=>banner.classList.remove('show'),2600);
}

function spawnSheep(){
  state.sheep=Array.from({length:5+rand(6)},(_,i)=>({x:-45-rand(240)-i*20,y:100+rand(520),vx:1.5+Math.random()*2.3,bounce:Math.random()*6,hit:false}));
}
function updateSheep(t){
  state.sheep.forEach(s=>{s.x+=s.vx;s.bounce=Math.sin(t/130+s.y)*5;if(!s.hit&&s.x>70&&s.x<320){
    const bx=clamp(Math.floor(s.x/CELL),0,COLS-1);const by=clamp(Math.floor(s.y/CELL),0,ROWS-1);
    if(state.board[by][bx]){const dir=Math.random()>.5?1:-1;if(bx+dir>=0&&bx+dir<COLS&&!state.board[by][bx+dir]){state.board[by][bx+dir]=state.board[by][bx];state.board[by][bx]=0;}s.hit=true;state.score+=25;sfx('bleat');}
  }});
  state.sheep=state.sheep.filter(s=>s.x<430);
}

function liquifyBoard(){
  state.waterCells=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(state.board[y][x]&&Math.random()<.28) state.waterCells.push({x,y,color:state.board[y][x],phase:Math.random()*10});
}
function updateWater(){
  if(!state.activeEvent||state.activeEvent.id!=='water')return;
  if(Math.random()<.09){
    for(let y=ROWS-2;y>=0;y--)for(let x=0;x<COLS;x++) if(state.board[y][x]&&!state.board[y+1][x]&&Math.random()<.22){state.board[y+1][x]=state.board[y][x];state.board[y][x]=0;}
  }
}
function settleWater(){ for(let pass=0;pass<ROWS;pass++)for(let y=ROWS-2;y>=0;y--)for(let x=0;x<COLS;x++)if(state.board[y][x]&&!state.board[y+1][x]){state.board[y+1][x]=state.board[y][x];state.board[y][x]=0;} clearLines(); state.waterCells=[]; }

function spawnBomb(){
  state.bombs=[{x:1+rand(COLS-2),y:-1,vy:.035,armed:false,explodeAt:performance.now()+5200}];
}
function updateBombs(t){
  state.bombs.forEach(b=>{if(!b.armed){b.y+=b.vy*(16.6);const iy=Math.floor(b.y);if(iy>=ROWS-1||(iy>=0&&state.board[iy+1]?.[b.x])){b.armed=true;b.y=clamp(iy,0,ROWS-1);b.explodeAt=t+2700;}} else if(t>=b.explodeAt){explodeBomb(b);b.done=true;}}); state.bombs=state.bombs.filter(b=>!b.done);
}
function explodeBomb(b){
  const good=Math.random()<.55;
  for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++){const x=b.x+xx,y=Math.floor(b.y)+yy;if(x<0||x>=COLS||y<0||y>=ROWS)continue;const d=Math.abs(xx)+Math.abs(yy);if(d<=2){if(good)state.board[y][x]=0;else if(!state.board[y][x]&&Math.random()<.7)state.board[y][x]=6;}}
  state.score+=good?220:40;state.chaos=clamp(state.chaos+8,0,100);burst(b.x*CELL+18,b.y*CELL+18,50);screenKick('shake',450);sfx('boom');clearLines();
}

function spawnTank(){
  state.tank={x:-90,y:600,vx:1.75,shots:0,nextShot:performance.now()+500};spawnSmoke(26);
}
function updateTank(t){
  if(!state.tank)return;const q=state.tank;q.x+=q.vx;
  if(t>=q.nextShot&&q.shots<4){q.nextShot=t+700;q.shots++;const col=rand(COLS);for(let y=ROWS-1;y>=Math.max(0,ROWS-5-rand(5));y--)state.board[y][col]=0;burst(col*CELL+18,570,28);screenKick('shake',240);sfx('boom');}
  if(q.x>450)state.tank=null;
}
function spawnSmoke(n){state.smoke.push(...Array.from({length:n},()=>({x:rand(360),y:380+rand(340),r:25+rand(55),a:.12+Math.random()*.2,vx:-.3+Math.random()*.6,vy:-.2-Math.random()*.5})));}
function updateSmoke(){state.smoke.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.a*=.995;});state.smoke=state.smoke.filter(s=>s.a>.025);}

function glitchBoard(){
  const rowA=6+rand(10),rowB=6+rand(10);[state.board[rowA],state.board[rowB]]=[state.board[rowB],state.board[rowA]];
  for(let i=0;i<3;i++){const y=5+rand(13);const shift=1+rand(3);state.board[y]=state.board[y].slice(shift).concat(state.board[y].slice(0,shift));}
}
function spawnDuck(){state.duck={x:-50,y:90+rand(450),vx:2.4+Math.random()*1.7,until:performance.now()+4200};sfx('duck');}

function drawEventActors(){
  state.sheep.forEach(s=>{ctx.save();ctx.translate(s.x,s.y+s.bounce);ctx.font='30px sans-serif';ctx.fillText('🐑',-15,12);ctx.restore();});
  state.bombs.forEach(b=>{ctx.font='30px sans-serif';ctx.fillText('💣',b.x*CELL+2,b.y*CELL+28);if(b.armed){ctx.fillStyle='rgba(255,95,104,.75)';ctx.fillRect(b.x*CELL+5,b.y*CELL+32,26,3);}});
  if(state.tank){ctx.save();ctx.translate(state.tank.x,state.tank.y);ctx.font='62px sans-serif';ctx.fillText('🪖',0,0);ctx.fillStyle='#7c8a50';ctx.fillRect(8,-25,76,24);ctx.fillStyle='#1d2614';ctx.fillRect(18,-36,32,14);ctx.restore();}
  if(state.duck){state.duck.x+=state.duck.vx;ctx.save();ctx.translate(state.duck.x,state.duck.y);ctx.font='38px sans-serif';ctx.fillText('🦆',0,0);ctx.font='700 11px monospace';ctx.fillStyle='#ffd166';ctx.fillText('INSPECTION',-12,18);ctx.restore();if(state.duck.x>420)state.duck=null;}
  state.smoke.forEach(s=>{ctx.save();ctx.globalAlpha=s.a;ctx.fillStyle='#afb4c0';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.restore();});
  state.particles.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.s,p.s);ctx.restore();});
}

function burst(x,y,n=25){for(let i=0;i<n;i++)state.particles.push({x,y,vx:-3+Math.random()*6,vy:-4+Math.random()*7,life:.6+Math.random()*.4,s:2+rand(5),color:COLORS[1+rand(7)]});}
function updateParticles(){state.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.life-=.018;});state.particles=state.particles.filter(p=>p.life>0);}

function drawOverlay(){
  octx.clearRect(0,0,overlay.width,overlay.height);
  if(state.activeEvent?.id==='glitch'){
    for(let i=0;i<8;i++){const y=rand(720);octx.fillStyle=`rgba(${rand(2)?255:67},${rand(2)?90:239},255,.08)`;octx.fillRect(rand(40)-20,y,360,2+rand(9));}
  }
  if(state.activeEvent?.id==='blackout'){
    const g=octx.createRadialGradient(180,480,35,180,480,240);g.addColorStop(0,'rgba(0,0,0,.12)');g.addColorStop(1,'rgba(0,0,0,.84)');octx.fillStyle=g;octx.fillRect(0,0,360,720);
  }
  if(state.mini) drawMini();
}

function beginMiniWorld(){
  state.activeEvent=null;state.eventUntil=0;state.inputLocked=true;cabinet.classList.add('miniworld');
  const height=highestStack(); const density=boardDensity();
  state.mini={started:performance.now(),duration:16000,playerX:0,playerZ:0,velX:0,targetX:(Math.random()-.5)*5,targetZ:-18-density*8,success:false,done:false,height,density,orbs:3,keys:{}};
  eventTitle.textContent='MICRO-WORLD BREACH';eventText.textContent='Traverse le tunnel. Les parois viennent de ta pile.';
  showBanner('🌀 MICRO-WORLD BREACH','Flèches / WASD : trouve la sortie avant la fermeture.');rethemeMusic('miniworld');sfx('warp');
}

function highestStack(){for(let y=0;y<ROWS;y++)if(state.board[y].some(Boolean))return ROWS-y;return 0;}
function boardDensity(){let n=0;state.board.forEach(r=>r.forEach(v=>n+=!!v));return n/(ROWS*COLS);}

function updateMini(t){
  const m=state.mini;if(!m)return;
  const left=!!(m.keys.ArrowLeft||m.keys.a),right=!!(m.keys.ArrowRight||m.keys.d),up=!!(m.keys.ArrowUp||m.keys.w),down=!!(m.keys.ArrowDown||m.keys.s);
  m.velX+=((right?1:0)-(left?1:0))*.018;m.velX*=.88;m.playerX=clamp(m.playerX+m.velX,-4.8,4.8);m.playerZ-=.055+(up?.04:0)-(down?.025:0);
  const corridor=3.6-m.density*2.2; const wave=Math.sin(m.playerZ*.34)*(.7+m.height*.025);
  if(Math.abs(m.playerX-wave)>corridor){m.playerZ+=.13;m.velX*=-.5;sfx('bump');}
  if(m.playerZ<=m.targetZ){m.success=true;finishMini();}
  else if(t-m.started>m.duration){finishMini();}
}

function finishMini(){
  const m=state.mini;if(!m||m.done)return;m.done=true;
  if(m.success){
    const clear=2+rand(3);for(let i=0;i<clear;i++){state.board.pop();state.board.unshift(Array(COLS).fill(0));}state.score+=750+clear*180;state.chaos=clamp(state.chaos-18,0,100);showBanner('✅ BREACH SEALED',`${clear} couches structurelles supprimées.`);sfx('success');
  }else{
    const add=1+rand(2);for(let i=0;i<add;i++){state.board.shift();state.board.push(Array.from({length:COLS},()=>Math.random()<.72?8:0));}state.chaos=clamp(state.chaos+16,0,100);showBanner('❌ BREACH COLLAPSED',`${add} couche(s) parasite(s) ajoutée(s).`);sfx('fail');
  }
  setTimeout(()=>{state.mini=null;state.inputLocked=false;cabinet.classList.remove('miniworld');scheduleNextEvent(performance.now());rethemeMusic('base');eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Tu es revenu dans la grille. Ne demande pas comment.';if(collides(state.piece,0,0))endGame();},1100);
}

function drawMini(){
  const m=state.mini;if(!m)return;
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
