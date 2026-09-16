import * as THREE from '/stack-panic/vendor/three.module.min.js';

const COLORS=['#000000','#43efff','#8f7cff','#ff5ab7','#ffd166','#b9ff66','#ff7a59','#62a8ff','#d17cff','#ffffff'];
const ORBITAL_IMPACT_P=[.191,.296,.4,.504,.609,.713,.817];
let renderer=null,scene=null,camera=null,raf=0,active=false,started=0,duration=12000,type='blackhole',lastFrame=0;
let boardGroup=null,cubes=[],vortex=null,meteors=[],sheep=[],effects=[];

function dispose(){
  cancelAnimationFrame(raf);raf=0;active=false;
  if(scene){
    const geometries=new Set(),materials=new Set();
    scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);const m=o.material;if(Array.isArray(m))m.forEach(x=>materials.add(x));else if(m)materials.add(m);});
    geometries.forEach(g=>g.dispose?.());materials.forEach(m=>m.dispose?.());
  }
  renderer?.dispose?.();renderer=null;scene=null;camera=null;boardGroup=null;cubes=[];vortex=null;meteors=[];sheep=[];effects=[];
}

function setup(canvas){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(canvas.clientWidth||360,canvas.clientHeight||720,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x02030a);scene.fog=new THREE.FogExp2(0x02030a,.025);
  camera=new THREE.PerspectiveCamera(46,(canvas.clientWidth||360)/(canvas.clientHeight||720),.1,120);
  camera.position.set(0,0,24);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0x65ddff,0x180519,1.35));
  const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(5,7,9);scene.add(key);
  const rim=new THREE.PointLight(0xff3b9d,15,40,2);rim.position.set(-5,-1,7);scene.add(rim);
}

function cellWorld(cell){return new THREE.Vector3((cell.x-4.5)*.74,(9.5-cell.y)*.74,0);}

function buildBoard(board){
  boardGroup=new THREE.Group();cubes=[];scene.add(boardGroup);
  const geometry=new THREE.BoxGeometry(.66,.66,.66);
  const mats=COLORS.map(c=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.18,roughness:.28,metalness:.08,flatShading:true}));
  for(let y=0;y<board.length;y++)for(let x=0;x<board[y].length;x++){
    const v=board[y][x];if(!v)continue;
    const mesh=new THREE.Mesh(geometry,mats[v]||mats[9]);const p=cellWorld({x,y});mesh.position.copy(p);
    mesh.userData.base=p.clone();mesh.userData.seed=Math.random()*Math.PI*2;mesh.userData.cell={x,y};
    boardGroup.add(mesh);cubes.push(mesh);
  }
  const frame=new THREE.Mesh(new THREE.BoxGeometry(8.3,15.6,.24),new THREE.MeshBasicMaterial({color:0x16314a,wireframe:true,transparent:true,opacity:.34}));frame.position.z=-.55;scene.add(frame);
}

function starField(){
  const pos=new Float32Array(560*3);for(let i=0;i<560;i++){pos[i*3]=(Math.random()-.5)*32;pos[i*3+1]=(Math.random()-.5)*45;pos[i*3+2]=-20+Math.random()*36;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({color:0xbcecff,size:.065,transparent:true,opacity:.72}));scene.add(p);effects.push(p);
}

function buildBlackHole(){
  starField();vortex=new THREE.Group();vortex.position.z=2.4;scene.add(vortex);
  vortex.add(new THREE.Mesh(new THREE.SphereGeometry(1.05,28,20),new THREE.MeshBasicMaterial({color:0x000000})));
  for(let i=0;i<5;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.55+i*.42,.08+i*.018,8,64),new THREE.MeshBasicMaterial({color:i%2?0xff3b9d:0x43efff,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));ring.rotation.x=.7+i*.18;ring.rotation.y=.2+i*.31;vortex.add(ring);}
  const light=new THREE.PointLight(0x8f7cff,38,24,2);light.position.z=1.5;vortex.add(light);
}

