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
  ['pyre-sovereign', 'halo-seraph', 'abyss-knight', 'cyclone-dancer', 'night-sorceress'].forEach(function (id) {
    var c = G.addCard(s, id); c.level = 40; c.evo = 2; s.deck.push(c.uid);
  });
  return s;
}

console.log('Game data');
test('every card has a unique id, valid faction, rarity and art style', function () {
  var ids = {};
  D.CARDS.forEach(function (c) {
    assert(!ids[c.id], 'duplicate id ' + c.id); ids[c.id] = true;
    assert(D.FACTIONS[c.faction], 'bad faction on ' + c.id);
    assert(c.look, 'missing art look on ' + c.id);
    assert(D.RARITIES[c.rarity], 'bad rarity on ' + c.id);
    assert(c.style, 'missing art style on ' + c.id);
  });
});
test('summon rates add up to 100', function () {
  var sum = 0;
  D.RARITY_ORDER.forEach(function (r) { sum += D.RARITIES[r].rate; });
  assert.strictEqual(sum, 100);
});
test('there are exactly three factions and each has N, R, SR and SSR cards', function () {
  assert.deepStrictEqual(Object.keys(D.FACTIONS).sort(), ['fallen', 'immortal', 'mortal']);
  D.FACTION_ORDER.forEach(function (f) {
    D.RARITY_ORDER.forEach(function (r) {
      assert(D.CARDS.some(function (c) { return c.faction === f && c.rarity === r; }), f + ' has no ' + r + ' card');
    });
  });
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
  D.CHAPTERS.forEach(function (ch) {
    ch.enemies.concat([ch.boss]).forEach(function (e) {
      var svg = Art.enemy({ name: e.name, style: e.style, look: ch.look, boss: e === ch.boss });
      assert(svg.indexOf('<svg') === 0 && !/NaN|undefined/.test(svg), e.name + ' drawing is broken');
    });
  });
});
test('different cards get different drawings', function () {
  assert.notStrictEqual(Art.card(D.CARD_BY_ID['ember-imp']), Art.card(D.CARD_BY_ID['brook-sprite']));
  assert.notStrictEqual(Art.card(D.CARD_BY_ID['cinder-archer']), Art.card(D.CARD_BY_ID['ashen-duelist']));
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
  var r = G.setDeck(s, costly); // 3 x 12 = 36 > starting ATK PWR of 12
  assert(!r.ok && /ATK PWR/.test(r.error));
});
test('bestDeck picks a legal, strong party', function () {
  var s = G.newGame({ now: 0 });
  G.addCard(s, 'pyre-sovereign');
  var picked = G.bestDeck(s);
  assert(picked.length <= D.CONFIG.maxDeckSize);
  assert(G.deckCost(s, picked) <= G.deckCostCap(s));
  assert(G.setDeck(s, picked).ok);
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
test('same-faction materials give 1.5x exp', function () {
  var s = G.newGame({ now: 0 });
  var base = G.addCard(s, 'ember-imp');
  var same = G.addCard(s, 'ashen-duelist');
  var other = G.addCard(s, 'brook-sprite');
  var sameVal = G.fusePreview(s, base.uid, [same.uid]).exp;
  var otherVal = G.fusePreview(s, base.uid, [other.uid]).exp;
  // R (45) same faction = 68, N (20) other faction = 20
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

console.log('Quests and battles');
test('factions lean the way the original types did: Fallen ATK, Immortal HP, Mortal cheaper', function () {
  var fallen = D.CARD_BY_ID['gloom-thief'], immortal = D.CARD_BY_ID['tide-caller'], mortal = D.CARD_BY_ID['cinder-archer']; // all R
  assert(fallen.atk > mortal.atk && mortal.atk > immortal.atk);
  assert(immortal.hp > mortal.hp && mortal.hp > fallen.hp);
  assert.strictEqual(mortal.cost, D.RARITIES.R.cost - 1);
  assert.strictEqual(fallen.cost, D.RARITIES.R.cost);
});
test('there is no damage weakness: a hit only depends on the attacker\'s ATK', function () {
  var a = [{ name: 'A', faction: 'fallen', atk: 100, hp: 1000, maxHp: 1000 }];
  var b = [{ name: 'B', faction: 'mortal', atk: 1, hp: 1000, maxHp: 1000 }];
  var r = G.simulateBattle(a, b, function () { return 0.5; });
  var hit = r.events.filter(function (e) { return e.t === 'hit' && e.side === 'p'; })[0];
  assert.strictEqual(hit.dmg, 100);
});
test('cards matching your alignment get +15% ATK and HP; others do not', function () {
  var s = G.newGame({ now: 0, alignment: 'fallen' });
  s.cards = []; s.deck = [];
  var f = G.addCard(s, 'hollow-reaver'), m = G.addCard(s, 'sunblade-paladin'), x = G.addCard(s, 'gloom-thief');
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
test('sections unlock in order', function () {
  var s = G.newGame({ now: 0 });
  assert(G.isUnlocked(s, '1-1')); assert(!G.isUnlocked(s, '1-2'));
  s.cleared['1-1'] = true; assert(G.isUnlocked(s, '1-2'));
  assert(!G.isUnlocked(s, '2-1')); s.cleared['1-5'] = true; assert(G.isUnlocked(s, '2-1'));
});
test('a battle is recorded as replayable events that match the final result', function () {
  var s = G.newGame({ now: 0 });
  var r = G.fight(s, '1-1', { rand: seeded(3), now: 0 });
  assert(r.ok && r.win);
  var ev = r.events;
  assert.strictEqual(ev[ev.length - 1].t, 'end');
  assert.strictEqual(ev[ev.length - 1].win, r.win);
  assert.strictEqual(ev[0].t, 'round');
  var hits = ev.filter(function (e) { return e.t === 'hit'; });
  assert(hits.length > 0);
  // Replaying health from the events: every enemy ends at 0, and no hit targets a dead unit.
  var hp = { p: r.units.player.map(function (u) { return u.maxHp; }), e: r.units.enemy.map(function (u) { return u.maxHp; }) };
  hits.forEach(function (h) {
    var side = h.side === 'p' ? 'e' : 'p';
    assert(hp[side][h.to] > 0, 'hit on an already defeated unit');
    hp[side][h.to] = Math.max(0, hp[side][h.to] - h.dmg);
    assert.strictEqual(hp[side][h.to], h.hp, 'event hp does not match replayed hp');
    assert.strictEqual(h.dead, h.hp === 0);
  });
  assert(hp.e.every(function (v) { return v === 0; }));
  assert.strictEqual(r.units.enemy.length, G.stageEnemies(G.getStage('1-1'), 1).length);
});
test('a section needs 3 monsters, then the chest opens and the section is cleared', function () {
  var s = G.newGame({ now: 0 });
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
  assert.strictEqual(s.attrPoints, D.CONFIG.pointsPerSectionClear);
  assert.strictEqual(r3.rewards.gems, D.CONFIG.firstClearGems);
  assert.strictEqual(s.gems, gems + D.CONFIG.firstClearGems);
  assert(G.isUnlocked(s, '1-2'));
});
test('replaying a cleared section cycles through the monsters again, with no repeat first-clear gems', function () {
  var s = G.newGame({ now: 0 }); s.stamina = 100;
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
  var s = G.newGame({ now: 0 });
  ['1-1', '1-2', '1-3', '1-4'].forEach(function (id) { s.cleared[id] = true; });
  var stamina = s.stamina, gold = s.gold, cards = s.cards.length;
  var r = G.fight(s, '1-5', { rand: seeded(5), now: 0 }); // boss: the starter team is too weak
  assert(r.ok && !r.win && !r.rewards);
  assert.strictEqual(s.stamina, stamina); assert.strictEqual(s.gold, gold); assert.strictEqual(s.cards.length, cards);
  assert(!s.progress['1-5']);
});
test('beating a boss gives a card, Cure Water and big first-clear gems', function () {
  var s = strongState();
  ['1-1', '1-2', '1-3', '1-4'].forEach(function (id) { s.cleared[id] = true; });
  var gems = s.gems, cards = s.cards.length;
  var r = G.fight(s, '1-5', { rand: seeded(8), now: 0 });
  assert(r.ok && r.win);
  assert(r.rewards.chest && r.rewards.cureWater === 1 && s.items.cureWater === 1);
  assert(s.cards.length > cards, 'boss should drop a card');
  assert.strictEqual(s.gems, gems + D.CONFIG.firstClearBossGems);
  assert(G.isUnlocked(s, '2-1'));
});
test('Cure Water refills stamina, and only when you have some and are not full', function () {
  var s = G.newGame({ now: 0 });
  assert(!G.useCureWater(s).ok, 'none owned');
  s.items.cureWater = 1;
  assert(!G.useCureWater(s).ok, 'stamina already full');
  s.stamina = 2;
  assert(G.useCureWater(s).ok);
  assert.strictEqual(s.stamina, G.staminaCap(s)); assert.strictEqual(s.items.cureWater, 0);
});
test('you can choose the party for a battle; bad parties are refused and change nothing', function () {
  var s = G.newGame({ now: 0 });
  var extra = G.addCard(s, 'ember-imp');
  var chosen = [extra.uid, s.deck[0]];
  var r = G.fight(s, '1-1', { deck: chosen, rand: seeded(3), now: 0 });
  assert(r.ok);
  assert.deepStrictEqual(s.deck, chosen);
  assert.strictEqual(r.units.player.length, 2);
  assert.strictEqual(r.units.player[0].cardId, 'ember-imp');
  var before = s.deck.slice();
  var bad = G.fight(s, '1-1', { deck: [9999], rand: seeded(3), now: 0 });
  assert(!bad.ok); assert.deepStrictEqual(s.deck, before);
});
test('the first card in the party is the leader and gets +20% ATK and HP', function () {
  var s = G.newGame({ now: 0 });
  s.deck.push(G.addCard(s, 'ember-imp').uid);
  var team = G.buildTeam(s, s.deck);
  var st = G.cardStats(G.findCard(s, s.deck[0]));
  assert(team[0].leader && !team[1].leader);
  assert.strictEqual(team[0].atk, Math.round(st.atk * D.CONFIG.leaderMult));
  assert.strictEqual(team[0].maxHp, Math.round(st.hp * D.CONFIG.leaderMult));
  var st1 = G.cardStats(G.findCard(s, s.deck[1]));
  assert.strictEqual(team[1].atk, st1.atk);
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
  var s = G.newGame({ now: 0 });
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
  var a = G.addCard(s, 'gloom-thief');           // cost 5; champion 8 + 5 = 13 > 12
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

console.log('Saving');
test('save and load round-trips, and bad saves are rejected', function () {
  var s = G.newGame({ now: 0 });
  G.summon(s, 10, seeded(9));
  G.fight(s, '1-1', { rand: seeded(2), now: 0 });
  s.attr.atk = 2; s.items.cureWater = 3; s.alignment = 'immortal';
  var back = G.deserialize(G.serialize(s));
  assert.deepStrictEqual(back.cards, s.cards);
  assert.deepStrictEqual(back.progress, s.progress);
  assert.deepStrictEqual(back.attr, s.attr);
  assert.strictEqual(back.items.cureWater, 3);
  assert.strictEqual(back.alignment, 'immortal');
  var odd = JSON.parse(G.serialize(s)); odd.alignment = 'dragon';
  assert.strictEqual(G.deserialize(JSON.stringify(odd)).alignment, null, 'unknown alignment is cleared so the game asks again');
  assert.strictEqual(back.gems, s.gems);
  assert.strictEqual(G.deserialize('not json'), null);
  assert.strictEqual(G.deserialize('{"hello":1}'), null);
});
test('saves from the first version (no progress/attributes/items) still load', function () {
  var s = G.newGame({ now: 0 });
  var old = JSON.parse(JSON.stringify(s));
  delete old.progress; delete old.attr; delete old.attrPoints; delete old.items; old.version = 1;
  old.cleared = { '1-1': true };
  var back = G.deserialize(JSON.stringify(old));
  assert(back);
  assert.deepStrictEqual(back.attr, { stamina: 0, atk: 0 });
  assert.strictEqual(back.items.cureWater, 0);
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
