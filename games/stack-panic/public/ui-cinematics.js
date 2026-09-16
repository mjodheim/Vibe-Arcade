'use strict';

// Presentation-only incident director. Gameplay remains in core/events/runtime.
// The goal here is simple: major incidents must be visible as events, not just state changes.
(() => {
  const cabinet = document.getElementById('cabinet');
  if(!cabinet) return;

  const stage = document.createElement('div');
  stage.className = 'event-stage';
  stage.innerHTML = `
    <div class="fx-layer fx-wash"></div>
    <div class="fx-layer liquid-field"></div>
    <div class="fx-layer fx-flash"></div>
    <div class="fx-layer breach-tear"></div>`;
  cabinet.appendChild(stage);

  const cinematic = document.createElement('div');
  cinematic.className = 'incident-cinematic';
  cinematic.innerHTML = `<div class="incident-copy"><small>INCIDENT // LIVE</small><strong>...</strong><span>...</span><div class="severity"><i></i></div></div>`;
  cabinet.appendChild(cinematic);

  // SVG filter gives the water event a real refraction instead of a color tint.
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width','0'); svg.setAttribute('height','0');
  svg.style.position='absolute';
  svg.innerHTML = `<filter id="stack-liquid-warp" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="2" seed="7" result="noise">
      <animate attributeName="baseFrequency" dur="3.8s" values="0.012 0.028;0.018 0.018;0.012 0.028" repeatCount="indefinite" />
    </feTurbulence>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="13" xChannelSelector="R" yChannelSelector="G" />
  </filter>`;
  document.body.appendChild(svg);

  const META = {
    sheep:    {tag:'BIOLOGICAL BREACH', copy:'Le bétail a choisi la violence.', accent:'#ffffff', hot:'#ff5ab7'},
    water:    {tag:'PHYSICS FAILURE', copy:'La matière solide vient de démissionner.', accent:'#43efff', hot:'#8f7cff'},
    bomb:     {tag:'UNSCHEDULED DELIVERY', copy:'Le colis est armé. Le service client est fermé.', accent:'#ffd166', hot:'#ff5f68'},
    tank:     {tag:'MILITARY ASSISTANCE', copy:'Support allié. Conditions générales introuvables.', accent:'#b9ff66', hot:'#ffd166'},
    blackout: {tag:'VISIBILITY FAILURE', copy:'Le courant est parti sans laisser d’adresse.', accent:'#8f7cff', hot:'#43efff'},
    glitch:   {tag:'REALITY DESYNC', copy:'La grille ne partage plus notre interprétation des faits.', accent:'#43efff', hot:'#ff5ab7'},
    miniworld:{tag:'REALITY BREACH', copy:'La grille est devenue un endroit.', accent:'#8f7cff', hot:'#43efff'},
    duck:     {tag:'COMPLIANCE', copy:'Inspection surprise. Le canard prend des notes.', accent:'#ffd166', hot:'#ff9d3d'},
    meteor:   {tag:'ORBITAL IMPACT', copy:'Le plafond a cessé d’être une protection.', accent:'#ffd166', hot:'#ff5f68'},
    wreck:    {tag:'DEMOLITION ORDER', copy:'Le chantier est maintenant activement hostile.', accent:'#c8cedc', hot:'#ffd166'},
    magnet:   {tag:'MAGNETIC ANOMALY', copy:'Tout part sur le côté. Y compris le plan.', accent:'#43efff', hot:'#8f7cff'},
    acid:     {tag:'CHEMICAL WEATHER', copy:'La pluie attaque désormais la structure.', accent:'#b9ff66', hot:'#eaff5c'},
    gravity:  {tag:'GRAVITY REVOKED', copy:'Le sol n’est plus contractuellement obligatoire.', accent:'#d17cff', hot:'#43efff'},
    bsod:     {tag:'SYSTEM FAILURE', copy:'Le jeu nie officiellement être encore vivant.', accent:'#8fb7ff', hot:'#ffffff'},
    ad:       {tag:'MONETIZATION EVENT', copy:'Une interruption commerciale a envahi la catastrophe.', accent:'#ffd166', hot:'#ff5ab7'}
  };

  let announceTimer = 0;
  let actorTimers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { actorTimers.delete(id); fn(); }, ms);
    actorTimers.add(id); return id;
  };

  function clearActorTimers(){ actorTimers.forEach(clearTimeout); actorTimers.clear(); }
  function setPalette(meta){
    cinematic.style.setProperty('--incident-accent',meta.accent);
    cinematic.style.setProperty('--incident-hot',meta.hot);
    stage.style.setProperty('--incident-accent',meta.accent);
    stage.style.setProperty('--incident-hot',meta.hot);
  }

  function announce(event){
    if(!event) return;
    const meta=META[event.id]||{tag:'INCIDENT',copy:event.desc||'Anomalie détectée.',accent:'#43efff',hot:'#ff5f68'};
    setPalette(meta);
    cinematic.querySelector('small').textContent=meta.tag;
    cinematic.querySelector('strong').textContent=event.name||event.id;
    cinematic.querySelector('span').textContent=meta.copy;
    cinematic.classList.add('show'); stage.classList.add('live');
    clearTimeout(announceTimer);
    announceTimer=setTimeout(()=>cinematic.classList.remove('show'),1250);
  }

  function flash(){
    const el=stage.querySelector('.fx-flash'); el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire');
  }
  function punch(){ cabinet.classList.remove('impact-punch'); void cabinet.offsetWidth; cabinet.classList.add('impact-punch'); setTimeout(()=>cabinet.classList.remove('impact-punch'),420); }
  function shock(x,y,accent){
    const ring=document.createElement('i'); ring.className='fx-shockwave';
    ring.style.left=`${x/360*100}%`; ring.style.top=`${y/720*100}%`; if(accent) ring.style.setProperty('--incident-hot',accent);
    stage.appendChild(ring); ring.addEventListener('animationend',()=>ring.remove(),{once:true});
    flash(); punch(); debris(x,y,22,accent||'#ffd166');
  }
  function debris(x,y,count=18,color='#43efff'){
    for(let i=0;i<count;i++){
      const d=document.createElement('b'); d.className='fx-impact-debris'; d.style.left=`${x/360*100}%`; d.style.top=`${y/720*100}%`; d.style.color=color;
      const a=Math.random()*Math.PI*2, dist=35+Math.random()*105;
      d.style.setProperty('--dx',`${Math.cos(a)*dist}px`); d.style.setProperty('--dy',`${Math.sin(a)*dist}px`); d.style.setProperty('--rot',`${Math.random()*520-260}deg`);
      stage.appendChild(d); d.addEventListener('animationend',()=>d.remove(),{once:true});
    }
  }

  function spawnSheepActors(){
    stage.querySelectorAll('.fx-sheep').forEach(n=>n.remove());
    const herd=(state.sheep?.length?state.sheep:Array.from({length:18},()=>({y:100+Math.random()*520,vx:120+Math.random()*120}))).slice(0,22);
    herd.forEach((s,i)=>{
      const el=document.createElement('div'); el.className='fx-sheep';
      el.innerHTML='<i class="body"></i><i class="head"><i class="eye"></i></i><i class="legs"></i>';
      el.style.top=`${Math.max(4,Math.min(88,(s.y||300)/720*100))}%`; el.style.left='-18%';
      stage.appendChild(el);
      const duration=2100+Math.random()*2400;
      el.animate([
        {transform:`translate(-30px,${i%3*3}px) rotate(-4deg)`},
        {transform:`translate(${stage.clientWidth+120}px,${(Math.random()-.5)*55}px) rotate(${4+Math.random()*8}deg)`}
      ],{duration,delay:i*55,easing:'cubic-bezier(.15,.55,.25,1)',fill:'forwards'}).finished.finally(()=>el.remove());
    });
  }

  function spawnTankActor(){
    stage.querySelectorAll('.fx-tank').forEach(n=>n.remove());
    const tank=document.createElement('div'); tank.className='fx-tank';
    tank.innerHTML='<i class="track"></i><i class="hull"></i><i class="turret"></i><i class="barrel"></i><i class="muzzle"></i>';
    stage.appendChild(tank);
    [900,1600,2300,3000].forEach((ms,index)=>later(()=>{
      if(!tank.isConnected)return; tank.classList.remove('fire'); void tank.offsetWidth; tank.classList.add('fire');
      const y=470+index*28; shock(270,y,'#ffd166');
    },ms));
    later(()=>tank.remove(),7800);
  }

  function spawnMeteorActors(){
    stage.querySelectorAll('.fx-meteor').forEach(n=>n.remove());
    const meteors=(state.meteors?.length?state.meteors:Array.from({length:8},()=>({x:25+Math.random()*310}))).slice(0,10);
    meteors.forEach((m,i)=>{
      const el=document.createElement('i'); el.className='fx-meteor';
      const targetX=Math.max(14,Math.min(346,m.x||180)), targetY=360+Math.random()*310;
      el.style.left=`${targetX/360*100}%`;el.style.top='-18%'; stage.appendChild(el);
      const duration=720+Math.random()*650, delay=i*120;
      el.animate([
        {transform:'translate(-90px,-180px) rotate(-35deg) scale(.65)',opacity:0},
        {offset:.12,opacity:1},
        {transform:`translate(25px,${targetY+160}px) rotate(-35deg) scale(1.2)`,opacity:1}
      ],{duration,delay,easing:'cubic-bezier(.2,.65,.25,1)',fill:'forwards'}).finished.then(()=>{
        if(el.isConnected){shock(targetX,targetY,'#ff5f68');el.remove();}
      }).catch(()=>{});
    });
  }

  function breachTear(){
    const el=stage.querySelector('.breach-tear');el.classList.remove('fire');void el.offsetWidth;el.classList.add('fire');
    cabinet.animate([
      {transform:'scale(1)'},{offset:.55,transform:'perspective(700px) scale(1.04) rotateX(1.4deg)'},{transform:'scale(1)'}
    ],{duration:900,easing:'cubic-bezier(.1,.7,.2,1)'});
  }

  function liquid(on){
    stage.classList.toggle('liquid',on);
    if(on){
      stage.querySelector('.fx-wash').style.background='radial-gradient(circle at 50% 75%,rgba(67,239,255,.2),transparent 48%)';
    }
  }

  function updatePressure(){
    cabinet.classList.toggle('reality-pressure',state.running&&!state.gameOver&&state.chaos>=82&&!state.mini);
  }
  const pressureTimer=setInterval(updatePressure,180);
  window.addEventListener('beforeunload',()=>clearInterval(pressureTimer));

  function cleanup(id){
    if(id==='water') liquid(false);
    if(id==='tank') stage.querySelectorAll('.fx-tank').forEach(n=>n.remove());
    if(id==='sheep') stage.querySelectorAll('.fx-sheep').forEach(n=>n.remove());
    if(id==='meteor') stage.querySelectorAll('.fx-meteor').forEach(n=>n.remove());
    stage.classList.remove('live');
  }

  // Hook event announcement after the event system has selected the incident.
  const baseTrigger=triggerRandomEvent;
  triggerRandomEvent=function(t){
    baseTrigger(t);
    if(state.activeEvent) announce(state.activeEvent);
  };

  const baseEnd=endEvent;
  endEvent=function(){ const id=state.activeEvent?.id; baseEnd(); if(id) cleanup(id); };

  const baseSheep=spawnSheep;
  spawnSheep=function(){ baseSheep(); spawnSheepActors(); };

  const baseWater=liquifyBoard;
  liquifyBoard=function(){ baseWater(); liquid(true); flash(); };
  const baseSettle=settleWater;
  settleWater=function(){ baseSettle(); liquid(false); shock(180,610,'#43efff'); };

  const baseExplode=explodeBomb;
  explodeBomb=function(b){ const x=b.x*CELL+18,y=Math.floor(b.y)*CELL+18; baseExplode(b); shock(x,y,'#ff5f68'); };

  const baseTank=spawnTank;
  spawnTank=function(){ baseTank(); spawnTankActor(); announce({id:'tank',name:'QUESTIONABLE SUPPORT'}); };

  const baseMeteors=spawnMeteors;
  spawnMeteors=function(t){ baseMeteors(t); spawnMeteorActors(); };

  const baseWreck=spawnWreckingBall;
  spawnWreckingBall=function(t){ baseWreck(t); flash(); cabinet.animate([{transform:'translateX(-3px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:420,iterations:2}); };

  const baseMagnet=startMagnet;
  startMagnet=function(t){ baseMagnet(t); stage.querySelector('.fx-wash').style.background='linear-gradient(90deg,rgba(67,239,255,.22),transparent 45%,rgba(143,124,255,.14))'; stage.classList.add('live'); };

  const baseAcid=startAcid;
  startAcid=function(t){ baseAcid(t); stage.querySelector('.fx-wash').style.background='linear-gradient(rgba(185,255,102,.09),rgba(185,255,102,.26))'; stage.classList.add('live'); };

  const baseLift=liftStack;
  liftStack=function(){ baseLift(); cabinet.animate([{transform:'translateY(0)'},{transform:'translateY(-14px) scale(.99)'},{transform:'translateY(0)'}],{duration:850,easing:'cubic-bezier(.2,.8,.2,1)'}); flash(); };
  const baseDrop=dropStack;
  dropStack=function(){ baseDrop(); shock(180,620,'#d17cff'); };

  const baseBegin=beginMiniWorld;
  beginMiniWorld=function(){ breachTear(); later(()=>baseBegin(),420); };

  const baseReset=resetGame;
  resetGame=function(daily=false){
    clearActorTimers(); stage.querySelectorAll('.fx-sheep,.fx-tank,.fx-meteor,.fx-impact-debris,.fx-shockwave').forEach(n=>n.remove());
    liquid(false); cinematic.classList.remove('show'); cabinet.classList.remove('reality-pressure','impact-punch');
    baseReset(daily);
  };

  const baseEndGame=endGame;
  endGame=function(){ clearActorTimers(); cinematic.classList.remove('show'); stage.classList.remove('live','liquid'); cabinet.classList.remove('reality-pressure'); baseEndGame(); };

  window.StackPanicCinematics={announce,shock,flash,stage};
})();
