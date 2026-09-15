export const CLASSES = {
  waxguard:{name:'Waxguard',role:'WARRIOR OF THE HIVE',icon:'🛡️',subtitle:'Close combat · armour · retaliation',description:'Stand inside the swarm. Your wax armour hardens under pressure and your stinger turns pain into momentum.',ability:'Bastion of Wax',abilityDesc:'Become invulnerable briefly and blast nearby enemies.',base:{hp:150,damage:22,speed:190,attackRate:.62,crit:.05,range:84,projectileSpeed:0},traits:['Melee cleave','Highest vitality','Damage taken fuels fury']},
  bloomweaver:{name:'Bloomweaver',role:'POLLEN MAGE',icon:'🔮',subtitle:'Spells · area damage · chain reactions',description:'Shape forbidden pollen into volatile spells. Fragile at first; terrifying once Resonances begin to chain.',ability:'Superbloom',abilityDesc:'Detonate a ring of arcane seeds around you.',base:{hp:92,damage:18,speed:178,attackRate:.48,crit:.09,range:430,projectileSpeed:440},traits:['Long range','Explosive spell synergies','Low vitality']},
  thornstrider:{name:'Thornstrider',role:'RANGER OF THE WILD',icon:'🏹',subtitle:'Speed · critical hits · poison',description:'Never stop moving. Thorn arrows reward distance, tempo and risky routes through the Bloom.',ability:'Briarstep',abilityDesc:'Dash through danger and fire a radial thorn volley.',base:{hp:108,damage:15,speed:225,attackRate:.31,crit:.16,range:520,projectileSpeed:580},traits:['Fastest movement','Rapid ranged attacks','Critical build specialist']},
  hymnkeeper:{name:'Hymnkeeper',role:'ROYAL CANTOR',icon:'✨',subtitle:'Motes · healing · blessings',description:'Carry the old song of the Queen. Sacred motes fight beside you while every blessing can become a weapon.',ability:'Queen’s Chorus',abilityDesc:'Heal and summon a burst of homing royal motes.',base:{hp:118,damage:16,speed:180,attackRate:.55,crit:.07,range:390,projectileSpeed:360},traits:['Self healing','Homing attacks','Scales with blessings']}
};

export const SIGILS = {
  Wax:{icon:'⬡',desc:'2: +18% armour · 4: retaliation nova',color:'#e0b85c'},
  Bloom:{icon:'✿',desc:'2: +18% damage · 4: kills can explode',color:'#b286e8'},
  Thorn:{icon:'✦',desc:'2: +12% speed · 4: +22% crit damage',color:'#83d397'},
  Echo:{icon:'◉',desc:'2: -12% cooldown · 4: abilities echo',color:'#72b8df'},
  Gloam:{icon:'◆',desc:'2: +25% score & enemy power · 4: +60% score',color:'#df647f'}
};

const BIOMES = [
  {name:'Verdant Reach',bg:'#1a2821',accent:'#77b979',enemy:'#a6d58e'},
  {name:'Mycelian Deep',bg:'#23182d',accent:'#b47cce',enemy:'#da98e9'},
  {name:'Ashen Orchard',bg:'#2b1b19',accent:'#d47558',enemy:'#eaa576'},
  {name:'Moonlit Fen',bg:'#131d2a',accent:'#6b9fc7',enemy:'#8bc3dd'},
  {name:'Crownless Garden',bg:'#282114',accent:'#e0b75f',enemy:'#e4c884'}
];

const ITEM_PREFIX = ['Ancient','Royal','Gilded','Hollow','Thornbound','Moonlit','Ashen','Singing','Forbidden','Glass'];
const ITEM_CORE = ['Stinger','Carapace','Petal','Charm','Crown','Vial','Needle','Bell','Lantern','Heart'];
const RARITIES = [
  {name:'Common',w:56,m:1,color:'#c9c4c8'},
  {name:'Rare',w:28,m:1.45,color:'#68aee7'},
  {name:'Epic',w:12,m:2.05,color:'#b47ce6'},
  {name:'Legendary',w:4,m:3.0,color:'#efbd55'}
];

