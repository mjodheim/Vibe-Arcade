// Every sound in Hivebound is synthesised at runtime: no audio files, no
// downloads, and each biome can be tuned like an instrument.

const STORAGE_KEY = 'hivebound.audio.v1';

function noiseBuffer(context, seconds = 2) {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

export class Audio {
  constructor() {
    this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
    this.context = null;
    this.started = false;
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem(STORAGE_KEY, this.enabled ? 'on' : 'off');
    if (this.master) this.master.gain.value = this.enabled ? 0.9 : 0;
    return this.enabled;
  }

  // Browsers only allow audio after a gesture, so this is called on first click.
  start() {
    if (this.started) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    this.started = true;
    this.context = new Context();
    const context = this.context;

    this.master = context.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(context.destination);

    this.musicGain = context.createGain();
    this.musicGain.gain.value = 0.26;
    this.musicGain.connect(this.master);

    this.sfxGain = context.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);

    // Wind bed.
    this.wind = context.createBufferSource();
    this.wind.buffer = noiseBuffer(context, 4);
    this.wind.loop = true;
    this.windFilter = context.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 420;
    this.windGain = context.createGain();
    this.windGain.gain.value = 0.16;
    this.wind.connect(this.windFilter).connect(this.windGain).connect(this.musicGain);
    this.wind.start();

    // Two slow drones: the hive breathing.
    this.drones = [];
    for (const detune of [0, 7]) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      osc.detune.value = detune;
      const gain = context.createGain();
      gain.gain.value = 0.16;
      const lfo = context.createOscillator();
      lfo.frequency.value = 0.08 + detune * 0.01;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      osc.connect(gain).connect(this.musicGain);
      osc.start();
      this.drones.push({ osc, gain });
    }

    // Wingbeat, gated by movement.
    this.wing = context.createOscillator();
    this.wing.type = 'sawtooth';
    this.wing.frequency.value = 190;
    this.wingFilter = context.createBiquadFilter();
    this.wingFilter.type = 'bandpass';
    this.wingFilter.frequency.value = 320;
    this.wingFilter.Q.value = 3;
    this.wingGain = context.createGain();
    this.wingGain.gain.value = 0;
    this.wing.connect(this.wingFilter).connect(this.wingGain).connect(this.master);
    this.wing.start();
  }

  setBiome(biome) {
    if (!this.context) return;
    const root = { verdant: 55, mycelian: 49, ashen: 58, fen: 46, crown: 52 }[biome.id] || 55;
    for (const [index, drone] of this.drones.entries()) {
      drone.osc.frequency.setTargetAtTime(root * (index ? 1.5 : 1), this.context.currentTime, 1.5);
    }
    this.windFilter.frequency.setTargetAtTime(biome.id === 'ashen' ? 700 : 420, this.context.currentTime, 2);
  }

  setIntensity(moving, danger) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.wingGain.gain.setTargetAtTime(moving ? 0.045 : 0.012, now, 0.1);
    this.wing.frequency.setTargetAtTime(moving ? 215 : 175, now, 0.2);
    this.musicGain.gain.setTargetAtTime(0.2 + Math.min(0.35, danger * 0.05), now, 1.2);
  }

  tone({ frequency = 440, to = null, type = 'sine', duration = 0.18, gain = 0.3, delay = 0, sweepType = 'exponential' }) {
    if (!this.context || !this.enabled) return;
    const context = this.context;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (to) {
      if (sweepType === 'exponential') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
      else osc.frequency.linearRampToValueAtTime(to, start + duration);
    }
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(envelope).connect(this.sfxGain);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  noise({ duration = 0.2, gain = 0.3, frequency = 900, type = 'bandpass', sweep = null }) {
    if (!this.context || !this.enabled) return;
    const context = this.context;
    const start = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noiseCache || (this.noiseCache = noiseBuffer(context, 1));
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), start + duration);
    filter.Q.value = 1.4;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope).connect(this.sfxGain);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  shoot(classId) {
    const recipes = {
      waxguard: () => this.noise({ duration: 0.16, gain: 0.26, frequency: 1400, sweep: 350 }),
      bloomweaver: () => this.tone({ frequency: 620, to: 320, type: 'triangle', duration: 0.2, gain: 0.16 }),
      thornstrider: () => this.tone({ frequency: 1250, to: 720, type: 'square', duration: 0.07, gain: 0.09 }),
      hymnkeeper: () => this.tone({ frequency: 880, to: 1320, type: 'sine', duration: 0.24, gain: 0.12 })
    };
    (recipes[classId] || recipes.thornstrider)();
  }

  hit(crit) {
    this.noise({ duration: crit ? 0.22 : 0.12, gain: crit ? 0.34 : 0.2, frequency: crit ? 2200 : 1100, sweep: 260 });
    if (crit) this.tone({ frequency: 1500, to: 400, type: 'square', duration: 0.12, gain: 0.1 });
  }

  kill() {
    this.tone({ frequency: 340, to: 90, type: 'sawtooth', duration: 0.26, gain: 0.14 });
  }

  playerHit() {
    this.tone({ frequency: 180, to: 60, type: 'square', duration: 0.3, gain: 0.3 });
    this.noise({ duration: 0.3, gain: 0.3, frequency: 500, sweep: 120 });
  }

  ability() {
    this.tone({ frequency: 260, to: 940, type: 'triangle', duration: 0.45, gain: 0.26 });
    this.noise({ duration: 0.4, gain: 0.2, frequency: 600, sweep: 2600 });
  }

  dash() {
    this.noise({ duration: 0.22, gain: 0.22, frequency: 2600, sweep: 500 });
  }

  pickup() {
    this.tone({ frequency: 880, duration: 0.09, gain: 0.14, type: 'sine' });
    this.tone({ frequency: 1320, duration: 0.12, gain: 0.12, type: 'sine', delay: 0.07 });
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((frequency, i) => {
      this.tone({ frequency, duration: 0.3, gain: 0.13, type: 'triangle', delay: i * 0.08 });
    });
  }

  gate() {
    this.tone({ frequency: 392, to: 784, type: 'sine', duration: 0.6, gain: 0.2 });
  }

  telegraph() {
    this.tone({ frequency: 120, to: 420, type: 'sawtooth', duration: 0.8, gain: 0.2 });
  }

  boss() {
    this.tone({ frequency: 90, to: 44, type: 'sawtooth', duration: 1.6, gain: 0.34 });
    this.noise({ duration: 1.4, gain: 0.3, frequency: 300, sweep: 60 });
  }

  death() {
    this.tone({ frequency: 300, to: 40, type: 'sine', duration: 2.2, gain: 0.3 });
  }
}
