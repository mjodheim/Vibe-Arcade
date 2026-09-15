function refreshBest(){
  bestFreeEl.textContent=formatScore(bestFor(false));
  bestDailyEl.textContent=formatScore(bestFor(true));
}

function screenKick(cls,ms){
  cabinet.classList.remove(cls);void cabinet.offsetWidth;cabinet.classList.add(cls);
  setTimeout(()=>cabinet.classList.remove(cls),ms);
}

function endGame(){
  state.gameOver=true;state.running=false;state.inputLocked=true;stopMusic();sfx('fail');
  if(state.mini){
    state.mini=null;
    if(window.Breach)window.Breach.stop(document.getElementById('breach'));
    cabinet.classList.remove('miniworld');
  }
  const improved=recordBest(state.score,state.daily);
  newBestEl.hidden=!improved;
  refreshBest();
  finalScoreEl.textContent=formatScore(state.score);
  deathLine.textContent=[
    'Les blocs ont gagné le conflit social.',
    'La physique a déposé une réclamation.',
    'Un mouton nie toute implication.',
    'Le tank affirme avoir suivi le protocole.',
    'Le canard valide ce désastre.'
  ][fxRand(5)];
  gameOverPanel.classList.remove('hidden');
}

function resetGame(daily=false){
  state.daily=daily;
  seedRun(daily?todaySeed():crypto.getRandomValues(new Uint32Array(1))[0]);
  state.recentEvents=[];state.eventCooldown=null;
  dailyBadge.hidden=!daily;
  state.board=emptyBoard();state.score=0;state.lines=0;state.level=1;state.chaos=0;
  state.gameOver=false;state.paused=false;state.running=true;state.inputLocked=false;
  state.activeEvent=null;state.eventUntil=0;state.sheep=[];state.bombs=[];state.smoke=[];
  state.particles=[];state.waterCells=[];state.mini=null;state.tank=null;state.duck=null;
  state.pauseStartedAt=0;state.lastFrame=performance.now();
  if(window.Breach)window.Breach.stop(document.getElementById('breach'));
  cabinet.className='cabinet';
  state.next=makePiece();spawn();
  state.lastDrop=performance.now();
  scheduleNextEvent(performance.now()+2500);
  gameOverPanel.classList.add('hidden');startPanel.classList.add('hidden');
  eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Aucune anomalie détectée. C’est suspect.';
  pauseBtn.textContent='PAUSE';
  startMusic();
}

function shiftTimers(delta){
  state.lastDrop+=delta;
  state.nextEventAt+=delta;
  if(state.eventUntil)state.eventUntil+=delta;
  state.bombs.forEach(b=>{if(b.explodeAt)b.explodeAt+=delta;});
  if(state.tank?.nextShot)state.tank.nextShot+=delta;
  if(state.tank?.flashUntil)state.tank.flashUntil+=delta;
  if(state.duck?.until)state.duck.until+=delta;
  if(state.mini){
    state.mini.started+=delta;
    state.mini.last=performance.now();
  }
}

function togglePause(){
  if(!state.running||state.gameOver)return;
  const now=performance.now();
  if(!state.paused){
    state.paused=true;
    state.pauseStartedAt=now;
    pauseBtn.textContent='RESUME';
    showBanner('⏸ PAUSED','La catastrophe attend poliment.');
  }else{
    const delta=Math.max(0,now-state.pauseStartedAt);
    state.paused=false;
    state.pauseStartedAt=0;
    shiftTimers(delta);
    state.lastFrame=now;
    pauseBtn.textContent='PAUSE';
    showBanner('▶ RESUMED','La catastrophe reprend.');
  }
}

function ensureAudio(){
  if(state.audio)return;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  state.audio=new AC();
  state.master=state.audio.createGain();
  state.master.gain.value=.72;
  state.master.connect(state.audio.destination);
}
function audioOut(){ensureAudio();return state.master||state.audio?.destination;}
function tone(freq,dur=.08,type='square',gain=.03,when=0){
  if(!state.sound||!freq)return;
  ensureAudio();const a=state.audio;if(!a)return;
  if(a.state==='suspended')a.resume();
  const o=a.createOscillator(),g=a.createGain(),out=audioOut();
  o.type=type;o.frequency.setValueAtTime(freq,a.currentTime+when);
  g.gain.setValueAtTime(Math.max(.0001,gain),a.currentTime+when);
  g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+when+dur);
  o.connect(g).connect(out);o.start(a.currentTime+when);o.stop(a.currentTime+when+dur+.02);
}
function noise(dur=.18,gain=.04,filterFreq=5000){
  if(!state.sound)return;
  ensureAudio();const a=state.audio;if(!a)return;
  const len=Math.floor(a.sampleRate*dur),buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
  const s=a.createBufferSource(),g=a.createGain(),f=a.createBiquadFilter();
  s.buffer=buf;g.gain.value=gain;f.type='lowpass';f.frequency.value=filterFreq;
  s.connect(f).connect(g).connect(audioOut());s.start();
}
function kick(gain=.035){
  if(!state.sound)return;ensureAudio();const a=state.audio;if(!a)return;
  const o=a.createOscillator(),g=a.createGain();
  o.type='sine';o.frequency.setValueAtTime(120,a.currentTime);o.frequency.exponentialRampToValueAtTime(42,a.currentTime+.11);
  g.gain.setValueAtTime(gain,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.13);
  o.connect(g).connect(audioOut());o.start();o.stop(a.currentTime+.14);
}
function hat(gain=.009){noise(.025,gain,9000);}
function snare(gain=.018){noise(.075,gain,2300);tone(165,.055,'triangle',gain*.55);}