const TALENTS = {
  universal:[
    {id:'ferocity',name:'Feral Memory',desc:'+12% damage.',apply:s=>s.damageMult+=.12,max:5},
    {id:'fleet',name:'Wingbeat',desc:'+8% movement speed.',apply:s=>s.speedMult+=.08,max:4},
    {id:'heart',name:'Royal Jelly Heart',desc:'+20 max vitality and heal 20.',apply:s=>{s.maxHp+=20;s.hp=Math.min(s.maxHp,s.hp+20)},max:4},
    {id:'tempo',name:'Quickened Pulse',desc:'Attack 8% faster.',apply:s=>s.attackRateMult*=.92,max:5},
    {id:'fortune',name:'Golden Instinct',desc:'+5% critical chance.',apply:s=>s.crit+=.05,max:4}
  ],
  waxguard:[
    {id:'rage',name:'Hornet Temper',desc:'Damage rises as vitality falls.',tag:'WAXGUARD',max:3},
    {id:'cleave',name:'Many Against One',desc:'Melee attacks gain +24 range.',tag:'WAXGUARD',max:3},
    {id:'thorns',name:'Hard Wax',desc:'Contact damage hurts attackers.',tag:'WAXGUARD',max:3}
  ],
  bloomweaver:[
    {id:'split',name:'Forked Pollen',desc:'Bolts have a chance to split.',tag:'BLOOMWEAVER',max:3},
    {id:'blast',name:'Unstable Bloom',desc:'Projectile impacts deal splash damage.',tag:'BLOOMWEAVER',max:3},
    {id:'mana',name:'Nectar Current',desc:'Superbloom recharges faster.',tag:'BLOOMWEAVER',max:3}
  ],
  thornstrider:[
    {id:'multishot',name:'Twin Thorn',desc:'Fire additional arrows.',tag:'THORNSTRIDER',max:3},
    {id:'distance',name:'Predator’s Line',desc:'Long shots deal more damage.',tag:'THORNSTRIDER',max:3},
    {id:'venom',name:'Night Venom',desc:'Critical hits poison.',tag:'THORNSTRIDER',max:3}
  ],
  hymnkeeper:[
    {id:'motes',name:'Second Voice',desc:'Attacks may summon an extra royal mote.',tag:'HYMNKEEPER',max:3},
    {id:'grace',name:'Grace Returned',desc:'Kills sometimes restore vitality.',tag:'HYMNKEEPER',max:3},
    {id:'choir',name:'Endless Hymn',desc:'Queen’s Chorus gains more motes.',tag:'HYMNKEEPER',max:3}
  ]
};

