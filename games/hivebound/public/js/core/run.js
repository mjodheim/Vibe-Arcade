// Run progression: the thing that turns a series of glades into an adventure.
// It owns the run state, generates the next glade, and turns simulation events
// into the offers the interface has to resolve (talent, relic, craft, pact…).
//
// The interface never mutates the run directly: it calls `resolve()` with a
// choice. That keeps a whole run playable headlessly in the tests.

import { RNG } from './rng.js';
import { generateGlade, nodeChoices, STEPS_PER_REGION, NODE_TYPES } from './world.js';
import { Sim } from './sim.js';
import {
  createRunState, computeStats, abilityInfo, makeRelic, addRelic, applyTalent, talentChoices,
  allTalentsMaxed, applyOverflow, craftOptions, applyCraft, eventOptions, applyEvent,
  pactOptions, applyPact, refreshMultiplier
} from './rules.js';

export class Run {
  constructor({ classId, seed, runId, daily = false }) {
    this.seed = seed >>> 0;
    this.runId = runId;
    this.daily = daily;
    this.state = createRunState(classId);
    this.rng = new RNG(this.seed);
    this.sim = new Sim(this.state);
    this.queue = [];
    this.events = [];
    this.finished = false;
    this.glade = null;
    this.nextNodeType = 'combat';
  }

  get pending() {
    return this.queue[0] || null;
  }

  emit(type, data = {}) {
    // `type` last, for the same reason as in the simulation: payloads such as
    // `{ type: 'combat' }` must not rename the event.
    this.events.push({ ...data, type });
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  gladeSeed(region, step) {
    return (this.seed ^ Math.imul(region * 97 + step * 31 + 7, 0x9e3779b9)) >>> 0;
  }

  start() {
    this.enterNode('combat');
    return this.glade;
  }

  enterNode(nodeType) {
    const { region, step } = this.state;
    const rng = new RNG(this.gladeSeed(region, step));
    const isBoss = nodeType === 'boss';
    const upcoming = isBoss
      ? [{ ...NODE_TYPES.combat, title: 'Deeper Bloom', desc: 'Leave this region behind. The next one is worse.', risk: 'REGION · new biome', icon: '❂' }]
      : nodeChoices(rng, step + 1);

    this.glade = generateGlade({
      seed: this.gladeSeed(region, step),
      region,
      step,
      nodeType,
      nextChoices: upcoming
    });

    this.sim.enterGlade(this.glade, this.rng);
    this.sim.travelling = false;

    if (nodeType === 'combat' || nodeType === 'elite') this.sim.startEncounter(nodeType);
    if (nodeType === 'boss') this.sim.startEncounter('boss');

    this.emit('gladeEnter', { glade: this.glade, node: this.glade.node, region, step });
  }

  step(dt, input) {
    if (this.finished) return;
    this.sim.paused = Boolean(this.pending);
    this.sim.step(dt, input);
    for (const event of this.sim.drainEvents()) this.handle(event);
  }

  interact() {
    if (this.pending || this.finished) return;
    this.sim.interact();
    for (const event of this.sim.drainEvents()) this.handle(event);
  }

  handle(event) {
    switch (event.type) {
      case 'kill':
        this.gainXp(event.xp);
        this.emit('kill', event);
        break;
      case 'nodeCleared':
        this.offer({
          kind: 'loot',
          title: 'Choose a Relic',
          subtitle: 'Relics carry sigils. Matching sigils awaken Resonances.',
          options: this.rollRelics(event.node === 'combat' ? 2 : 3)
        });
        break;
      case 'poiActivated':
        this.activatePoi(event.node);
        break;
      case 'secretFound':
        this.offer({
          kind: 'loot',
          title: 'A Hidden Comb',
          subtitle: 'Nobody was meant to find this one.',
          options: this.rollRelics(2)
        });
        break;
      case 'travel':
        this.travel(event.gate);
        break;
      case 'death':
        this.finished = true;
        this.emit('end', { result: this.result() });
        break;
      default:
        this.emit(event.type, event);
    }
  }

  activatePoi(nodeType) {
    if (nodeType === 'treasure') {
      this.offer({
        kind: 'loot',
        title: 'Choose a Relic',
        subtitle: 'Relics carry sigils. Matching sigils awaken Resonances.',
        options: this.rollRelics(3)
      });
    }
    if (nodeType === 'shrine') {
      this.offer({ kind: 'craft', title: 'Wax Shrine', subtitle: 'Shape what you carried.', options: craftOptions(this.state) });
    }
    if (nodeType === 'event') {
      this.offer({
        kind: 'event',
        title: 'The Petal Whispers',
        subtitle: 'There is no free power in the broken Bloom.',
        options: eventOptions()
      });
    }
  }

  rollRelics(count) {
    return Array.from({ length: count }, () => makeRelic(this.rng));
  }

  offer(offer) {
    this.queue.push(offer);
    this.sim.paused = true;
    this.emit('offer', { offer });
  }

  resolve(choice) {
    const offer = this.queue.shift();
    if (!offer) return;

    if (offer.kind === 'loot' && choice) {
      addRelic(this.state, choice);
      this.emit('toast', { message: `${choice.rarity}: ${choice.name}` });
    }
    if (offer.kind === 'talent' && choice) {
      const rank = applyTalent(this.state, choice);
      this.emit('toast', { message: `${choice.name} · rank ${rank}` });
    }
    if (offer.kind === 'craft' && choice) applyCraft(this.state, choice);
    if (offer.kind === 'event' && choice) {
      const gained = applyEvent(this.state, choice, this.rng);
      if (gained) this.emit('toast', { message: `${gained.name} · rank ${this.state.talents[gained.id]}` });
    }
    if (offer.kind === 'pact' && choice) {
      applyPact(this.state, choice);
      this.emit('toast', { message: choice.name });
    }

    // A level-up can land in the same frame as a cleared node; offers stack and
    // resolve one at a time instead of overwriting each other.
    if (!this.pending) {
      this.sim.paused = false;
      if (this.pendingRegionAdvance) {
        this.pendingRegionAdvance = false;
        this.advanceRegion();
      }
    }
    this.emit('resolved', { kind: offer.kind });
  }

  gainXp(amount) {
    const state = this.state;
    state.xp += amount;
    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = Math.floor(state.xpNext * 1.3 + 10);
      this.offerTalent();
    }
  }

