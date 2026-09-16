import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';

let clock = 1000;

class ClassList {
  constructor(){ this.values=new Set(); }
  add(...names){ names.forEach(n=>this.values.add(n)); }
  remove(...names){ names.forEach(n=>this.values.delete(n)); }
  toggle(name,force){
    if(force===undefined){ if(this.values.has(name)){this.values.delete(name);return false;} this.values.add(name);return true; }
    if(force)this.values.add(name);else this.values.delete(name);return !!force;
  }
  contains(name){ return this.values.has(name); }
}

const ctx2d = () => ({
  save(){},restore(){},translate(){},rotate(){},scale(){},fillRect(){},strokeRect(){},clearRect(){},
  beginPath(){},closePath(){},arc(){},ellipse(){},fill(){},stroke(){},moveTo(){},lineTo(){},quadraticCurveTo(){},
  setLineDash(){},fillText(){},
  createLinearGradient(){return {addColorStop(){}};},
  createRadialGradient(){return {addColorStop(){}};}
});

const elements = new Map();
function makeElement(id=''){
  const listeners=new Map();
  const children=new Map();
  const el={
    id,hidden:false,disabled:false,textContent:'',innerHTML:'',className:'',dataset:{},style:{setProperty(){},removeProperty(){}},
    classList:new ClassList(),offsetWidth:360,clientWidth:360,clientHeight:720,width:360,height:720,
    getContext(){return ctx2d();},
    querySelector(sel){ if(!children.has(sel))children.set(sel,makeElement(`${id}:${sel}`)); return children.get(sel); },
    querySelectorAll(){return [];},
    appendChild(){},remove(){},setAttribute(){},setPointerCapture(){},
    addEventListener(type,fn){ if(!listeners.has(type))listeners.set(type,[]); listeners.get(type).push(fn); },
    getAnimations(){return [];},
    animate(){return {finished:Promise.resolve(),pause(){},play(){}};}
  };
  return el;
}

for(const id of ['game','overlay','next','cabinet','score','lines','level','chaosLabel','chaosFill','eventTitle','eventText','banner','startPanel','gameOver','finalScore','deathLine','soundBtn','pauseBtn','dailyBadge','bestFree','bestDaily','newBest','crash','advert','breach','startBtn','dailyBtn','restartBtn']) elements.set(id,makeElement(id));

const docListeners=[];
const document={
  hidden:false,
  body:makeElement('body'),
  getElementById(id){ if(!elements.has(id))elements.set(id,makeElement(id)); return elements.get(id); },
  querySelectorAll(){return [];},
  createElement(tag){const el=makeElement(tag);if(tag==='canvas'){el.width=360;el.height=720;}return el;},
  createElementNS(ns,tag){return makeElement(tag);},
  addEventListener(type,fn,opts){docListeners.push({type,fn,capture:opts===true||!!opts?.capture});},
  __dispatch(type,event){
    event.preventDefault ||= ()=>{};
    event.stopImmediatePropagation ||= ()=>{event.__stopped=true;};
    const list=docListeners.filter(x=>x.type===type).sort((a,b)=>Number(b.capture)-Number(a.capture));
    for(const item of list){item.fn(event);if(event.__stopped)break;}
  }
};

const storage=new Map();
const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v))};
const windowListeners=[];

const sandbox={
  console,Math,Date,JSON,Uint32Array,crypto:webcrypto,localStorage,document,
  performance:{now:()=>clock},
  requestAnimationFrame:()=>1,cancelAnimationFrame(){},
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
  devicePixelRatio:1,
  addEventListener(type,fn){windowListeners.push({type,fn});},
  removeEventListener(){},
};
sandbox.window=sandbox;sandbox.globalThis=sandbox;
vm.createContext(sandbox);

const classic=[
  'public/music.js','public/core.js','public/events.js','public/audio.js','public/runtime.js',
  'public/sabotage.js','public/ui-cinematics.js','public/events-only.js','public/fx-director.js',
  'public/cataclysms.js','public/qa-fixes.js','public/controls.js'
];
for(const file of classic){
  const source=readFileSync(file,'utf8');
  try{vm.runInContext(source,sandbox,{filename:file});}
  catch(error){console.error(`Failed while loading ${file}`);throw error;}
}

vm.runInContext(`globalThis.__test={
  state,EVENT_POOL,SIDE_EVENTS,seedRun,makePiece,emptyBoard,spawn,clearLines,weightedEvent,
  scrambleSettledRows,liftBadlyPlacedBlocks,sabotagePulse,spawnSheep,dropInterval,glitchBoard,
  togglePause,hardDrop,showBanner
}`,sandbox);
const t=sandbox.__test;
const countCells=board=>board.reduce((sum,row)=>sum+row.filter(Boolean).length,0);

// Events-only contract is true at runtime, not just in CSS.
assert(!t.EVENT_POOL.some(e=>e.id==='ad'||e.id==='bsod'),'message-only incidents survived runtime filtering');
assert(t.EVENT_POOL.some(e=>e.id==='shuffle'),'hostile shuffle incident missing');
assert(!t.SIDE_EVENTS.includes('ad')&&!t.SIDE_EVENTS.includes('bsod'),'message-only side incidents survived filtering');

// Seven-bag: every consecutive bag contains exactly the seven piece types.
t.seedRun(0x12345678);
const bag14=Array.from({length:14},()=>t.makePiece().type);
assert.equal(new Set(bag14.slice(0,7)).size,7,'first seven-bag contains duplicates');
assert.equal(new Set(bag14.slice(7,14)).size,7,'second seven-bag contains duplicates');

