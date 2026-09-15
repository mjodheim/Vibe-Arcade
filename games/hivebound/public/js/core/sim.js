// The simulation: one glade, everything alive in it, and the rules of a fight.
// No three.js, no DOM, no rAF — it advances by `step(dt, input)` and reports
// what happened through `events`. That keeps the game testable in plain node
// and lets the renderer stay a pure observer.

import { ENEMIES, pickEnemy } from './biomes.js';
import { computeStats, talentRank, resonance, abilityInfo } from './rules.js';
import { PLAY_RADIUS } from './world.js';

const PLAYER_RADIUS = 0.72;
const CONTACT_COOLDOWN = 0.55;
const DASH_SPEED = 26;
const DASH_TIME = 0.2;
const DASH_COOLDOWN = 1.5;
const DASH_IFRAMES = 0.32;
const MAX_ENEMIES = 64;
// Rifts and thrones start their fight on their own; the rest wait for a key.
const INTERACTIVE_POI = new Set(['cache', 'shrine', 'petal']);

function length(x, z) {
  return Math.hypot(x, z) || 1;
}

export class Sim {
  constructor(state) {
    this.state = state;
    this.events = [];
    this.glade = null;
    this.paused = false;
    this.time = 0;
    this.enemies = [];
    this.projectiles = [];
    this.shockwaves = [];
    this.player = {
      x: 0, z: 0, y: 0,
      vx: 0, vz: 0,
      facing: 0,
      radius: PLAYER_RADIUS,
      attackCd: 0,
      abilityCd: 0,
      dashCd: 0,
      dashTime: 0,
      dashX: 0,
      dashZ: 0,
      invuln: 0,
      contactCd: 0,
      shield: 0,
      moving: false
    };
    this.encounter = null;
    this.prompt = null;
  }

