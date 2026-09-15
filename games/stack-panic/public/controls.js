document.addEventListener('keydown',e=>{
  if(state.mini){state.mini.keys[e.key]=true;e.preventDefault();return;}
  if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(e.key))e.preventDefault();
  if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);if(e.key==='ArrowDown')softDrop();if(e.key==='ArrowUp'||e.key==='x'||e.key==='X')rotatePiece();if(e.key===' ')hardDrop();if(e.key==='p'||e.key==='P'||e.key==='Escape')togglePause();
});
document.addEventListener('keyup',e=>{if(state.mini)state.mini.keys[e.key]=false;});
document.querySelectorAll('.mobile-controls button').forEach(btn=>{
  const action=btn.dataset.action;const fire=()=>{if(action==='left')move(-1);if(action==='right')move(1);if(action==='rotate')rotatePiece();if(action==='down')softDrop();if(action==='drop')hardDrop();};btn.addEventListener('pointerdown',e=>{e.preventDefault();fire();});
});
document.getElementById('startBtn').addEventListener('click',()=>{ensureAudio();resetGame(false);});
document.getElementById('dailyBtn').addEventListener('click',()=>{ensureAudio();resetGame(true);});
document.getElementById('restartBtn').addEventListener('click',()=>{ensureAudio();resetGame(state.daily);});
pauseBtn.addEventListener('click',togglePause);
soundBtn.addEventListener('click',()=>{state.sound=!state.sound;soundBtn.textContent=`SOUND: ${state.sound?'ON':'OFF'}`;soundBtn.setAttribute('aria-pressed',String(state.sound));if(state.sound){ensureAudio();if(state.running&&!state.musicTimer)musicTick();}else stopMusic();});

let touchStart=null;
cabinet.addEventListener('pointerdown',e=>{if(state.mini)touchStart={x:e.clientX,y:e.clientY};});
cabinet.addEventListener('pointermove',e=>{if(!state.mini||!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;
  if(state.mini.three&&window.Breach){window.Breach.steer(dx*.12,-dy*.12);}
  else{state.mini.playerX=clamp(state.mini.playerX+dx*.012,-4.8,4.8);state.mini.playerZ+=dy*.006;}
  touchStart={x:e.clientX,y:e.clientY};});
cabinet.addEventListener('pointerup',()=>touchStart=null);

seedRun(crypto.getRandomValues(new Uint32Array(1))[0]);state.board=emptyBoard();state.next=makePiece();spawn();refreshBest();draw();requestAnimationFrame(update);
