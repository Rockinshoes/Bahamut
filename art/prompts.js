/*
 * art/prompts.js - the descriptions the image AI uses to paint each card and enemy.
 *
 * A prompt = STYLE (the same for every card, so the set looks consistent)
 *          + the card's own SUBJECT below
 *          + automatic extras from the card's faction, rarity and colour scene.
 *
 * To change how a card is painted, edit its line in SUBJECTS and re-run the
 * "Generate card art" workflow for that card. To change the look of the whole set,
 * edit STYLE (and regenerate everything).
 *
 * Keep prompts describing a look in plain words. Do not name other games, studios or
 * artists: the art should be original.
 */
'use strict';

var D = require('../js/data.js');

// The shared look of the whole set.
var STYLE = [
  'Fantasy trading card illustration, painterly digital art in a polished anime-influenced style,',
  'one main character in a dynamic full-body pose, centered, filling most of the frame,',
  'highly detailed costume, armor and weapon, dramatic rim lighting and glowing magical effects,',
  'rich atmospheric background that matches the scene, depth and particles,',
  'portrait orientation, 3:4 aspect ratio.',
  'No text, no letters, no logo, no watermark, no card border or frame.'
].join(' ');

// How each faction should read at a glance (matches the game's art rules).
var FACTION_LOOK = {
  mortal: 'The character is an ordinary human being: no wings, no halo, no horns, no supernatural features on the body.',
  immortal: 'The character is divine or celestial: radiant, white and gold palette accents, holy light, angelic or godly presence.',
  fallen: 'The character is demonic or monstrous: menacing, dark palette with crimson or violet accents, sinister glow.'
};

// More spectacle for rarer cards.
var RARITY_LOOK = {
  N: 'Simple, modest equipment.',
  HN: 'Modest equipment with a few fine details.',
  R: 'Well-made equipment with ornamental details.',
  HR: 'Fine ornate equipment, confident heroic pose.',
  SR: 'Lavish ornate equipment, powerful pose, strong magical aura.',
  SSR: 'Legendary, awe-inspiring presence, spectacular magical aura and lighting.',
  L: 'Mythic, overwhelming presence, the most spectacular and ornate design in the set, blazing aura.'
};

// The colour scene of the card's background.
var LOOK_SCENE = {
  fire: 'Warm palette of orange, red and gold; embers in the air; volcanic or burning surroundings.',
  water: 'Cool palette of blue and aqua; flowing water, mist or sea; shafts of light.',
  wind: 'Fresh palette of green and teal; wind-blown leaves, forests or mountains, open sky.',
  light: 'Bright palette of white and gold; sunlight, clouds, temple columns, sparkling light.',
  dark: 'Night palette of deep purple and black; moonlight, gothic ruins, eerie glow.'
};

