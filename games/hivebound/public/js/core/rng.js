// Small deterministic RNG. Daily runs share a seed across browsers, so every
// random draw in the game must come from here — never Math.random().
export class RNG {
  constructor(seed) {
    this.s = (seed >>> 0) || 1;
  }

  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }

  // Fisher-Yates. Array.sort with a random comparator is not portable between
  // JS engines, which used to desynchronise daily runs.
  shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  fork(salt = 0) {
    return new RNG((this.s ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0);
  }
}

// Value noise on a seeded lattice: cheap, stable and enough for terrain that
// reads as rolling ground rather than a flat plane.
export function makeNoise2D(seed) {
  const size = 256;
  const mask = size - 1;
  const rng = new RNG(seed);
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();

  const at = (x, y) => lattice[(y & mask) * size + (x & mask)];
  const smooth = t => t * t * (3 - 2 * t);

  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * xf;
    const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * xf;
    return top + (bottom - top) * yf;
  };
}

export function fbm(noise, x, y, octaves = 4) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}
