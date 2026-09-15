// STRUCTURAL BREACH — the tunnel, in actual 3D.
//
// The walls are not decoration: every ring is built from a real row of your
// board, so a tall dense stack becomes a tight cluttered tunnel and a clean
// board becomes a wide open one. The game contract is unchanged and still
// lives in events.js — this module only flies the ship and draws.
//
// Loaded as a module; the classic scripts talk to it through `window.Breach`.

import * as THREE from '/stack-panic/vendor/three.module.min.js';

const RING_SPACING = 6;
const RINGS = 30;
const TUNNEL_RADIUS = 8.0;
const SHIP_LIMIT = 5.4;
const FORWARD_SPEED = 17;
const SPOKE_INNER = 2.4;       // bars reach this close to the core
const HUB_RADIUS = 2.1;        // the core itself: the middle is never safe
const SPOKE_HALF_ANGLE = 0.26; // how wide one blocked sector is, in radians
const MIN_GAPS = 4;            // a ring always leaves this many ways through
const WALL_EVERY = 2;          // only every Nth ring carries bars, so there is
                               // room to line up between two walls
const START_Z = -12;           // clear air before the first ring

const COLORS = ['#000000', '#43efff', '#8f7cff', '#ff5ab7', '#ffd166', '#b9ff66', '#ff7a59', '#62a8ff', '#d17cff', '#ffffff'];

let renderer = null;
let scene = null;
let camera = null;
let ship = null;
let shipGlow = null;
let exitRing = null;
let tunnel = null;
let dust = null;
let walls = [];          // { z, cells:Set, mesh } — collision data per ring
let active = false;
let session = null;

function makeRenderer(canvas) {
  const created = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  created.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  created.outputColorSpace = THREE.SRGBColorSpace;
  created.toneMapping = THREE.ACESFilmicToneMapping;
  created.toneMappingExposure = 1.1;
  return created;
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060e);
  scene.fog = new THREE.Fog(0x04060e, 26, 150);

  camera = new THREE.PerspectiveCamera(74, 0.5, 2.2, 400);

  scene.add(new THREE.HemisphereLight(0x6fd8ff, 0x120a20, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 8, 6);
  scene.add(key);

  // The ship: a small delta with a cyan core, lit from inside.
  ship = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 2.1, 6),
    new THREE.MeshStandardMaterial({ color: 0xff5ab7, emissive: 0x7a1f4d, emissiveIntensity: 0.8, flatShading: true, roughness: 0.35 })
  );
  hull.rotation.x = -Math.PI / 2;
  ship.add(hull);
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.44, 0),
    new THREE.MeshBasicMaterial({ color: 0x43efff })
  );
  core.position.z = 0.5;
  ship.add(core);
  shipGlow = new THREE.PointLight(0x43efff, 14, 26, 2);
  ship.add(shipGlow);
  scene.add(ship);

  // Specks of dust, purely to sell the speed.
  const positions = new Float32Array(360 * 3);
  for (let i = 0; i < 360; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 2] = -Math.random() * RINGS * RING_SPACING;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0x9fe8ff, size: 0.12, transparent: true, opacity: 0.7 }));
  dust.frustumCulled = false;
  scene.add(dust);

  // The core: flying straight down the middle used to be a guaranteed win, so
  // the middle is now the one place you cannot be.
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(HUB_RADIUS - 0.3, HUB_RADIUS - 0.3, RINGS * RING_SPACING + 80, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a1030, emissive: 0xff2d6f, emissiveIntensity: 0.35, roughness: 0.6, flatShading: true, side: THREE.DoubleSide })
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -RINGS * RING_SPACING / 2;
  scene.add(hub);

  exitRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.36, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0x43efff })
  );
  scene.add(exitRing);
}

/**
 * Turn the player's board into tunnel walls.
 * A filled cell becomes a block on the ring; the emptier the row, the wider the
 * gap to fly through. Rows are read from the bottom of the stack upwards, so
 * the deepest part of the well is what you meet first.
 */
