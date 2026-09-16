const THREE=await import('/stack-panic/vendor/three.module.min.js').catch(()=>import('https://unpkg.com/three@0.180.0/build/three.module.js'));

const canvas=document.getElementById('world');
const ui={
  hp:document.getElementById('hpFill'),hpText:document.getElementById('hpText'),xp:document.getElementById('xpFill'),level:document.getElementById('levelText'),
  objective:document.getElementById('objectiveText'),interact:document.getElementById('interact'),toast:document.getElementById('toast'),
  nectar:document.getElementById('nectar'),wax:document.getElementById('wax'),pollen:document.getElementById('pollen'),potions:document.getElementById('potions'),
  inv:document.getElementById('inventoryPanel'),talents:document.getElementById('talentPanel'),craft:document.getElementById('craftPanel'),death:document.getElementById('death'),
  boss:document.getElementById('bossWrap'),bossFill:document.getElementById('bossFill'),bossName:document.getElementById('bossName')
};
const slots=[...document.querySelectorAll('.slot')];

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x17281d);scene.fog=new THREE.FogExp2(0x17281d,.018);
const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.1,160);camera.position.set(11,15,14);

const hemi=new THREE.HemisphereLight(0xc7ddc0,0x172014,2.2);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe9b7,3.2);sun.position.set(-12,24,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-38;sun.shadow.camera.right=38;sun.shadow.camera.top=38;sun.shadow.camera.bottom=-38;scene.add(sun);

const mats={
  grass:new THREE.MeshStandardMaterial({color:0x35563b,roughness:1}),path:new THREE.MeshStandardMaterial({color:0x867052,roughness:1}),
  wax:new THREE.MeshStandardMaterial({color:0xd6a53d,roughness:.78}),darkWax:new THREE.MeshStandardMaterial({color:0x68471c,roughness:.85}),
  stone:new THREE.MeshStandardMaterial({color:0x6a7167,roughness:.94}),gloam:new THREE.MeshStandardMaterial({color:0x6e2749,emissive:0x3b1028,emissiveIntensity:.65}),
  bloom:new THREE.MeshStandardMaterial({color:0xad85e6,emissive:0x3d235d,emissiveIntensity:.5}),thorn:new THREE.MeshStandardMaterial({color:0x4d9965,roughness:.9}),
  water:new THREE.MeshPhysicalMaterial({color:0x386d74,roughness:.25,metalness:0,transparent:true,opacity:.78})
};

const root=new THREE.Group();scene.add(root);
function mesh(g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o}
mesh(new THREE.PlaneGeometry(92,92),mats.grass,0,0,0).rotation.x=-Math.PI/2;
const path=mesh(new THREE.PlaneGeometry(10,70),mats.path,-2,.016,0);path.rotation.x=-Math.PI/2;path.rotation.z=.12;
const river=mesh(new THREE.PlaneGeometry(92,7),mats.water,0,.025,11);river.rotation.x=-Math.PI/2;
for(let i=0;i<7;i++){const b=mesh(new THREE.BoxGeometry(2.3,.32,5.3),mats.darkWax,-7.5+i*2.5,.18,11);b.rotation.y=.05*Math.sin(i)}

function tree(x,z,s=1){const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.24,.4,2.5,7),mats.darkWax);trunk.position.y=1.25;g.add(trunk);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.35,1),mats.thorn);crown.position.y=3;g.add(crown);g.position.set(x,0,z);g.scale.setScalar(s);g.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true}});root.add(g)}
for(let i=0;i<38;i++){const a=Math.random()*Math.PI*2,r=18+Math.random()*25;tree(Math.cos(a)*r,Math.sin(a)*r,.7+Math.random()*.7)}
function flower(x,z,c=0xb685ec){const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.45,5),mats.thorn);stem.position.set(x,.22,z);const petal=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),new THREE.MeshBasicMaterial({color:c}));petal.position.set(x,.48,z);root.add(stem,petal)}
for(let i=0;i<120;i++)flower((Math.random()-.5)*70,(Math.random()-.5)*70,[0xe6b8ef,0xf0ce72,0x84dfad][i%3]);

