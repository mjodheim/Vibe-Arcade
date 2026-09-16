import * as THREE from '/stack-panic/vendor/three.module.min.js';

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
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
let lowQuality=false;
function applyQuality(){
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,lowQuality?1:1.45));
  renderer.shadowMap.enabled=!lowQuality;
}
applyQuality();

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x14251b);
scene.fog=new THREE.FogExp2(0x17281d,.0155);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,150);

const hemi=new THREE.HemisphereLight(0xd9efd0,0x132116,1.72);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe5a4,2.65);sun.position.set(-13,21,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-34;sun.shadow.camera.right=34;sun.shadow.camera.top=34;sun.shadow.camera.bottom=-34;sun.shadow.bias=-.00035;scene.add(sun);
const hiveGlow=new THREE.PointLight(0xffc64f,10,27,2);hiveGlow.position.set(-15,5,-18);scene.add(hiveGlow);

function canvasTexture(draw,size=192){
  const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');draw(x,size);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;
}
function noiseTexture(base,spots){return canvasTexture((x,s)=>{
  x.fillStyle=base;x.fillRect(0,0,s,s);
  for(let i=0;i<1500;i++){const a=.018+Math.random()*.06,r=1+Math.random()*3;x.fillStyle=`rgba(${spots},${a})`;x.fillRect(Math.random()*s,Math.random()*s,r,r)}
  const g=x.createLinearGradient(0,0,s,s);g.addColorStop(0,'rgba(255,255,255,.05)');g.addColorStop(1,'rgba(0,0,0,.08)');x.fillStyle=g;x.fillRect(0,0,s,s);
});}
function honeyTexture(){return canvasTexture((x,s)=>{
  x.fillStyle='#c99227';x.fillRect(0,0,s,s);const r=15,h=Math.sqrt(3)*r;
  x.lineWidth=2.2;x.strokeStyle='rgba(92,50,10,.24)';
  for(let row=-1;row<s/h+2;row++)for(let col=-1;col<s/(r*3)+2;col++){
    const cx=col*r*3+(row%2?1.5*r:0),cy=row*h;x.beginPath();
    for(let k=0;k<6;k++){const a=Math.PI/3*k;const px=cx+r*Math.cos(a),py=cy+r*Math.sin(a);k?x.lineTo(px,py):x.moveTo(px,py)}x.closePath();x.stroke();
  }
  const g=x.createRadialGradient(s*.35,s*.25,5,s*.5,s*.5,s*.72);g.addColorStop(0,'rgba(255,235,139,.32)');g.addColorStop(1,'rgba(80,40,6,.08)');x.fillStyle=g;x.fillRect(0,0,s,s);
});}
const grassTex=noiseTexture('#426849','133,191,119');grassTex.repeat.set(12,12);
const pathTex=noiseTexture('#907853','220,190,135');pathTex.repeat.set(3,18);
const waxTex=honeyTexture();waxTex.repeat.set(2.2,2.2);
const barkTex=noiseTexture('#654522','175,124,58');barkTex.repeat.set(2,5);
const stoneTex=noiseTexture('#74796e','190,199,185');stoneTex.repeat.set(3,3);

const mats={
  grass:new THREE.MeshStandardMaterial({map:grassTex,color:0x6a9770,roughness:.98}),
  path:new THREE.MeshStandardMaterial({map:pathTex,color:0xd0b487,roughness:.94}),
  wax:new THREE.MeshStandardMaterial({map:waxTex,color:0xf0be50,roughness:.62,metalness:.03}),
  darkWax:new THREE.MeshStandardMaterial({map:barkTex,color:0x76501f,roughness:.82}),
  stone:new THREE.MeshStandardMaterial({map:stoneTex,color:0xa1a89a,roughness:.9}),
  gloam:new THREE.MeshStandardMaterial({color:0x823452,emissive:0x45162c,emissiveIntensity:.62,roughness:.68}),
  bloom:new THREE.MeshStandardMaterial({color:0xc09bed,emissive:0x4f2c73,emissiveIntensity:.5,roughness:.55}),
  thorn:new THREE.MeshStandardMaterial({color:0x5eaa70,roughness:.88}),
  water:new THREE.MeshStandardMaterial({color:0x4f8d94,roughness:.2,metalness:.05,transparent:true,opacity:.82})
};

const root=new THREE.Group();scene.add(root);
function addMesh(g,m,x=0,y=0,z=0,cast=false){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=cast;o.receiveShadow=true;root.add(o);return o}
const ground=addMesh(new THREE.PlaneGeometry(92,92,1,1),mats.grass);ground.rotation.x=-Math.PI/2;
const path=addMesh(new THREE.PlaneGeometry(9,72),mats.path,-2,.025,0);path.rotation.x=-Math.PI/2;path.rotation.z=.12;
const river=addMesh(new THREE.PlaneGeometry(92,6.8),mats.water,0,.055,11);river.rotation.x=-Math.PI/2;
for(let i=0;i<7;i++){const b=addMesh(new THREE.BoxGeometry(2.35,.28,5.15),mats.darkWax,-7.5+i*2.5,.18,11,true);b.rotation.y=.025*Math.sin(i)}

const treeCount=46,dummy=new THREE.Object3D();
const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.24,.38,2.6,10),mats.darkWax,treeCount);
const crowns=new THREE.InstancedMesh(new THREE.SphereGeometry(1.28,14,9),mats.thorn,treeCount);
trunks.receiveShadow=crowns.receiveShadow=true;trunks.castShadow=crowns.castShadow=false;
for(let i=0;i<treeCount;i++){
  const a=Math.random()*Math.PI*2,r=19+Math.random()*25,s=.7+Math.random()*.75,x=Math.cos(a)*r,z=Math.sin(a)*r;
  dummy.position.set(x,1.3*s,z);dummy.scale.set(s,s,s);dummy.rotation.y=Math.random()*Math.PI;dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x,3.25*s,z);dummy.scale.set(1.05*s,.92*s,1.05*s);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
}
trunks.instanceMatrix.needsUpdate=crowns.instanceMatrix.needsUpdate=true;root.add(trunks,crowns);