  emit(type, data = {}) {
    // `type` last: payloads carry their own `type` field (an encounter type,
    // a node type) and must never overwrite the event name.
    this.events.push({ ...data, type });
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  get stats() {
    return computeStats(this.state);
  }

  enterGlade(glade, rng) {
    this.glade = glade;
    this.rng = rng;
    this.time = 0;
    this.enemies = [];
    this.projectiles = [];
    this.shockwaves = [];
    this.encounter = null;
    this.prompt = null;
    this.cleared = false;
    this.poiUsed = false;

    const start = glade.playerStart;
    this.player.x = start.x;
    this.player.z = start.z;
    this.player.y = glade.heightAt(start.x, start.z);
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.facing = Math.PI;
    this.player.attackCd = 0;
    this.player.dashTime = 0;
    this.player.invuln = 0.8;

    for (let i = 0; i < glade.wanderers; i++) {
      const point = glade.spawnPoints[(i * 5) % glade.spawnPoints.length];
      this.spawnEnemy(pickEnemy(rng, glade.region), point, { wander: true });
    }

    // Nothing to fight here: the way onward is already open.
    if (glade.node.poi !== 'rift' && glade.node.poi !== 'throne') this.unlockGates('peaceful');
  }

  unlockGates(reason) {
    if (this.cleared) return;
    this.cleared = true;
    this.emit('gatesOpen', { reason });
  }

  // ---------------------------------------------------------------- spawning

  enemyScale() {
    const s = this.state;
    return 1 + (s.region - 1) * 0.24 + (s.gloam / 100) * 0.65;
  }

  spawnEnemy(kindId, at, options = {}) {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    const def = ENEMIES[kindId];
    const scale = this.enemyScale() * (options.elite ? 3.2 : 1) * (options.boss ? 1 : 1);
    const hp = def.hp * scale * this.state.enemyHpMult * (options.wander ? 0.7 : 1);
    const enemy = {
      id: `${kindId}-${this.time.toFixed(3)}-${this.enemies.length}-${Math.floor(this.rng.next() * 1e6)}`,
      kind: def.kind,
      def,
      x: at.x,
      z: at.z,
      y: this.glade.heightAt(at.x, at.z),
      vx: 0,
      vz: 0,
      facing: 0,
      radius: def.radius * (options.elite ? 1.3 : 1) * (options.boss ? 1 : 1),
      hp,
      maxHp: hp,
      speed: def.speed * (1 + this.state.gloam / 350) * this.state.enemySpeedMult * (options.elite ? 1.08 : 1),
      damage: def.damage * this.enemyScale() * (options.elite ? 1.4 : 1),
      elite: Boolean(options.elite),
      boss: Boolean(def.boss),
      wander: Boolean(options.wander),
      spawnTime: this.time,
      appear: 0.55,
      shootCd: this.rng.range(0.6, 2.2),
      lungeCd: this.rng.range(1.2, 2.6),
      lunging: 0,
      poison: 0,
      flash: 0,
      phase: 1,
      attackCd: 3.5,
      telegraph: null
    };
    this.enemies.push(enemy);
    this.emit('spawn', { enemy });
    return enemy;
  }

  startEncounter(type) {
    const region = this.state.region;
    const glade = this.glade;
    if (type === 'boss') {
      this.encounter = { type, wave: 0, waves: 1, pending: 0, timer: 0, addTimer: 8 };
      const boss = this.spawnEnemy('guardian', { x: 0, z: -14 }, { boss: true });
      boss.hp *= 1 + (region - 1) * 0.5;
      boss.maxHp = boss.hp;
      this.emit('bossSpawn', { enemy: boss });
    } else {
      const waves = type === 'elite' ? 2 + Math.floor(region / 2) : 2 + Math.ceil(region / 2);
      this.encounter = { type, wave: 0, waves, pending: 0, timer: 0.8, addTimer: Infinity };
    }
    this.emit('encounterStart', { encounter: type, waves: this.encounter.waves });
  }

  nextWave() {
    const enc = this.encounter;
    enc.wave += 1;
    const region = this.state.region;
    const count = (enc.type === 'elite' ? 2 : 3) + region + Math.ceil(enc.wave * 1.5);
    const points = this.rng.shuffle(this.glade.spawnPoints);
    for (let i = 0; i < count; i++) {
      const point = points[i % points.length];
      const jitter = { x: point.x + this.rng.range(-3, 3), z: point.z + this.rng.range(-3, 3) };
      const elite = enc.type === 'elite' ? i === 0 : this.rng.chance(0.04 + region * 0.01);
      this.spawnEnemy(pickEnemy(this.rng, region), jitter, { elite });
    }
    this.emit('wave', { wave: enc.wave, waves: enc.waves });
  }

  // ------------------------------------------------------------------ combat

  nearestEnemy(x = this.player.x, z = this.player.z, maxDistance = Infinity) {
    let best = null;
    let bestDistance = maxDistance * maxDistance;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const d = (enemy.x - x) ** 2 + (enemy.z - z) ** 2;
      if (d < bestDistance) { bestDistance = d; best = enemy; }
    }
    return best;
  }

  projectile(x, z, angle, damage, options = {}) {
    const speed = options.speed || 30;
    this.projectiles.push({
      x, z,
      y: options.y ?? 1.1,
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed,
      speed,
      radius: options.radius || 0.45,
      life: options.life || 2.2,
      damage,
      crit: Boolean(options.crit),
      poison: Boolean(options.poison),
      splash: Boolean(options.splash),
      homing: Boolean(options.homing),
      pierce: options.pierce || 0,
      hostile: Boolean(options.hostile),
      kind: options.kind || 'bolt'
    });
  }

