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

### PLUIE DE MÉTÉORES ☄️
Three to six rocks arrive on a diagonal, each carving a Manhattan-radius-2
crater wherever it lands. Good for your height, terrible for your structure.

### PERMIS DE DÉMOLIR 🏗️
A wrecking ball swings in at the top of the stack and erases every cell in a
three-row band as it crosses. The single most destructive incident in the game,
and the only one that leaves a clean horizontal cut.

### AIMANT INDUSTRIEL 🧲
Every row slides to one wall, one step at a time. Nothing is deleted; your
carefully terraced stack simply becomes a slab, and whatever was holding an
overhang up is now somewhere else.

### PLUIE ACIDE 🧪
Cells dissolve from the bottom up — the lower the row, the likelier it goes.
It lowers your stack and undermines it at the same time.

### GRAVITÉ RÉSILIÉE 🙃
The stack detaches from the floor and floats two to four rows up. Pieces then
fall into the gap underneath it. When the incident ends everything comes down
at once, which is either the save of your run or the end of it. The lift is
capped so the mass can never be pushed into the ceiling.

### ERREUR FATALE 💀
A convincing crash screen covers the cabinet for four seconds. The run does not
stop behind it. That is the joke, and the danger.

### PAUSE SPONSORISÉE 📺
A commercial break, in the middle of your board. The close button does not work.

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
- `public/audio.js` — run lifecycle plus procedural sound effects
- `public/music.js` — the soundtrack: a look-ahead sequencer and one composed track per incident
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
- **Fairness rules** — heavy incidents never chain, they buy a recovery window
  before the next one, and none of them fire while the well is close to topping
  out. The breach is the exception on purpose: it stays available when the stack
  is high, because it is the one incident that can rescue a run.
- **Seven more incidents, most of them destructive** — meteors, a wrecking ball,
  an industrial magnet, acid rain, cancelled gravity, a fake system crash and a
  commercial break. The catalogue is now fifteen.
- **A real soundtrack** (`public/music.js`) — a look-ahead scheduler places every
  note on the audio clock instead of a drifting `setTimeout` loop, and each
  incident has a composed track in its own genre: synthwave by default, polka
  for the sheep, dub techno for the flood, drum and bass for the bomb, downtuned
  doom for the tank, breakcore for the glitch, elevator muzak for the duck, a
  rave for the breach, taiko for the meteors, acid house for the acid. Tracks
  swap on the next bar line, so the switch never lands mid-beat. Drums, bass,
  pads, leads and the distorted power chords are all synthesised — there is
  still no audio file anywhere in this repository.
- **Escalation** — the gaps between incidents shrink as the chaos meter climbs,
  and past 42% chaos a harmless second incident (duck, advert, sheep, blackout)
  can run *on top of* the main one. Measured over a 75-second run: something is
  happening 57% of the time, two things at once 26% of it.
- **A scoring bug that predates all of this** — `clearLines` read past the end of
  its score table, so clearing five or more rows at once (which the new
  incidents do regularly) turned the score into `NaN` for the rest of the run.

## Best next polish pass

1. Replace emoji sheep/tank/duck/meteors with authored sprites or lightweight 3D models.
2. Add event-specific transitions: liquid refraction, tank muzzle flashes, CRT desync, water caustics.
3. More rare incidents: corporate training mode, a legendary tier, and something that only ever happens once.
4. Let the soundtrack react to danger as well as to incidents — an extra layer when the well is nearly full.
5. Achievements on top of the high scores already stored.
6. An online leaderboard for the daily challenge, once the arcade has a shared backend.

## Design rule

Chaos should destabilize the player, not arbitrarily delete a good run. Strong incidents should expose an upside, a skill check or a recoverable consequence.

The destructive incidents are written to that rule rather than around it: every
one of them removes cells as well as ruining the shape, so the stack that comes
out the other side is lower than the one that went in. What they cost you is the
plan, not the run.
