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

# 🧱 CABINET #002

## **Stack Panic**

> *Everything is under control.*

A **falling-block game** that refuses to behave. You stack, you clear lines — and the chaos director sends in sheep that shove cells around, water that pours into the holes, a bomb, a tank, a blackout, an inspecting duck, or a **structural breach**: the game opens into 3D and you fly a ship through a tunnel built out of your own stack.

Since **v1.0 — NO MERCY**, no incident is on your side any more: blocks never just vanish, they get displaced, buried or thrown back on top of your stack. Chaos rises on its own, a new level lands every 30 seconds and a tide of rubble pushes up from the floor more and more often. Every run ends up breaking — the only question is when.

`🐑 sheep` · `💧 slippery controls` · `💣 rubble` · `🪖 backfill tank` · `🌑 blackout` · `📼 inverted controls` · `🦆 quality-control duck` · `🌀 3D breach` · `☀️ daily challenge` · `👤 player accounts` · `🏆 online leaderboards`

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
| `#002` | 🧱 **Stack Panic** | Chaotic falling-block puzzle | 🟢 PLAYABLE |
| `#003` | ❔ **???** | WTF arcade | 🛠️ UNDER CONSTRUCTION |
| `#004` | ❔ **???** | ??? | 🔒 LOCKED |

Future games can share the same arcade identity, player profiles, achievements, and per-game leaderboards while remaining completely different experiences.

---

## 🏆 Arcade ambitions

As the cabinet grows, Vibe Arcade is intended to gain a shared layer around the games:

- ✅ 👤 one player identity across the arcade
- ✅ 🏆 a leaderboard for every game
- 🥇 daily and all-time challenges
- 🎖️ cross-game achievements
- 📊 personal records and arcade statistics
- 🎲 wildly different games built from new ideas

The important constraint remains the same: **the player steers the product through ideas, playtesting, and natural-language feedback rather than manually implementing the gameplay.**

---

## 🚀 Run the current arcade

The site is static, plus a small API (`api/`) running as **Vercel Functions** for accounts and leaderboards. No npm dependencies.

```bash
npm run dev    # http://localhost:3000 — site + API with an in-memory store
npm test       # API tests + Stack Panic smoke test
```

### In production (Vercel)

1. Add an **Upstash Redis** database to the project (Vercel → Storage / Marketplace). It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` work too).
2. Set `ARCADE_SECRET`: a long random string (≥ 16 characters) that signs sessions and runs.

Without them the API answers "score server unavailable" and the games stay playable, unranked.

---

## 🗂️ Behind the cabinets

```text
Vibe-Arcade/
├── 🎮 games/
│   └── 🧱 stack-panic/     # Game #002
├── 🔐 api/                  # Accounts & leaderboards (Vercel Functions)
├── 🤝 shared/               # Account client shared by every cabinet
├── 🎨 assets/               # Arcade visuals
├── 📚 docs/
│   └── PHILOSOPHY.md        # What the experiment explores
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
