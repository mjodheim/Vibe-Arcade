// Hivebound is played in French first. This suite is the guard rail: anything a
// player can read has to have a French form, including the strings the code
// builds at runtime. A new feature that forgets its translation fails here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { translateText, hasTranslation } from '../public/js/i18n/fr.js';
import { CLASSES, TALENTS, SIGILS, createRunState, craftOptions, eventOptions, pactOptions } from '../public/js/core/rules.js';
import { BIOMES, ENEMIES } from '../public/js/core/biomes.js';
import { NODE_TYPES } from '../public/js/core/world.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(HERE, '..', 'public');

// The universe keeps its own vocabulary in both languages, the way Hivebound,
// Bloom and Gloam do. These are names, not words to translate.
const PROPER_NOUNS = new Set([
  ...Object.values(CLASSES).map(c => c.name),
  ...Object.keys(SIGILS),
  'Hivebound', 'WASD', 'ZQSD'
]);

// "Known to the French layer" rather than "different from English": Score and
// Carapace are spelled the same in both languages and are still translated.
function translated(text) {
  return hasTranslation(text);
}

function collectDataStrings() {
  const strings = new Set();
  const add = value => {
    if (typeof value === 'string' && /[a-zA-Z]{3}/.test(value)) strings.add(value);
  };

  for (const classDef of Object.values(CLASSES)) {
    add(classDef.name); add(classDef.role); add(classDef.subtitle);
    add(classDef.description); add(classDef.ability); add(classDef.abilityDesc);
    classDef.traits.forEach(add);
  }
  for (const list of Object.values(TALENTS)) for (const talent of list) { add(talent.name); add(talent.desc); }
  for (const sigil of Object.values(SIGILS)) add(sigil.desc);
  for (const biome of BIOMES) { add(biome.name); add(biome.lore); }
  for (const enemy of Object.values(ENEMIES)) add(enemy.name);
  for (const node of Object.values(NODE_TYPES)) { add(node.title); add(node.desc); add(node.risk); }

  const state = createRunState('waxguard');
  for (const option of craftOptions(state)) { add(option.name); add(option.desc); }
  for (const option of eventOptions()) { add(option.name); add(option.desc); add(option.tag); }
  for (const option of pactOptions()) { add(option.name); add(option.desc); }

  return [...strings];
}

test('Every class, talent, relic sigil, biome, creature and node reads in French', () => {
  const untranslated = collectDataStrings()
    .filter(text => !PROPER_NOUNS.has(text))
    .filter(text => !translated(text));
  assert.deepEqual(untranslated, [], `untranslated game data: ${untranslated.join(' | ')}`);
});

// Text the interface writes itself, rather than reading out of the game data.
const INTERFACE_STRINGS = [
  // Screens and buttons
  'Leaderboard', 'Controls', 'Guest', 'Daily Hive', 'Submit Score', 'Login to Submit', 'Submitted ✓',
  'One More Run', 'FINAL SCORE', 'THE HIVE REMEMBERS', 'Your run has ended.',
  'The Bloom remembers your first steps.', 'Your score can be submitted to the Hive.',
  'Log in to place this run on the leaderboard.',
  // Heads-up display
  'Explore the glade', 'Take a gate onward', 'Defeat the Guardian', 'No relics yet.',
  // Choice screens
  'Choose a Talent', 'The Hive changes with every decision.',
  'Choose a Relic', 'Relics carry sigils. Matching sigils awaken Resonances.',
  'A Hidden Comb', 'Nobody was meant to find this one.',
  'The Petal Whispers', 'There is no free power in the broken Bloom.',
  'The Gloam Offers a Pact', 'The run may continue forever. The price rises with you.',
  'WAX SHRINE', 'Shape what you carried.', 'Crafting is intentionally small: every choice should matter to the run.',
  'Free',
  // Messages the game speaks
  'The way onward is open.', 'The Guardian falls. The way opens.',
  'A hidden comb, forgotten by everyone.', 'The Guardian of the region awakens.',
  'The Guardian calls the swarm.', 'Echo Resonance: your ability reverberates.',
  // Controls
  'CONTROLS', 'Make the Hive yours.', 'Move forward', 'Move back', 'Strafe left', 'Strafe right',
  'Class ability', 'Dash', 'Interact', 'Arrows', 'Press a key…', 'Binding unchanged.',
  'Graphics quality', 'Sound',
  // Account and leaderboard
  'HIVE ACCOUNT', 'HIVE PROFILE', 'Carry your scores between games.', 'Login', 'Create account',
  'Create', 'Username', 'Password', 'Enter the Hive', 'Log out', 'GLOBAL HIVE', 'All-time',
  'Loading…', 'Player', 'Class', 'Region', 'Score', 'No score yet. The first legend could be you.',
  // Local play, used when the arcade is served without its account server
  'LOCAL HIVE', 'Local play', 'Nickname', 'Save',
  'This arcade has no Hive server, so your runs stay on this device.',
  'No run recorded on this device yet.', 'The Hive is unreachable from here.'
];