  offerTalent() {
    if (allTalentsMaxed(this.state)) {
      const rank = applyOverflow(this.state);
      this.emit('toast', { message: `Overflow ${rank}: +4% damage · +4 vitality` });
      return;
    }
    this.offer({
      kind: 'talent',
      title: 'Choose a Talent',
      subtitle: 'The Hive changes with every decision.',
      options: talentChoices(this.state, this.rng)
    });
  }

  travel(gate) {
    const state = this.state;
    const wasBoss = this.glade.node.type === 'boss';

    if (wasBoss) {
      state.bosses += 1;
      state.score += Math.floor(1000 * state.region * state.multiplier);
      state.gloam += 8;
      refreshMultiplier(state);
      this.pendingRegionAdvance = true;
      this.offer({
        kind: 'pact',
        title: 'The Gloam Offers a Pact',
        subtitle: 'The run may continue forever. The price rises with you.',
        options: pactOptions()
      });
      return;
    }

    state.step += 1;
    state.gloam += 2;
    refreshMultiplier(state);
    this.nextNodeType = state.step >= STEPS_PER_REGION ? 'boss' : gate.type;
    this.enterNode(this.nextNodeType);
  }

  advanceRegion() {
    const state = this.state;
    state.region += 1;
    state.step = 0;
    this.emit('regionUp', { region: state.region });
    this.enterNode('combat');
  }

  snapshot() {
    const state = this.state;
    return {
      ...state,
      stats: computeStats(state),
      ability: abilityInfo(state),
      abilityCd: this.sim.player.abilityCd,
      dashCd: this.sim.player.dashCd,
      biome: this.glade?.biome,
      node: this.glade?.node,
      sim: this.sim.snapshot(),
      gates: this.glade?.gates || []
    };
  }

  result() {
    const state = this.state;
    return {
      score: Math.floor(state.score),
      classId: state.classId,
      region: state.region,
      durationMs: Date.now() - state.startedAt,
      kills: state.kills,
      elites: state.elites,
      bosses: state.bosses,
      level: state.level,
      gloam: state.gloam,
      secrets: state.secrets,
      runId: this.runId,
      daily: this.daily
    };
  }
}
