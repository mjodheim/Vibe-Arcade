function refreshBest(){
  bestFreeEl.textContent=formatScore(bestFor(false));
  bestDailyEl.textContent=formatScore(bestFor(true));
}

function screenKick(cls,ms){cabinet.classList.remove(cls);void cabinet.offsetWidth;cabinet.classList.add(cls);setTimeout(()=>cabinet.classList.remove(cls),ms);}

function endGame(){
  state.gameOver=true;state.running=false;state.inputLocked=true;stopMusic();sfx('fail');
  // A run can end mid-breach: put the tunnel away or it stays over the well.
  if(state.mini){state.mini=null;if(window.Breach)window.Breach.stop(document.getElementById('breach'));cabinet.classList.remove('miniworld');}
  // An incident can be on screen when the run ends; none of it should outlive it.
  endSideEvent();hideCrash();hideAd();state.meteors=[];state.wreck=null;state.magnet=null;state.acid=null;
  const improved=recordBest(state.score,state.daily);
  newBestEl.hidden=!improved;
  refreshBest();
  finalScoreEl.textContent=formatScore(state.score);deathLine.textContent=['Les blocs ont gagné le conflit social.','La physique a déposé une réclamation.','Un mouton nie toute implication.','Le tank affirme avoir suivi le protocole.'][rand(4)];gameOverPanel.classList.remove('hidden');
}

function resetGame(daily=false){
  state.daily=daily;
  seedRun(daily?todaySeed():crypto.getRandomValues(new Uint32Array(1))[0]);
  state.recentEvents=[];state.eventCooldown=null;
  dailyBadge.hidden=!daily;
  state.board=emptyBoard();state.score=0;state.lines=0;state.level=1;state.chaos=0;state.gameOver=false;state.paused=false;state.running=true;state.inputLocked=false;state.activeEvent=null;state.eventUntil=0;state.sheep=[];state.bombs=[];state.smoke=[];state.particles=[];state.mini=null;if(window.Breach)window.Breach.stop(document.getElementById('breach'));state.tank=null;state.duck=null;state.meteors=[];state.wreck=null;state.magnet=null;state.acid=null;state.lifted=0;state.side=null;state.nextSideAt=0;hideCrash();hideAd();cabinet.className='cabinet';state.next=makePiece();spawn();state.lastDrop=performance.now();scheduleNextEvent(performance.now()+2500);gameOverPanel.classList.add('hidden');startPanel.classList.add('hidden');eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Aucune anomalie détectée. C’est suspect.';startMusic();
}

function togglePause(){
  if(!state.running||state.gameOver)return;state.paused=!state.paused;pauseBtn.textContent=state.paused?'RESUME':'PAUSE';showBanner(state.paused?'⏸ PAUSED':'▶ RESUMED',state.paused?'La catastrophe attend poliment.':'La catastrophe reprend.');
}

// Sound effects share the music graph so the two never fight for the output.
function ensureAudio(){ if(state.audio)return; state.audio=Music.context(); Music.setEnabled(state.sound); }
function audioOut(){ return Music.bus() || (state.audio && state.audio.destination); }
function tone(freq,dur=.08,type='square',gain=.03,when=0){
  if(!state.sound)return;ensureAudio();const a=state.audio;if(!a)return;if(a.state==='suspended')a.resume();const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,a.currentTime+when);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+when+dur);o.connect(g).connect(audioOut());o.start(a.currentTime+when);o.stop(a.currentTime+when+dur+.02);
}
function noise(dur=.18,gain=.04){if(!state.sound)return;ensureAudio();const a=state.audio;if(!a)return;const len=Math.floor(a.sampleRate*dur),buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=a.createBufferSource(),g=a.createGain();s.buffer=buf;g.gain.value=gain;s.connect(g).connect(audioOut());s.start();}
function sfx(type,n=1){
  if(!state.sound)return;
  if(type==='move')tone(130,.025,'square',.013); if(type==='rotate'){tone(240,.04,'square',.02);tone(360,.04,'square',.014,.025);} if(type==='drop'){tone(80,.07,'sawtooth',.04);noise(.04,.018);}
  if(type==='clear'){[523,659,784,1046].slice(0,n+1).forEach((f,i)=>tone(f,.16,'square',.035,i*.045));}
  if(type==='alert'){tone(880,.12,'square',.035);tone(440,.13,'square',.035,.14);}
  if(type==='boom'){tone(60,.35,'sawtooth',.08);noise(.32,.09);} if(type==='bleat'){tone(330,.07,'sawtooth',.025);tone(270,.1,'sawtooth',.02,.07);} if(type==='duck'){tone(420,.05,'square',.03);tone(280,.09,'square',.035,.06);}
  if(type==='warp'){[110,165,220,330,440,660].forEach((f,i)=>tone(f,.28,'sine',.025,i*.07));}
  if(type==='bump'){tone(90,.05,'square',.03);} if(type==='success'){[523,659,784,1046].forEach((f,i)=>tone(f,.2,'triangle',.04,i*.08));} if(type==='fail'){[330,247,196,147].forEach((f,i)=>tone(f,.2,'sawtooth',.035,i*.08));}
  // Incidents that earned their own noise.
  if(type==='impact'){tone(48,.5,'sawtooth',.09);noise(.45,.11);tone(120,.25,'square',.05,.02);}
  if(type==='sizzle'){noise(.55,.05);[880,760,640].forEach((f,i)=>tone(f,.18,'sawtooth',.018,i*.09));}
  if(type==='swing'){[220,180,150,120].forEach((f,i)=>tone(f,.12,'triangle',.03,i*.05));}
  if(type==='clank'){tone(210,.18,'square',.05);noise(.14,.06);tone(140,.3,'triangle',.04,.05);}
  if(type==='hum'){[55,110,165].forEach((f,i)=>tone(f,.9,'sawtooth',.02,i*.02));}
  if(type==='crash'){[196,185,174,164].forEach((f,i)=>tone(f,.6,'sine',.05,i*.18));}
  if(type==='jingle'){[659,880,1174].forEach((f,i)=>tone(f,.22,'triangle',.04,i*.12));}
  if(type==='rumble'){noise(1.1,.07);tone(42,1,'sine',.07);}
}

// The soundtrack itself lives in music.js. These three wrappers are what the
// rest of the game calls, so incidents never have to know how it works.
function startMusic(){ ensureAudio(); Music.setEnabled(state.sound); Music.start('nominal'); }
function stopMusic(){ Music.stop(); }
function rethemeMusic(name){ if(!state.running||state.gameOver)return; ensureAudio(); Music.play(name); }
