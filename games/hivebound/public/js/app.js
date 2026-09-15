import { api } from './api.js';
import { HiveboundGame, CLASSES, SIGILS, DEFAULT_CONTROLS } from './game.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const screens=$$('.screen');
function showScreen(id){screens.forEach(x=>x.classList.toggle('active',x.id===id))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(n){return Math.floor(n).toLocaleString('en-US')}
function costText(cost){const ico={nectar:'🍯',wax:'⬡',pollen:'✿'};return Object.entries(cost).map(([k,v])=>`${ico[k]} ${v}`).join(' · ')||'Free'}
let user=null,lastResult=null,pendingDaily=false,toastTimer;

const CONTROL_STORAGE_KEY='hivebound.controls.v1';
const CONTROL_ACTIONS={up:'Move up',down:'Move down',left:'Move left',right:'Move right',ability:'Class ability'};
const DEFAULT_LABELS={up:'W',down:'S',left:'A',right:'D',ability:'Space'};
function loadControls(){
  try{
    const saved=JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null');
    return {bindings:{...DEFAULT_CONTROLS,...(saved?.bindings||{})},labels:{...DEFAULT_LABELS,...(saved?.labels||{})}};
  }catch{return {bindings:{...DEFAULT_CONTROLS},labels:{...DEFAULT_LABELS}}}
}
let controlConfig=loadControls();
function saveControls(){localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(controlConfig))}
function keyLabel(e){
  const named={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',' ':'Space',Escape:'Esc'};
  if(named[e.key])return named[e.key];
  if(e.key==='Shift')return e.location===1?'Left Shift':e.location===2?'Right Shift':'Shift';
  if(e.key==='Control')return e.location===1?'Left Ctrl':e.location===2?'Right Ctrl':'Ctrl';
  if(e.key==='Alt')return e.location===1?'Left Alt':e.location===2?'Right Alt':'Alt';
  return e.key.length===1?e.key.toUpperCase():e.key;
}

const modal=$('#modal'), modalContent=$('#modalContent'), modalClose=$('#modalClose');
let modalOnClose=null;
function openModal(html,{closable=true,onClose=null}={}){modalContent.innerHTML=html;modal.classList.remove('hidden');modalClose.style.display=closable?'block':'none';modal.dataset.closable=closable?'1':'0';modalOnClose=onClose}
function closeModal(){if(modal.dataset.closable!=='0'){modal.classList.add('hidden');const cb=modalOnClose;modalOnClose=null;cb?.()}}
modalClose.onclick=closeModal;modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});

const canvas=$('#gameCanvas');
const game=new HiveboundGame(canvas,{
  onState:updateHud,
  onCombatStart:({type,biome})=>{showScreen('gameScreen');$('#biomeLabel').textContent=biome.name.toUpperCase();$('#nodeLabel').textContent=type==='boss'?'REGION GUARDIAN':type==='elite'?'ELITE HUNT':'GLOAM SWARM'},
  onCombatFrame:frame=>{$('#abilityCd').style.width=`${frame.abilityPct*100}%`;$('#objective').textContent=frame.boss?'Defeat the Guardian':`Survive ${Math.max(0,Math.ceil(frame.duration-frame.time))}s`},
  onToast:toast,
  onTalent:(options,choose)=>choiceModal('Choose a Talent','The Hive changes with every decision.',options.map(t=>({tag:`${t.tag||'TALENT'} · RANK ${(game.talentRank(t.id)||0)+1}`,name:t.name,desc:t.desc,value:t})),choose),
  onLoot:(items,choose)=>choiceModal('Choose a Relic','Relics carry sigils. Matching sigils awaken Resonances.',items.map(i=>({tag:`${i.rarity.toUpperCase()} · ${SIGILS[i.sigil].icon} ${i.sigil}`,name:i.name,desc:i.desc,value:i,color:i.color})),choose),
  onCraft:(options,choose)=>craftModal(options,choose),
  onEvent:(options,choose)=>choiceModal('The Petal Whispers','There is no free power in the broken Bloom.',options.map(x=>({tag:x.tag,name:x.name,desc:x.desc,value:x})),choose),
  onPact:(options,choose)=>choiceModal('The Gloam Offers a Pact','The run may continue forever. The price rises with you.',options.map(x=>({tag:`PACT · +${x.gloam}% GLOAM`,name:x.name,desc:x.desc,value:x})),choose),
  onNodeComplete:()=>showPath(),
  onEnd:r=>showEnd(r)
},controlConfig.bindings);