const flowerCount=135;
const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.018,.03,.42,6),mats.thorn,flowerCount);
const petals=new THREE.InstancedMesh(new THREE.SphereGeometry(.12,10,7),new THREE.MeshStandardMaterial({color:0xe8c0f0,emissive:0x4b2a5c,emissiveIntensity:.14,roughness:.72}),flowerCount);
for(let i=0;i<flowerCount;i++){
  const x=(Math.random()-.5)*68,z=(Math.random()-.5)*68,s=.75+Math.random()*.55;
  dummy.position.set(x,.21,z);dummy.scale.set(s,s,s);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x,.48*s,z);dummy.scale.set(s,s*.7,s);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);
}
stems.instanceMatrix.needsUpdate=petals.instanceMatrix.needsUpdate=true;root.add(stems,petals);

function hiveTower(x=-15,z=-19,s=1){
  const g=new THREE.Group();
  for(let i=0;i<6;i++){const h=new THREE.Mesh(new THREE.CylinderGeometry((2.2-i*.13)*s,(2.55-i*.08)*s,.92*s,24),mats.wax);h.position.y=.46*s+i*.73*s;h.castShadow=true;h.receiveShadow=true;g.add(h)}
  const lip=new THREE.Mesh(new THREE.TorusGeometry(1.1*s,.15*s,8,32),mats.darkWax);lip.rotation.x=Math.PI/2;lip.position.set(0,.9*s,2.08*s);g.add(lip);
  const door=new THREE.Mesh(new THREE.CircleGeometry(.82*s,24),new THREE.MeshStandardMaterial({color:0x201507,roughness:1}));door.position.set(0,.92*s,2.2*s);g.add(door);
  g.position.set(x,0,z);root.add(g);return g;
}
hiveTower();hiveTower(-21,-10,.64);hiveTower(-8,-24,.58);

