import * as THREE from '/stack-panic/vendor/three.module.min.js';

// Lightweight 3D incident actor layer. It never owns gameplay: it only mirrors
// incidents selected by events.js. If WebGL fails, the existing DOM/canvas
// actors remain as the fallback.
const layer=document.createElement('canvas');
layer.id='incident3d';layer.width=360;layer.height=720;layer.setAttribute('aria-hidden','true');
const cabinet=document.getElementById('cabinet');
if(cabinet)cabinet.appendChild(layer);

let renderer=null,scene=null,camera=null,raf=0,active=null,started=0,duration=0,actors=[],effects=[],pausedAt=0,lastW=0,lastH=0;

function disposeObject(root){
  root?.traverse?.(o=>{o.geometry?.dispose?.();const m=o.material;if(Array.isArray(m))m.forEach(x=>x.dispose?.());else m?.dispose?.();});
}
function clear(){
  cancelAnimationFrame(raf);raf=0;active=null;actors.forEach(disposeObject);effects.forEach(disposeObject);actors=[];effects=[];pausedAt=0;
  renderer?.dispose?.();renderer=null;scene=null;camera=null;layer.classList.remove('live');
}
function resizeRenderer(){
  if(!renderer||!camera)return;
  const w=Math.max(1,Math.round(layer.clientWidth||360)),h=Math.max(1,Math.round(layer.clientHeight||720));
  if(w===lastW&&h===lastH)return;
  lastW=w;lastH=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function setup(){
  clear();
  renderer=new THREE.WebGLRenderer({canvas:layer,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(0,0,18);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xb8ebff,0x16091e,2));const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(4,8,10);scene.add(key);
  lastW=lastH=0;resizeRenderer();layer.classList.add('live');
}

function sheepModel(){
  const g=new THREE.Group();
  const wool=new THREE.MeshStandardMaterial({color:0xf3f5ff,roughness:.88,flatShading:true});
  const dark=new THREE.MeshStandardMaterial({color:0x171827,roughness:.72,flatShading:true});
  const hoof=new THREE.MeshStandardMaterial({color:0x464b5a,roughness:.8});
  const cyan=new THREE.MeshBasicMaterial({color:0x43efff});
  const magenta=new THREE.MeshStandardMaterial({color:0xff5ab7,emissive:0xff167d,emissiveIntensity:.8,roughness:.5});
  const body=new THREE.Group();
  [[0,0,0,.72],[.48,.05,.06,.48],[-.48,.02,-.02,.48],[.1,.33,.02,.42],[-.1,-.32,.02,.42]].forEach(([x,y,z,r])=>{const m=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),wool);m.position.set(x,y,z);body.add(m);});
  g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.65,.62,.68),dark);head.position.set(.98,.05,.06);head.rotation.z=-.05;g.add(head);
  const muzzle=new THREE.Mesh(new THREE.BoxGeometry(.22,.25,.34),dark);muzzle.position.set(1.32,-.05,.06);g.add(muzzle);
  const ear=new THREE.Mesh(new THREE.ConeGeometry(.16,.45,4),dark);ear.position.set(1.02,.43,.02);ear.rotation.z=-1.1;g.add(ear);
  const tag=new THREE.Mesh(new THREE.BoxGeometry(.12,.23,.05),magenta);tag.position.set(1.14,.45,.05);tag.rotation.z=.3;g.add(tag);
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),cyan);eye.position.set(1.29,.16,.35);g.add(eye);
  for(const [x,z] of [[-.48,-.33],[-.48,.33],[.42,-.33],[.42,.33]]){
    const leg=new THREE.Group();const upper=new THREE.Mesh(new THREE.BoxGeometry(.16,.78,.16),hoof);upper.position.y=-.42;leg.add(upper);const foot=new THREE.Mesh(new THREE.BoxGeometry(.25,.14,.32),dark);foot.position.set(.07,-.84,.04);leg.add(foot);leg.position.set(x,-.48,z);g.add(leg);
  }
  g.userData.legs=g.children.filter(x=>x.type==='Group').slice(1);return g;
}