function buildTunnel(board, cols, rows, density) {
  tunnel = new THREE.Group();
  walls = [];

  const materials = COLORS.map(color => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.25, roughness: 0.45, flatShading: true
  }));
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x2a5a80, wireframe: true, transparent: true, opacity: 0.4 });
  const spokeLength = TUNNEL_RADIUS - SPOKE_INNER;
  const spokeGeometry = new THREE.BoxGeometry(spokeLength, 1.0, 1.0);
  spokeGeometry.translate(spokeLength / 2, 0, 0); // pivot at the inner end

  for (let index = 0; index < RINGS; index++) {
    const z = START_Z - index * RING_SPACING;
    const row = board[(rows - 1) - (index % rows)] || [];

    const hoop = new THREE.Mesh(new THREE.TorusGeometry(TUNNEL_RADIUS, 0.14, 6, 28), ringMaterial);
    hoop.position.z = z;
    tunnel.add(hoop);

    // A filled cell becomes a bar from the wall towards the axis, so the shape
    // of your stack is literally the shape of the obstacle.
    let columns = [];
    if (index % WALL_EVERY === 0) {
      for (let x = 0; x < cols; x++) if (row[x]) columns.push(x);
    }

    // Never seal a ring completely: the breach is a skill check, not a coin flip.
    const maxBars = Math.max(0, cols - MIN_GAPS);
    if (columns.length > maxBars) {
      const step = columns.length / maxBars;
      columns = Array.from({ length: maxBars }, (_, i) => columns[Math.floor(i * step)]);
    }

    for (const x of columns) {
      const angle = (x / cols) * Math.PI * 2;
      const bar = new THREE.Mesh(spokeGeometry, materials[row[x]] || materials[9]);
      bar.position.set(Math.cos(angle) * SPOKE_INNER, Math.sin(angle) * SPOKE_INNER, z);
      bar.rotation.z = angle;
      tunnel.add(bar);
    }

    walls.push({ z, cols, columns });
  }

  scene.add(tunnel);
}

function clearScene() {
  if (!scene) return;
  scene.traverse(object => {
    if (object.isMesh || object.isPoints) {
      object.geometry?.dispose?.();
      const material = object.material;
      if (Array.isArray(material)) material.forEach(entry => entry.dispose());
      else material?.dispose?.();
    }
  });
  scene = null;
  camera = null;
  tunnel = null;
  walls = [];
}

/**
 * A hit is: crossing a ring while sitting in a blocked sector, or scraping the
 * outer wall. The centre of the tunnel is never safe by default — a bar reaches
 * almost to the axis.
 */
function hitWall(x, y, z) {
  const radius = Math.hypot(x, y);
  if (radius > TUNNEL_RADIUS - 0.9 || radius < HUB_RADIUS) return { z: z, edge: true };
  const angle = Math.atan2(y, x);
  for (const ring of walls) {
    if (Math.abs(ring.z - z) > 1.2) continue;
    for (const column of ring.columns) {
      const barAngle = (column / ring.cols) * Math.PI * 2;
      let delta = angle - barAngle;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      if (Math.abs(delta) < SPOKE_HALF_ANGLE) return ring;
    }
  }
  return null;
}

/** The middle of the biggest clear arc in a ring: where the ship should aim. */
function widestGapAngle(ring) {
  if (!ring || !ring.columns.length) return Math.PI / 2;
  const blocked = new Set(ring.columns);
  let best = { start: 0, length: 0 };
  for (let start = 0; start < ring.cols; start++) {
    if (blocked.has(start)) continue;
    let length = 0;
    while (length < ring.cols && !blocked.has((start + length) % ring.cols)) length++;
    if (length > best.length) best = { start, length };
  }
  const middle = best.start + (best.length - 1) / 2;
  return (middle / ring.cols) * Math.PI * 2;
}

