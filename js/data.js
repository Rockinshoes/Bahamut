/*
 * data.js - all the game's content: factions, rarities, cards, chapters.
 * Edit this file to add cards or change balance. No other file needs to change
 * when you add a card (just add a line to the CARD_LIST below).
 *
 * The conventions follow the original Rage of Bahamut (2012 English version):
 *  - three realms: Man, Gods, Demons (here: Mortal, Immortal, Fallen)
 *  - rarities Normal, High Normal, Rare, High Rare, S Rare, SS Rare, Legend
 *  - most cards lean to attack or to defense
 *  - skills read like "Big Boost to Gods Attack" or "Medium Hit to Foes Defense (All)",
 *    with strength tiers Small, Medium, Big, Great, Massive, Absolute
 *  - every quest section drops one card of each realm
 *
 * Art: the game draws placeholder art for every card automatically (js/art.js).
 * To use your own, put an image at  assets/cards/<card-id>.png  and it replaces it.
 */
var GameData = (function () {
  'use strict';

  // Three factions. There is no damage weakness between them; each leans a different way,
  // and cards matching the alignment you picked get a small bonus (CONFIG.alignmentBonus).
  // Mortal cards cost 1 less, which matters because party cost can't exceed your ATK PWR.
  // Art rule: Mortal cards are always human, Immortal are gods/angels/fairies/celestial
  // beasts, Fallen are demons/monsters. Dragons belong to Immortal (celestial, like the
  // original's Bahamut and Qinglong) and Fallen (chaos dragons, like Tiamat) - never Mortal.
  var FACTIONS = {
    mortal:   { name: 'Mortal',   icon: '⚔', color: '#5fbf7f', atkMod: 1.0,  hpMod: 1.0,  costMod: -1,
                blurb: 'Humans: knights, archers, mages. Balanced, and each card costs 1 less in your party.' },
    immortal: { name: 'Immortal', icon: '✦', color: '#f0c75e', atkMod: 0.9,  hpMod: 1.15, costMod: 0,
                blurb: 'Gods, angels and celestial beasts. Sturdy: higher DEF, lower ATK.' },
    fallen:   { name: 'Fallen',   icon: '☠', color: '#c05bd6', atkMod: 1.15, hpMod: 0.9,  costMod: 0,
                blurb: 'Demons, monsters and chaos dragons. Fierce: higher ATK, lower DEF.' }
  };
  var FACTION_ORDER = ['mortal', 'immortal', 'fallen'];

  // Cards have ATK and DEF, like the original. In a battle, DEF is how much damage a card
  // can take before it is knocked out, and each hit deals ATK x CONFIG.damagePerAtk.
  // rate = percent chance per summon. cost = party cost. fuseExp = exp this card gives when fused.
  // skill = skill strength (%) at this rarity, and tier = how the original named that strength.
  var RARITIES = {
    N:   { name: 'Normal',      rate: 40,  cost: 3,  atk: 100, def: 100, fuseExp: 20,  sell: 20,  skill: 5,  tier: 'Small' },
    HN:  { name: 'High Normal', rate: 25,  cost: 4,  atk: 130, def: 125, fuseExp: 30,  sell: 35,  skill: 6,  tier: 'Small' },
    R:   { name: 'Rare',        rate: 18,  cost: 5,  atk: 160, def: 150, fuseExp: 45,  sell: 50,  skill: 8,  tier: 'Medium' },
    HR:  { name: 'High Rare',   rate: 10,  cost: 6,  atk: 200, def: 190, fuseExp: 70,  sell: 80,  skill: 10, tier: 'Big' },
    SR:  { name: 'S Rare',      rate: 5,   cost: 8,  atk: 250, def: 230, fuseExp: 100, sell: 120, skill: 13, tier: 'Great' },
    SSR: { name: 'SS Rare',     rate: 1.7, cost: 12, atk: 400, def: 360, fuseExp: 220, sell: 300, skill: 16, tier: 'Massive' },
    L:   { name: 'Legend',      rate: 0.3, cost: 15, atk: 520, def: 480, fuseExp: 300, sell: 500, skill: 20, tier: 'Absolute' }
  };
  var RARITY_ORDER = ['N', 'HN', 'R', 'HR', 'SR', 'SSR', 'L'];

  // Card types: like the original, most cards are built to attack or to defend.
  var CARD_TYPES = {
    atk: { name: 'Attack',   atk: 1.15, def: 0.85 },
    def: { name: 'Defense',  atk: 0.85, def: 1.15 },
    bal: { name: 'Balanced', atk: 1.0,  def: 1.0 }
  };

  // Skills. kind: 'boost' raises your cards, 'hit' lowers the enemy's.
  // stat: 'atk', 'def' or 'both'. target: 'all', or a faction ('mortal', 'immortal', 'fallen').
  // A boost aimed at one faction only helps your cards of that faction; a hit aimed at one
  // faction only weakens enemies of that faction. Aimed skills are CONFIG.factionSkillMult
  // times stronger, which rewards building around your alignment, as in the original.
  // Each skill can trigger at the start of a battle (see CONFIG.skillChanceBySlot).
  var SKILL_KINDS = { boost: 'Boost', hit: 'Hit' };

  // [id, name, faction, rarity, type, art style, art look, skill name, skill kind, skill stat, skill target]
  // Art styles. Human: archer, knight, mage, warrior, lancer. Immortal adds a halo and wings
  // to those, plus sprite (fairy), beast, seraph and serpent (celestial dragon). Fallen adds
  // horns to those, plus sprite (imp), beast, tyrant and dragon (chaos dragon).
  // Art looks (color scene only): fire, water, wind, light, dark.
  var CARD_LIST = [
    // ---- Mortal: humans only
    ['militia-spearman',  'Militia Spearman',  'mortal',   'N',   'def', 'lancer',  'wind',  'Hold the Line',      'boost', 'def',  'all'],
    ['village-archer',    'Village Archer',    'mortal',   'N',   'atk', 'archer',  'wind',  'Volley',             'hit',   'def',  'all'],
    ['mercenary',         'Mercenary',         'mortal',   'HN',  'atk', 'warrior', 'fire',  'Paid in Blood',      'boost', 'atk',  'mortal'],
    ['hedge-witch',       'Hedge Witch',       'mortal',   'HN',  'bal', 'mage',    'wind',  'Hex',                'hit',   'atk',  'all'],
    ['captain',           'Captain',           'mortal',   'R',   'def', 'knight',  'light', 'Rally',              'boost', 'def',  'mortal'],
    ['master-archer',     'Master Archer',     'mortal',   'R',   'atk', 'archer',  'fire',  'Piercing Shot',      'hit',   'def',  'all'],
    ['alchemist',         'Alchemist',         'mortal',   'R',   'bal', 'mage',    'water', 'Elixir',             'boost', 'both', 'all'],
    ['berserker',         'Berserker',         'mortal',   'HR',  'atk', 'warrior', 'fire',  'Frenzy',             'boost', 'atk',  'mortal'],
    ['high-lancer',       'High Lancer',       'mortal',   'HR',  'def', 'lancer',  'light', 'Phalanx',            'boost', 'def',  'all'],
    ['greatsword-maiden', 'Greatsword Maiden', 'mortal',   'HR',  'atk', 'knight',  'water', 'Demon\'s Bane',      'hit',   'def',  'fallen'],
    ['flame-warden',      'Flame Warden',      'mortal',   'SR',  'bal', 'knight',  'fire',  'Warden\'s Oath',     'boost', 'both', 'mortal'],
    ['grand-sorcerer',    'Grand Sorcerer',    'mortal',   'SR',  'atk', 'mage',    'light', 'Arcane Storm',       'hit',   'def',  'all'],
    ['achilles',          'Achilles',          'mortal',   'SSR', 'atk', 'lancer',  'fire',  'Wrath of Achilles',  'boost', 'atk',  'mortal'],
    ['siegfried',         'Siegfried',         'mortal',   'L',   'bal', 'warrior', 'light', 'Dragonslayer',       'boost', 'both', 'all'],
    ['squire',            'Squire',            'mortal',   'N',   'def', 'knight',  'light', 'Steadfast',          'boost', 'def',  'mortal'],
    ['crossbowman',       'Crossbowman',       'mortal',   'HN',  'atk', 'archer',  'fire',  'Iron Bolt',          'hit',   'def',  'all'],
    ['monk',              'Wandering Monk',    'mortal',   'HN',  'def', 'warrior', 'wind',  'Iron Body',          'boost', 'def',  'all'],
    ['shieldmaiden',      'Shieldmaiden',      'mortal',   'R',   'def', 'lancer',  'water', 'Linked Shields',     'boost', 'def',  'mortal'],
    ['ranger',            'Ranger',            'mortal',   'R',   'atk', 'archer',  'wind',  'Hunter\'s Mark',     'hit',   'def',  'fallen'],
    ['battle-cleric',     'Battle Cleric',     'mortal',   'HR',  'bal', 'mage',    'light', 'Benediction',        'boost', 'both', 'mortal'],
    ['beowulf',           'Beowulf',           'mortal',   'SR',  'atk', 'warrior', 'fire',  'Grendel\'s Bane',    'boost', 'atk',  'mortal'],
    ['roland',            'Roland',            'mortal',   'SSR', 'bal', 'knight',  'light', 'Durendal',           'hit',   'def',  'all'],

    // ---- Immortal: gods, angels, fairies, celestial beasts and dragons
    ['sylph',             'Sylph',             'immortal', 'N',   'atk', 'sprite',  'wind',  'Gust',               'boost', 'atk',  'immortal'],
    ['dryad',             'Dryad',             'immortal', 'N',   'def', 'mage',    'wind',  'Bark Skin',          'boost', 'def',  'all'],
    ['nymph',             'Nymph',             'immortal', 'HN',  'def', 'sprite',  'water', 'Spring Blessing',    'boost', 'def',  'immortal'],
    ['shield-angel',      'Shield Angel',      'immortal', 'HN',  'def', 'knight',  'light', 'Aegis',              'boost', 'def',  'all'],
    ['agni',              'Agni',              'immortal', 'R',   'atk', 'mage',    'fire',  'Sacred Flame',       'boost', 'atk',  'immortal'],
    ['rhea',              'Rhea',              'immortal', 'R',   'def', 'mage',    'light', 'Mother\'s Ward',     'boost', 'def',  'immortal'],
    ['valkyrie-lancer',   'Valkyrie Lancer',   'immortal', 'R',   'atk', 'lancer',  'light', 'Valiant Charge',     'hit',   'def',  'all'],
    ['pegasus',           'Pegasus',           'immortal', 'HR',  'bal', 'beast',   'light', 'Skyward',            'boost', 'both', 'immortal'],
    ['freyja',            'Freyja',            'immortal', 'HR',  'def', 'mage',    'water', 'Falcon Cloak',       'hit',   'atk',  'all'],
    ['hermes',            'Hermes',            'immortal', 'HR',  'atk', 'archer',  'wind',  'Trickster',          'hit',   'atk',  'fallen'],
    ['halo-seraph',       'Halo Seraph',       'immortal', 'SR',  'bal', 'seraph',  'light', 'Sanctuary',          'boost', 'both', 'immortal'],
    ['xuanwu',            'Xuanwu',            'immortal', 'SR',  'def', 'beast',   'water', 'Black Tortoise Shell', 'boost', 'def', 'all'],
    ['qinglong',          'Qinglong',          'immortal', 'SSR', 'atk', 'serpent', 'water', 'Azure Tempest',      'boost', 'atk',  'immortal'],
    ['odin',              'Odin',              'immortal', 'L',   'bal', 'lancer',  'light', 'Gungnir',            'boost', 'both', 'all'],
    ['pixie',             'Pixie',             'immortal', 'N',   'atk', 'sprite',  'wind',  'Twinkle Dust',       'hit',   'atk',  'all'],
    ['cherub',            'Cherub',            'immortal', 'N',   'def', 'sprite',  'light', 'Little Grace',       'boost', 'def',  'immortal'],
    ['unicorn',           'Unicorn',           'immortal', 'HN',  'bal', 'beast',   'light', 'Pure Horn',          'boost', 'both', 'all'],
    ['muse',              'Muse',              'immortal', 'R',   'atk', 'mage',    'wind',  'Inspiration',        'boost', 'atk',  'all'],
    ['thor',              'Thor',              'immortal', 'HR',  'atk', 'warrior', 'water', 'Mjolnir',            'hit',   'def',  'all'],
    ['athena',            'Athena',            'immortal', 'SR',  'def', 'lancer',  'light', 'Aegis of Wisdom',    'boost', 'def',  'immortal'],
    ['phoenix',           'Phoenix',           'immortal', 'SSR', 'atk', 'beast',   'fire',  'Rebirth Flame',      'boost', 'atk',  'immortal'],
    ['zeus',              'Zeus',              'immortal', 'L',   'atk', 'mage',    'light', 'Thunderbolt',        'hit',   'def',  'all'],

    // ---- Fallen: demons, monsters, undead and chaos dragons
    ['goblin',            'Goblin',            'fallen',   'N',   'atk', 'sprite',  'dark',  'Ambush',             'boost', 'atk',  'fallen'],
    ['imp',               'Imp',               'fallen',   'N',   'bal', 'sprite',  'fire',  'Prank',              'hit',   'atk',  'all'],
    ['ghoul-brute',       'Ghoul Brute',       'fallen',   'HN',  'atk', 'warrior', 'dark',  'Grave Hunger',       'hit',   'def',  'all'],
    ['hellhound',         'Hellhound',         'fallen',   'HN',  'atk', 'beast',   'fire',  'Hunt',               'boost', 'atk',  'fallen'],
    ['succubus',          'Succubus',          'fallen',   'R',   'def', 'mage',    'dark',  'Charm',              'hit',   'atk',  'all'],
    ['gargoyle',          'Gargoyle',          'fallen',   'R',   'def', 'sprite',  'dark',  'Stoneskin',          'boost', 'def',  'fallen'],
    ['wraith-knight',     'Wraith Knight',     'fallen',   'R',   'def', 'knight',  'dark',  'Dread',              'hit',   'atk',  'mortal'],
    ['chimera',           'Chimera',           'fallen',   'HR',  'atk', 'beast',   'fire',  'Triple Maw',         'hit',   'def',  'all'],
    ['vampire-countess',  'Vampire Countess',  'fallen',   'HR',  'def', 'mage',    'dark',  'Blood Pact',         'boost', 'def',  'fallen'],
    ['minotaur',          'Minotaur',          'fallen',   'HR',  'atk', 'warrior', 'fire',  'Labyrinth Rage',     'boost', 'atk',  'all'],
    ['night-sorceress',   'Night Sorceress',   'fallen',   'SR',  'bal', 'mage',    'dark',  'Shadow Hex',         'boost', 'both', 'fallen'],
    ['medusa',            'Medusa',            'fallen',   'SR',  'atk', 'mage',    'water', 'Stone Gaze',         'hit',   'def',  'all'],
    ['tiamat',            'Tiamat',            'fallen',   'SSR', 'atk', 'dragon',  'fire',  'Primordial Chaos',   'boost', 'atk',  'fallen'],
    ['asmodeus',          'Asmodeus',          'fallen',   'L',   'bal', 'tyrant',  'dark',  'Infernal Crown',     'boost', 'both', 'all'],
    ['kobold',            'Kobold',            'fallen',   'N',   'atk', 'sprite',  'fire',  'Scrap Blade',        'boost', 'atk',  'fallen'],
    ['harpy',             'Harpy',             'fallen',   'N',   'atk', 'sprite',  'wind',  'Shriek',             'hit',   'atk',  'all'],
    ['banshee',           'Banshee',           'fallen',   'HN',  'def', 'mage',    'dark',  'Mourning Wail',      'hit',   'atk',  'all'],
    ['werewolf',          'Werewolf',          'fallen',   'R',   'atk', 'beast',   'dark',  'Feral Howl',         'boost', 'atk',  'fallen'],
    ['lich',              'Lich',              'fallen',   'HR',  'bal', 'mage',    'dark',  'Phylactery',         'boost', 'both', 'fallen'],
    ['cerberus',          'Cerberus',          'fallen',   'SR',  'atk', 'beast',   'fire',  'Three Heads',        'hit',   'def',  'all'],
    ['jormungand',        'Jormungand',        'fallen',   'SSR', 'def', 'dragon',  'water', 'World Coil',         'boost', 'def',  'all'],
    ['beelzebub',         'Beelzebub',         'fallen',   'L',   'atk', 'tyrant',  'fire',  'Lord of Flies',      'hit',   'both', 'all']
  ];

  var CARDS = CARD_LIST.map(function (c) {
    var r = RARITIES[c[3]];
    var f = FACTIONS[c[2]];
    var t = CARD_TYPES[c[4]];
    return {
      id: c[0],
      name: c[1],
      faction: c[2],
      rarity: c[3],
      type: c[4],
      style: c[5],
      look: c[6],
      skill: { name: c[7], kind: c[8], stat: c[9], target: c[10] },
      atk: Math.round(r.atk * f.atkMod * t.atk),
      hp: Math.round(r.def * f.hpMod * t.def),   // "hp" in the code is the DEF shown on screen
      cost: r.cost + f.costMod
    };
  });
  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });

  // Cards from earlier versions of this game, and what they became. Saves are converted.
  var CARD_RENAMES = {
    'dawn-acolyte': 'village-archer', 'breeze-pixie': 'militia-spearman', 'cinder-archer': 'master-archer',
    'reed-skirmisher': 'captain', 'sunblade-paladin': 'alchemist', 'storm-falconer': 'mercenary',
    'tempest-leviathan': 'achilles', 'brook-sprite': 'sylph', 'lantern-cleric': 'rhea', 'tide-caller': 'agni',
    'frost-sentinel': 'valkyrie-lancer', 'cyclone-dancer': 'xuanwu', 'radiant-archon': 'qinglong',
    'skyfather-zephyr': 'qinglong', 'ember-imp': 'imp', 'shade-whelp': 'goblin', 'ashen-duelist': 'wraith-knight',
    'gloom-thief': 'succubus', 'hollow-reaver': 'gargoyle', 'abyss-knight': 'medusa', 'pyre-sovereign': 'tiamat',
    'void-tyrant': 'tiamat'
  };

  // Quests. Each chapter has 5 sections. Sections 1-4: beat 3 monsters, then a treasure
  // chest opens. Section 5 is the chapter boss. Every enemy in a chapter is of that
  // chapter's faction (which changes their ATK/DEF the same way it does for cards).
  // drops: as in the original, each section drops one card of each realm:
  //   [Mortal card, Immortal card, Fallen card]. Defeated monsters sometimes drop one of them,
  //   and the chest usually holds one. bossDrops: what the boss's chest can hold.
  // treasure: a 6-piece set. Sections 1-4 each drop "their" piece (pieces 1-4); the boss
  // drops pieces 5 and 6. Collect all 6 to claim a card of the set's reward rarity.
  var CHAPTERS = [
    { id: 1, name: 'The Verdant Frontier', faction: 'mortal', look: 'wind',
      enemies: [{ name: 'Road Bandit', style: 'warrior' }, { name: 'Brigand Archer', style: 'archer' },
                { name: 'Renegade Knight', style: 'knight' }, { name: 'Bramble Witch', style: 'mage' }],
      boss: { name: 'Bandit King', style: 'warrior' },
      drops: [['village-archer', 'sylph', 'goblin'], ['militia-spearman', 'dryad', 'imp'],
              ['mercenary', 'nymph', 'hellhound'], ['hedge-witch', 'shield-angel', 'ghoul-brute']],
      bossDrops: ['captain', 'rhea', 'gargoyle'],
      treasure: { name: 'Relics of the Frontier', reward: 'SR',
        pieces: ['Mossy Idol', 'Bandit\'s Coin', 'Fletcher\'s Quill', 'Bramble Crown', 'Kingly Signet', 'Verdant Seal'] } },
    { id: 2, name: 'Cinder Peaks', faction: 'fallen', look: 'fire',
      enemies: [{ name: 'Cave Goblin', style: 'sprite' }, { name: 'Lava Hound', style: 'beast' },
                { name: 'Ash Ghoul', style: 'warrior' }, { name: 'Cinder Witch', style: 'mage' }],
      boss: { name: 'Fafnir', style: 'dragon' },
      drops: [['mercenary', 'nymph', 'ghoul-brute'], ['master-archer', 'agni', 'succubus'],
              ['alchemist', 'valkyrie-lancer', 'wraith-knight'], ['captain', 'rhea', 'gargoyle']],
      bossDrops: ['berserker', 'pegasus', 'chimera'],
      treasure: { name: 'Embers of the Peaks', reward: 'SR',
        pieces: ['Goblin Totem', 'Hound Collar', 'Ghoul\'s Lantern', 'Witch\'s Cauldron', 'Fafnir\'s Scale', 'Caldera Seal'] } },
    { id: 3, name: 'The Sky Sanctum', faction: 'immortal', look: 'light',
      enemies: [{ name: 'Temple Sylph', style: 'sprite' }, { name: 'Sanctum Guardian', style: 'knight' },
                { name: 'Sacred Lion', style: 'beast' }, { name: 'Oracle', style: 'mage' }],
      boss: { name: 'Seraph of Judgment', style: 'seraph' },
      drops: [['master-archer', 'agni', 'succubus'], ['high-lancer', 'freyja', 'vampire-countess'],
              ['greatsword-maiden', 'hermes', 'minotaur'], ['berserker', 'pegasus', 'chimera']],
      bossDrops: ['grand-sorcerer', 'xuanwu', 'medusa'],
      treasure: { name: 'Regalia of the Sanctum', reward: 'SSR',
        pieces: ['Cloud Key', 'Guardian\'s Plume', 'Lion\'s Mane', 'Oracle\'s Eye', 'Judgment Scale', 'Sanctum Seal'] } },
    { id: 4, name: 'The Shadow Marsh', faction: 'fallen', look: 'dark',
      enemies: [{ name: 'Marsh Harpy', style: 'sprite' }, { name: 'Bog Werewolf', style: 'beast' },
                { name: 'Drowned Banshee', style: 'mage' }, { name: 'Mire Ghoul', style: 'warrior' }],
      boss: { name: 'Hydra', style: 'dragon' },
      drops: [['squire', 'pixie', 'kobold'], ['crossbowman', 'cherub', 'harpy'],
              ['monk', 'unicorn', 'banshee'], ['shieldmaiden', 'muse', 'werewolf']],
      bossDrops: ['battle-cleric', 'thor', 'lich'],
      treasure: { name: 'Relics of the Marsh', reward: 'SR',
        pieces: ['Harpy Talon', 'Wolf Pelt', 'Banshee\'s Veil', 'Bog Lantern', 'Hydra Fang', 'Marsh Seal'] } },
    { id: 5, name: 'The Iron Citadel', faction: 'mortal', look: 'fire',
      enemies: [{ name: 'Citadel Guard', style: 'knight' }, { name: 'Crossbow Sentry', style: 'archer' },
                { name: 'War Mage', style: 'mage' }, { name: 'Pike Captain', style: 'lancer' }],
      boss: { name: 'Iron Warlord', style: 'warrior' },
      drops: [['ranger', 'muse', 'werewolf'], ['battle-cleric', 'thor', 'lich'],
              ['high-lancer', 'freyja', 'vampire-countess'], ['greatsword-maiden', 'hermes', 'minotaur']],
      bossDrops: ['beowulf', 'athena', 'cerberus'],
      treasure: { name: 'Arms of the Citadel', reward: 'SSR',
        pieces: ['Guard\'s Badge', 'Sentry Quiver', 'Mage\'s Codex', 'Captain\'s Pike', 'Warlord\'s Helm', 'Citadel Seal'] } }
  ];
  var STAGES_PER_CHAPTER = 5;

  // Balance knobs - change these to make the game easier or harder.
  var CONFIG = {
    startGems: 90,                   // enough for 3 single summons; earn more from first clears and level-ups
    startGold: 500,
    singlePullCost: 30,
    tenPullCost: 270,
    tenPullGuarantee: 'HR',          // every x10 summon includes at least one card of this rarity or better
    staminaRegenMs: 60 * 1000,       // 1 stamina per minute
    maxDeckSize: 5,
    maxEvo: 2,
    fuseGoldPerMaterial: 40,
    evolveGoldBase: 500,             // multiplied by (current evo + 1)
    firstClearGems: 30,
    firstClearBossGems: 100,
    dailyGems: 30,                   // the daily present on My Page
    dailyAmbrosia: 1,
    battleMaxRounds: 40,
    damagePerAtk: 0.2,               // each hit deals ATK x 0.2 (+/-10%) to the target's DEF
    expPerStamina: 1,                // quests give exp equal to the stamina spent, like the original
    skillChanceBySlot: [1, 0.8, 0.6, 0.4, 0.2], // chance each party slot's skill triggers
    factionSkillMult: 1.5,           // skills aimed at one faction are 1.5x stronger
    treasureDropChance: 0.2,         // chance a section's monster drops that section's treasure piece
    bossTreasureChance: 0.5,         // chance a boss drops treasure piece 5 or 6
    monstersPerSection: 3,           // monsters to beat before the chest opens
    monsterDropChance: 0.2,          // chance a defeated monster drops one of the section's cards
    chestCardChance: 0.75,           // chance the chest holds a card (otherwise extra gold), as in the original
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
    FACTIONS: FACTIONS, FACTION_ORDER: FACTION_ORDER, RARITIES: RARITIES, RARITY_ORDER: RARITY_ORDER,
    CARD_TYPES: CARD_TYPES, SKILL_KINDS: SKILL_KINDS, CARD_RENAMES: CARD_RENAMES,
    CARDS: CARDS, CARD_BY_ID: CARD_BY_ID, CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER, CONFIG: CONFIG
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  return api;
})();