// One line per card: who they are and what they are doing.
var SUBJECTS = {
  // ---- Mortal (always human)
  'militia-spearman':  'A young village militia spearman in padded leather and a simple iron cap, holding a long spear and a round wooden shield, guarding a country road.',
  'village-archer':    'A village archer in a green hooded cloak drawing a longbow, quiver of arrows on her back, standing at the edge of a meadow.',
  'mercenary':         'A scarred sellsword mercenary in mismatched armor resting a heavy battle-axe on his shoulder, coin pouch at his belt.',
  'hedge-witch':       'A country hedge witch with a wide-brimmed hat and herb pouches, casting a glowing charm from a gnarled wooden staff.',
  'captain':           'A disciplined guard captain in steel plate with a crested helmet and a tower shield, raising a sword to rally troops.',
  'master-archer':     'A master archer in fitted leather armor loosing a glowing arrow from an ornate recurve bow, cloak swirling.',
  'alchemist':         'An alchemist in a long scholar\'s coat holding up a glowing flask, belts of potions and brass instruments.',
  'berserker':         'A towering bare-chested berserker with war paint and a fur mantle, roaring as he swings a huge double-bladed axe.',
  'high-lancer':       'An elite lancer in polished full plate with a pennant-tipped lance and a heraldic shield, standing firm.',
  'greatsword-maiden': 'A tall woman knight in blue and silver armor wielding an enormous two-handed greatsword, a demon hunter.',
  'flame-warden':      'A champion knight in gleaming steel armor with a flowing crimson cape, holding a flaming longsword and a star-emblazoned shield.',
  'grand-sorcerer':    'A grand sorcerer in an embroidered robe with a tall pointed hat, summoning a storm of arcane runes and lightning.',
  'achilles':          'Achilles, the legendary Greek hero, in bronze armor with a crested helmet, a long spear and a round bronze shield, mid-charge.',
  'squire':            'A young squire in a simple steel cap and padded tunic, holding a plain shield and a short sword, eager and earnest.',
  'crossbowman':       'A stocky crossbowman in a brigandine coat and kettle helm, aiming a heavy crossbow.',
  'monk':              'A wandering martial monk with a shaved head and simple robes tied at the waist, in a fighting stance, wooden staff on his back.',
  'shieldmaiden':      'A Norse shieldmaiden with braided hair, a painted round shield and a spear, standing on a rocky shore.',
  'ranger':            'A forest ranger in a dark green cloak drawing a bow, a hunting knife at the hip, eyes sharp.',
  'battle-cleric':     'A battle cleric in white and gold vestments over chainmail, raising a mace while holy light shines from her hand.',
  'beowulf':           'Beowulf, the hero of the Old English epic, a powerful bearded warrior in a boar-crested helm and mail, gripping a great sword.',
  'roland':            'Roland, the paladin of medieval French legend, in ornate plate armor, raising the shining sword Durendal and an ivory horn at his belt.',
  'siegfried':         'Siegfried, the dragon-slaying hero of Norse and Germanic legend, in heroic armor with a great sword, a slain dragon\'s scales at his feet.',

  // ---- Immortal (gods, angels, fairies, celestial beasts and dragons)
  'sylph':             'A tiny playful air sylph fairy with translucent dragonfly wings and a little halo, riding a swirl of wind.',
  'dryad':             'A gentle dryad goddess of the forest with bark-like skin patterns and leaves in her hair, holding a blooming staff.',
  'nymph':             'A water nymph with flowing aqua hair and a halo of droplets, rising from a spring with lotus flowers.',
  'shield-angel':      'A young angel knight with white feathered wings and a halo, holding up a radiant golden shield.',
  'agni':              'Agni, the Hindu god of fire, with crimson skin and a crown of flames, holding fire in his hands, riding heat waves.',
  'rhea':              'Rhea, the Greek mother goddess of the Titans, in flowing white robes and a golden crown, protective and serene.',
  'valkyrie-lancer':   'A valkyrie warrior maiden in winged golden armor with feathered wings and a halo, charging with a gleaming lance.',
  'pegasus':           'A majestic white winged horse, Pegasus, with feathered wings spread wide and a glowing mane, rearing in the clouds.',
  'freyja':            'Freyja, the Norse goddess of love and war, in a falcon-feather cloak with golden jewelry, casting protective magic.',
  'hermes':            'Hermes, the Greek messenger god, with a winged helmet and winged sandals, bow in hand, swift and mischievous.',
  'halo-seraph':       'A serene seraph with three pairs of luminous white wings, a blazing halo and white-gold robes, holding a holy sword point-down.',
  'xuanwu':            'Xuanwu, the Black Tortoise of Chinese mythology: a giant celestial tortoise entwined with a serpent, glowing shell patterns.',
  'qinglong':          'Qinglong, the Azure Dragon of Chinese mythology: a long wingless serpentine sky dragon with antlers and whiskers, coiling through clouds around a glowing pearl.',
  'pixie':             'A tiny mischievous pixie with gossamer wings and a halo, scattering glittering dust from her hands.',
  'cherub':            'A chubby little cherub with small white wings and a golden halo, holding a tiny bow.',
  'unicorn':           'A pure white unicorn with a spiral golden horn and a flowing silver mane, a faint halo of light.',
  'muse':              'A Greek muse in a flowing chiton playing a golden lyre, laurel wreath in her hair, notes of light around her.',
  'thor':              'Thor, the Norse thunder god, with a red beard and a winged helm, raising the hammer Mjolnir as lightning crackles.',
  'athena':            'Athena, the Greek goddess of wisdom and war, in a crested helmet and golden armor with a spear, an owl on her shoulder and the aegis shield.',
  'phoenix':           'A radiant phoenix, a great bird of fire with long tail feathers of flame, rising from its own ashes.',
  'zeus':              'Zeus, king of the Greek gods, with a white beard and a laurel crown, hurling a thunderbolt from the clouds of Olympus.',
  'odin':              'Odin, the Norse all-father, one-eyed with a long beard and winged helmet, spear Gungnir in hand, two ravens and a radiant halo of runes.',

  // ---- Fallen (demons, monsters, undead and chaos dragons)
  'goblin':            'A sneaky green-skinned goblin with big ears and a jagged dagger, grinning in a dark cave.',
  'imp':               'A small mischievous imp with bat wings, little horns and a spaded tail, juggling a ball of fire.',
  'ghoul-brute':       'A hulking pale ghoul brute with tattered clothes and a rusty cleaver, glowing eyes in a graveyard.',
  'hellhound':         'A black hellhound with burning red eyes and a flaming mane and tail, snarling on scorched ground.',
  'succubus':          'An elegant succubus with bat wings, curled horns and a long tail, in a dark gown, beckoning with violet magic.',
  'gargoyle':          'A stone gargoyle with craggy wings and horns, crouched on a gothic cathedral ledge under the moon.',
  'wraith-knight':     'A wraith knight in blackened spiked armor with a ghostly blue glow under the helmet, holding a cursed sword.',
  'chimera':           'A chimera: a lion with a goat head on its back and a serpent for a tail, breathing fire.',
  'vampire-countess':  'A vampire countess with pale skin, red eyes and a high-collared crimson gown, bat wings and a goblet of blood.',
  'minotaur':          'A massive minotaur with a bull\'s head and horns, swinging a giant labrys axe in a stone labyrinth.',
  'night-sorceress':   'A demon sorceress with curling horns, bat wings and a dark red robe, conjuring a sphere of violet magic beneath the moon.',
  'medusa':            'Medusa, the gorgon of Greek myth, with a crown of living snakes for hair and a petrifying glowing gaze.',
  'tiamat':            'Tiamat, the primordial chaos dragon of Babylonian myth: a colossal winged dragon with jagged horns and spines, breathing fire.',
  'kobold':            'A small scaly kobold with a lizard snout and a rusty scrap-metal blade, crouched in a mine tunnel.',
  'harpy':             'A harpy with feathered wings for arms and taloned bird feet, shrieking as she dives.',
  'banshee':           'A ghostly banshee with streaming white hair and a tattered gown, wailing, pale and translucent.',
  'werewolf':          'A snarling werewolf mid-transformation under the full moon, claws out, fur bristling.',
  'lich':              'A lich, a skeletal sorcerer king in rotting royal robes and a crown, holding a glowing phylactery.',
  'cerberus':          'Cerberus, the three-headed hound guarding the gates of the underworld, each head snarling with fire.',
  'jormungand':        'Jormungand, the vast world serpent of Norse myth, a colossal sea dragon rising from stormy waves.',
  'beelzebub':         'Beelzebub, a demon lord with insect-like wings and a crown of horns, enthroned amid swarms of flies and hellfire.',
  'asmodeus':          'Asmodeus, a demon king in black spiked armor with a crown of horns, vast bat wings and a burning greatsword, on a throne of shadows.'
};