// Line clears created by incidents must never poison score with NaN.
t.state.board=t.emptyBoard();
for(let y=15;y<20;y++)t.state.board[y]=Array(10).fill(1);
t.state.score=0;t.state.lines=0;t.state.level=1;t.state.chaos=0;t.state.particles=[];t.state.sound=false;
t.clearLines();
assert.equal(t.state.lines,5,'five-line incident clear not accounted for');
assert(Number.isFinite(t.state.score),'score became non-finite after clearing >4 lines');

// Shuffle/lift sabotage preserves settled-cell count and board dimensions.
t.seedRun(0xdecafbad);t.state.board=t.emptyBoard();
for(let y=8;y<20;y++)for(let x=0;x<10;x++)if((x+y)%3!==0)t.state.board[y][x]=1+(x%7);
t.state.piece={matrix:[[1,1],[1,1]],x:4,y:5,color:1,type:1};
const protectedBefore=t.state.board[5].slice();
const before=countCells(t.state.board);
for(let i=0;i<25;i++){t.scrambleSettledRows(4);t.liftBadlyPlacedBlocks(3);}
assert.equal(countCells(t.state.board),before,'shuffle/lift changed settled-cell count');
assert.deepEqual(t.state.board[5],protectedBefore,'sabotage touched a row occupied by the falling piece');
assert.equal(t.state.board.length,20,'board row count changed');
assert(t.state.board.every(row=>row.length===10),'board column count changed');

// Sheepocalypse is now genuinely a herd.
t.spawnSheep();
assert(t.state.sheep.length>=12&&t.state.sheep.length<=20,'sheep count outside hostile range');

// Difficulty must tighten as chaos and level rise.
t.state.level=1;t.state.chaos=0;const calm=t.dropInterval();
t.state.level=8;t.state.chaos=90;const hostile=t.dropInterval();
assert(hostile<calm,'drop interval does not accelerate under pressure');
assert(hostile>=72,'drop interval broke its safety floor');

// Event selection can run repeatedly without returning removed message incidents.
t.state.level=10;t.state.chaos=100;t.state.recentEvents=[];t.state.eventCooldown=null;
for(let i=0;i<300;i++){
  const e=t.weightedEvent();
  assert(e&&e.id,'weightedEvent returned no event');
  assert.notEqual(e.id,'ad');assert.notEqual(e.id,'bsod');
}

// Glitch preserves board shape even after many runs.
for(let i=0;i<50;i++)t.glitchBoard();
assert.equal(t.state.board.length,20);assert(t.state.board.every(row=>row.length===10));

// Pause must freeze post-runtime timers too.
t.state.running=true;t.state.gameOver=false;t.state.cataclysm=null;t.state.paused=false;t.state.pauseStartedAt=0;
t.state.shuffleEvent={next:9000};t.state.nextRealityFailAt=12000;t.state.nextEventAt=7000;
clock=2000;t.togglePause();
assert.equal(t.state.paused,true,'pause did not engage');
clock=7000;t.togglePause();
assert.equal(t.state.paused,false,'pause did not release');
assert.equal(t.state.shuffleEvent.next,14000,'shuffle timer advanced while paused');
assert.equal(t.state.nextRealityFailAt,17000,'REALITY FAIL cooldown advanced while paused');
assert.equal(t.state.nextEventAt,12000,'base incident timer did not shift with pause');

// Repeated hard-drop / rotate / pause keys are blocked before the gameplay listener.
t.state.board=t.emptyBoard();t.seedRun(123);t.state.next=t.makePiece();t.spawn();t.state.running=true;t.state.paused=false;t.state.gameOver=false;t.state.inputLocked=false;t.state.mini=null;t.state.score=0;
const pieceBefore=t.state.piece;
document.__dispatch('keydown',{key:' ',repeat:true});
assert.equal(t.state.piece,pieceBefore,'OS key-repeat triggered a hard drop');

document.__dispatch('keydown',{key:' ',repeat:false});
assert.notEqual(t.state.piece,pieceBefore,'normal hard drop was blocked');

// Static integration assertions for visual bugs that the logic harness cannot render.
const fx=readFileSync('public/fx-director.js','utf8');
assert(!fx.includes('window.state'),'FX grading still reads nonexistent window.state');
assert(fx.includes('state.eventUntil'),'long-running FX are not tied to event duration');
assert(fx.includes('if(state.paused)'),'FX particle clock does not honor pause');
const incident3d=readFileSync('public/incident-3d.js','utf8');
assert(incident3d.includes('state.tank.flashUntil'),'3D tank muzzle is not synchronized to gameplay shots');
assert(incident3d.includes('if(state.paused)'),'3D incident actors do not honor pause');
const eventsCss=readFileSync('public/events-only.css','utf8');
assert(eventsCss.includes('.reality-fail-copy'),'REALITY FAIL text message is still visible');
const controls=readFileSync('public/controls.js','utf8');
for(const mode of ['state.cataclysm?.music','state.mini','shuffle'])assert(controls.includes(mode),`sound toggle loses ${mode} soundtrack`);
const html=readFileSync('public/index.html','utf8');
assert(html.indexOf('/stack-panic/qa-fixes.js')<html.indexOf('/stack-panic/controls.js'),'QA input hardening must load before controls');

console.log('STACK PANIC runtime smoke: all gameplay invariants passed');
