# STACK PANIC

> Everything is under control. Probably.

STACK PANIC is Vibe Arcade cabinet #002: a browser falling-block game where short, weighted chaos events temporarily rewrite the rules.

## Current playable slice

- 10×20 falling-block board with seven tetromino-like shapes
- deterministic daily challenge and local high scores
- rotation with simple wall kicks, soft drop, hard drop, ghost piece
- score, lines, levels and a Chaos meter
- responsive desktop/mobile arcade UI
- keyboard and touch controls
- procedural Web Audio soundtrack with per-event themes and SFX
- screen shake, blackout, glitch lines, smoke, particles and event banners
- weighted incident director with cooldowns and level gates
- Vercel route at `/stack-panic/`

## Incidents implemented

### SHEEPOCALYPSE
Sheep cross the board and can shove occupied cells sideways. Hits award a small score bonus.

### LIQUID BLOCKS
Existing cells temporarily behave like loose fluid and fall into holes. The board settles again when the incident ends.

### BOMB DELIVERY
A bomb falls onto the stack, arms itself and explodes. It may clear a local area or maliciously add blocks.

### QUESTIONABLE SUPPORT
A tank crosses the lower playfield and fires into columns, deleting blocks while smoke and screen shake reduce readability.

### POWER SAVING MODE
The board becomes hard to see through a local-light blackout overlay.

### REALITY BUFFERING
Rows are displaced and the screen receives glitch artefacts.

### DUCK INSPECTION
A deliberately low-stakes absurd event. The duck does not currently alter the grid.

### STRUCTURAL BREACH / mini-world
The falling-block game opens into a **Three.js** tunnel sequence. The walls are
not decoration: every wall ring is built from a real row of your board, so a
filled cell becomes a bar reaching in from the wall and the shape of your stack
*is* the shape of the obstacle. A core runs down the middle of the tunnel, so
flying straight ahead is never the answer.

Difficulty still derives from stack height and density — height sets the
distance to the exit, density sets how many bars each ring carries. A ring never
carries more than `COLS - 4` bars, so there is always a way through. Hitting a
bar holds the ship in front of the ring and costs time, never the run.

Success removes 2–4 rows; failure adds garbage. Keyboard uses arrows/WASD,
mobile uses drag steering. If WebGL is unavailable the original flat tunnel
still runs, so the breach can never block a session.

## Code map

- `public/core.js` — board simulation, pieces, scoring, rendering, seeded RNG, high scores
- `public/events.js` — incident director, event mechanics, particles and mini-world
- `public/audio.js` — run lifecycle plus procedural SFX/music themes
- `public/breach.js` — the Three.js breach tunnel (ES module, talks through `window.Breach`)
- `public/vendor/` — vendored three.js build, so the cabinet ships with no npm dependency
- `public/controls.js` — keyboard/touch input and bootstrap
- `public/style.css` — game cabinet/UI
- `../../arcade-stack.css` — cabinet #002 art on the Vibe Arcade homepage

The split is intentionally simple so a rendering pass can replace visuals without touching the simulation.

## Implemented upgrades

- **STRUCTURAL BREACH is now Three.js** — a real tunnel built from your own
  board, with the original contract preserved (height, density, success removes
  rows, failure adds garbage, arrows/WASD and drag steering).
- **Deterministic seeded mode** — every draw in the game now goes through one
  seeded generator, so `DÉFI DU JOUR` deals the same pieces *and* the same
  incidents to everyone. Local high scores are kept for free play and for the
  day's challenge.
- **Fairness rules** — heavy incidents (bomb, tank, glitch, breach) never
  chain, they buy a recovery window before the next one, and none of them fire
  while the well is close to topping out. The breach is the exception on
  purpose: it stays available when the stack is high, because it is the one
  incident that can rescue a run.

## Best next polish pass

1. Replace emoji sheep/tank/duck with authored sprites or lightweight 3D models.
2. Add event-specific transitions: liquid refraction, tank muzzle flashes, CRT desync, water caustics.
3. Expand the event pool with meteor shower, gravity flip, magnet, fake OS crash, corporate training mode and rare legendary incidents.
4. Make soundtrack arrangements richer (bass/drums/layers by stack danger) while keeping the event-theme API.
5. Achievements on top of the high scores already stored.
6. An online leaderboard for the daily challenge, once the arcade has a shared backend.

## Design rule

Chaos should destabilize the player, not arbitrarily delete a good run. Strong incidents should expose an upside, a skill check or a recoverable consequence.
