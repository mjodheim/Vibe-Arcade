# Hivebound: Relics of the Bloom

**Vibe Arcade — Game #001**

Hivebound is a browser-based fantasy action roguelite created as a vibe-coding experiment: describe the desired experience, play the result, discuss what feels wrong or missing, and iterate with AI until it becomes the game we wanted.

The human rule for the experiment is simple: **shape the product through conversation rather than manually implementing game code.**

## Current playable loop (v0.2)

- 4 genuinely different classes: Waxguard, Bloomweaver, Thornstrider, Hymnkeeper
- top-down real-time combat with keyboard controls
- configurable keyboard controls with WASD, ZQSD and arrow-key presets
- endless regions with increasing corruption
- procedural route choices: combat, elite, treasure, shrine, event, boss
- XP and randomized talent choices during combat
- randomized relics with four rarity tiers
- 5 Sigil families and Resonance thresholds that alter builds
- crafting materials and shrine upgrades
- risk/reward Gloam Pacts after bosses
- endless difficulty scaling and score multiplier
- account registration/login
- run tokens and basic score validation
- per-user all-time leaderboard
- deterministic Daily Hive seed shared by everyone
- persistent data without external services (JSON database for the prototype)
- zero runtime npm dependencies

## Run locally

Requires Node.js 20+.

```bash
export HIVEBOUND_SECRET='a-long-random-secret'
node server.js
```

Then open `http://localhost:8080`.

## Docker / VPS

```bash
cp .env.example .env
# edit HIVEBOUND_SECRET in .env
docker compose up -d --build
```

The container exposes port `8080`. Put it behind your existing reverse proxy / TLS configuration.

## Controls

Keyboard bindings are configurable from **⚙ Controls** in the game. The chosen bindings are saved locally in the browser.

Quick presets are included for:

- `WASD`
- `ZQSD` / AZERTY
- arrow keys

The class ability defaults to `Space`, but it can be rebound too. Duplicate bindings are rejected so the same key cannot accidentally drive two actions.

The auto-attack choice is deliberate: build decisions, movement and positioning should be the player's attention budget, and it leaves a clean path toward mobile controls.

## The identity of the game

The main build-crafting system is **Resonance**. Relics carry one of five Sigils:

- **Wax** — durability and retaliation
- **Bloom** — raw damage and chain explosions
- **Thorn** — speed and critical damage
- **Echo** — ability tempo and echoes
- **Gloam** — dangerous score multipliers

The goal is to make players chase combinations that sometimes become gloriously overpowered. Boss victories offer Gloam Pacts, allowing an endless run to trade safety for scoring potential.

## Important prototype limitations

This is intentionally a first playable build, not a finished game. The current server has basic run validation, but a determined player can still manipulate a browser client. Competitive leaderboards should later use replay/event validation or server-authoritative simulation.

The JSON persistence layer is intentionally dependency-free for v0.2. When the shared Vibe Arcade account system stabilizes, it should move to PostgreSQL and become its own service used by every game.

## Vibe log

The product began from one conversation:

> A fantasy web game starring bees, with selectable roles such as mage and warrior, loot, crafting, talents, maps, long-term replayability, and a per-user leaderboard. It should be the first game in a series and be built through iterative AI conversation rather than traditional hand-coding.

The next iterations should be driven by actual play: what is boring, confusing, too easy, ugly, satisfying, surprising, or missing?
