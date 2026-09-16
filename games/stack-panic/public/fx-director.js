'use strict';
(() => {
  const cabinet=document.getElementById('cabinet');
  if(!cabinet)return;
  const canvas=document.createElement('canvas');
  canvas.id='fxDirector';canvas.width=360;canvas.height=720;canvas.setAttribute('aria-hidden','true');cabinet.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const particles=[],marks=[],timers=new Set();let raf=0,last=0,running=false,gradeTimer=0;
  const rnd=(a,b)=>a+Math.random()*(b-a);

  // Timers count active gameplay time only. Cosmetic impacts must not finish
  // while the player is paused and then all fire at once on resume.
  const later=(fn,ms)=>{
    let remaining=Math.max(0,ms),lastTick=performance.now(),id=0;
    const tick=()=>{
      timers.delete(id);
      const now=performance.now();
      if(!state.paused) remaining-=now-lastTick;
      lastTick=now;
      if(remaining<=0){fn();return;}
      id=setTimeout(tick,Math.min(50,Math.max(12,remaining)));
      timers.add(id);
    };
    id=setTimeout(tick,Math.min(50,Math.max(12,remaining)));
    timers.add(id);
    return id;
  };

  function particle(p){particles.push({x:180,y:360,vx:0,vy:0,life:1,max:1,size:8,drag:.985,gravity:0,rot:0,vr:0,type:'spark',color:'#fff',...p});ensure();}
  function ensure(){if(running)return;running=true;last=performance.now();raf=requestAnimationFrame(frame);}
  function lensPulse(ms=430){cabinet.classList.remove('fx-lens');void cabinet.offsetWidth;cabinet.classList.add('fx-lens');later(()=>cabinet.classList.remove('fx-lens'),ms);}
  function burst(x,y,n=24,color='#ffd166',power=180){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=rnd(power*.35,power);const life=rnd(.35,.85);particle({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,size:rnd(2,7),rot:rnd(0,6.28),vr:rnd(-8,8),gravity:rnd(60,180),type:i%3?'spark':'chunk',color});}}
  function smoke(x,y,n=12,spread=40){for(let i=0;i<n;i++){const life=rnd(1.2,2.8);particle({x:x+rnd(-spread,spread),y:y+rnd(-12,12),vx:rnd(-20,20),vy:rnd(-70,-25),life,max:life,size:rnd(16,42),drag:.992,type:'smoke',color:'#8790a3'});}}
  function dust(x,y,n=20){for(let i=0;i<n;i++){const life=rnd(.6,1.5);particle({x:x+rnd(-55,55),y:y+rnd(-8,8),vx:rnd(-70,70),vy:rnd(-32,-6),life,max:life,size:rnd(10,28),drag:.975,type:'dust',color:'#d8d0bd'});}}
  function scorch(x,y,color='#1a0806'){marks.push({x,y,r:rnd(18,35),life:8,max:8,color});ensure();}
  function tracer(x1,y1,x2,y2,color='#ffd166'){const life=.22;particle({x:x1,y:y1,vx:(x2-x1)/life,vy:(y2-y1)/life,life,max:life,size:6,type:'tracer',color});later(()=>{burst(x2,y2,32,'#ff7a59',240);smoke(x2,y2,10,24);scorch(x2,y2);lensPulse();},life*1000);}

  function acidRain(ms=3600){
    let remaining=Math.max(0,ms);
    const step=()=>{
      if(remaining<=0)return;
      for(let i=0;i<4;i++){const life=rnd(1.2,2);particle({x:rnd(15,345),y:rnd(-80,-8),vx:rnd(-12,12),vy:rnd(260,420),life,max:life,size:rnd(3,7),type:'acid',color:'#b9ff66'});}
      if(Math.random()>.45){const x=rnd(25,335),y=rnd(240,660);later(()=>{burst(x,y,8,'#b9ff66',80);scorch(x,y,'#17330b');},rnd(180,520));}
      remaining-=55;later(step,55);
    };
    step();
  }
  function sheepDust(){let i=0;const step=()=>{dust(rnd(40,320),rnd(430,660),18);if(++i<=18)later(step,260);};step();}
  function magnetStorm(ms=3500){
    let remaining=Math.max(0,ms);
    const step=()=>{
      if(remaining<=0)return;
      for(let i=0;i<8;i++){const left=Math.random()>.5,x=left?-8:368;particle({x,y:rnd(90,650),vx:left?rnd(180,310):rnd(-310,-180),vy:rnd(-30,30),life:.55,max:.55,size:rnd(2,5),type:'spark',color:i%2?'#43efff':'#8f7cff'});}
      remaining-=100;later(step,100);
    };
    step();
  }
  function wreckHits(){[520,1160,1800].forEach((ms,i)=>later(()=>{const x=rnd(70,290),y=560-i*95;burst(x,y,45,'#d8dee9',300);smoke(x,y,15,50);scorch(x,y);lensPulse(520);},ms));}
  function clear(){particles.length=0;marks.length=0;ctx.clearRect(0,0,360,720);cancelAnimationFrame(raf);running=false;timers.forEach(clearTimeout);timers.clear();cabinet.classList.remove('fx-hot','fx-vignette','fx-lens');}
  function drawParticle(p,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.rotate(p.rot);if(p.type==='smoke'||p.type==='dust'){const g=ctx.createRadialGradient(0,0,0,0,0,p.size);g.addColorStop(0,p.type==='smoke'?'rgba(120,130,145,.34)':'rgba(220,210,190,.28)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,p.size,0,Math.PI*2);ctx.fill();}
    else if(p.type==='tracer'){ctx.strokeStyle=p.color;ctx.lineWidth=3;ctx.shadowBlur=18;ctx.shadowColor=p.color;ctx.beginPath();ctx.moveTo(-p.vx*.035,-p.vy*.035);ctx.lineTo(0,0);ctx.stroke();}
    else if(p.type==='acid'){ctx.fillStyle=p.color;ctx.shadowBlur=12;ctx.shadowColor=p.color;ctx.fillRect(-1,-p.size*2,2,p.size*4);}
    else{ctx.fillStyle=p.color;ctx.shadowBlur=10;ctx.shadowColor=p.color;if(p.type==='chunk')ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);else ctx.fillRect(-p.size*1.8,-1,p.size*3.6,2);}ctx.restore();}
  function frame(now){
    if(state.paused){last=now;raf=requestAnimationFrame(frame);return;}
    const dt=Math.min(.04,(now-last)/1000||.016);last=now;ctx.clearRect(0,0,360,720);
    for(let i=marks.length-1;i>=0;i--){const m=marks[i];m.life-=dt;if(m.life<=0){marks.splice(i,1);continue;}const a=Math.min(.42,m.life/m.max*.42);ctx.save();ctx.globalAlpha=a;ctx.fillStyle=m.color;ctx.beginPath();ctx.ellipse(m.x,m.y,m.r,m.r*.48,0,0,6.28);ctx.fill();ctx.restore();}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(p.drag,dt*60);p.vy=p.vy*Math.pow(p.drag,dt*60)+p.gravity*dt;p.rot+=p.vr*dt;drawParticle(p,Math.max(0,Math.min(1,p.life/p.max)));}
    if(particles.length||marks.length)raf=requestAnimationFrame(frame);else running=false;
  }
  function updateGrade(){const live=!!state.running&&!state.gameOver&&!state.paused;cabinet.classList.toggle('fx-hot',live&&state.chaos>=68);cabinet.classList.toggle('fx-vignette',live&&state.chaos>=86);}
  gradeTimer=setInterval(updateGrade,180);window.addEventListener('beforeunload',()=>clearInterval(gradeTimer));

  const eventVisualDuration=(fallback)=>Math.max(fallback,(state.eventUntil||0)-performance.now());
  const baseTank=window.spawnTank;if(typeof baseTank==='function')window.spawnTank=function(){baseTank();[500,1200,1900,2600].forEach((t,i)=>later(()=>tracer(265,500-i*18,rnd(70,300),rnd(210,600),'#ffd166'),t));};
  const baseSheep=window.spawnSheep;if(typeof baseSheep==='function')window.spawnSheep=function(){baseSheep();sheepDust();};
  const baseMeteor=window.spawnMeteors;if(typeof baseMeteor==='function')window.spawnMeteors=function(t){baseMeteor(t);for(let i=0;i<7;i++)later(()=>{const x=rnd(40,320),y=rnd(220,650);burst(x,y,38,'#ff7a59',260);smoke(x,y,14,32);scorch(x,y);lensPulse();},700+i*330);};
  const baseAcid=window.startAcid;if(typeof baseAcid==='function')window.startAcid=function(t){baseAcid(t);acidRain(eventVisualDuration(2400));};
  const baseMagnet=window.startMagnet;if(typeof baseMagnet==='function')window.startMagnet=function(t){baseMagnet(t);magnetStorm(eventVisualDuration(2600));};
  const baseWreck=window.spawnWreckingBall;if(typeof baseWreck==='function')window.spawnWreckingBall=function(t){baseWreck(t);wreckHits();};
  const baseReset=window.resetGame;if(typeof baseReset==='function')window.resetGame=function(daily=false){clear();baseReset(daily);};
  const baseEnd=window.endGame;if(typeof baseEnd==='function')window.endGame=function(){clear();baseEnd();};
  window.StackPanicFX={burst,smoke,dust,tracer,acidRain,magnetStorm,wreckHits,scorch,lensPulse,clear};
})();
