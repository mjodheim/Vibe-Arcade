# Vibe Arcade

**Games born from ideas, conversation, playtesting, and iteration with AI.**

Vibe Arcade is an experiment in **vibe coding**: instead of starting from code, frameworks, or a fixed technical specification, each game starts from a desired experience.

The loop is intentionally simple:

> idea → discuss with AI → playable build → play → react → adapt → repeat

The human role is to imagine, judge, steer, reject, refine, and decide when the result feels right. The code is an implementation detail handled through the AI workflow.

## Games

### #001 — Hivebound: Relics of the Bloom

A fantasy action roguelite starring warrior, mage, ranger, and support bees. Runs combine procedural paths, combat, loot, crafting, talents, bosses, build-defining Sigil Resonances, Gloam risk/reward, Daily Hive seeds, and per-user scores.

**Status:** playable prototype — v0.2

See [`games/hivebound`](games/hivebound).

## Repository layout

```text
Vibe-Arcade/
├── games/
│   └── hivebound/        # Game #001
├── docs/
│   ├── PHILOSOPHY.md     # What this experiment is trying to explore
│   └── ARCADE_LOG.md     # Cross-game conversation / iteration log
├── docker-compose.yml    # Run the current arcade stack
└── README.md
```

Future games will live beside Hivebound and share platform services such as identity, profiles, achievements, and leaderboards as those services mature.

## Run Hivebound

Requires Docker, or Node.js 20+ if running the game directly.

```bash
cp games/hivebound/.env.example games/hivebound/.env
# set a strong HIVEBOUND_SECRET

docker compose up -d --build
```

Open `http://localhost:8080`.

For game-specific instructions, controls, mechanics, and known limitations, see [`games/hivebound/README.md`](games/hivebound/README.md).

## Why keep the history public?

The interesting artifact is not only the final source code. It is the progression from a vague idea to something playable through repeated natural-language feedback.

That is why Vibe Arcade deliberately keeps **vibe logs** documenting product-level feedback such as:

- “I want to choose whether my bee is a warrior or a mage.”
- “This should be deep enough to play for hours.”
- “Keyboard shortcuts need to be configurable.”

Those comments are treated as first-class development inputs.

## Current experiment rule

For this project, Anthony steers the product through conversation and playtesting rather than manually implementing gameplay code.

The question is not *“Can AI generate code?”*.

It is:

> **How far can an idea be turned into a real, enjoyable, evolving game through conversation alone?**