function updateHud(s){
  $('#classPortrait').textContent=s.classDef.icon;$('#className').textContent=s.classDef.name;$('#classSubtitle').textContent=s.classDef.subtitle;
  $('#hpText').textContent=`${Math.ceil(s.hp)} / ${Math.ceil(s.maxHp)}`;$('#hpBar').style.width=`${Math.max(0,s.hp/s.maxHp*100)}%`;
  $('#levelText').textContent=s.level;$('#xpBar').style.width=`${s.xp/s.xpNext*100}%`;
  $('#damageStat').textContent=Math.round(s.stats.damage);$('#speedStat').textContent=Math.round(s.stats.speed);$('#critStat').textContent=`${Math.round(s.stats.crit*100)}%`;$('#cooldownStat').textContent=`${Math.round(s.ability.cd)}s`;
  $('#abilityKeyLabel').textContent=controlConfig.labels.ability||'Space';$('#abilityName').textContent=s.ability.name;$('#abilityDesc').textContent=s.ability.desc;
  $('#nectarCount').textContent=s.materials.nectar;$('#waxCount').textContent=s.materials.wax;$('#pollenCount').textContent=s.materials.pollen;
  $('#scoreText').textContent=fmt(s.score);$('#multiplierText').textContent=`×${s.multiplier.toFixed(2)}`;
  $('#regionStat').textContent=s.region;$('#gloamStat').textContent=`${Math.round(s.gloam)}%`;$('#killsStat').textContent=s.kills;
  $('#relicCount').textContent=`${s.relics.length} / 8`;
  $('#relics').innerHTML=s.relics.length?s.relics.map(r=>`<div class="relic" style="border-color:${r.color}55"><b style="color:${r.color}">${esc(r.name)}</b><small>${SIGILS[r.sigil].icon} ${r.sigil}</small></div>`).join(''):'<small class="muted">No relics yet.</small>';
  $('#resonances').innerHTML=Object.entries(SIGILS).map(([name,v])=>{const n=s.sigils[name]||0;return `<div class="resonance ${n>=2?'active':''}"><span style="color:${v.color}">${v.icon}</span><b>${name}</b><span>${n}/4</span></div>`}).join('');
}

function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800)}

function choiceModal(title,subtitle,options,choose){
  openModal(`<p class="eyebrow">HIVEBOUND</p><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p><div class="choice-grid">${options.map((o,i)=>`<button class="choice" data-i="${i}" ${o.color?`style="border-color:${o.color}66"`:''}><span class="tag" ${o.color?`style="color:${o.color}"`:''}>${esc(o.tag||'CHOICE')}</span><h3>${esc(o.name)}</h3><p>${esc(o.desc)}</p></button>`).join('')}</div>`,{closable:false});
  $$('.choice').forEach(btn=>btn.onclick=()=>{const o=options[Number(btn.dataset.i)];modal.classList.add('hidden');choose(o.value)});
}
function craftModal(options,choose){
  openModal(`<p class="eyebrow">WAX SHRINE</p><h2>Shape what you carried.</h2><p class="muted">Crafting is intentionally small: every choice should matter to the run.</p><div class="craft-list">${options.map((o,i)=>`<button class="craft-option" data-i="${i}" ${o.affordable?'':'disabled'}><span><b>${esc(o.name)}</b><small>${esc(o.desc)}</small></span><strong>${costText(o.cost)}</strong></button>`).join('')}</div>`,{closable:false});
  $$('.craft-option').forEach(btn=>btn.onclick=()=>{const o=options[Number(btn.dataset.i)];if(!o.affordable)return;modal.classList.add('hidden');choose(o)});
}

function showPath(){
  showScreen('pathScreen');const s=game.snapshot();$('#pathEyebrow').textContent=`REGION ${s.region} · ${s.biome.name.toUpperCase()}`;
  $('#pathHint').textContent=s.step>=4?'The Guardian bars the way forward.':'Every step feeds the Gloam. Greed scores higher.';
  const choices=game.pathChoices();$('#pathCards').style.gridTemplateColumns=`repeat(${Math.min(5,choices.length)},1fr)`;
  $('#pathCards').innerHTML=choices.map((n,i)=>`<button class="path-card" data-i="${i}"><span class="node-icon">${n.icon}</span><h3>${esc(n.title)}</h3><p>${esc(n.desc)}</p><span class="risk">${esc(n.risk)}</span></button>`).join('');
  $$('.path-card').forEach(b=>b.onclick=()=>game.choosePath(choices[Number(b.dataset.i)].type));
  $('#runSummaryBar').innerHTML=`<span>Score <b>${fmt(s.score)}</b></span><span>Level <b>${s.level}</b></span><span>Relics <b>${s.relics.length}</b></span><span>Gloam <b>${Math.round(s.gloam)}%</b></span><span>Multiplier <b>×${s.multiplier.toFixed(2)}</b></span>`;
}

