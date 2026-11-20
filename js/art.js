/*
 * art.js - draws the card and enemy art in code (SVG), so every card has a picture
 * without needing any image files. It works everywhere, including the single-file
 * version on a phone.
 *
 * Each picture is built from layers: a scenic background for the card's colour "look",
 * a shaded figure for its art style (with a halo and feathered wings for Immortal cards,
 * horns and bat wings for Fallen cards), glowing particles, and a frame in the rarity's
 * colour. Everything is seeded from the card id, so a card always looks the same.
 *
 * To use your own art instead, put  assets/cards/<card-id>.png  in place and the game
 * shows that image instead of this drawing.
 *
 * Art.card(cardDef)   -> SVG string for a card
 * Art.enemy(unit)     -> SVG string for an enemy (unit has name, look, style, boss, faction)
 */
var Art = (function () {
  'use strict';

  // ---------- palettes ----------
  // a = main colour, b = deep tone, c = bright accent, d = near-black, sky = top of the sky
  var PAL = {
    fire:  { a: '#ff8a3d', b: '#8a2a10', c: '#ffd88a', d: '#1f0905', sky: '#6b1f0c', fog: '#ffb070' },
    water: { a: '#3fb6ff', b: '#0f3a7d', c: '#b5ecff', d: '#04102a', sky: '#0d4a80', fog: '#9fdcff' },
    wind:  { a: '#5be08a', b: '#146135', c: '#dcffc8', d: '#061c0e', sky: '#2a7a5a', fog: '#c8f5d8' },
    light: { a: '#ffd95a', b: '#9a6a14', c: '#fff9de', d: '#2e2006', sky: '#e0b04a', fog: '#fff2c4' },
    dark:  { a: '#b47cff', b: '#3a1768', c: '#ecd6ff', d: '#0b0418', sky: '#2e1458', fog: '#c9a8ff' }
  };
  // Armour by faction: steel for humans, white gold for gods, black iron for demons.
  var METAL = {
    mortal:   { hi: '#ffffff', mid: '#aebbc8', lo: '#3c4652', trim: '#e2b84e' },
    immortal: { hi: '#fffdf2', mid: '#efd88f', lo: '#8c6a1e', trim: '#ffffff' },
    fallen:   { hi: '#b9a6cc', mid: '#4a3a5e', lo: '#100a18', trim: '#d8475a' }
  };
  var SKIN = { mortal: ['#f0c8a2', '#b98762'], immortal: ['#fbe8d2', '#d6ae86'], fallen: ['#b8a0c6', '#5f4a72'] };
  var HAIR = ['#2b1d14', '#5e3a1e', '#c9a25a', '#e8e2d0', '#8a2f2a', '#3b3f5c', '#16131c', '#b8b8c8'];
  var EYES = ['#6a4320', '#2f6db5', '#3e8a4a', '#707a86', '#8a5a2a'];
  var CLOTH = ['#8a2230', '#24468a', '#2e6e42', '#6e4c1e', '#55307a', '#1f6270', '#7a2e5e'];
  var FRAME = { N: '#9aa0b8', HN: '#d4d9e8', R: '#4f9be8', HR: '#6fd3e8', SR: '#b36bf0', SSR: '#f0b429', L: '#ff6b8b' };
  var OUT = '#0a0710';

  // ---------- small helpers ----------
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function n(x) { return Math.round(x * 10) / 10; }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function pick(R, list) { return list[Math.floor(R() * list.length)]; }
  function rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(x[i] + (y[i] - x[i]) * t).toString(16)).slice(-2); }).join('');
  }
  function pts(list) { return 'M' + list.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' L') + 'Z'; }

  // Drawing primitives. Every solid shape gets a dark ink outline, like painted card art.
  // extra may override the default stroke or stroke-width (each attribute is written once,
  // so the SVG stays valid XML and can be used as an image).
  function shp(d, fill, extra) {
    extra = extra || '';
    return '<path d="' + d + '" fill="' + fill + '"' +
      (/\sstroke="/.test(extra) ? '' : ' stroke="' + OUT + '"') +
      (/\sstroke-width="/.test(extra) ? '' : ' stroke-width="2"') +
      ' stroke-linejoin="round"' + extra + '/>';
  }
  function ln(d, color, w, extra) {
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>';
  }
  function limb(d, fill, w) { return ln(d, OUT, w + 3.5) + ln(d, fill, w); }
  function circ(x, y, r, fill, extra) {
    return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '" fill="' + fill + '"' + (extra || '') + '/>';
  }
  function ell(x, y, rx, ry, fill, extra) {
    return '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="' + fill + '"' + (extra || '') + '/>';
  }
  function spark(x, y, r) {
    return 'M' + n(x) + ',' + n(y - r) + ' Q' + n(x) + ',' + n(y) + ' ' + n(x + r) + ',' + n(y) +
      ' Q' + n(x) + ',' + n(y) + ' ' + n(x) + ',' + n(y + r) + ' Q' + n(x) + ',' + n(y) + ' ' + n(x - r) + ',' + n(y) +
      ' Q' + n(x) + ',' + n(y) + ' ' + n(x) + ',' + n(y - r) + 'Z';
  }
  function mirror(svg) { return '<g transform="scale(-1 1)">' + svg + '</g>'; }
  function U(C, name) { return 'url(#' + name + C.id + ')'; }
  function F(C, name) { return ' filter="url(#' + name + C.id + ')"'; }

  // ---------- gradients, filters, patterns ----------
  function stops(list) {
    return list.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s.length > 2 ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('');
  }
  function lg(C, name, x1, y1, x2, y2, list) {
    return '<linearGradient id="' + name + C.id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' + stops(list) + '</linearGradient>';
  }
  function rg(C, name, cx, cy, r, list) {
    return '<radialGradient id="' + name + C.id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">' + stops(list) + '</radialGradient>';
  }
  function defs(C) {
    var P = C.P, M = C.M;
    return '<defs>' +
      lg(C, 'sky', 0, 0, 0, 1, [[0, P.sky], [0.55, P.b], [1, P.d]]) +
      rg(C, 'glow', 0.5, 0.6, 0.62, [[0, P.a, 0.75], [1, P.a, 0]]) +
      rg(C, 'aura', 0.5, 0.5, 0.5, [[0, P.c, 0.95], [0.4, P.a, 0.5], [1, P.a, 0]]) +
      rg(C, 'vig', 0.5, 0.45, 0.75, [[0.6, '#000', 0], [1, '#000', 0.6]]) +
      lg(C, 'flame', 0, 1, 0, 0, [[0, P.c, 0.95], [1, P.a, 0]]) +
      lg(C, 'ground', 0, 0, 0, 1, [[0, mix(P.b, P.d, 0.3)], [1, P.d]]) +
      lg(C, 'metal', 0, 0, 1, 1, [[0, M.hi], [0.35, M.mid], [1, M.lo]]) +
      lg(C, 'blade', 0, 0, 1, 0, [[0, '#ffffff'], [0.5, M.mid], [1, M.lo]]) +
      lg(C, 'trim', 0, 0, 1, 1, [[0, '#fff6c8'], [0.45, M.trim], [1, mix(M.trim, '#000', 0.55)]]) +
      lg(C, 'cloth', 0, 0, 1, 1, [[0, mix(C.cloth, '#fff', 0.25)], [0.5, C.cloth], [1, mix(C.cloth, '#000', 0.6)]]) +
      lg(C, 'cloth2', 0, 0, 1, 1, [[0, mix(C.cloth2, '#fff', 0.2)], [0.5, C.cloth2], [1, mix(C.cloth2, '#000', 0.6)]]) +
      lg(C, 'skin', 0, 0, 1, 1, [[0, mix(C.skin, '#fff', 0.25)], [0.6, C.skin], [1, C.skinShade]]) +
      lg(C, 'hair', 0, 0, 0, 1, [[0, mix(C.hair, '#fff', 0.3)], [1, mix(C.hair, '#000', 0.4)]]) +
      lg(C, 'wood', 0, 0, 1, 0, [[0, '#a8743e'], [0.5, '#6e4520'], [1, '#3a220e']]) +
      lg(C, 'leather', 0, 0, 1, 1, [[0, '#8a5a32'], [1, '#2e1a0c']]) +
      lg(C, 'feather', 0, 0, 1, 1, [[0, '#ffffff'], [0.6, mix(P.c, '#fff', 0.5)], [1, mix(P.a, '#ffffff', 0.3)]]) +
      lg(C, 'membrane', 0, 0, 1, 1, [[0, mix(P.b, '#000', 0.2), 0.95], [1, mix(P.a, '#000', 0.55), 0.85]]) +
      lg(C, 'hide', 0, 0, 1, 1, [[0, mix(C.hide, '#fff', 0.25)], [0.55, C.hide], [1, mix(C.hide, '#000', 0.65)]]) +
      lg(C, 'frame', 0, 0, 1, 1, [[0, '#ffffff'], [0.3, C.frame], [1, mix(C.frame, '#000', 0.5)]]) +
      '<filter id="glow' + C.id + '" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="soft' + C.id + '" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>' +
      '<pattern id="scale' + C.id + '" width="14" height="10" patternUnits="userSpaceOnUse">' +
      '<path d="M0,10 Q7,0 14,10" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="1.6"/>' +
      '<path d="M2,9 Q7,3 12,9" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1"/></pattern>' +
      '</defs>';
  }

  // ---------- backgrounds: sky, light, far scenery, fog, ground, particles ----------
  function background(C) {
    var P = C.P, R = C.R, el = C.el, s = '', i, x, y, h;
    s += '<rect width="300" height="420" fill="' + U(C, 'sky') + '"/>';

    if (el === 'fire') {
      s += circ(210, 150, 70, P.c, ' opacity=".35"' + F(C, 'soft')) + circ(210, 150, 34, P.c, ' opacity=".75"');
      s += shp('M-10,300 L40,210 L70,240 L120,140 L150,150 L200,250 L250,200 L310,280 L310,420 L-10,420Z', mix(P.b, P.d, 0.55), ' stroke="none"');
      s += ln('M120,142 C114,180 128,200 118,240 M150,152 C156,190 140,220 150,260', P.a, 3, ' opacity=".8"' + F(C, 'glow'));
      s += shp('M20,300 L20,240 L28,236 L28,226 L36,226 L36,236 L44,240 L44,300Z', mix(P.d, P.b, 0.25), ' stroke="none"');
      s += shp('M248,300 L248,250 L256,244 L264,250 L264,300Z', mix(P.d, P.b, 0.25), ' stroke="none"');
    } else if (el === 'water') {
      for (i = 0; i < 4; i++) {
        x = 20 + i * 75 + R() * 20;
        s += '<polygon points="' + n(x) + ',0 ' + n(x + 30) + ',0 ' + n(x + 90) + ',330 ' + n(x - 20) + ',330" fill="' + P.c + '" opacity=".08"/>';
      }
      s += shp('M-10,320 L-10,170 C10,150 40,160 50,190 L56,320Z', mix(P.b, P.d, 0.5), ' stroke="none"');
      s += shp('M310,320 L310,150 C290,130 250,150 248,200 L240,320Z', mix(P.b, P.d, 0.5), ' stroke="none"');
      s += shp('M60,320 C60,230 120,200 150,200 C180,200 240,230 240,320 L220,320 C220,250 190,226 150,226 C110,226 80,250 80,320Z', mix(P.b, P.d, 0.62), ' stroke="none"');
      s += ln('M262,160 L262,320', P.c, 6, ' opacity=".35"') + ln('M268,170 L268,320', '#fff', 2, ' opacity=".35"');
    } else if (el === 'wind') {
      s += circ(70, 90, 26, P.c, ' opacity=".7"' + F(C, 'glow'));
      s += shp('M-10,260 L50,170 L90,220 L150,130 L210,210 L250,160 L310,230 L310,420 L-10,420Z', mix(P.sky, P.b, 0.55), ' stroke="none" opacity=".9"');
      s += shp('M-10,300 L60,230 L110,270 L170,210 L240,280 L310,240 L310,420 L-10,420Z', mix(P.b, P.d, 0.4), ' stroke="none"');
      for (i = 0; i < 9; i++) {
        x = i * 36 + R() * 14 - 8; h = 40 + R() * 40; y = 300 + R() * 10;
        s += shp('M' + n(x) + ',' + n(y - h) + ' L' + n(x + 12) + ',' + n(y - h * 0.45) + ' L' + n(x + 6) + ',' + n(y - h * 0.45) +
          ' L' + n(x + 15) + ',' + n(y) + ' L' + n(x - 15) + ',' + n(y) + ' L' + n(x - 6) + ',' + n(y - h * 0.45) + ' L' + n(x - 12) + ',' + n(y - h * 0.45) + 'Z',
          mix(P.d, P.b, 0.3), ' stroke="none"');
      }
    } else if (el === 'light') {
      for (i = 0; i < 14; i++) {
        var a1 = -0.3 + i * 0.26, a2 = a1 + 0.09;
        s += '<polygon points="150,110 ' + n(150 + Math.cos(a1) * 520) + ',' + n(110 + Math.sin(a1) * 520) + ' ' +
          n(150 + Math.cos(a2) * 520) + ',' + n(110 + Math.sin(a2) * 520) + '" fill="' + P.c + '" opacity=".13"/>';
      }
      s += circ(150, 110, 90, P.c, ' opacity=".45"' + F(C, 'soft')) + circ(150, 110, 40, '#fff', ' opacity=".7"' + F(C, 'glow'));
      [30, 80, 220, 270].forEach(function (cx, k) {
        var top = 160 + (k % 2) * 20;
        s += shp('M' + (cx - 10) + ',320 L' + (cx - 10) + ',' + top + ' L' + (cx + 10) + ',' + top + ' L' + (cx + 10) + ',320Z', mix(P.b, P.c, 0.35), ' stroke="none" opacity=".7"');
        s += shp('M' + (cx - 16) + ',' + top + ' L' + (cx + 16) + ',' + top + ' L' + (cx + 12) + ',' + (top - 8) + ' L' + (cx - 12) + ',' + (top - 8) + 'Z', mix(P.b, P.c, 0.5), ' stroke="none" opacity=".7"');
        s += ln('M' + (cx - 4) + ',' + (top + 6) + ' L' + (cx - 4) + ',318 M' + (cx + 4) + ',' + (top + 6) + ' L' + (cx + 4) + ',318', P.b, 1.5, ' opacity=".4"');
      });
      for (i = 0; i < 5; i++) {
        s += ell(R() * 300, 60 + R() * 120, 40 + R() * 40, 10 + R() * 6, '#fff', ' opacity=".25"' + F(C, 'soft'));
      }
    } else {
      s += circ(220, 92, 50, P.c, ' opacity=".35"' + F(C, 'soft')) + circ(220, 92, 36, P.c, ' opacity=".95"') + circ(234, 82, 32, P.sky);
      for (i = 0; i < 26; i++) { s += circ(R() * 300, R() * 220, 0.6 + R() * 1.4, P.c, ' opacity=".85"'); }
      s += shp('M40,320 L40,220 L50,200 L60,220 L60,250 L80,250 L80,190 L90,160 L100,190 L100,240 L118,240 L118,210 L126,196 L134,210 L134,320Z',
        mix(P.d, P.b, 0.3), ' stroke="none"');
      for (i = 0; i < 4; i++) { s += circ(54 + i * 22, 236 + (i % 2) * 14, 2, P.a, ' opacity=".9"' + F(C, 'glow')); }
      s += ln('M230,330 C226,290 236,270 228,240 M228,260 L210,244 M230,276 L250,262', mix(P.d, P.b, 0.2), 5);
      for (i = 0; i < 3; i++) {
        x = 150 + R() * 120; y = 140 + R() * 60;
        s += ln('M' + n(x - 8) + ',' + n(y) + ' Q' + n(x - 4) + ',' + n(y - 5) + ' ' + n(x) + ',' + n(y) + ' Q' + n(x + 4) + ',' + n(y - 5) + ' ' + n(x + 8) + ',' + n(y), OUT, 2);
      }
    }
    // Light pooling behind the figure, then mist and the ground.
    s += '<rect width="300" height="420" fill="' + U(C, 'glow') + '"/>';
    s += ell(150, 300, 200, 26, P.fog, ' opacity=".22"' + F(C, 'soft'));
    s += shp('M-10,330 C60,318 120,326 160,322 C220,318 260,326 310,322 L310,430 L-10,430Z', U(C, 'ground'), ' stroke="none"');
    for (i = 0; i < 10; i++) {
      x = R() * 300; y = 338 + R() * 70;
      s += ell(x, y, 6 + R() * 10, 3 + R() * 3, mix(P.d, P.b, 0.4), ' opacity=".8"');
      s += ln('M' + n(x - 4) + ',' + n(y - 2) + ' L' + n(x + 3) + ',' + n(y - 4), P.a, 1, ' opacity=".35"');
    }
    for (i = 0; i < 14; i++) {
      x = R() * 300; y = 326 + R() * 20;
      s += ln('M' + n(x) + ',' + n(y) + ' l-3,-8 M' + n(x) + ',' + n(y) + ' l1,-10 M' + n(x) + ',' + n(y) + ' l4,-7', mix(P.b, P.a, 0.3), 1.5, ' opacity=".7"');
    }
    return s;
  }

  function particles(C, count) {
    var P = C.P, R = C.R, s = '<g' + F(C, 'glow') + '>', i, x, y;
    for (i = 0; i < count; i++) {
      x = R() * 300; y = 40 + R() * 300;
      if (C.el === 'fire') { s += circ(x, y, 1 + R() * 2.2, P.c, ' opacity=".9"'); }
      else if (C.el === 'water') { s += circ(x, y, 2 + R() * 4, 'none', ' stroke="' + P.c + '" stroke-width="1.2" opacity=".7"'); }
      else if (C.el === 'wind') { s += ell(x, y, 7, 2.6, P.c, ' opacity=".75" transform="rotate(' + n(R() * 180) + ' ' + n(x) + ' ' + n(y) + ')"'); }
      else { s += '<path d="' + spark(x, y, 2 + R() * 4) + '" fill="' + P.c + '" opacity=".9"/>'; }
    }
    return s + '</g>';
  }

  // ---------- faction overlays ----------
  // Feathered wing for the left side, rooted at (bx0, by0). Mirror it for the right side.
  function featherWing(C, big, bx0, by0) {
    var s = '', rows = big ? 3 : 2, r, i;
    bx0 = bx0 === undefined ? -24 : bx0; by0 = by0 === undefined ? -196 : by0;
    // Solid wing underneath so the feathers read as one bright wing.
    var tipsBase = [], L0 = big ? 120 : 92;
    for (i = 0; i < 7; i++) {
      var tt = i / 6, aa = (-150 + tt * 95) * Math.PI / 180;
      tipsBase.push([bx0 + Math.cos(aa) * L0 * (0.68 + tt * 0.3), by0 + Math.sin(aa) * L0 * (0.68 + tt * 0.3)]);
    }
    s += '<path d="M' + n(bx0) + ',' + n(by0) + ' L' + tipsBase.map(function (t) { return n(t[0]) + ',' + n(t[1]); }).join(' L') +
      ' L' + n(bx0 + 6) + ',' + n(by0 + 30) + 'Z" fill="' + U(C, 'feather') + '" stroke="' + mix(C.P.a, '#000000', 0.35) + '" stroke-width="1.5" stroke-linejoin="round"/>';
    for (r = 0; r < rows; r++) {
      var len = (big ? 120 : 92) - r * 22, count = 7 - r;
      for (i = count - 1; i >= 0; i--) {
        var t = i / (count - 1), ang = (-150 + t * 95) * Math.PI / 180;
        var bx = bx0 - r * 4, by = by0 + r * 14;
        var ex = bx + Math.cos(ang) * len * (0.75 + t * 0.35), ey = by + Math.sin(ang) * len * (0.75 + t * 0.35);
        var mx = (bx + ex) / 2, my = (by + ey) / 2, nx = -(ey - by) * 0.3, ny = (ex - bx) * 0.3;
        s += '<path d="M' + n(bx) + ',' + n(by) + ' Q' + n(mx + nx) + ',' + n(my + ny) + ' ' + n(ex) + ',' + n(ey) +
          ' Q' + n(mx - nx * 0.4) + ',' + n(my - ny * 0.4) + ' ' + n(bx) + ',' + n(by) + 'Z" fill="' + U(C, 'feather') +
          '" stroke="' + mix(C.P.a, '#ffffff', 0.15) + '" stroke-width="1" stroke-linejoin="round"/>';
        s += ln('M' + n(bx) + ',' + n(by) + ' Q' + n(mx + nx * 0.3) + ',' + n(my + ny * 0.3) + ' ' + n(ex) + ',' + n(ey), mix(C.P.a, '#000000', 0.25), 0.8, ' opacity=".45"');
      }
    }
    return s;
  }
  function batWing(C) {
    var tips = [[-128, -258], [-160, -200], [-150, -146], [-104, -120]];
    var s = shp('M-26,-196 L' + tips.map(function (t, k) {
      var nt = tips[k + 1];
      return t[0] + ',' + t[1] + (nt ? ' Q' + n((t[0] + nt[0]) / 2 + 14) + ',' + n((t[1] + nt[1]) / 2 + 8) + ' ' : '');
    }).join('') + ' L-40,-150Z', U(C, 'membrane'));
    tips.forEach(function (t) { s += ln('M-26,-196 L' + t[0] + ',' + t[1], OUT, 3) + ln('M-26,-196 L' + t[0] + ',' + t[1], C.M.mid, 1.2); });
    s += shp('M-26,-196 L-34,-214 L-20,-200Z', C.M.hi);
    return s;
  }
  function wings(C, kind) {
    var w = kind === 'feather' ? featherWing(C, false) : (kind === 'feather-big' ? featherWing(C, true) : batWing(C));
    return w + mirror(w);
  }
  function halo(C, y, r) {
    return '<g' + F(C, 'glow') + '>' + ell(0, y, r, r * 0.26, 'none', ' stroke="' + C.P.c + '" stroke-width="5"') +
      ell(0, y, r, r * 0.26, 'none', ' stroke="#fff" stroke-width="1.5"') + '</g>';
  }
  function horns(C, y, spread) {
    var h = shp('M-' + spread + ',' + y + ' C-' + (spread + 14) + ',' + (y - 8) + ' -' + (spread + 22) + ',' + (y - 30) + ' -' + (spread + 10) + ',' + (y - 50) +
      ' C-' + (spread + 8) + ',' + (y - 32) + ' -' + (spread - 2) + ',' + (y - 20) + ' -' + (spread - 10) + ',' + (y - 8) + 'Z', U(C, 'trim'));
    h += ln('M-' + (spread + 6) + ',' + (y - 10) + ' l-6,-4 M-' + (spread + 12) + ',' + (y - 22) + ' l-6,-2 M-' + (spread + 13) + ',' + (y - 34) + ' l-5,1', OUT, 1.2, ' opacity=".6"');
    return h + mirror(h);
  }
  function tail(C) {
    return limb('M14,-118 C60,-110 70,-60 104,-56', U(C, 'skin'), 6) + shp('M104,-56 L122,-70 L118,-50 L126,-38 L104,-46Z', U(C, 'trim'));
  }
  // A small faction emblem for tabards, shields and banners: a star for humans, a winged
  // disc for gods, a horned gem for demons.
  function emblem(C, x, y, k) {
    var f = U(C, 'trim');
    if (C.fx === 'immortal') {
      var w = 'M-5,0 C-12,-8 -18,-4 -20,-9 C-18,2 -10,4 -5,2Z';
      return '<g transform="translate(' + n(x) + ' ' + n(y) + ') scale(' + k + ')">' + shp(w, f, ' stroke-width="1"') + mirror(shp(w, f, ' stroke-width="1"')) +
        circ(0, 0, 5, f, ' stroke="' + OUT + '" stroke-width="1"') + '</g>';
    }
    if (C.fx === 'fallen') {
      return '<g transform="translate(' + n(x) + ' ' + n(y) + ') scale(' + k + ')">' + shp('M0,-9 L8,0 L0,9 L-8,0Z', f, ' stroke-width="1"') +
        circ(0, 0, 2.6, '#ff2244') + ln('M-6,-6 L-10,-13 M6,-6 L10,-13', f, 2) + '</g>';
    }
    return '<g transform="translate(' + n(x) + ' ' + n(y) + ') scale(' + k + ')">' +
      shp('M0,-10 L3,-3 L10,-3 L4,2 L6,10 L0,5 L-6,10 L-4,2 L-10,-3 L-3,-3Z', f, ' stroke-width="1"') + '</g>';
  }

  // ---------- humanoid body parts (feet at 0,0; shoulders at y=-200; head centred at y=-244) ----------
  function cape(C, ragged) {
    var hem = ragged ? ' L56,-14 L44,2 L30,-10 L14,4 L0,-8 L-14,4 L-30,-10 L-44,2 L-56,-14' : ' Q0,10';
    var s = shp('M-38,-206 C-62,-140 -78,-60 -70,0' + ' L-70,0' + (ragged ? ' L-56,-14 L-44,2 L-30,-10 L-14,4 L0,-8 L14,4 L30,-10 L44,2 L56,-14 L70,0' : ' Q0,10 70,0') +
      ' C78,-60 62,-140 38,-206Z', U(C, 'cloth2'));
    s += ln('M-40,-150 C-48,-100 -52,-50 -50,-6 M40,-150 C48,-100 52,-50 50,-6 M-20,-160 C-24,-100 -26,-50 -24,-4', OUT, 1.4, ' opacity=".35"');
    return hem ? s : s;
  }
  function legs(C, kind) {
    var s = '';
    [-1, 1].forEach(function (sd) {
      var upper = kind === 'plate' ? U(C, 'metal') : (kind === 'bare' ? U(C, 'leather') : U(C, 'cloth2'));
      var lower = kind === 'plate' ? U(C, 'metal') : U(C, 'leather');
      s += shp(pts([[sd * 5, -124], [sd * 26, -126], [sd * 24, -64], [sd * 10, -64]]), upper);
      s += shp(pts([[sd * 10, -68], [sd * 25, -68], [sd * 22, -14], [sd * 11, -14]]), lower);
      if (kind === 'plate') {
        s += ell(sd * 17, -66, 10, 8, U(C, 'metal'), ' stroke="' + OUT + '" stroke-width="2"');
        s += ln('M' + (sd * 15) + ',-56 L' + (sd * 15) + ',-20', '#fff', 1.4, ' opacity=".55"');
      } else {
        s += ln('M' + (sd * 11) + ',-48 L' + (sd * 23) + ',-54 M' + (sd * 11) + ',-36 L' + (sd * 23) + ',-42 M' + (sd * 11) + ',-24 L' + (sd * 22) + ',-30', OUT, 1.2, ' opacity=".5"');
      }
      s += shp('M' + (sd * 8) + ',-16 L' + (sd * 25) + ',-16 L' + (sd * 28) + ',-5 L' + (sd * 37) + ',1 L' + (sd * 6) + ',1Z', U(C, 'leather'));
    });
    return s;
  }
  function torso(C, kind, wide) {
    var w = wide ? 44 : 34, s = '';
    if (kind === 'robe') {
      s += shp('M' + (-w) + ',-202 Q0,-214 ' + w + ',-202 L' + (w + 8) + ',-120 L72,0 L-72,0 L' + (-w - 8) + ',-120Z', U(C, 'cloth'));
      s += ln('M-22,-118 L-38,-4 M0,-116 L0,-2 M22,-118 L38,-4 M-50,-60 L-58,-4 M50,-60 L58,-4', OUT, 1.4, ' opacity=".3"');
      s += ln('M-70,-5 L70,-5', U(C, 'trim'), 6) + ln('M0,-198 L0,-124', U(C, 'trim'), 5);
      for (var k = 0; k < 7; k++) { s += circ(-60 + k * 20, -5, 1.6, OUT, ' opacity=".6"'); }
      s += shp('M-32,-132 L32,-132 L30,-118 L-30,-118Z', U(C, 'cloth2'));
      s += shp('M30,-128 L40,-90 L32,-88 L26,-120Z', U(C, 'cloth2'));
      s += circ(0, -125, 6, U(C, 'trim'), ' stroke="' + OUT + '" stroke-width="1.5"');
      s += shp('M-20,-206 L0,-180 L20,-206 L12,-212 L0,-196 L-12,-212Z', U(C, 'trim'));
      return s;
    }
    if (kind === 'bare') {
      s += shp('M' + (-w) + ',-202 Q0,-212 ' + w + ',-202 L' + (w - 8) + ',-126 L' + (-w + 8) + ',-126Z', U(C, 'skin'));
      s += ln('M-24,-184 Q-12,-170 -2,-178 M2,-178 Q12,-170 24,-184 M0,-174 L0,-130 M-12,-160 L-12,-132 M12,-160 L12,-132 M-14,-146 L14,-146', C.skinShade, 1.6, ' opacity=".8"');
      s += ln('M' + (-w + 6) + ',-198 L' + (w - 10) + ',-130', U(C, 'leather'), 7);
      s += shp('M' + (-w - 6) + ',-206 C-20,-224 20,-224 ' + (w + 6) + ',-206 C' + (w + 2) + ',-196 ' + (w - 6) + ',-192 ' + (w - 12) + ',-196 C10,-206 -10,-206 ' + (-w + 12) + ',-196 C' + (-w + 6) + ',-192 ' + (-w - 2) + ',-196 ' + (-w - 6) + ',-206Z', '#7a5a3a');
      s += ln('M-30,-212 l-2,-6 M-18,-216 l-1,-7 M-4,-218 l0,-7 M10,-217 l1,-7 M24,-214 l2,-6', '#3a2a1a', 1.5);
      s += shp('M-30,-130 L30,-130 L30,-118 L-30,-118Z', U(C, 'leather')) + shp('M-6,-130 L6,-130 L6,-118 L-6,-118Z', U(C, 'trim'));
      s += shp('M-28,-118 L-12,-118 L-14,-82 L-30,-86Z', U(C, 'leather')) + shp('M12,-118 L28,-118 L30,-86 L14,-82Z', U(C, 'leather')) + shp('M-10,-118 L10,-118 L8,-76 L-8,-76Z', U(C, 'cloth2'));
      return s;
    }
    if (kind === 'leather') {
      s += shp('M' + (-w) + ',-202 Q0,-214 ' + w + ',-202 L' + (w - 2) + ',-124 L' + (-w + 2) + ',-124Z', U(C, 'cloth2'));
      s += ln('M-6,-200 L6,-186 M6,-200 L-6,-186 M-6,-186 L6,-172 M6,-186 L-6,-172', '#d8c8a0', 1.4);
      s += ln('M' + (-w + 4) + ',-198 L' + (w - 6) + ',-130', U(C, 'leather'), 7);
      s += shp('M-32,-132 L32,-132 L32,-120 L-32,-120Z', U(C, 'leather')) + shp('M-5,-133 L5,-133 L5,-119 L-5,-119Z', U(C, 'trim'));
      s += shp('M-30,-120 L30,-120 L36,-84 L-36,-84Z', U(C, 'cloth2'));
      s += ln('M-18,-118 L-22,-86 M0,-118 L0,-84 M18,-118 L22,-86', OUT, 1.2, ' opacity=".4"');
      return s;
    }
    // plate
    s += shp('M' + (-w) + ',-204 Q0,-218 ' + w + ',-204 L' + (w - 4) + ',-160 Q' + (w - 6) + ',-134 ' + (w - 10) + ',-126 L' + (-w + 10) + ',-126 Q' + (-w + 6) + ',-134 ' + (-w + 4) + ',-160Z', U(C, 'metal'));
    s += ln('M0,-210 L0,-132', '#fff', 1.6, ' opacity=".6"');
    s += ln('M-24,-184 Q-12,-172 0,-178 Q12,-172 24,-184', OUT, 1.4, ' opacity=".45"');
    s += ln('M' + (-w + 6) + ',-152 Q0,-144 ' + (w - 6) + ',-152 M' + (-w + 8) + ',-140 Q0,-132 ' + (w - 8) + ',-140', OUT, 1.3, ' opacity=".45"');
    s += shp('M-30,-132 L30,-132 L30,-122 L-30,-122Z', U(C, 'leather')) + shp('M-6,-134 L6,-134 L6,-120 L-6,-120Z', U(C, 'trim'));
    s += shp('M-17,-122 L17,-122 L21,-56 L0,-46 L-21,-56Z', U(C, 'cloth'));
    s += ln('M-19,-120 L-23,-56 L0,-46 L23,-56 L19,-120', U(C, 'trim'), 2.4);
    s += emblem(C, 0, -92, 1);
    return s;
  }
  function pauldrons(C, wide, spiked) {
    var w = wide ? 44 : 34, s = '';
    [-1, 1].forEach(function (sd) {
      s += shp('M' + (sd * (w - 16)) + ',-214 C' + (sd * (w + 8)) + ',-222 ' + (sd * (w + 20)) + ',-200 ' + (sd * (w + 14)) + ',-182 L' + (sd * (w - 6)) + ',-188Z', U(C, 'metal'));
      s += shp('M' + (sd * (w - 4)) + ',-190 C' + (sd * (w + 10)) + ',-192 ' + (sd * (w + 18)) + ',-180 ' + (sd * (w + 14)) + ',-170 L' + (sd * (w - 2)) + ',-176Z', U(C, 'metal'));
      s += ln('M' + (sd * (w - 12)) + ',-210 C' + (sd * (w + 4)) + ',-216 ' + (sd * (w + 12)) + ',-204 ' + (sd * (w + 10)) + ',-190', U(C, 'trim'), 2);
      if (spiked) {
        s += shp('M' + (sd * (w + 2)) + ',-212 L' + (sd * (w + 14)) + ',-246 L' + (sd * (w + 12)) + ',-206Z', U(C, 'trim'));
        s += shp('M' + (sd * (w + 12)) + ',-200 L' + (sd * (w + 32)) + ',-226 L' + (sd * (w + 18)) + ',-192Z', U(C, 'trim'));
      }
    });
    return s;
  }
  // Arm from shoulder (sx,sy) through elbow (ex,ey) to hand (hx,hy).
  function arm(C, sx, sy, ex, ey, hx, hy, kind) {
    var f = kind === 'plate' ? U(C, 'metal') : (kind === 'bare' ? U(C, 'skin') : (kind === 'robe' ? U(C, 'cloth') : U(C, 'cloth2')));
    var s = limb('M' + sx + ',' + sy + ' L' + ex + ',' + ey, f, kind === 'robe' ? 17 : 15);
    s += limb('M' + ex + ',' + ey + ' L' + hx + ',' + hy, f, kind === 'robe' ? 15 : 12);
    var bx = ex + (hx - ex) * 0.45, by = ey + (hy - ey) * 0.45, cx = ex + (hx - ex) * 0.85, cy = ey + (hy - ey) * 0.85;
    if (kind === 'robe') { s += limb('M' + n(cx) + ',' + n(cy) + ' L' + n(hx + (hx - ex) * 0.05) + ',' + n(hy + (hy - ey) * 0.05), U(C, 'trim'), 17); }
    else { s += limb('M' + n(bx) + ',' + n(by) + ' L' + n(cx) + ',' + n(cy), kind === 'plate' ? U(C, 'trim') : U(C, 'leather'), 13); }
    if (kind === 'plate') { s += circ(ex, ey, 7.5, U(C, 'metal'), ' stroke="' + OUT + '" stroke-width="2"'); }
    s += circ(hx, hy, 6.8, kind === 'plate' ? U(C, 'metal') : U(C, 'skin'), ' stroke="' + OUT + '" stroke-width="2"');
    return s;
  }
  // Face, hair and headgear. gear: helm, hood, hat, hair, circlet, crown, greathelm.
  function head(C, gear) {
    var y = -244, s = '';
    var longHair = gear === 'circlet' || ((gear === 'hair' || gear === 'hat') && C.longHair);
    if (longHair) { s += shp('M-22,-256 C-36,-220 -32,-188 -20,-176 L20,-176 C32,-188 36,-220 22,-256Z', U(C, 'hair')); }
    if (gear === 'hood') { s += shp('M-29,-238 C-36,-288 36,-288 29,-238 L27,-206 L-27,-206Z', U(C, 'cloth2')); }
    s += shp('M-7,-226 L7,-226 L8,-205 L-8,-205Z', U(C, 'skin'));
    if (gear === 'greathelm') {
      s += shp('M-22,-238 C-24,-280 24,-280 22,-238 L20,-216 C10,-208 -10,-208 -20,-216Z', U(C, 'metal'));
      s += shp('M-17,-246 L17,-246 L15,-240 L-15,-240Z', OUT);
      s += '<g' + F(C, 'glow') + '>' + ell(-7, -243, 4, 1.6, C.eye) + ell(7, -243, 4, 1.6, C.eye) + '</g>';
      s += ln('M0,-276 L0,-212', '#fff', 1.4, ' opacity=".5"');
      for (var hc = 0; hc < 4; hc++) { s += circ(-8 + hc * 5.4, -228, 1.2, OUT); }
      return s;
    }
    s += ell(0, y, 18, 22, U(C, 'skin'), ' stroke="' + OUT + '" stroke-width="2"');
    s += ell(0, y + 11, 13, 9, C.skinShade, ' opacity=".28"');
    var demon = C.fx === 'fallen';
    [-1, 1].forEach(function (sd) {
      var ex = sd * 7, ey = y + 1;
      s += ell(ex, ey, 4.8, 3.4, '#fff', ' stroke="' + OUT + '" stroke-width="1"');
      s += '<g' + (demon ? F(C, 'glow') : '') + '>' + circ(ex + sd * 0.4, ey, 2.7, C.eye) + '</g>';
      s += circ(ex + sd * 0.4, ey, 1.2, '#000') + circ(ex + sd * 0.4 - 1, ey - 1.1, 0.9, '#fff');
      s += ln('M' + (sd * 3) + ',' + (ey - 6.5) + ' L' + (sd * 11.5) + ',' + (ey - (demon ? 9.5 : 7.5)), OUT, 2);
    });
    s += ln('M0,' + (y + 4) + ' L-1.6,' + (y + 9.5) + ' L1.2,' + (y + 10), C.skinShade, 1.3);
    s += ln(demon ? 'M-5,' + (y + 14) + ' Q0,' + (y + 18) + ' 5,' + (y + 14) : 'M-4,' + (y + 14.5) + ' Q0,' + (y + 16.5) + ' 4,' + (y + 14.5), '#7a3038', 1.7);
    if (demon) { s += shp('M-3,' + (y + 15.5) + ' L-1.5,' + (y + 19) + ' L0,' + (y + 15.8) + 'Z', '#fff', ' stroke-width=".6"') + shp('M3,' + (y + 15.5) + ' L1.5,' + (y + 19) + ' L0,' + (y + 15.8) + 'Z', '#fff', ' stroke-width=".6"'); }
    if (C.warpaint && gear === 'hair') { s += ln('M-14,' + (y + 4) + ' L-6,' + (y + 7) + ' M14,' + (y + 4) + ' L6,' + (y + 7), '#b02030', 2.4); }

    if (gear === 'helm') {
      s += shp('M-21,-250 C-23,-282 23,-282 21,-250 L21,-236 L16,-234 L16,-252 L-16,-252 L-16,-234 L-21,-236Z', U(C, 'metal'));
      s += shp('M-2.4,-254 L2.4,-254 L2.4,-236 L-2.4,-236Z', U(C, 'metal'));
      s += ln('M-18,-256 Q0,-262 18,-256', U(C, 'trim'), 2.4) + ln('M-4,-276 Q0,-270 4,-276', '#fff', 1.4, ' opacity=".6"');
      if (C.plume) {
        s += shp('M0,-278 C-8,-304 -42,-302 -50,-274 C-36,-286 -20,-284 -6,-274Z', U(C, 'cloth'));
        s += ln('M-6,-284 C-18,-292 -32,-290 -42,-280', OUT, 1, ' opacity=".4"');
      } else {
        s += shp('M-3,-278 L0,-300 L3,-278Z', U(C, 'trim')) + shp('M-20,-262 L-34,-284 L-14,-270Z', U(C, 'trim')) + shp('M20,-262 L34,-284 L14,-270Z', U(C, 'trim'));
      }
    } else if (gear === 'hood') {
      s += shp('M-25,-244 C-24,-276 24,-276 25,-244 C14,-258 -14,-258 -25,-244Z', U(C, 'cloth2'));
      s += ell(0, -246, 16, 6, '#000', ' opacity=".25"');
    } else if (gear === 'hat') {
      s += shp('M-24,-262 C-18,-300 0,-332 24,-346 C14,-320 18,-292 26,-262Z', U(C, 'cloth'));
      s += ell(0, -262, 42, 9, U(C, 'cloth'), ' stroke="' + OUT + '" stroke-width="2"');
      s += shp('M-24,-270 C-8,-274 10,-274 25,-270 L25,-262 C10,-266 -8,-266 -24,-262Z', U(C, 'trim'));
      s += '<g' + F(C, 'glow') + '>' + circ(0, -267, 3.6, C.P.c) + '</g>';
      s += shp('M-17,-258 C-14,-250 14,-250 17,-258 C10,-254 -10,-254 -17,-258Z', U(C, 'hair'));
    } else if (gear === 'circlet' || gear === 'crown') {
      s += shp('M-20,-252 C-24,-280 24,-282 20,-252 C12,-262 4,-258 0,-266 C-4,-258 -12,-262 -20,-252Z', U(C, 'hair'));
      s += ln('M-19,-256 Q0,-264 19,-256', U(C, 'trim'), 3.4);
      s += '<g' + F(C, 'glow') + '>' + circ(0, -261, 3, C.P.c) + '</g>';
      if (gear === 'crown') {
        s += shp('M-18,-258 L-20,-276 L-10,-264 L-4,-282 L0,-266 L4,-282 L10,-264 L20,-276 L18,-258Z', U(C, 'trim'));
      }
    } else {
      if (C.spiky) {
        s += shp('M-21,-252 L-26,-270 L-14,-266 L-12,-284 L-2,-270 L4,-288 L8,-268 L18,-280 L16,-262 L26,-264 L21,-252 C10,-260 -10,-260 -21,-252Z', U(C, 'hair'));
      } else {
        s += shp('M-20,-254 C-24,-282 24,-284 20,-254 C14,-262 6,-258 0,-266 C-6,-258 -14,-262 -20,-254Z', U(C, 'hair'));
      }
      s += ln('M-19,-257 Q0,-263 19,-257', U(C, 'cloth'), 3.6);
    }
    // Faction marks on the head.
    if (C.fx === 'immortal') { s += halo(C, gear === 'hat' ? -360 : -292, 26); }
    if (C.fx === 'fallen') { s += horns(C, -258, 14); }
    return s;
  }

  // ---------- weapons ----------
  function sword(C, x, y, len, angle, glow) {
    var s = shp('M-5,0 L5,0 L4.4,-' + (len - 18) + ' L0,-' + len + ' L-4.4,-' + (len - 18) + 'Z', U(C, 'blade'));
    s += ln('M0,-6 L0,-' + (len - 22), OUT, 1.2, ' opacity=".35"') + ln('M3,-6 L3,-' + (len - 22), '#fff', 1, ' opacity=".7"');
    if (glow) { s = '<g' + F(C, 'glow') + '>' + s + ln('M0,-10 L0,-' + (len - 26), C.P.c, 2, ' opacity=".9"') + '</g>'; }
    s += shp('M-20,4 C-12,-1 12,-1 20,4 L18,10 C10,6 -10,6 -18,10Z', U(C, 'trim'));
    s += circ(0, 5, 3.4, C.fx === 'fallen' ? '#ff2244' : C.P.a, ' stroke="' + OUT + '" stroke-width="1"');
    s += shp('M-3.5,10 L3.5,10 L3.5,30 L-3.5,30Z', U(C, 'leather'));
    s += ln('M-3.5,15 L3.5,13 M-3.5,21 L3.5,19 M-3.5,27 L3.5,25', OUT, 1, ' opacity=".6"');
    s += circ(0, 33, 4.5, U(C, 'trim'), ' stroke="' + OUT + '" stroke-width="1.5"');
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + angle + ')">' + s + '</g>';
  }
  function kiteShield(C, x, y) {
    var s = shp('M-26,-32 L26,-32 L26,4 C26,26 0,44 0,44 C0,44 -26,26 -26,4Z', U(C, 'cloth'));
    s += ln('M-26,-32 L26,-32 L26,4 C26,26 0,44 0,44 C0,44 -26,26 -26,4Z', U(C, 'trim'), 4);
    s += ln('M-22,-26 L-8,-26', '#fff', 1.5, ' opacity=".6"');
    s += emblem(C, 0, 0, 1.6);
    [[-20, -26], [20, -26], [-20, 0], [20, 0], [0, 36]].forEach(function (p) { s += circ(p[0], p[1], 1.8, U(C, 'trim'), ' stroke="' + OUT + '" stroke-width=".8"'); });
    return '<g transform="translate(' + x + ' ' + y + ')">' + s + '</g>';
  }
  function roundShield(C, x, y, r) {
    var s = circ(0, 0, r, U(C, 'cloth'), ' stroke="' + OUT + '" stroke-width="2"');
    s += circ(0, 0, r - 3, 'none', ' stroke="' + U(C, 'trim') + '" stroke-width="4"');
    s += circ(0, 0, 8, U(C, 'metal'), ' stroke="' + OUT + '" stroke-width="1.5"') + circ(-2, -2, 2.5, '#fff', ' opacity=".7"');
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; s += circ(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3), 1.6, OUT); }
    return '<g transform="translate(' + x + ' ' + y + ')">' + s + '</g>';
  }
  function staff(C, x, top, bottom) {
    var s = limb('M' + x + ',' + bottom + ' L' + x + ',' + top, U(C, 'wood'), 6);
    s += ln('M' + (x - 3) + ',' + (top + 30) + ' L' + (x + 3) + ',' + (top + 26) + ' M' + (x - 3) + ',' + (top + 38) + ' L' + (x + 3) + ',' + (top + 34), U(C, 'trim'), 2);
    s += shp('M' + (x - 10) + ',' + (top + 6) + ' C' + (x - 16) + ',' + (top - 10) + ' ' + (x - 6) + ',' + (top - 18) + ' ' + x + ',' + (top - 14) +
      ' C' + (x + 6) + ',' + (top - 18) + ' ' + (x + 16) + ',' + (top - 10) + ' ' + (x + 10) + ',' + (top + 6) + ' L' + (x + 4) + ',' + (top + 2) + ' L' + (x - 4) + ',' + (top + 2) + 'Z', U(C, 'trim'));
    s += circ(x, top - 18, 26, U(C, 'aura'), ' opacity=".9"');
    s += '<g' + F(C, 'glow') + '>' + shp('M' + x + ',' + (top - 36) + ' L' + (x + 8) + ',' + (top - 20) + ' L' + x + ',' + (top - 4) + ' L' + (x - 8) + ',' + (top - 20) + 'Z', C.P.c, ' stroke-width="1"') + '</g>';
    s += ln('M' + x + ',' + (top - 36) + ' L' + x + ',' + (top - 4) + ' M' + (x - 8) + ',' + (top - 20) + ' L' + (x + 8) + ',' + (top - 20), '#fff', 0.8, ' opacity=".7"');
    return s;
  }
  function spell(C, x, y) {
    var s = circ(x, y, 34, U(C, 'aura'));
    s += '<g' + F(C, 'glow') + '>' + circ(x, y, 9, '#fff') + circ(x, y, 14, 'none', ' stroke="' + C.P.c + '" stroke-width="2"') + '</g>';
    s += ell(x, y, 30, 10, 'none', ' stroke="' + C.P.c + '" stroke-width="1.6" stroke-dasharray="3 5" transform="rotate(-20 ' + x + ' ' + y + ')" opacity=".9"');
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, rx = x + Math.cos(a) * 24, ry = y + Math.sin(a) * 9;
      s += '<path d="' + spark(rx, ry, 3) + '" fill="' + C.P.c + '"/>';
    }
    return s;
  }

  // ---------- humanoid styles ----------
  function backWings(C) {
    if (C.fx === 'immortal') { return wings(C, 'feather'); }
    if (C.fx === 'fallen') { return wings(C, 'bat'); }
    return '';
  }
  function knight(C) {
    var s = ell(0, 2, 54, 10, '#000', ' opacity=".45"') + backWings(C) + cape(C, C.fx === 'fallen');
    s += legs(C, 'plate') + torso(C, 'plate') + pauldrons(C, false, C.fx === 'fallen');
    s += sword(C, 64, -138, 150, 4, C.fx !== 'mortal');
    s += arm(C, 36, -196, 58, -166, 64, -136, 'plate');
    s += arm(C, -36, -196, -58, -166, -54, -138, 'plate');
    s += head(C, C.fx === 'fallen' && C.closedHelm ? 'greathelm' : 'helm');
    s += kiteShield(C, -58, -118);
    return s;
  }
  function archer(C) {
    var s = ell(0, 2, 50, 10, '#000', ' opacity=".45"') + backWings(C) + cape(C, false);
    s += shp('M24,-206 L42,-212 L52,-140 L36,-136Z', U(C, 'leather'));
    s += ln('M38,-210 L32,-232 M44,-210 L42,-234 M49,-208 L52,-230', '#e8e0c8', 2.4) + shp('M28,-232 L32,-240 L36,-232Z', C.P.c, ' stroke-width="1"') + shp('M38,-234 L42,-242 L46,-234Z', C.P.c, ' stroke-width="1"');
    s += legs(C, 'leather') + torso(C, 'leather');
    s += arm(C, 34, -196, 12, -190, -26, -188, 'leather');
    s += head(C, C.fx === 'immortal' ? 'circlet' : 'hood');
    s += arm(C, -34, -196, -64, -192, -92, -188, 'leather');
    s += shp('M-96,-280 C-140,-240 -140,-136 -96,-96 L-92,-100 C-128,-140 -128,-236 -92,-276Z', U(C, 'wood'));
    s += shp('M-100,-198 L-90,-198 L-90,-178 L-100,-178Z', U(C, 'leather'));
    s += ln('M-96,-278 L-26,-188 L-96,-98', '#f4f0e0', 1.2, ' opacity=".85"');
    s += ln('M-110,-188 L-22,-188', U(C, 'wood'), 3) + shp('M-118,-188 L-104,-194 L-106,-188 L-104,-182Z', U(C, 'blade'));
    s += shp('M-30,-188 L-20,-196 L-16,-188 L-20,-180Z', C.P.c, ' stroke-width="1"');
    if (C.fx !== 'mortal') { s += '<g' + F(C, 'glow') + '>' + ln('M-116,-188 L-60,-188', C.P.c, 2, ' opacity=".8"') + '</g>'; }
    return s;
  }
  function mage(C) {
    var s = ell(0, 2, 60, 10, '#000', ' opacity=".45"') + (C.fx === 'fallen' ? wings(C, 'bat') : '');
    s += torso(C, 'robe');
    s += staff(C, 64, -292, 0);
    s += arm(C, 36, -196, 56, -170, 62, -150, 'robe');
    s += arm(C, -36, -196, -58, -214, -70, -238, 'robe');
    s += head(C, C.fx === 'immortal' ? 'circlet' : (C.wizardHat ? 'hat' : 'hood'));
    s += spell(C, -76, -258);
    return s;
  }
  function warrior(C) {
    var s = ell(0, 2, 58, 10, '#000', ' opacity=".45"') + backWings(C);
    if (C.fx === 'fallen') { s += tail(C); }
    s += legs(C, 'bare') + torso(C, 'bare', true);
    s += limb('M68,-20 L68,-296', U(C, 'wood'), 7);
    s += ln('M65,-120 L71,-124 M65,-110 L71,-114 M65,-100 L71,-104', U(C, 'leather'), 2.5);
    s += shp('M68,-290 C96,-300 116,-270 108,-236 C96,-248 82,-252 68,-250Z', U(C, 'blade'));
    s += shp('M68,-290 C40,-300 20,-270 28,-236 C40,-248 54,-252 68,-250Z', U(C, 'blade'));
    s += ln('M102,-262 C100,-252 96,-246 92,-244 M34,-262 C36,-252 40,-246 44,-244', '#fff', 1.4, ' opacity=".7"');
    s += shp('M62,-300 L68,-318 L74,-300Z', U(C, 'trim'));
    s += arm(C, 44, -196, 64, -164, 68, -140, 'bare');
    s += arm(C, -44, -196, -60, -160, -54, -128, 'bare');
    s += head(C, C.fx === 'immortal' ? 'crown' : 'hair');
    return s;
  }
  function lancer(C) {
    var s = ell(0, 2, 52, 10, '#000', ' opacity=".45"') + backWings(C) + cape(C, false);
    s += legs(C, 'plate') + torso(C, 'plate') + pauldrons(C, false, C.fx === 'fallen');
    s += limb('M60,10 L60,-312', U(C, 'wood'), 5);
    s += shp('M60,-300 C74,-296 96,-288 108,-294 C100,-282 104,-268 92,-262 C82,-268 70,-272 60,-270Z', U(C, 'cloth'));
    s += emblem(C, 80, -282, 0.8);
    s += shp('M54,-308 C54,-328 60,-344 60,-350 C60,-344 66,-328 66,-308 L60,-302Z', U(C, 'blade'));
    s += ln('M60,-346 L60,-308', '#fff', 1, ' opacity=".7"') + shp('M50,-310 L70,-310 L66,-302 L54,-302Z', U(C, 'trim'));
    s += arm(C, 36, -196, 56, -168, 60, -146, 'plate');
    s += arm(C, -36, -196, -56, -164, -54, -138, 'plate');
    s += head(C, 'helm');
    s += roundShield(C, -60, -128, 30);
    return s;
  }
  function seraph(C) {
    var s = ell(0, 2, 60, 10, '#000', ' opacity=".45"');
    s += '<g transform="translate(0 -40) scale(1.15)">' + wings(C, 'feather-big') + '</g>' + wings(C, 'feather-big');
    s += '<g transform="translate(0 60) scale(.8)">' + wings(C, 'feather') + '</g>';
    s += torso(C, 'robe');
    s += sword(C, 0, -120, 120, 180, true);
    s += arm(C, 36, -196, 30, -150, 4, -128, 'robe');
    s += arm(C, -36, -196, -30, -150, -4, -128, 'robe');
    s += head(C, 'circlet');
    return s;
  }
  function tyrant(C) {
    var s = '<g' + F(C, 'soft') + '>' + circ(0, -170, 110, C.P.a, ' opacity=".35"') + '</g>';
    s += ell(0, 2, 66, 11, '#000', ' opacity=".5"') + wings(C, 'bat') + cape(C, true);
    s += legs(C, 'plate') + torso(C, 'plate', true) + pauldrons(C, true, true);
    s += '<g' + F(C, 'glow') + '>' + circ(0, -170, 9, C.P.c) + circ(0, -170, 14, 'none', ' stroke="' + C.P.a + '" stroke-width="2"') + '</g>';
    s += sword(C, 80, -110, 220, 2, true);
    s += arm(C, 48, -196, 72, -158, 80, -118, 'plate');
    s += arm(C, -48, -196, -72, -156, -64, -122, 'plate');
    s += head(C, 'greathelm');
    s += horns(C, -262, 18);
    s += shp('M-18,-274 L-20,-294 L-10,-280 L-4,-300 L0,-282 L4,-300 L10,-280 L20,-294 L18,-274Z', U(C, 'trim'));
    return s;
  }

  // ---------- creature styles ----------
  // Fairy for Immortal, imp/goblin for Fallen. Feet at 0, about 170 tall.
  function sprite(C) {
    var fairy = C.fx === 'immortal', s = ell(0, 2, 40, 8, '#000', ' opacity=".45"');
    if (fairy) {
      var w = shp('M-12,-120 C-70,-190 -120,-150 -92,-108 C-80,-92 -40,-100 -14,-108Z', U(C, 'feather'), ' opacity=".7" stroke-width="1.2"') +
        shp('M-12,-104 C-60,-96 -90,-60 -64,-46 C-44,-38 -22,-70 -12,-92Z', U(C, 'feather'), ' opacity=".6" stroke-width="1.2"') +
        ln('M-14,-112 C-50,-140 -80,-140 -96,-116 M-14,-100 C-40,-84 -56,-66 -64,-50', '#fff', 1, ' opacity=".7"');
      s += '<g' + F(C, 'glow') + '>' + w + mirror(w) + '</g>';
    } else {
      var b = '<g transform="translate(14 60) scale(.62)">' + batWing(C) + '</g>';
      s += b + mirror(b) + '<g transform="translate(-14 -40)">' + tail(C) + '</g>';
    }
    s += limb('M-10,-46 L-12,-6', U(C, 'skin'), 9) + limb('M10,-46 L12,-6', U(C, 'skin'), 9);
    s += ell(-14, -3, 9, 4.5, fairy ? U(C, 'trim') : U(C, 'leather'), ' stroke="' + OUT + '" stroke-width="1.5"') + ell(14, -3, 9, 4.5, fairy ? U(C, 'trim') : U(C, 'leather'), ' stroke="' + OUT + '" stroke-width="1.5"');
    if (fairy) {
      s += shp('M-14,-96 C-20,-70 -34,-50 -40,-36 C-14,-30 14,-30 40,-36 C34,-50 20,-70 14,-96Z', U(C, 'cloth'));
      s += ln('M-38,-38 C-14,-32 14,-32 38,-38', U(C, 'trim'), 3);
    } else {
      s += ell(0, -64, 24, 28, U(C, 'skin'), ' stroke="' + OUT + '" stroke-width="2"');
      s += ell(0, -58, 14, 16, C.skinShade, ' opacity=".35"');
      s += shp('M-20,-50 L20,-50 L18,-38 L-18,-38Z', U(C, 'leather'));
    }
    s += limb('M-16,-88 L-30,-66 L-34,-54', U(C, 'skin'), 7) + limb('M16,-88 L32,-70 L40,-62', U(C, 'skin'), 7);
    if (fairy) {
      s += ln('M40,-62 L60,-96', U(C, 'trim'), 3) + '<g' + F(C, 'glow') + '><path d="' + spark(62, -100, 9) + '" fill="' + C.P.c + '"/></g>';
    } else {
      s += shp('M40,-62 L44,-100 L50,-62Z', U(C, 'blade')) + shp('M36,-64 L54,-64 L52,-58 L38,-58Z', U(C, 'trim'));
    }
    // big head
    var y = -128;
    if (fairy) { s += shp('M-30,' + (y - 6) + ' C-40,' + (y + 30) + ' -30,' + (y + 44) + ' -18,' + (y + 46) + ' L18,' + (y + 46) + ' C30,' + (y + 44) + ' 40,' + (y + 30) + ' 30,' + (y - 6) + 'Z', U(C, 'hair')); }
    if (!fairy) {
      s += shp('M-26,' + (y + 2) + ' L-58,' + (y - 18) + ' L-30,' + (y + 16) + 'Z', U(C, 'skin')) + shp('M26,' + (y + 2) + ' L58,' + (y - 18) + ' L30,' + (y + 16) + 'Z', U(C, 'skin'));
    }
    s += circ(0, y, 32, U(C, 'skin'), ' stroke="' + OUT + '" stroke-width="2"');
    s += ell(0, y + 16, 22, 12, C.skinShade, ' opacity=".25"');
    [-1, 1].forEach(function (sd) {
      s += ell(sd * 12, y + 2, 8, 9, '#fff', ' stroke="' + OUT + '" stroke-width="1.2"');
      s += '<g' + (fairy ? '' : F(C, 'glow')) + '>' + circ(sd * 12 + sd, y + 3, 5.2, C.eye) + '</g>';
      s += circ(sd * 12 + sd, y + 3, 2.4, '#000') + circ(sd * 12 + sd - 2, y, 1.8, '#fff') + circ(sd * 12 + sd + 1.5, y + 5.5, 0.9, '#fff');
    });
    if (fairy) {
      s += ln('M-6,' + (y + 18) + ' Q0,' + (y + 22) + ' 6,' + (y + 18), '#c0505a', 1.8);
      s += ell(-20, y + 14, 5, 3, '#ff9aa8', ' opacity=".5"') + ell(20, y + 14, 5, 3, '#ff9aa8', ' opacity=".5"');
      s += shp('M-30,' + (y - 6) + ' C-30,' + (y - 40) + ' 30,' + (y - 42) + ' 30,' + (y - 6) + ' C22,' + (y - 18) + ' 12,' + (y - 14) + ' 4,' + (y - 24) + ' C-4,' + (y - 14) + ' -18,' + (y - 18) + ' -30,' + (y - 6) + 'Z', U(C, 'hair'));
      s += '<g transform="translate(0 ' + (y - 40) + ')">' + halo(C, 0, 22) + '</g>';
    } else {
      s += shp('M-14,' + (y + 16) + ' Q0,' + (y + 26) + ' 14,' + (y + 16) + ' Q0,' + (y + 20) + ' -14,' + (y + 16) + 'Z', '#3a0a14');
      s += shp('M-9,' + (y + 18) + ' L-7,' + (y + 23) + ' L-5,' + (y + 19) + 'Z', '#fff', ' stroke-width=".6"') + shp('M9,' + (y + 18) + ' L7,' + (y + 23) + ' L5,' + (y + 19) + 'Z', '#fff', ' stroke-width=".6"');
      s += horns(C, y - 18, 16);
    }
    return s;
  }

  // Four-legged beast facing right. Immortal: feathered wings and a halo (Pegasus, Xuanwu,
  // sacred lion). Fallen: horns, spikes and a burning tail (hellhound, chimera).
  function beast(C) {
    var s = ell(0, 2, 80, 10, '#000', ' opacity=".45"'), i;
    var god = C.fx === 'immortal';
    if (god) { s += featherWing(C, false, -6, -96); }
    s += limb('M-62,-86 C-104,-110 -122,-62 -100,-36', U(C, 'hide'), 11);
    if (god) { s += '<g' + F(C, 'glow') + '>' + circ(-100, -36, 9, C.P.c, ' opacity=".9"') + '</g>'; }
    else { s += '<g' + F(C, 'glow') + '>' + shp('M-100,-36 C-118,-50 -112,-72 -100,-82 C-102,-66 -92,-58 -96,-46 C-90,-52 -86,-60 -88,-70 C-78,-56 -84,-40 -100,-36Z', U(C, 'flame'), ' stroke="none"') + '</g>'; }
    s += limb('M-44,-56 L-50,-30 L-44,-6', U(C, 'hide'), 17) + limb('M-20,-56 L-18,-6', U(C, 'hide'), 17);
    s += ell(0, -78, 70, 38, U(C, 'hide'), ' stroke="' + OUT + '" stroke-width="2"');
    s += ell(-6, -66, 50, 18, '#000', ' opacity=".18"');
    for (i = 0; i < 14; i++) { var fx = -54 + i * 8, fy = -104 + Math.abs(i - 7) * 1.2; s += ln('M' + fx + ',' + fy + ' l4,8', OUT, 1, ' opacity=".35"'); }
    if (!god) {
      for (i = 0; i < 6; i++) { s += shp('M' + (-46 + i * 17) + ',-108 L' + (-38 + i * 17) + ',-140 L' + (-28 + i * 17) + ',-110Z', U(C, 'trim')); }
    }
    s += limb('M34,-56 L38,-30 L36,-6', U(C, 'hide'), 18) + limb('M56,-60 L64,-32 L62,-6', U(C, 'hide'), 18);
    [[-44, -4], [-18, -4], [36, -4], [62, -4]].forEach(function (p) {
      s += ell(p[0] + 3, p[1] + 2, 12, 5, god ? U(C, 'trim') : U(C, 'leather'), ' stroke="' + OUT + '" stroke-width="1.5"');
      if (!god) { s += ln('M' + (p[0] + 10) + ',' + (p[1] + 2) + ' l6,2 M' + (p[0] + 8) + ',' + (p[1] + 5) + ' l6,2', '#fff', 1.2); }
    });
    s += ell(36, -64, 28, 22, mix(C.hide, '#fff', 0.2), ' opacity=".35"');
    s += shp('M38,-102 L66,-134 L82,-100 L58,-60Z', U(C, 'hide'));
    // mane
    for (i = 0; i < 7; i++) {
      var ang = (-120 + i * 22) * Math.PI / 180;
      s += shp('M' + n(70 + Math.cos(ang) * 14) + ',' + n(-118 + Math.sin(ang) * 14) + ' L' + n(70 + Math.cos(ang + 0.15) * 40) + ',' + n(-118 + Math.sin(ang + 0.15) * 40) + ' L' + n(70 + Math.cos(ang + 0.35) * 14) + ',' + n(-118 + Math.sin(ang + 0.35) * 14) + 'Z',
        god ? U(C, 'trim') : U(C, 'cloth2'), ' stroke-width="1.2"');
    }
    s += shp('M72,-138 L66,-170 L90,-142Z', U(C, 'hide')) + shp('M94,-136 L102,-168 L112,-134Z', U(C, 'hide'));
    s += ell(88, -116, 31, 25, U(C, 'hide'), ' stroke="' + OUT + '" stroke-width="2"');
    s += shp('M102,-128 L148,-112 L144,-94 L104,-92Z', U(C, 'hide'));
    s += circ(146, -108, 4.5, OUT);
    s += ln('M110,-96 L140,-98', OUT, 1.5);
    if (!god) { s += shp('M122,-96 L126,-84 L130,-96Z', '#fff', ' stroke-width="1"') + shp('M134,-97 L137,-87 L140,-98Z', '#fff', ' stroke-width="1"'); }
    s += '<g' + F(C, 'glow') + '>' + ell(96, -124, 5, 3.6, god ? C.P.c : '#ff3355') + '</g>' + circ(97, -124, 1.6, '#000');
    if (god) { s += '<g transform="translate(88 -160)">' + halo(C, 0, 24) + '</g>'; }
    else { s += '<g transform="translate(86 0)">' + horns(C, -138, 12) + '</g>'; }
    return s;
  }

  // Western chaos dragon (Fallen): bat wings, horns, spines and fire.
  function dragon(C) {
    var s = ell(0, 2, 100, 12, '#000', ' opacity=".5"'), i;
    var wing = function (dx, sc) {
      var tips = [[-120, -270], [-150, -210], [-140, -150], [-96, -124]];
      var w = shp('M-10,-130 L' + tips.map(function (t, k) {
        var nt = tips[k + 1];
        return t[0] + ',' + t[1] + (nt ? ' Q' + n((t[0] + nt[0]) / 2 + 16) + ',' + n((t[1] + nt[1]) / 2 + 10) + ' ' : '');
      }).join('') + ' L-20,-110Z', U(C, 'membrane'));
      tips.forEach(function (t) { w += ln('M-10,-130 L' + t[0] + ',' + t[1], OUT, 4) + ln('M-10,-130 L' + t[0] + ',' + t[1], U(C, 'hide'), 2); });
      return '<g transform="translate(' + dx + ' 0) scale(' + sc + ' 1)">' + w + '</g>';
    };
    s += wing(-6, 1) + wing(20, -0.85);
    s += limb('M-40,-72 C-102,-62 -132,-22 -156,-52', U(C, 'hide'), 22);
    s += ln('M-40,-72 C-102,-62 -132,-22 -156,-52', U(C, 'scale'), 20);
    s += shp('M-156,-52 L-184,-72 L-168,-48 L-186,-38 L-160,-36Z', U(C, 'trim'));
    s += limb('M-24,-62 L-30,-30 L-22,-6', U(C, 'hide'), 18) + limb('M30,-62 L38,-30 L34,-6', U(C, 'hide'), 18);
    [[-22, -4], [36, -4]].forEach(function (p) { s += ln('M' + p[0] + ',' + p[1] + ' l10,3 M' + p[0] + ',' + p[1] + ' l6,6 M' + p[0] + ',' + p[1] + ' l-2,7', U(C, 'trim'), 2.4); });
    s += ell(0, -92, 64, 46, U(C, 'hide'), ' stroke="' + OUT + '" stroke-width="2"');
    s += ell(0, -92, 64, 46, U(C, 'scale'));
    s += shp('M-30,-60 C-10,-50 30,-52 50,-66 L44,-80 C26,-70 -6,-68 -26,-74Z', U(C, 'trim'), ' stroke-width="1.5"');
    s += ln('M-20,-62 L-18,-72 M-6,-58 L-4,-70 M8,-58 L10,-70 M22,-60 L24,-72 M36,-64 L38,-74', OUT, 1, ' opacity=".5"');
    for (i = 0; i < 6; i++) { s += shp('M' + (-46 + i * 16) + ',-134 L' + (-40 + i * 16) + ',-156 L' + (-32 + i * 16) + ',-134Z', U(C, 'trim')); }
    s += limb('M36,-104 C82,-136 70,-196 98,-220', U(C, 'hide'), 32);
    s += ln('M36,-104 C82,-136 70,-196 98,-220', U(C, 'scale'), 30);
    s += limb('M50,-96 L70,-70 L82,-74', U(C, 'hide'), 12);
    s += shp('M86,-242 C106,-262 150,-256 168,-230 C154,-214 120,-204 96,-212Z', U(C, 'hide'));
    s += shp('M100,-214 C120,-206 150,-210 166,-222 L160,-212 C140,-200 116,-198 100,-206Z', '#3a0a14');
    for (i = 0; i < 4; i++) { s += shp('M' + (112 + i * 12) + ',-211 L' + (114 + i * 12) + ',-203 L' + (117 + i * 12) + ',-212Z', '#fff', ' stroke-width=".6"'); }
    s += '<g' + F(C, 'glow') + '>' + shp('M164,-222 C188,-228 214,-212 236,-218 C220,-204 196,-200 166,-212Z', U(C, 'flame'), ' stroke="none"') + circ(170, -218, 6, C.P.c) + '</g>';
    s += shp('M96,-250 L64,-292 L110,-256Z', U(C, 'trim')) + shp('M118,-254 L116,-302 L134,-256Z', U(C, 'trim'));
    s += '<g' + F(C, 'glow') + '>' + ell(134, -236, 6, 3.4, '#ffd23a') + '</g>' + ell(135, -236, 1.4, 3, '#000');
    return s;
  }

  // Celestial Eastern dragon (Immortal): long scaled body, golden mane, whiskers, a pearl.
  function serpent(C) {
    var s = ell(-10, 2, 110, 12, '#000', ' opacity=".4"'), i;
    for (i = 0; i < 4; i++) { s += ell(-120 + i * 80, -30 - (i % 2) * 120, 40, 12, '#fff', ' opacity=".35"' + F(C, 'soft')); }
    var body = 'M-140,-28 C-80,6 -34,-92 20,-72 C84,-50 108,-156 46,-178 C2,-194 8,-238 60,-250';
    s += ln(body, OUT, 40) + ln(body, U(C, 'hide'), 35) + ln(body, U(C, 'scale'), 35);
    s += ln(body, mix(C.hide, '#fff', 0.45), 9, ' stroke-dasharray="7 6" opacity=".7"');
    var mane = [[-104, -18], [-66, -40], [-24, -78], [14, -86], [62, -86], [84, -128], [62, -170], [22, -196], [28, -226]];
    s += '<g' + F(C, 'glow') + '>';
    mane.forEach(function (p) { s += shp('M' + p[0] + ',' + (p[1] - 14) + ' C' + (p[0] - 8) + ',' + (p[1] - 30) + ' ' + (p[0] + 6) + ',' + (p[1] - 38) + ' ' + (p[0] + 2) + ',' + (p[1] - 48) + ' C' + (p[0] + 14) + ',' + (p[1] - 34) + ' ' + (p[0] + 12) + ',' + (p[1] - 22) + ' ' + (p[0] + 10) + ',' + (p[1] - 14) + 'Z', U(C, 'flame'), ' stroke="none"'); });
    s += '</g>';
    s += limb('M-20,-62 L-30,-26 L-16,-16', U(C, 'hide'), 10) + limb('M76,-110 L104,-88 L112,-98', U(C, 'hide'), 10);
    [[-16, -16], [112, -98]].forEach(function (p) { s += ln('M' + p[0] + ',' + p[1] + ' l8,2 M' + p[0] + ',' + p[1] + ' l4,7', U(C, 'trim'), 2); });
    s += shp('M52,-262 C72,-282 116,-276 134,-254 C120,-238 88,-232 60,-238Z', U(C, 'hide'));
    s += shp('M66,-240 C86,-232 116,-236 132,-248 L128,-240 C110,-228 86,-226 66,-234Z', '#3a0a14');
    s += ln('M70,-272 L58,-304 M60,-290 L46,-298 M88,-276 L88,-310 M88,-296 L100,-306', U(C, 'trim'), 4.5);
    s += ln('M130,-252 C156,-244 166,-216 184,-214 M126,-244 C146,-232 146,-200 162,-190', U(C, 'trim'), 2.4);
    s += '<g' + F(C, 'glow') + '>' + ell(100, -260, 5, 3.2, C.P.c) + '</g>' + ell(101, -260, 1.3, 2.8, '#000');
    s += circ(-70, -196, 36, U(C, 'aura'));
    s += '<g' + F(C, 'glow') + '>' + circ(-70, -196, 16, '#fff') + circ(-70, -196, 20, 'none', ' stroke="' + C.P.c + '" stroke-width="2"') + '</g>';
    return s;
  }

  // ---------- frame ----------
  function frame(C) {
    var f = U(C, 'frame'), s = '<rect width="300" height="420" fill="' + U(C, 'vig') + '"/>';
    s += '<rect x="6" y="6" width="288" height="408" rx="12" fill="none" stroke="' + f + '" stroke-width="3"/>';
    s += '<rect x="12" y="12" width="276" height="396" rx="9" fill="none" stroke="' + C.frame + '" stroke-width="1" opacity=".6"/>';
    var corner = shp('M6,40 C6,18 18,6 40,6 L40,12 C22,12 12,22 12,40Z', f, ' stroke-width="1"') +
      '<path d="' + spark(22, 22, 7) + '" fill="' + f + '" stroke="' + OUT + '" stroke-width=".8"/>';
    s += corner + '<g transform="translate(300 0) scale(-1 1)">' + corner + '</g>' +
      '<g transform="translate(0 420) scale(1 -1)">' + corner + '</g>' + '<g transform="translate(300 420) scale(-1 -1)">' + corner + '</g>';
    if (C.rar === 'SSR' || C.rar === 'L' || C.rar === 'SR') {
      s += shp('M136,6 L150,0 L164,6 L150,14Z', f, ' stroke-width="1"');
    }
    return s;
  }

  var FIGURES = { sprite: sprite, archer: archer, knight: knight, mage: mage, seraph: seraph, tyrant: tyrant, beast: beast,
    dragon: dragon, warrior: warrior, lancer: lancer, serpent: serpent };
  var STYLE_SCALE = { sprite: 1.25, archer: 0.95, knight: 0.92, mage: 0.86, seraph: 0.8, tyrant: 0.8, beast: 1.0, dragon: 0.74,
    warrior: 0.9, lancer: 0.86, serpent: 0.78 };
  var STYLE_DX = { beast: -14, dragon: 4, serpent: -10, archer: 14, mage: 2 };
  var RARITY_SCALE = { N: 0.94, HN: 0.96, R: 1, HR: 1.02, SR: 1.04, SSR: 1.07, L: 1.09 };

  var cache = {};

  // o: { id, element (colour look), style, rarity, faction }
  function render(o) {
    var key = o.id + '|' + o.element + '|' + o.style + '|' + o.rarity + '|' + (o.faction || '');
    if (cache[key]) { return cache[key]; }
    var R = rng(hash(o.id));
    var fx = o.faction || 'mortal';
    var P = PAL[o.element] || PAL.light;
    var C = {
      id: slug(o.id), P: P, R: R, el: o.element, fx: fx, rar: o.rarity, M: METAL[fx],
      skin: SKIN[fx][0], skinShade: SKIN[fx][1],
      hair: fx === 'immortal' ? pick(R, ['#f3e2a8', '#e8e2d0', '#c9a25a', '#b8d0ff']) : (fx === 'fallen' ? pick(R, ['#16131c', '#e8e2f4', '#8a2f2a', '#3a2a5a']) : pick(R, HAIR)),
      eye: fx === 'immortal' ? '#e8b830' : (fx === 'fallen' ? '#ff2a55' : pick(R, EYES)),
      cloth: fx === 'immortal' ? '#f1ece0' : (fx === 'fallen' ? pick(R, ['#3a1030', '#2a1440', '#4a0f18']) : pick(R, CLOTH)),
      cloth2: fx === 'immortal' ? mix(P.a, '#ffffff', 0.35) : (fx === 'fallen' ? pick(R, ['#7a1428', '#5a1a6a', '#1e1424']) : mix(pick(R, CLOTH), '#000000', 0.15)),
      hide: fx === 'immortal' ? mix(P.a, '#ffffff', 0.55) : (fx === 'fallen' ? mix(P.b, '#1a0e14', 0.45) : mix(P.b, '#6a5a40', 0.4)),
      frame: FRAME[o.rarity] || FRAME.N,
      longHair: R() < 0.45, warpaint: R() < 0.4, plume: R() < 0.6, spiky: R() < 0.5, wizardHat: R() < 0.6, closedHelm: R() < 0.5
    };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">';
    s += defs(C) + background(C);
    if (o.rarity === 'SSR' || o.rarity === 'L') {
      s += circ(150, 222, 132, U(C, 'aura'), ' opacity=".55"') +
        circ(150, 222, 126, 'none', ' stroke="' + P.c + '" stroke-width="2" stroke-dasharray="4 10" opacity=".75"') +
        circ(150, 222, 150, 'none', ' stroke="' + P.c + '" stroke-width="1.4" opacity=".35"');
    } else if (o.rarity === 'SR' || o.rarity === 'HR') {
      s += circ(150, 232, 116, U(C, 'aura'), ' opacity=".3"');
    }
    var fig = FIGURES[o.style] || FIGURES.sprite;
    var sc = (STYLE_SCALE[o.style] || 1) * (RARITY_SCALE[o.rarity] || 1);
    s += '<g transform="translate(' + (150 + (STYLE_DX[o.style] || 0)) + ' 360) scale(' + n(sc * 100) / 100 + ')">' + fig(C) + '</g>';
    s += particles(C, { L: 26, SSR: 20, SR: 14, HR: 10, R: 8 }[o.rarity] || 6);
    s += frame(C);
    s += '</svg>';
    cache[key] = s;
    return s;
  }

  // The same pictures as image URLs. The game shows these in <img> tags: the browser draws
  // each picture once and reuses it, which keeps long card lists quick on a phone.
  var urls = {};
  function toUrl(key, svg) {
    if (!urls[key]) { urls[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
    return urls[key];
  }
  function cardOpts(def) { return { id: def.id, element: def.look, style: def.style, rarity: def.rarity, faction: def.faction }; }
  function enemyOpts(u) { return { id: 'foe-' + slug(u.name), element: u.look, style: u.style || 'beast', rarity: u.boss ? 'SSR' : 'R', faction: u.faction }; }

  var api = {
    // "look" picks the colour scene (fire, water, wind, light, dark); it is art only.
    card: function (def) { return render(cardOpts(def)); },
    enemy: function (u) { return render(enemyOpts(u)); },
    cardUrl: function (def) { return toUrl('c:' + def.id, render(cardOpts(def))); },
    enemyUrl: function (u) { var o = enemyOpts(u); return toUrl('e:' + o.id + o.faction + o.rarity, render(o)); },
    render: render
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  return api;
})();
