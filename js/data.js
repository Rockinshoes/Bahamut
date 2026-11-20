/*
 * data.js - all the game's content: elements, rarities, cards, chapters.
 * Edit this file to add cards or change balance. No other file needs to change
 * when you add a card (just add a line to the CARD_LIST below).
 *
 * Art: put your own image at  assets/cards/<card-id>.png  and it will show up
 * automatically. Without an image, a colored placeholder is drawn.
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

  // [id, name, element, rarity]
  var CARD_LIST = [
    ['ember-imp',         'Ember Imp',         'fire',  'N'],
    ['cinder-archer',     'Cinder Archer',     'fire',  'R'],
    ['ashen-duelist',     'Ashen Duelist',     'fire',  'R'],
    ['flame-warden',      'Flame Warden',      'fire',  'SR'],
    ['pyre-sovereign',    'Pyre Sovereign',    'fire',  'SSR'],

    ['brook-sprite',      'Brook Sprite',      'water', 'N'],
    ['tide-caller',       'Tide Caller',       'water', 'R'],
    ['frost-sentinel',    'Frost Sentinel',    'water', 'R'],
    ['abyss-knight',      'Abyss Knight',      'water', 'SR'],
    ['tempest-leviathan', 'Tempest Leviathan', 'water', 'SSR'],

    ['breeze-pixie',      'Breeze Pixie',      'wind',  'N'],
    ['reed-skirmisher',   'Reed Skirmisher',   'wind',  'R'],
    ['storm-falconer',    'Storm Falconer',    'wind',  'R'],
    ['cyclone-dancer',    'Cyclone Dancer',    'wind',  'SR'],
    ['skyfather-zephyr',  'Skyfather Zephyr',  'wind',  'SSR'],

    ['dawn-acolyte',      'Dawn Acolyte',      'light', 'N'],
    ['lantern-cleric',    'Lantern Cleric',    'light', 'R'],
    ['sunblade-paladin',  'Sunblade Paladin',  'light', 'R'],
    ['halo-seraph',       'Halo Seraph',       'light', 'SR'],
    ['radiant-archon',    'Radiant Archon',    'light', 'SSR'],

    ['shade-whelp',       'Shade Whelp',       'dark',  'N'],
    ['gloom-thief',       'Gloom Thief',       'dark',  'R'],
    ['hollow-reaver',     'Hollow Reaver',     'dark',  'R'],
    ['night-sorceress',   'Night Sorceress',   'dark',  'SR'],
    ['void-tyrant',       'Void Tyrant',       'dark',  'SSR']
  ];

  var CARDS = CARD_LIST.map(function (c) {
    var r = RARITIES[c[3]];
    var e = ELEMENTS[c[2]];
    return {
      id: c[0],
      name: c[1],
      element: c[2],
      rarity: c[3],
      atk: Math.round(r.atk * e.atkMod),
      hp: Math.round(r.hp * e.hpMod),
      cost: r.cost
    };
  });
  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });

  // Quests. Each chapter has 5 stages; stage 5 is a boss.
  // dropWeights = chance weights for the card dropped when you clear a stage.
  var CHAPTERS = [
    { id: 1, name: 'The Verdant Frontier', element: 'wind',
      enemies: ['Thornback Boar', 'Moss Brigand', 'Wild Gale Hawk', 'Bramble Witch'], boss: 'Elder Treant',
      dropWeights: { N: 70, R: 27, SR: 3, SSR: 0 } },
    { id: 2, name: 'Cinder Peaks', element: 'fire',
      enemies: ['Magma Crawler', 'Ash Raider', 'Smoldering Wisp', 'Slag Golem'], boss: 'Caldera Drake',
      dropWeights: { N: 40, R: 45, SR: 14, SSR: 1 } },
    { id: 3, name: 'The Hollow Sanctum', element: 'dark',
      enemies: ['Grave Warden', 'Dusk Stalker', 'Hollow Priest', 'Wailing Shade'], boss: 'The Pale Regent',
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
