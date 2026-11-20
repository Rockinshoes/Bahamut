/*
 * ui.js - draws the screens and reacts to taps. All the rules live in game.js.
 *
 * Flow of a quest battle, like the original:
 *   Quests tab -> Enter -> party screen (pick your cards, leader first) ->
 *   Battle screen (animated, replays what game.js simulated) -> results screen.
 */
(function () {
  'use strict';

  var G = Game;
  var D = GameData;
  var A = Art;

  var state = null;
  var currentTab = 'quests';
  var cardSort = 'rarity';
  var fuseSel = [];            // card uids picked as fusion material
  var toastTimer = null;

  var party = [];              // card uids picked on the party screen
  var partyStage = null;       // stage id the party screen is for
  var battleRun = 0;           // bumped to cancel a battle replay that is still running
  var speed = 1;               // battle playback speed: 1, 2 or 4
  var skipping = false;
  var current = null;          // the battle result being replayed
  var freshGame = false;       // true when there was no save, so picking an alignment deals starter cards

  // ---------- saving / loading ----------
  function save() {
    try { localStorage.setItem(G.SAVE_KEY, G.serialize(state)); } catch (e) { /* private mode etc. */ }
  }
  function load() {
    try {
      var text = localStorage.getItem(G.SAVE_KEY);
      if (text) {
        var s = G.deserialize(text);
        if (s) { return s; }
      }
    } catch (e) { /* ignore */ }
    freshGame = true;
    return G.newGame();
  }

  // ---------- tiny helpers ----------
  function el(id) { return document.getElementById(id); }
  function icon(faction) {
    var f = D.FACTIONS[faction];
    return '<span class="fx" style="color:' + f.color + '">' + f.icon + '</span>';
  }
  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  function openModal(html) {
    el('modal').innerHTML = html;
    el('modal-backdrop').hidden = false;
  }
  function closeModal() { el('modal-backdrop').hidden = true; el('modal').innerHTML = ''; }

  function openScreen(html) { var s = el('screen'); s.innerHTML = html; s.hidden = false; }
  function closeScreen() {
    battleRun++;
    skipping = false;
    var s = el('screen');
    s.hidden = true;
    s.innerHTML = '';
    render();
  }

  // Custom art: assets/cards/<card-id>.png. We check once at startup which images
  // exist; cards without one keep the drawn placeholder (js/art.js).
  var artOk = {};
  function probeArt() {
    var pending = false;
    D.CARDS.forEach(function (c) {
      var img = new Image();
      img.onload = function () {
        artOk[c.id] = true;
        if (!pending) {
          pending = true;
          setTimeout(function () {
            pending = false;
            if (el('modal-backdrop').hidden && el('screen').hidden) { render(); }
          }, 50);
        }
      };
      img.src = 'assets/cards/' + c.id + '.png';
    });
  }
  function artFor(def) {
    return A.card(def) + (artOk[def.id] ? '<img src="assets/cards/' + def.id + '.png" alt="">' : '');
  }

  // attrs: extra attributes for the card's outer tag; extra: extra markup placed inside the card.
  function cardHtml(card, cls, attrs, extra) {
    var def = D.CARD_BY_ID[card.cardId];
    var st = G.cardStats(card);
    var stars = card.evo ? ' <span class="evo">' + new Array(card.evo + 1).join('★') + '</span>' : '';
    return '<div class="card r-' + def.rarity + ' ' + (cls || '') + '" ' + (attrs || '') + ' data-uid="' + card.uid + '">' +
      '<div class="art">' + artFor(def) + '</div>' +
      '<span class="rar">' + def.rarity + '</span>' +
      '<span class="lv">Lv' + card.level + stars + '</span>' + (extra || '') +
      '<div class="info"><div class="nm">' + icon(def.faction) + ' ' + def.name + '</div><div class="stat">ATK ' + st.atk + ' DEF ' + st.hp + '</div></div></div>';
  }

  function sortedCards(cards, mode) {
    var order = D.RARITY_ORDER;
    var list = cards.slice();
    list.sort(function (a, b) {
      var da = D.CARD_BY_ID[a.cardId], db = D.CARD_BY_ID[b.cardId];
      if (mode === 'power') {
        var sa = G.cardStats(a), sb = G.cardStats(b);
        return (sb.atk + sb.hp / 4) - (sa.atk + sa.hp / 4) || b.uid - a.uid;
      }
      if (mode === 'level') { return (b.level + b.evo * 100) - (a.level + a.evo * 100) || b.uid - a.uid; }
      if (mode === 'recent') { return b.uid - a.uid; }
      if (mode === 'faction') {
        return D.FACTION_ORDER.indexOf(da.faction) - D.FACTION_ORDER.indexOf(db.faction) || order.indexOf(db.rarity) - order.indexOf(da.rarity);
      }
      var r = order.indexOf(db.rarity) - order.indexOf(da.rarity);
      return r || (b.level + b.evo * 100) - (a.level + a.evo * 100) || b.uid - a.uid;
    });
    return list;
  }

  // ---------- top bar ----------
  function renderTopbar() {
    G.regenStamina(state);
    var max = G.staminaCap(state);
    el('s-level').textContent = state.level;
    el('s-stamina').textContent = state.stamina + '/' + max;
    el('s-stamina-bar').style.width = Math.min(100, state.stamina / max * 100) + '%';
    el('s-gems').textContent = state.gems;
    el('s-gold').textContent = state.gold;
    var ms = G.msUntilNextStamina(state);
    el('s-stamina-timer').textContent = ms > 0 ? 'next +1 in ' + Math.ceil(ms / 1000) + 's' : 'full';
  }

  // ---------- tabs ----------
  function pips(done, total) {
    var s = '';
    for (var i = 0; i < total; i++) { s += i < done ? '●' : '○'; }
    return s;
  }

  function attrSummary() {
    var a = state.attr;
    return 'Max stamina ' + G.staminaCap(state) + ' \u00B7 ATK PWR ' + G.deckCostCap(state) + ' (your party cost limit)';
  }

  // A chapter's 6-piece treasure set: filled diamonds for pieces you own, and a Claim
  // button once you have all six.
  function treasureHtml(ch) {
    var counts = G.treasureCounts(state, ch.id);
    var have = counts.filter(function (n) { return n > 0; }).length;
    var dots = counts.map(function (n, i) {
      return '<span class="tr' + (n > 0 ? ' have' : '') + '" title="' + ch.treasure.pieces[i] + '">\u25C6</span>';
    }).join('');
    return '<div class="panel treasure row"><span class="grow"><b>' + ch.treasure.name + '</b> <span class="muted">' + have + '/6</span><br>' + dots +
      '<span class="muted" style="font-size:12px"> \u00B7 complete for a ' + D.RARITIES[ch.treasure.reward].name + ' card</span></span>' +
      (have === 6 ? '<button class="btn small" data-action="claim" data-ch="' + ch.id + '">Claim</button>' : '') + '</div>';
  }

  function renderQuests() {
    var need = G.expToNext(state.level);
    var html = '<h2>Quests</h2>' +
      '<div class="panel"><div class="row"><b>Level ' + state.level + '</b><span class="spacer"></span><span class="muted">' + state.exp + ' / ' + need + ' exp</span></div>' +
      '<div class="bar" style="height:7px;margin-top:6px"><div style="width:' + Math.min(100, state.exp / need * 100) + '%"></div></div></div>';

    if (state.attrPoints > 0) {
      html += '<div class="panel pts"><b>' + state.attrPoints + ' attribute point' + (state.attrPoints === 1 ? '' : 's') + ' to spend</b>' +
        '<div class="row wrap" style="margin-top:8px">' +
        '<button class="btn small" data-action="point" data-kind="stamina">Stamina +' + D.CONFIG.staminaPerPoint + '</button>' +
        '<button class="btn small" data-action="point" data-kind="atk">ATK PWR +' + D.CONFIG.atkPowerPerPoint + '</button></div>' +
        '<div class="muted" style="margin-top:6px;font-size:12px">ATK PWR is the most total card cost your party can have.</div>' +
        '<div class="muted" style="margin-top:6px;font-size:12px">' + attrSummary() + '</div></div>';
    }
    if (state.items.ambrosia > 0) {
      html += '<div class="panel row"><span><b>Ambrosia x' + state.items.ambrosia + '</b><br><span class="muted">Refills all your stamina</span></span><span class="spacer"></span>' +
        '<button class="btn small" data-action="ambrosia"' + (state.stamina >= G.staminaCap(state) ? ' disabled' : '') + '>Use</button></div>';
    }

    D.CHAPTERS.forEach(function (ch) {
      html += '<div class="chapter-title">Chapter ' + ch.id + ': ' + ch.name + ' <span class="muted" style="font-weight:400;font-size:13px">' + icon(ch.faction) + ' ' + D.FACTIONS[ch.faction].name + ' foes</span></div>' + treasureHtml(ch);
      G.STAGES.filter(function (s) { return s.chapter === ch.id; }).forEach(function (s) {
        var unlocked = G.isUnlocked(state, s.id);
        var cleared = !!state.cleared[s.id];
        var foes = G.stageEnemies(s, G.nextFightNo(state, s.id));
        html += '<div class="stage' + (unlocked ? '' : ' locked') + '">' +
          '<div class="grow"><div class="name">' + s.id + (s.boss ? ' <span class="badge boss">BOSS</span>' : '') +
          (cleared ? ' <span class="cleared">Cleared</span>' : '') + '</div>' +
          '<div class="pips">' + pips(G.sectionProgress(state, s.id), s.monsters) + '</div>' +
          '<div class="muted" style="font-size:12px">Drops: ' + G.sectionDrops(s).map(function (id) {
            var d = D.CARD_BY_ID[id];
            return icon(d.faction) + ' ' + d.name + ' <span class="rar-tag">' + d.rarity + '</span>';
          }).join(' \u00B7 ') + '</div>' +
          '<div class="muted" style="font-size:12px">Treasure: ' + G.stagePieces(s).map(function (pi) {
            var have = G.treasureCounts(state, ch.id)[pi] > 0;
            return '<span class="tr' + (have ? ' have' : '') + '">\u25C6 ' + ch.treasure.pieces[pi] + '</span>';
          }).join(' ') + '</div>' +
          '<div class="muted">' + (s.boss ? 'Boss battle' : 'Monster ' + G.nextFightNo(state, s.id) + ' of ' + s.monsters) + ' \u00B7 ' + foes.length + ' foes \u00B7 ' + s.staminaCost + ' stamina</div></div>' +
          '<button class="btn small" data-action="enter" data-stage="' + s.id + '"' + (unlocked ? '' : ' disabled') + '>' + (s.boss ? 'Challenge' : 'Enter') + '</button></div>';
      });
    });
    return html;
  }

  function renderCards() {
    var html = '<h2>Cards (' + state.cards.length + ')</h2><div class="row"><span class="muted">Sort</span>' +
      '<select data-action="sort">';
    ['rarity', 'level', 'recent', 'faction'].forEach(function (m) {
      html += '<option value="' + m + '"' + (m === cardSort ? ' selected' : '') + '>' + m + '</option>';
    });
    html += '</select></div><h3>Tap a card to fuse, evolve or sell it</h3><div class="card-grid">';
    sortedCards(state.cards, cardSort).forEach(function (c) {
      html += cardHtml(c, '', 'data-action="card-open"');
    });
    return html + '</div>';
  }

  function renderDeck() {
    var cost = G.deckCost(state, state.deck);
    var cap = G.deckCostCap(state);
    var html = '<h2>Deck</h2><div class="row"><span>Cost / ATK PWR <b class="' + (cost > cap ? 'cost-over' : 'cost-ok') + '">' + cost + ' / ' + cap + '</b></span>' +
      '<span class="spacer"></span><button class="btn small secondary" data-action="deck-clear">Clear</button>' +
      '<button class="btn small" data-action="deck-auto">Auto-fill</button></div>' +
      '<p class="muted" style="margin:6px 0">Your party\'s total card cost can\'t go over your ATK PWR (raise it with attribute points). The first card is your leader (+20% ATK and DEF); tap \u2605 to change it. You can also pick a different party before every battle.</p><div class="slots">';
    for (var i = 0; i < D.CONFIG.maxDeckSize; i++) {
      var c = state.deck[i] ? G.findCard(state, state.deck[i]) : null;
      html += '<div class="slot">' + (c ? cardHtml(c, '', 'data-action="deck-toggle"', i === 0 ? '<span class="lead">LEADER</span>' : '') +
        (i > 0 ? '<button class="star" data-action="deck-lead" data-uid="' + c.uid + '">★</button>' : '') : '+') + '</div>';
    }
    html += '</div><h3>Your cards (tap to add or remove)</h3><div class="card-grid">';
    sortedCards(state.cards, 'rarity').forEach(function (c) {
      var inDeck = state.deck.indexOf(c.uid) !== -1;
      html += cardHtml(c, inDeck ? 'selected' : '', 'data-action="deck-toggle"');
    });
    return html + '</div>';
  }

  function renderSummon() {
    var rates = G.rateTable();
    var html = '<h2>Summon</h2><div class="panel"><div class="row wrap">' +
      '<button class="btn" data-action="summon" data-count="1"' + (state.gems < D.CONFIG.singlePullCost ? ' disabled' : '') + '>Summon x1 (' + D.CONFIG.singlePullCost + ' gems)</button>' +
      '<button class="btn" data-action="summon" data-count="10"' + (state.gems < D.CONFIG.tenPullCost ? ' disabled' : '') + '>Summon x10 (' + D.CONFIG.tenPullCost + ' gems)</button></div>' +
      '<p class="muted">A x10 summon always includes at least one ' + D.RARITIES[D.CONFIG.tenPullGuarantee].name + ' or better.</p></div>' +
      '<h3>Rates</h3><table class="rates">';
    D.RARITY_ORDER.forEach(function (r) {
      html += '<tr><td>' + r + ' &ndash; ' + D.RARITIES[r].name + '</td><td>' + rates[r] + '%</td></tr>';
    });
    return html + '</table><p class="muted">Total summons: ' + state.pulls + '. Earn more gems by clearing sections for the first time and by levelling up.</p>';
  }

  function renderMore() {
    return '<h2>More</h2>' +
      '<div class="panel"><b>Your character</b><p class="muted" style="margin:6px 0 0">Alignment: ' + (state.alignment ? icon(state.alignment) + ' ' + D.FACTIONS[state.alignment].name : 'not chosen') +
      '<br>Level ' + state.level + ' \u00B7 ' + attrSummary() +
      '<br>Unspent attribute points: ' + state.attrPoints + ' (spend them on the Quests tab)</p></div>' +
      '<div class="panel"><b>Your own art</b><p class="muted">Every card has drawn placeholder art. To replace one, put an image named after the card id into <code>assets/cards/</code> (for example <code>assets/cards/ember-imp.png</code>) and reload. Card ids are listed in <code>js/data.js</code>.</p></div>' +
      '<div class="panel"><b>Save backup</b><p class="muted">Your game saves in this browser automatically. Copy the text below to back it up, or paste a backup and press Import.</p>' +
      '<textarea id="save-box" spellcheck="false"></textarea><div class="row wrap" style="margin-top:8px">' +
      '<button class="btn small secondary" data-action="export">Show my save</button>' +
      '<button class="btn small" data-action="import">Import</button></div></div>' +
      '<div class="panel"><b>Testing</b><div class="row wrap" style="margin-top:8px">' +
      '<button class="btn small secondary" data-action="gems">+1000 gems</button>' +
      '<button class="btn small secondary" data-action="gold">+5000 gold</button>' +
      '<button class="btn small secondary" data-action="stamina-fill">Fill stamina</button>' +
      '<button class="btn small secondary" data-action="align-open">Change alignment</button>' +
      '<button class="btn small danger" data-action="reset">Reset game</button></div></div>';
  }

  function render() {
    renderTopbar();
    var view = el('view');
    var scroll = view.scrollTop;
    var html = '';
    if (currentTab === 'quests') { html = renderQuests(); }
    else if (currentTab === 'cards') { html = renderCards(); }
    else if (currentTab === 'deck') { html = renderDeck(); }
    else if (currentTab === 'summon') { html = renderSummon(); }
    else { html = renderMore(); }
    view.innerHTML = html;
    view.scrollTop = scroll;
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === currentTab);
    });
  }

  // ---------- alignment picker (first launch, old saves, or "Change alignment") ----------
  function showAlignment() {
    var html = '<div class="sc-head"><h2>Choose your alignment</h2></div><div class="sc-body">' +
      '<p class="muted" style="margin-top:0">Cards of your alignment get +' + alignPct() + '% ATK and DEF in battle. ' +
      'You can still use cards of any faction.' + (freshGame ? ' You start with one champion of your alignment and build your party from cards you win in quests.' : '') + '</p>';
    D.FACTION_ORDER.forEach(function (fid) {
      var f = D.FACTIONS[fid];
      var showcase = D.CARD_BY_ID[D.CONFIG.starterCards[fid][0]];
      html += '<div class="panel align-pick" style="border-left:4px solid ' + f.color + '">' +
        '<div class="align-art"><div class="bu-card r-' + showcase.rarity + '"><div class="art">' + A.card(showcase) + '</div></div></div>' +
        '<div class="grow"><b style="font-size:17px">' + icon(fid) + ' ' + f.name + '</b>' +
        '<p class="muted" style="margin:4px 0 8px">' + f.blurb + '</p>' +
        (freshGame ? '<p class="muted" style="margin:0 0 8px;font-size:12px">Starter pack: your champion, ' +
          D.CONFIG.starterCards[fid].map(function (id) { return D.CARD_BY_ID[id].name + ' (' + D.CARD_BY_ID[id].rarity + ')'; }).join(', ') + '</p>' : '') +
        '<button class="btn" data-action="align-pick" data-f="' + fid + '">' + (state.alignment === fid ? 'Keep ' : 'Choose ') + f.name + '</button></div></div>';
    });
    openScreen(html + '</div>');
  }

  // ---------- party select screen ----------
  function foeHtml(u) {
    return '<div class="foe"><div class="bu-card r-' + (u.boss ? 'SSR' : 'R') + '"><div class="art">' + A.enemy(u) + '</div>' +
      '<span class="bu-el">' + icon(u.faction) + '</span><div class="bu-name">' + u.name + '</div></div></div>';
  }

  // Cards matching your alignment get a bonus; mark them with a green arrow.
  function advBadge(card) {
    return D.CARD_BY_ID[card.cardId].faction === state.alignment ? '<span class="adv up">\u25B2</span>' : '';
  }

  function alignPct() { return Math.round((D.CONFIG.alignmentBonus - 1) * 100); }

  // Each party slot's skill and its chance to trigger (slot 1 always triggers).
  function partySkillsHtml() {
    if (!party.length) { return ''; }
    var rows = party.map(function (uid, i) {
      var def = D.CARD_BY_ID[G.findCard(state, uid).cardId];
      return '<div class="skill-row"><span class="pct">' + Math.round(D.CONFIG.skillChanceBySlot[i] * 100) + '%</span>' +
        '<span class="grow"><b>' + def.skill.name + '</b> <span class="muted">(' + def.name + ')</span><br>' + G.skillTitle(def) + ' <span class="muted">(' + G.skillText(def) + ')</span></span></div>';
    }).join('');
    return '<h3>Party skills <span style="font-weight:400;font-size:12px">chance to trigger at the start of battle</span></h3><div class="panel" style="padding:6px 12px">' + rows + '</div>';
  }

  function showParty(stageId, keep) {
    var info = G.battleInfo(state, stageId);
    if (!info.ok) { toast(info.error); return; }
    partyStage = stageId;
    if (!keep) { party = state.deck.slice(); }
    party = party.filter(function (u) { return !!G.findCard(state, u); });
    renderParty();
  }

  function renderParty() {
    G.regenStamina(state);
    var info = G.battleInfo(state, partyStage);
    var st = info.stage;
    var cost = G.deckCost(state, party);
    var cap = G.deckCostCap(state);
    var enough = state.stamina >= st.staminaCost;
    var ok = party.length > 0 && cost <= cap && enough;
    var team = G.buildTeam(state, party);
    var atk = team.reduce(function (s, u) { return s + u.atk; }, 0);
    var hp = team.reduce(function (s, u) { return s + u.maxHp; }, 0);
    var foeF = D.FACTIONS[info.enemies[0].faction];
    var myF = D.FACTIONS[state.alignment];
    var tip = 'These foes are ' + icon(info.enemies[0].faction) + ' ' + foeF.name + ' (' + foeF.blurb.split('.')[0].toLowerCase() + '). ' +
      'Your ' + icon(state.alignment) + ' ' + myF.name + ' cards get +' + alignPct() + '% ATK and DEF (\u25B2).';
    var reason = !party.length ? 'Pick at least one card' : (cost > cap ? 'Cost is over your ATK PWR' : (!enough ? 'Need ' + st.staminaCost + ' stamina (you have ' + state.stamina + ')' : ''));

    var html = '<div class="sc-head"><button class="btn small secondary" data-action="party-back">‹ Back</button>' +
      '<h2>' + (st.boss ? 'Chapter ' + st.chapter + ' boss' : 'Section ' + st.id + ' · Monster ' + info.fightNo + ' of ' + info.monsters) + '</h2></div>' +
      '<div class="sc-body"><h3 style="margin-top:0">Enemies</h3><div class="foes">' + info.enemies.map(foeHtml).join('') + '</div>' +
      '<p class="muted" style="text-align:center;margin:0 0 10px">' + tip + '</p>' +
      '<div class="row"><h3 style="margin:0">Your party</h3><span class="spacer"></span><span>Cost / ATK PWR <b class="' + (cost > cap ? 'cost-over' : 'cost-ok') + '">' + cost + ' / ' + cap + '</b></span></div>' +
      '<div class="slots" style="margin-top:6px">';
    for (var i = 0; i < D.CONFIG.maxDeckSize; i++) {
      var c = party[i] ? G.findCard(state, party[i]) : null;
      html += '<div class="slot">' + (c ? cardHtml(c, '', 'data-action="party-toggle"', i === 0 ? '<span class="lead">LEADER</span>' : '') +
        (i > 0 ? '<button class="star" data-action="party-lead" data-uid="' + c.uid + '">★</button>' : '') : '+') + '</div>';
    }
    html += '</div><p class="muted" style="margin:4px 0 0">Party power: ATK ' + atk + ' \u00B7 DEF ' + hp + '. The first card is the leader (+20%). Tap a card to remove it, \u2605 to make it leader.</p>' +
      partySkillsHtml() +
      '<h3>Your cards</h3><div class="card-grid">';
    sortedCards(state.cards, 'power').forEach(function (cd) {
      var inP = party.indexOf(cd.uid) !== -1;
      html += cardHtml(cd, inP ? 'selected' : '', 'data-action="party-toggle"', advBadge(cd));
    });
    html += '</div></div><div class="sc-foot">' +
      '<button class="btn secondary" data-action="party-auto">Auto-fill</button>' +
      '<button class="btn big" data-action="party-go"' + (ok ? '' : ' disabled') + '>' + (ok ? 'Battle! (−' + st.staminaCost + ' stamina)' : reason) + '</button></div>';
    var body = el('screen').querySelector('.sc-body');
    var keepScroll = body ? body.scrollTop : 0;
    openScreen(html);
    el('screen').querySelector('.sc-body').scrollTop = keepScroll;
  }

  // ---------- battle screen ----------
  function unitHtml(u, side, i) {
    var svg = side === 'p' ? artFor(D.CARD_BY_ID[u.cardId]) : A.enemy(u);
    var rar = side === 'p' ? u.rarity : (u.boss ? 'SSR' : 'R');
    return '<div class="bu' + (u.boss ? ' boss' : '') + '" data-side="' + side + '" data-i="' + i + '">' +
      '<div class="bu-card r-' + rar + '"><div class="art">' + svg + '</div>' +
      '<span class="bu-el">' + icon(u.faction) + '</span>' + (u.leader ? '<span class="bu-lead">\u2605</span>' : '') +
      '<div class="bu-name">' + u.name + '</div></div>' +
      '<div class="hpbar"><i></i></div><div class="hpnum">' + u.hp + '</div></div>';
  }

  function unitEl(side, i) {
    return el('screen').querySelector('.bu[data-side="' + side + '"][data-i="' + i + '"]');
  }

  function setHp(side, i, hp) {
    var u = unitEl(side, i);
    if (!u) { return; }
    var list = side === 'p' ? current.units.player : current.units.enemy;
    var ratio = hp / list[i].maxHp;
    u.querySelector('.hpbar i').style.width = (ratio * 100) + '%';
    u.querySelector('.hpnum').textContent = hp;
    u.classList.toggle('mid', ratio < 0.6 && ratio >= 0.3);
    u.classList.toggle('low', ratio < 0.3);
    u.classList.toggle('dead', hp <= 0);
  }

  function updateSpeedButtons() {
    Array.prototype.forEach.call(el('screen').querySelectorAll('.b-top [data-action="speed"]'), function (b) {
      b.classList.toggle('on', parseInt(b.getAttribute('data-s'), 10) === speed);
    });
  }

  function spawnDamage(targetEl, e) {
    var field = el('screen').querySelector('.b-field');
    if (!field) { return; }
    var fr = field.getBoundingClientRect();
    var tr = targetEl.querySelector('.bu-card').getBoundingClientRect();
    var d = document.createElement('div');
    d.className = 'dmg' + (e.dead ? ' strong' : '');
    d.textContent = e.dmg;
    d.style.left = (tr.left - fr.left + tr.width / 2) + 'px';
    d.style.top = (tr.top - fr.top + tr.height / 2) + 'px';
    field.appendChild(d);
    setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 1000);
  }

  function startBattle(res) {
    battleRun++;
    var run = battleRun;
    skipping = false;
    current = res;
    var tint = D.FACTIONS[D.CHAPTERS[res.stage.chapter - 1].faction].color + '44';
    var html = '<div class="battle"><div class="b-top"><span class="round" id="b-round">Battle start</span>' +
      '<button data-action="speed" data-s="1">1x</button><button data-action="speed" data-s="2">2x</button>' +
      '<button data-action="speed" data-s="4">4x</button><button data-action="skip">Skip</button></div>' +
      '<div class="b-field" style="--field:' + tint + '">' +
      '<div class="b-row">' + res.units.enemy.map(function (u, i) { return unitHtml(u, 'e', i); }).join('') + '</div>' +
      '<div class="b-mid" id="b-mid">' + (res.stage.boss ? 'Boss battle' : 'Monster ' + res.fightNo + ' of ' + res.monsters) + '</div>' +
      '<div class="b-row">' + res.units.player.map(function (u, i) { return unitHtml(u, 'p', i); }).join('') + '</div></div>' +
      '<div class="b-log" id="b-log">&nbsp;</div></div>';
    openScreen(html);
    updateSpeedButtons();
    playBattle(res, run).then(function (finished) {
      if (!finished || run !== battleRun) { return; }
      setTimeout(function () { if (run === battleRun) { showResult(res); } }, skipping ? 150 : 700 / speed);
    });
  }

  // Replays the recorded hits one by one: lunge, flash, damage number, health bar.
  async function playBattle(res, run) {
    var ev = res.events;
    var names = { p: res.units.player, e: res.units.enemy };
    for (var k = 0; k < ev.length; k++) {
      if (run !== battleRun) { return false; }
      if (skipping) { break; }
      var e = ev[k];
      if (e.t === 'skill') {
        var su = unitEl('p', e.from);
        if (su) { su.classList.add('skill'); }
        el('b-mid').textContent = e.name + '!';
        el('b-log').textContent = names.p[e.from].name + ' \u2014 ' + e.title + ' (' + e.text + ')';
        await sleep(1100 / speed);
        if (su) { su.classList.remove('skill'); }
        continue;
      }
      if (e.t === 'round') {
        el('b-round').textContent = 'Round ' + e.n;
        await sleep(300 / speed);
      } else if (e.t === 'hit') {
        var otherSide = e.side === 'p' ? 'e' : 'p';
        var from = unitEl(e.side, e.from), to = unitEl(otherSide, e.to);
        if (!from || !to) { continue; }
        var fc = from.querySelector('.bu-card');
        var fr = fc.getBoundingClientRect(), tr = to.querySelector('.bu-card').getBoundingClientRect();
        var dx = (tr.left + tr.width / 2) - (fr.left + fr.width / 2);
        var dy = (tr.top + tr.height / 2) - (fr.top + fr.height / 2);
        from.style.zIndex = 5;
        fc.style.transform = 'translate(' + (dx * 0.7) + 'px,' + (dy * 0.7) + 'px) scale(1.1)';
        el('b-log').textContent = names[e.side][e.from].name + ' hits ' + names[otherSide][e.to].name + ' for ' + e.dmg +
          (e.dead ? ' - defeated!' : '');
        await sleep(170 / speed);
        if (run !== battleRun) { return false; }
        to.classList.add('hit');
        spawnDamage(to, e);
        setHp(otherSide, e.to, e.hp);
        await sleep(300 / speed);
        to.classList.remove('hit');
        fc.style.transform = '';
        await sleep(150 / speed);
        from.style.zIndex = '';
      }
    }
    if (run !== battleRun) { return false; }
    if (skipping) {
      // Jump straight to the end: apply the last known health of every unit.
      var last = {};
      ev.forEach(function (x) { if (x.t === 'hit') { last[(x.side === 'p' ? 'e' : 'p') + x.to] = x.hp; } });
      Object.keys(last).forEach(function (key) { setHp(key.charAt(0), parseInt(key.slice(1), 10), last[key]); });
      Array.prototype.forEach.call(el('screen').querySelectorAll('.bu-card'), function (c) { c.style.transform = ''; });
    }
    el('b-round').textContent = res.win ? 'Victory!' : 'Defeat';
    return true;
  }

  // ---------- results screen ----------
  function chestSvg() {
    return '<svg viewBox="0 0 72 60" aria-hidden="true"><circle cx="36" cy="20" r="18" fill="#fff6c8" opacity=".35"/>' +
      '<rect x="6" y="28" width="60" height="28" rx="4" fill="#7a4a1d" stroke="#f0b429" stroke-width="3"/>' +
      '<path d="M6,28 Q36,2 66,28Z" fill="#9a5f26" stroke="#f0b429" stroke-width="3"/>' +
      '<rect x="31" y="30" width="10" height="12" rx="2" fill="#f0b429"/></svg>';
  }

  function showResult(res) {
    var st = res.stage;
    var next = G.STAGES[st.index + 1] || null;
    var html = '<div class="sc-head"><h2>' + (st.boss ? 'Chapter ' + st.chapter + ' boss' : 'Section ' + st.id) + '</h2></div><div class="sc-body">';
    var foot = '';

    if (!res.win) {
      html += '<div class="res-title result-lose">Defeat</div>' +
        '<div class="res-sub">Your party was wiped out. No stamina was spent.</div>' +
        '<div class="panel muted">Try a different party. Bring more cards of your alignment, level your cards up with Fuse, or spend your attribute points.</div>';
      foot = '<button class="btn secondary" data-action="res-quests">Quests</button>' +
        '<button class="btn" data-action="res-party">Change party</button>';
    } else {
      var r = res.rewards;
      html += '<div class="res-title result-win">Victory!</div><div class="res-sub">' +
        (r.sectionCleared ? (st.boss ? 'Boss defeated! Chapter cleared.' : 'Section cleared!') :
          (st.boss ? 'Boss defeated!' : 'Monster ' + res.fightNo + ' of ' + res.monsters + ' defeated')) +
        (st.boss ? '' : '<br><span class="pips">' + pips(res.fightNo, res.monsters) + '</span>') + '</div>';
      html += '<div class="panel"><div class="reward"><span>Experience</span><b>+' + r.exp + '</b></div>' +
        '<div class="reward"><span>Gold</span><b>+' + r.gold + '</b></div>' +
        (r.gems ? '<div class="reward"><span>Gems (first clear)</span><b>+' + r.gems + '</b></div>' : '') +
        (r.ambrosia ? '<div class="reward"><span>Ambrosia</span><b>+' + r.ambrosia + '</b></div>' : '') +
        (r.treasure ? '<div class="reward"><span>Treasure: ' + r.treasure.name + '</span><b>' + r.treasure.have + '/6</b></div>' : '') +
        (r.points ? '<div class="reward"><span>Attribute point (first clear)</span><b>+' + r.points + '</b></div>' : '') + '</div>';
      if (r.treasure && r.treasure.complete) {
        html += '<div class="levelup">Treasure set complete! Claim your card on the Quests tab.</div>';
      }
      if (r.levelsGained) {
        html += '<div class="levelup">Level up! You are now level ' + state.level + '.<br>+' + (r.levelsGained * D.CONFIG.pointsPerLevel) + ' attribute points. Stamina refilled.</div>';
      }
      if (r.chest) {
        html += '<div class="panel chest">' + chestSvg() + '<b>Treasure chest!</b>' +
          (r.chestGold ? '<div class="muted">+' + r.chestGold + ' gold</div>' : '') + '</div>';
      }
      if (r.cards.length) {
        html += '<h3 style="text-align:center">You found</h3><div class="found">' + r.cards.map(function (c) { return cardHtml(c); }).join('') + '</div>';
      }
      var again = (r.sectionCleared && next) ? 'res-next' : 'res-again';
      foot = '<button class="btn secondary" data-action="res-quests">Quests</button>' +
        '<button class="btn secondary" data-action="res-party">Change party</button>' +
        '<button class="btn" data-action="' + again + '">' + (again === 'res-next' ? 'Next section' : 'Fight again') + '</button>';
    }
    html += '</div><div class="sc-foot" style="flex-wrap:wrap">' + foot + '</div>';
    openScreen(html);
    render();
  }

  // ---------- modals ----------
  function showCardDetail(uid) {
    var card = G.findCard(state, uid);
    if (!card) { closeModal(); return; }
    var def = D.CARD_BY_ID[card.cardId];
    var st = G.cardStats(card);
    var inDeck = state.deck.indexOf(uid) !== -1;
    var html = '<div style="width:150px;margin:0 auto 10px">' + cardHtml(card) + '</div>' +
      '<h2 style="text-align:center">' + def.name + '</h2>' +
      '<p class="muted" style="text-align:center">' + icon(def.faction) + ' ' + D.FACTIONS[def.faction].name +
      (def.faction === state.alignment ? ' (your alignment, +' + alignPct() + '% in battle)' : '') +
      ' &middot; ' + D.RARITIES[def.rarity].name + ' &middot; ' + D.CARD_TYPES[def.type].name + ' type &middot; cost ' + st.cost + (inDeck ? ' &middot; in deck' : '') + '</p>' +
      '<div class="panel">Level ' + card.level + ' / ' + st.maxLevel + (card.level < st.maxLevel ? ' &middot; exp ' + card.exp + ' / ' + G.cardExpToNext(card) : ' (max)') +
      '<br>Evolution ' + card.evo + ' / ' + D.CONFIG.maxEvo + '<br>ATK ' + st.atk + ' &middot; DEF ' + st.hp + '</div>' +
      '<div class="panel"><b>Skill: ' + def.skill.name + '</b><br>' + G.skillTitle(def) + ' <span class="muted">(' + G.skillText(def) + ')</span>' +
      '<br><span class="muted" style="font-size:12px">Triggers at the start of battle: always in party slot 1, less often in later slots.</span></div>' +
      '<div class="row wrap">' +
      '<button class="btn" data-action="fuse-open" data-uid="' + uid + '">Fuse</button>' +
      '<button class="btn" data-action="evolve-open" data-uid="' + uid + '">Evolve</button>' +
      '<button class="btn danger" data-action="sell-card" data-uid="' + uid + '"' + (inDeck ? ' disabled' : '') + '>Sell (' + G.sellValue(card) + ' gold)</button>' +
      '<span class="spacer"></span><button class="btn secondary" data-action="close">Close</button></div>';
    openModal(html);
  }

  function showFuse(baseUid) {
    var base = G.findCard(state, baseUid);
    if (!base) { closeModal(); return; }
    fuseSel = fuseSel.filter(function (u) { return !!G.findCard(state, u); });
    var preview = G.fusePreview(state, baseUid, fuseSel);
    var html = '<h2>Fuse into ' + D.CARD_BY_ID[base.cardId].name + '</h2>' +
      '<p class="muted">Pick cards to use up. Cards of the same faction give ' + D.CONFIG.sameFactionFuseMult + 'x exp. Cards in your deck are hidden.</p>' +
      '<div class="panel">Gain <b>' + preview.exp + '</b> exp &middot; costs <b>' + preview.gold + '</b> gold (you have ' + state.gold + ')</div>' +
      '<div class="card-grid">';
    var mats = sortedCards(state.cards, 'rarity').filter(function (c) { return c.uid !== baseUid && state.deck.indexOf(c.uid) === -1; });
    mats.forEach(function (c) {
      html += cardHtml(c, fuseSel.indexOf(c.uid) !== -1 ? 'selected' : '', 'data-action="fuse-toggle" data-base="' + baseUid + '"');
    });
    if (!mats.length) { html += '<p class="muted">No spare cards. Clear quests or summon more.</p>'; }
    html += '</div><p class="row"><button class="btn" data-action="fuse-confirm" data-uid="' + baseUid + '"' + (fuseSel.length ? '' : ' disabled') + '>Fuse</button>' +
      '<button class="btn secondary" data-action="card-open" data-uid="' + baseUid + '">Back</button></p>';
    openModal(html);
  }

  function showEvolve(uid) {
    var card = G.findCard(state, uid);
    if (!card) { closeModal(); return; }
    var chk = G.canEvolve(state, uid);
    var html = '<h2>Evolve ' + D.CARD_BY_ID[card.cardId].name + '</h2>';
    if (!chk.ok) {
      html += '<p>' + chk.error + '</p>';
    } else {
      html += '<p class="muted">Uses up another copy of the same card (not in your deck) and ' + G.evolveCost(card) + ' gold. Raises the level cap by 10 and boosts stats by 30%.</p><div class="card-grid">';
      var copies = state.cards.filter(function (c) { return c.cardId === card.cardId && c.uid !== uid && state.deck.indexOf(c.uid) === -1; });
      copies.forEach(function (c) { html += cardHtml(c, '', 'data-action="evolve-pick" data-base="' + uid + '"'); });
      if (!copies.length) { html += '<p class="muted">You need a second copy of this card.</p>'; }
      html += '</div>';
    }
    html += '<p><button class="btn secondary" data-action="card-open" data-uid="' + uid + '">Back</button></p>';
    openModal(html);
  }

  function showSummonResults(cards) {
    var html = '<h2>Summon results</h2><div class="pull-results">';
    cards.forEach(function (c) { html += cardHtml(c); });
    html += '</div><div class="row"><button class="btn" data-action="close">Nice</button></div>';
    openModal(html);
  }

  function confirmModal(message, action) {
    openModal('<h2>Are you sure?</h2><p>' + message + '</p><div class="row">' +
      '<button class="btn danger" data-action="' + action + '">Yes</button>' +
      '<button class="btn secondary" data-action="close">Cancel</button></div>');
  }

  // ---------- actions ----------
  function act(name, node) {
    var uid = node.getAttribute('data-uid') ? parseInt(node.getAttribute('data-uid'), 10) : null;
    var res;
    switch (name) {
      case 'close': closeModal(); break;

      case 'align-open': showAlignment(); break;
      case 'align-pick': {
        var fid = node.getAttribute('data-f');
        if (freshGame) { state = G.newGame({ alignment: fid }); freshGame = false; }
        else { G.setAlignment(state, fid); }
        save(); closeScreen(); toast('You are ' + D.FACTIONS[fid].name + '.');
        break;
      }

      // quests and battles
      case 'enter': {
        var sid = node.getAttribute('data-stage');
        if (!G.isUnlocked(state, sid)) { toast('Clear the previous section first.'); break; }
        showParty(sid, false);
        break;
      }
      case 'party-back': closeScreen(); break;
      case 'party-toggle': {
        var pi = party.indexOf(uid);
        if (pi !== -1) { party.splice(pi, 1); }
        else if (party.length >= D.CONFIG.maxDeckSize) { toast('A party holds at most ' + D.CONFIG.maxDeckSize + ' cards.'); break; }
        else { party.push(uid); }
        renderParty();
        break;
      }
      case 'party-lead': {
        var li = party.indexOf(uid);
        if (li > 0) { party.splice(li, 1); party.unshift(uid); }
        renderParty();
        break;
      }
      case 'party-auto': party = G.bestDeck(state); renderParty(); break;
      case 'party-go':
        res = G.fight(state, partyStage, { deck: party });
        if (!res.ok) { toast(res.error); break; }
        save();
        startBattle(res);
        break;
      case 'speed': speed = parseInt(node.getAttribute('data-s'), 10); updateSpeedButtons(); break;
      case 'skip': skipping = true; break;
      case 'res-quests': closeScreen(); break;
      case 'res-party': showParty(current.stage.id, false); break;
      case 'res-next': showParty(G.STAGES[current.stage.index + 1].id, false); break;
      case 'res-again':
        res = G.fight(state, current.stage.id, {});
        if (!res.ok) { toast(res.error); break; }
        save();
        startBattle(res);
        break;
      case 'point':
        res = G.spendPoint(state, node.getAttribute('data-kind'));
        if (!res.ok) { toast(res.error); break; }
        save(); render();
        break;
      case 'claim':
        res = G.claimTreasure(state, parseInt(node.getAttribute('data-ch'), 10));
        if (!res.ok) { toast(res.error); break; }
        save(); render();
        openModal('<h2>Treasure claimed!</h2><p class="muted">You traded in a full set for:</p><div style="width:140px;margin:0 auto 12px">' +
          cardHtml(res.card) + '</div><div class="row"><button class="btn" data-action="close">Nice</button></div>');
        break;
      case 'ambrosia':
        res = G.useAmbrosia(state);
        if (!res.ok) { toast(res.error); break; }
        save(); render(); toast('Stamina refilled.');
        break;

      case 'sort': cardSort = node.value; render(); break;
      case 'card-open': showCardDetail(uid); break;

      // deck tab
      case 'deck-toggle': {
        var deck = state.deck.slice();
        var idx = deck.indexOf(uid);
        if (idx !== -1) { deck.splice(idx, 1); } else { deck.push(uid); }
        res = G.setDeck(state, deck);
        if (!res.ok) { toast(res.error); break; }
        save(); render();
        break;
      }
      case 'deck-lead': {
        var d2 = state.deck.slice();
        var j = d2.indexOf(uid);
        if (j > 0) { d2.splice(j, 1); d2.unshift(uid); G.setDeck(state, d2); save(); render(); }
        break;
      }
      case 'deck-clear': G.setDeck(state, []); save(); render(); break;
      case 'deck-auto': G.setDeck(state, G.bestDeck(state)); save(); render(); break;

      case 'summon': {
        res = G.summon(state, parseInt(node.getAttribute('data-count'), 10));
        if (!res.ok) { toast(res.error); break; }
        save(); render(); showSummonResults(res.cards);
        break;
      }

      case 'fuse-open': fuseSel = []; showFuse(uid); break;
      case 'fuse-toggle': {
        var i = fuseSel.indexOf(uid);
        if (i !== -1) { fuseSel.splice(i, 1); } else { fuseSel.push(uid); }
        showFuse(parseInt(node.getAttribute('data-base'), 10));
        break;
      }
      case 'fuse-confirm':
        res = G.fuse(state, uid, fuseSel.slice());
        if (!res.ok) { toast(res.error); break; }
        fuseSel = [];
        save(); render(); showCardDetail(uid);
        toast('+' + res.gained + ' exp' + (res.levelsGained ? ' (+' + res.levelsGained + ' levels)' : ''));
        break;

      case 'evolve-open': showEvolve(uid); break;
      case 'evolve-pick': {
        var baseUid = parseInt(node.getAttribute('data-base'), 10);
        res = G.evolve(state, baseUid, uid);
        if (!res.ok) { toast(res.error); break; }
        save(); render(); showCardDetail(baseUid); toast('Evolved!');
        break;
      }

      case 'sell-card':
        res = G.sell(state, [uid]);
        if (!res.ok) { toast(res.error); break; }
        save(); render(); closeModal(); toast('Sold for ' + res.gold + ' gold');
        break;

      // more tab
      case 'export': el('save-box').value = G.serialize(state); break;
      case 'import': {
        var s = G.deserialize(el('save-box').value);
        if (!s) { toast('That does not look like a valid save.'); break; }
        state = s; save(); render(); toast('Save imported.');
        break;
      }
      case 'gems': state.gems += 1000; save(); render(); break;
      case 'gold': state.gold += 5000; save(); render(); break;
      case 'stamina-fill': state.stamina = G.staminaCap(state); save(); render(); break;
      case 'reset': confirmModal('This deletes your whole game and starts over.', 'reset-confirm'); break;
      case 'reset-confirm': state = G.newGame(); freshGame = true; save(); closeModal(); render(); showAlignment(); break;
    }
  }

  // ---------- wiring ----------
  document.addEventListener('click', function (e) {
    var tab = e.target.closest ? e.target.closest('#tabs button') : null;
    if (tab) { currentTab = tab.getAttribute('data-tab'); render(); return; }
    if (e.target.id === 'modal-backdrop') { closeModal(); return; }
    var node = e.target.closest ? e.target.closest('[data-action]') : null;
    if (node && node.tagName !== 'SELECT' && !node.disabled) { act(node.getAttribute('data-action'), node); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.tagName === 'SELECT' && e.target.getAttribute('data-action')) {
      act(e.target.getAttribute('data-action'), e.target);
    }
  });

  state = load();
  G.regenStamina(state);
  render();
  if (!state.alignment) { showAlignment(); }
  probeArt();
  setInterval(renderTopbar, 1000);
  window.addEventListener('beforeunload', save);
  // Handy for debugging in the browser console.
  window.__game = { get state() { return state; } };
})();