  autoAttack(aimAngle) {
    const player = this.player;
    const stats = this.stats;
    const target = this.nearestEnemy(player.x, player.z, stats.range);
    // Idle auto-fire waits for a target; holding attack always swings or shoots.
    if (!target && aimAngle === null) return false;
    const angle = aimAngle ?? Math.atan2(target.z - player.z, target.x - player.x);

    const crit = this.rng.next() < stats.crit;
    let damage = stats.damage * (crit ? stats.critDamage : 1);

    if (this.state.classId === 'waxguard') {
      let hitAny = false;
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const dx = enemy.x - player.x;
        const dz = enemy.z - player.z;
        if (Math.hypot(dx, dz) > stats.range + enemy.radius) continue;
        // A cleave in front of you, not a magic circle around you.
        let delta = Math.atan2(dz, dx) - angle;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        if (Math.abs(delta) > 1.5) continue;
        this.hitEnemy(enemy, damage, crit);
        hitAny = true;
      }
      this.emit('melee', { x: player.x, z: player.z, angle, range: stats.range, hit: hitAny });
      return true;
    }

    if (this.state.classId === 'thornstrider') {
      const rank = talentRank(this.state, 'distance');
      if (rank && target) {
        const distance = Math.hypot(target.x - player.x, target.z - player.z);
        damage *= 1 + 0.12 * rank * Math.min(1, distance / stats.range);
      }
    }