const gate=new THREE.Group();
for(const x of [-2.15,2.15]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.7,.82,5.2,16),mats.stone);p.position.set(x,2.6,-22);p.castShadow=true;p.receiveShadow=true;gate.add(p)}
const lintel=new THREE.Mesh(new THREE.BoxGeometry(5.8,.95,1.3),mats.stone);lintel.position.set(0,5,-22);lintel.castShadow=true;gate.add(lintel);
const barrier=new THREE.Mesh(new THREE.PlaneGeometry(4.1,4.5),new THREE.MeshBasicMaterial({color:0xc28cf4,transparent:true,opacity:.34,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));barrier.position.set(0,2.5,-21.94);gate.add(barrier);root.add(gate);

const player=new THREE.Group();
const beeGold=new THREE.MeshStandardMaterial({color:0xf2b73c,roughness:.5});
const beeDark=new THREE.MeshStandardMaterial({color:0x2b2419,roughness:.68});
const wingMat=new THREE.MeshStandardMaterial({color:0xdffcf4,transparent:true,opacity:.48,roughness:.15,side:THREE.DoubleSide,depthWrite:false});
const thorax=new THREE.Mesh(new THREE.SphereGeometry(.58,22,14),beeGold);thorax.scale.set(1.15,.92,.95);player.add(thorax);
const abdomen=new THREE.Mesh(new THREE.SphereGeometry(.54,22,14),beeGold);abdomen.position.z=.75;abdomen.scale.set(.92,.82,1.2);player.add(abdomen);
for(const z of [.58,.82,.99]){const band=new THREE.Mesh(new THREE.TorusGeometry(.42,.055,8,28),beeDark);band.rotation.x=Math.PI/2;band.position.z=z;player.add(band)}
const head=new THREE.Mesh(new THREE.SphereGeometry(.4,20,13),beeDark);head.position.z=-.58;player.add(head);
const playerWings=[];for(const x of [-.5,.5]){const w=new THREE.Mesh(new THREE.SphereGeometry(.5,16,10),wingMat);w.scale.set(.75,.08,1.35);w.position.set(x,.38,.05);w.rotation.z=x<0?-.32:.32;player.add(w);playerWings.push(w)}
const sting=new THREE.Mesh(new THREE.ConeGeometry(.11,.62,10),beeDark);sting.rotation.x=Math.PI/2;sting.position.z=1.43;player.add(sting);
for(const x of [-.18,.18]){const ant=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.46,6),beeDark);ant.position.set(x,.22,-.87);ant.rotation.x=-.75;ant.rotation.z=x<0?.28:-.28;player.add(ant)}
player.position.set(-15,1.05,-14);player.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(player);

