/*
 * data.js - all the game's content: elements, rarities, cards, chapters.
 * Edit this file to add cards or change balance. No other file needs to change
 * when you add a card (just add a line to the CARD_LIST below).
 *
 * Art: the game draws placeholder art for every card automatically (js/art.js).
 * To use your own, put an image at  assets/cards/<card-id>.png  and it replaces
 * the placeholder.
 */
var GameData = (function () {
  'use strict';

  // Fire beats Wind, Wind beats Water, Water beats Fire. Light and Dark beat each other.
  var ELEMENTS = {
    fire:  { name: 'Fire',  icon: '🔥', color: '#e4572e', beats: 'wind',  atkMod: 1.1, hpMod: 0.9 },
    water: { name: 'Water', icon: '💧', color: '#2e86e4', beats: 'fire',  atkMod: 0.9, hpMod: 1.1 },
    wind:  { name: 'Wind',  icon: '🍃', color: '#3fb56b', beats: 'water', atkMod: 1.0, hpMod: 1.0 },
    light: { name: 'Light', icon: '✨',       color: '#e8c547', beats: 'dark',  atkMod: 1.0, hpMod: 1.0 },
    dark:  { name: 'Dark',  icon: '🌑', color: '#8e5bd6', beats: 'light', atkMod: 1.05, hpMod: 0.95 }
  };

  // rate = percent chance per summon. cost = deck cost. fuseExp = exp this card gives when fused.
  var RARITIES = {
    N:   { name: 'Normal',     rate: 50, cost: 3,  atk: 20, hp: 100, fuseExp: 20,  sell: 20  },
    R:   { name: 'Rare',       rate: 33, cost: 5,  atk: 32, hp: 150, fuseExp: 45,  sell: 50  },
    SR:  { name: 'Super Rare', rate: 13, cost: 8,  atk: 50, hp: 230, fuseExp: 100, sell: 120 },
    SSR: { name: 'Legendary',  rate: 4,  cost: 12, atk: 80, hp: 360, fuseExp: 220, sell: 300 }
  };
  var RARITY_ORDER = ['N', 'R', 'SR', 'SSR'];

  // [id, name, element, rarity, art style]
  // Art styles used by the placeholder art: sprite, archer, knight, mage, beast, dragon, seraph, tyrant
  var CARD_LIST = [
    ['ember-imp',         'Ember Imp',         'fire',  'N',   'sprite'],
    ['cinder-archer',     'Cinder Archer',     'fire',  'R',   'archer'],
    ['ashen-duelist',     'Ashen Duelist',     'fire',  'R',   'knight'],
    ['flame-warden',      'Flame Warden',      'fire',  'SR',  'knight'],
    ['pyre-sovereign',    'Pyre Sovereign',    'fire',  'SSR', 'dragon'],

    ['brook-sprite',      'Brook Sprite',      'water', 'N',   'sprite'],
    ['tide-caller',       'Tide Caller',       'water', 'R',   'mage'],
    ['frost-sentinel',    'Frost Sentinel',    'water', 'R',   'beast'],
    ['abyss-knight',      'Abyss Knight',      'water', 'SR',  'tyrant'],
    ['tempest-leviathan', 'Tempest Leviathan', 'water', 'SSR', 'dragon'],

    ['breeze-pixie',      'Breeze Pixie',      'wind',  'N',   'sprite'],
    ['reed-skirmisher',   'Reed Skirmisher',   'wind',  'R',   'archer'],
    ['storm-falconer',    'Storm Falconer',    'wind',  'R',   'beast'],
    ['cyclone-dancer',    'Cyclone Dancer',    'wind',  'SR',  'mage'],
    ['skyfather-zephyr',  'Skyfather Zephyr',  'wind',  'SSR', 'seraph'],

    ['dawn-acolyte',      'Dawn Acolyte',      'light', 'N',   'sprite'],
    ['lantern-cleric',    'Lantern Cleric',    'light', 'R',   'mage'],
    ['sunblade-paladin',  'Sunblade Paladin',  'light', 'R',   'knight'],
    ['halo-seraph',       'Halo Seraph',       'light', 'SR',  'seraph'],
    ['radiant-archon',    'Radiant Archon',    'light', 'SSR', 'seraph'],

    ['shade-whelp',       'Shade Whelp',       'dark',  'N',   'sprite'],
    ['gloom-thief',       'Gloom Thief',       'dark',  'R',   'archer'],
    ['hollow-reaver',     'Hollow Reaver',     'dark',  'R',   'knight'],
    ['night-sorceress',   'Night Sorceress',   'dark',  'SR',  'mage'],
    ['void-tyrant',       'Void Tyrant',       'dark',  'SSR', 'tyrant']
  ];

  var CARDS = CARD_LIST.map(function (c) {
    var r = RARITIES[c[3]];
    var e = ELEMENTS[c[2]];
    return {
      id: c[0],
      name: c[1],
      element: c[2],
      rarity: c[3],
      style: c[4],
      atk: Math.round(r.atk * e.atkMod),
      hp: Math.round(r.hp * e.hpMod),
      cost: r.cost
    };
  });
  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });

  // Quests. Each chapter has 5 sections. Sections 1-4: beat 3 monsters, then a treasure
  // chest opens. Section 5 is the chapter boss.
  // dropWeights = chance weights for the card dropped from chests and boss battles.
  var CHAPTERS = [
    { id: 1, name: 'The Verdant Frontier', element: 'wind',
      enemies: [{ name: 'Thornback Boar', style: 'beast' }, { name: 'Moss Brigand', style: 'archer' },
                { name: 'Wild Gale Hawk', style: 'beast' }, { name: 'Bramble Witch', style: 'mage' }],
      boss: { name: 'Elder Treant', style: 'tyrant' },
      dropWeights: { N: 70, R: 27, SR: 3, SSR: 0 } },
    { id: 2, name: 'Cinder Peaks', element: 'fire',
      enemies: [{ name: 'Magma Crawler', style: 'beast' }, { name: 'Ash Raider', style: 'knight' },
                { name: 'Smoldering Wisp', style: 'sprite' }, { name: 'Slag Golem', style: 'tyrant' }],
      boss: { name: 'Caldera Drake', style: 'dragon' },
      dropWeights: { N: 40, R: 45, SR: 14, SSR: 1 } },
    { id: 3, name: 'The Hollow Sanctum', element: 'dark',
      enemies: [{ name: 'Grave Warden', style: 'knight' }, { name: 'Dusk Stalker', style: 'beast' },
                { name: 'Hollow Priest', style: 'mage' }, { name: 'Wailing Shade', style: 'sprite' }],
      boss: { name: 'The Pale Regent', style: 'seraph' },
      dropWeights: { N: 20, R: 45, SR: 30, SSR: 5 } }
  ];
  var STAGES_PER_CHAPTER = 5;

  // Balance knobs - change these to make the game easier or harder.
  var CONFIG = {
    startGems: 1000,
    startGold: 500,
    singlePullCost: 30,
    tenPullCost: 270,
    staminaRegenMs: 60 * 1000,       // 1 stamina per minute
    maxDeckSize: 5,
    maxEvo: 2,
    fuseGoldPerMaterial: 40,
    evolveGoldBase: 500,             // multiplied by (current evo + 1)
    firstClearGems: 30,
    firstClearBossGems: 100,
    battleMaxRounds: 40,
    monstersPerSection: 3,           // monsters to beat before the chest opens
    monsterDropChance: 0.2,          // chance a defeated monster drops a card
    chestCardChance: 0.75,           // chance the chest holds a card (otherwise extra gold)
    leaderMult: 1.2,                 // the first card in your party is the leader: +20% ATK and HP
    pointsPerLevel: 3,               // attribute points you get on each level-up
    staminaPerPoint: 2,              // each Stamina point: +2 max stamina
    atkPctPerPoint: 2,               // each ATK PWR point: +2% team ATK
    hpPctPerPoint: 2,                // each DEF PWR point: +2% team HP
    starterCards: ['cinder-archer', 'tide-caller', 'breeze-pixie', 'dawn-acolyte', 'shade-whelp']
  };

  var api = {
    ELEMENTS: ELEMENTS, RARITIES: RARITIES, RARITY_ORDER: RARITY_ORDER,
    CARDS: CARDS, CARD_BY_ID: CARD_BY_ID, CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER, CONFIG: CONFIG
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  return api;
})();
