/*
 * Tests for the game rules. Run with:  node tests/game.test.js
 * (needs Node 18+, no other installs)
 */
'use strict';
var assert = require('assert');
var G = require('../js/game.js');
var D = require('../js/data.js');

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

console.log('Game data');
test('every card has a unique id, valid element and rarity', function () {
  var ids = {};
  D.CARDS.forEach(function (c) {
    assert(!ids[c.id], 'duplicate id ' + c.id); ids[c.id] = true;
    assert(D.ELEMENTS[c.element], 'bad element on ' + c.id);
    assert(D.RARITIES[c.rarity], 'bad rarity on ' + c.id);
  });
});
test('summon rates add up to 100', function () {
  var sum = 0;
  D.RARITY_ORDER.forEach(function (r) { sum += D.RARITIES[r].rate; });
  assert.strictEqual(sum, 100);
});
test('starter cards exist and fit the starting deck cost limit', function () {
  var s = G.newGame({ now: 0 });
  assert.strictEqual(s.cards.length, D.CONFIG.starterCards.length);
  assert(G.deckCost(s, s.deck) <= G.deckCostCap(s.level));
});

console.log('Stamina');
test('stamina regenerates over time and caps at max', function () {
  var s = G.newGame({ now: 0 });
  s.stamina = 0; s.staminaAt = 0;
  G.regenStamina(s, 5 * D.CONFIG.staminaRegenMs + 1000);
  assert.strictEqual(s.stamina, 5);
  G.regenStamina(s, 10000 * D.CONFIG.staminaRegenMs);
  assert.strictEqual(s.stamina, G.maxStamina(1));
});

