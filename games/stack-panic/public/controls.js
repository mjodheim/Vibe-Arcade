document.addEventListener('keydown',e=>{
  if((e.key==='p'||e.key==='P'||e.key==='Escape')&&state.running&&!state.gameOver){
    e.preventDefault();togglePause();return;
  }
  if(state.mini){
    state.mini.keys[e.key]=true;
    if(typeof e.key==='string')state.mini.keys[e.key.toLowerCase()]=true;
    if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' ','w','a','s','d','W','A','S','D'].includes(e.key))e.preventDefault();
    return;
  }
  if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(e.key))e.preventDefault();
  if(e.key==='ArrowLeft')move(-1);
  if(e.key==='ArrowRight')move(1);
  if(e.key==='ArrowDown')softDrop();
  if(e.key==='ArrowUp'||e.key==='x'||e.key==='X')rotatePiece();
  if(e.key===' ')hardDrop();
});
document.addEventListener('keyup',e=>{
  if(!state.mini)return;
  state.mini.keys[e.key]=false;
  if(typeof e.key==='string')state.mini.keys[e.key.toLowerCase()]=false;
});

let repeatTimer=null,repeatDelay=null;
function stopRepeat(){clearInterval(repeatTimer);clearTimeout(repeatDelay);repeatTimer=null;repeatDelay=null;}
function fireAction(action){
  if(action==='left')move(-1);
  if(action==='right')move(1);
  if(action==='rotate')rotatePiece();
  if(action==='down')softDrop();
  if(action==='drop')hardDrop();
}
document.querySelectorAll('.mobile-controls button').forEach(btn=>{
  const action=btn.dataset.action;
  btn.addEventListener('pointerdown',e=>{
    e.preventDefault();stopRepeat();fireAction(action);
    if(['left','right','down'].includes(action)){
      repeatDelay=setTimeout(()=>{repeatTimer=setInterval(()=>fireAction(action),70);},190);
    }
  });
  btn.addEventListener('pointerup',stopRepeat);
  btn.addEventListener('pointercancel',stopRepeat);
  btn.addEventListener('pointerleave',stopRepeat);
});

document.getElementById('startBtn').addEventListener('click',()=>{ensureAudio();resetGame(false);});
document.getElementById('dailyBtn').addEventListener('click',()=>{ensureAudio();resetGame(true);});
document.getElementById('restartBtn').addEventListener('click',()=>{ensureAudio();resetGame(state.daily);});
pauseBtn.addEventListener('click',togglePause);
soundBtn.addEventListener('click',()=>{
  state.sound=!state.sound;
  soundBtn.textContent=`SOUND: ${state.sound?'ON':'OFF'}`;
  soundBtn.setAttribute('aria-pressed',String(state.sound));
  ensureAudio();Music.setEnabled(state.sound&&!state.paused);
  if(state.sound&&state.running&&!state.gameOver&&!state.paused)Music.start(state.activeEvent?state.activeEvent.id:'nominal');
  if(!state.sound)Music.stop();
});

let touchStart=null;
cabinet.addEventListener('pointerdown',e=>{
  if(state.mini){touchStart={x:e.clientX,y:e.clientY};cabinet.setPointerCapture?.(e.pointerId);}
});
cabinet.addEventListener('pointermove',e=>{
  if(!state.mini||!touchStart||state.paused)return;
  const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;
  if(state.mini.three&&window.Breach)window.Breach.steer(dx*.12,-dy*.12);
  else{state.mini.playerX=clamp(state.mini.playerX+dx*.012,-4.8,4.8);state.mini.playerZ+=dy*.006;}
  touchStart={x:e.clientX,y:e.clientY};
});
cabinet.addEventListener('pointerup',()=>touchStart=null);
cabinet.addEventListener('pointercancel',()=>touchStart=null);

document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&state.running&&!state.paused&&!state.gameOver)togglePause();
});

seedRun(crypto.getRandomValues(new Uint32Array(1))[0]);
state.board=emptyBoard();state.next=makePiece();spawn();refreshBest();draw();requestAnimationFrame(update);
