<p align="center">
  <img src="../../assets/hivebound-banner.svg" alt="Hivebound: Relics of the Bloom" width="100%" />
</p>

<p align="center">
  <strong>🐝 Vibe Arcade — Cabinet #001</strong><br/>
  <sub>3D fantasy action-RPG · world prototype v0.3</sub>
</p>

# 🌼 HIVEBOUND — Relics of the Bloom

Hivebound is no longer designed as a sequence of roguelite rooms. The target is a compact action-RPG world: **explore real maps, discover secrets, solve environmental puzzles, fight creatures where you find them, learn talents, gather materials, craft potions and improve your character.**

The fantasy remains the same: the Bloom is fading, the Gloam is spreading, and the old gardens around the Hive hide relics and corrupted creatures.

## The new core loop

```text
HIVE / SAFE PLACE
      ↓
EXPLORE A REAL MAP
  ↙   ↓    ↘
LORE  PUZZLES  COMBAT
 ↓      ↓       ↓
HARVEST · LOOT · XP
      ↓
TALENTS · CRAFT · POTIONS
      ↓
UNLOCK NEW PLACES / BOSSES
      ↓
RETURN, PREPARE, GO FARTHER
```

There is no separate route-card screen between encounters. Exploration is the game.

## Playable world slice — Verdant Reach

The current world prototype uses Three.js and already includes:

- free 3D exploration with a following camera;
- WASD, ZQSD and arrow-key movement;
- enemies living directly in the map and engaging nearby players;
- a four-slot action bar with cooldowns;
- Predator Sting, Pollen Nova, Briarstep and Wax Ward;
- healing potions;
- harvestable nectar, wax and pollen;
- field crafting for potions and permanent wax reinforcement;
- a talent panel with rankable combat upgrades;
- an ordered three-shrine environmental puzzle;
- a sealed Bloom Gate unlocked by solving the puzzle;
- a Gloam Warden boss encounter beyond the gate;
- XP, levels, talent points and material rewards;
- a deliberately light HUD so the world remains the main view.

The renderer is presentation only. Progression, combat values, quest state and crafting remain ordinary serializable game state so the world can later grow without turning Three.js meshes into the source of truth.

## Long-term character direction

The original class identities are still useful and should return as proper specializations rather than simple stat presets:

| Path | Fantasy | Expected gameplay |
|---|---|---|
| **Waxguard** | warrior / protector | melee, armour, retaliation, control |
| **Bloomweaver** | pollen mage | ranged spells, explosions, status effects |
| **Thornstrider** | ranger | mobility, precision, poison, critical hits |
| **Hymnkeeper** | support / summoner | auras, motes, healing, swarm companions |

The desired talent model is closer to an MMO/action-RPG tree: abilities should gain ranks, modifiers and meaningful branches instead of only offering random run bonuses.

## Systems to grow next

1. Proper GLB character and creature assets with animation states.
2. More maps connected through gates, paths and interior spaces.
3. Real collision/physics layer and nav-aware enemy AI.
4. NPCs, dialogue, quests and a journal.
5. Equipment slots, loot drops and visible item quality.
6. Larger talent trees and class-specific action bars.
7. Recipes, alchemy, weapon/armour crafting and gathering professions.
8. Map/minimap, discovered locations and fast travel.
9. Save-game boundary tied back into the existing server/account layer.
10. Restore leaderboard/daily systems only where they make sense for the new RPG structure.

## Controls — current slice

- `WASD` / `ZQSD` / arrows — move
- `E` — interact / harvest / activate shrine
- `1–4` — abilities
- mouse click — basic Predator Sting
- `R` — healing potion
- `I` — inventory
- `N` — talents
- `B` — crafting
- `Esc` — close panels

## Architecture

- `public/js/world.js` — current 3D world/simulation vertical slice
- `public/js/input-shim.js` — keyboard compatibility layer, including AZERTY
- `public/world.css` — lightweight RPG HUD and menus
- existing server/auth/score code remains in the repository while the RPG client is rebuilt
- Three.js is reused from the vendored Vibe Arcade build, with a CDN fallback for standalone development

## Run locally

```bash
export HIVEBOUND_SECRET='a-long-random-secret'
node server.js
```

Then open `http://localhost:8080`.

The standalone server can use the Three.js CDN fallback; the Vibe Arcade deployment reuses the vendored renderer from Stack Panic.

---

**Direction:** build a small world that is enjoyable to inhabit first. More maps, classes and systems come after movement, combat, discovery and interaction feel good.
