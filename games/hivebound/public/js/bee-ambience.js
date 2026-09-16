import * as THREE from '/stack-panic/vendor/three.module.min.js';

const host=document.createElement('canvas');
host.id='beeAmbience';host.setAttribute('aria-hidden','true');document.body.appendChild(host);

const renderer=new THREE.WebGLRenderer({canvas:host,alpha:true,antialias:true,powerPreference:'low-power'});
renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,.1,80);camera.position.set(0,0,18);
scene.add(new THREE.HemisphereLight(0xfff2b0,0x14251a,2.2));
const warm=new THREE.PointLight(0xffd05c,14,30,2);warm.position.set(-6,5,8);scene.add(warm);

const honey=new THREE.MeshStandardMaterial({color:0xe6ad32,roughness:.62,metalness:.08,flatShading:true});
const dark=new THREE.MeshStandardMaterial({color:0x2b2110,roughness:.8,flatShading:true});
const wingMat=new THREE.MeshPhysicalMaterial({color:0xe2fff7,transparent:true,opacity:.38,roughness:.08,depthWrite:false,side:THREE.DoubleSide});
const eyeMat=new THREE.MeshBasicMaterial({color:0xffef9d});

function makeBee(scale=1){
  const g=new THREE.Group();
  const thorax=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,1),honey);thorax.scale.set(1.15,.92,.95);g.add(thorax);
  const abdomen=new THREE.Mesh(new THREE.SphereGeometry(.32,10,7),dark);abdomen.position.z=.43;abdomen.scale.set(.85,.78,1.22);g.add(abdomen);
  const band1=new THREE.Mesh(new THREE.TorusGeometry(.24,.045,5,16),honey);band1.rotation.x=Math.PI/2;band1.position.z=.33;g.add(band1);
  const band2=band1.clone();band2.position.z=.56;band2.scale.set(.86,.86,.86);g.add(band2);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.21,10,7),dark);head.position.z=-.4;g.add(head);
  for(const x of [-.11,.11]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,7,5),eyeMat);eye.position.set(x,.07,-.58);g.add(eye)}
  const wings=[];
  for(const x of [-.28,.28]){const wing=new THREE.Mesh(new THREE.SphereGeometry(.28,10,6),wingMat);wing.scale.set(.75,.12,1.35);wing.position.set(x,.2,.02);wing.rotation.z=x<0?-.35:.35;g.add(wing);wings.push(wing)}
  g.userData.wings=wings;g.scale.setScalar(scale);return g;
}

const bees=[];
for(let i=0;i<18;i++){
  const foreground=i<4;
  const b=makeBee(foreground?.9+Math.random()*.45:.35+Math.random()*.42);
  b.userData={...b.userData,phase:Math.random()*Math.PI*2,speed:.14+Math.random()*.22,radius:4+Math.random()*7,lift:(Math.random()-.5)*5,depth:foreground?2+Math.random()*3:-5+Math.random()*8,foreground};
  scene.add(b);bees.push(b);
}

const pollenGeo=new THREE.BufferGeometry();
const pollenCount=90,positions=new Float32Array(pollenCount*3),phase=new Float32Array(pollenCount);
for(let i=0;i<pollenCount;i++){positions[i*3]=(Math.random()-.5)*24;positions[i*3+1]=(Math.random()-.5)*16;positions[i*3+2]=-4+Math.random()*10;phase[i]=Math.random()*Math.PI*2}
pollenGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
const pollen=new THREE.Points(pollenGeo,new THREE.PointsMaterial({color:0xffd96f,size:.055,transparent:true,opacity:.38,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(pollen);

let pointerX=0,pointerY=0,last=performance.now(),raf=0,active=true;
addEventListener('pointermove',e=>{pointerX=(e.clientX/innerWidth-.5);pointerY=(e.clientY/innerHeight-.5)});
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
document.addEventListener('visibilitychange',()=>{active=!document.hidden;if(active){last=performance.now();raf=requestAnimationFrame(frame)}else cancelAnimationFrame(raf)});

function frame(now){
  if(!active)return;const dt=Math.min(.04,(now-last)/1000||.016);last=now;const t=now*.001;
  camera.position.x+=(pointerX*.7-camera.position.x)*dt*1.6;camera.position.y+=(-pointerY*.35-camera.position.y)*dt*1.6;camera.lookAt(0,0,0);
  bees.forEach((b,i)=>{
    const u=t*b.userData.speed+b.userData.phase;
    const r=b.userData.radius;
    b.position.set(Math.cos(u)*r+(b.userData.foreground?Math.sin(u*1.9)*2:0),b.userData.lift+Math.sin(u*1.7+i)*1.7,b.userData.depth+Math.sin(u*.73+i)*1.5);
    const nx=-Math.sin(u),nz=Math.cos(u);b.rotation.y=Math.atan2(nx,nz)+Math.PI;b.rotation.z=Math.sin(u*2.8+i)*.18;
    const flap=Math.sin(now*.038+i)*.72;b.userData.wings[0].rotation.z=-.35-flap;b.userData.wings[1].rotation.z=.35+flap;
  });
  const arr=pollen.geometry.attributes.position;for(let i=0;i<pollenCount;i++){let y=arr.getY(i)+dt*(.18+.12*Math.sin(t+phase[i]));if(y>8)y=-8;arr.setY(i,y);arr.setX(i,arr.getX(i)+Math.sin(t*.55+phase[i])*dt*.025)}arr.needsUpdate=true;
  pollen.rotation.z=Math.sin(t*.1)*.05;renderer.render(scene,camera);raf=requestAnimationFrame(frame);
}
raf=requestAnimationFrame(frame);

addEventListener('beforeunload',()=>{cancelAnimationFrame(raf);renderer.dispose();pollenGeo.dispose();honey.dispose();dark.dispose();wingMat.dispose();eyeMat.dispose()});