function hiveTower(){const g=new THREE.Group();for(let i=0;i<5;i++){const h=new THREE.Mesh(new THREE.CylinderGeometry(2.2-i*.14,2.7-i*.08,1.1,8),mats.wax);h.position.y=.55+i*.85;g.add(h)}const door=new THREE.Mesh(new THREE.SphereGeometry(.65,12,8,0,Math.PI),new THREE.MeshStandardMaterial({color:0x1c1308}));door.rotation.y=Math.PI/2;door.position.set(0,.7,2.25);g.add(door);g.position.set(-15,0,-19);g.traverse(o=>{if(o.isMesh)o.castShadow=true});root.add(g)}hiveTower();

const gate=new THREE.Group();
for(const x of [-2.2,2.2]){const p=new THREE.Mesh(new THREE.BoxGeometry(1.2,5,1.2),mats.stone);p.position.set(x,2.5,-22);gate.add(p)}
const lintel=new THREE.Mesh(new THREE.BoxGeometry(5.6,1.1,1.4),mats.stone);lintel.position.set(0,5,-22);gate.add(lintel);
const barrier=new THREE.Mesh(new THREE.PlaneGeometry(4.1,4.4),new THREE.MeshBasicMaterial({color:0xb985ed,transparent:true,opacity:.45,side:THREE.DoubleSide}));barrier.position.set(0,2.5,-21.95);gate.add(barrier);root.add(gate);

const player=new THREE.Group();
const beeBody=new THREE.Mesh(new THREE.SphereGeometry(.6,12,8),mats.wax);beeBody.scale.set(1.2,.82,.82);player.add(beeBody);
const abdomen=new THREE.Mesh(new THREE.SphereGeometry(.55,12,8),mats.darkWax);abdomen.position.z=.72;abdomen.scale.set(1,.8,1.2);player.add(abdomen);
for(const x of [-.55,.55]){const wing=new THREE.Mesh(new THREE.SphereGeometry(.45,10,6),new THREE.MeshPhysicalMaterial({color:0xd7f5ef,transparent:true,opacity:.5,roughness:.1}));wing.scale.set(.65,.12,1.2);wing.position.set(x,.38,0);player.add(wing)}
const stinger=new THREE.Mesh(new THREE.ConeGeometry(.12,.65,6),new THREE.MeshStandardMaterial({color:0x272112}));stinger.rotation.x=Math.PI/2;stinger.position.z=1.25;player.add(stinger);player.position.set(-15,1,-14);player.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(player);

const state={hp:120,maxHp:120,xp:0,level:1,xpNext:80,dead:false,materials:{nectar:1,wax:1,pollen:0},potions:1,talentPoints:1,talents:{sting:0,bloom:0,ward:0},cooldowns:[0,0,0,0],ward:0,puzzle:0,gateOpen:false,bossDead:false,quest:'Find the three Bloom Shrines and awaken them in the right order.'};
const keys=new Set();let yaw=0,last=performance.now(),nearby=null,toastTimer=0;
addEventListener('keydown',e=>{keys.add(e.code);if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code))cast(+e.code.slice(-1)-1);if(e.code==='KeyQ')usePotion();if(e.code==='KeyE')interact();if(e.code==='KeyI')toggle(ui.inv);if(e.code==='KeyN')toggle(ui.talents);if(e.code==='KeyB')toggle(ui.craft);if(e.code==='Escape')closePanels();});addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('pointerdown',()=>cast(0));slots.forEach((s,i)=>s.addEventListener('click',()=>cast(i)));

document.getElementById('restart').addEventListener('click',()=>location.reload());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closePanels));
function toggle(el){const was=el.classList.contains('hidden');closePanels();if(was)el.classList.remove('hidden')}
function closePanels(){[ui.inv,ui.talents,ui.craft].forEach(x=>x.classList.add('hidden'))}
function toast(t){clearTimeout(toastTimer);ui.toast.textContent=t;ui.toast.classList.add('show');toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1900)}