function tankModel(){
  const g=new THREE.Group();
  const olive=new THREE.MeshStandardMaterial({color:0x6f7e43,roughness:.68,metalness:.24,flatShading:true});
  const dark=new THREE.MeshStandardMaterial({color:0x202319,roughness:.85,metalness:.15});
  const hot=new THREE.MeshBasicMaterial({color:0xffd166});
  for(const z of [-.72,.72]){
    const track=new THREE.Mesh(new THREE.BoxGeometry(3.9,.65,.52),dark);track.position.set(0,-.65,z);g.add(track);
    for(let x=-1.55;x<=1.55;x+=.62){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.18,12),olive);wheel.rotation.x=Math.PI/2;wheel.position.set(x,-.66,z+(z>0?.28:-.28));g.add(wheel);}
  }
  const hull=new THREE.Mesh(new THREE.BoxGeometry(3.5,1.05,1.75),olive);hull.position.y=-.05;g.add(hull);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(1.05,1.2,4),olive);nose.rotation.z=-Math.PI/2;nose.rotation.y=Math.PI/4;nose.position.set(1.95,-.05,0);nose.scale.z=.85;g.add(nose);
  const turretPivot=new THREE.Group();turretPivot.position.set(.15,.72,0);g.add(turretPivot);
  const turret=new THREE.Mesh(new THREE.CylinderGeometry(.88,1.02,.58,8),olive);turret.rotation.x=Math.PI/2;turretPivot.add(turret);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,2.8,10),dark);barrel.rotation.z=-Math.PI/2;barrel.position.x=1.7;turretPivot.add(barrel);
  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),hot);muzzle.position.x=3.08;muzzle.visible=false;turretPivot.add(muzzle);
  const lamp=new THREE.PointLight(0xffd166,0,9,2);lamp.position.copy(muzzle.position);turretPivot.add(lamp);
  g.userData.turret=turretPivot;g.userData.muzzle=muzzle;g.userData.lamp=lamp;return g;
}

function startSheep(){
  try{setup();active='sheep';duration=7600;started=performance.now();camera.position.set(0,0,20);
    for(let i=0;i<18;i++){
      const s=sheepModel();s.scale.setScalar(.72+Math.random()*.42);s.position.set(-10-Math.random()*12,-6+Math.random()*12,-2+Math.random()*5);s.rotation.y=-.12+Math.random()*.2;
      s.userData.delay=Math.random()*.24;s.userData.speed=.75+Math.random()*.7;s.userData.phase=Math.random()*Math.PI*2;scene.add(s);actors.push(s);
    }
    loop();return true;
  }catch(err){console.warn('3D sheep incident unavailable',err);clear();return false;}
}
function startTank(){
  try{setup();active='tank';duration=7800;started=performance.now();camera.position.set(0,-2.1,20);
    const tank=tankModel();tank.scale.setScalar(1.15);tank.position.set(-9,-5.2,1.4);tank.rotation.y=-.1;scene.add(tank);actors.push(tank);loop();return true;
  }catch(err){console.warn('3D tank incident unavailable',err);clear();return false;}
}
function stop(kind){if(!kind||active===kind)clear();}
function tankShot(tank){
  const firing=!!state.tank&&state.tank.flashUntil>performance.now();
  tank.userData.muzzle.visible=firing;tank.userData.lamp.intensity=firing?34:0;
  if(firing)tank.userData.turret.rotation.z=Math.sin(performance.now()*.03)*.018;
  else tank.userData.turret.rotation.z=0;
}
function loop(now=performance.now()){
  if(!active||!renderer||!scene)return;
  resizeRenderer();
  if(state.paused){
    if(!pausedAt)pausedAt=now;
    renderer.render(scene,camera);raf=requestAnimationFrame(loop);return;
  }
  if(pausedAt){started+=now-pausedAt;pausedAt=0;}
  const elapsed=now-started,p=Math.min(1,elapsed/duration);
  if(active==='sheep'){
    actors.forEach((s,i)=>{const q=Math.max(0,(p-s.userData.delay)/(1-s.userData.delay));s.position.x=-10+q*22*s.userData.speed;s.position.y+=Math.sin(now*.008+s.userData.phase)*.008;s.rotation.z=Math.sin(now*.012+s.userData.phase)*.1;const legs=s.userData.legs||[];legs.forEach((leg,j)=>leg.rotation.z=Math.sin(now*.018+s.userData.phase+j*Math.PI)*.32);});
    camera.position.x=Math.sin(now*.004)*.22;
  }else if(active==='tank'){
    const t=actors[0];if(t){t.position.x=-9+p*18;t.position.y=-5.2+Math.sin(p*Math.PI)*.2;t.userData.turret.rotation.y=Math.sin(now*.0016)*.25;tankShot(t);camera.position.x=Math.sin(now*.02)*.05;}
  }
  renderer.render(scene,camera);if(p<1)raf=requestAnimationFrame(loop);else clear();
}

window.Incident3D={startSheep,startTank,stop};
