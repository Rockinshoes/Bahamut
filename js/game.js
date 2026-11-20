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
  function maxStamina(level, bonus) { return Math.min(100, 20 + 2 * (level - 1) + (bonus || 0)); }
  function staminaCap(state) { return maxStamina(state.level, state.attr.stamina * CFG.staminaPerPoint); }
  // Quests give 1 exp per stamina (CONFIG.expPerStamina), so early levels take about
  // one bar of stamina, as in the original.
  function expToNext(level) { return 12 * level; }
  // ATK PWR: the most total card cost your party can have.
  function deckCostCap(state) { return CFG.baseAtkPower + state.attr.atk * CFG.atkPowerPerPoint; }

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
      version: 3,
      alignment: D.FACTIONS[opts.alignment] ? opts.alignment : null,  // picked once at the start
      gems: CFG.startGems,
      gold: CFG.startGold,
      level: 1,
      exp: 0,
      stamina: maxStamina(1),
      staminaAt: t,
      nextUid: 1,
      cards: [],
      deck: [],
      cleared: {},          // section id -> true once the section has been cleared
      progress: {},         // section id -> total monsters beaten there
      attr: { stamina: 0, atk: 0 },
      attrPoints: 0,
      items: { ambrosia: 0 },
      treasure: {},          // chapter id -> [count of piece 1, ..., count of piece 6]
      pulls: 0
    };
    (CFG.starterCards[state.alignment] || CFG.starterCards.mortal).forEach(function (id) {
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
    var max = staminaCap(state);
    if (state.stamina >= max) { state.staminaAt = t; return state; }
    var gained = Math.floor((t - state.staminaAt) / CFG.staminaRegenMs);
    if (gained > 0) {
      state.stamina = Math.min(max, state.stamina + gained);
      state.staminaAt += gained * CFG.staminaRegenMs;
      if (state.stamina >= max) { state.staminaAt = t; }
    }
    return state;
  }

  function msUntilNextStamina(state, now) {
    if (state.stamina >= staminaCap(state)) { return 0; }
    return Math.max(0, CFG.staminaRegenMs - (nowMs(now) - state.staminaAt));
  }

  // ---------- attribute points and items ----------
  function spendPoint(state, kind) {
    if (!state.attr.hasOwnProperty(kind)) { return { ok: false, error: 'Unknown attribute.' }; }
    if (state.attrPoints < 1) { return { ok: false, error: 'No attribute points to spend.' }; }
    state.attrPoints--;
    state.attr[kind]++;
    if (kind === 'stamina') { state.stamina += CFG.staminaPerPoint; }
    return { ok: true };
  }

  // Ambrosia refills all your stamina. Bosses drop it.
  function useAmbrosia(state) {
    if (state.items.ambrosia < 1) { return { ok: false, error: 'You have no Ambrosia.' }; }
    if (state.stamina >= staminaCap(state)) { return { ok: false, error: 'Your stamina is already full.' }; }
    state.items.ambrosia--;
    state.stamina = staminaCap(state);
    return { ok: true };
  }

  function setAlignment(state, faction) {
    if (!D.FACTIONS[faction]) { return { ok: false, error: 'Unknown alignment.' }; }
    state.alignment = faction;
    return { ok: true };
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
    // A 10-summon always includes at least one card of CONFIG.tenPullGuarantee rarity or better.
    var minIdx = D.RARITY_ORDER.indexOf(CFG.tenPullGuarantee);
    if (count === 10 && !rarities.some(function (r) { return D.RARITY_ORDER.indexOf(r) >= minIdx; })) {
      var high = {};
      D.RARITY_ORDER.slice(minIdx).forEach(function (r) { high[r] = D.RARITIES[r].rate; });
      rarities[9] = rollWeighted(high, rand);
    }
    var got = rarities.map(function (r) {
      var def = pickCardOfRarity(r, rand);
      return addCard(state, def.id);
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
    var cap = deckCostCap(state);
    if (cost > cap) { return { ok: false, error: 'Party cost ' + cost + ' is over your ATK PWR of ' + cap + '.' }; }
    state.deck = uids.slice();
    return { ok: true, cost: cost, cap: cap };
  }

  // The strongest legal party, by raw power.
  function bestDeck(state) {
    var cap = deckCostCap(state), picked = [], total = 0;
    var byPower = state.cards.slice().sort(function (a, b) {
      var sa = cardStats(a), sb = cardStats(b);
      return (sb.atk + sb.hp / 4) - (sa.atk + sa.hp / 4);
    });
    byPower.forEach(function (c) {
      var cost = cardStats(c).cost;
      if (picked.length < CFG.maxDeckSize && total + cost <= cap) { picked.push(c.uid); total += cost; }
    });
    return picked;
  }

  // ---------- fusion, evolution, selling ----------
  function fuseValue(material, base) {
    var def = D.CARD_BY_ID[material.cardId];
    var baseDef = D.CARD_BY_ID[base.cardId];
    var value = D.RARITIES[def.rarity].fuseExp * (1 + 0.2 * (material.level - 1)) * (1 + 0.5 * material.evo);
    if (def.faction === baseDef.faction) { value *= CFG.sameFactionFuseMult; }
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

  // ---------- quests ----------

  function stageList() {
    var list = [], gi = 0;
    D.CHAPTERS.forEach(function (ch) {
      for (var n = 1; n <= D.STAGES_PER_CHAPTER; n++) {
        var boss = n === D.STAGES_PER_CHAPTER;
        list.push({
          id: ch.id + '-' + n, chapter: ch.id, num: n, index: gi,
          boss: boss,
          monsters: boss ? 1 : CFG.monstersPerSection,
          // Stamina spent per battle.
          staminaCost: boss ? 3 + 2 * ch.id : ch.id
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

  // How many monsters of this section you have beaten in the current run (0 .. monsters).
  function sectionProgress(state, stageId) {
    var st = getStage(stageId);
    var count = state.progress[stageId] || 0;
    if (!state.cleared[stageId]) { return Math.min(count, st.monsters); }
    return count % st.monsters;
  }

  // Which fight of the section comes next (1-based).
  function nextFightNo(state, stageId) { return sectionProgress(state, stageId) + 1; }

  function stageEnemies(stage, fightNo) {
    fightNo = fightNo || 1;
    var ch = D.CHAPTERS[stage.chapter - 1];
    var power = (1 + 0.4 * stage.index) * (1 + 0.05 * (fightNo - 1));
    var count = stage.boss ? 4 : (stage.num >= 3 ? 3 : 2);
    var f = D.FACTIONS[ch.faction];
    var list = [];
    for (var i = 0; i < count; i++) {
      var isBoss = stage.boss && i === 0;
      var def = isBoss ? ch.boss : ch.enemies[(stage.index + i + fightNo) % ch.enemies.length];
      var mult = isBoss ? 1.8 : 1;
      var hp = Math.round(110 * power * mult * f.hpMod);
      list.push({
        name: def.name,
        style: def.style,
        look: ch.look,
        boss: isBoss,
        faction: ch.faction,
        hp: hp, maxHp: hp,
        atk: Math.round(70 * power * (isBoss ? 1.5 : 1) * f.atkMod)
      });
    }
    return list;
  }

  // Turns your party cards into battle units. The first card is the leader, and cards
  // matching your alignment get the alignment bonus.
  function buildTeam(state, uids) {
    return uids.map(function (uid, i) {
      var c = findCard(state, uid);
      var def = D.CARD_BY_ID[c.cardId];
      var s = cardStats(c);
      var lead = (i === 0) ? CFG.leaderMult : 1;
      var aligned = def.faction === state.alignment;
      var align = aligned ? CFG.alignmentBonus : 1;
      var hp = Math.round(s.hp * lead * align);
      return {
        name: def.name, faction: def.faction, look: def.look, cardId: def.id, rarity: def.rarity, style: def.style,
        level: c.level, evo: c.evo, leader: i === 0, aligned: aligned,
        atk: Math.round(s.atk * lead * align), hp: hp, maxHp: hp
      };
    });
  }

  function snapshot(units) { return units.map(function (u) { var c = {}; for (var k in u) { c[k] = u[k]; } return c; }); }

  // Runs a whole battle instantly and records every hit as an event, so the screen can
  // replay it. Events: {t:'round', n}, {t:'hit', side:'p'|'e', from, to, dmg, hp, dead}.
  function simulateBattle(playerUnits, enemyUnits, rand) {
    rand = rand || Math.random;
    var log = [], events = [];
    function alive(side) { return side.filter(function (u) { return u.hp > 0; }); }
    function act(unit, side, mySide, targets, theirSide) {
      var tgt = targets[Math.floor(rand() * targets.length)];
      var dmg = Math.max(1, Math.round(unit.atk * CFG.damagePerAtk * (0.9 + 0.2 * rand())));
      tgt.hp = Math.max(0, tgt.hp - dmg);
      events.push({ t: 'hit', side: side, from: mySide.indexOf(unit), to: theirSide.indexOf(tgt), dmg: dmg, hp: tgt.hp, dead: tgt.hp === 0 });
      log.push(unit.name + ' hits ' + tgt.name + ' for ' + dmg + (tgt.hp === 0 ? ' - defeated' : ''));
    }
    var rounds = 0;
    while (rounds < CFG.battleMaxRounds && alive(playerUnits).length && alive(enemyUnits).length) {
      rounds++;
      events.push({ t: 'round', n: rounds });
      log.push('-- Round ' + rounds + ' --');
      alive(playerUnits).forEach(function (u) {
        var t = alive(enemyUnits);
        if (t.length) { act(u, 'p', playerUnits, t, enemyUnits); }
      });
      alive(enemyUnits).forEach(function (u) {
        var t = alive(playerUnits);
        if (t.length) { act(u, 'e', enemyUnits, t, playerUnits); }
      });
    }
    var win = alive(enemyUnits).length === 0 && alive(playerUnits).length > 0;
    events.push({ t: 'end', win: win });
    return { win: win, rounds: rounds, log: log, events: events };
  }

  function addPlayerExp(state, amount) {
    var levelsGained = 0;
    state.exp += amount;
    while (state.exp >= expToNext(state.level)) {
      state.exp -= expToNext(state.level);
      state.level++;
      levelsGained++;
      state.attrPoints += CFG.pointsPerLevel;
      state.stamina = staminaCap(state); // level-up refills stamina
      state.gems += 20;
    }
    return levelsGained;
  }

  // The cards a section can drop: one of each faction, as in the original.
  function sectionDrops(stage) {
    var ch = D.CHAPTERS[stage.chapter - 1];
    return stage.boss ? ch.bossDrops : ch.drops[stage.num - 1];
  }

  function dropCard(state, stage, rand) {
    var ids = sectionDrops(stage);
    return addCard(state, ids[Math.floor(rand() * ids.length)]);
  }

  // ---------- card skills ----------
  // Strength in percent of a card's skill.
  function skillPct(def) {
    var pct = D.RARITIES[def.rarity].skill;
    if (def.skill.target !== 'all') { pct *= CFG.factionSkillMult; }
    if (def.skill.stat === 'both') { pct *= 0.7; } // two stats, so each is a bit smaller
    return Math.round(pct);
  }

  // The skill described the way the original game worded it, e.g.
  // "Great Boost to Fallen Attack/Defense" or "Medium Hit to Foes Defense (All)".
  function skillTitle(def) {
    var sk = def.skill;
    var stat = sk.stat === 'atk' ? 'Attack' : (sk.stat === 'def' ? 'Defense' : 'Attack/Defense');
    var tier = D.RARITIES[def.rarity].tier;
    if (sk.kind === 'boost') {
      return tier + ' Boost to ' + (sk.target === 'all' ? stat + ' (All)' : D.FACTIONS[sk.target].name + ' ' + stat);
    }
    return tier + ' Hit to Foes ' + (sk.target === 'all' ? stat + ' (All)' : D.FACTIONS[sk.target].name + ' ' + stat);
  }

  // Plain numbers, e.g. "+15% ATK to Fallen allies" or "-8% DEF to all enemies".
  function skillText(def) {
    var sk = def.skill, pct = skillPct(def);
    var stat = sk.stat === 'atk' ? 'ATK' : (sk.stat === 'def' ? 'DEF' : 'ATK and DEF');
    if (sk.kind === 'boost') {
      return '+' + pct + '% ' + stat + ' to ' + (sk.target === 'all' ? 'all allies' : D.FACTIONS[sk.target].name + ' allies');
    }
    return '-' + pct + '% ' + stat + ' to ' + (sk.target === 'all' ? 'all enemies' : D.FACTIONS[sk.target].name + ' enemies');
  }

  // At the start of a battle each party card rolls to trigger its skill: the first slot
  // always does, later slots less often. Triggered skills change the units' stats for the
  // whole battle. Returns the skill events for the battle screen to show.
  function applySkills(team, enemies, rand) {
    var events = [];
    team.forEach(function (u, i) {
      var def = D.CARD_BY_ID[u.cardId];
      var roll = rand();
      if (roll >= (CFG.skillChanceBySlot[i] || 0)) { return; }
      var sk = def.skill, f = skillPct(def) / 100;
      var pool = sk.kind === 'boost' ? team : enemies;
      var targets = pool.filter(function (a) { return sk.target === 'all' || a.faction === sk.target; });
      var mult = sk.kind === 'boost' ? 1 + f : 1 - f;
      targets.forEach(function (x) {
        if (sk.stat !== 'def') { x.atk = Math.round(x.atk * mult); }
        if (sk.stat !== 'atk') { x.hp = Math.round(x.hp * mult); x.maxHp = Math.round(x.maxHp * mult); }
      });
      events.push({ t: 'skill', side: 'p', from: i, name: sk.name, title: skillTitle(def), text: skillText(def), affected: targets.length });
    });
    return events;
  }

  // ---------- treasure ----------
  function treasureCounts(state, chapterId) {
    var t = state.treasure[chapterId];
    if (!t) { t = state.treasure[chapterId] = [0, 0, 0, 0, 0, 0]; }
    return t;
  }
  // Which piece (0-5) a section drops: sections 1-4 drop pieces 1-4; the boss drops 5 or 6.
  function stagePieces(stage) { return stage.boss ? [4, 5] : [stage.num - 1]; }
  function treasureComplete(state, chapterId) {
    return treasureCounts(state, chapterId).every(function (n) { return n > 0; });
  }
  // Trade one of each of the 6 pieces for a card of the set's reward rarity.
  function claimTreasure(state, chapterId, rand) {
    rand = rand || Math.random;
    var ch = D.CHAPTERS[chapterId - 1];
    if (!ch) { return { ok: false, error: 'Unknown treasure set.' }; }
    if (!treasureComplete(state, chapterId)) { return { ok: false, error: 'You need all 6 pieces first.' }; }
    var t = treasureCounts(state, chapterId);
    for (var i = 0; i < 6; i++) { t[i]--; }
    var def = pickCardOfRarity(ch.treasure.reward, rand);
    return { ok: true, card: addCard(state, def.id) };
  }

  // What the party-select screen needs to know about the next battle in a section.
  function battleInfo(state, stageId) {
    var stage = getStage(stageId);
    if (!stage) { return { ok: false, error: 'Unknown stage.' }; }
    if (!isUnlocked(state, stageId)) { return { ok: false, error: 'Clear the previous section first.' }; }
    var fightNo = nextFightNo(state, stageId);
    return { ok: true, stage: stage, fightNo: fightNo, monsters: stage.monsters, enemies: stageEnemies(stage, fightNo) };
  }

  // Fight the next monster (or boss) of a section. Pass opts.deck to choose the party.
  // The result is applied right away; result.events is what the battle screen replays.
  function fight(state, stageId, opts) {
    opts = opts || {};
    var rand = opts.rand || Math.random;
    var info = battleInfo(state, stageId);
    if (!info.ok) { return info; }
    var stage = info.stage;
    if (opts.deck) {
      var set = setDeck(state, opts.deck);
      if (!set.ok) { return set; }
    }
    if (!state.deck.length) { return { ok: false, error: 'Your party is empty. Add cards first.' }; }
    regenStamina(state, opts.now);
    if (state.stamina < stage.staminaCost) { return { ok: false, error: 'Not enough stamina (need ' + stage.staminaCost + ').' }; }

    var team = buildTeam(state, state.deck);
    var enemies = info.enemies;
    var skillEvents = applySkills(team, enemies, rand);
    var units = { player: snapshot(team), enemy: snapshot(enemies) }; // stats after skills
    var sim = simulateBattle(team, enemies, rand);
    var out = {
      ok: true, win: sim.win, rounds: sim.rounds, log: sim.log, events: skillEvents.concat(sim.events),
      units: units, stage: stage, fightNo: info.fightNo, monsters: info.monsters
    };
    if (!sim.win) { return out; } // a loss costs nothing

    // Spend stamina only on a win.
    if (state.stamina >= staminaCap(state)) { state.staminaAt = nowMs(opts.now); }
    state.stamina -= stage.staminaCost;

    var gi = stage.index;
    var rewards = {
      exp: stage.staminaCost * CFG.expPerStamina,
      gold: stage.boss ? 150 + 60 * gi : 12 + 6 * gi,
      gems: 0, cards: [], chest: false, chestGold: 0, ambrosia: 0, treasure: null,
      levelsGained: 0, firstClear: false, sectionCleared: false, points: 0
    };

    state.progress[stage.id] = (state.progress[stage.id] || 0) + 1;
    var count = state.progress[stage.id];
    var wasCleared = !!state.cleared[stage.id];

    // Normal monsters sometimes drop a card.
    if (!stage.boss && rand() < CFG.monsterDropChance) { rewards.cards.push(dropCard(state, stage, rand)); }

    // Every 3rd monster opens a treasure chest; the boss always does.
    if (count % stage.monsters === 0) {
      rewards.chest = true;
      if (stage.boss) {
        rewards.cards.push(dropCard(state, stage, rand));
        rewards.ambrosia = 1;
      } else {
        rewards.chestGold = 40 + 20 * gi;
        if (rand() < CFG.chestCardChance) { rewards.cards.push(dropCard(state, stage, rand)); }
      }
    }
    // Treasure: each monster win has a chance to drop this section's piece.
    if (rand() < (stage.boss ? CFG.bossTreasureChance : CFG.treasureDropChance)) {
      var pieces = stagePieces(stage);
      var counts = treasureCounts(state, stage.chapter);
      var missing = pieces.filter(function (pi) { return counts[pi] === 0; });
      var piece = missing.length ? missing[0] : pieces[Math.floor(rand() * pieces.length)];
      counts[piece]++;
      rewards.treasure = { chapter: stage.chapter, piece: piece, name: D.CHAPTERS[stage.chapter - 1].treasure.pieces[piece],
        have: counts.filter(function (x) { return x > 0; }).length, complete: treasureComplete(state, stage.chapter) };
    }

    if (count >= stage.monsters && !wasCleared) {
      state.cleared[stage.id] = true;
      rewards.sectionCleared = true;
      rewards.firstClear = true;
      rewards.gems = stage.boss ? CFG.firstClearBossGems : CFG.firstClearGems;
      rewards.points = CFG.pointsPerSectionClear;
      state.attrPoints += rewards.points;
    }

    state.gold += rewards.gold + rewards.chestGold;
    state.gems += rewards.gems;
    state.items.ambrosia += rewards.ambrosia;
    rewards.levelsGained = addPlayerExp(state, rewards.exp);
    out.rewards = rewards;
    out.progress = sectionProgress(state, stage.id);
    out.cleared = !!state.cleared[stage.id];
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
    // Cards from earlier versions of the game become their replacements.
    out.cards.forEach(function (c) { if (c && D.CARD_RENAMES[c.cardId]) { c.cardId = D.CARD_RENAMES[c.cardId]; } });
    out.cards = out.cards.filter(function (c) {
      return c && D.CARD_BY_ID[c.cardId] && typeof c.uid === 'number';
    });
    var uids = out.cards.map(function (c) { return c.uid; });
    out.deck = out.deck.filter(function (u) { return uids.indexOf(u) !== -1; }).slice(0, CFG.maxDeckSize);
    var maxUid = 0;
    out.cards.forEach(function (c) { if (c.uid > maxUid) { maxUid = c.uid; } });
    out.nextUid = Math.max(out.nextUid, maxUid + 1);
    ['gems', 'gold', 'level', 'exp', 'stamina', 'staminaAt', 'pulls', 'attrPoints'].forEach(function (key) {
      if (typeof out[key] !== 'number' || !isFinite(out[key])) { out[key] = base[key]; }
    });
    ['cleared', 'progress', 'attr', 'items', 'treasure'].forEach(function (key) {
      if (!out[key] || typeof out[key] !== 'object' || Array.isArray(out[key])) { out[key] = base[key]; }
    });
    ['stamina', 'atk'].forEach(function (key) {
      if (typeof out.attr[key] !== 'number' || !isFinite(out.attr[key])) { out.attr[key] = 0; }
    });
    // DEF PWR (attr.hp) was removed; give those points back to spend again.
    if (typeof out.attr.hp === 'number' && out.attr.hp > 0) { out.attrPoints += out.attr.hp; }
    delete out.attr.hp;
    // Cure Water was renamed Ambrosia.
    if (typeof out.items.ambrosia !== 'number' || !isFinite(out.items.ambrosia)) { out.items.ambrosia = 0; }
    if (typeof out.items.cureWater === 'number' && out.items.cureWater > 0) { out.items.ambrosia += out.items.cureWater; }
    delete out.items.cureWater;
    Object.keys(out.treasure).forEach(function (k) {
      var t = out.treasure[k];
      if (!Array.isArray(t) || t.length !== 6) { delete out.treasure[k]; }
    });
    if (!D.FACTIONS[out.alignment]) { out.alignment = null; } // old saves: the game asks for one
    out.version = 3;
    out.level = Math.max(1, Math.floor(out.level));
    return out;
  }

  var api = {
    SAVE_KEY: SAVE_KEY, STAGES: STAGES,
    newGame: newGame, findCard: findCard, addCard: addCard,
    maxStamina: maxStamina, staminaCap: staminaCap, expToNext: expToNext, deckCostCap: deckCostCap,
    regenStamina: regenStamina, msUntilNextStamina: msUntilNextStamina,
    spendPoint: spendPoint, useAmbrosia: useAmbrosia, setAlignment: setAlignment,
    skillPct: skillPct, skillText: skillText, skillTitle: skillTitle, applySkills: applySkills, sectionDrops: sectionDrops,
    treasureCounts: treasureCounts, treasureComplete: treasureComplete, claimTreasure: claimTreasure, stagePieces: stagePieces,
    cardStats: cardStats, maxLevel: maxLevel, cardExpToNext: cardExpToNext,
    rateTable: rateTable, summon: summon,
    deckCost: deckCost, setDeck: setDeck, bestDeck: bestDeck,
    fusePreview: fusePreview, fuse: fuse, evolveCost: evolveCost, canEvolve: canEvolve, evolve: evolve,
    sellValue: sellValue, sell: sell,
    getStage: getStage, isUnlocked: isUnlocked, stageEnemies: stageEnemies,
    sectionProgress: sectionProgress, nextFightNo: nextFightNo, battleInfo: battleInfo,
    buildTeam: buildTeam, simulateBattle: simulateBattle, fight: fight,
    serialize: serialize, deserialize: deserialize
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  return api;
})();