function beeSpriteTexture(){return canvasTexture((x,s)=>{
  x.clearRect(0,0,s,s);x.save();x.translate(s/2,s/2);x.fillStyle='rgba(232,255,248,.42)';x.beginPath();x.ellipse(-24,-12,25,11,-.4,0,Math.PI*2);x.ellipse(24,-12,25,11,.4,0,Math.PI*2);x.fill();
  x.fillStyle='#f2b73c';x.beginPath();x.ellipse(0,4,22,31,0,0,Math.PI*2);x.fill();x.fillStyle='#2a2113';for(const y of [-8,5,18])x.fillRect(-20,y,40,7);x.beginPath();x.arc(0,-23,15,0,Math.PI*2);x.fill();x.restore();
},128)}
const beeSpriteTex=beeSpriteTexture(),ambientBees=[];
for(let i=0;i<14;i++){
  const mat=new THREE.SpriteMaterial({map:beeSpriteTex,transparent:true,opacity:.72,depthWrite:false});const s=new THREE.Sprite(mat);const scale=.42+Math.random()*.45;s.scale.set(scale,scale,scale);s.userData={phase:Math.random()*Math.PI*2,radius:6+Math.random()*12,speed:.18+Math.random()*.2,height:2+Math.random()*5,centerX:-7+(Math.random()-.5)*8,centerZ:-8+(Math.random()-.5)*10};scene.add(s);ambientBees.push(s);
}
const pollenCount=72,pollenPos=new Float32Array(pollenCount*3),pollenPhase=[];
for(let i=0;i<pollenCount;i++){pollenPos[i*3]=(Math.random()-.5)*52;pollenPos[i*3+1]=.3+Math.random()*9;pollenPos[i*3+2]=(Math.random()-.5)*52;pollenPhase[i]=Math.random()*Math.PI*2}
const pollenGeo=new THREE.BufferGeometry();pollenGeo.setAttribute('position',new THREE.BufferAttribute(pollenPos,3));
const pollen=new THREE.Points(pollenGeo,new THREE.PointsMaterial({color:0xffd66c,size:.075,transparent:true,opacity:.38,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(pollen);

const state={hp:120,maxHp:120,xp:0,level:1,xpNext:80,dead:false,materials:{nectar:1,wax:1,pollen:0},potions:1,talentPoints:1,talents:{sting:0,bloom:0,ward:0},cooldowns:[0,0,0,0],ward:0,puzzle:0,gateOpen:false,bossDead:false,quest:'Find the three Bloom Shrines and awaken them in the right order.'};
const keys=new Set();let yaw=0,last=performance.now(),nearby=null,toastTimer=0,raf=0,active=true;

const cameraRig={azimuth:-.72,elevation:.74,distance:17,targetDistance:17,drag:false,lastX:0,lastY:0};
function updateCamera(dt){
  cameraRig.distance+=(cameraRig.targetDistance-cameraRig.distance)*Math.min(1,dt*8);
  const e=THREE.MathUtils.clamp(cameraRig.elevation,.28,1.22),h=Math.cos(e)*cameraRig.distance,y=Math.sin(e)*cameraRig.distance;
  const target=player.position.clone();target.y+=.55;
  const desired=new THREE.Vector3(target.x+Math.sin(cameraRig.azimuth)*h,target.y+y,target.z+Math.cos(cameraRig.azimuth)*h);
  camera.position.lerp(desired,1-Math.exp(-dt*10));camera.lookAt(target);
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(e.button===2||e.button===1){cameraRig.drag=true;cameraRig.lastX=e.clientX;cameraRig.lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId);return}if(e.button===0&&!panelOpen())cast(0)});
canvas.addEventListener('pointermove',e=>{if(!cameraRig.drag)return;const dx=e.clientX-cameraRig.lastX,dy=e.clientY-cameraRig.lastY;cameraRig.lastX=e.clientX;cameraRig.lastY=e.clientY;cameraRig.azimuth-=dx*.006;cameraRig.elevation=THREE.MathUtils.clamp(cameraRig.elevation+dy*.004,.28,1.22)});
addEventListener('pointerup',()=>cameraRig.drag=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();cameraRig.targetDistance=THREE.MathUtils.clamp(cameraRig.targetDistance+e.deltaY*.012,9,27)},{passive:false});

function panelOpen(){return![ui.inv,ui.talents,ui.craft].every(x=>x.classList.contains('hidden'))}
addEventListener('keydown',e=>{
  keys.add(e.code);
  if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code))cast(+e.code.slice(-1)-1);
  if(e.code==='KeyR')usePotion();if(e.code==='KeyE')interact();if(e.code==='KeyI')toggle(ui.inv);if(e.code==='KeyN')toggle(ui.talents);if(e.code==='KeyB')toggle(ui.craft);if(e.code==='Escape')closePanels();if(e.code==='KeyC'){cameraRig.azimuth=-.72;cameraRig.elevation=.74;cameraRig.targetDistance=17}
});
addEventListener('keyup',e=>keys.delete(e.code));
slots.forEach((s,i)=>s.addEventListener('click',()=>i===4?usePotion():cast(i)));
document.getElementById('restart').addEventListener('click',()=>location.reload());document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closePanels));
function toggle(el){const was=el.classList.contains('hidden');closePanels();if(was)el.classList.remove('hidden')}
function closePanels(){[ui.inv,ui.talents,ui.craft].forEach(x=>x.classList.add('hidden'))}
function toast(t){clearTimeout(toastTimer);ui.toast.textContent=t;ui.toast.classList.add('show');toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1700)}