function sfx(type,n=1){
  if(!state.sound)return;
  if(type==='move')tone(130,.025,'square',.013);
  if(type==='rotate'){tone(240,.04,'square',.02);tone(360,.04,'square',.014,.025);}
  if(type==='drop'){tone(80,.07,'sawtooth',.04);noise(.04,.018);}
  if(type==='clear'){[523,659,784,1046].slice(0,n+1).forEach((f,i)=>tone(f,.16,'square',.035,i*.045));}
  if(type==='alert'){tone(880,.12,'square',.035);tone(440,.13,'square',.035,.14);}
  if(type==='boom'){tone(60,.35,'sawtooth',.08);noise(.32,.09,1200);}
  if(type==='bleat'){tone(330,.07,'sawtooth',.025);tone(270,.1,'sawtooth',.02,.07);}
  if(type==='duck'){tone(420,.05,'square',.03);tone(280,.09,'square',.035,.06);}
  if(type==='warp'){[110,165,220,330,440,660].forEach((f,i)=>tone(f,.28,'sine',.025,i*.07));}
  if(type==='bump'){tone(90,.05,'square',.03);}
  if(type==='success'){[523,659,784,1046].forEach((f,i)=>tone(f,.2,'triangle',.04,i*.08));}
  if(type==='fail'){[330,247,196,147].forEach((f,i)=>tone(f,.2,'sawtooth',.035,i*.08));}
}

const themes={
  base:{notes:[220,247,330,294,247,220,165,196],bass:[55,55,73,65],wave:'square',tempo:170,gain:.011},
  sheep:{notes:[330,440,392,523,440,330,392,587],bass:[82,110,98,110],wave:'square',tempo:128,gain:.016},
  water:{notes:[220,294,330,440,392,330,294,247],bass:[55,73,82,61],wave:'sine',tempo:235,gain:.015},
  bomb:{notes:[165,165,196,165,220,165,247,147],bass:[41,41,49,37],wave:'sawtooth',tempo:118,gain:.017},
  tank:{notes:[147,147,147,196,147,220,196,147],bass:[36,36,49,36],wave:'square',tempo:105,gain:.018},
  blackout:{notes:[196,0,294,0,247,0,220,0],bass:[49,0,55,0],wave:'triangle',tempo:250,gain:.012},
  glitch:{notes:[440,117,622,196,880,147,330,98],bass:[55,82,41,73],wave:'sawtooth',tempo:88,gain:.012},
  duck:{notes:[330,330,440,330,247,294,330,220],bass:[82,82,110,73],wave:'square',tempo:165,gain:.015},
  miniworld:{notes:[220,330,494,660,494,392,587,880],bass:[55,82,61,98],wave:'sawtooth',tempo:108,gain:.016}
};
let currentTheme='base',beat=0;
function startMusic(){stopMusic();currentTheme='base';beat=0;musicTick();}
function stopMusic(){clearTimeout(state.musicTimer);state.musicTimer=null;}
function rethemeMusic(name){currentTheme=themes[name]?name:'base';beat=0;}

function musicTick(){
  if(!state.running||state.gameOver)return;
  const th=themes[currentTheme]||themes.base;
  if(!state.paused&&state.sound){
    const step=beat%16;
    const note=th.notes[beat%th.notes.length];
    const bass=th.bass[Math.floor(beat/2)%th.bass.length];
    const danger=typeof highestStack==='function'?highestStack()/ROWS:0;
    if(step%4===0)kick(.028+danger*.018);
    if(step===4||step===12)snare(.012+danger*.01);
    if((danger>.28&&step%2===0)||danger>.72)hat(.005+danger*.006);
    if(note)tone(note,.07,th.wave,th.gain);
    if(bass&&step%2===0)tone(bass,.12,'triangle',th.gain*.9);
    if(danger>.68&&note&&step%4===2)tone(note*2,.045,'square',th.gain*.45);
    if(currentTheme==='sheep'&&step===15)sfx('bleat');
    if(currentTheme==='duck'&&step===14)tone(260,.055,'square',.012);
    if(currentTheme==='glitch'&&step%3===0)tone(note?note*1.37:311,.03,'sawtooth',.008);
  }
  beat++;
  state.musicTimer=setTimeout(musicTick,th.tempo);
}
