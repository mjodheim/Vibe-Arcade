# STACK PANIC

> Everything is under control. Probably.

STACK PANIC is Vibe Arcade cabinet #002: a browser falling-block game where short, weighted chaos events temporarily rewrite the rules.

## Current playable slice

- 10×20 falling-block board with seven tetromino-like shapes
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
The falling-block game opens into a short pseudo-3D tunnel sequence. The tunnel difficulty is derived from the real stack height and density. Success removes 2–4 rows from the stack; failure adds garbage rows. Keyboard uses arrows/WASD; mobile uses drag steering.

## Code map

- `public/core.js` — board simulation, pieces, scoring, rendering and main loop
- `public/events.js` — incident director, event mechanics, particles and mini-world
- `public/audio.js` — run lifecycle plus procedural SFX/music themes
- `public/controls.js` — keyboard/touch input and bootstrap
- `public/style.css` — game cabinet/UI
- `../../arcade-stack.css` — cabinet #002 art on the Vibe Arcade homepage

The split is intentionally simple so a rendering pass can replace visuals without touching the simulation.

## Best next polish pass

1. Replace emoji sheep/tank/duck with authored sprites or lightweight 3D models.
2. Upgrade STRUCTURAL BREACH from pseudo-3D Canvas to Three.js while preserving `height`, `density`, success/failure and stack consequences.
3. Add event-specific transitions: liquid refraction, tank muzzle flashes, CRT desync, water caustics.
4. Expand the event pool with meteor shower, gravity flip, magnet, fake OS crash, corporate training mode and rare legendary incidents.
5. Make soundtrack arrangements richer (bass/drums/layers by stack danger) while keeping the event-theme API.
6. Add a deterministic seeded mode plus local high scores/achievements.
7. Add fairness rules so major destructive incidents cannot chain without a recovery window.

## Design rule

Chaos should destabilize the player, not arbitrarily delete a good run. Strong incidents should expose an upside, a skill check or a recoverable consequence.