console.log('Summoning');
test('single and ten summons cost gems and add cards', function () {
  var s = G.newGame({ now: 0 });
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
test('every 10-summon has at least one SR or better', function () {
  var rand = seeded(42);
  for (var i = 0; i < 500; i++) {
    var s = G.newGame({ now: 0 }); s.gems = 10000;
    var r = G.summon(s, 10, rand);
    var ok = r.cards.some(function (c) { var rar = D.CARD_BY_ID[c.cardId].rarity; return rar === 'SR' || rar === 'SSR'; });
    assert(ok, 'ten-pull without SR at iteration ' + i);
  }
});
test('observed single-summon rates are close to the published rates', function () {
  var rand = seeded(7), counts = { N: 0, R: 0, SR: 0, SSR: 0 }, n = 20000;
  var s = G.newGame({ now: 0 }); s.gems = 1e9;
  for (var i = 0; i < n; i++) {
    var r = G.summon(s, 1, rand);
    counts[D.CARD_BY_ID[r.cards[0].cardId].rarity]++;
  }
  D.RARITY_ORDER.forEach(function (rar) {
    var pct = counts[rar] / n * 100;
    assert(Math.abs(pct - D.RARITIES[rar].rate) < 1.5, rar + ' was ' + pct.toFixed(1) + '%');
  });
});

console.log('Deck');
test('deck rejects too many cards, duplicates, unknown cards and over-cost decks', function () {
  var s = G.newGame({ now: 0 });
  var big = [];
  for (var i = 0; i < 6; i++) { big.push(G.addCard(s, 'ember-imp').uid); }
  assert(!G.setDeck(s, big).ok);
  assert(!G.setDeck(s, [s.cards[0].uid, s.cards[0].uid]).ok);
  assert(!G.setDeck(s, [9999]).ok);
  var costly = [1, 2, 3].map(function () { return G.addCard(s, 'pyre-sovereign').uid; });
  var r = G.setDeck(s, costly); // 3 x 12 = 36 > 26
  assert(!r.ok && /over your limit/.test(r.error));
});

console.log('Fusion, evolution, selling');
test('fusing adds exp, uses materials, costs gold', function () {
  var s = G.newGame({ now: 0 });
  var base = G.addCard(s, 'ember-imp');
  var mat = G.addCard(s, 'ember-imp');
  var gold = s.gold;
  var r = G.fuse(s, base.uid, [mat.uid]);
  assert(r.ok);
  assert(r.gained > 0);
  assert.strictEqual(s.gold, gold - D.CONFIG.fuseGoldPerMaterial);
  assert(!G.findCard(s, mat.uid), 'material should be consumed');
  assert(base.level > 1 || base.exp > 0);
});
test('same-element materials give 1.5x exp', function () {
  var s = G.newGame({ now: 0 });
  var base = G.addCard(s, 'ember-imp');
  var same = G.addCard(s, 'ashen-duelist');
  var other = G.addCard(s, 'brook-sprite');
  var sameVal = G.fusePreview(s, base.uid, [same.uid]).exp;
  var otherVal = G.fusePreview(s, base.uid, [other.uid]).exp;
  // R (45) same element = 68, N (20) other element = 20
  assert.strictEqual(sameVal, 68); assert.strictEqual(otherVal, 20);
});
test('cannot fuse a deck card, itself, or past the level cap', function () {
  var s = G.newGame({ now: 0 });
  var base = G.addCard(s, 'ember-imp');
  assert(!G.fuse(s, base.uid, [s.deck[0]]).ok, 'deck card');
  assert(!G.fuse(s, base.uid, [base.uid]).ok, 'self');
  base.level = G.maxLevel(base);
  var mat = G.addCard(s, 'ember-imp');
  assert(!G.fuse(s, base.uid, [mat.uid]).ok, 'max level');
});
test('fusion stops at the level cap', function () {
  var s = G.newGame({ now: 0 }); s.gold = 1e6;
  var base = G.addCard(s, 'ember-imp');
  var mats = [];
  for (var i = 0; i < 40; i++) { mats.push(G.addCard(s, 'pyre-sovereign').uid); }
  var r = G.fuse(s, base.uid, mats);
  assert(r.ok);
  assert.strictEqual(base.level, G.maxLevel(base));
});
test('evolution needs max level and a second copy, then raises stats and cap', function () {
  var s = G.newGame({ now: 0 }); s.gold = 10000;
  var a = G.addCard(s, 'ember-imp'), b = G.addCard(s, 'ember-imp');
  assert(!G.evolve(s, a.uid, b.uid).ok, 'not max level yet');
  a.level = G.maxLevel(a);
  var before = G.cardStats(a);
  var wrong = G.addCard(s, 'brook-sprite');
  assert(!G.evolve(s, a.uid, wrong.uid).ok, 'wrong card as material');
  var r = G.evolve(s, a.uid, b.uid);
  assert(r.ok); assert.strictEqual(a.evo, 1);
  var after = G.cardStats(a);
  assert(after.atk > before.atk && after.maxLevel === before.maxLevel + 10);
  assert(!G.findCard(s, b.uid));
});
test('selling gives gold and removes the card', function () {
  var s = G.newGame({ now: 0 });
  var c = G.addCard(s, 'ember-imp'); var gold = s.gold;
  var r = G.sell(s, [c.uid]);
  assert(r.ok); assert.strictEqual(s.gold, gold + 20); assert(!G.findCard(s, c.uid));
  assert(!G.sell(s, [s.deck[0]]).ok, 'deck cards cannot be sold');
});

console.log('Battles');
test('element advantage works both ways', function () {
  assert.strictEqual(G.elementMult('fire', 'wind'), 1.5);
  assert.strictEqual(G.elementMult('wind', 'fire'), 0.75);
  assert.strictEqual(G.elementMult('light', 'dark'), 1.5);
  assert.strictEqual(G.elementMult('fire', 'fire'), 1);
});
test('stages unlock in order', function () {
  var s = G.newGame({ now: 0 });
  assert(G.isUnlocked(s, '1-1')); assert(!G.isUnlocked(s, '1-2'));
  s.cleared['1-1'] = true; assert(G.isUnlocked(s, '1-2'));
  assert(!G.isUnlocked(s, '2-1')); s.cleared['1-5'] = true; assert(G.isUnlocked(s, '2-1'));
});
test('a strong team beats stage 1-1 and gets rewards, stamina and first-clear gems', function () {
  var s = G.newGame({ now: 0 });
  var gems = s.gems, gold = s.gold, stamina = s.stamina;
  var r = G.playStage(s, '1-1', seeded(3), 0);
  assert(r.ok && r.win, 'starter team should win 1-1');
  assert(s.gold > gold); assert.strictEqual(s.gems, gems + D.CONFIG.firstClearGems);
  assert.strictEqual(s.stamina, stamina - G.getStage('1-1').staminaCost);
  assert(s.cleared['1-1']);
  assert(r.rewards.card && G.findCard(s, r.rewards.card.uid));
  var again = G.playStage(s, '1-1', seeded(4), 0);
  assert.strictEqual(s.gems, gems + D.CONFIG.firstClearGems, 'no gems on a repeat clear');
  assert(again.ok);
});
test('a loss costs no stamina and gives no rewards', function () {
  var s = G.newGame({ now: 0 });
  s.cleared['1-1'] = s.cleared['1-2'] = s.cleared['1-3'] = s.cleared['1-4'] = true;
  var stamina = s.stamina, gold = s.gold, cards = s.cards.length;
  var r = G.playStage(s, '1-5', seeded(5), 0); // boss: the starter deck is too weak
  assert(r.ok && !r.win);
  assert.strictEqual(s.stamina, stamina); assert.strictEqual(s.gold, gold); assert.strictEqual(s.cards.length, cards);
});
test('cannot fight a locked stage, with an empty deck, or without stamina', function () {
  var s = G.newGame({ now: 0 });
  assert(!G.playStage(s, '1-2', seeded(1), 0).ok);
  s.stamina = 0; s.staminaAt = 0;
  assert(!G.playStage(s, '1-1', seeded(1), 0).ok);
  s.stamina = 20; s.deck = [];
  assert(!G.playStage(s, '1-1', seeded(1), 0).ok);
});
test('levelling up refills stamina and grants gems', function () {
  var s = G.newGame({ now: 0 });
  s.exp = G.expToNext(1) - 1; s.stamina = 3;
  var gems = s.gems;
  var r = G.playStage(s, '1-1', seeded(3), 0);
  assert(r.ok && r.win && r.rewards.levelsGained >= 1);
  assert.strictEqual(s.level, 2); assert.strictEqual(s.stamina, G.maxStamina(2));
  assert(s.gems > gems);
});
test('the whole game is winnable with a maxed team', function () {
  var s = G.newGame({ now: 0 }); s.level = 30;
  s.cards = []; s.deck = [];
  ['pyre-sovereign', 'halo-seraph', 'abyss-knight', 'cyclone-dancer', 'night-sorceress'].forEach(function (id) {
    var c = G.addCard(s, id); c.level = 40; c.evo = 2; s.deck.push(c.uid);
  });
  G.STAGES.forEach(function (st) {
    s.stamina = 80;
    var r = G.playStage(s, st.id, seeded(11), 0);
    assert(r.ok && r.win, 'should win ' + st.id);
  });
});

console.log('Saving');
test('save and load round-trips, and bad saves are rejected', function () {
  var s = G.newGame({ now: 0 });
  G.summon(s, 10, seeded(9));
  var back = G.deserialize(G.serialize(s));
  assert.deepStrictEqual(back.cards, s.cards);
  assert.strictEqual(back.gems, s.gems);
  assert.strictEqual(G.deserialize('not json'), null);
  assert.strictEqual(G.deserialize('{"hello":1}'), null);
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