class RNG{
  constructor(seed){this.s=(seed>>>0)||1}
  next(){let t=this.s+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
  int(a,b){return Math.floor(this.next()*(b-a+1))+a}
  pick(a){return a[Math.floor(this.next()*a.length)]}
  shuffle(a){return [...a].sort(()=>this.next()-.5)}
}

export const DEFAULT_CONTROLS = Object.freeze({
  up:'KeyW',
  down:'KeyS',
  left:'KeyA',
  right:'KeyD',
  ability:'Space'
});

export class HiveboundGame {
  constructor(canvas,hooks={},controls={}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.hooks=hooks;
    this.controls={...DEFAULT_CONTROLS,...controls};
    this.keys=new Set();this.last=0;this.running=false;this.paused=false;this.anim=0;
    addEventListener('keydown',e=>{
      this.keys.add(e.code);
      if(e.code===this.controls.ability){e.preventDefault();this.useAbility()}
    });
    addEventListener('keyup',e=>this.keys.delete(e.code));
  }
  setControls(controls={}){this.controls={...DEFAULT_CONTROLS,...controls};this.keys.clear()}
  isDown(action){return this.keys.has(this.controls[action])}
  newRun(classId,seed,runId,daily=false){
    this.rng=new RNG(seed);this.seed=seed;this.runId=runId;this.daily=daily;this.classId=classId;this.classDef=CLASSES[classId];
    const b=this.classDef.base;
    this.state={hp:b.hp,maxHp:b.hp,damageMult:1,speedMult:1,attackRateMult:1,crit:b.crit,level:1,xp:0,xpNext:30,score:0,multiplier:1,region:1,step:0,gloam:0,kills:0,elites:0,bosses:0,startedAt:Date.now(),enemyHpMult:1,enemySpeedMult:1,materials:{nectar:0,wax:0,pollen:0},talents:{},relics:[],sigils:{Wax:0,Bloom:0,Thorn:0,Echo:0,Gloam:0}};
    this.combat=null;this.running=false;this.paused=false;this.hooks.onState?.(this.snapshot());
  }
  snapshot(){return{...this.state,classId:this.classId,classDef:this.classDef,biome:this.biome(),stats:this.stats(),ability:this.abilityInfo()}}
  biome(){return BIOMES[(this.state.region-1)%BIOMES.length]}
  talentRank(id){return this.state.talents[id]||0}
  resonance(name,n=2){return (this.state.sigils[name]||0)>=n}
  stats(){
    const b=this.classDef.base,s=this.state; let damage=b.damage*s.damageMult,speed=b.speed*s.speedMult,attackRate=b.attackRate*s.attackRateMult,crit=s.crit,cooldown=1;
    for(const r of s.relics){damage*=1+r.mods.damage;speed*=1+r.mods.speed;attackRate*=1-r.mods.haste;crit+=r.mods.crit}
    if(this.resonance('Bloom')) damage*=1.18;if(this.resonance('Thorn')) speed*=1.12;if(this.resonance('Echo')) cooldown=.88;const critDamage=this.resonance('Thorn',4)?2.13:1.75;
    if(this.classId==='waxguard'&&this.talentRank('rage')) damage*=1+(1-s.hp/s.maxHp)*.18*this.talentRank('rage');
    return{damage,speed,attackRate:Math.max(.12,attackRate),crit:Math.min(.75,crit),critDamage,range:b.range+(this.classId==='waxguard'?24*this.talentRank('cleave'):0),projectileSpeed:b.projectileSpeed,cooldown};
  }
  abilityInfo(){
    const base={waxguard:{cd:11},bloomweaver:{cd:9},thornstrider:{cd:8},hymnkeeper:{cd:12}}[this.classId];
    let cd=base.cd*this.stats().cooldown;
    if(this.classId==='bloomweaver')cd*=1-.1*this.talentRank('mana');
    return{name:this.classDef.ability,desc:this.classDef.abilityDesc,cd};
  }
  pathChoices(){
    if(this.state.step>=4)return[{type:'boss',icon:'♛',title:`Guardian of ${this.biome().name}`,desc:'End the region. The next Bloom will be more corrupted.',risk:'BOSS · huge score'}];
    const pool=[
      {type:'combat',icon:'⚔️',title:'Gloam Swarm',desc:'Survive an escalating swarm and gather materials.',risk:'Normal risk'},
      {type:'elite',icon:'☠️',title:'Marked Predator',desc:'Stronger enemies, richer relics and more score.',risk:'High risk · better loot'},
      {type:'treasure',icon:'🗝️',title:'Forgotten Comb',desc:'Choose a relic from an abandoned royal cache.',risk:'Safe · no combat'},
      {type:'shrine',icon:'⬡',title:'Wax Shrine',desc:'Spend gathered materials to permanently shape this run.',risk:'Crafting'},
      {type:'event',icon:'🌒',title:'Whispering Petal',desc:'A strange choice: power always asks for something back.',risk:'Unknown'}
    ];
    let choices=this.rng.shuffle(pool).slice(0,3);
    if(this.state.step===0&&!choices.some(x=>x.type==='combat'))choices[0]=pool[0];
    return choices;
  }
  choosePath(type){
    if(['combat','elite','boss'].includes(type))this.startCombat(type);
    else if(type==='treasure')this.offerLoot(3,()=>this.finishNode());
    else if(type==='shrine')this.hooks.onCraft?.(this.craftOptions(),opt=>{this.applyCraft(opt);this.finishNode()});
    else if(type==='event')this.hooks.onEvent?.(this.eventOptions(),opt=>{this.applyEvent(opt);this.finishNode()});
  }
  startCombat(type){
    const boss=type==='boss',elite=type==='elite';
    const duration=boss?999:elite?42:34;
    this.combat={type,time:0,duration,enemies:[],projectiles:[],particles:[],spawn:0,player:{x:480,y:300,hitCd:0,attackCd:0,abilityCd:0,shield:0},bossSpawned:false};
    this.running=true;this.paused=false;this.last=performance.now();
    this.hooks.onCombatStart?.({type,biome:this.biome()});
    cancelAnimationFrame(this.anim);this.anim=requestAnimationFrame(t=>this.loop(t));
  }
  loop(t){
    if(!this.running)return;const dt=Math.min(.033,(t-this.last)/1000||0);this.last=t;
    if(!this.paused){this.update(dt);this.render()}
    this.anim=requestAnimationFrame(x=>this.loop(x));
  }
  update(dt){
    const c=this.combat,p=c.player,st=this.stats();c.time+=dt;p.attackCd-=dt;p.abilityCd-=dt;p.hitCd-=dt;p.shield-=dt;
    let dx=0,dy=0;if(this.isDown('up'))dy--;if(this.isDown('down'))dy++;if(this.isDown('left'))dx--;if(this.isDown('right'))dx++;
    if(dx||dy){const l=Math.hypot(dx,dy);p.x+=dx/l*st.speed*dt;p.y+=dy/l*st.speed*dt}p.x=Math.max(25,Math.min(935,p.x));p.y=Math.max(55,Math.min(515,p.y));
    if(c.type==='boss'&&!c.bossSpawned){this.spawnBoss();c.bossSpawned=true}else if(c.type!=='boss'){c.spawn-=dt;if(c.spawn<=0){this.spawnEnemy(c.type==='elite'&&this.rng.next()<.24);c.spawn=Math.max(.18,.78-this.state.region*.035-c.time*.008)}}
    if(p.attackCd<=0){this.autoAttack();p.attackCd=st.attackRate}
    for(const e of c.enemies){
      if(e.dead)continue;const vx=p.x-e.x,vy=p.y-e.y,d=Math.hypot(vx,vy)||1;e.x+=vx/d*e.speed*dt;e.y+=vy/d*e.speed*dt;e.hitCd=(e.hitCd||0)-dt;e.poison=(e.poison||0)-dt;if(e.poison>0){e.hp-=this.stats().damage*.12*dt}
      if(d<e.r+16&&p.hitCd<=0){const dmg=e.damage*(this.resonance('Wax') ? .82 : 1);if(p.shield<=0)this.damagePlayer(dmg);p.hitCd=.55;if(this.classId==='waxguard'&&this.talentRank('thorns'))this.hitEnemy(e,this.stats().damage*.18*this.talentRank('thorns'),false)}
      if(e.hp<=0&&!e.dead)this.killEnemy(e)
    }
    for(const q of c.projectiles){if(q.dead)continue;if(q.homing){const e=this.nearestEnemy(q.x,q.y);if(e){const a=Math.atan2(e.y-q.y,e.x-q.x);q.vx=Math.cos(a)*q.speed;q.vy=Math.sin(a)*q.speed}}q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;if(q.life<=0)q.dead=true;for(const e of c.enemies){if(e.dead||q.dead)continue;if(Math.hypot(q.x-e.x,q.y-e.y)<e.r+q.r){this.hitEnemy(e,q.damage,q.crit);if(q.poison)e.poison=3;if(q.splash)this.splash(q.x,q.y,q.damage*.45,70,e);q.pierce--;if(q.pierce<0)q.dead=true}}}
    c.enemies=c.enemies.filter(e=>!e.dead);c.projectiles=c.projectiles.filter(q=>!q.dead&&q.x>-50&&q.x<1010&&q.y>-50&&q.y<590);
    if(c.type!=='boss'&&c.time>=c.duration)this.winCombat();
    this.hooks.onState?.(this.snapshot());
  }
  spawnEnemy(elite=false){
    const side=this.rng.int(0,3);let x,y;if(side===0){x=this.rng.int(0,960);y=38}else if(side===1){x=940;y=this.rng.int(40,540)}else if(side===2){x=this.rng.int(0,960);y=525}else{x=18;y=this.rng.int(40,540)}
    const scale=1+(this.state.region-1)*.24+this.state.gloam/100*.65;const kinds=[{r:11,hp:28,s:78,d:8},{r:15,hp:48,s:58,d:11},{r:9,hp:22,s:112,d:7}],k=this.rng.pick(kinds);
    this.combat.enemies.push({x,y,r:k.r*(elite?1.35:1),maxHp:k.hp*scale*this.state.enemyHpMult*(elite?3.5:1),hp:k.hp*scale*this.state.enemyHpMult*(elite?3.5:1),speed:k.s*(1+this.state.gloam/350)*this.state.enemySpeedMult*(elite?1.12:1),damage:k.d*scale*(elite?1.45:1),elite,color:elite?'#f0b55c':this.biome().enemy});
  }
  spawnBoss(){
    const scale=1+(this.state.region-1)*.5;this.combat.enemies.push({x:480,y:110,r:37,maxHp:1100*scale*this.state.enemyHpMult,hp:1100*scale*this.state.enemyHpMult,speed:(44+this.state.region*2)*this.state.enemySpeedMult,damage:22*scale,boss:true,elite:true,color:this.biome().accent});
  }
  nearestEnemy(x=this.combat.player.x,y=this.combat.player.y){let best=null,bd=Infinity;for(const e of this.combat.enemies){const d=(e.x-x)**2+(e.y-y)**2;if(d<bd){bd=d;best=e}}return best}
  autoAttack(){
    const c=this.combat,p=c.player,e=this.nearestEnemy();if(!e)return;const st=this.stats();const crit=this.rng.next()<st.crit;const dmg=st.damage*(crit?st.critDamage:1);
    if(this.classId==='waxguard'){for(const target of c.enemies){if(Math.hypot(target.x-p.x,target.y-p.y)<=st.range)this.hitEnemy(target,dmg,crit)}this.particleRing(p.x,p.y,st.range,'#efc661')}
    else{
      const count=this.classId==='thornstrider'?1+this.talentRank('multishot'):1;for(let i=0;i<count;i++){const a=Math.atan2(e.y-p.y,e.x-p.x)+(i-(count-1)/2)*.12;this.projectile(p.x,p.y,a,dmg,{speed:st.projectileSpeed,crit,poison:this.classId==='thornstrider'&&crit&&this.talentRank('venom'),splash:this.classId==='bloomweaver'&&this.talentRank('blast')>0,homing:this.classId==='hymnkeeper'});}
      if(this.classId==='bloomweaver'&&this.talentRank('split')&&this.rng.next()<.16*this.talentRank('split')){this.projectile(p.x,p.y,Math.atan2(e.y-p.y,e.x-p.x)+.3,dmg*.7,{speed:st.projectileSpeed});this.projectile(p.x,p.y,Math.atan2(e.y-p.y,e.x-p.x)-.3,dmg*.7,{speed:st.projectileSpeed})}
      if(this.classId==='hymnkeeper'&&this.talentRank('motes')&&this.rng.next()<.14*this.talentRank('motes'))this.projectile(p.x,p.y,this.rng.next()*Math.PI*2,dmg*.7,{speed:st.projectileSpeed,homing:true});
    }
  }
  projectile(x,y,a,damage,o={}){this.combat.projectiles.push({x,y,vx:Math.cos(a)*(o.speed||400),vy:Math.sin(a)*(o.speed||400),speed:o.speed||400,r:5,life:2.5,damage,crit:o.crit||false,poison:o.poison||false,splash:o.splash||false,homing:o.homing||false,pierce:o.pierce||0,color:o.color||this.biome().accent})}
  useAbility(){if(!this.running||this.paused)return;const c=this.combat,p=c.player;if(p.abilityCd>0)return;const st=this.stats();p.abilityCd=this.abilityInfo().cd;
    if(this.classId==='waxguard'){p.shield=2.7;for(const e of c.enemies)if(Math.hypot(e.x-p.x,e.y-p.y)<160)this.hitEnemy(e,st.damage*2.4,false);this.particleRing(p.x,p.y,160,'#efc661')}
    if(this.classId==='bloomweaver'){for(let i=0;i<14;i++)this.projectile(p.x,p.y,i/14*Math.PI*2,st.damage*1.45,{speed:360,pierce:1,splash:true,color:'#c692ef'})}
    if(this.classId==='thornstrider'){let dx=0,dy=0;if(this.isDown('up'))dy--;if(this.isDown('down'))dy++;if(this.isDown('left'))dx--;if(this.isDown('right'))dx++;if(!dx&&!dy)dy=-1;const l=Math.hypot(dx,dy);p.x=Math.max(25,Math.min(935,p.x+dx/l*120));p.y=Math.max(55,Math.min(515,p.y+dy/l*120));for(let i=0;i<10;i++)this.projectile(p.x,p.y,i/10*Math.PI*2,st.damage*1.2,{speed:600,poison:true})}
    if(this.classId==='hymnkeeper'){this.state.hp=Math.min(this.state.maxHp,this.state.hp+this.state.maxHp*.22);for(let i=0;i<8+this.talentRank('choir')*2;i++)this.projectile(p.x,p.y,i/8*Math.PI*2,st.damage*1.15,{speed:330,homing:true,color:'#f1dc8f'})}
    if(this.resonance('Echo',4))setTimeout(()=>{if(this.running){p.abilityCd=Math.min(p.abilityCd,1);this.toast('Echo Resonance: your ability reverberates.')}},900);
  }
  hitEnemy(e,amount,crit){if(!e||e.dead)return;e.hp-=amount;e.flash=.09;if(crit)this.floatText?.(e.x,e.y,'CRIT');if(e.hp<=0)this.killEnemy(e)}
  splash(x,y,amount,r,except){for(const e of this.combat.enemies)if(e!==except&&Math.hypot(e.x-x,e.y-y)<r)this.hitEnemy(e,amount,false)}
  killEnemy(e){if(e.dead)return;e.dead=true;this.state.kills++;this.state.score+=Math.floor((e.boss?1500:e.elite?180:10)*this.state.multiplier);this.gainXp(e.boss?80:e.elite?24:6);if(e.elite)this.state.elites++;
    if(this.classId==='hymnkeeper'&&this.talentRank('grace')&&this.rng.next()<.04*this.talentRank('grace'))this.state.hp=Math.min(this.state.maxHp,this.state.hp+8);
    if(this.resonance('Bloom',4)&&this.rng.next()<.18)this.splash(e.x,e.y,this.stats().damage*.8,85,e);
    if(this.rng.next()<.12)this.state.materials.nectar++;if(this.rng.next()<.045)this.state.materials.wax++;if(this.rng.next()<.025)this.state.materials.pollen++;
    if(e.boss){this.state.bosses++;this.winCombat(true)}
  }
  damagePlayer(amount){this.state.hp-=amount;if(this.resonance('Wax',4)&&this.combat){const p=this.combat.player;this.splash(p.x,p.y,this.stats().damage*.45,105,null)}if(this.state.hp<=0){this.state.hp=0;this.endRun()}}
  gainXp(n){this.state.xp+=n;if(this.state.xp>=this.state.xpNext){this.state.xp-=this.state.xpNext;this.state.level++;this.state.xpNext=Math.floor(this.state.xpNext*1.3+10);this.pauseForTalent()}}
  pauseForTalent(){this.paused=true;const pool=[...TALENTS.universal,...TALENTS[this.classId]].filter(t=>(this.talentRank(t.id)<(t.max||3)));const options=this.rng.shuffle(pool).slice(0,3);this.hooks.onTalent?.(options,t=>{this.applyTalent(t);this.paused=false;this.last=performance.now()})}
  applyTalent(t){this.state.talents[t.id]=(this.state.talents[t.id]||0)+1;if(t.apply)t.apply(this.state);this.toast(`${t.name} · rank ${this.state.talents[t.id]}`)}
  winCombat(boss=false){if(!this.running)return;this.running=false;cancelAnimationFrame(this.anim);if(boss){this.offerLoot(3,()=>this.finishRegion())}else{this.offerLoot(this.combat.type==='elite'?3:2,()=>this.finishNode())}}
  finishNode(){this.state.step++;this.state.gloam=Math.min(200,this.state.gloam+2);this.state.multiplier=1+this.state.gloam/100+(this.state.sigils.Gloam||0)*.12;this.hooks.onNodeComplete?.(this.snapshot())}
  finishRegion(){this.state.region++;this.state.step=0;this.state.gloam=Math.min(200,this.state.gloam+8);this.state.score+=Math.floor(1000*this.state.region*this.state.multiplier);this.hooks.onPact?.(this.pactOptions(),p=>{this.applyPact(p);this.hooks.onNodeComplete?.(this.snapshot())})}
  endRun(){this.running=false;cancelAnimationFrame(this.anim);this.hooks.onEnd?.(this.result())}
  result(){return{score:Math.floor(this.state.score),classId:this.classId,region:this.state.region,durationMs:Date.now()-this.state.startedAt,kills:this.state.kills,elites:this.state.elites,bosses:this.state.bosses,level:this.state.level,gloam:this.state.gloam,runId:this.runId,daily:this.daily}}
  offerLoot(count,done){this.paused=true;const items=Array.from({length:count},()=>this.makeRelic());this.hooks.onLoot?.(items,item=>{this.addRelic(item);this.paused=false;done()})}
  makeRelic(){
    const roll=this.rng.next()*100;let acc=0,rarity=RARITIES[0];for(const r of RARITIES){acc+=r.w;if(roll<=acc){rarity=r;break}}
    const sigil=this.rng.pick(Object.keys(SIGILS)),m=rarity.m;const type=this.rng.int(0,3);const mods={damage:0,speed:0,haste:0,crit:0};if(type===0)mods.damage=.06*m;if(type===1)mods.speed=.045*m;if(type===2)mods.haste=.04*m;if(type===3)mods.crit=.025*m;
    return{id:crypto.randomUUID(),name:`${this.rng.pick(ITEM_PREFIX)} ${this.rng.pick(ITEM_CORE)}`,rarity:rarity.name,color:rarity.color,sigil,mods,desc:this.describeMods(mods)}
  }
  describeMods(m){const a=[];if(m.damage)a.push(`+${Math.round(m.damage*100)}% damage`);if(m.speed)a.push(`+${Math.round(m.speed*100)}% speed`);if(m.haste)a.push(`+${Math.round(m.haste*100)}% attack speed`);if(m.crit)a.push(`+${Math.round(m.crit*100)}% crit`);return a.join(' · ')}
  addRelic(item){if(this.state.relics.length>=8){const old=this.state.relics.shift();this.state.sigils[old.sigil]--}this.state.relics.push(item);this.state.sigils[item.sigil]++;this.toast(`${item.rarity}: ${item.name}`)}
  craftOptions(){return[
    {id:'temper',name:'Temper the Stinger',desc:'+10% damage for this run.',cost:{nectar:5,wax:1}},
    {id:'harden',name:'Harden the Carapace',desc:'+25 max vitality and heal 25.',cost:{nectar:3,wax:3}},
    {id:'distill',name:'Distill Moon Pollen',desc:'+5% critical chance and +4% movement.',cost:{nectar:4,pollen:2}},
    {id:'leave',name:'Leave the Shrine',desc:'Save your materials.',cost:{}}
  ].map(o=>({...o,affordable:Object.entries(o.cost).every(([k,v])=>this.state.materials[k]>=v)}))}
  applyCraft(o){if(!o||!o.affordable)return;for(const[k,v]of Object.entries(o.cost))this.state.materials[k]-=v;if(o.id==='temper')this.state.damageMult+=.1;if(o.id==='harden'){this.state.maxHp+=25;this.state.hp=Math.min(this.state.maxHp,this.state.hp+25)}if(o.id==='distill'){this.state.crit+=.05;this.state.speedMult+=.04}}
  eventOptions(){return[
    {id:'blood',name:'Drink Black Nectar',desc:'+22% damage, lose 20% current vitality, +8 Gloam.',tag:'POWER / COST'},
    {id:'memory',name:'Hear the Dead Queen',desc:'Gain a random talent, +6 Gloam.',tag:'KNOWLEDGE / RISK'},
    {id:'refuse',name:'Close the Petal',desc:'Nothing happens. Perhaps that is wisdom.',tag:'SAFE'}
  ]}
  applyEvent(o){if(o.id==='blood'){this.state.damageMult+=.22;this.state.hp=Math.max(1,this.state.hp*.8);this.state.gloam+=8}if(o.id==='memory'){const pool=[...TALENTS.universal,...TALENTS[this.classId]].filter(t=>this.talentRank(t.id)<(t.max||3));if(pool.length)this.applyTalent(this.rng.pick(pool));this.state.gloam+=6}this.state.multiplier=1+this.state.gloam/100+(this.state.sigils.Gloam||0)*.12}
  pactOptions(){return[
    {id:'hunger',name:'Pact of Hunger',desc:'Enemies gain 30% vitality. Score multiplier rises sharply.',gloam:20,sigil:'Gloam'},
    {id:'glass',name:'Pact of Glass',desc:'+28% damage, but lose 18 max vitality.',gloam:12,sigil:'Bloom'},
    {id:'flight',name:'Pact of Wings',desc:'+14% speed and attack speed. Enemies move 12% faster.',gloam:10,sigil:'Thorn'}
  ]}
  applyPact(p){if(p.id==='glass'){this.state.damageMult+=.28;this.state.maxHp=Math.max(40,this.state.maxHp-18);this.state.hp=Math.min(this.state.hp,this.state.maxHp)}if(p.id==='flight'){this.state.speedMult+=.14;this.state.attackRateMult*=.86;this.state.enemySpeedMult*=1.12}if(p.id==='hunger')this.state.enemyHpMult*=1.3;this.state.gloam+=p.gloam;this.state.sigils[p.sigil]++;this.state.multiplier=1+this.state.gloam/100+(this.state.sigils.Gloam||0)*.12}
  toast(msg){this.hooks.onToast?.(msg)}
  particleRing(x,y,r,color){this.combat.particles.push({x,y,r,color,life:.25,max:.25})}
  render(){
    const ctx=this.ctx,c=this.combat,b=this.biome();ctx.fillStyle=b.bg;ctx.fillRect(0,0,960,540);
    ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=1;for(let x=0;x<960;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,540);ctx.stroke()}for(let y=0;y<540;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(960,y);ctx.stroke()}
    for(const e of c.enemies){ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle=e.color;ctx.shadowColor=e.color;ctx.shadowBlur=e.boss?18:e.elite?10:3;ctx.beginPath();ctx.arc(0,0,e.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#20151c';ctx.beginPath();ctx.arc(-e.r*.28,-2,e.r*.12,0,Math.PI*2);ctx.arc(e.r*.28,-2,e.r*.12,0,Math.PI*2);ctx.fill();if(e.elite){ctx.strokeStyle='#f0c96b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,e.r+5,0,Math.PI*2);ctx.stroke()}ctx.restore();if(e.boss||e.elite){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(e.x-e.r,e.y-e.r-10,e.r*2,4);ctx.fillStyle=e.color;ctx.fillRect(e.x-e.r,e.y-e.r-10,e.r*2*Math.max(0,e.hp/e.maxHp),4)}}
    for(const q of c.projectiles){ctx.fillStyle=q.color;ctx.shadowColor=q.color;ctx.shadowBlur=9;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
    const p=c.player;ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor=this.classId==='bloomweaver'?'#c692ef':'#efc661';ctx.shadowBlur=12;ctx.fillStyle=p.shield>0?'#fff0a9':'#e4b64e';ctx.beginPath();ctx.ellipse(0,0,15,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2a1f14';ctx.fillRect(-8,-11,4,22);ctx.fillRect(4,-11,4,22);ctx.fillStyle='rgba(230,240,255,.75)';ctx.beginPath();ctx.ellipse(-12,-10,9,5,-.5,0,Math.PI*2);ctx.ellipse(12,-10,9,5,.5,0,Math.PI*2);ctx.fill();if(p.shield>0){ctx.strokeStyle='#ffe59a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,27,0,Math.PI*2);ctx.stroke()}ctx.restore();
    const info=this.abilityInfo();this.hooks.onCombatFrame?.({time:c.time,duration:c.duration,abilityPct:Math.max(0,Math.min(1,1-p.abilityCd/info.cd)),boss:c.type==='boss'});
  }
}