export const Breach = {
  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {number[][]} options.board  the live board, read as tunnel walls
   * @param {number} options.cols
   * @param {number} options.rows
   * @param {number} options.height   stack height, in rows
   * @param {number} options.density  0..1, how full the well is
   * @param {number} options.duration milliseconds before the breach closes
   */
  start({ canvas, board, cols, rows, height, density, duration = 16000 }) {
    if (!renderer) renderer = makeRenderer(canvas);
    clearScene();
    buildScene();
    buildTunnel(board, cols, rows, density);

    // A taller stack means a longer tunnel to cross.
    const distance = -START_Z + (RINGS - 5) * RING_SPACING * (0.5 + Math.min(1, height / rows) * 0.5);
    exitRing.position.set(0, 0, -distance);

    const entryAngle = widestGapAngle(walls[0]);
    const entryRadius = (HUB_RADIUS + TUNNEL_RADIUS) / 2;
    session = {
      x: Math.cos(entryAngle) * entryRadius,
      y: Math.sin(entryAngle) * entryRadius,
      z: 0,
      velocityX: 0, velocityY: 0,
      distance,
      duration,
      elapsed: 0,
      bumps: 0,
      bumpCooldown: 0,
      stun: 0,
      shake: 0,
      done: false,
      success: false
    };
    active = true;
    canvas.hidden = false;
    this.resize(canvas);
    return session;
  },

  resize(canvas) {
    if (!renderer || !camera) return;
    const width = canvas.clientWidth || 360;
    const height = canvas.clientHeight || 720;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  },

  isActive() {
    return active;
  },

  /** What the tunnel was actually built from — used to tune and to test it. */
  diagnose() {
    const walled = walls.filter(ring => ring.columns.length);
    const bars = walled.reduce((sum, ring) => sum + ring.columns.length, 0);
    return {
      rings: walls.length,
      walledRings: walled.length,
      averageBars: walled.length ? Number((bars / walled.length).toFixed(2)) : 0,
      distance: session ? Math.round(session.distance) : 0
    };
  },

  /** The ship's current position, for the HUD and for automated tests. */
  peek() {
    return session ? { x: session.x, y: session.y, z: session.z, bumps: session.bumps } : null;
  },

  /** Where the next ring is open, for the HUD arrow and for automated tests. */
  guide() {
    if (!active || !session) return null;
    const ahead = walls.find(ring => ring.z < session.z - 1.5) || walls[walls.length - 1];
    const angle = widestGapAngle(ahead);
    const radius = (HUB_RADIUS + TUNNEL_RADIUS) / 2;
    return { angle, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: ahead.z };
  },

  /**
   * @param {number} dt seconds
   * @param {object} input { left, right, up, down, boost }
   * @returns {object} progress for the caller to act on
   */
  update(dt, input = {}) {
    if (!active || !session) return null;
    const s = session;
    s.elapsed += dt * 1000;

    const steer = 34;
    s.velocityX += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * steer * dt;
    s.velocityY += ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * steer * dt;
    s.velocityX *= 0.84;
    s.velocityY *= 0.84;
    s.x = Math.max(-SHIP_LIMIT, Math.min(SHIP_LIMIT, s.x + s.velocityX * dt));
    s.y = Math.max(-SHIP_LIMIT, Math.min(SHIP_LIMIT, s.y + s.velocityY * dt));

    s.stun = Math.max(0, s.stun - dt);
    const speed = FORWARD_SPEED * (input.boost ? 1.45 : 1) * (s.stun > 0 ? 0.45 : 1);
    s.z -= speed * dt;

    s.bumpCooldown = Math.max(0, s.bumpCooldown - dt);
    const hit = hitWall(s.x, s.y, s.z);
    if (hit) {
      // A bar is a real wall: it holds the ship in front of the ring until it
      // lines up with a gap. The cost is time, never the run itself.
      if (!hit.edge) s.z = hit.z + 1.35;
      s.velocityX *= -0.35;
      s.velocityY *= -0.35;
      s.stun = 0.25;
      s.shake = 1;
      if (s.bumpCooldown <= 0) {
        s.bumps += 1;
        s.bumpCooldown = 0.4;
        if (typeof window.sfx === 'function') window.sfx('bump');
      }
    }

    s.shake = Math.max(0, s.shake - dt * 4);

    if (-s.z >= s.distance) { s.done = true; s.success = true; }
    else if (s.elapsed >= s.duration) { s.done = true; s.success = false; }

    this.render(dt);
    return {
      done: s.done,
      success: s.success,
      bumps: s.bumps,
      remaining: Math.max(0, s.duration - s.elapsed),
      metresLeft: Math.max(0, Math.round((s.distance + s.z) / 2))
    };
  },

  render(dt) {
    if (!renderer || !scene || !session) return;
    const s = session;

    ship.position.set(s.x, s.y, s.z);
    ship.rotation.z = -s.velocityX * 0.06;
    ship.rotation.x = s.velocityY * 0.04;
    shipGlow.intensity = 12 + Math.sin(s.elapsed / 90) * 3;

    const shake = s.shake * 0.6;
    camera.position.set(
      s.x * 0.62 + (Math.random() - 0.5) * shake,
      s.y * 0.62 + 1.25 + (Math.random() - 0.5) * shake,
      s.z + 11.5
    );
    camera.lookAt(s.x * 0.85, s.y * 0.85 + 0.9, s.z - 16);

    exitRing.rotation.z += dt * 0.8;
    const pulse = 1 + Math.sin(s.elapsed / 140) * 0.06;
    exitRing.scale.set(pulse, pulse, 1);

    if (dust) dust.position.z = Math.floor(s.z / (RINGS * RING_SPACING)) * RINGS * RING_SPACING;

    renderer.render(scene, camera);
  },

  /** Drag steering on touch screens, fed straight into the ship's velocity. */
  steer(dx, dy) {
    if (!active || !session) return;
    session.velocityX += dx;
    session.velocityY += dy;
  },

  stop(canvas) {
    active = false;
    session = null;
    clearScene();
    if (canvas) canvas.hidden = true;
  }
};

window.Breach = Breach;