function buildOrbital(targets=[]){
  starField();camera.position.set(0,0,25.5);
  const actual=targets.length?targets:Array.from({length:7},()=>({x:Math.floor(Math.random()*10),y:10+Math.floor(Math.random()*10)}));
  actual.slice(0,7).forEach((cell,i)=>{
    const group=new THREE.Group();
    const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.52+Math.random()*.3,1),new THREE.MeshStandardMaterial({color:0x382016,emissive:0xff5f20,emissiveIntensity:1.8,roughness:.8,flatShading:true}));
    const tail=new THREE.Mesh(new THREE.ConeGeometry(.34,4.2,8,1,true),new THREE.MeshBasicMaterial({color:0xff7a32,transparent:true,opacity:.44,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));tail.rotation.x=Math.PI/2;tail.position.z=2;
    group.add(rock,tail);group.userData.impactAt=ORBITAL_IMPACT_P[i]||(.2+i*.1);group.userData.startAt=Math.max(0,group.userData.impactAt-.17);group.userData.target=cellWorld(cell);group.userData.from=new THREE.Vector3(group.userData.target.x-7-Math.random()*3,group.userData.target.y+11+Math.random()*7,14+Math.random()*5);group.position.copy(group.userData.from);scene.add(group);meteors.push(group);
  });
}

function sheepModel(){
  const g=new THREE.Group();
  const wool=new THREE.MeshStandardMaterial({color:0xf2f3ff,roughness:.92,flatShading:true}),dark=new THREE.MeshStandardMaterial({color:0x171827,roughness:.7}),leg=new THREE.MeshStandardMaterial({color:0x777b8e,roughness:.8});
  const body=new THREE.Mesh(new THREE.DodecahedronGeometry(.55,0),wool);body.scale.set(1.28,.9,.9);g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.42,.44,.46),dark);head.position.set(.72,.05,.04);g.add(head);
  for(const sx of [-.35,.35])for(const sz of [-.22,.22]){const l=new THREE.Mesh(new THREE.BoxGeometry(.12,.58,.12),leg);l.position.set(sx,-.6,sz);g.add(l);}
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0x43efff}));eye.position.set(.94,.12,.25);g.add(eye);return g;
}

function buildSheepstorm(){
  scene.background=new THREE.Color(0x07140e);camera.position.set(0,1.2,25);camera.rotation.x=-.035;
  const moon=new THREE.Mesh(new THREE.SphereGeometry(2.3,24,18),new THREE.MeshBasicMaterial({color:0xb9ff66,transparent:true,opacity:.18}));moon.position.set(-5,8,-8);scene.add(moon);
  for(let i=0;i<26;i++){const s=sheepModel();s.userData.delay=Math.random()*.38;s.userData.speed=.82+Math.random()*.45;s.userData.lane=(Math.random()-.5)*13;s.userData.depth=-1+Math.random()*5;s.position.set(-8-Math.random()*9,s.userData.lane,s.userData.depth);s.rotation.z=(Math.random()-.5)*.15;scene.add(s);sheep.push(s);}
  const light=new THREE.PointLight(0xb9ff66,24,32,2);light.position.set(4,4,7);scene.add(light);
}

function blastCube(c,origin,power=6){
  if(c.userData.blasted)return;c.userData.blasted=true;
  const dir=c.position.clone().sub(origin);if(dir.lengthSq()<.02)dir.set(Math.random()-.5,Math.random()-.5,1);dir.normalize();
  c.userData.velocity=dir.multiplyScalar(power*(.6+Math.random()*.7));c.userData.velocity.z+=2+Math.random()*4;
}
function smashVisual(origin,radius=2){cubes.forEach(c=>{if(c.position.distanceTo(origin)<radius)blastCube(c,origin,7);});}
function animateBlasted(dt){cubes.forEach(c=>{if(!c.userData.blasted)return;const v=c.userData.velocity;c.position.addScaledVector(v,dt);v.y-=4.5*dt;c.rotation.x+=3.8*dt;c.rotation.y+=4.6*dt;c.scale.multiplyScalar(Math.exp(-.8*dt));});}

function spawnExplosion(pos){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.35,.08,8,32),new THREE.MeshBasicMaterial({color:0xffd166,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));ring.position.copy(pos);ring.userData.life=1;scene.add(ring);effects.push(ring);
  const light=new THREE.PointLight(0xff5f20,30,18,2);light.position.copy(pos);light.userData.life=1;scene.add(light);effects.push(light);
  const geo=new THREE.BufferGeometry(),arr=new Float32Array(42*3);for(let i=0;i<42;i++){arr[i*3]=pos.x;arr[i*3+1]=pos.y;arr[i*3+2]=pos.z+1;}geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
  const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffcf73,size:.16,transparent:true,opacity:1,blending:THREE.AdditiveBlending}));pts.userData.life=1;pts.userData.vel=Array.from({length:42},()=>new THREE.Vector3((Math.random()-.5)*5,(Math.random()-.5)*5,Math.random()*3));scene.add(pts);effects.push(pts);
}

