/*
 * game.js - the game rules. No buttons or screens in here, just logic, so it
 * can be tested from the command line (see tests/game.test.js).
 *
 * All the "do something" functions return { ok: true, ... } or { ok: false, error: '...' }.
 * The game state is a plain object that can be saved as JSON.
 */
var Game = (function () {
  'use strict';

  var D = (typeof GameData !== 'undefined') ? GameData : require('./data.js');
  var CFG = D.CONFIG;
  var SAVE_KEY = 'bahamut-clone-save-v1';

  // ---------- small helpers ----------
  function rollWeighted(weights, rand) {
    var total = 0, k;
    for (k in weights) { total += weights[k]; }
    var roll = rand() * total;
    for (k in weights) {
      if (roll < weights[k]) { return k; }
      roll -= weights[k];
    }
    // Floating point edge case: return the last key with weight > 0.
    var last = null;
    for (k in weights) { if (weights[k] > 0) { last = k; } }
    return last;
  }

  function pickCardOfRarity(rarity, rand) {
    var pool = D.CARDS.filter(function (c) { return c.rarity === rarity; });
    return pool[Math.floor(rand() * pool.length)];
  }

  function nowMs(now) { return (typeof now === 'number') ? now : Date.now(); }

  // ---------- player progression ----------
  function maxStamina(level) { return Math.min(80, 20 + 2 * (level - 1)); }
  function expToNext(level) { return 60 * level; }
  function deckCostCap(level) { return 24 + 2 * level; }

  // ---------- card stats ----------
  function maxLevel(card) { return 20 + 10 * card.evo; }
  function cardExpToNext(card) { return 30 * card.level; }

  function cardStats(card) {
    var def = D.CARD_BY_ID[card.cardId];
    var mult = (1 + 0.1 * (card.level - 1)) * (1 + 0.3 * card.evo);
    return {
      atk: Math.round(def.atk * mult),
      hp: Math.round(def.hp * mult),
      cost: def.cost,
      maxLevel: maxLevel(card)
    };
  }

  // ---------- state ----------
  function addCard(state, cardId) {
    var card = { uid: state.nextUid++, cardId: cardId, level: 1, exp: 0, evo: 0 };
    state.cards.push(card);
    return card;
  }

  function newGame(opts) {
    opts = opts || {};
    var t = nowMs(opts.now);
    var state = {
      version: 1,
      gems: CFG.startGems,
      gold: CFG.startGold,
      level: 1,
      exp: 0,
      stamina: maxStamina(1),
      staminaAt: t,
      nextUid: 1,
      cards: [],
      deck: [],
      cleared: {},
      pulls: 0
    };
    CFG.starterCards.forEach(function (id) {
      var c = addCard(state, id);
      state.deck.push(c.uid);
    });
    return state;
  }

  function findCard(state, uid) {
    for (var i = 0; i < state.cards.length; i++) {
      if (state.cards[i].uid === uid) { return state.cards[i]; }
    }
    return null;
  }

  function regenStamina(state, now) {
    var t = nowMs(now);
    var max = maxStamina(state.level);
    if (state.stamina >= max) { state.stamina = Math.max(state.stamina, max); state.staminaAt = t; return state; }
    var gained = Math.floor((t - state.staminaAt) / CFG.staminaRegenMs);
    if (gained > 0) {
      state.stamina = Math.min(max, state.stamina + gained);
      state.staminaAt += gained * CFG.staminaRegenMs;
      if (state.stamina >= max) { state.staminaAt = t; }
    }
    return state;
  }

  function msUntilNextStamina(state, now) {
    var max = maxStamina(state.level);
    if (state.stamina >= max) { return 0; }
    return Math.max(0, CFG.staminaRegenMs - (nowMs(now) - state.staminaAt));
  }

  // ---------- summoning (gacha) ----------
  function rateTable() {
    var t = {};
    D.RARITY_ORDER.forEach(function (r) { t[r] = D.RARITIES[r].rate; });
    return t;
  }

  function summon(state, count, rand) {
    rand = rand || Math.random;
    var cost = (count === 10) ? CFG.tenPullCost : CFG.singlePullCost;
    if (count !== 1 && count !== 10) { return { ok: false, error: 'Summon 1 or 10 at a time.' }; }
    if (state.gems < cost) { return { ok: false, error: 'Not enough gems (need ' + cost + ').' }; }
    state.gems -= cost;

    var rarities = [];
    for (var i = 0; i < count; i++) { rarities.push(rollWeighted(rateTable(), rand)); }
    // A 10-summon always includes at least one Super Rare or better.
    if (count === 10 && !rarities.some(function (r) { return r === 'SR' || r === 'SSR'; })) {
      rarities[9] = rollWeighted({ SR: D.RARITIES.SR.rate, SSR: D.RARITIES.SSR.rate }, rand);
    }
    var got = rarities.map(function (r) {
      var def = pickCardOfRarity(r, rand);
      var card = addCard(state, def.id);
      return card;
    });
    state.pulls += count;
    return { ok: true, cards: got };
  }

  // ---------- deck ----------
  function deckCost(state, uids) {
    return uids.reduce(function (sum, uid) {
      var c = findCard(state, uid);
      return sum + (c ? D.CARD_BY_ID[c.cardId].cost : 0);
    }, 0);
  }

  function setDeck(state, uids) {
    if (uids.length > CFG.maxDeckSize) { return { ok: false, error: 'A deck holds at most ' + CFG.maxDeckSize + ' cards.' }; }
    var seen = {};
    for (var i = 0; i < uids.length; i++) {
      if (!findCard(state, uids[i])) { return { ok: false, error: 'Unknown card in deck.' }; }
      if (seen[uids[i]]) { return { ok: false, error: 'Duplicate card in deck.' }; }
      seen[uids[i]] = true;
    }
    var cost = deckCost(state, uids);
    var cap = deckCostCap(state.level);
    if (cost > cap) { return { ok: false, error: 'Deck cost ' + cost + ' is over your limit of ' + cap + '.' }; }
    state.deck = uids.slice();
    return { ok: true, cost: cost, cap: cap };
  }

  // ---------- fusion, evolution, selling ----------
  function fuseValue(material, base) {
    var def = D.CARD_BY_ID[material.cardId];
    var baseDef = D.CARD_BY_ID[base.cardId];
    var value = D.RARITIES[def.rarity].fuseExp * (1 + 0.2 * (material.level - 1)) * (1 + 0.5 * material.evo);
    if (def.element === baseDef.element) { value *= 1.5; }
    return Math.round(value);
  }

  function checkMaterials(state, baseUid, materialUids) {
    var base = findCard(state, baseUid);
    if (!base) { return { ok: false, error: 'Card not found.' }; }
    if (!materialUids.length) { return { ok: false, error: 'Pick at least one card to use.' }; }
    var seen = {};
    for (var i = 0; i < materialUids.length; i++) {
      var uid = materialUids[i];
      if (uid === baseUid) { return { ok: false, error: 'A card cannot be used on itself.' }; }
      if (seen[uid]) { return { ok: false, error: 'Duplicate card selected.' }; }
      seen[uid] = true;
      if (!findCard(state, uid)) { return { ok: false, error: 'Card not found.' }; }
      if (state.deck.indexOf(uid) !== -1) { return { ok: false, error: 'Remove cards from your deck before using them up.' }; }
    }
    return { ok: true, base: base };
  }

  function removeCards(state, uids) {
    state.cards = state.cards.filter(function (c) { return uids.indexOf(c.uid) === -1; });
    state.deck = state.deck.filter(function (uid) { return uids.indexOf(uid) === -1; });
  }

  function fusePreview(state, baseUid, materialUids) {
    var base = findCard(state, baseUid);
    if (!base) { return { exp: 0, gold: 0 }; }
    var exp = 0;
    materialUids.forEach(function (uid) {
      var m = findCard(state, uid);
      if (m) { exp += fuseValue(m, base); }
    });
    return { exp: exp, gold: CFG.fuseGoldPerMaterial * materialUids.length };
  }

  function fuse(state, baseUid, materialUids) {
    var chk = checkMaterials(state, baseUid, materialUids);
    if (!chk.ok) { return chk; }
    var base = chk.base;
    if (base.level >= maxLevel(base)) { return { ok: false, error: 'Already at max level. Evolve it to raise the cap.' }; }
    var preview = fusePreview(state, baseUid, materialUids);
    if (state.gold < preview.gold) { return { ok: false, error: 'Not enough gold (need ' + preview.gold + ').' }; }

    state.gold -= preview.gold;
    var startLevel = base.level;
    var left = preview.exp;
    while (left > 0 && base.level < maxLevel(base)) {
      var need = cardExpToNext(base) - base.exp;
      if (left >= need) { left -= need; base.level++; base.exp = 0; }
      else { base.exp += left; left = 0; }
    }
    if (base.level >= maxLevel(base)) { base.exp = 0; }
    removeCards(state, materialUids);
    return { ok: true, gained: preview.exp, levelsGained: base.level - startLevel, card: base };
  }

  function evolveCost(card) { return CFG.evolveGoldBase * (card.evo + 1); }

  function canEvolve(state, uid) {
    var card = findCard(state, uid);
    if (!card) { return { ok: false, error: 'Card not found.' }; }
    if (card.evo >= CFG.maxEvo) { return { ok: false, error: 'Already fully evolved.' }; }
    if (card.level < maxLevel(card)) { return { ok: false, error: 'Must be at max level (' + maxLevel(card) + ') to evolve.' }; }
    return { ok: true, card: card };
  }

  // Evolution consumes one other copy of the same card (not in the deck).
  function evolve(state, uid, materialUid) {
    var chk = canEvolve(state, uid);
    if (!chk.ok) { return chk; }
    var card = chk.card;
    var mat = findCard(state, materialUid);
    if (!mat || mat.uid === card.uid) { return { ok: false, error: 'Pick another copy of the same card.' }; }
    if (mat.cardId !== card.cardId) { return { ok: false, error: 'Material must be the same card.' }; }
    if (state.deck.indexOf(mat.uid) !== -1) { return { ok: false, error: 'Remove the material from your deck first.' }; }
    var cost = evolveCost(card);
    if (state.gold < cost) { return { ok: false, error: 'Not enough gold (need ' + cost + ').' }; }
    state.gold -= cost;
    removeCards(state, [mat.uid]);
    card.evo++;
    return { ok: true, card: card };
  }

  function sellValue(card) {
    var def = D.CARD_BY_ID[card.cardId];
    return Math.round(D.RARITIES[def.rarity].sell * (1 + 0.2 * (card.level - 1)) * (1 + 0.5 * card.evo));
  }

  function sell(state, uids) {
    if (!uids.length) { return { ok: false, error: 'Pick at least one card to sell.' }; }
    var total = 0;
    for (var i = 0; i < uids.length; i++) {
      var c = findCard(state, uids[i]);
      if (!c) { return { ok: false, error: 'Card not found.' }; }
      if (state.deck.indexOf(c.uid) !== -1) { return { ok: false, error: 'Remove cards from your deck before selling them.' }; }
      total += sellValue(c);
    }
    state.gold += total;
    removeCards(state, uids);
    return { ok: true, gold: total };
  }

  // ---------- battles ----------
  function elementMult(attacker, defender) {
    if (D.ELEMENTS[attacker].beats === defender) { return 1.5; }
    if (D.ELEMENTS[defender].beats === attacker) { return 0.75; }
    return 1;
  }

  function stageList() {
    var list = [], gi = 0;
    D.CHAPTERS.forEach(function (ch) {
      for (var n = 1; n <= D.STAGES_PER_CHAPTER; n++) {
        list.push({
          id: ch.id + '-' + n, chapter: ch.id, num: n, index: gi,
          boss: n === D.STAGES_PER_CHAPTER,
          staminaCost: 3 + Math.floor(gi / 2) + (n === D.STAGES_PER_CHAPTER ? 2 : 0)
        });
        gi++;
      }
    });
    return list;
  }
  var STAGES = stageList();

  function getStage(id) {
    for (var i = 0; i < STAGES.length; i++) { if (STAGES[i].id === id) { return STAGES[i]; } }
    return null;
  }

  function isUnlocked(state, stageId) {
    var st = getStage(stageId);
    if (!st) { return false; }
    return st.index === 0 || !!state.cleared[STAGES[st.index - 1].id];
  }

  function stageEnemies(stage) {
    var ch = D.CHAPTERS[stage.chapter - 1];
    var power = 1 + 0.4 * stage.index;
    var count = stage.boss ? 4 : (stage.num >= 3 ? 3 : 2);
    var list = [];
    for (var i = 0; i < count; i++) {
      var isBoss = stage.boss && i === count - 1;
      // Mostly the chapter's element, with a little variety.
      var elems = [ch.element, ch.element, 'light', 'water', 'fire', 'wind', 'dark'];
      var element = isBoss ? ch.element : elems[(stage.index + i) % elems.length];
      var mult = isBoss ? 1.8 : 1;
      list.push({
        name: isBoss ? ch.boss : ch.enemies[(stage.index + i) % ch.enemies.length],
        element: element,
        hp: Math.round(110 * power * mult),
        atk: Math.round(14 * power * (isBoss ? 1.5 : 1))
      });
    }
    return list;
  }

  function simulateBattle(playerUnits, enemyUnits, rand) {
    rand = rand || Math.random;
    var log = [];
    function alive(side) { return side.filter(function (u) { return u.hp > 0; }); }
    function act(unit, targets) {
      var tgt = targets[Math.floor(rand() * targets.length)];
      var mult = elementMult(unit.element, tgt.element);
      var dmg = Math.max(1, Math.round(unit.atk * mult * (0.9 + 0.2 * rand())));
      tgt.hp = Math.max(0, tgt.hp - dmg);
      log.push(unit.name + ' hits ' + tgt.name + ' for ' + dmg +
        (mult > 1 ? ' (strong!)' : (mult < 1 ? ' (weak)' : '')) + (tgt.hp === 0 ? ' - defeated' : ''));
    }
    var rounds = 0;
    while (rounds < CFG.battleMaxRounds && alive(playerUnits).length && alive(enemyUnits).length) {
      rounds++;
      log.push('-- Round ' + rounds + ' --');
      alive(playerUnits).forEach(function (u) {
        var t = alive(enemyUnits);
        if (t.length) { act(u, t); }
      });
      alive(enemyUnits).forEach(function (u) {
        var t = alive(playerUnits);
        if (t.length) { act(u, t); }
      });
    }
    return { win: alive(enemyUnits).length === 0 && alive(playerUnits).length > 0, rounds: rounds, log: log };
  }

  function addPlayerExp(state, amount) {
    var levelsGained = 0;
    state.exp += amount;
    while (state.exp >= expToNext(state.level)) {
      state.exp -= expToNext(state.level);
      state.level++;
      levelsGained++;
      state.stamina = maxStamina(state.level); // level-up refills stamina
      state.gems += 20;
    }
    return levelsGained;
  }

  function playStage(state, stageId, rand, now) {
    rand = rand || Math.random;
    var stage = getStage(stageId);
    if (!stage) { return { ok: false, error: 'Unknown stage.' }; }
    if (!isUnlocked(state, stageId)) { return { ok: false, error: 'Clear the previous stage first.' }; }
    if (!state.deck.length) { return { ok: false, error: 'Your deck is empty. Add cards in the Deck tab.' }; }
    regenStamina(state, now);
    if (state.stamina < stage.staminaCost) { return { ok: false, error: 'Not enough stamina (need ' + stage.staminaCost + ').' }; }

    var team = state.deck.map(function (uid) {
      var c = findCard(state, uid);
      var def = D.CARD_BY_ID[c.cardId];
      var s = cardStats(c);
      return { name: def.name, element: def.element, hp: s.hp, atk: s.atk };
    });
    var enemies = stageEnemies(stage).map(function (e) { return { name: e.name, element: e.element, hp: e.hp, atk: e.atk }; });
    var result = simulateBattle(team, enemies, rand);
    var out = { ok: true, win: result.win, rounds: result.rounds, log: result.log, stage: stage };

    if (!result.win) { return out; } // a loss costs nothing

    // Spend stamina only on a win.
    if (state.stamina >= maxStamina(state.level)) { state.staminaAt = nowMs(now); }
    state.stamina -= stage.staminaCost;

    var gi = stage.index;
    var rewards = { exp: 8 + 4 * gi, gold: 30 + 15 * gi, gems: 0, card: null, levelsGained: 0 };
    if (!state.cleared[stage.id]) {
      state.cleared[stage.id] = true;
      rewards.gems = stage.boss ? CFG.firstClearBossGems : CFG.firstClearGems;
      rewards.firstClear = true;
    }
    state.gold += rewards.gold;
    state.gems += rewards.gems;
    var ch = D.CHAPTERS[stage.chapter - 1];
    var dropRarity = rollWeighted(ch.dropWeights, rand);
    var dropDef = pickCardOfRarity(dropRarity, rand);
    rewards.card = addCard(state, dropDef.id);
    rewards.levelsGained = addPlayerExp(state, rewards.exp);
    out.rewards = rewards;
    return out;
  }

  // ---------- saving ----------
  function serialize(state) { return JSON.stringify(state); }

  function deserialize(text) {
    var s;
    try { s = JSON.parse(text); } catch (e) { return null; }
    if (!s || typeof s !== 'object' || !Array.isArray(s.cards) || !Array.isArray(s.deck)) { return null; }
    var base = newGame({ now: 0 });
    var out = {};
    for (var k in base) { out[k] = (s[k] !== undefined) ? s[k] : base[k]; }
    // Drop cards the game no longer knows about.
    out.cards = out.cards.filter(function (c) {
      return c && D.CARD_BY_ID[c.cardId] && typeof c.uid === 'number';
    });
    var uids = out.cards.map(function (c) { return c.uid; });
    out.deck = out.deck.filter(function (u) { return uids.indexOf(u) !== -1; }).slice(0, CFG.maxDeckSize);
    var maxUid = 0;
    out.cards.forEach(function (c) { if (c.uid > maxUid) { maxUid = c.uid; } });
    out.nextUid = Math.max(out.nextUid, maxUid + 1);
    ['gems', 'gold', 'level', 'exp', 'stamina', 'staminaAt', 'pulls'].forEach(function (key) {
      if (typeof out[key] !== 'number' || !isFinite(out[key])) { out[key] = base[key]; }
    });
    out.level = Math.max(1, Math.floor(out.level));
    return out;
  }

  var api = {
    SAVE_KEY: SAVE_KEY, STAGES: STAGES,
    newGame: newGame, findCard: findCard, addCard: addCard,
    maxStamina: maxStamina, expToNext: expToNext, deckCostCap: deckCostCap,
    regenStamina: regenStamina, msUntilNextStamina: msUntilNextStamina,
    cardStats: cardStats, maxLevel: maxLevel, cardExpToNext: cardExpToNext,
    rateTable: rateTable, summon: summon,
    deckCost: deckCost, setDeck: setDeck,
    fusePreview: fusePreview, fuse: fuse, evolveCost: evolveCost, canEvolve: canEvolve, evolve: evolve,
    sellValue: sellValue, sell: sell,
    elementMult: elementMult, getStage: getStage, isUnlocked: isUnlocked, stageEnemies: stageEnemies,
    simulateBattle: simulateBattle, playStage: playStage,
    serialize: serialize, deserialize: deserialize
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  return api;
})();