const interactables=[];
function shrine(x,z,order,symbol){const g=new THREE.Group();const base=new THREE.Mesh(new THREE.CylinderGeometry(.75,.95,.48,16),mats.stone);base.position.y=.24;g.add(base);const ring=new THREE.Mesh(new THREE.TorusGeometry(.46,.06,8,28),mats.bloom);ring.rotation.x=Math.PI/2;ring.position.y=.84;g.add(ring);const rune=new THREE.Mesh(new THREE.OctahedronGeometry(.38,1),mats.bloom.clone());rune.position.y=1.15;g.add(rune);g.position.set(x,0,z);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});root.add(g);interactables.push({kind:'shrine',group:g,order,symbol,rune,used:false,label:`Awaken shrine ${symbol}`})}
shrine(-3,-4,1,'SUN');shrine(13,5,2,'BLOOM');shrine(-12,18,3,'MOON');
function resource(kind,x,z){const m=kind==='nectar'?mats.wax:kind==='pollen'?mats.bloom:mats.darkWax;const g=new THREE.Group();for(let i=0;i<5;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.17+Math.random()*.08,10,7),m);p.position.set((Math.random()-.5)*.8,.2+Math.random()*.7,(Math.random()-.5)*.8);g.add(p)}g.position.set(x,0,z);root.add(g);interactables.push({kind:'resource',resource:kind,group:g,used:false,label:`Harvest ${kind}`})}
[['nectar',-8,3],['pollen',6,-7],['wax',17,15],['nectar',10,18],['pollen',-18,7],['wax',4,24]].forEach(r=>resource(...r));

const enemies=[];
function spawnEnemy(x,z,type='mite'){
  const boss=type==='boss',g=new THREE.Group(),body=new THREE.Mesh(new THREE.SphereGeometry(boss?1.08:.55,18,12),boss?mats.gloam:mats.gloam.clone());body.scale.set(1.15,.8,1.2);g.add(body);
  const eyeMat=new THREE.MeshBasicMaterial({color:boss?0xff9ac0:0xffd1d9});for(const sx of [-.22,.22]){const eye=new THREE.Mesh(new THREE.SphereGeometry(boss?.09:.055,8,6),eyeMat);eye.position.set(sx,.16,-(boss?.92:.48));g.add(eye)}
  for(let i=0;i<6;i++){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,boss?.95:.55,7),mats.darkWax);leg.rotation.z=Math.PI/2.65;leg.rotation.y=i*Math.PI/3;leg.position.set(Math.cos(i*Math.PI/3)*(boss?.78:.44),-.12,Math.sin(i*Math.PI/3)*(boss?.78:.44));g.add(leg)}
  g.position.set(x,boss?1.25:.64,z);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(g);const e={g,hp:boss?420:55,maxHp:boss?420:55,speed:boss?2.05:2.65,damage:boss?18:8,boss,type,dead:false,hit:0,attack:0,home:new THREE.Vector3(x,g.position.y,z)};enemies.push(e);return e
}
[[-5,-10],[2,3],[9,9],[-16,10],[16,-2],[5,19],[-6,24]].forEach(p=>spawnEnemy(...p));
let boss=null;