function animateBlackHole(p,t){
  vortex.rotation.z=t*.00042;vortex.rotation.x=Math.sin(t*.0007)*.15;camera.position.z=24-p*4;camera.rotation.z=Math.sin(t*.018)*.012*(.3+p);
  cubes.forEach(c=>{const b=c.userData.base,s=c.userData.seed,delay=(s%(Math.PI*2))/(Math.PI*2)*.34,q=THREE.MathUtils.clamp((p-delay)/(.88-delay),0,1);if(q<=0)return;const spin=q*10+s,r=Math.hypot(b.x,b.y)*(1-q);c.position.x=Math.cos(spin)*r*.55+b.x*(1-q)*.32;c.position.y=Math.sin(spin)*r*.55+b.y*(1-q)*.32;c.position.z=q*4.2;c.rotation.x+=.06;c.rotation.y+=.08;const k=Math.max(.03,1-q*.97);c.scale.setScalar(k);});
}

function animateEffects(dt){
  effects.forEach(e=>{if(e.userData.life==null)return;e.userData.life-=dt*1.35;
    if(e.isMesh&&e.geometry?.type==='TorusGeometry'){e.scale.multiplyScalar(Math.exp(3.2*dt));e.material.opacity=Math.max(0,e.userData.life);}else if(e.isPointLight)e.intensity=30*Math.max(0,e.userData.life);else if(e.isPoints){const pos=e.geometry.attributes.position;for(let i=0;i<pos.count;i++){const v=e.userData.vel[i];pos.setXYZ(i,pos.getX(i)+v.x*dt,pos.getY(i)+v.y*dt,pos.getZ(i)+v.z*dt);v.y-=2.8*dt;}pos.needsUpdate=true;e.material.opacity=Math.max(0,e.userData.life);}}
  );
}

function animateOrbital(p,t,dt){
  boardGroup.rotation.z=Math.sin(t*.02)*.008*(.4+p);camera.position.x=Math.sin(t*.025)*.08*(1+p*2);
  meteors.forEach(m=>{const q=THREE.MathUtils.clamp((p-m.userData.startAt)/Math.max(.03,m.userData.impactAt-m.userData.startAt),0,1);if(q<=0)return;if(q<1){m.visible=true;m.position.lerpVectors(m.userData.from,m.userData.target,q*q);m.rotation.z+=5*dt;m.rotation.x+=4*dt;}else if(!m.userData.hit){m.userData.hit=true;m.visible=false;spawnExplosion(m.userData.target);smashVisual(m.userData.target,1.9);}});
  animateBlasted(dt);animateEffects(dt);
}

function animateSheepstorm(p,t,dt){
  boardGroup.rotation.y=Math.sin(t*.0015)*.08;boardGroup.rotation.z=Math.sin(t*.008)*.015*(.2+p);camera.position.x=Math.sin(t*.004)*.28;
  sheep.forEach((s,i)=>{const q=THREE.MathUtils.clamp((p-s.userData.delay)/(1-s.userData.delay),0,1);s.position.x=-9+q*20*s.userData.speed;s.position.y=s.userData.lane+Math.abs(Math.sin(t*.009+i))*.42;s.rotation.z=Math.sin(t*.012+i)*.12;s.rotation.y=-.22+Math.sin(t*.004+i)*.08;});
  cubes.forEach(c=>{
    const seed=(c.userData.seed%(Math.PI*2))/(Math.PI*2);
    if(!c.userData.blasted&&((p>.28&&seed<.16)||(p>.5&&seed>.42&&seed<.58)||(p>.7&&seed>.78)))blastCube(c,new THREE.Vector3(-4,c.position.y,0),5.2);
  });
  animateBlasted(dt);
}

function frame(now){
  if(!active)return;const p=Math.min(1,(now-started)/duration),dt=Math.min(.05,(now-lastFrame)/1000||0);lastFrame=now;
  if(type==='blackhole')animateBlackHole(p,now);else if(type==='orbital')animateOrbital(p,now,dt);else animateSheepstorm(p,now,dt);
  renderer.render(scene,camera);if(p<1)raf=requestAnimationFrame(frame);
}

function start({canvas,board,kind='blackhole',durationMs=12000,targets=[]}){
  dispose();type=kind;duration=durationMs;setup(canvas);buildBoard(board);if(type==='blackhole')buildBlackHole();else if(type==='orbital')buildOrbital(targets);else buildSheepstorm();started=performance.now();lastFrame=started;active=true;canvas.classList.add('live');raf=requestAnimationFrame(frame);
}
function stop(canvas){if(canvas)canvas.classList.remove('live');dispose();}

window.Cataclysm3D={start,stop};
