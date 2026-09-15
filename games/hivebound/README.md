<p align="center">
  <img src="../../assets/hivebound-banner.svg" alt="Hivebound: Relics of the Bloom" width="100%" />
</p>

<p align="center">
  <strong>🐝 Vibe Arcade — Cabinet #001</strong><br/>
  <sub>Fantasy action roguelite · playable prototype v0.2</sub>
</p>

---

# 🌼 The Bloom is fading

Beyond the hive, the old gardens are changing.

Flowers glow where they should not. Ancient wax shrines hum in the dark. Strange relics surface beneath corrupted roots. The deeper a bee ventures into the Bloom, the stronger the **Gloam** becomes — and the greater the rewards.

Choose a role. Build something ridiculous. Defeat what waits beyond the petals. Decide how long you're willing to risk the run.

> **Survive. Adapt. Become gloriously overpowered. Score higher. Go again.**

---

## 🐝 Choose your bee

| Class | Role | Fantasy |
|:--|:--|:--|
| 🛡️ **Waxguard** | Warrior | Heavy wax armor, retaliation and staying power |
| ✨ **Bloomweaver** | Mage | Arcane pollen, bursts and magical destruction |
| 🏹 **Thornstrider** | Ranger | Speed, precision and critical-hit builds |
| 🎶 **Hymnkeeper** | Support | Auras, swarm power and strange supportive magic |

Each class is intended to feel different rather than simply carrying different stat bonuses.

---

## ⚔️ The run

```text
             🐝 HIVE
                │
                ▼
          🗺️ CHOOSE A PATH
          ╱      │       ╲
       ⚔️       💎       🔨
     COMBAT   TREASURE   SHRINE
        │        │         │
        └────────┼─────────┘
                 ▼
             🌿 GROW
        talents · loot · craft
                 │
                 ▼
              👑 BOSS
                 │
                 ▼
           🌑 GLOAM PACT
          safer?  greedier?
                 │
                 ▼
             GO DEEPER ↺
```

The further you push, the more dangerous the run becomes — and the more valuable your score multiplier can become.

---

## 💎 Buildcraft

Relics carry one of five **Sigils**. Stack matching Sigils and they awaken **Resonances** that reshape a build.

| Sigil | Identity |
|:--:|---|
| 🟡 **Wax** | durability, armor and retaliation |
| 🌸 **Bloom** | raw damage and chain explosions |
| 🌹 **Thorn** | speed, critical hits and aggression |
| 🔊 **Echo** | ability tempo and repeated effects |
| 🌑 **Gloam** | dangerous power and score multipliers |

The goal is not perfect balance at all times. Part of the fun is discovering combinations that become **beautifully unfair**.

---

## 🍯 What's playable now?

`⚔️ real-time combat` · `🗺️ procedural routes` · `💎 four loot rarities` · `🌿 randomized talents` · `🔨 crafting` · `👑 bosses` · `🌀 Sigil Resonances` · `🌑 Gloam Pacts` · `📈 endless scaling` · `🏆 all-time leaderboard` · `☀️ Daily Hive`

Also included:

- 👤 account registration and login
- 🎟️ run tokens with basic score validation
- 💾 persistent prototype data
- 🎲 deterministic Daily Hive seed shared by every player
- ⌨️ fully configurable keyboard controls
- 🇫🇷 friendly ZQSD/AZERTY preset
- 🐳 Docker-ready deployment
- 📦 zero runtime npm dependencies

---

## 🎮 Controls

Open **⚙ Controls** in-game to rebind movement and the class ability.

Quick presets:

`WASD` · `ZQSD / AZERTY` · `Arrow Keys`

The class ability defaults to `Space`, but every binding can be changed. Settings are stored locally in the browser and duplicate bindings are rejected.

Normal attacks currently auto-target nearby enemies so the player's attention stays on **movement, positioning, abilities and build decisions**.

---

## ☀️ Daily Hive

Every day, everyone can enter the same deterministic challenge.

Same seed. Same underlying route generation. Same opportunity.

The idea is simple:

> **Who makes the most out of today's hive?**

---

## 🏆 Score chasing

Hivebound is the first game in Vibe Arcade's shared leaderboard direction.

A run rewards progression, kills, bosses, loot and risk. Gloam can push the multiplier higher — if the run survives long enough to cash it in.

Long-term, Vibe Arcade is intended to expose a player profile with records across every cabinet.

---

# 🚀 Play locally

### Node.js 20+

```bash
export HIVEBOUND_SECRET='a-long-random-secret'
node server.js
```

Then visit:

```text
http://localhost:8080
```

### Docker / VPS

```bash
cp .env.example .env
# Set HIVEBOUND_SECRET in .env

docker compose up -d --build
```

The container exposes port `8080` and can sit behind an existing reverse proxy / TLS setup.

---

## ⚠️ Prototype cave

This is a playable prototype, not a finished competitive game.

The server performs basic run validation, but a determined player can still manipulate a browser client. A serious competitive leaderboard should eventually use replay/event validation or more server-authoritative simulation.

Persistence is deliberately lightweight for now. The current JSON layer keeps the prototype dependency-free; the shared Vibe Arcade identity and leaderboard layer can later move to PostgreSQL when the arcade grows.

---

<p align="center">
  <strong>🌼 ENTER THE BLOOM · EMBRACE THE GLOAM 🌑</strong>
</p>
