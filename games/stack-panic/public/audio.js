function screenKick(cls,ms){cabinet.classList.remove(cls);void cabinet.offsetWidth;cabinet.classList.add(cls);setTimeout(()=>cabinet.classList.remove(cls),ms);}

function endGame(){
  state.gameOver=true;state.running=false;state.inputLocked=true;stopMusic();sfx('fail');
  finalScoreEl.textContent=formatScore(state.score);deathLine.textContent=['Les blocs ont gagné le conflit social.','La physique a déposé une réclamation.','Un mouton nie toute implication.','Le tank affirme avoir suivi le protocole.'][rand(4)];gameOverPanel.classList.remove('hidden');
}

function resetGame(){
  state.board=emptyBoard();state.score=0;state.lines=0;state.level=1;state.chaos=0;state.gameOver=false;state.paused=false;state.running=true;state.inputLocked=false;state.activeEvent=null;state.eventUntil=0;state.sheep=[];state.bombs=[];state.smoke=[];state.particles=[];state.mini=null;state.tank=null;state.duck=null;cabinet.className='cabinet';state.next=makePiece();spawn();state.lastDrop=performance.now();scheduleNextEvent(performance.now()+2500);gameOverPanel.classList.add('hidden');startPanel.classList.add('hidden');eventTitle.textContent='SYSTEM NOMINAL';eventText.textContent='Aucune anomalie détectée. C’est suspect.';startMusic();
}

function togglePause(){
  if(!state.running||state.gameOver)return;state.paused=!state.paused;pauseBtn.textContent=state.paused?'RESUME':'PAUSE';showBanner(state.paused?'⏸ PAUSED':'▶ RESUMED',state.paused?'La catastrophe attend poliment.':'La catastrophe reprend.');
}

function ensureAudio(){ if(state.audio)return; const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;state.audio=new AC(); }
function tone(freq,dur=.08,type='square',gain=.03,when=0){
  if(!state.sound)return;ensureAudio();const a=state.audio;if(!a)return;if(a.state==='suspended')a.resume();const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,a.currentTime+when);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+when+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+when);o.stop(a.currentTime+when+dur+.02);
}
function noise(dur=.18,gain=.04){if(!state.sound)return;ensureAudio();const a=state.audio;if(!a)return;const len=Math.floor(a.sampleRate*dur),buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=a.createBufferSource(),g=a.createGain();s.buffer=buf;g.gain.value=gain;s.connect(g).connect(a.destination);s.start();}
function sfx(type,n=1){
  if(!state.sound)return;
  if(type==='move')tone(130,.025,'square',.013); if(type==='rotate'){tone(240,.04,'square',.02);tone(360,.04,'square',.014,.025);} if(type==='drop'){tone(80,.07,'sawtooth',.04);noise(.04,.018);}
  if(type==='clear'){[523,659,784,1046].slice(0,n+1).forEach((f,i)=>tone(f,.16,'square',.035,i*.045));}
  if(type==='alert'){tone(880,.12,'square',.035);tone(440,.13,'square',.035,.14);}
  if(type==='boom'){tone(60,.35,'sawtooth',.08);noise(.32,.09);} if(type==='bleat'){tone(330,.07,'sawtooth',.025);tone(270,.1,'sawtooth',.02,.07);} if(type==='duck'){tone(420,.05,'square',.03);tone(280,.09,'square',.035,.06);}
  if(type==='warp'){[110,165,220,330,440,660].forEach((f,i)=>tone(f,.28,'sine',.025,i*.07));}
  if(type==='bump'){tone(90,.05,'square',.03);} if(type==='success'){[523,659,784,1046].forEach((f,i)=>tone(f,.2,'triangle',.04,i*.08));} if(type==='fail'){[330,247,196,147].forEach((f,i)=>tone(f,.2,'sawtooth',.035,i*.08));}
}

const themes={
  base:{notes:[110,165,220,247,220,165,147,165],wave:'square',tempo:185,gain:.012},
  sheep:{notes:[220,330,294,392,330,247,330,440],wave:'square',tempo:132,gain:.018},
  water:{notes:[110,147,165,220,196,165,147,123],wave:'sine',tempo:250,gain:.018},
  bomb:{notes:[82,82,98,82,110,82,123,73],wave:'sawtooth',tempo:125,gain:.019},
  tank:{notes:[73,73,73,98,73,110,98,73],wave:'square',tempo:110,gain:.02},
  blackout:{notes:[98,0,147,0,123,0,110,0],wave:'triangle',tempo:270,gain:.014},
  glitch:{notes:[440,117,622,196,880,147,330,98],wave:'sawtooth',tempo:92,gain:.014},
  duck:{notes:[330,330,440,330,247,294,330,220],wave:'square',tempo:170,gain:.016},
  miniworld:{notes:[110,165,247,330,247,196,294,440],wave:'sawtooth',tempo:115,gain:.018}
};
let currentTheme='base',beat=0;
function startMusic(){stopMusic();currentTheme='base';beat=0;musicTick();}
function stopMusic(){clearTimeout(state.musicTimer);state.musicTimer=null;}
function rethemeMusic(name){currentTheme=themes[name]?name:'base';beat=0;}
function musicTick(){
  if(!state.running||state.gameOver){return;}const th=themes[currentTheme]||themes.base;if(!state.paused&&state.sound){const f=th.notes[beat%th.notes.length];if(f){tone(f,.09,th.wave,th.gain);if(beat%4===0)tone(f/2,.12,'sine',th.gain*.75);}}
  beat++;state.musicTimer=setTimeout(musicTick,th.tempo);
}
