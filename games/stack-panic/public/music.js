'use strict';

// STACK PANIC's soundtrack. There are no audio files anywhere in this repo:
// every drum, bass and lead below is built out of oscillators and noise at
// play time. What changed is that it is now sequenced like music instead of
// beeped like a timer — a look-ahead scheduler places notes on the audio
// clock, so the groove does not drift the way a setTimeout loop does, and
// each incident gets its own composed track in its own genre.
//
// The game talks to this through four calls: start(), stop(), play(name) and
// setEnabled(). Everything else is private.

const Music = (() => {
  const LOOKAHEAD = 0.2;   // seconds of notes scheduled ahead of the clock
  const TICK = 25;         // ms between scheduler wake-ups
  const STEPS = 16;        // sixteenth notes per bar

  let ctx = null;
  let master = null, musicBus = null;
  let timer = null;
  let enabled = true;
  let nextStepTime = 0;
  let step = 0;
  let track = null;
  let trackName = 'nominal';
  let queued = null;       // track waiting for the next bar line

  // ------------------------------------------------------------------ audio

  function context() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // A compressor keeps a wall of detuned saws from clipping, and leaves
    // room for the sound effects to punch through the mix.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 9;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    master = ctx.createGain();
    master.gain.value = 0.9;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(master);
    master.connect(comp).connect(ctx.destination);
    return ctx;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // Semitones above A1 (55 Hz). Every pattern below is written in these.
  function hz(note) { return 55 * Math.pow(2, note / 12); }

  function noiseBuffer(seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // A soft-clip curve: the difference between a synth and a guitar amp.
  let distortionCurve = null;
  function curve() {
    if (distortionCurve) return distortionCurve;
    const n = 1024;
    distortionCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      distortionCurve[i] = Math.tanh(x * 5);
    }
    return distortionCurve;
  }

  // --------------------------------------------------------------- voices

  function env(gain, at, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }

  function kick(at, gain = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.11);
    env(g, at, 0.9 * gain, 0.004, 0.16);
    o.connect(g).connect(musicBus);
    o.start(at); o.stop(at + 0.24);
  }

  function snare(at, gain = 1) {
    const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer(0.2);
    band.type = 'bandpass'; band.frequency.value = 1900; band.Q.value = 0.8;
    env(g, at, 0.5 * gain, 0.002, 0.13);
    src.connect(band).connect(g).connect(musicBus);
    src.start(at); src.stop(at + 0.2);
    // A short tuned body under the noise, so it reads as a drum not a hiss.
    const body = ctx.createOscillator(), bg = ctx.createGain();
    body.type = 'triangle'; body.frequency.setValueAtTime(190, at);
    env(bg, at, 0.25 * gain, 0.002, 0.08);
    body.connect(bg).connect(musicBus);
    body.start(at); body.stop(at + 0.12);
  }

  function hat(at, open = false, gain = 1) {
    const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer(open ? 0.3 : 0.06);
    hp.type = 'highpass'; hp.frequency.value = 7200;
    env(g, at, (open ? 0.16 : 0.2) * gain, 0.001, open ? 0.22 : 0.035);
    src.connect(hp).connect(g).connect(musicBus);
    src.start(at); src.stop(at + (open ? 0.32 : 0.08));
  }

  function crash(at, gain = 1) {
    const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer(1.2);
    hp.type = 'highpass'; hp.frequency.value = 4200;
    env(g, at, 0.3 * gain, 0.005, 1.1);
    src.connect(hp).connect(g).connect(musicBus);
    src.start(at); src.stop(at + 1.3);
  }

  function taiko(at, gain = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(110, at);
    o.frequency.exponentialRampToValueAtTime(58, at + 0.3);
    env(g, at, 0.7 * gain, 0.006, 0.42);
    o.connect(g).connect(musicBus);
    o.start(at); o.stop(at + 0.5);
  }

  function bass(at, note, dur, spec) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = spec.wave || 'sawtooth';
    o.frequency.setValueAtTime(hz(note), at);
    if (spec.slide) o.frequency.exponentialRampToValueAtTime(hz(note + spec.slide), at + dur);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(spec.cutoff || 620, at);
    // A filter sweep is what turns a sawtooth into an acid line.
    if (spec.sweep) lp.frequency.exponentialRampToValueAtTime(Math.max(90, (spec.cutoff || 620) * spec.sweep), at + dur);
    lp.Q.value = spec.q || 6;
    env(g, at, spec.gain || 0.42, 0.006, dur);
    o.connect(lp).connect(g).connect(musicBus);
    o.start(at); o.stop(at + dur + 0.05);
  }

  function lead(at, note, dur, spec) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = spec.wave || 'square';
    o.frequency.setValueAtTime(hz(note), at);
    if (spec.bend) o.frequency.linearRampToValueAtTime(hz(note + spec.bend), at + dur);
    env(g, at, spec.gain || 0.16, spec.attack || 0.008, dur);
    let node = g;
    if (spec.dirty) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = curve();
      g.connect(shaper);
      node = shaper;
    }
    o.connect(g);
    node.connect(musicBus);
    if (spec.vibrato) {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = spec.vibrato;
      depth.gain.value = hz(note) * 0.012;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(at); lfo.stop(at + dur + 0.05);
    }
    o.start(at); o.stop(at + dur + 0.05);
  }

  // Power chord: root + fifth, detuned, through the amp. The doom track lives
  // on this one.
  function riff(at, note, dur, gain = 0.3) {
    for (const [interval, detune] of [[0, -7], [0, 7], [7, 0], [12, 4]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), shaper = ctx.createWaveShaper(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = hz(note + interval);
      o.detune.value = detune;
      shaper.curve = curve();
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      env(g, at, gain * 0.5, 0.004, dur);
      o.connect(shaper).connect(lp).connect(g).connect(musicBus);
      o.start(at); o.stop(at + dur + 0.05);
    }
  }

  function pad(at, notes, dur, spec = {}) {
    notes.forEach((note, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = spec.wave || 'triangle';
      o.frequency.value = hz(note);
      o.detune.value = (i % 2 ? 6 : -6) + (spec.detune || 0);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(spec.gain || 0.09, at + (spec.attack || 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(musicBus);
      o.start(at); o.stop(at + dur + 0.05);
    });
  }

  function stab(at, notes, dur, spec = {}) {
    notes.forEach(note => lead(at, note, dur, { ...spec, gain: (spec.gain || 0.12) }));
  }

  // ---------------------------------------------------------------- tracks
  //
  // Patterns are 16 characters, one per sixteenth note. For drums, any
  // non-dot is a hit ('X' is accented, 'o' is an open hat). For pitched
  // parts, each step is either '.' or an index into `notes`.

  function P(pattern) { return pattern.split(''); }

  const TRACKS = {
    // The default groove: dark, driving synthwave. It should feel like the
    // game is fine, which it is not.
    nominal: {
      bpm: 116, bars: 4,
      kick:  P('X..x..X...x..X..'),
      snare: P('....X.......X...'),
      hat:   P('x.x.x.xox.x.x.xo'),
      bassNotes: [[3, 3, 10, 8], [1, 1, 8, 6], [3, 3, 10, 12], [6, 6, 13, 11]],
      bassPattern: P('0..0..1...2..3..'),
      bassSpec: { wave: 'sawtooth', cutoff: 700, q: 7, gain: 0.4 },
      chords: [[15, 22, 27], [13, 20, 25], [15, 22, 30], [18, 25, 29]],
      leadNotes: [[27, 30, 34, 30], [25, 29, 32, 29], [27, 34, 39, 34], [30, 32, 37, 32]],
      leadPattern: P('0.1.2...3.2.1...'),
      leadSpec: { wave: 'square', gain: 0.1 }
    },

    // Sheep: a polka that has no business being here.
    sheep: {
      bpm: 168, bars: 2,
      kick:  P('X...X...X...X...'),
      snare: P('..x...x...x...x.'),
      hat:   P('..x...x...x...x.'),
      bassNotes: [[8, 15, 8, 15], [10, 17, 10, 17]],
      bassPattern: P('0...1...2...3...'),
      bassSpec: { wave: 'triangle', cutoff: 900, q: 2, gain: 0.45 },
      chords: [[20, 24, 27], [22, 25, 29]],
      chordSpec: { wave: 'sawtooth', gain: 0.05, attack: 0.02 },
      leadNotes: [[32, 34, 36, 34], [34, 36, 37, 36]],
      leadPattern: P('0.1.2.3.2.1.0...'),
      leadSpec: { wave: 'square', gain: 0.11, vibrato: 6 }
    },

    // Water: dub techno. Long chords, a delay you can swim in.
    water: {
      bpm: 124, bars: 4,
      kick:  P('X...X...X...X...'),
      snare: P('................'),
      hat:   P('..o...o...o...o.'),
      bassNotes: [[1, 1, 8, 1], [3, 3, 10, 3], [1, 1, 6, 1], [3, 3, 8, 3]],
      bassPattern: P('0.......1.......'),
      bassSpec: { wave: 'sine', cutoff: 420, q: 3, gain: 0.5 },
      chords: [[13, 20, 25, 28], [15, 22, 27, 30], [13, 18, 25, 28], [15, 20, 27, 32]],
      chordSpec: { wave: 'triangle', gain: 0.1, attack: 0.9 },
      chordLength: 4,
      leadNotes: [[37, 40], [39, 42], [37, 44], [39, 40]],
      leadPattern: P('......0.....1...'),
      leadSpec: { wave: 'sine', gain: 0.08, attack: 0.06, vibrato: 4 }
    },

    // Bomb: military drum and bass. Something is counting down.
    bomb: {
      bpm: 172, bars: 2,
      kick:  P('X.....X...X.....'),
      snare: P('....X.......X..x'),
      hat:   P('x.xxx.x.xxx.x.xx'),
      bassNotes: [[1, 1, 1, 13], [0, 0, 12, 0]],
      bassPattern: P('0.0...1.0...0.1.'),
      bassSpec: { wave: 'square', cutoff: 320, q: 9, gain: 0.5, sweep: 2.2 },
      chords: [[13, 16, 20], [12, 15, 19]],
      chordSpec: { wave: 'sawtooth', gain: 0.05, attack: 0.01 },
      leadNotes: [[37, 36, 37, 43], [36, 35, 36, 42]],
      leadPattern: P('0...1...2...3...'),
      leadSpec: { wave: 'sawtooth', gain: 0.1, dirty: true }
    },

    // Tank: downtuned doom metal, half time, deeply unhelpful.
    tank: {
      bpm: 84, bars: 2,
      kick:  P('X..X....X..X....'),
      snare: P('....X.......X...'),
      hat:   P('x...x...x...x...'),
      riffNotes: [[-2, -2, 3, 1], [-2, 1, -2, -4]],
      riffPattern: P('0..0..1...2...3.'),
      riffGain: 0.34,
      leadNotes: [[22, 25, 22, 20]],
      leadPattern: P('............0...'),
      leadSpec: { wave: 'sawtooth', gain: 0.1, dirty: true, bend: -2 }
    },

    // Blackout: almost nothing. A room tone and a heartbeat.
    blackout: {
      bpm: 68, bars: 4,
      kick:  P('X.............X.'),
      snare: P('................'),
      hat:   P('................'),
      chords: [[8, 15, 20], [8, 15, 20], [6, 13, 18], [6, 13, 18]],
      chordSpec: { wave: 'sine', gain: 0.09, attack: 1.4 },
      chordLength: 4,
      leadNotes: [[44], [43], [41], [39]],
      leadPattern: P('........0.......'),
      leadSpec: { wave: 'sine', gain: 0.05, attack: 0.4 }
    },

    // Glitch: breakcore. The grid is wrong on purpose.
    glitch: {
      bpm: 178, bars: 2,
      kick:  P('X.x..X.x.X..x.X.'),
      snare: P('..X..x..X...x.Xx'),
      hat:   P('xxx.xx.xxx.xxx.x'),
      bassNotes: [[1, 13, 1, 6], [3, 15, 3, 8]],
      bassPattern: P('0.1.2.3.0.2.1.3.'),
      bassSpec: { wave: 'square', cutoff: 900, q: 12, gain: 0.34, sweep: 0.3 },
      leadNotes: [[49, 37, 44, 31], [46, 39, 51, 34]],
      leadPattern: P('0.1..2.3.0..1.2.'),
      leadSpec: { wave: 'sawtooth', gain: 0.09, dirty: true },
      scramble: true
    },

    // Duck: elevator muzak. Nothing is happening. Everything is fine.
    duck: {
      bpm: 96, bars: 4,
      kick:  P('X.......X.......'),
      snare: P('....x.......x...'),
      hat:   P('..x...x...x...x.'),
      bassNotes: [[8, 15, 12, 15], [6, 13, 10, 13], [3, 10, 15, 10], [8, 15, 12, 19]],
      bassPattern: P('0...1...2...3...'),
      bassSpec: { wave: 'sine', cutoff: 800, q: 1, gain: 0.34 },
      chords: [[20, 24, 27, 31], [18, 22, 25, 29], [15, 19, 22, 26], [20, 24, 27, 30]],
      chordSpec: { wave: 'triangle', gain: 0.07, attack: 0.12 },
      chordLength: 2,
      leadNotes: [[36, 39, 43, 39], [34, 37, 41, 37], [31, 34, 38, 34], [36, 39, 43, 46]],
      leadPattern: P('0...1...2.3.....'),
      leadSpec: { wave: 'sine', gain: 0.1, vibrato: 5, attack: 0.05 }
    },

    // Breach: the rave the tunnel deserves.
    miniworld: {
      bpm: 172, bars: 4,
      kick:  P('X...X...X...X...'),
      snare: P('....X.......X...'),
      hat:   P('..x...x...x...xo'),
      bassNotes: [[1, 1, 1, 1], [3, 3, 3, 3], [6, 6, 6, 6], [8, 8, 8, 8]],
      bassPattern: P('0.0.0.0.0.0.0.0.'),
      bassSpec: { wave: 'sawtooth', cutoff: 500, q: 9, gain: 0.42, sweep: 2.6 },
      leadNotes: [[37, 40, 44, 49], [39, 42, 46, 51], [42, 46, 49, 54], [44, 49, 51, 56]],
      leadPattern: P('0123012301230123'),
      leadSpec: { wave: 'square', gain: 0.1 }
    },

    // Meteor: taiko drums and a brass-ish stab. Someone is very angry.
    meteor: {
      bpm: 132, bars: 2,
      taiko: P('X..X..X.X..X..X.'),
      kick:  P('X.......X.......'),
      snare: P('................'),
      hat:   P('................'),
      chords: [[8, 13, 20], [6, 11, 18]],
      chordSpec: { wave: 'sawtooth', gain: 0.09, attack: 0.03 },
      chordLength: 2,
      leadNotes: [[32, 31, 32, 37], [30, 29, 30, 35]],
      leadPattern: P('0...1...2...3...'),
      leadSpec: { wave: 'sawtooth', gain: 0.12, dirty: true }
    },

    // Gravity: everything runs backwards. Rising tones, no floor.
    gravity: {
      bpm: 104, bars: 2,
      kick:  P('........X.......'),
      snare: P('................'),
      hat:   P('.x.x.x.x.x.x.x.x'),
      chords: [[10, 17, 22, 26], [12, 19, 24, 28]],
      chordSpec: { wave: 'triangle', gain: 0.09, attack: 0.8 },
      chordLength: 2,
      leadNotes: [[22, 27, 34, 39], [24, 29, 36, 41]],
      leadPattern: P('0.1.2.3.0.1.2.3.'),
      leadSpec: { wave: 'sine', gain: 0.09, bend: 7, attack: 0.02 }
    },

    // Acid: a 303 line and a four-to-the-floor. Corrosive in every sense.
    acid: {
      bpm: 138, bars: 2,
      kick:  P('X...X...X...X...'),
      snare: P('....x.......x...'),
      hat:   P('..x...x...x...xo'),
      bassNotes: [[1, 1, 13, 4], [1, 8, 1, 6]],
      bassPattern: P('0.02.1.30.02.1.3'),
      bassSpec: { wave: 'sawtooth', cutoff: 1200, q: 14, gain: 0.36, sweep: 0.18, slide: 0 },
      leadNotes: [[25, 28, 32], [24, 27, 31]],
      leadPattern: P('........0.......'),
      leadSpec: { wave: 'square', gain: 0.07 }
    },

    // Wrecking ball: industrial. Metal on metal, on purpose.
    wreck: {
      bpm: 100, bars: 2,
      kick:  P('X.....X.X.....X.'),
      snare: P('....X.......X...'),
      hat:   P('x.x.x.x.x.x.x.x.'),
      riffNotes: [[1, 1, 1, 8], [1, 6, 1, 3]],
      riffPattern: P('0.....1.0.....2.'),
      riffGain: 0.28,
      leadNotes: [[25, 25, 32, 25]],
      leadPattern: P('..0...0...0...0.'),
      leadSpec: { wave: 'square', gain: 0.07, dirty: true }
    },

    // Magnet: one drone, bending. Deeply unpleasant, briefly.
    magnet: {
      bpm: 110, bars: 2,
      kick:  P('X...............'),
      snare: P('................'),
      hat:   P('................'),
      chords: [[1, 2, 13], [1, 3, 13]],
      chordSpec: { wave: 'sawtooth', gain: 0.08, attack: 0.5, detune: 22 },
      chordLength: 2,
      leadNotes: [[25, 26], [26, 25]],
      leadPattern: P('0.......1.......'),
      leadSpec: { wave: 'sine', gain: 0.07, bend: 1, attack: 0.3 }
    },

    // The commercial break: a jingle with far too much confidence.
    ad: {
      bpm: 128, bars: 2,
      kick:  P('X...X...X...X...'),
      snare: P('....X.......X...'),
      hat:   P('x.x.x.x.x.x.x.xo'),
      bassNotes: [[8, 8, 15, 12], [10, 10, 17, 13]],
      bassPattern: P('0...1...2...3...'),
      bassSpec: { wave: 'square', cutoff: 950, q: 2, gain: 0.4 },
      chords: [[20, 24, 27], [22, 26, 29]],
      chordSpec: { wave: 'square', gain: 0.07, attack: 0.02 },
      leadNotes: [[32, 36, 39, 44], [34, 38, 41, 46]],
      leadPattern: P('0.1.2...3...0...'),
      leadSpec: { wave: 'triangle', gain: 0.13, vibrato: 7 }
    },

    // The fake crash. A dead machine hums; it does not play music.
    bsod: {
      bpm: 60, bars: 4,
      kick:  P('................'),
      snare: P('................'),
      hat:   P('................'),
      chords: [[13, 13], [13, 13], [13, 13], [13, 13]],
      chordSpec: { wave: 'sine', gain: 0.05, attack: 1.2 },
      chordLength: 4
    }
  };

  // ------------------------------------------------------------- sequencer

  function stepDuration() { return 60 / track.bpm / 4; }

  function scheduleStep(index, at) {
    const bar = Math.floor(index / STEPS) % track.bars;
    const s = index % STEPS;

    const hitKick = track.kick && track.kick[s];
    if (hitKick && hitKick !== '.') kick(at, hitKick === 'X' ? 1 : 0.6);
    const hitSnare = track.snare && track.snare[s];
    if (hitSnare && hitSnare !== '.') snare(at, hitSnare === 'X' ? 1 : 0.55);
    const hitHat = track.hat && track.hat[s];
    if (hitHat && hitHat !== '.') hat(at, hitHat === 'o', hitHat === 'X' ? 1 : 0.7);
    const hitTaiko = track.taiko && track.taiko[s];
    if (hitTaiko && hitTaiko !== '.') taiko(at, hitTaiko === 'X' ? 1 : 0.6);
    if (s === 0 && bar === 0 && track.bars > 1) crash(at, 0.5);

    const dur = stepDuration();

    if (track.bassPattern) {
      const slot = track.bassPattern[s];
      if (slot !== '.') {
        const row = track.bassNotes[bar % track.bassNotes.length];
        bass(at, row[Number(slot) % row.length], dur * 1.6, track.bassSpec || {});
      }
    }

    if (track.riffPattern) {
      const slot = track.riffPattern[s];
      if (slot !== '.') {
        const row = track.riffNotes[bar % track.riffNotes.length];
        riff(at, row[Number(slot) % row.length], dur * 2.4, track.riffGain || 0.3);
      }
    }

    if (track.chords && s === 0) {
      const chord = track.chords[bar % track.chords.length];
      const length = (track.chordLength || 1) * dur * STEPS;
      if (track.chordSpec && track.chordSpec.attack > 0.3) pad(at, chord, length, track.chordSpec);
      else stab(at, chord, dur * 3, track.chordSpec || {});
    }

    if (track.leadPattern) {
      const slot = track.leadPattern[s];
      if (slot !== '.') {
        const row = track.leadNotes[bar % track.leadNotes.length];
        // The glitch track deliberately picks the wrong note sometimes.
        const pick = track.scramble && Math.random() < 0.25
          ? Math.floor(Math.random() * row.length)
          : Number(slot) % row.length;
        lead(at, row[pick], dur * 1.4, track.leadSpec || {});
      }
    }
  }

  function scheduler() {
    if (!ctx || !track) return;
    while (nextStepTime < ctx.currentTime + LOOKAHEAD) {
      if (enabled) scheduleStep(step, nextStepTime);
      nextStepTime += stepDuration();
      step++;
      // A queued track takes over on the next bar line, so switching never
      // lands in the middle of a beat.
      if (step % STEPS === 0 && queued) {
        track = TRACKS[queued] || TRACKS.nominal;
        trackName = queued;
        queued = null;
        step = 0;
        if (enabled) crash(nextStepTime, 0.55);
      }
    }
    timer = setTimeout(scheduler, TICK);
  }

  return {
    context,
    // The sound effects share this graph so nothing fights for the output.
    bus() { return master; },
    start(name = 'nominal') {
      if (!context()) return;
      resume();
      this.stop();
      track = TRACKS[name] || TRACKS.nominal;
      trackName = name;
      queued = null;
      step = 0;
      nextStepTime = ctx.currentTime + 0.08;
      scheduler();
    },
    stop() {
      clearTimeout(timer);
      timer = null;
      track = null;
    },
    // Queue a track for the next bar. Unknown names fall back to the default
    // groove rather than silence.
    play(name) {
      const next = TRACKS[name] ? name : 'nominal';
      if (!track) { this.start(next); return; }
      if (next === trackName && !queued) return;
      queued = next;
      resume();
    },
    playing() { return trackName; },
    setEnabled(on) {
      enabled = !!on;
      if (enabled) resume();
    },
    has(name) { return Boolean(TRACKS[name]); },
    trackNames() { return Object.keys(TRACKS); }
  };
})();