const interactables=[];
function shrine(x,z,order,symbol){const g=new THREE.Group();const base=new THREE.Mesh(new THREE.CylinderGeometry(.7,.9,.5,8),mats.stone);base.position.y=.25;g.add(base);const rune=new THREE.Mesh(new THREE.OctahedronGeometry(.45),new THREE.MeshStandardMaterial({color:0xd1b1ef,emissive:0x6b328e,emissiveIntensity:1.2}));rune.position.y=1;g.add(rune);g.position.set(x,0,z);root.add(g);interactables.push({kind:'shrine',group:g,order,symbol,rune,used:false,label:`Awaken shrine ${symbol}`})}
shrine(-3,-4,1,'SUN');shrine(13,5,2,'BLOOM');shrine(-12,18,3,'MOON');
function resource(kind,x,z){const m=kind==='nectar'?mats.wax:kind==='pollen'?mats.bloom:mats.darkWax;const g=new THREE.Group();for(let i=0;i<5;i++){const p=new THREE.Mesh(new THREE.DodecahedronGeometry(.18+Math.random()*.1,0),m);p.position.set((Math.random()-.5)*.8,.2+Math.random()*.7,(Math.random()-.5)*.8);g.add(p)}g.position.set(x,0,z);root.add(g);interactables.push({kind:'resource',resource:kind,group:g,used:false,label:`Harvest ${kind}`})}
[['nectar',-8,3],['pollen',6,-7],['wax',17,15],['nectar',10,18],['pollen',-18,7],['wax',4,24]].forEach(r=>resource(...r));

const enemies=[];
function spawnEnemy(x,z,type='mite'){const boss=type==='boss';const g=new THREE.Group();const body=new THREE.Mesh(new THREE.IcosahedronGeometry(boss?1.2:.6,1),boss?mats.gloam:new THREE.MeshStandardMaterial({color:0x7a2d42,roughness:.8}));g.add(body);for(let i=0;i<4;i++){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,boss?1.1:.65,5),mats.darkWax);leg.rotation.z=Math.PI/2.8;leg.rotation.y=i*Math.PI/2;leg.position.set(Math.cos(i*Math.PI/2)*(boss?.9:.5),-.1,Math.sin(i*Math.PI/2)*(boss?.9:.5));g.add(leg)}g.position.set(x,boss?1.2:.65,z);g.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(g);const e={g,hp:boss?420:55,maxHp:boss?420:55,speed:boss?2.2:2.8,damage:boss?18:8,boss,type,dead:false,hit:0};enemies.push(e);return e}
[[-5,-10],[2,3],[9,9],[-16,10],[16,-2],[5,19],[-6,24]].forEach(p=>spawnEnemy(...p));

function nearestEnemy(range=9){let best=null,d0=range;for(const e of enemies){if(e.dead)continue;const d=player.position.distanceTo(e.g.position);if(d<d0){best=e;d0=d}}return best}
function damageEnemy(e,n){if(!e||e.dead)return;e.hp-=n;e.hit=.12;e.g.scale.setScalar(1.18);if(e.boss){ui.boss.classList.add('show');ui.bossFill.style.width=`${Math.max(0,e.hp/e.maxHp*100)}%`;}if(e.hp<=0){e.dead=true;scene.remove(e.g);gainXp(e.boss?160:28);state.materials.nectar+=e.boss?4:Math.random()<.45?1:0;state.materials.pollen+=Math.random()<.3?1:0;if(e.boss){state.bossDead=true;ui.boss.classList.remove('show');state.quest='The Gloam Warden is defeated. Return to the Hive.';toast('Guardian defeated — Verdant Reach is free.')}refresh();}}
function gainXp(n){state.xp+=n;while(state.xp>=state.xpNext){state.xp-=state.xpNext;state.level++;state.xpNext=Math.round(state.xpNext*1.28);state.talentPoints++;state.maxHp+=12;state.hp=state.maxHp;toast(`Level ${state.level} — talent point earned`)}refresh()}