    const count = this.state.classId === 'thornstrider' ? 1 + talentRank(this.state, 'multishot') : 1;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.1;
      this.projectile(player.x, player.z, angle + spread, damage, {
        speed: stats.projectileSpeed,
        life: stats.range / stats.projectileSpeed + 0.35,
        crit,
        poison: this.state.classId === 'thornstrider' && crit && talentRank(this.state, 'venom') > 0,
        splash: this.state.classId === 'bloomweaver' && talentRank(this.state, 'blast') > 0,
        homing: this.state.classId === 'hymnkeeper',
        kind: this.state.classId
      });
    }

    if (this.state.classId === 'bloomweaver' && talentRank(this.state, 'split') && this.rng.chance(0.16 * talentRank(this.state, 'split'))) {
      for (const offset of [0.3, -0.3]) {
        this.projectile(player.x, player.z, angle + offset, damage * 0.7, {
          speed: stats.projectileSpeed, life: stats.range / stats.projectileSpeed + 0.35, kind: 'bloomweaver'
        });
      }
    }

    if (this.state.classId === 'hymnkeeper' && talentRank(this.state, 'motes') && this.rng.chance(0.14 * talentRank(this.state, 'motes'))) {
      this.projectile(player.x, player.z, this.rng.next() * Math.PI * 2, damage * 0.7, {
        speed: stats.projectileSpeed, life: 2.4, homing: true, kind: 'hymnkeeper'
      });
    }

    this.emit('shoot', { x: player.x, z: player.z, angle });
    return true;
  }

  useAbility(aimAngle) {
    const player = this.player;
    if (player.abilityCd > 0 || this.paused) return false;
    const stats = this.stats;
    const classId = this.state.classId;

    if (classId === 'waxguard') {
      player.shield = 2.7;
      player.invuln = Math.max(player.invuln, 2.7);
      for (const enemy of this.enemies) {
        if (Math.hypot(enemy.x - player.x, enemy.z - player.z) < 11) this.hitEnemy(enemy, stats.damage * 2.4, false);
      }
      this.shockwave(player.x, player.z, 11, 0xffd98a);
    }
    if (classId === 'bloomweaver') {
      for (let i = 0; i < 14; i++) {
        this.projectile(player.x, player.z, (i / 14) * Math.PI * 2, stats.damage * 1.45, {
          speed: 24, pierce: 1, splash: true, life: 1.6, kind: 'bloomweaver'
        });
      }
      this.shockwave(player.x, player.z, 8, 0xc692ef);
    }
    if (classId === 'thornstrider') {
      const angle = aimAngle ?? player.facing;
      player.dashTime = DASH_TIME;
      player.dashX = Math.cos(angle);
      player.dashZ = Math.sin(angle);
      player.invuln = Math.max(player.invuln, DASH_TIME + DASH_IFRAMES);
      for (let i = 0; i < 10; i++) {
        this.projectile(player.x, player.z, (i / 10) * Math.PI * 2, stats.damage * 1.2, {
          speed: 40, poison: true, life: 1.1, kind: 'thornstrider'
        });
      }
    }
    if (classId === 'hymnkeeper') {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + this.state.maxHp * 0.22);
      const motes = 8 + talentRank(this.state, 'choir') * 2;
      for (let i = 0; i < motes; i++) {
        this.projectile(player.x, player.z, (i / motes) * Math.PI * 2, stats.damage * 1.15, {
          speed: 22, homing: true, life: 3.2, kind: 'hymnkeeper'
        });
      }
      this.emit('heal', { amount: this.state.maxHp * 0.22 });
    }

    player.abilityCd = this.abilityCooldown();
    this.emit('ability', { classId, x: player.x, z: player.z });

    if (resonance(this.state, 'Echo', 4)) {
      this.echoTimer = 0.9;
    }
    return true;
  }

  abilityCooldown() {
    return abilityInfo(this.state).cd;
  }

  shockwave(x, z, radius, color) {
    this.shockwaves.push({ x, z, radius, color, life: 0.4, max: 0.4 });
    this.emit('shockwave', { x, z, radius, color });
  }

  hitEnemy(enemy, amount, crit) {
    if (!enemy || enemy.dead) return;
    enemy.hp -= amount;
    enemy.flash = 0.12;
    this.emit('hit', { x: enemy.x, y: enemy.y + enemy.def.height * 0.8, z: enemy.z, amount, crit, boss: enemy.boss });
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  splash(x, z, amount, radius, except) {
    for (const enemy of this.enemies) {
      if (enemy === except || enemy.dead) continue;
      if (Math.hypot(enemy.x - x, enemy.z - z) < radius) this.hitEnemy(enemy, amount, false);
    }
  }

  killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    const state = this.state;
    state.kills += 1;
    if (enemy.elite) state.elites += 1;
    state.score += Math.floor((enemy.boss ? enemy.def.score : enemy.elite ? enemy.def.score * 7 : enemy.def.score) * state.multiplier);

    if (this.state.classId === 'hymnkeeper' && talentRank(state, 'grace') && this.rng.chance(0.04 * talentRank(state, 'grace'))) {
      state.hp = Math.min(state.maxHp, state.hp + 8);
    }
    if (resonance(state, 'Bloom', 4) && this.rng.chance(0.18)) {
      this.splash(enemy.x, enemy.z, this.stats.damage * 0.8, 6, enemy);
    }

    if (this.rng.chance(enemy.elite ? 0.6 : 0.12)) this.dropMaterial('nectar', enemy);
    if (this.rng.chance(enemy.elite ? 0.3 : 0.045)) this.dropMaterial('wax', enemy);
    if (this.rng.chance(enemy.elite ? 0.22 : 0.025)) this.dropMaterial('pollen', enemy);

    this.emit('kill', { enemy, xp: enemy.def.xp * (enemy.elite ? 3 : 1) });
  }

  dropMaterial(kind, enemy) {
    this.glade.pickups.push({
      kind, x: enemy.x + this.rng.range(-1, 1), z: enemy.z + this.rng.range(-1, 1),
      y: this.glade.heightAt(enemy.x, enemy.z), fresh: true
    });
    this.emit('drop', { kind, x: enemy.x, z: enemy.z });
  }

  damagePlayer(amount, source) {
    const player = this.player;
    if (player.invuln > 0 || this.state.hp <= 0) return;
    const stats = this.stats;
    const taken = amount * stats.armour;
    this.state.hp -= taken;
    player.contactCd = CONTACT_COOLDOWN;
    this.emit('playerHit', { amount: taken, source });

    if (resonance(this.state, 'Wax', 4)) this.splash(player.x, player.z, stats.damage * 0.45, 8, null);
    if (this.state.hp <= 0) {
      this.state.hp = 0;
      this.emit('death', {});
    }
  }

  // ------------------------------------------------------------------- step

  step(dt, input = {}) {
    if (!this.glade || this.paused) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;

    const player = this.player;
    const stats = this.stats;
    const glade = this.glade;

    player.attackCd -= dt;
    player.abilityCd -= dt;
    player.dashCd -= dt;
    player.invuln -= dt;
    player.contactCd -= dt;
    player.shield -= dt;

    if (this.echoTimer !== undefined) {
      this.echoTimer -= dt;
      if (this.echoTimer <= 0) {
        this.echoTimer = undefined;
        player.abilityCd = Math.min(player.abilityCd, 1);
        this.emit('toast', { message: 'Echo Resonance: your ability reverberates.' });
      }
    }

    // ---- movement
    let moveX = input.moveX || 0;
    let moveZ = input.moveZ || 0;
    const moveLength = Math.hypot(moveX, moveZ);
    if (moveLength > 1) { moveX /= moveLength; moveZ /= moveLength; }
    player.moving = moveLength > 0.05;

    if (input.dash && player.dashCd <= 0 && player.dashTime <= 0 && (player.moving || true)) {
      const dirX = player.moving ? moveX : Math.cos(player.facing);
      const dirZ = player.moving ? moveZ : Math.sin(player.facing);
      const len = length(dirX, dirZ);
      player.dashX = dirX / len;
      player.dashZ = dirZ / len;
      player.dashTime = DASH_TIME;
      player.dashCd = DASH_COOLDOWN;
      player.invuln = Math.max(player.invuln, DASH_TIME + DASH_IFRAMES);
      this.emit('dash', { x: player.x, z: player.z });
    }

    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.x += player.dashX * DASH_SPEED * dt;
      player.z += player.dashZ * DASH_SPEED * dt;
    } else {
      player.x += moveX * stats.speed * dt;
      player.z += moveZ * stats.speed * dt;
    }

    // Keep the player inside the bowl.
    const radius = Math.hypot(player.x, player.z);
    const limit = PLAY_RADIUS - 1.5;
    if (radius > limit) {
      player.x = (player.x / radius) * limit;
      player.z = (player.z / radius) * limit;
    }
    player.y = glade.heightAt(player.x, player.z);

    const aimAngle = input.aimAngle ?? null;
    if (aimAngle !== null) player.facing = aimAngle;
    else if (player.moving) player.facing = Math.atan2(moveZ, moveX);

    // ---- attacks
    if (player.attackCd <= 0) {
      const fired = this.autoAttack(input.attack ? aimAngle : null);
      if (fired) player.attackCd = stats.attackRate;
      else player.attackCd = 0.1;
    }
    if (input.ability) this.useAbility(aimAngle);

    // ---- enemies
    this.stepEnemies(dt);
    this.stepProjectiles(dt);
    this.stepEncounter(dt);
    this.stepPickups();

    for (const wave of this.shockwaves) wave.life -= dt;
    this.shockwaves = this.shockwaves.filter(w => w.life > 0);
    this.enemies = this.enemies.filter(e => !e.dead);

    this.updatePrompt();
    this.checkGates();
  }

  stepEnemies(dt) {
    const player = this.player;
    const glade = this.glade;

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.appear = Math.max(0, enemy.appear - dt);
      if (enemy.appear > 0) continue;

      if (enemy.poison > 0) {
        enemy.poison -= dt;
        enemy.hp -= this.stats.damage * 0.12 * dt;
        if (enemy.hp <= 0) { this.killEnemy(enemy); continue; }
      }

      const dx = player.x - enemy.x;
      const dz = player.z - enemy.z;
      const distance = Math.hypot(dx, dz) || 1;
      const toPlayerX = dx / distance;
      const toPlayerZ = dz / distance;
      enemy.facing = Math.atan2(toPlayerZ, toPlayerX);

      let speed = enemy.speed;
      let dirX = toPlayerX;
      let dirZ = toPlayerZ;

      if (enemy.wander && distance > 26) {
        // Idle creatures drift instead of beelining across the map.
        speed *= 0.3;
        dirX = Math.cos(this.time * 0.4 + enemy.spawnTime);
        dirZ = Math.sin(this.time * 0.4 + enemy.spawnTime);
      } else if (enemy.def.behaviour === 'kite') {
        enemy.shootCd -= dt;
        const ranged = enemy.def.ranged;
        if (distance < ranged.range * 0.55) { dirX = -toPlayerX; dirZ = -toPlayerZ; speed *= 0.9; }
        else if (distance < ranged.range) { speed *= 0.25; }
        if (enemy.shootCd <= 0 && distance < ranged.range) {
          enemy.shootCd = ranged.cooldown * this.rng.range(0.85, 1.2);
          const angle = Math.atan2(toPlayerZ, toPlayerX);
          this.projectile(enemy.x, enemy.z, angle, ranged.damage * this.enemyScale(), {
            speed: ranged.speed, hostile: true, life: 2.6, radius: 0.5, kind: 'spore', y: enemy.def.height * 0.6
          });
          this.emit('enemyShoot', { x: enemy.x, z: enemy.z });
        }
      } else if (enemy.def.behaviour === 'lunge') {
        enemy.lungeCd -= dt;
        if (enemy.lunging > 0) {
          enemy.lunging -= dt;
          speed *= 3.4;
        } else if (enemy.lungeCd <= 0 && distance < 14) {
          enemy.lunging = 0.45;
          enemy.lungeCd = this.rng.range(2.2, 3.6);
          this.emit('lunge', { x: enemy.x, z: enemy.z });
        }
      } else if (enemy.def.behaviour === 'boss') {
        this.stepBoss(enemy, dt, distance, toPlayerX, toPlayerZ);
        speed = enemy.speed * (enemy.phase === 3 ? 1.5 : enemy.phase === 2 ? 1.2 : 1);
        if (enemy.telegraph) speed *= 0.15;
      }

      // Separation, so a swarm looks like a swarm and not a single blob.
      let pushX = 0;
      let pushZ = 0;
      for (const other of this.enemies) {
        if (other === enemy || other.dead) continue;
        const ox = enemy.x - other.x;
        const oz = enemy.z - other.z;
        const d2 = ox * ox + oz * oz;
        const minDistance = enemy.radius + other.radius;
        if (d2 > 0.0001 && d2 < minDistance * minDistance) {
          const d = Math.sqrt(d2);
          pushX += (ox / d) * (minDistance - d);
          pushZ += (oz / d) * (minDistance - d);
        }
      }

      enemy.x += (dirX * speed + pushX * 2.4) * dt;
      enemy.z += (dirZ * speed + pushZ * 2.4) * dt;

      const enemyRadius = Math.hypot(enemy.x, enemy.z);
      const limit = PLAY_RADIUS - 1;
      if (enemyRadius > limit) {
        enemy.x = (enemy.x / enemyRadius) * limit;
        enemy.z = (enemy.z / enemyRadius) * limit;
      }
      enemy.y = glade.heightAt(enemy.x, enemy.z);

      // Contact damage.
      if (distance < enemy.radius + player.radius + 0.25 && player.contactCd <= 0) {
        this.damagePlayer(enemy.damage, enemy);
        if (this.state.classId === 'waxguard' && talentRank(this.state, 'thorns')) {
          this.hitEnemy(enemy, this.stats.damage * 0.18 * talentRank(this.state, 'thorns'), false);
        }
      }
    }
  }

  stepBoss(boss, dt, distance, toPlayerX, toPlayerZ) {
    const ratio = boss.hp / boss.maxHp;
    const phase = ratio > 0.6 ? 1 : ratio > 0.25 ? 2 : 3;
    if (phase !== boss.phase) {
      boss.phase = phase;
      boss.attackCd = Math.min(boss.attackCd, 1.2);
      this.emit('bossPhase', { phase, enemy: boss });
    }

    if (boss.telegraph) {
      boss.telegraph.time -= dt;
      if (boss.telegraph.time <= 0) {
        const move = boss.telegraph.move;
        boss.telegraph = null;
        this.bossAttack(boss, move, toPlayerX, toPlayerZ);
      }
      return;
    }

    boss.attackCd -= dt;
    if (boss.attackCd <= 0) {
      const moves = phase === 1 ? ['slam', 'volley'] : phase === 2 ? ['slam', 'volley', 'summon'] : ['spiral', 'slam', 'volley'];
      const move = this.rng.pick(moves);
      const windup = move === 'slam' ? 0.9 : 0.6;
      boss.telegraph = { move, time: windup, radius: move === 'slam' ? 13 : 0 };
      boss.attackCd = (phase === 3 ? 2.6 : phase === 2 ? 3.4 : 4.4) + windup;
      this.emit('bossTelegraph', { move, x: boss.x, z: boss.z, radius: boss.telegraph.radius, time: windup });
    }
  }

  bossAttack(boss, move, toPlayerX, toPlayerZ) {
    const scale = this.enemyScale();
    if (move === 'slam') {
      this.shockwave(boss.x, boss.z, 13, 0xff6a7a);
      const distance = Math.hypot(this.player.x - boss.x, this.player.z - boss.z);
      if (distance < 13) this.damagePlayer(boss.damage * 1.3, boss);
      for (let i = 0; i < 8; i++) {
        this.projectile(boss.x, boss.z, (i / 8) * Math.PI * 2, boss.damage * 0.5, {
          speed: 14, hostile: true, life: 1.8, radius: 0.55, kind: 'spore', y: 0.8
        });
      }
    }
    if (move === 'volley') {
      const base = Math.atan2(toPlayerZ, toPlayerX);
      for (let i = -2; i <= 2; i++) {
        this.projectile(boss.x, boss.z, base + i * 0.16, boss.damage * 0.55, {
          speed: 20, hostile: true, life: 2.6, radius: 0.5, kind: 'spore', y: 1.6
        });
      }
    }
    if (move === 'spiral') {
      const offset = this.time * 2;
      for (let i = 0; i < 14; i++) {
        this.projectile(boss.x, boss.z, offset + (i / 14) * Math.PI * 2, boss.damage * 0.45, {
          speed: 16, hostile: true, life: 3, radius: 0.5, kind: 'spore', y: 1.4
        });
      }
    }
    if (move === 'summon') {
      for (let i = 0; i < 3 + this.state.region; i++) {
        const angle = this.rng.next() * Math.PI * 2;
        this.spawnEnemy('mite', { x: boss.x + Math.cos(angle) * 6, z: boss.z + Math.sin(angle) * 6 });
      }
      this.emit('toast', { message: 'The Guardian calls the swarm.' });
    }
    this.emit('bossAttack', { move, x: boss.x, z: boss.z, scale });
  }

  stepProjectiles(dt) {
    const player = this.player;
    for (const shot of this.projectiles) {
      if (shot.dead) continue;
      if (shot.homing && !shot.hostile) {
        const target = this.nearestEnemy(shot.x, shot.z, 24);
        if (target) {
          const angle = Math.atan2(target.z - shot.z, target.x - shot.x);
          shot.vx += (Math.cos(angle) * shot.speed - shot.vx) * Math.min(1, dt * 6);
          shot.vz += (Math.sin(angle) * shot.speed - shot.vz) * Math.min(1, dt * 6);
        }
      }
      shot.x += shot.vx * dt;
      shot.z += shot.vz * dt;
      shot.life -= dt;
      if (shot.life <= 0) { shot.dead = true; continue; }

      if (Math.hypot(shot.x, shot.z) > PLAY_RADIUS + 2) { shot.dead = true; continue; }

      if (shot.hostile) {
        if (Math.hypot(shot.x - player.x, shot.z - player.z) < shot.radius + player.radius) {
          shot.dead = true;
          this.damagePlayer(shot.damage, 'projectile');
          this.emit('impact', { x: shot.x, z: shot.z, hostile: true });
        }
        continue;
      }

      for (const enemy of this.enemies) {
        if (enemy.dead || shot.dead) continue;
        if (Math.hypot(shot.x - enemy.x, shot.z - enemy.z) > enemy.radius + shot.radius) continue;
        this.hitEnemy(enemy, shot.damage, shot.crit);
        if (shot.poison) enemy.poison = 3;
        if (shot.splash) this.splash(shot.x, shot.z, shot.damage * 0.45, 5.5, enemy);
        this.emit('impact', { x: shot.x, z: shot.z, hostile: false });
        shot.pierce -= 1;
        if (shot.pierce < 0) shot.dead = true;
      }
    }
    this.projectiles = this.projectiles.filter(shot => !shot.dead);
  }

  stepEncounter(dt) {
    const enc = this.encounter;
    if (!enc || this.cleared) return;
    const alive = this.enemies.filter(e => !e.dead && !e.wander).length;

    if (enc.type === 'boss') {
      const boss = this.enemies.find(e => e.boss && !e.dead);
      if (!boss && this.time > 1) {
        this.unlockGates('boss');
        this.emit('nodeCleared', { node: 'boss' });
      }
      return;
    }

    enc.timer -= dt;
    if (enc.timer <= 0 && enc.wave < enc.waves && alive <= Math.max(2, enc.wave)) {
      this.nextWave();
      enc.timer = 2.5;
    }
    if (enc.wave >= enc.waves && alive === 0) {
      this.unlockGates('combat');
      this.emit('nodeCleared', { node: enc.type });
    }
  }

  stepPickups() {
    const player = this.player;
    const glade = this.glade;
    for (const pickup of glade.pickups) {
      if (pickup.taken) continue;
      if (Math.hypot(pickup.x - player.x, pickup.z - player.z) > 1.9) continue;
      pickup.taken = true;
      this.state.materials[pickup.kind] = (this.state.materials[pickup.kind] || 0) + 1;
      this.emit('pickup', { kind: pickup.kind, x: pickup.x, z: pickup.z });
    }
  }

  updatePrompt() {
    const player = this.player;
    const glade = this.glade;
    let prompt = null;

    const poiDistance = Math.hypot(glade.poi.x - player.x, glade.poi.z - player.z);
    if (!this.poiUsed && INTERACTIVE_POI.has(glade.poi.kind) && poiDistance < glade.poi.radius + 2.6) {
      prompt = { kind: glade.poi.kind, label: glade.node.title, action: 'poi' };
    }

    if (glade.secret && !glade.secret.taken) {
      const distance = Math.hypot(glade.secret.x - player.x, glade.secret.z - player.z);
      if (distance < glade.secret.radius + 1.6) prompt = { kind: 'relicshard', label: 'Hidden Cache', action: 'secret' };
    }

    this.prompt = prompt;
  }

  interact() {
    if (!this.prompt || this.paused) return null;
    const prompt = this.prompt;
    if (prompt.action === 'secret') {
      this.glade.secret.taken = true;
      this.state.secrets += 1;
      this.state.score += Math.floor(250 * this.state.multiplier);
      this.emit('secretFound', { x: this.glade.secret.x, z: this.glade.secret.z });
      return { action: 'secret' };
    }
    this.poiUsed = true;
    this.prompt = null;
    this.emit('poiActivated', { kind: prompt.kind, node: this.glade.node.type });
    return { action: 'poi', node: this.glade.node.type };
  }

  checkGates() {
    if (!this.cleared || this.travelling) return;
    const player = this.player;
    for (const gate of this.glade.gates) {
      if (Math.hypot(gate.x - player.x, gate.z - player.z) < gate.radius) {
        this.travelling = true;
        this.emit('travel', { gate });
        return;
      }
    }
  }

  snapshot() {
    return {
      time: this.time,
      cleared: this.cleared,
      encounter: this.encounter && {
        type: this.encounter.type,
        wave: this.encounter.wave,
        waves: this.encounter.waves
      },
      boss: (() => {
        const boss = this.enemies.find(e => e.boss && !e.dead);
        return boss ? { hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase, name: boss.def.name } : null;
      })(),
      enemies: this.enemies.length,
      prompt: this.prompt
    };
  }
}