function nearestEnemy(range=8){let best=null,d0=range;for(const e of enemies){if(e.dead)continue;const d=player.position.distanceTo(e.g.position);if(d<d0){best=e;d0=d}}return best}
function burst(pos,color=0xf2c55c,size=1){const ring=new THREE.Mesh(new THREE.RingGeometry(.35,.48,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(pos);ring.position.y=.18;ring.userData.life=.55;ring.userData.size=size;scene.add(ring);effects.push(ring)}
const effects=[];
function damageEnemy(e,n){if(!e||e.dead)return;e.hp-=n;e.hit=.12;e.g.scale.setScalar(1.12);burst(e.g.position,e.boss?0xff6fa5:0xf3c55b,.8);if(e.boss){ui.boss.classList.add('show');ui.bossFill.style.width=`${Math.max(0,e.hp/e.maxHp*100)}%`}if(e.hp<=0){e.dead=true;scene.remove(e.g);gainXp(e.boss?160:28);state.materials.nectar+=e.boss?4:Math.random()<.45?1:0;state.materials.pollen+=Math.random()<.3?1:0;if(e.boss){state.bossDead=true;ui.boss.classList.remove('show');state.quest='The Gloam Warden is defeated. Return to the Hive.';toast('Guardian defeated — Verdant Reach is free.')}refresh()}}
function gainXp(n){state.xp+=n;while(state.xp>=state.xpNext){state.xp-=state.xpNext;state.level++;state.xpNext=Math.round(state.xpNext*1.28);state.talentPoints++;state.maxHp+=12;state.hp=state.maxHp;toast(`Level ${state.level} — talent point earned`)}refresh()}
function cast(i){if(state.dead||panelOpen()||state.cooldowns[i]>0)return;const power=1+state.level*.08;
  if(i===0){const e=nearestEnemy(7);if(!e)return;damageEnemy(e,(26+state.talents.sting*8)*power);state.cooldowns[0]=.55;yaw=Math.atan2(e.g.position.x-player.position.x,e.g.position.z-player.position.z)}
  if(i===1){state.cooldowns[1]=7;let hits=0;burst(player.position,0xc9a1ff,2.4);for(const e of enemies){if(!e.dead&&player.position.distanceTo(e.g.position)<6){damageEnemy(e,(34+state.talents.bloom*12)*power);hits++}}if(!hits)toast('Pollen Nova found no target')}
  if(i===2){state.cooldowns[2]=5;const dir=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));player.position.addScaledVector(dir,4.8);burst(player.position,0x74dfa0,1.3)}
  if(i===3){state.cooldowns[3]=10;state.ward=4+state.talents.ward;burst(player.position,0xf1c85e,1.8)}refreshSlots()}
function usePotion(){if(state.dead||panelOpen())return;if(!state.potions){toast('No healing potion');return}if(state.hp>=state.maxHp)return;state.potions--;state.hp=Math.min(state.maxHp,state.hp+58);toast('Royal jelly +58');refresh()}

function interact(){if(!nearby||state.dead)return;const x=nearby;if(x.kind==='resource'){if(x.used)return;x.used=true;state.materials[x.resource]+=2;root.remove(x.group);toast(`+2 ${x.resource}`)}else if(x.kind==='shrine'){if(x.used)return;if(x.order===state.puzzle+1){x.used=true;state.puzzle++;x.rune.material.color.set(0xf0ce72);x.rune.material.emissive.set(0xb77918);burst(x.group.position,0xf1ca62,1.5);if(state.puzzle===3)openGate()}else{state.puzzle=0;for(const s of interactables.filter(i=>i.kind==='shrine')){s.used=false;s.rune.material.color.set(0xc09bed);s.rune.material.emissive.set(0x4f2c73)}toast('The resonance resets')}}refresh()}
function openGate(){state.gateOpen=true;state.quest='The shrine gate is open. Defeat the Gloam Warden beyond it.';barrier.visible=false;boss=spawnEnemy(0,-29,'boss');toast('The ancient gate opens.')}