function cast(i){if(state.dead||state.cooldowns[i]>0)return;const power=1+state.level*.08;
 if(i===0){const e=nearestEnemy(7);if(!e){toast('No target in stinger range');return}damageEnemy(e,(26+state.talents.sting*8)*power);state.cooldowns[0]=.55;yaw=Math.atan2(e.g.position.x-player.position.x,e.g.position.z-player.position.z)}
 if(i===1){state.cooldowns[1]=7;let hits=0;for(const e of enemies){if(!e.dead&&player.position.distanceTo(e.g.position)<6){damageEnemy(e,(34+state.talents.bloom*12)*power);hits++}}toast(hits?`Pollen Nova hits ${hits}`:'Pollen Nova blooms harmlessly')}
 if(i===2){state.cooldowns[2]=5;const dir=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));player.position.addScaledVector(dir,5.5);toast('Briarstep')}
 if(i===3){state.cooldowns[3]=10;state.ward=4+state.talents.ward;toast('Wax Ward active')}
 refreshSlots();}
function usePotion(){if(state.dead)return;if(!state.potions){toast('No healing potion');return}if(state.hp>=state.maxHp){toast('Vitality already full');return}state.potions--;state.hp=Math.min(state.maxHp,state.hp+58);toast('Royal jelly potion +58');refresh()}

function interact(){if(!nearby||state.dead)return;const x=nearby;if(x.kind==='resource'){if(x.used)return;x.used=true;state.materials[x.resource]+=2;root.remove(x.group);toast(`+2 ${x.resource}`)}
 else if(x.kind==='shrine'){if(x.used){toast('This shrine already hums with Bloom');return}if(x.order===state.puzzle+1){x.used=true;state.puzzle++;x.rune.material.color.set(0xf0ce72);x.rune.material.emissive.set(0xb77918);toast(`${x.symbol} shrine awakened (${state.puzzle}/3)`);if(state.puzzle===3)openGate()}else{state.puzzle=0;for(const s of interactables.filter(i=>i.kind==='shrine')){s.used=false;s.rune.material.color.set(0xd1b1ef);s.rune.material.emissive.set(0x6b328e)}toast('Wrong resonance — the shrine sequence resets')}}
 refresh()}
function openGate(){state.gateOpen=true;state.quest='The Bloom Gate is open. Cross it and defeat the Gloam Warden.';barrier.visible=false;spawnEnemy(0,-28,'boss');ui.bossName.textContent='GLOAM WARDEN';toast('The ancient gate opens. Something wakes beyond it.')}

function damagePlayer(n){if(state.ward>0)return;state.hp=Math.max(0,state.hp-n);if(state.hp<=0){state.dead=true;ui.death.classList.remove('hidden')}refresh()}

function refresh(){ui.hp.style.width=`${state.hp/state.maxHp*100}%`;ui.hpText.textContent=`${Math.ceil(state.hp)} / ${state.maxHp}`;ui.xp.style.width=`${state.xp/state.xpNext*100}%`;ui.level.textContent=state.level;ui.objective.textContent=state.quest;ui.nectar.textContent=state.materials.nectar;ui.wax.textContent=state.materials.wax;ui.pollen.textContent=state.materials.pollen;ui.potions.textContent=state.potions;renderPanels()}
function refreshSlots(){slots.forEach((s,i)=>{const cd=state.cooldowns[i];s.classList.toggle('cooling',cd>0);s.querySelector('.cd').textContent=cd>0?cd.toFixed(cd<1?1:0):''})}
function renderPanels(){ui.inv.querySelector('.panel-body').innerHTML=`<div class="panel-grid"><div class="card"><strong>🍯 Nectar × ${state.materials.nectar}</strong><small>Base for restorative brews.</small></div><div class="card"><strong>⬡ Wax × ${state.materials.wax}</strong><small>Used for wards and armour.</small></div><div class="card"><strong>✿ Pollen × ${state.materials.pollen}</strong><small>Arcane reagent.</small></div><div class="card"><strong>🧪 Potion × ${state.potions}</strong><small>Press Q to restore vitality.</small></div></div>`;
 ui.talents.querySelector('.panel-body').innerHTML=`<p>Talent points: <b>${state.talentPoints}</b></p><div class="panel-grid">${[['sting','Predator Sting','+8 stinger damage per rank'],['bloom','Superbloom','+12 nova damage per rank'],['ward','Royal Wax','+1 sec Wax Ward per rank']].map(([id,n,d])=>`<div class="card"><strong>${n} · ${state.talents[id]}/5</strong><small>${d}</small><button data-talent="${id}" ${state.talentPoints<=0||state.talents[id]>=5?'disabled':''}>Learn</button></div>`).join('')}</div>`;
 ui.talents.querySelectorAll('[data-talent]').forEach(b=>b.onclick=()=>{const id=b.dataset.talent;if(state.talentPoints>0&&state.talents[id]<5){state.talentPoints--;state.talents[id]++;toast('Talent learned');refresh()}});
 const can=state.materials.nectar>=2&&state.materials.pollen>=1;ui.craft.querySelector('.panel-body').innerHTML=`<div class="card"><strong>🧪 Royal Jelly Potion</strong><small>Restore 58 vitality. Cost: 2 nectar + 1 pollen.</small><button id="brew" ${can?'':'disabled'}>Brew potion</button></div><div class="card"><strong>⬡ Wax reinforcement</strong><small>Permanent +8 max vitality. Cost: 3 wax.</small><button id="reinforce" ${state.materials.wax>=3?'':'disabled'}>Reinforce armour</button></div>`;
 const brew=document.getElementById('brew');if(brew)brew.onclick=()=>{state.materials.nectar-=2;state.materials.pollen--;state.potions++;toast('Potion brewed');refresh()};const reinforce=document.getElementById('reinforce');if(reinforce)reinforce.onclick=()=>{state.materials.wax-=3;state.maxHp+=8;state.hp+=8;toast('Wax armour reinforced');refresh()};}