function showEnd(r){lastResult=r;showScreen('endScreen');$('#endTitle').textContent=r.bosses?`The Gloam claimed a ${CLASSES[r.classId].name}.`:'The Bloom remembers your first steps.';$('#finalScore').textContent=fmt(r.score);
  $('#finalStats').innerHTML=`<span>🌿 Region <b>${r.region}</b></span><span>☠ Kills <b>${r.kills}</b></span><span>♛ Bosses <b>${r.bosses}</b></span><span>✦ Level <b>${r.level}</b></span><span>🌒 Gloam <b>${Math.round(r.gloam)}%</b></span>`;
  $('#submitStatus').textContent=user?'Your score can be submitted to the Hive.':'Log in to place this run on the leaderboard.';$('#submitBtn').textContent=user?'Submit Score':'Login to Submit';
}

function renderClasses(){
  $('#classGrid').innerHTML=Object.entries(CLASSES).map(([id,c])=>`<article class="class-card"><div class="class-icon">${c.icon}</div><span class="role">${c.role}</span><h3>${c.name}</h3><p>${c.description}</p><div class="class-traits">${c.traits.map(t=>`<span>✦ ${t}</span>`).join('')}</div><button class="primary choose-class" data-id="${id}">Choose ${c.name}</button></article>`).join('');
  $$('.choose-class').forEach(b=>b.onclick=()=>beginRun(b.dataset.id));
}

async function beginRun(classId){
  try{const run=await api.startRun(pendingDaily);game.newRun(classId,run.seed,run.runId,run.daily);pendingDaily=false;showPath()}catch(e){alert(`Could not start run: ${e.message}`)}
}

