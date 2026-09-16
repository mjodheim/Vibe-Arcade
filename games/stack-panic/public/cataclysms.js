'use strict';

// REALITY FAIL controller. At 100% chaos the game stops pretending this is
// merely another incident and hands the cabinet to a full-screen 3D catastrophe.
(() => {
  const cabinet=document.getElementById('cabinet');
  if(!cabinet)return;

  const canvas=document.createElement('canvas');
  canvas.id='cataclysm3d';canvas.width=360;canvas.height=720;canvas.setAttribute('aria-hidden','true');
  cabinet.appendChild(canvas);

  const ui=document.createElement('div');ui.className='reality-fail-ui';
  ui.innerHTML=`<div class="rf-warning-stripes"></div><div class="reality-fail-copy"><small>REALITY FAIL // 100%</small><strong>...</strong><span>...</span></div><div class="reality-fail-gauge"><i></i></div><div class="rf-whiteout"></div>`;
  cabinet.appendChild(ui);

  const CATA=[
    {id:'blackhole',name:'BLACK HOLE PROTOCOL',copy:'La pile est aspirée hors de la logique locale.',accent:'#d17cff',duration:12000,music:'miniworld'},
    {id:'orbital',name:'ORBITAL STRIKE',copy:'Le plafond vient officiellement de perdre la guerre.',accent:'#ff5f68',duration:11500,music:'meteor'},
    {id:'sheepstorm',name:'SHEEP DIMENSION',copy:'Le bétail a obtenu l’accès administrateur.',accent:'#b9ff66',duration:12000,music:'sheep'}
  ];

  state.cataclysm=null;state.nextRealityFailAt=performance.now()+25000;state.realityFails=0;

  function flash(){const f=ui.querySelector('.rf-whiteout');f.classList.remove('fire');void f.offsetWidth;f.classList.add('fire');}
  function safeEndCurrent(){
    if(state.side)endSideEvent();
    if(state.activeEvent)endEvent();
    state.sheep=[];state.bombs=[];state.meteors=[];state.wreck=null;state.magnet=null;state.acid=null;state.smoke=[];
  }
  function occupied(){const cells=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(state.board[y][x])cells.push({x,y});return cells;}
  function settleColumns(){
    for(let x=0;x<COLS;x++){
      const values=[];for(let y=ROWS-1;y>=0;y--)if(state.board[y][x])values.push(state.board[y][x]);
      for(let y=0;y<ROWS;y++)state.board[y][x]=0;
      values.forEach((v,i)=>state.board[ROWS-1-i][x]=v);
    }
  }
  function eatFraction(fraction){
    const cells=occupied();let removed=0;
    cells.forEach(c=>{if(rng()<fraction){state.board[c.y][c.x]=0;removed++;}});
    if(removed){state.score+=removed*6;burst(180,420,Math.min(90,removed*2));}
  }
  function strike(){
    const cells=occupied();const target=cells.length?cells[rand(cells.length)]:{x:rand(COLS),y:ROWS-2-rand(5)};
    const removed=crater(target.x,target.y,3);state.score+=removed*10;
    burst(target.x*CELL+18,target.y*CELL+18,70);spawnSmoke(7);screenKick('shake',620);sfx('boom');
    window.StackPanicCinematics?.shock?.(target.x*CELL+18,target.y*CELL+18,'#ff5f68');
    clearLines();flash();
  }
  function stampede(){
    for(let y=4;y<ROWS;y++){
      const row=state.board[y];
      if(rng()<.72){
        const shift=1+rand(3),dir=rng()<.5?-1:1;
        for(let n=0;n<shift;n++){
          if(dir<0)row.push(row.shift());else row.unshift(row.pop());
        }
      }
      for(let x=0;x<COLS;x++)if(row[x]&&rng()<.11)row[x]=0;
    }
    burst(180,520,56);screenKick('shake',420);sfx('bleat');clearLines();
  }
  function woolDeposit(){
    state.board.shift();
    state.board.push(Array.from({length:COLS},(_,x)=>rng()<.58&&(x===0||x===COLS-1||rng()<.82)?5:0));
    screenKick('shake',360);sfx('impact');
  }

  function stageBlackHole(c,elapsed){
    if(!c.steps[0]&&elapsed>2600){c.steps[0]=1;eatFraction(.18);flash();}
    if(!c.steps[1]&&elapsed>5200){c.steps[1]=1;eatFraction(.24);settleColumns();screenKick('shake',500);}
    if(!c.steps[2]&&elapsed>8200){c.steps[2]=1;eatFraction(.34);settleColumns();clearLines();flash();}
  }
  function stageOrbital(c,elapsed){
    const times=[2200,3400,4600,5800,7000,8200,9400];
    times.forEach((ms,i)=>{if(!c.steps[i]&&elapsed>ms){c.steps[i]=1;strike();}});
  }
  function stageSheep(c,elapsed){
    const times=[2500,4800,7100];
    times.forEach((ms,i)=>{if(!c.steps[i]&&elapsed>ms){c.steps[i]=1;stampede();}});
    if(!c.steps[3]&&elapsed>9000){c.steps[3]=1;woolDeposit();}
  }

  function triggerRealityFail(t,forced){
    if(state.cataclysm||state.mini||state.gameOver||!state.running)return;
    safeEndCurrent();
    const meta=forced?CATA.find(x=>x.id===forced)||CATA[0]:CATA[rand(CATA.length)];
    state.cataclysm={...meta,started:t,steps:[]};state.realityFails++;
    state.inputLocked=true;state.chaos=100;cabinet.classList.add('reality-fail');pauseBtn.disabled=true;
    ui.style.setProperty('--rf-accent',meta.accent);ui.style.setProperty('--rf-duration',`${meta.duration}ms`);
    ui.querySelector('strong').textContent=meta.name;ui.querySelector('span').textContent=meta.copy;ui.classList.add('live');
    eventTitle.textContent='REALITY FAIL';eventText.textContent=meta.name;
    rethemeMusic(meta.music);sfx('alert');flash();screenKick('shake',700);
    if(window.Cataclysm3D){try{window.Cataclysm3D.start({canvas,board:state.board.map(r=>r.slice()),kind:meta.id,durationMs:meta.duration});}catch(err){console.warn('Cataclysm 3D unavailable',err);}}
  }

  function finishRealityFail(t){
    const c=state.cataclysm;if(!c)return;
    settleColumns();clearLines();
    state.chaos=18+rand(20);state.inputLocked=false;state.cataclysm=null;state.nextRealityFailAt=t+48000+rand(18000);pauseBtn.disabled=false;
    cabinet.classList.remove('reality-fail');ui.classList.remove('live');window.Cataclysm3D?.stop?.(canvas);
    rethemeMusic('base');scheduleNextEvent(performance.now(),6500);
    eventTitle.textContent='REALITY RESTORED';eventText.textContent='La physique a redémarré avec des paramètres approximatifs.';
    showBanner('REALITY RESTORED',c.id==='orbital'?'Le bombardement a cessé. Le propriétaire du plafond sera contacté.':c.id==='blackhole'?'Une partie de la pile existe désormais ailleurs.':'Les moutons ont rendu les privilèges administrateur.');
    if(state.piece&&collides(state.piece,0,0)){
      state.board[0]=Array(COLS).fill(0);state.board[1]=Array(COLS).fill(0);state.piece.y=-1;
      if(collides(state.piece,0,0))spawn();
    }
  }

  function updateRealityFail(t){
    const c=state.cataclysm;if(!c)return;const elapsed=t-c.started;
    if(c.id==='blackhole')stageBlackHole(c,elapsed);else if(c.id==='orbital')stageOrbital(c,elapsed);else stageSheep(c,elapsed);
    if(elapsed>=c.duration)finishRealityFail(t);
  }

  const baseUpdateEvents=updateEvents;
  updateEvents=function(t,dt=1/60){
    if(state.cataclysm){updateRealityFail(t);return;}
    if(state.running&&!state.paused&&!state.gameOver&&!state.mini&&state.chaos>=100&&t>=(state.nextRealityFailAt||0)){triggerRealityFail(t);return;}
    baseUpdateEvents(t,dt);
    if(!state.cataclysm&&state.running&&!state.paused&&!state.gameOver&&!state.mini&&state.chaos>=100&&t>=(state.nextRealityFailAt||0))triggerRealityFail(t);
  };

  // A REALITY FAIL is deliberately not pausable. It is a short cinematic state,
  // not a hidden gameplay timer continuing behind a menu.
  const baseTogglePause=togglePause;
  togglePause=function(){if(state.cataclysm)return;baseTogglePause();};

  const baseReset=resetGame;
  resetGame=function(daily=false){
    if(state.cataclysm)window.Cataclysm3D?.stop?.(canvas);
    state.cataclysm=null;state.nextRealityFailAt=performance.now()+25000;pauseBtn.disabled=false;cabinet.classList.remove('reality-fail');ui.classList.remove('live');
    baseReset(daily);
  };
  const baseEndGame=endGame;
  endGame=function(){if(state.cataclysm)window.Cataclysm3D?.stop?.(canvas);state.cataclysm=null;pauseBtn.disabled=false;cabinet.classList.remove('reality-fail');ui.classList.remove('live');baseEndGame();};

  window.StackPanicRealityFail={trigger:(kind)=>triggerRealityFail(performance.now(),kind),types:CATA.map(x=>x.id)};
})();
