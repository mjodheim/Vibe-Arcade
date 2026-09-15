<p align="center">
  <img src="assets/vibe-arcade-banner-v2.svg" alt="Vibe Arcade — Ideas in, games out" width="100%" />
</p>

<p align="center">
  <a href="README.md">🇫🇷 Français</a> · <strong>🇬🇧 English</strong>
</p>

<p align="center">
  <strong>🎮 One idea. A few iterations. A new game to play.</strong><br/>
  <sub>A growing arcade built through vibe coding.</sub>
</p>

<p align="center">
  🧠 IDEA &nbsp;→&nbsp; 🤖 AI &nbsp;→&nbsp; 🕹️ PLAY &nbsp;→&nbsp; 💭 REACT &nbsp;→&nbsp; ✨ EVOLVE
</p>

---

## 🕹️ Welcome to Vibe Arcade

**Vibe Arcade** is a collection of games that begin with a feeling, a weird idea, or a simple *“wouldn't it be cool if…?”*

No traditional game-design document has to come first. No framework has to be chosen before the fun exists. The desired experience comes first; AI turns it into something playable; then we play it, react to it, change direction, add ideas, remove boring parts, and keep going until it feels right.

> **The code is not the attraction. The playable result is.**

The source is public. The private conversations used to steer development are **not archived in this repository**.

---

# 🐝 CABINET #001

## **Hivebound: Relics of the Bloom**

> *The Bloom is fading. The Hive remembers.*

A fantasy action roguelite where heroic bees venture beyond the safety of the hive, chase strange relics, build ridiculous combinations, defeat corrupted creatures, and risk everything for a higher score.

| 🛡️ Waxguard | ✨ Bloomweaver | 🏹 Thornstrider | 🎶 Hymnkeeper |
|:---:|:---:|:---:|:---:|
| Warrior | Mage | Ranger | Support |
| Armor & retaliation | Arcane pollen & bursts | Speed & critical hits | Auras & swarm power |

### 🍯 What's already inside?

`⚔️ real-time combat` · `🗺️ procedural routes` · `💎 randomized loot` · `🌿 talents` · `🔨 crafting` · `👑 bosses` · `🌀 resonances` · `🌑 risk/reward pacts` · `🏆 leaderboards` · `☀️ Daily Hive`

Every run is about becoming increasingly unreasonable before the corruption catches up with you.

**Current build:** `v0.2 — playable prototype`

➡️ **[Enter Hivebound](games/hivebound)**

---

# 🧱 CABINET #002

## **Stack Panic**

> *Everything is under control.*

A **falling-block game** that refuses to behave. You stack, you clear lines — and the chaos director sends in sheep that shove cells around, water that pours into the holes, a bomb, a tank, a blackout, an inspecting duck, or a **structural breach**: the game opens into 3D and you fly a ship through a tunnel built out of your own stack.

Every incident can save the run… or finish it. The chaos still has rules: it never piles on twice in a row, and it holds back while your stack is scraping the ceiling.

`🐑 sheep` · `💧 liquid blocks` · `💣 bombs` · `🪖 tank` · `🌑 blackout` · `📼 glitch` · `🦆 duck` · `🌀 3D breach` · `☀️ daily challenge` · `🏆 local records`

➡️ **[Play Stack Panic](https://arcade.mjodheim.be/stack-panic/)** · [the code and the game notes](games/stack-panic)

---

## 🧪 The Vibe Loop

```text
         💡 "What if...?"
                │
                ▼
          🤖 BUILD IT
                │
                ▼
          🎮 PLAY IT
          ╱          ╲
      😍 FUN        😐 MEH
        │             │
        │             ▼
        │       💭 "Change this..."
        │             │
        └──────┬──────┘
               ▼
            ✨ EVOLVE
               │
               └──────────↺
```

You do not need to describe APIs, classes, engines, databases, or patterns to influence the game.

Useful input can simply be:

> *“The mage doesn't feel powerful enough.”*
>
> *“I want loot that can completely change my build.”*
>
> *“This boss is boring.”*
>
> *“Let me remap the controls.”*
>
> *“I want to play one more run.”*

That last one is the important one. 😈

---

# 👾 The Arcade Floor

| Cabinet | Game | Genre | Status |
|:--:|---|---|:--:|
| `#001` | 🐝 **Hivebound: Relics of the Bloom** | Fantasy action roguelite | 🟢 PLAYABLE |
| `#002` | 🧱 **Stack Panic** | Chaotic falling-block puzzle | 🟢 PLAYABLE |
| `#003` | ❔ **???** | ??? | 🔒 LOCKED |
| `#004` | ❔ **???** | ??? | 🔒 LOCKED |

Future games can share the same arcade identity, player profiles, achievements, and per-game leaderboards while remaining completely different experiences.

---

## 🏆 Arcade ambitions

As the cabinet grows, Vibe Arcade is intended to gain a shared layer around the games:

- 👤 one player identity across the arcade
- 🏆 a leaderboard for every game
- 🥇 daily and all-time challenges
- 🎖️ cross-game achievements
- 📊 personal records and arcade statistics
- 🎲 wildly different games built from new ideas

The important constraint remains the same: **the player steers the product through ideas, playtesting, and natural-language feedback rather than manually implementing the gameplay.**

---

## 🚀 Run the current arcade

### Docker

```bash
cp games/hivebound/.env.example games/hivebound/.env
# Set a strong HIVEBOUND_SECRET in the .env file

docker compose up -d --build
```

Then open:

```text
http://localhost:8080
```

### Without Docker

Hivebound currently requires **Node.js 20+** and has zero runtime npm dependencies.

```bash
cd games/hivebound
export HIVEBOUND_SECRET='a-long-random-secret'
node server.js
```

For controls, mechanics and game-specific notes, visit **[games/hivebound](games/hivebound)**.

---

## 🗂️ Behind the cabinets

```text
Vibe-Arcade/
├── 🎮 games/
│   └── 🐝 hivebound/       # Game #001
├── 🎨 assets/               # Arcade visuals
├── 📚 docs/
│   └── PHILOSOPHY.md        # What the experiment explores
├── 🐳 docker-compose.yml
├── 📖 README.md             # Français
└── 📖 README.en.md          # English
```

---

<p align="center">
  <strong>✨ HAVE AN IDEA. PLAY THE RESULT. ✨</strong>
</p>

<p align="center">
  <sub>Vibe Arcade — built one strange idea at a time.</sub>
</p>
