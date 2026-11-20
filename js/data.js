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
  // picked at the start get a small bonus (CONFIG.alignmentBonus). Mortal cards cost 1 less,
  // which matters because your party's total cost can't go over your ATK PWR.
  var FACTIONS = {
    mortal:   { name: 'Mortal',   icon: '⚔', color: '#5fbf7f', atkMod: 1.0,  hpMod: 1.0,  costMod: -1,
                blurb: 'Balanced fighters. Cost 1 less in your party.' },
    immortal: { name: 'Immortal', icon: '✦', color: '#f0c75e', atkMod: 0.85, hpMod: 1.25, costMod: 0,
                blurb: 'The toughest cards. High DEF, lower ATK.' },
    fallen:   { name: 'Fallen',   icon: '☠', color: '#c05bd6', atkMod: 1.25, hpMod: 0.85, costMod: 0,
                blurb: 'The hardest hitters. High ATK, lower DEF.' }
  };
  var FACTION_ORDER = ['mortal', 'immortal', 'fallen'];

  // Cards have ATK and DEF, like the original. In a battle, DEF is how much damage a card
  // can take before it is knocked out, and each hit deals ATK x CONFIG.damagePerAtk.
  // rate = percent chance per summon. cost = deck cost. fuseExp = exp this card gives when fused.
  // skill = strength (%) of the card's skill at this rarity.
  var RARITIES = {
    N:   { name: 'Normal',     rate: 50, cost: 3,  atk: 100, def: 100, fuseExp: 20,  sell: 20,  skill: 5  },
    R:   { name: 'Rare',       rate: 33, cost: 5,  atk: 160, def: 150, fuseExp: 45,  sell: 50,  skill: 10 },
    SR:  { name: 'Super Rare', rate: 13, cost: 8,  atk: 250, def: 230, fuseExp: 100, sell: 120, skill: 15 },
    SSR: { name: 'Legendary',  rate: 4,  cost: 12, atk: 400, def: 360, fuseExp: 220, sell: 300, skill: 20 }
  };

  // Card skills. Each has a chance to trigger at the start of a battle (see
  // CONFIG.skillChanceBySlot) and then lasts the whole battle.
  //   atkUp     +X% ATK to allies           defUp     +X% DEF to allies
  //   atkDefUp  +X% ATK and DEF to allies   foeAtkDown / foeDefDown  -X% to every enemy
  // A skill aimed at one faction ("fallen") only helps allies of that faction, but is
  // CONFIG.factionSkillMult times stronger. That rewards building around your alignment.
  var SKILL_TYPES = {
    atkUp:      { label: 'ATK Up' },
    defUp:      { label: 'DEF Up' },
    atkDefUp:   { label: 'ATK & DEF Up' },
    foeAtkDown: { label: 'Enemy ATK Down' },
    foeDefDown: { label: 'Enemy DEF Down' }
  };
  var RARITY_ORDER = ['N', 'R', 'SR', 'SSR'];

  // [id, name, faction, rarity, art style, art look, skill name, skill type, skill target]
  // Art styles: sprite, archer, knight, mage, beast, dragon, seraph, tyrant
  // Art looks (color scene only, no effect on play): fire, water, wind, light, dark
  // Skill target: 'all' (every ally) or a faction ('mortal', 'immortal', 'fallen').
  // Enemy-lowering skills always hit every enemy, so their target is 'all'.
  var CARD_LIST = [
    ['dawn-acolyte',      'Dawn Acolyte',      'mortal',   'N',   'sprite', 'light', 'Morning Prayer', 'defUp', 'all'],
    ['breeze-pixie',      'Breeze Pixie',      'mortal',   'N',   'sprite', 'wind', 'Tailwind', 'atkUp', 'mortal'],
    ['cinder-archer',     'Cinder Archer',     'mortal',   'R',   'archer', 'fire', 'Piercing Volley', 'foeDefDown', 'all'],
    ['reed-skirmisher',   'Reed Skirmisher',   'mortal',   'R',   'archer', 'wind', 'Ambush', 'atkUp', 'all'],
    ['sunblade-paladin',  'Sunblade Paladin',  'mortal',   'R',   'knight', 'light', 'Shield Wall', 'defUp', 'mortal'],
    ['storm-falconer',    'Storm Falconer',    'mortal',   'R',   'beast',  'wind', 'Harry', 'foeAtkDown', 'all'],
    ['flame-warden',      'Flame Warden',      'mortal',   'SR',  'knight', 'fire', 'Warden\'s Oath', 'atkDefUp', 'mortal'],
    ['tempest-leviathan', 'Tempest Leviathan', 'mortal',   'SSR', 'dragon', 'water', 'Maelstrom', 'foeDefDown', 'all'],

    ['brook-sprite',      'Brook Sprite',      'immortal', 'N',   'sprite', 'water', 'Spring Blessing', 'defUp', 'all'],
    ['lantern-cleric',    'Lantern Cleric',    'immortal', 'R',   'mage',   'light', 'Guiding Light', 'defUp', 'immortal'],
    ['tide-caller',       'Tide Caller',       'immortal', 'R',   'mage',   'water', 'Undertow', 'foeAtkDown', 'all'],
    ['frost-sentinel',    'Frost Sentinel',    'immortal', 'R',   'beast',  'water', 'Frostbite', 'foeDefDown', 'all'],
    ['halo-seraph',       'Halo Seraph',       'immortal', 'SR',  'seraph', 'light', 'Sanctuary', 'atkDefUp', 'immortal'],
    ['cyclone-dancer',    'Cyclone Dancer',    'immortal', 'SR',  'mage',   'wind', 'Gale Dance', 'atkUp', 'all'],
    ['radiant-archon',    'Radiant Archon',    'immortal', 'SSR', 'seraph', 'light', 'Divine Decree', 'atkDefUp', 'immortal'],
    ['skyfather-zephyr',  'Skyfather Zephyr',  'immortal', 'SSR', 'seraph', 'wind', 'Heaven\'s Wrath', 'atkUp', 'all'],

    ['ember-imp',         'Ember Imp',         'fallen',   'N',   'sprite', 'fire', 'Kindle', 'atkUp', 'fallen'],
    ['shade-whelp',       'Shade Whelp',       'fallen',   'N',   'sprite', 'dark', 'Gloom', 'foeAtkDown', 'all'],
    ['ashen-duelist',     'Ashen Duelist',     'fallen',   'R',   'knight', 'fire', 'Cinder Edge', 'atkUp', 'fallen'],
    ['gloom-thief',       'Gloom Thief',       'fallen',   'R',   'archer', 'dark', 'Sap', 'foeDefDown', 'all'],
    ['hollow-reaver',     'Hollow Reaver',     'fallen',   'R',   'knight', 'dark', 'Dread', 'foeAtkDown', 'all'],
    ['night-sorceress',   'Night Sorceress',   'fallen',   'SR',  'mage',   'dark', 'Shadow Hex', 'atkDefUp', 'fallen'],
    ['abyss-knight',      'Abyss Knight',      'fallen',   'SR',  'tyrant', 'water', 'Abyssal Guard', 'defUp', 'all'],
    ['pyre-sovereign',    'Pyre Sovereign',    'fallen',   'SSR', 'dragon', 'fire', 'Hellfire', 'atkUp', 'fallen'],
    ['void-tyrant',       'Void Tyrant',       'fallen',   'SSR', 'tyrant', 'dark', 'Oblivion', 'foeDefDown', 'all']
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
      skill: { name: c[6], type: c[7], target: c[8] },
      atk: Math.round(r.atk * f.atkMod),
      hp: Math.round(r.def * f.hpMod),   // "hp" in the code is the DEF shown on screen
      cost: r.cost + f.costMod
    };
  });
  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });

  // Quests. Each chapter has 5 sections. Sections 1-4: beat 3 monsters, then a treasure
  // chest opens. Section 5 is the chapter boss. Every enemy in a chapter is of that
  // chapter's faction (which changes their ATK/DEF the same way it does for cards).
  // treasure: a 6-piece set. Sections 1-4 each drop "their" piece (pieces 1-4); the boss
  // drops pieces 5 and 6. Collect all 6 to claim a card of the set's reward rarity.
  // dropWeights = chance weights for the card dropped from chests and boss battles.
  var CHAPTERS = [
    { id: 1, name: 'The Verdant Frontier', faction: 'mortal', look: 'wind',
      enemies: [{ name: 'Thornback Boar', style: 'beast' }, { name: 'Moss Brigand', style: 'archer' },
                { name: 'Wild Gale Hawk', style: 'beast' }, { name: 'Bramble Witch', style: 'mage' }],
      boss: { name: 'Elder Treant', style: 'tyrant' },
      treasure: { name: 'Relics of the Frontier', reward: 'SR',
        pieces: ['Mossy Idol', 'Boar Tusk Charm', 'Hawk Feather Quill', 'Bramble Crown', 'Treant Heartwood', 'Verdant Seal'] },
      dropWeights: { N: 70, R: 27, SR: 3, SSR: 0 } },
    { id: 2, name: 'Cinder Peaks', faction: 'fallen', look: 'fire',
      enemies: [{ name: 'Magma Crawler', style: 'beast' }, { name: 'Ash Raider', style: 'knight' },
                { name: 'Smoldering Wisp', style: 'sprite' }, { name: 'Slag Golem', style: 'tyrant' }],
      boss: { name: 'Caldera Drake', style: 'dragon' },
      treasure: { name: 'Embers of the Peaks', reward: 'SR',
        pieces: ['Magma Shard', 'Raider\'s Brand', 'Wisp Lantern', 'Golem Core', 'Drake Scale', 'Caldera Seal'] },
      dropWeights: { N: 40, R: 45, SR: 14, SSR: 1 } },
    { id: 3, name: 'The Hollow Sanctum', faction: 'immortal', look: 'dark',
      enemies: [{ name: 'Grave Warden', style: 'knight' }, { name: 'Dusk Stalker', style: 'beast' },
                { name: 'Hollow Priest', style: 'mage' }, { name: 'Wailing Shade', style: 'sprite' }],
      boss: { name: 'The Pale Regent', style: 'seraph' },
      treasure: { name: 'Regalia of the Sanctum', reward: 'SSR',
        pieces: ['Grave Key', 'Stalker\'s Fang', 'Priest\'s Censer', 'Wailing Bell', 'Regent\'s Ring', 'Hollow Seal'] },
      dropWeights: { N: 20, R: 45, SR: 30, SSR: 5 } }
  ];
  var STAGES_PER_CHAPTER = 5;

  // Balance knobs - change these to make the game easier or harder.
  var CONFIG = {
    startGems: 90,                   // enough for 3 single summons; earn more from first clears and level-ups
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
    damagePerAtk: 0.2,               // each hit deals ATK x 0.2 (+/-10%) to the target's DEF
    expPerStamina: 1,                // quests give exp equal to the stamina spent, like the original
    skillChanceBySlot: [1, 0.8, 0.6, 0.4, 0.2], // chance each party slot's skill triggers
    factionSkillMult: 1.5,           // faction-only skills are 1.5x stronger
    treasureDropChance: 0.2,         // chance a section's monster drops that section's treasure piece
    bossTreasureChance: 0.5,         // chance a boss drops treasure piece 5 or 6
    monstersPerSection: 3,           // monsters to beat before the chest opens
    monsterDropChance: 0.2,          // chance a defeated monster drops a card
    chestCardChance: 0.75,           // chance the chest holds a card (otherwise extra gold)
    leaderMult: 1.2,                 // the first card in your party is the leader: +20% ATK and DEF
    alignmentBonus: 1.05,            // cards matching your alignment: +5% ATK and DEF
    sameFactionFuseMult: 1.5,        // fusing a card of the same faction gives 1.5x exp
    pointsPerLevel: 3,               // attribute points you get on each level-up
    pointsPerSectionClear: 1,        // and one more the first time you clear each section
    staminaPerPoint: 2,              // each Stamina point: +2 max stamina
    baseAtkPower: 12,                // ATK PWR = your party cost limit. You start at 12...
    atkPowerPerPoint: 1,             // ...and each ATK PWR point adds 1
    // The starter pack you get for picking an alignment: one champion of that faction.
    starterCards: {
      mortal:   ['flame-warden'],
      immortal: ['halo-seraph'],
      fallen:   ['night-sorceress']
    }
  };

  var api = {
    FACTIONS: FACTIONS, FACTION_ORDER: FACTION_ORDER, RARITIES: RARITIES, RARITY_ORDER: RARITY_ORDER, SKILL_TYPES: SKILL_TYPES,
    CARDS: CARDS, CARD_BY_ID: CARD_BY_ID, CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER, CONFIG: CONFIG
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  return api;
})();