function applyControlPreset(name){
  const presets={
    qwerty:{bindings:{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',ability:'Space'},labels:{up:'W',down:'S',left:'A',right:'D',ability:'Space'}},
    azerty:{bindings:{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',ability:'Space'},labels:{up:'Z',down:'S',left:'Q',right:'D',ability:'Space'}},
    arrows:{bindings:{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',ability:'Space'},labels:{up:'↑',down:'↓',left:'←',right:'→',ability:'Space'}}
  };
  controlConfig={bindings:{...presets[name].bindings},labels:{...presets[name].labels}};
  game.setControls(controlConfig.bindings);saveControls();$('#abilityKeyLabel').textContent=controlConfig.labels.ability||'Space';renderControls();
}
function renderControls(message=''){
  modalContent.innerHTML=`<p class="eyebrow">CONTROLS</p><h2>Make the Hive yours.</h2><p class="muted">Click a binding, then press the key you want. Escape cancels. Bindings are saved on this device.</p><div class="control-list">${Object.entries(CONTROL_ACTIONS).map(([action,label])=>`<div class="control-row"><span>${esc(label)}</span><button class="secondary control-bind" data-action="${action}">${esc(controlConfig.labels[action]||controlConfig.bindings[action])}</button></div>`).join('')}</div><div class="control-presets"><button class="ghost control-preset" data-preset="qwerty">WASD</button><button class="ghost control-preset" data-preset="azerty">ZQSD</button><button class="ghost control-preset" data-preset="arrows">Arrows</button></div><p id="controlMessage" class="muted">${esc(message)}</p>`;
  $$('.control-preset').forEach(b=>b.onclick=()=>applyControlPreset(b.dataset.preset));
  $$('.control-bind').forEach(btn=>btn.onclick=()=>{
    const action=btn.dataset.action;btn.textContent='Press a key…';btn.classList.add('listening');
    const capture=e=>{
      e.preventDefault();e.stopImmediatePropagation();
      if(e.code==='Escape'){renderControls('Binding unchanged.');return}
      const conflict=Object.entries(controlConfig.bindings).find(([a,code])=>a!==action&&code===e.code);
      if(conflict){renderControls(`${keyLabel(e)} is already assigned to ${CONTROL_ACTIONS[conflict[0]]}.`);return}
      controlConfig.bindings[action]=e.code;controlConfig.labels[action]=keyLabel(e);game.setControls(controlConfig.bindings);saveControls();renderControls(`${CONTROL_ACTIONS[action]} → ${controlConfig.labels[action]}`);
      if(action==='ability')$('#abilityKeyLabel').textContent=controlConfig.labels.ability;
    };
    addEventListener('keydown',capture,{once:true,capture:true});
  });
}
function openControls(){
  const wasPaused=game.paused;
  if(game.running)game.paused=true;
  openModal('',{onClose:()=>{if(game.running)game.paused=wasPaused}});
  renderControls();
}

function openAuth(){
  if(user){openModal(`<p class="eyebrow">HIVE PROFILE</p><h2>${esc(user.username)}</h2><p class="muted">Best score: ${fmt(user.bestScore||0)} · Hive essence: ${fmt(user.essence||0)}</p><button class="secondary" id="logoutBtn">Log out</button>`);$('#logoutBtn').onclick=()=>{api.token='';user=null;refreshAccount();modal.classList.add('hidden')}}
  else{
    openModal(`<p class="eyebrow">HIVE ACCOUNT</p><h2>Carry your scores between games.</h2><div class="auth-grid"><form id="loginForm"><h3>Login</h3><input name="username" placeholder="Username" required><input name="password" type="password" placeholder="Password" required><button class="primary">Enter the Hive</button></form><form id="registerForm"><h3>Create account</h3><input name="username" minlength="3" maxlength="24" placeholder="Username" required><input name="password" minlength="6" type="password" placeholder="Password" required><button class="secondary">Create</button></form></div><p id="authError" class="muted"></p>`);
    $('#loginForm').onsubmit=e=>authSubmit(e,'login');$('#registerForm').onsubmit=e=>authSubmit(e,'register');
  }
}
async function authSubmit(e,mode){e.preventDefault();const fd=new FormData(e.currentTarget);try{user=await api[mode](fd.get('username'),fd.get('password'));refreshAccount();modal.classList.add('hidden');if(lastResult)showEnd(lastResult)}catch(err){$('#authError').textContent=err.message}}
function refreshAccount(){$('#accountBtn').textContent=user?`🐝 ${user.username}`:'Guest'}

async function openLeaderboard(daily=false){
  openModal(`<p class="eyebrow">GLOBAL HIVE</p><h2>Leaderboard</h2><div class="leaderboard-toggle"><button id="allScores" class="secondary ${daily?'':'active'}">All-time</button><button id="dailyScores" class="secondary ${daily?'active':''}">Daily Hive</button></div><div id="leaderboardBody"><p class="muted">Loading…</p></div>`);
  $('#allScores').onclick=()=>openLeaderboard(false);$('#dailyScores').onclick=()=>openLeaderboard(true);
  try{const scores=await api.leaderboard(daily);$('#leaderboardBody').innerHTML=scores.length?`<table class="leaderboard"><thead><tr><th>#</th><th>Player</th><th>Class</th><th>Region</th><th>Score</th></tr></thead><tbody>${scores.map(s=>`<tr><td>${s.rank}</td><td>${esc(s.username)}</td><td>${esc(CLASSES[s.classId]?.name||s.classId)}</td><td>${s.region}</td><td><b>${fmt(s.score)}</b></td></tr>`).join('')}</tbody></table>`:'<p class="muted">No score yet. The first legend could be you.</p>'}catch(e){$('#leaderboardBody').innerHTML=`<p class="muted">${esc(e.message)}</p>`}
}

$('#newRunBtn').onclick=()=>{pendingDaily=false;showScreen('classScreen')};$('#dailyRunBtn').onclick=()=>{pendingDaily=true;showScreen('classScreen')};$$('.back-home').forEach(b=>b.onclick=()=>showScreen('homeScreen'));
$('#leaderboardBtn').onclick=()=>openLeaderboard(false);$('#settingsBtn').onclick=openControls;$('#accountBtn').onclick=openAuth;$('#againBtn').onclick=()=>{pendingDaily=false;showScreen('classScreen')};
$('#submitBtn').onclick=async()=>{if(!lastResult)return;if(!user){openAuth();return}const btn=$('#submitBtn');btn.disabled=true;try{const r=await api.submitScore(lastResult);user=r.user;refreshAccount();$('#submitStatus').textContent=`Score submitted. Your best: ${fmt(user.bestScore)}.`;btn.textContent='Submitted ✓'}catch(e){$('#submitStatus').textContent=e.message;btn.disabled=false}};

renderClasses();
(async()=>{if(api.token){try{user=await api.me()}catch{api.token=''}}refreshAccount()})();