function update(dt){if(state.dead)return;state.cooldowns=state.cooldowns.map(x=>Math.max(0,x-dt));state.ward=Math.max(0,state.ward-dt);refreshSlots();
 let x=0,z=0;if(keys.has('KeyW')||keys.has('KeyZ')||keys.has('ArrowUp'))z-=1;if(keys.has('KeyS')||keys.has('ArrowDown'))z+=1;if(keys.has('KeyA')||keys.has('KeyQ')||keys.has('ArrowLeft'))x-=1;if(keys.has('KeyD')||keys.has('ArrowRight'))x+=1;
 if(x||z){const l=Math.hypot(x,z);x/=l;z/=l;const speed=5.8+(state.level-1)*.08;player.position.x+=x*speed*dt;player.position.z+=z*speed*dt;yaw=Math.atan2(x,z);player.rotation.y=yaw;player.position.y=1+Math.sin(performance.now()*.008)*.08}
 player.position.x=Math.max(-39,Math.min(39,player.position.x));player.position.z=Math.max(-39,Math.min(39,player.position.z));if(!state.gateOpen&&player.position.z<-20&&Math.abs(player.position.x)<3.2)player.position.z=-20;
 nearby=null;let nd=2.3;for(const i of interactables){if(i.used&&i.kind==='resource')continue;const d=player.position.distanceTo(i.group.position);if(d<nd){nd=d;nearby=i}}ui.interact.textContent=nearby?`E · ${nearby.label}`:'';ui.interact.classList.toggle('show',!!nearby);
 for(const e of enemies){if(e.dead)continue;const d=player.position.distanceTo(e.g.position);e.hit=Math.max(0,e.hit-dt);if(e.hit<=0)e.g.scale.lerp(new THREE.Vector3(1,1,1),.18);if(d<9){const dir=new THREE.Vector3().subVectors(player.position,e.g.position);dir.y=0;dir.normalize();if(d>1.2)e.g.position.addScaledVector(dir,e.speed*dt);if(d<1.45){e.attack=(e.attack||0)-dt;if(e.attack<=0){damagePlayer(e.damage);e.attack=e.boss?.8:1.25}}}e.g.rotation.y+=dt*(e.boss?.8:1.4)}
 const target=new THREE.Vector3(player.position.x+9,player.position.y+12,player.position.z+11);camera.position.lerp(target,1-Math.pow(.001,dt));camera.lookAt(player.position.x,player.position.y+.5,player.position.z);
}
function render(){renderer.render(scene,camera)}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();refresh();
function frame(t){const dt=Math.min(.033,(t-last)/1000||.016);last=t;update(dt);render();requestAnimationFrame(frame)}requestAnimationFrame(frame);
