/*
 * data.js - all the game's content: factions, rarities, cards, chapters.
 * Edit this file to add cards or change balance. No other file needs to change
 * when you add a card (just add a line to the CARD_LIST below).
 *
 * Art: the game draws placeholder art for every card automatically (js/art.js).
 * To use your own, put an image at  assets/cards/<card-id>.png  and it replaces
 * the placeholder.
 */
var GameData = (function () {
  'use strict';

  // Three factions, like the original's Man / God / Demon. There is no damage weakness
  // between them. Each leans a different way, and cards matching the alignment you
  // picked at the start get a bonus (CONFIG.alignmentBonus).
  var FACTIONS = {
    mortal:   { name: 'Mortal',   icon: '⚔', color: '#5fbf7f', atkMod: 1.0,  hpMod: 1.0,  costMod: -1,
                blurb: 'Balanced fighters. Cost 1 less in your party.' },
    immortal: { name: 'Immortal', icon: '✦', color: '#f0c75e', atkMod: 0.85, hpMod: 1.25, costMod: 0,
                blurb: 'The toughest cards. High HP, lower ATK.' },
    fallen:   { name: 'Fallen',   icon: '☠', color: '#c05bd6', atkMod: 1.25, hpMod: 0.85, costMod: 0,
                blurb: 'The hardest hitters. High ATK, lower HP.' }
  };
  var FACTION_ORDER = ['mortal', 'immortal', 'fallen'];

  // rate = percent chance per summon. cost = deck cost. fuseExp = exp this card gives when fused.
  var RARITIES = {
    N:   { name: 'Normal',     rate: 50, cost: 3,  atk: 20, hp: 100, fuseExp: 20,  sell: 20  },
    R:   { name: 'Rare',       rate: 33, cost: 5,  atk: 32, hp: 150, fuseExp: 45,  sell: 50  },
    SR:  { name: 'Super Rare', rate: 13, cost: 8,  atk: 50, hp: 230, fuseExp: 100, sell: 120 },
    SSR: { name: 'Legendary',  rate: 4,  cost: 12, atk: 80, hp: 360, fuseExp: 220, sell: 300 }
  };
  var RARITY_ORDER = ['N', 'R', 'SR', 'SSR'];

  // [id, name, faction, rarity, art style, art look]
  // Art styles: sprite, archer, knight, mage, beast, dragon, seraph, tyrant
  // Art looks (color scene only, no effect on play): fire, water, wind, light, dark
  var CARD_LIST = [
    ['dawn-acolyte',      'Dawn Acolyte',      'mortal',   'N',   'sprite', 'light'],
    ['breeze-pixie',      'Breeze Pixie',      'mortal',   'N',   'sprite', 'wind'],
    ['cinder-archer',     'Cinder Archer',     'mortal',   'R',   'archer', 'fire'],
    ['reed-skirmisher',   'Reed Skirmisher',   'mortal',   'R',   'archer', 'wind'],
    ['sunblade-paladin',  'Sunblade Paladin',  'mortal',   'R',   'knight', 'light'],
    ['storm-falconer',    'Storm Falconer',    'mortal',   'R',   'beast',  'wind'],
    ['flame-warden',      'Flame Warden',      'mortal',   'SR',  'knight', 'fire'],
    ['tempest-leviathan', 'Tempest Leviathan', 'mortal',   'SSR', 'dragon', 'water'],

    ['brook-sprite',      'Brook Sprite',      'immortal', 'N',   'sprite', 'water'],
    ['lantern-cleric',    'Lantern Cleric',    'immortal', 'R',   'mage',   'light'],
    ['tide-caller',       'Tide Caller',       'immortal', 'R',   'mage',   'water'],
    ['frost-sentinel',    'Frost Sentinel',    'immortal', 'R',   'beast',  'water'],
    ['halo-seraph',       'Halo Seraph',       'immortal', 'SR',  'seraph', 'light'],
    ['cyclone-dancer',    'Cyclone Dancer',    'immortal', 'SR',  'mage',   'wind'],
    ['radiant-archon',    'Radiant Archon',    'immortal', 'SSR', 'seraph', 'light'],
    ['skyfather-zephyr',  'Skyfather Zephyr',  'immortal', 'SSR', 'seraph', 'wind'],

    ['ember-imp',         'Ember Imp',         'fallen',   'N',   'sprite', 'fire'],
    ['shade-whelp',       'Shade Whelp',       'fallen',   'N',   'sprite', 'dark'],
    ['ashen-duelist',     'Ashen Duelist',     'fallen',   'R',   'knight', 'fire'],
    ['gloom-thief',       'Gloom Thief',       'fallen',   'R',   'archer', 'dark'],
    ['hollow-reaver',     'Hollow Reaver',     'fallen',   'R',   'knight', 'dark'],
    ['night-sorceress',   'Night Sorceress',   'fallen',   'SR',  'mage',   'dark'],
    ['abyss-knight',      'Abyss Knight',      'fallen',   'SR',  'tyrant', 'water'],
    ['pyre-sovereign',    'Pyre Sovereign',    'fallen',   'SSR', 'dragon', 'fire'],
    ['void-tyrant',       'Void Tyrant',       'fallen',   'SSR', 'tyrant', 'dark']
  ];

  var CARDS = CARD_LIST.map(function (c) {
    var r = RARITIES[c[3]];
    var f = FACTIONS[c[2]];
    return {
      id: c[0],
      name: c[1],
      faction: c[2],
      rarity: c[3],
      style: c[4],
      look: c[5],
      atk: Math.round(r.atk * f.atkMod),
      hp: Math.round(r.hp * f.hpMod),
      cost: r.cost + f.costMod
    };
  });
  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });

  // Quests. Each chapter has 5 sections. Sections 1-4: beat 3 monsters, then a treasure
  // chest opens. Section 5 is the chapter boss. Every enemy in a chapter is of that
  // chapter's faction (which changes their ATK/HP the same way it does for cards).
  // dropWeights = chance weights for the card dropped from chests and boss battles.
  var CHAPTERS = [
    { id: 1, name: 'The Verdant Frontier', faction: 'mortal', look: 'wind',
      enemies: [{ name: 'Thornback Boar', style: 'beast' }, { name: 'Moss Brigand', style: 'archer' },
                { name: 'Wild Gale Hawk', style: 'beast' }, { name: 'Bramble Witch', style: 'mage' }],
      boss: { name: 'Elder Treant', style: 'tyrant' },
      dropWeights: { N: 70, R: 27, SR: 3, SSR: 0 } },
    { id: 2, name: 'Cinder Peaks', faction: 'fallen', look: 'fire',
      enemies: [{ name: 'Magma Crawler', style: 'beast' }, { name: 'Ash Raider', style: 'knight' },
                { name: 'Smoldering Wisp', style: 'sprite' }, { name: 'Slag Golem', style: 'tyrant' }],
      boss: { name: 'Caldera Drake', style: 'dragon' },
      dropWeights: { N: 40, R: 45, SR: 14, SSR: 1 } },
    { id: 3, name: 'The Hollow Sanctum', faction: 'immortal', look: 'dark',
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
    alignmentBonus: 1.15,            // cards matching your alignment: +15% ATK and HP
    sameFactionFuseMult: 1.5,        // fusing a card of the same faction gives 1.5x exp
    pointsPerLevel: 3,               // attribute points you get on each level-up
    staminaPerPoint: 2,              // each Stamina point: +2 max stamina
    atkPctPerPoint: 2,               // each ATK PWR point: +2% team ATK
    hpPctPerPoint: 2,                // each DEF PWR point: +2% team HP
    // Starting cards depend on the alignment you pick.
    starterCards: {
      mortal:   ['cinder-archer', 'reed-skirmisher', 'dawn-acolyte', 'breeze-pixie', 'brook-sprite'],
      immortal: ['lantern-cleric', 'tide-caller', 'brook-sprite', 'dawn-acolyte', 'ember-imp'],
      fallen:   ['gloom-thief', 'hollow-reaver', 'ember-imp', 'shade-whelp', 'dawn-acolyte']
    }
  };

  var api = {
    FACTIONS: FACTIONS, FACTION_ORDER: FACTION_ORDER, RARITIES: RARITIES, RARITY_ORDER: RARITY_ORDER,
    CARDS: CARDS, CARD_BY_ID: CARD_BY_ID, CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER, CONFIG: CONFIG
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  return api;
})();