test('Every interface string reads in French', () => {
  const untranslated = INTERFACE_STRINGS.filter(text => !translated(text));
  assert.deepEqual(untranslated, [], `untranslated interface text: ${untranslated.join(' | ')}`);
});

// Strings assembled at runtime. Each one stands for a template in the code, so
// the patterns that translate them stay covered.
const RUNTIME_STRINGS = [
  'Wave 2 / 4',
  'Wave 3 of 5',
  'LV 7',
  'Region 3',
  'Region 2 · Gloam 40%',
  'The Guardian sheds its shell. Phase 2.',
  'Overflow 2: +4% damage · +4 vitality',
  'Feral Memory · rank 2',
  'Common: Gilded Petal',
  'Legendary: Ancient Crown',
  'Ancient Petal',
  'Moonlit Lantern',
  'Choose Waxguard',
  'The Gloam claimed a Waxguard.',
  'Score submitted. Your best: 12,340.',
  'Best on this device: 12,340',
  'New best on this device: 12,340.',
  'Run saved on this device. Best: 12,340.',
  'Best score: 1,200 · Hive essence: 4',
  'Shift is already assigned to Dash.',
  'Class ability → Space',
  'EPIC · ✦ Thorn',
  'PACT · +20% GLOAM',
  'WAXGUARD · RANK 2',
  'TALENT · RANK 1',
  '+6% damage',
  '+4% speed · +3% crit',
  '🌿 Region',
  '☠ Kills',
  '♛ Bosses',
  '✦ Level',
  '🗝 Secrets',
  '🌒 Gloam',
  '🍯 5 · ⬡ 2'
];

test('Every runtime-assembled string reads in French', () => {
  const untranslated = RUNTIME_STRINGS.filter(text => !translated(text));
  assert.deepEqual(untranslated, [], `untranslated runtime text: ${untranslated.join(' | ')}`);
});

// The server answers in English; the player reads those answers.
const SERVER_MESSAGES = [
  'Username ≥ 3 chars and password ≥ 6 chars.',
  'Username already exists.',
  'Invalid credentials.',
  'Login required to submit a score.',
  'Invalid run.',
  'Invalid score.',
  'Run validation failed.',
  'Unauthorized',
  'Not found',
  'Internal server error'
];

test('Server error messages reach the player in French', () => {
  const untranslated = SERVER_MESSAGES.filter(text => !translated(text));
  assert.deepEqual(untranslated, [], `untranslated server message: ${untranslated.join(' | ')}`);
});

test('Static markup carries both languages, with French as the written default', () => {
  const html = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
  const tagged = [...html.matchAll(/<[^>]*data-(?:fr|en)=[^>]*>/g)].map(match => match[0]);
  assert.ok(tagged.length > 20, 'the page is localised through data attributes');

  for (const tag of tagged) {
    assert.ok(/data-fr="/.test(tag), `missing French: ${tag}`);
    assert.ok(/data-en="/.test(tag), `missing English: ${tag}`);
  }

  // Elements carrying both attributes must render their French text by default,
  // so a player without JavaScript still reads French.
  const pairs = [...html.matchAll(/data-fr="([^"]*)"[^>]*data-en="([^"]*)"\s*>([^<]*)</g)];
  assert.ok(pairs.length > 10, 'sampled enough localised elements');
  for (const [, french, , rendered] of pairs) {
    assert.equal(rendered.trim(), french.trim(), `default text should be the French one: ${french}`);
  }
});

test('French is the default language and English the alternate', () => {
  const source = readFileSync(join(PUBLIC, 'js', 'i18n.js'), 'utf8');
  assert.match(source, /==='en'\?'en':'fr'/, 'anything but an explicit English choice stays French');
  assert.match(source, /lang==='fr'\?'Hivebound — Reliques de la Bloom'/, 'the page title is localised too');
});

test('Translating is stable and never loses surrounding spacing', () => {
  assert.equal(translateText('  Dash  '), '  Esquive  ');
  assert.equal(translateText(''), '');
  assert.equal(translateText('12 345'), '12 345');
  const once = translateText('Choose a Talent');
  assert.equal(translateText(once), once, 'an already French string is left alone');
});