function renderPanels(){
  ui.inv.querySelector('.panel-body').innerHTML=`<div class="panel-grid"><div class="card"><strong>🍯 Nectar</strong><small>${state.materials.nectar} gathered</small></div><div class="card"><strong>⬡ Wax</strong><small>${state.materials.wax} gathered</small></div><div class="card"><strong>✿ Pollen</strong><small>${state.materials.pollen} gathered</small></div><div class="card"><strong>🧪 Royal Jelly</strong><small>${state.potions} potion(s) · Press R</small></div></div>`;
  ui.talents.querySelector('.panel-body').innerHTML=`<p><b>${state.talentPoints}</b> point(s) available</p><div class="panel-grid">${[['sting','Predator Sting','+8 damage/rank'],['bloom','Pollen Nova','+12 AoE/rank'],['ward','Wax Ward','+1 sec/rank']].map(([id,n,d])=>`<div class="card"><strong>${n} · ${state.talents[id]}/3</strong><small>${d}</small><button data-talent="${id}" ${!state.talentPoints||state.talents[id]>=3?'disabled':''}>Learn rank</button></div>`).join('')}</div>`;
  ui.craft.querySelector('.panel-body').innerHTML=`<div class="panel-grid"><div class="card"><strong>Royal Jelly Potion</strong><small>2 nectar + 1 pollen</small><button data-craft="potion" ${state.materials.nectar<2||state.materials.pollen<1?'disabled':''}>Craft potion</button></div><div class="card"><strong>Wax Reinforcement</strong><small>3 wax · +12 max vitality</small><button data-craft="armor" ${state.materials.wax<3?'disabled':''}>Reinforce</button></div></div>`;
  ui.talents.querySelectorAll('[data-talent]').forEach(b=>b.onclick=()=>{const id=b.dataset.talent;if(state.talentPoints&&state.talents[id]<3){state.talentPoints--;state.talents[id]++;renderPanels()}});
  ui.craft.querySelectorAll('[data-craft]').forEach(b=>b.onclick=()=>{if(b.dataset.craft==='potion'&&state.materials.nectar>=2&&state.materials.pollen>=1){state.materials.nectar-=2;state.materials.pollen--;state.potions++}if(b.dataset.craft==='armor'&&state.materials.wax>=3){state.materials.wax-=3;state.maxHp+=12;state.hp+=12}refresh()});
}
function refresh(){ui.hp.style.width=`${Math.max(0,state.hp/state.maxHp*100)}%`;ui.hpText.textContent=`${Math.ceil(state.hp)} / ${state.maxHp}`;ui.xp.style.width=`${state.xp/state.xpNext*100}%`;ui.level.textContent=state.level;ui.objective.textContent=state.quest;ui.nectar.textContent=state.materials.nectar;ui.wax.textContent=state.materials.wax;ui.pollen.textContent=state.materials.pollen;ui.potions.textContent=state.potions;renderPanels();refreshSlots()}
function refreshSlots(){slots.forEach((s,i)=>{if(i===4)return;const cd=state.cooldowns[i]||0,surface=s.querySelector('.cd');s.classList.toggle('cooling',cd>0);if(surface)surface.textContent=cd>0?cd.toFixed(1):''})}

