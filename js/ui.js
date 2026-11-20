/*
 * ui.js - draws the screens and reacts to taps. All the rules live in game.js.
 */
(function () {
  'use strict';

  var G = Game;
  var D = GameData;
  var state = null;
  var currentTab = 'quests';
  var cardSort = 'rarity';
  var fuseSel = [];      // card uids picked as fusion material
  var toastTimer = null;

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
    return G.newGame();
  }

  // ---------- tiny helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function el(id) { return document.getElementById(id); }

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

  // Custom art: assets/cards/<card-id>.png. We check once at startup which images
  // exist, so cards without art just show the colored placeholder.
  var artOk = {};
  function probeArt() {
    var pending = false;
    D.CARDS.forEach(function (c) {
      var img = new Image();
      img.onload = function () {
        artOk[c.id] = true;
        if (!pending) {
          pending = true;
          setTimeout(function () { pending = false; if (el('modal-backdrop').hidden) { render(); } }, 50);
        }
      };
      img.src = 'assets/cards/' + c.id + '.png';
    });
  }

  function cardHtml(card, cls) {
    var def = D.CARD_BY_ID[card.cardId];
    var elem = D.ELEMENTS[def.element];
    var st = G.cardStats(card);
    var stars = card.evo ? ' <span class="evo">' + new Array(card.evo + 1).join('★') + '</span>' : '';
    return '<div class="card r-' + def.rarity + ' ' + (cls || '') + '" data-uid="' + card.uid + '" style="--ec:' + elem.color + '">' +
      '<div class="art">' + elem.icon +
      (artOk[def.id] ? '<img src="assets/cards/' + def.id + '.png" alt="">' : '') + '</div>' +
      '<span class="rar">' + def.rarity + '</span>' +
      '<span class="lv">Lv' + card.level + stars + '</span>' +
      '<div class="info"><div class="nm">' + def.name + '</div>ATK ' + st.atk + ' HP ' + st.hp + '</div></div>';
  }

  function sortedCards(cards, mode) {
    var order = D.RARITY_ORDER;
    var list = cards.slice();
    list.sort(function (a, b) {
      var da = D.CARD_BY_ID[a.cardId], db = D.CARD_BY_ID[b.cardId];
      if (mode === 'level') { return (b.level + b.evo * 100) - (a.level + a.evo * 100) || b.uid - a.uid; }
      if (mode === 'recent') { return b.uid - a.uid; }
      if (mode === 'element') { return da.element < db.element ? -1 : da.element > db.element ? 1 : order.indexOf(db.rarity) - order.indexOf(da.rarity); }
      var r = order.indexOf(db.rarity) - order.indexOf(da.rarity);
      return r || (b.level + b.evo * 100) - (a.level + a.evo * 100) || b.uid - a.uid;
    });
    return list;
  }

  // ---------- top bar ----------
  function renderTopbar() {
    G.regenStamina(state);
    var max = G.maxStamina(state.level);
    el('s-level').textContent = state.level;
    el('s-stamina').textContent = state.stamina + '/' + max;
    el('s-stamina-bar').style.width = Math.min(100, state.stamina / max * 100) + '%';
    el('s-gems').textContent = state.gems;
    el('s-gold').textContent = state.gold;
    var ms = G.msUntilNextStamina(state);
    el('s-stamina-timer').textContent = ms > 0 ? 'next +1 in ' + Math.ceil(ms / 1000) + 's' : 'full';
  }

  // ---------- tabs ----------
  function renderQuests() {
    var html = '<h2>Quests</h2><p class="muted">Exp to next level: ' + state.exp + ' / ' + G.expToNext(state.level) + '. A lost battle costs no stamina.</p>';
    D.CHAPTERS.forEach(function (ch) {
      html += '<div class="chapter-title">Chapter ' + ch.id + ': ' + ch.name + ' ' + D.ELEMENTS[ch.element].icon + '</div>';
      G.STAGES.filter(function (s) { return s.chapter === ch.id; }).forEach(function (s) {
        var unlocked = G.isUnlocked(state, s.id);
        var cleared = !!state.cleared[s.id];
        var foes = G.stageEnemies(s);
        var icons = foes.map(function (f) { return D.ELEMENTS[f.element].icon; }).join('');
        html += '<div class="stage' + (unlocked ? '' : ' locked') + '">' +
          '<div><div class="name">' + s.id + (s.boss ? ' <span class="badge boss">BOSS</span>' : '') + '</div>' +
          '<div class="muted">' + foes.length + ' foes ' + icons + ' &middot; ' + s.staminaCost + ' stamina</div>' +
          (cleared ? '<div class="cleared">Cleared</div>' : '') + '</div>' +
          '<span class="spacer"></span>' +
          '<button class="btn small" data-action="play" data-stage="' + s.id + '"' + (unlocked ? '' : ' disabled') + '>Fight</button></div>';
      });
    });
    return html;
  }

  function renderCards() {
    var html = '<h2>Cards (' + state.cards.length + ')</h2><div class="row"><span class="muted">Sort</span>' +
      '<select data-action="sort">';
    ['rarity', 'level', 'recent', 'element'].forEach(function (m) {
      html += '<option value="' + m + '"' + (m === cardSort ? ' selected' : '') + '>' + m + '</option>';
    });
    html += '</select></div><h3>Tap a card to fuse, evolve or sell it</h3><div class="card-grid">';
    sortedCards(state.cards, cardSort).forEach(function (c) {
      html += cardHtml(c).replace('class="card', 'data-action="card-open" class="card');
    });
    return html + '</div>';
  }

  function renderDeck() {
    var cost = G.deckCost(state, state.deck);
    var cap = G.deckCostCap(state.level);
    var html = '<h2>Deck</h2><div class="row"><span>Cost <b class="' + (cost > cap ? 'cost-over' : 'cost-ok') + '">' + cost + ' / ' + cap + '</b></span>' +
      '<span class="spacer"></span><button class="btn small secondary" data-action="deck-clear">Clear</button>' +
      '<button class="btn small" data-action="deck-auto">Auto-fill</button></div><p></p><div class="slots">';
    for (var i = 0; i < D.CONFIG.maxDeckSize; i++) {
      var c = state.deck[i] ? G.findCard(state, state.deck[i]) : null;
      html += '<div class="slot">' + (c ? cardHtml(c).replace('class="card', 'data-action="deck-toggle" class="card') : '+') + '</div>';
    }
    html += '</div><h3>Your cards (tap to add or remove)</h3><div class="card-grid">';
    sortedCards(state.cards, 'rarity').forEach(function (c) {
      var inDeck = state.deck.indexOf(c.uid) !== -1;
      html += cardHtml(c, inDeck ? 'selected' : '').replace('class="card', 'data-action="deck-toggle" class="card');
    });
    return html + '</div>';
  }

  function renderSummon() {
    var rates = G.rateTable();
    var html = '<h2>Summon</h2><div class="panel"><div class="row wrap">' +
      '<button class="btn" data-action="summon" data-count="1"' + (state.gems < D.CONFIG.singlePullCost ? ' disabled' : '') + '>Summon x1 (' + D.CONFIG.singlePullCost + ' gems)</button>' +
      '<button class="btn" data-action="summon" data-count="10"' + (state.gems < D.CONFIG.tenPullCost ? ' disabled' : '') + '>Summon x10 (' + D.CONFIG.tenPullCost + ' gems)</button></div>' +
      '<p class="muted">A x10 summon always includes at least one Super Rare or better.</p></div>' +
      '<h3>Rates</h3><table class="rates">';
    D.RARITY_ORDER.forEach(function (r) {
      html += '<tr><td>' + r + ' &ndash; ' + D.RARITIES[r].name + '</td><td>' + rates[r] + '%</td></tr>';
    });
    return html + '</table><p class="muted">Total summons: ' + state.pulls + '. Earn more gems by clearing quests for the first time and by levelling up.</p>';
  }

  function renderMore() {
    return '<h2>More</h2>' +
      '<div class="panel"><b>Your own art</b><p class="muted">Put an image named after the card id into <code>assets/cards/</code> (for example <code>assets/cards/ember-imp.png</code>) and reload. Without an image a colored placeholder is shown. Card ids are listed in <code>js/data.js</code>.</p></div>' +
      '<div class="panel"><b>Save backup</b><p class="muted">Your game saves in this browser automatically. Copy the text below to back it up, or paste a backup and press Import.</p>' +
      '<textarea id="save-box" spellcheck="false"></textarea><div class="row wrap" style="margin-top:8px">' +
      '<button class="btn small secondary" data-action="export">Show my save</button>' +
      '<button class="btn small" data-action="import">Import</button></div></div>' +
      '<div class="panel"><b>Testing</b><div class="row wrap" style="margin-top:8px">' +
      '<button class="btn small secondary" data-action="gems">+1000 gems</button>' +
      '<button class="btn small secondary" data-action="gold">+5000 gold</button>' +
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

  // ---------- modals ----------
  function showBattle(res) {
    var html = '<h2 class="' + (res.win ? 'result-win' : 'result-lose') + '">' + (res.win ? 'Victory!' : 'Defeat') +
      ' <span class="muted" style="font-size:13px">Stage ' + res.stage.id + ' &middot; ' + res.rounds + ' rounds</span></h2>';
    if (res.win) {
      var r = res.rewards;
      html += '<div class="panel">+' + r.exp + ' exp &middot; +' + r.gold + ' gold' + (r.gems ? ' &middot; +' + r.gems + ' gems (first clear!)' : '') +
        (r.levelsGained ? '<br><b>Level up! You are now level ' + state.level + '. Stamina refilled.</b>' : '') + '</div>';
      if (r.card) { html += '<p>You found:</p><div style="width:120px">' + cardHtml(r.card) + '</div>'; }
    } else {
      html += '<p class="muted">Your team was wiped out. Level up your cards with Fuse, or try a different deck. No stamina was spent.</p>';
    }
    html += '<h3>Battle log</h3><div class="log">' + res.log.join('\n') + '</div>' +
      '<p><button class="btn" data-action="close">Close</button></p>';
    openModal(html);
  }

  function showCardDetail(uid) {
    var card = G.findCard(state, uid);
    if (!card) { closeModal(); return; }
    var def = D.CARD_BY_ID[card.cardId];
    var st = G.cardStats(card);
    var inDeck = state.deck.indexOf(uid) !== -1;
    var html = '<div class="card-large-wrap" style="width:150px;margin:0 auto 10px">' + cardHtml(card) + '</div>' +
      '<h2 style="text-align:center">' + def.name + '</h2>' +
      '<p class="muted" style="text-align:center">' + D.ELEMENTS[def.element].icon + ' ' + D.ELEMENTS[def.element].name +
      ' &middot; ' + D.RARITIES[def.rarity].name + ' &middot; cost ' + st.cost + (inDeck ? ' &middot; in deck' : '') + '</p>' +
      '<div class="panel">Level ' + card.level + ' / ' + st.maxLevel + (card.level < st.maxLevel ? ' &middot; exp ' + card.exp + ' / ' + G.cardExpToNext(card) : ' (max)') +
      '<br>Evolution ' + card.evo + ' / ' + D.CONFIG.maxEvo + '<br>ATK ' + st.atk + ' &middot; HP ' + st.hp + '</div>' +
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
      '<p class="muted">Pick cards to use up. Same-element cards give 1.5x exp. Cards in your deck are hidden.</p>' +
      '<div class="panel">Gain <b>' + preview.exp + '</b> exp &middot; costs <b>' + preview.gold + '</b> gold (you have ' + state.gold + ')</div>' +
      '<div class="card-grid">';
    var mats = sortedCards(state.cards, 'rarity').filter(function (c) { return c.uid !== baseUid && state.deck.indexOf(c.uid) === -1; });
    mats.forEach(function (c) {
      html += cardHtml(c, fuseSel.indexOf(c.uid) !== -1 ? 'selected' : '').replace('class="card', 'data-action="fuse-toggle" data-base="' + baseUid + '" class="card');
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
      copies.forEach(function (c) { html += cardHtml(c).replace('class="card', 'data-action="evolve-pick" data-base="' + uid + '" class="card'); });
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

      case 'play':
        res = G.playStage(state, node.getAttribute('data-stage'));
        if (!res.ok) { toast(res.error); break; }
        save(); render(); showBattle(res);
        break;

      case 'sort': cardSort = node.value; render(); break;

      case 'card-open': showCardDetail(uid); break;

      case 'deck-toggle': {
        var deck = state.deck.slice();
        var idx = deck.indexOf(uid);
        if (idx !== -1) { deck.splice(idx, 1); } else { deck.push(uid); }
        res = G.setDeck(state, deck);
        if (!res.ok) { toast(res.error); break; }
        save(); render();
        break;
      }
      case 'deck-clear': G.setDeck(state, []); save(); render(); break;
      case 'deck-auto': {
        var cap = G.deckCostCap(state.level), picked = [], total = 0;
        var byPower = state.cards.slice().sort(function (a, b) {
          var sa = G.cardStats(a), sb = G.cardStats(b);
          return (sb.atk + sb.hp / 4) - (sa.atk + sa.hp / 4);
        });
        byPower.forEach(function (c) {
          var cost = G.cardStats(c).cost;
          if (picked.length < D.CONFIG.maxDeckSize && total + cost <= cap) { picked.push(c.uid); total += cost; }
        });
        G.setDeck(state, picked); save(); render();
        break;
      }

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

      case 'export': el('save-box').value = G.serialize(state); break;
      case 'import': {
        var s = G.deserialize(el('save-box').value);
        if (!s) { toast('That does not look like a valid save.'); break; }
        state = s; save(); render(); toast('Save imported.');
        break;
      }
      case 'gems': state.gems += 1000; save(); render(); break;
      case 'gold': state.gold += 5000; save(); render(); break;
      case 'reset': confirmModal('This deletes your whole game and starts over.', 'reset-confirm'); break;
      case 'reset-confirm': state = G.newGame(); save(); closeModal(); render(); toast('Game reset.'); break;
    }
  }

  // ---------- wiring ----------
  document.addEventListener('click', function (e) {
    var tab = e.target.closest ? e.target.closest('#tabs button') : null;
    if (tab) { currentTab = tab.getAttribute('data-tab'); render(); return; }
    if (e.target.id === 'modal-backdrop') { closeModal(); return; }
    var node = e.target.closest ? e.target.closest('[data-action]') : null;
    if (node && node.tagName !== 'SELECT') { act(node.getAttribute('data-action'), node); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.tagName === 'SELECT' && e.target.getAttribute('data-action')) {
      act(e.target.getAttribute('data-action'), e.target);
    }
  });

  state = load();
  G.regenStamina(state);
  render();
  probeArt();
  setInterval(renderTopbar, 1000);
  window.addEventListener('beforeunload', save);
  // Handy for debugging in the browser console.
  window.__game = { get state() { return state; } };
})();
