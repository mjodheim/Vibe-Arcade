# Hivebound — Vibe Log

This project is intentionally built through iterative conversation rather than from a fixed technical specification. The log records the product feedback that changed the game.

## 2026-09-15 — Initial vibe

**Problem / desire**

Create the first game in a web arcade built through vibe coding: a fantasy bee roguelite that can be hosted on a VPS and supports a player leaderboard. It should be deep enough to support long-term replay rather than feel like a disposable coding demo.

**Direction that emerged through discussion**

- fantasy bee universe
- multiple playable roles/classes
- procedural runs and maps
- loot, crafting and talents
- boss encounters
- score chasing and Daily Hive seeds
- one account / leaderboard model that can later serve several games

**Result**

A first playable build with four classes, combat, procedural paths, loot rarities, Sigil Resonances, crafting, Gloam risk/reward, bosses, accounts and leaderboards.

## 2026-09-15 — Feedback #1: controls

**Player feedback**

> Keyboard shortcuts should be editable.

**Adaptation**

- added an in-game Controls panel
- every movement key and the class ability can be rebound
- bindings persist in local browser storage
- duplicate bindings are rejected
- quick presets added for WASD, ZQSD/AZERTY and arrow keys
- the HUD now displays the currently configured ability key

This is the intended development loop for Hivebound: play, discuss what feels wrong or missing, adapt, test, repeat.
