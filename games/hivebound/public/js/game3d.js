// The driver: input, camera, frame loop, and the wiring between the pure run
// simulation, the 3D view and the sound. The interface layer (app.js) talks to
// this class and never to the simulation directly.

import { View } from './render/view.js';
import { GladeView } from './render/glade.js';
import { ActorPool, ProjectileView, EffectsView, buildBee } from './render/actors.js';
import { Run } from './core/run.js';
import { CLASSES } from './core/rules.js';
import { Audio } from './audio.js';

export const DEFAULT_CONTROLS = Object.freeze({
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  ability: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE'
});

export class Hivebound {
  constructor(canvas, hooks = {}, controls = {}) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.controls = { ...DEFAULT_CONTROLS, ...controls };
    this.keys = new Set();
    this.pointer = { x: 0, y: 0, ndcX: 0, ndcY: 0, down: false, orbiting: false };
    this.running = false;
    this.paused = false;
    this.elapsed = 0;
    this.audio = new Audio();

    this.view = new View(canvas, localStorage.getItem('hivebound.quality') || 'high');
    this.gladeView = new GladeView(this.view.scene, this.view.quality);
    this.actors = new ActorPool(this.view.scene);
    this.projectiles = new ProjectileView(this.view.scene);
    this.effects = new EffectsView(this.view.scene);

