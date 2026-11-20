/*
 * Tests for the game rules. Run with:  node tests/game.test.js
 * (needs Node 18+, no other installs)
 */
'use strict';
var assert = require('assert');
var G = require('../js/game.js');
var D = require('../js/data.js');
var Art = require('../js/art.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

// A predictable random number generator so tests give the same result every run.
function seeded(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A game state with a team strong enough to win any stage.
function strongState() {
  var s = G.newGame({ now: 0 }); s.level = 30; s.stamina = 100; s.attr.atk = 60;
  s.cards = []; s.deck = [];
  ['tiamat', 'halo-seraph', 'medusa', 'xuanwu', 'night-sorceress'].forEach(function (id) {
    var c = G.addCard(s, id); c.level = 40; c.evo = 2; s.deck.push(c.uid);
  });
  return s;
}

var HUMAN_STYLES = ['archer', 'knight', 'mage', 'warrior', 'lancer'];

console.log('Game data');
test('every card has a unique id, valid faction, rarity, type, look and art style', function () {
  var ids = {};
  D.CARDS.forEach(function (c) {
    assert(!ids[c.id], 'duplicate id ' + c.id); ids[c.id] = true;
    assert(D.FACTIONS[c.faction], 'bad faction on ' + c.id);
    assert(D.RARITIES[c.rarity], 'bad rarity on ' + c.id);
    assert(D.CARD_TYPES[c.type], 'bad type on ' + c.id);
    assert(c.look && c.style, 'missing art on ' + c.id);
  });
});
test('rarities follow the original: N, HN, R, HR, SR, SSR, Legend, and summon rates add up to 100', function () {
  assert.deepStrictEqual(D.RARITY_ORDER, ['N', 'HN', 'R', 'HR', 'SR', 'SSR', 'L']);
  var sum = 0;
  D.RARITY_ORDER.forEach(function (r) { sum += D.RARITIES[r].rate; });
  assert(Math.abs(sum - 100) < 1e-9, 'rates sum to ' + sum);
});
test('there are three factions of 14 cards, each with a card at every rarity', function () {
  assert.deepStrictEqual(Object.keys(D.FACTIONS).sort(), ['fallen', 'immortal', 'mortal']);
  D.FACTION_ORDER.forEach(function (f) {
    var mine = D.CARDS.filter(function (c) { return c.faction === f; });
    assert.strictEqual(mine.length, 14, f + ' has ' + mine.length + ' cards');
    D.RARITY_ORDER.forEach(function (r) {
      assert(mine.some(function (c) { return c.rarity === r; }), f + ' has no ' + r + ' card');
    });
  });
});
test('Mortal cards are all human; dragons are only Immortal (celestial) or Fallen (chaos)', function () {
  D.CARDS.forEach(function (c) {
    if (c.faction === 'mortal') { assert(HUMAN_STYLES.indexOf(c.style) !== -1, c.id + ' is Mortal but drawn as ' + c.style); }
    if (c.style === 'serpent') { assert.strictEqual(c.faction, 'immortal', c.id); }
    if (c.style === 'dragon') { assert.strictEqual(c.faction, 'fallen', c.id); }
    if (c.style === 'seraph') { assert.strictEqual(c.faction, 'immortal', c.id); }
    if (c.style === 'tyrant') { assert.strictEqual(c.faction, 'fallen', c.id); }
  });
  assert(D.CARDS.some(function (c) { return c.faction === 'immortal' && c.style === 'serpent'; }));
  assert(D.CARDS.some(function (c) { return c.faction === 'fallen' && c.style === 'dragon'; }));
  D.CHAPTERS.forEach(function (ch) {
    if (ch.faction === 'mortal') {
      ch.enemies.concat([ch.boss]).forEach(function (e) { assert(HUMAN_STYLES.indexOf(e.style) !== -1, e.name + ' should be human'); });
    }
  });
});
test('attack-type cards lean to ATK and defense-type cards lean to DEF', function () {
  var atk = D.CARD_BY_ID['master-archer'], def = D.CARD_BY_ID['captain']; // both Mortal R
  assert(atk.atk > def.atk && def.hp > atk.hp);
});
test('picking an alignment gives a starter pack of exactly one champion of that faction', function () {
  D.FACTION_ORDER.forEach(function (f) {
    var s = G.newGame({ now: 0, alignment: f });
    assert.strictEqual(s.alignment, f);
    assert.strictEqual(s.cards.length, 1, 'start with a single card, not a full squad');
    var champ = D.CARD_BY_ID[s.cards[0].cardId];
    assert.strictEqual(champ.faction, f);
    assert.deepStrictEqual(s.deck, [s.cards[0].uid]);
    assert(G.deckCost(s, s.deck) <= G.deckCostCap(s), 'champion must fit the starting ATK PWR');
  });
  assert.strictEqual(G.newGame({ now: 0 }).alignment, null, 'no alignment until the player picks one');
});

console.log('Placeholder art');
test('every card and enemy gets a clean SVG drawing', function () {
  D.CARDS.forEach(function (c) {
    var svg = Art.card(c);
    assert(svg.indexOf('<svg') === 0 && /<\/svg>$/.test(svg), c.id + ' is not an svg');
    assert(!/NaN|undefined/.test(svg), c.id + ' has NaN/undefined in its drawing');
  });
  G.STAGES.forEach(function (st) {
    G.stageEnemies(st, 1).forEach(function (e) {
      var svg = Art.enemy(e);
      assert(svg.indexOf('<svg') === 0 && !/NaN|undefined/.test(svg), e.name + ' drawing is broken');
    });
  });
});
test('different cards get different drawings, and the same style differs by faction', function () {
  assert.notStrictEqual(Art.card(D.CARD_BY_ID['imp']), Art.card(D.CARD_BY_ID['sylph']));
  assert.notStrictEqual(Art.card(D.CARD_BY_ID['captain']), Art.card(D.CARD_BY_ID['shield-angel']));
  var human = Art.render({ id: 'x', element: 'light', style: 'knight', rarity: 'R', faction: 'mortal' });
  var god = Art.render({ id: 'x', element: 'light', style: 'knight', rarity: 'R', faction: 'immortal' });
  var demon = Art.render({ id: 'x', element: 'light', style: 'knight', rarity: 'R', faction: 'fallen' });
  assert(human !== god && god !== demon && human !== demon);
});

console.log('Stamina');
test('stamina regenerates over time and caps at max', function () {
  var s = G.newGame({ now: 0 });
  s.stamina = 0; s.staminaAt = 0;
  G.regenStamina(s, 5 * D.CONFIG.staminaRegenMs + 1000);
  assert.strictEqual(s.stamina, 5);
  G.regenStamina(s, 10000 * D.CONFIG.staminaRegenMs);
  assert.strictEqual(s.stamina, G.staminaCap(s));
});

console.log('Summoning');
test('single and ten summons cost gems and add cards', function () {
  var s = G.newGame({ now: 0 });
  s.gems = 1000;
  var gems = s.gems, cards = s.cards.length, rand = seeded(1);
  var r1 = G.summon(s, 1, rand);
  assert(r1.ok); assert.strictEqual(s.gems, gems - D.CONFIG.singlePullCost); assert.strictEqual(s.cards.length, cards + 1);
  var r10 = G.summon(s, 10, rand);
  assert(r10.ok); assert.strictEqual(r10.cards.length, 10);
  assert.strictEqual(s.cards.length, cards + 11);
});
test('cannot summon without enough gems', function () {
  var s = G.newGame({ now: 0 }); s.gems = 5;
  var r = G.summon(s, 1, seeded(1));
  assert(!r.ok); assert.strictEqual(s.gems, 5);
});
test('every 10-summon has at least one card of the guaranteed rarity or better', function () {
  var rand = seeded(42), min = D.RARITY_ORDER.indexOf(D.CONFIG.tenPullGuarantee);
  for (var i = 0; i < 500; i++) {
    var s = G.newGame({ now: 0 }); s.gems = 10000;
    var r = G.summon(s, 10, rand);
    var ok = r.cards.some(function (c) { return D.RARITY_ORDER.indexOf(D.CARD_BY_ID[c.cardId].rarity) >= min; });
    assert(ok, 'ten-pull without ' + D.CONFIG.tenPullGuarantee + '+ at iteration ' + i);
  }
});
test('observed single-summon rates are close to the published rates', function () {
  var rand = seeded(7), counts = {}, n = 30000;
  D.RARITY_ORDER.forEach(function (r) { counts[r] = 0; });
  var s = G.newGame({ now: 0 }); s.gems = 1e9;
  for (var i = 0; i < n; i++) {
    var r = G.summon(s, 1, rand);
    counts[D.CARD_BY_ID[r.cards[0].cardId].rarity]++;
  }
  D.RARITY_ORDER.forEach(function (rar) {
    var pct = counts[rar] / n * 100;
    assert(Math.abs(pct - D.RARITIES[rar].rate) < 1.2, rar + ' was ' + pct.toFixed(2) + '%');
  });
});

console.log('Deck');
test('deck rejects too many cards, duplicates, unknown cards and over-cost decks', function () {
  var s = G.newGame({ now: 0 });
  var big = [];
  for (var i = 0; i < 6; i++) { big.push(G.addCard(s, 'imp').uid); }
  assert(!G.setDeck(s, big).ok);
  assert(!G.setDeck(s, [s.cards[0].uid, s.cards[0].uid]).ok);
  assert(!G.setDeck(s, [9999]).ok);
  var costly = [1, 2, 3].map(function () { return G.addCard(s, 'tiamat').uid; });
  var r = G.setDeck(s, costly); // 3 x 12 = 36 > starting ATK PWR of 12
  assert(!r.ok && /ATK PWR/.test(r.error));
});
test('bestDeck picks a legal, strong party', function () {
  var s = G.newGame({ now: 0 });
  G.addCard(s, 'tiamat');
  var picked = G.bestDeck(s);
  assert(picked.length <= D.CONFIG.maxDeckSize);
  assert(G.deckCost(s, picked) <= G.deckCostCap(s));
  assert(G.setDeck(s, picked).ok);
});

console.log('Fusion, evolution, selling');
test('fusing adds exp, uses materials, costs gold', function () {
  var s = G.newGame({ now: 0 });
  var base = G.addCard(s, 'imp');
  var mat = G.addCard(s, 'imp');
  var gold = s.gold;
  var r = G.fuse(s, base.uid, [mat.uid]);
  assert(r.ok);
  assert(r.gained > 0);
  assert.strictEqual(s.gold, gold - D.CONFIG.fuseGoldPerMaterial);
  assert(!G.findCard(s, mat.uid), 'material should be consumed');
  assert(base.level > 1 || base.exp > 0);
});
test('same-faction materials give 1.5x exp', function () {
  var s = G.newGame({ now: 0 });
  var base = G.addCard(s, 'imp');
  var same = G.addCard(s, 'succubus');   // Fallen R
  var other = G.addCard(s, 'sylph');     // Immortal N
  // R (45) same faction = 68, N (20) other faction = 20
  assert.strictEqual(G.fusePreview(s, base.uid, [same.uid]).exp, 68);
  assert.strictEqual(G.fusePreview(s, base.uid, [other.uid]).exp, 20);
});
test('cannot fuse a deck card, itself, or past the level cap', function () {
  var s = G.newGame({ now: 0 });
  var base = G.addCard(s, 'imp');
  assert(!G.fuse(s, base.uid, [s.deck[0]]).ok, 'deck card');
  assert(!G.fuse(s, base.uid, [base.uid]).ok, 'self');
  base.level = G.maxLevel(base);
  var mat = G.addCard(s, 'imp');
  assert(!G.fuse(s, base.uid, [mat.uid]).ok, 'max level');
});
test('fusion stops at the level cap', function () {
  var s = G.newGame({ now: 0 }); s.gold = 1e6;
  var base = G.addCard(s, 'imp');
  var mats = [];
  for (var i = 0; i < 40; i++) { mats.push(G.addCard(s, 'tiamat').uid); }
  var r = G.fuse(s, base.uid, mats);
  assert(r.ok);
  assert.strictEqual(base.level, G.maxLevel(base));
});
test('evolution needs max level and a second copy, then raises stats and cap', function () {
  var s = G.newGame({ now: 0 }); s.gold = 10000;
  var a = G.addCard(s, 'imp'), b = G.addCard(s, 'imp');
  assert(!G.evolve(s, a.uid, b.uid).ok, 'not max level yet');
  a.level = G.maxLevel(a);
  var before = G.cardStats(a);
  var wrong = G.addCard(s, 'sylph');
  assert(!G.evolve(s, a.uid, wrong.uid).ok, 'wrong card as material');
  var r = G.evolve(s, a.uid, b.uid);
  assert(r.ok); assert.strictEqual(a.evo, 1);
  var after = G.cardStats(a);
  assert(after.atk > before.atk && after.maxLevel === before.maxLevel + 10);
  assert(!G.findCard(s, b.uid));
});
test('selling gives gold and removes the card', function () {
  var s = G.newGame({ now: 0 });
  var c = G.addCard(s, 'imp'); var gold = s.gold;
  var r = G.sell(s, [c.uid]);
  assert(r.ok); assert.strictEqual(s.gold, gold + 20); assert(!G.findCard(s, c.uid));
  assert(!G.sell(s, [s.deck[0]]).ok, 'deck cards cannot be sold');
});

console.log('Factions and alignment');
test('factions lean the way the original realms did: Fallen ATK, Immortal DEF, Mortal cheaper', function () {
  var F = D.FACTIONS;
  assert(F.fallen.atkMod > F.mortal.atkMod && F.mortal.atkMod > F.immortal.atkMod);
  assert(F.immortal.hpMod > F.mortal.hpMod && F.mortal.hpMod > F.fallen.hpMod);
  assert.strictEqual(D.CARD_BY_ID['master-archer'].cost, D.RARITIES.R.cost - 1); // Mortal R
  assert.strictEqual(D.CARD_BY_ID['succubus'].cost, D.RARITIES.R.cost);        // Fallen R
});
test('there is no damage weakness: a hit only depends on the attacker\'s ATK', function () {
  var a = [{ name: 'A', faction: 'fallen', atk: 100, hp: 1000, maxHp: 1000 }];
  var b = [{ name: 'B', faction: 'mortal', atk: 1, hp: 1000, maxHp: 1000 }];
  var r = G.simulateBattle(a, b, function () { return 0.5; });
  var hit = r.events.filter(function (e) { return e.t === 'hit' && e.side === 'p'; })[0];
  assert.strictEqual(hit.dmg, Math.round(100 * D.CONFIG.damagePerAtk));
});
test('cards matching your alignment get the alignment bonus; others do not', function () {
  var s = G.newGame({ now: 0, alignment: 'fallen' });
  s.cards = []; s.deck = [];
  var f = G.addCard(s, 'wraith-knight'), m = G.addCard(s, 'captain'), x = G.addCard(s, 'succubus');
  var team = G.buildTeam(s, [m.uid, f.uid, x.uid]); // mortal leader, then two fallen
  var sf = G.cardStats(f), sm = G.cardStats(m);
  assert(!team[0].aligned && team[1].aligned && team[2].aligned);
  assert.strictEqual(team[1].atk, Math.round(sf.atk * D.CONFIG.alignmentBonus));
  assert.strictEqual(team[1].maxHp, Math.round(sf.hp * D.CONFIG.alignmentBonus));
  assert.strictEqual(team[0].atk, Math.round(sm.atk * D.CONFIG.leaderMult));
  assert(G.setAlignment(s, 'mortal').ok);
  assert(G.buildTeam(s, [m.uid])[0].aligned);
  assert(!G.setAlignment(s, 'dragon').ok);
});
test('chapter enemies belong to the chapter\'s faction', function () {
  G.STAGES.forEach(function (st) {
    var ch = D.CHAPTERS[st.chapter - 1];
    G.stageEnemies(st, 1).forEach(function (e) { assert.strictEqual(e.faction, ch.faction); });
  });
});

console.log('Quests and battles');
test('sections unlock in order', function () {
  var s = G.newGame({ now: 0 });
  assert(G.isUnlocked(s, '1-1')); assert(!G.isUnlocked(s, '1-2'));
  s.cleared['1-1'] = true; assert(G.isUnlocked(s, '1-2'));
  assert(!G.isUnlocked(s, '2-1')); s.cleared['1-5'] = true; assert(G.isUnlocked(s, '2-1'));
});
test('as in the original, each section drops one card of each faction', function () {
  G.STAGES.forEach(function (st) {
    var ids = G.sectionDrops(st);
    assert.strictEqual(ids.length, 3, st.id);
    var factions = ids.map(function (id) { assert(D.CARD_BY_ID[id], 'unknown drop ' + id); return D.CARD_BY_ID[id].faction; });
    assert.deepStrictEqual(factions.slice().sort(), ['fallen', 'immortal', 'mortal'], st.id);
  });
});
test('cards won in a section are always from that section\'s drop list', function () {
  var s = strongState();
  for (var i = 0; i < 30; i++) {
    s.stamina = 100;
    var r = G.fight(s, '1-1', { rand: seeded(100 + i), now: 0 });
    r.rewards.cards.forEach(function (c) { assert(G.sectionDrops(G.getStage('1-1')).indexOf(c.cardId) !== -1, c.cardId); });
  }
});
test('a battle is recorded as replayable events that match the final result', function () {
  var s = G.newGame({ now: 0, alignment: 'fallen' });
  var r = G.fight(s, '1-1', { rand: seeded(3), now: 0 });
  assert(r.ok && r.win);
  var ev = r.events;
  assert.strictEqual(ev[ev.length - 1].t, 'end');
  assert.strictEqual(ev[ev.length - 1].win, r.win);
  var firstNonSkill = ev.filter(function (e) { return e.t !== 'skill'; })[0];
  assert.strictEqual(firstNonSkill.t, 'round', 'skills come first, then round 1');
  var hits = ev.filter(function (e) { return e.t === 'hit'; });
  assert(hits.length > 0);
  var hp = { p: r.units.player.map(function (u) { return u.maxHp; }), e: r.units.enemy.map(function (u) { return u.maxHp; }) };
  hits.forEach(function (h) {
    var side = h.side === 'p' ? 'e' : 'p';
    assert(hp[side][h.to] > 0, 'hit on an already defeated unit');
    hp[side][h.to] = Math.max(0, hp[side][h.to] - h.dmg);
    assert.strictEqual(hp[side][h.to], h.hp, 'event hp does not match replayed hp');
    assert.strictEqual(h.dead, h.hp === 0);
  });
  assert(hp.e.every(function (v) { return v === 0; }));
});
test('a section needs 3 monsters, then the chest opens and the section is cleared', function () {
  var s = G.newGame({ now: 0, alignment: 'mortal' });
  var gems = s.gems, gold = s.gold, stamina = s.stamina;
  var r1 = G.fight(s, '1-1', { rand: seeded(3), now: 0 });
  assert(r1.ok && r1.win);
  assert.strictEqual(r1.fightNo, 1); assert(!r1.rewards.chest); assert(!s.cleared['1-1']);
  assert(s.gold > gold); assert.strictEqual(s.stamina, stamina - 1);
  var r2 = G.fight(s, '1-1', { rand: seeded(4), now: 0 });
  assert.strictEqual(r2.fightNo, 2); assert(!r2.rewards.chest);
  var r3 = G.fight(s, '1-1', { rand: seeded(5), now: 0 });
  assert.strictEqual(r3.fightNo, 3);
  assert(r3.rewards.chest, 'chest should open on the 3rd monster');
  assert(r3.rewards.chestGold > 0);
  assert(r3.rewards.sectionCleared && s.cleared['1-1']);
  assert.strictEqual(r3.rewards.points, D.CONFIG.pointsPerSectionClear, 'first clear grants an attribute point');
  assert.strictEqual(r3.rewards.gems, D.CONFIG.firstClearGems);
  assert.strictEqual(s.gems, gems + D.CONFIG.firstClearGems);
  assert(G.isUnlocked(s, '1-2'));
});
test('replaying a cleared section cycles through the monsters again, with no repeat first-clear gems', function () {
  var s = strongState();
  for (var i = 0; i < 3; i++) { G.fight(s, '1-1', { rand: seeded(i + 10), now: 0 }); }
  var gems = s.gems;
  assert.strictEqual(G.sectionProgress(s, '1-1'), 0);
  var r = G.fight(s, '1-1', { rand: seeded(20), now: 0 });
  assert.strictEqual(r.fightNo, 1); assert(!r.rewards.firstClear); assert.strictEqual(s.gems, gems);
  G.fight(s, '1-1', { rand: seeded(21), now: 0 });
  var r3 = G.fight(s, '1-1', { rand: seeded(22), now: 0 });
  assert(r3.rewards.chest, 'a chest opens every 3rd monster when farming');
});
test('a loss costs no stamina, gives no rewards and does not move progress', function () {
  var s = G.newGame({ now: 0, alignment: 'mortal' });
  ['1-1', '1-2', '1-3', '1-4'].forEach(function (id) { s.cleared[id] = true; });
  var stamina = s.stamina, gold = s.gold, cards = s.cards.length;
  var r = G.fight(s, '1-5', { rand: seeded(5), now: 0 }); // the champion alone can't beat the boss
  assert(r.ok && !r.win && !r.rewards);
  assert.strictEqual(s.stamina, stamina); assert.strictEqual(s.gold, gold); assert.strictEqual(s.cards.length, cards);
  assert(!s.progress['1-5']);
});
test('beating a boss gives one of its drop cards, Ambrosia and big first-clear gems', function () {
  var s = strongState();
  ['1-1', '1-2', '1-3', '1-4'].forEach(function (id) { s.cleared[id] = true; });
  var gems = s.gems, cards = s.cards.length;
  var r = G.fight(s, '1-5', { rand: seeded(8), now: 0 });
  assert(r.ok && r.win);
  assert(r.rewards.chest && r.rewards.ambrosia === 1 && s.items.ambrosia === 1);
  assert(s.cards.length > cards, 'boss should drop a card');
  assert(D.CHAPTERS[0].bossDrops.indexOf(r.rewards.cards[0].cardId) !== -1);
  assert.strictEqual(s.gems, gems + D.CONFIG.firstClearBossGems);
  assert(G.isUnlocked(s, '2-1'));
});
test('Ambrosia refills stamina, and only when you have some and are not full', function () {
  var s = G.newGame({ now: 0 });
  assert(!G.useAmbrosia(s).ok, 'none owned');
  s.items.ambrosia = 1;
  assert(!G.useAmbrosia(s).ok, 'stamina already full');
  s.stamina = 2;
  assert(G.useAmbrosia(s).ok);
  assert.strictEqual(s.stamina, G.staminaCap(s)); assert.strictEqual(s.items.ambrosia, 0);
});
test('quests give 1 exp per stamina spent', function () {
  var s = strongState();
  ['1-1', '1-2', '1-3', '1-4', '1-5'].forEach(function (id) { s.cleared[id] = true; });
  var r = G.fight(s, '2-1', { rand: seeded(3), now: 0 });
  assert(r.win);
  assert.strictEqual(r.rewards.exp, G.getStage('2-1').staminaCost * D.CONFIG.expPerStamina);
  assert.strictEqual(D.CONFIG.expPerStamina, 1);
});
test('you can choose the party for a battle; bad parties are refused and change nothing', function () {
  var s = G.newGame({ now: 0, alignment: 'mortal' });
  var extra = G.addCard(s, 'imp');
  var chosen = [extra.uid, s.deck[0]];
  var r = G.fight(s, '1-1', { deck: chosen, rand: seeded(3), now: 0 });
  assert(r.ok);
  assert.deepStrictEqual(s.deck, chosen);
  assert.strictEqual(r.units.player.length, 2);
  assert.strictEqual(r.units.player[0].cardId, 'imp');
  var before = s.deck.slice();
  var bad = G.fight(s, '1-1', { deck: [9999], rand: seeded(3), now: 0 });
  assert(!bad.ok); assert.deepStrictEqual(s.deck, before);
});
test('the first card in the party is the leader and gets +20% ATK and DEF', function () {
  var s = G.newGame({ now: 0 });
  s.deck.push(G.addCard(s, 'imp').uid);
  var team = G.buildTeam(s, s.deck);
  var st = G.cardStats(G.findCard(s, s.deck[0]));
  assert(team[0].leader && !team[1].leader);
  assert.strictEqual(team[0].atk, Math.round(st.atk * D.CONFIG.leaderMult));
  assert.strictEqual(team[0].maxHp, Math.round(st.hp * D.CONFIG.leaderMult));
  assert.strictEqual(team[1].atk, G.cardStats(G.findCard(s, s.deck[1])).atk);
});
test('cannot fight a locked section, with an empty party, or without stamina', function () {
  var s = G.newGame({ now: 0 });
  assert(!G.fight(s, '1-2', { rand: seeded(1), now: 0 }).ok);
  s.stamina = 0; s.staminaAt = 0;
  assert(!G.fight(s, '1-1', { rand: seeded(1), now: 0 }).ok);
  s.stamina = 20; s.deck = [];
  assert(!G.fight(s, '1-1', { rand: seeded(1), now: 0 }).ok);
});
test('levelling up gives attribute points, refills stamina and grants gems', function () {
  var s = G.newGame({ now: 0, alignment: 'mortal' });
  s.exp = G.expToNext(1) - 1; s.stamina = 3;
  var gems = s.gems;
  var r = G.fight(s, '1-1', { rand: seeded(3), now: 0 });
  assert(r.ok && r.win && r.rewards.levelsGained >= 1);
  assert.strictEqual(s.level, 2); assert.strictEqual(s.stamina, G.staminaCap(s));
  assert.strictEqual(s.attrPoints, D.CONFIG.pointsPerLevel);
  assert(s.gems > gems);
});
test('attribute points raise max stamina or ATK PWR, and ATK PWR is the party cost limit', function () {
  var s = G.newGame({ now: 0, alignment: 'fallen' });
  assert(!G.spendPoint(s, 'atk').ok, 'no points yet');
  assert.strictEqual(G.deckCostCap(s), D.CONFIG.baseAtkPower);
  var a = G.addCard(s, 'succubus');           // cost 5; champion 8 + 5 = 13 > 12
  assert(!G.setDeck(s, [s.deck[0], a.uid]).ok, 'over ATK PWR');
  s.attrPoints = 2;
  var cap = G.staminaCap(s);
  assert(G.spendPoint(s, 'stamina').ok);
  assert.strictEqual(G.staminaCap(s), cap + D.CONFIG.staminaPerPoint);
  assert(G.spendPoint(s, 'atk').ok);
  assert.strictEqual(G.deckCostCap(s), D.CONFIG.baseAtkPower + D.CONFIG.atkPowerPerPoint);
  assert(G.setDeck(s, [s.deck[0], a.uid]).ok, 'fits after raising ATK PWR');
  assert.strictEqual(s.attrPoints, 0);
  assert(!G.spendPoint(s, 'hp').ok, 'DEF PWR is not an attribute yet');
  assert(!G.spendPoint(s, 'bogus').ok);
});
test('the whole game is winnable with a maxed team', function () {
  var s = strongState();
  G.STAGES.forEach(function (st) {
    for (var i = 0; i < st.monsters; i++) {
      s.stamina = 100;
      var r = G.fight(s, st.id, { rand: seeded(11 + i), now: 0 });
      assert(r.ok && r.win, 'should win ' + st.id + ' fight ' + (i + 1));
    }
    assert(s.cleared[st.id], st.id + ' should be cleared');
  });
});

console.log('Card skills');
test('every card has a skill worded like the original, with a readable number', function () {
  D.CARDS.forEach(function (c) {
    assert(D.SKILL_KINDS[c.skill.kind], c.id + ' has unknown skill kind ' + c.skill.kind);
    assert(['atk', 'def', 'both'].indexOf(c.skill.stat) !== -1, c.id + ' has a bad skill stat');
    assert(c.skill.target === 'all' || D.FACTIONS[c.skill.target], c.id + ' has a bad skill target');
    assert(/^(Small|Medium|Big|Great|Massive|Absolute) (Boost to|Hit to Foes) /.test(G.skillTitle(c)), G.skillTitle(c));
    assert(G.skillPct(c) > 0 && /\d+%/.test(G.skillText(c)));
  });
  assert.strictEqual(G.skillTitle(D.CARD_BY_ID['master-archer']), 'Medium Hit to Foes Defense (All)');
  assert.strictEqual(G.skillTitle(D.CARD_BY_ID['tiamat']), 'Massive Boost to Fallen Attack');
});
test('the slot 1 skill always triggers; slots further back trigger less often', function () {
  var counts = [0, 0, 0, 0, 0], n = 3000, rand = seeded(77);
  var s = G.newGame({ now: 0, alignment: 'mortal' });
  s.cards = []; s.deck = [];
  for (var k = 0; k < 5; k++) { s.deck.push(G.addCard(s, 'alchemist').uid); }
  for (var i = 0; i < n; i++) {
    var team = G.buildTeam(s, s.deck), foes = G.stageEnemies(G.getStage('1-1'), 1);
    G.applySkills(team, foes, rand).forEach(function (e) { counts[e.from]++; });
  }
  assert.strictEqual(counts[0], n, 'slot 1 must always trigger');
  D.CONFIG.skillChanceBySlot.forEach(function (p, i) {
    assert(Math.abs(counts[i] / n - p) < 0.04, 'slot ' + (i + 1) + ' triggered ' + (counts[i] / n).toFixed(2));
  });
});
test('boosts only help the named faction; hits weaken all foes or only the named faction', function () {
  var s = G.newGame({ now: 0, alignment: 'fallen' });
  s.cards = []; s.deck = [];
  var goblin = G.addCard(s, 'goblin'), human = G.addCard(s, 'village-archer');
  var team = G.buildTeam(s, [goblin.uid, human.uid]);           // Ambush: boost to Fallen Attack
  var before = team.map(function (u) { return u.atk; });
  G.applySkills(team, G.stageEnemies(G.getStage('1-1'), 1), function () { return 0.99; }); // only slot 1 triggers
  var pct = G.skillPct(D.CARD_BY_ID['goblin']) / 100;
  assert.strictEqual(team[0].atk, Math.round(before[0] * (1 + pct)), 'Fallen ally gets the boost');
  assert.strictEqual(team[1].atk, before[1], 'Mortal ally does not');

  var t = G.newGame({ now: 0 }); t.cards = []; t.deck = [];
  var archer = G.addCard(t, 'master-archer');                     // Hit to Foes Defense (All)
  var foes = G.stageEnemies(G.getStage('1-1'), 1), def0 = foes[0].maxHp;
  G.applySkills(G.buildTeam(t, [archer.uid]), foes, function () { return 0.5; });
  assert.strictEqual(foes[0].maxHp, Math.round(def0 * (1 - G.skillPct(D.CARD_BY_ID['master-archer']) / 100)));

  var maiden = G.addCard(t, 'greatsword-maiden');                 // Hit to Foes Fallen Defense
  var mortalFoes = G.stageEnemies(G.getStage('1-1'), 1), m0 = mortalFoes[0].maxHp;
  G.applySkills(G.buildTeam(t, [maiden.uid]), mortalFoes, function () { return 0.5; });
  assert.strictEqual(mortalFoes[0].maxHp, m0, 'a Fallen-only hit leaves Mortal foes alone');
  var fallenFoes = G.stageEnemies(G.getStage('2-1'), 1), f0 = fallenFoes[0].maxHp;
  G.applySkills(G.buildTeam(t, [maiden.uid]), fallenFoes, function () { return 0.5; });
  assert(fallenFoes[0].maxHp < f0, 'but weakens Fallen foes');
});
test('faction-only skills are stronger than skills for everyone', function () {
  assert(G.skillPct(D.CARD_BY_ID['berserker']) > G.skillPct(D.CARD_BY_ID['minotaur'])); // both HR ATK boosts
});

console.log('Treasure');
test('a section drops its own treasure piece; the boss drops piece 5 or 6', function () {
  var s = strongState();
  var r = G.fight(s, '1-1', { rand: function () { return 0.01; }, now: 0 }); // every roll succeeds
  assert(r.win && r.rewards.treasure);
  assert.strictEqual(r.rewards.treasure.piece, 0);
  assert.strictEqual(r.rewards.treasure.name, D.CHAPTERS[0].treasure.pieces[0]);
  assert.deepStrictEqual(G.stagePieces(G.getStage('1-3')), [2]);
  assert.deepStrictEqual(G.stagePieces(G.getStage('1-5')), [4, 5]);
});
test('a full set can be claimed for a card of the set\'s reward rarity', function () {
  var s = G.newGame({ now: 0 });
  assert(!G.claimTreasure(s, 1).ok, 'not complete yet');
  s.treasure['1'] = [1, 1, 1, 1, 1, 2];
  assert(G.treasureComplete(s, 1));
  var cards = s.cards.length;
  var r = G.claimTreasure(s, 1, seeded(4));
  assert(r.ok && D.CARD_BY_ID[r.card.cardId].rarity === D.CHAPTERS[0].treasure.reward);
  assert.strictEqual(s.cards.length, cards + 1);
  assert.deepStrictEqual(s.treasure['1'], [0, 0, 0, 0, 0, 1]);
  assert(!G.claimTreasure(s, 1).ok, 'set used up');
  assert.strictEqual(D.CHAPTERS[2].treasure.reward, 'SSR');
});

console.log('Saving');
test('save and load round-trips, and bad saves are rejected', function () {
  var s = G.newGame({ now: 0, alignment: 'immortal' });
  s.gems = 1000;
  G.summon(s, 10, seeded(9));
  G.fight(s, '1-1', { rand: seeded(2), now: 0 });
  s.attr.atk = 2; s.items.ambrosia = 3; s.treasure['2'] = [1, 0, 2, 0, 0, 0];
  var back = G.deserialize(G.serialize(s));
  assert.deepStrictEqual(back.cards, s.cards);
  assert.deepStrictEqual(back.progress, s.progress);
  assert.deepStrictEqual(back.attr, s.attr);
  assert.strictEqual(back.items.ambrosia, 3);
  assert.deepStrictEqual(back.treasure['2'], [1, 0, 2, 0, 0, 0]);
  assert.strictEqual(back.alignment, 'immortal');
  assert.strictEqual(back.gems, s.gems);
  var odd = JSON.parse(G.serialize(s)); odd.alignment = 'dragon';
  assert.strictEqual(G.deserialize(JSON.stringify(odd)).alignment, null, 'unknown alignment is cleared so the game asks again');
  assert.strictEqual(G.deserialize('not json'), null);
  assert.strictEqual(G.deserialize('{"hello":1}'), null);
});
test('cards from the older roster are converted to their replacements, keeping level and party', function () {
  var s = G.newGame({ now: 0, alignment: 'fallen' });
  var old = JSON.parse(G.serialize(s));
  old.cards.push({ uid: 50, cardId: 'ember-imp', level: 7, exp: 3, evo: 1 });
  old.cards.push({ uid: 51, cardId: 'pyre-sovereign', level: 2, exp: 0, evo: 0 });
  old.deck = [50, 51];
  var back = G.deserialize(JSON.stringify(old));
  var a = back.cards.filter(function (c) { return c.uid === 50; })[0];
  var b = back.cards.filter(function (c) { return c.uid === 51; })[0];
  assert.strictEqual(a.cardId, 'imp'); assert.strictEqual(a.level, 7); assert.strictEqual(a.evo, 1);
  assert.strictEqual(b.cardId, 'tiamat');
  assert.deepStrictEqual(back.deck, [50, 51]);
  Object.keys(D.CARD_RENAMES).forEach(function (k) { assert(D.CARD_BY_ID[D.CARD_RENAMES[k]], k + ' maps to an unknown card'); });
});
test('saves from the first version (no progress/attributes/items) still load', function () {
  var s = G.newGame({ now: 0 });
  var old = JSON.parse(JSON.stringify(s));
  delete old.progress; delete old.attr; delete old.attrPoints; delete old.items; old.version = 1;
  old.cleared = { '1-1': true };
  var back = G.deserialize(JSON.stringify(old));
  assert(back);
  assert.deepStrictEqual(back.attr, { stamina: 0, atk: 0 });
  assert.strictEqual(back.items.ambrosia, 0);
  assert.deepStrictEqual(back.treasure, {});
  assert.strictEqual(back.attrPoints, 0);
  assert(back.cleared['1-1']);
  assert.strictEqual(back.alignment, null, 'old saves have no alignment yet; the game asks for one');
  assert(G.fight(back, '1-2', { rand: seeded(1), now: 0 }).ok, 'old save should be playable');
});
test('points that an older save spent on the removed DEF PWR are given back', function () {
  var s = G.newGame({ now: 0, alignment: 'mortal' });
  var old = JSON.parse(G.serialize(s));
  old.attr = { stamina: 1, atk: 2, hp: 3 }; old.attrPoints = 1;
  var back = G.deserialize(JSON.stringify(old));
  assert.deepStrictEqual(back.attr, { stamina: 1, atk: 2 });
  assert.strictEqual(back.attrPoints, 4);
});
test('Cure Water in an older save becomes Ambrosia', function () {
  var old = JSON.parse(G.serialize(G.newGame({ now: 0 })));
  old.items = { cureWater: 2 };
  var back = G.deserialize(JSON.stringify(old));
  assert.deepStrictEqual(back.items, { ambrosia: 2 });
});
test('loading drops unknown cards and keeps new uids unique', function () {
  var s = G.newGame({ now: 0 });
  s.cards.push({ uid: 500, cardId: 'does-not-exist', level: 1, exp: 0, evo: 0 });
  s.nextUid = 3; // stale counter
  var back = G.deserialize(JSON.stringify(s));
  assert(!back.cards.some(function (c) { return c.cardId === 'does-not-exist'; }));
  var maxUid = Math.max.apply(null, back.cards.map(function (c) { return c.uid; }));
  assert(back.nextUid > maxUid);
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));