// Chapter enemies (they appear in battle).
var ENEMY_SUBJECTS = {
  'Road Bandit':        'A rough road bandit with a hood and a heavy axe, ambushing travellers.',
  'Brigand Archer':     'A brigand archer in a dark hooded cloak aiming a bow from the trees.',
  'Renegade Knight':    'A renegade knight in battered armor with a torn tabard and a notched sword.',
  'Bramble Witch':      'A wild witch tangled in brambles, casting thorny green magic.',
  'Bandit King':        'A swaggering bandit king with a fur cloak, a crown of stolen gold and a great axe.',
  'Cave Goblin':        'A cave goblin with a torch and a crude spear, eyes glinting in the dark.',
  'Lava Hound':         'A hound made of cooling lava and magma cracks, molten drool dripping.',
  'Ash Ghoul':          'A ghoul covered in grey ash, embers smouldering in its wounds.',
  'Cinder Witch':       'A demonic witch with horns and a robe of burning cinders, hurling fire.',
  'Fafnir':             'Fafnir, the great dragon of Norse legend, coiled on a hoard of gold, breathing fire.',
  'Temple Sylph':       'A radiant little sylph guarding a sky temple, halo shining.',
  'Sanctum Guardian':   'A winged golden guardian knight of a celestial temple with a halo and a tower shield.',
  'Sacred Lion':        'A white-gold sacred lion with feathered wings and a halo of light.',
  'Oracle':             'A blindfolded oracle priestess in white robes with a halo, glowing visions around her.',
  'Marsh Harpy':        'A bedraggled harpy perched on a dead tree in a foggy swamp.',
  'Bog Werewolf':       'A mud-caked werewolf prowling through swamp reeds.',
  'Drowned Banshee':    'A drowned banshee rising from black water, hair dripping.',
  'Mire Ghoul':         'A hulking ghoul draped in swamp weeds, dragging a rusted chain.',
  'Hydra':              'The Hydra, a many-headed serpent dragon of Greek myth, rising from a dark marsh.',
  'Citadel Guard':      'A heavily armored citadel guard with a halberd at an iron gate.',
  'Crossbow Sentry':    'A crossbow sentry on a castle wall walkway, bolt loaded.',
  'War Mage':           'A stern war mage in a soldier\'s coat, conjuring fire.',
  'Pike Captain':       'A pike captain in half-plate leading a formation, pike lowered.',
  'Iron Warlord':       'A towering human warlord in blackened iron armor with a great axe, on a fortress throne.',
  'Seraph of Judgment': 'A towering seraph of judgment with six radiant wings and a blazing sword, stern and terrible.'
};