    this.bindInput();
    addEventListener('resize', () => this.view.resize());
    addEventListener('hivebound:language', () => this.gladeView.refreshLabels());
  }

  setControls(controls = {}) {
    this.controls = { ...DEFAULT_CONTROLS, ...controls };
    this.keys.clear();
  }

  setQuality(name) {
    localStorage.setItem('hivebound.quality', name);
    this.view.setQuality(name);
    this.gladeView.quality = name;
  }

  bindInput() {
    addEventListener('keydown', event => {
      if (event.repeat) return;
      this.keys.add(event.code);
      if (!this.running) return;
      if (event.code === this.controls.ability) event.preventDefault();
      if (event.code === this.controls.interact) this.hooks.onInteract?.();
      if (event.code === 'Escape') this.hooks.onEscape?.();
    });
    addEventListener('keyup', event => this.keys.delete(event.code));
    addEventListener('blur', () => this.keys.clear());

    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('pointerdown', event => {
      this.audio.start();
      if (event.button === 0) this.pointer.down = true;
      if (event.button === 2) {
        this.pointer.orbiting = true;
        this.canvas.setPointerCapture(event.pointerId);
      }
    });
    addEventListener('pointerup', event => {
      if (event.button === 0) this.pointer.down = false;
      if (event.button === 2) this.pointer.orbiting = false;
    });
    this.canvas.addEventListener('pointermove', event => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = event.clientX - rect.left;
      this.pointer.y = event.clientY - rect.top;
      this.pointer.ndcX = (this.pointer.x / rect.width) * 2 - 1;
      this.pointer.ndcY = -((this.pointer.y / rect.height) * 2 - 1);
      if (this.pointer.orbiting) this.view.orbit(event.movementX, event.movementY);
    });
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.view.zoom(event.deltaY);
    }, { passive: false });
  }

  isDown(action) {
    return this.keys.has(this.controls[action]);
  }

  newRun(classId, seed, runId, daily = false) {
    if (this.bee) this.stop(); // never leave a previous bee in the scene
    this.run = new Run({ classId, seed, runId, daily });
    this.bee = buildBee(CLASSES[classId]);
    this.bee.scale.setScalar(1.35);
    this.view.scene.add(this.bee);
    this.run.start();
    this.onGladeEnter(this.run.glade);
    this.running = true;
    this.paused = false;
    this.elapsed = 0;
    this.last = performance.now();
    this.audio.start();
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(time => this.loop(time));
    this.hooks.onState?.(this.run.snapshot());
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    if (this.bee) this.view.scene.remove(this.bee);
    this.gladeView.clear();
  }

  onGladeEnter(glade) {
    this.view.applyBiome(glade.biome);
    this.actors.setBiome(glade.biome);
    this.gladeView.build(glade);
    this.gladeView.setGatesOpen(this.run.sim.cleared);
    this.audio.setBiome(glade.biome);
    this.view.cameraYaw = Math.PI / 2;
    this.hooks.onGlade?.({ glade, snapshot: this.run.snapshot() });
  }

  input() {
    const player = this.run.sim.player;
    const yaw = this.view.cameraYaw;
    const forwardX = -Math.cos(yaw);
    const forwardZ = -Math.sin(yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    let moveX = 0;
    let moveZ = 0;
    if (this.isDown('up')) { moveX += forwardX; moveZ += forwardZ; }
    if (this.isDown('down')) { moveX -= forwardX; moveZ -= forwardZ; }
    if (this.isDown('right')) { moveX += rightX; moveZ += rightZ; }
    if (this.isDown('left')) { moveX -= rightX; moveZ -= rightZ; }

    const ground = this.view.pointerToGround(this.pointer.ndcX, this.pointer.ndcY, player.y + 1);
    let aimAngle = null;
    if (ground) {
      const dx = ground.x - player.x;
      const dz = ground.z - player.z;
      if (Math.hypot(dx, dz) > 0.6) aimAngle = Math.atan2(dz, dx);
    }
    this.aimPoint = ground;

    return {
      moveX,
      moveZ,
      aimAngle,
      attack: this.pointer.down,
      ability: this.isDown('ability'),
      dash: this.isDown('dash')
    };
  }

  loop(time) {
    if (!this.running) return;
    const dt = Math.min(0.05, (time - this.last) / 1000 || 0);
    this.last = time;
    this.frame = requestAnimationFrame(next => this.loop(next));

    if (!this.paused && !this.run.pending) {
      this.elapsed += dt;
      this.run.step(dt, this.input());
      this.processEvents();
    }

    this.updateScene(dt);
    this.view.render();
    this.hudTimer = (this.hudTimer || 0) + dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.hooks.onState?.(this.run.snapshot());
    }
    this.hooks.onFrame?.(this.frameInfo());
  }

  frameInfo() {
    const sim = this.run.sim;
    const player = sim.player;
    const info = {
      abilityPct: Math.max(0, Math.min(1, 1 - player.abilityCd / Math.max(0.001, this.run.sim.abilityCooldown()))),
      dashPct: Math.max(0, Math.min(1, 1 - player.dashCd / 1.5)),
      prompt: sim.prompt,
      promptScreen: null,
      cleared: sim.cleared,
      encounter: sim.encounter && { wave: sim.encounter.wave, waves: sim.encounter.waves, type: sim.encounter.type },
      boss: null,
      compass: []
    };

    if (sim.prompt) {
      const poi = sim.prompt.action === 'secret' ? this.run.glade.secret : this.run.glade.poi;
      const height = this.run.glade.heightAt(poi.x, poi.z) + 3.2;
      info.promptScreen = this.view.project(poi.x, height, poi.z);
    }

    const boss = sim.enemies.find(enemy => enemy.boss && !enemy.dead);
    if (boss) info.boss = { hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase, name: boss.def.name };

    // Compass marks: where to go next.
    const yaw = this.view.cameraYaw;
    const marks = [];
    if (!sim.poiUsed && this.run.glade.node.poi !== 'rift' && this.run.glade.node.poi !== 'throne') {
      marks.push({ icon: this.run.glade.node.icon, x: this.run.glade.poi.x, z: this.run.glade.poi.z, kind: 'poi' });
    }
    if (sim.cleared) {
      for (const gate of this.run.glade.gates) marks.push({ icon: gate.icon, x: gate.x, z: gate.z, kind: 'gate' });
    }
    if (this.run.glade.secret && !this.run.glade.secret.taken) {
      const secret = this.run.glade.secret;
      const distance = Math.hypot(secret.x - player.x, secret.z - player.z);
      if (distance < 28) marks.push({ icon: '✦', x: secret.x, z: secret.z, kind: 'secret' });
    }
    for (const mark of marks) {
      const angle = Math.atan2(mark.z - player.z, mark.x - player.x);
      // Angle relative to where the camera is looking, mapped to [-1, 1].
      let relative = angle - (yaw + Math.PI);
      relative = Math.atan2(Math.sin(relative), Math.cos(relative));
      info.compass.push({
        icon: mark.icon,
        kind: mark.kind,
        offset: Math.max(-1, Math.min(1, relative / (Math.PI * 0.75))),
        behind: Math.abs(relative) > Math.PI * 0.75,
        distance: Math.round(Math.hypot(mark.x - player.x, mark.z - player.z))
      });
    }
    return info;
  }

  processEvents() {
    for (const event of this.run.drainEvents()) {
      switch (event.type) {
        case 'gladeEnter':
          this.onGladeEnter(event.glade);
          break;
        case 'gatesOpen':
          this.gladeView.setGatesOpen(true);
          this.audio.gate();
          this.hooks.onToast?.(event.reason === 'boss' ? 'The Guardian falls. The way opens.' : 'The way onward is open.');
          break;
        case 'hit':
          this.effects.burst(event.x, event.y, event.z, event.crit ? 0xffe9a8 : 0xffd36a, event.crit ? 9 : 4, event.crit ? 7 : 4);
          this.audio.hit(event.crit);
          this.hooks.onDamage?.({ ...event, screen: this.view.project(event.x, event.y, event.z) });
          if (event.crit) this.view.addShake(0.12);
          break;
        case 'kill':
          this.audio.kill();
          this.effects.burst(event.enemy.x, event.enemy.y + 0.8, event.enemy.z, this.run.glade.biome.enemyTint, 10, 6);
          break;
        case 'shoot':
          this.audio.shoot(this.run.state.classId);
          break;
        case 'melee':
          this.effects.ring(this.run.sim.player.x, this.run.sim.player.y, this.run.sim.player.z, event.range, 0xffd36a, 0.25);
          this.audio.shoot('waxguard');
          break;
        case 'ability':
          this.audio.ability();
          this.view.addShake(0.35);
          break;
        case 'dash':
          this.audio.dash();
          break;
        case 'shockwave':
          this.effects.ring(event.x, this.run.glade.heightAt(event.x, event.z), event.z, event.radius, event.color, 0.5);
          this.view.addShake(0.3);
          break;
        case 'impact':
          this.effects.burst(event.x, 1.1, event.z, event.hostile ? 0x9ef06a : 0xffe9a8, 3, 3);
          break;
        case 'playerHit':
          this.audio.playerHit();
          this.view.addShake(0.5);
          this.hooks.onPlayerHit?.(event);
          break;
        case 'pickup':
          this.audio.pickup();
          this.effects.burst(event.x, 1.2, event.z, 0xffd36a, 5, 3);
          break;
        case 'secretFound':
          this.effects.ring(event.x, this.run.glade.heightAt(event.x, event.z), event.z, 6, 0xf3c968, 0.8);
          this.hooks.onToast?.('A hidden comb, forgotten by everyone.');
          break;
        case 'bossSpawn':
          this.audio.boss();
          this.view.addShake(0.9);
          this.hooks.onToast?.('The Guardian of the region awakens.');
          break;
        case 'bossTelegraph':
          this.audio.telegraph();
          if (event.radius > 0) this.effects.ring(event.x, this.run.glade.heightAt(event.x, event.z), event.z, event.radius, 0xff6a7a, event.time);
          break;
        case 'bossPhase':
          this.hooks.onToast?.(`The Guardian sheds its shell. Phase ${event.phase}.`);
          this.view.addShake(0.6);
          break;
        case 'wave':
          this.hooks.onToast?.(`Wave ${event.wave} of ${event.waves}`);
          break;
        case 'offer':
          this.hooks.onOffer?.(event.offer);
          if (event.offer.kind === 'talent') this.audio.levelUp();
          break;
        case 'toast':
          this.hooks.onToast?.(event.message);
          break;
        case 'regionUp':
          this.hooks.onToast?.(`Region ${event.region}`);
          break;
        case 'end':
          this.audio.death();
          this.running = false;
          this.hooks.onEnd?.(event.result);
          break;
        default:
          break;
      }
    }
  }

  resolve(choice) {
    this.run.resolve(choice);
    this.processEvents();
    this.last = performance.now();
  }

  interact() {
    if (!this.running) return;
    this.run.interact();
    this.processEvents();
  }

  updateScene(dt) {
    const sim = this.run.sim;
    const player = sim.player;
    const glade = this.run.glade;

    if (this.bee) {
      const bee = this.bee;
      bee.position.set(player.x, player.y + 1.25 + Math.sin(this.elapsed * 6) * 0.09, player.z);
      const targetYaw = -player.facing + Math.PI / 2;
      bee.rotation.y += Math.atan2(Math.sin(targetYaw - bee.rotation.y), Math.cos(targetYaw - bee.rotation.y)) * Math.min(1, dt * 12);
      bee.rotation.x = player.moving ? 0.22 : 0.04 + Math.sin(this.elapsed * 2) * 0.02;
      bee.rotation.z = Math.sin(this.elapsed * 3) * 0.05;

      const wings = bee.userData.wings;
      const flap = Math.sin(this.elapsed * 46) * 0.7;
      wings.children.forEach(wing => {
        wing.rotation.z = wing.userData.side * (0.35 + flap);
        wing.rotation.x = flap * 0.25;
      });

      bee.userData.shield.visible = player.shield > 0;
      if (player.shield > 0) bee.userData.shield.material.opacity = 0.16 + Math.abs(Math.sin(this.elapsed * 8)) * 0.14;
      bee.userData.aura.material.opacity = player.invuln > 0 ? 0.34 : 0.14;
      bee.visible = !(player.invuln > 0 && player.dashTime > 0 && Math.sin(this.elapsed * 60) < -0.3);

      if (player.dashTime > 0) {
        this.effects.burst(player.x, player.y + 1, player.z, CLASSES[this.run.state.classId].colors.glow, 1, 2);
      }
    }

    this.effects.update(dt);

    this.actors.sync(sim.enemies, this.elapsed, dt);
    this.projectiles.sync(sim.projectiles, glade.biome, dt);
    this.gladeView.syncPickups(glade);
    this.gladeView.update(dt, this.elapsed, player);
    this.view.updateCamera(player, dt);
    this.audio.setIntensity(player.moving, sim.enemies.length);
  }
}