function updatePlayer(dt,t){
  if(state.dead||panelOpen())return;
  const forward=new THREE.Vector3(-Math.sin(cameraRig.azimuth),0,-Math.cos(cameraRig.azimuth)),right=new THREE.Vector3(Math.cos(cameraRig.azimuth),0,-Math.sin(cameraRig.azimuth)),move=new THREE.Vector3();
  if(keys.has('KeyW')||keys.has('KeyZ')||keys.has('ArrowUp'))move.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))move.sub(forward);if(keys.has('KeyD')||keys.has('ArrowRight'))move.add(right);if(keys.has('KeyA')||keys.has('KeyQ')||keys.has('ArrowLeft'))move.sub(right);
  if(move.lengthSq()){move.normalize();const speed=6.1;player.position.addScaledVector(move,speed*dt);yaw=Math.atan2(move.x,move.z);player.rotation.y=yaw;player.position.y=1.05+Math.sin(t*12)*.035}
  player.position.x=THREE.MathUtils.clamp(player.position.x,-42,42);player.position.z=THREE.MathUtils.clamp(player.position.z,-42,42);
  if(!state.gateOpen&&player.position.z<-20.6&&Math.abs(player.position.x)<3)player.position.z=-20.6;
  const flap=.38+Math.sin(t*36)*.52;playerWings[0].rotation.z=-.32-flap;playerWings[1].rotation.z=.32+flap;
}
function updateEnemies(dt,t){
  for(const e of enemies){if(e.dead)continue;e.attack=Math.max(0,e.attack-dt);e.hit=Math.max(0,e.hit-dt);if(e.hit<=0)e.g.scale.lerp(new THREE.Vector3(1,1,1),Math.min(1,dt*10));e.g.position.y=(e.boss?1.25:.64)+Math.sin(t*3+e.home.x)*.07;
    const d=e.g.position.distanceTo(player.position);if(d<(e.boss?15:10)&&d>1.25){const dir=player.position.clone().sub(e.g.position);dir.y=0;dir.normalize();e.g.position.addScaledVector(dir,e.speed*dt);e.g.rotation.y=Math.atan2(dir.x,dir.z)}else if(d<=1.45&&!state.dead&&e.attack<=0){e.attack=e.boss?.85:1.2;let dmg=e.damage;if(state.ward>0)dmg*=.42;state.hp-=dmg;burst(player.position,0xff6f91,.9);if(state.hp<=0){state.hp=0;state.dead=true;ui.death.classList.remove('hidden')}refresh()}}
}
function updateInteract(){let best=null,dist=2.5;for(const x of interactables){if(x.used&&x.kind==='resource')continue;const d=player.position.distanceTo(x.group.position);if(d<dist){dist=d;best=x}}nearby=best;ui.interact.textContent=best?`E · ${best.label}`:'';ui.interact.classList.toggle('show',!!best)}
function updateAmbient(t,dt){ambientBees.forEach((b,i)=>{const u=t*b.userData.speed+b.userData.phase;b.position.set(b.userData.centerX+Math.cos(u)*b.userData.radius,b.userData.height+Math.sin(u*1.8+i)*.9,b.userData.centerZ+Math.sin(u)*b.userData.radius*.58);b.material.rotation=Math.sin(t*12+i)*.08});const a=pollen.geometry.attributes.position;for(let i=0;i<pollenCount;i++){let y=a.getY(i)+dt*(.08+.06*Math.sin(t+pollenPhase[i]));if(y>9)y=.2;a.setY(i,y)}a.needsUpdate=true}
function updateEffects(dt){for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.userData.life-=dt;e.scale.multiplyScalar(1+dt*3*e.userData.size);e.material.opacity=Math.max(0,e.userData.life/.55);if(e.userData.life<=0){scene.remove(e);e.geometry.dispose();e.material.dispose();effects.splice(i,1)}}}

let perfStart=performance.now(),perfFrames=0,slowWindows=0;
function monitorPerformance(now){perfFrames++;if(now-perfStart<2200)return;const fps=perfFrames*1000/(now-perfStart);perfFrames=0;perfStart=now;if(fps<34)slowWindows++;else slowWindows=Math.max(0,slowWindows-1);if(slowWindows>=2&&!lowQuality){lowQuality=true;applyQuality();slowWindows=0}}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

document.addEventListener('visibilitychange',()=>{active=!document.hidden;if(active){last=performance.now();raf=requestAnimationFrame(frame)}else cancelAnimationFrame(raf)});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;cancelAnimationFrame(raf);document.body.classList.add('gpu-recover')});
canvas.addEventListener('webglcontextrestored',()=>location.reload());

function frame(now){if(!active)return;const dt=Math.min(.04,(now-last)/1000||.016),t=now*.001;last=now;for(let i=0;i<4;i++)state.cooldowns[i]=Math.max(0,state.cooldowns[i]-dt);state.ward=Math.max(0,state.ward-dt);updatePlayer(dt,t);updateEnemies(dt,t);updateInteract();updateAmbient(t,dt);updateEffects(dt);updateCamera(dt);refreshSlots();river.material.opacity=.79+Math.sin(t*.8)*.03;renderer.render(scene,camera);monitorPerformance(now);raf=requestAnimationFrame(frame)}

refresh();updateCamera(.016);raf=requestAnimationFrame(frame);
window.Hivebound3D={renderer,scene,camera,player,state,quality:()=>({lowQuality,drawCalls:renderer.info.render.calls})};