function cardPrompt(def) {
  return [
    STYLE,
    'Subject: ' + (SUBJECTS[def.id] || def.name + '.'),
    FACTION_LOOK[def.faction],
    RARITY_LOOK[def.rarity],
    'Background: ' + LOOK_SCENE[def.look]
  ].join(' ');
}

function enemyPrompt(name, chapter, boss) {
  return [
    STYLE,
    'Subject: ' + (ENEMY_SUBJECTS[name] || name + '.'),
    FACTION_LOOK[chapter.faction],
    boss ? RARITY_LOOK.SSR : RARITY_LOOK.R,
    'Background: ' + LOOK_SCENE[chapter.look]
  ].join(' ');
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// Every picture the game can use: { id (file name), kind, name, prompt }.
// Card files: assets/cards/<card-id>.webp. Enemy files: assets/cards/foe-<enemy-name>.webp.
function allJobs() {
  var jobs = D.CARDS.map(function (c) {
    return { id: c.id, kind: 'card', name: c.name, prompt: cardPrompt(c) };
  });
  D.CHAPTERS.forEach(function (ch) {
    ch.enemies.concat([ch.boss]).forEach(function (e) {
      jobs.push({ id: 'foe-' + slug(e.name), kind: 'enemy', name: e.name, prompt: enemyPrompt(e.name, ch, e === ch.boss) });
    });
  });
  return jobs;
}

module.exports = { STYLE: STYLE, SUBJECTS: SUBJECTS, ENEMY_SUBJECTS: ENEMY_SUBJECTS, cardPrompt: cardPrompt, enemyPrompt: enemyPrompt, allJobs: allJobs, slug: slug };
