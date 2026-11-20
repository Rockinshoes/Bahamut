/*
 * art.js - draws placeholder card art in code (SVG), so every card and enemy
 * has a picture without needing any image files. It works everywhere, including
 * the single-file version on a phone.
 *
 * To use your own art instead, put  assets/cards/<card-id>.png  in place and the
 * game shows that image instead of this drawing.
 *
 * Art.card(cardDef)   -> SVG string for a card
 * Art.enemy(unit)     -> SVG string for an enemy (unit has name, look, style, boss)
 */
var Art = (function () {
  'use strict';

  // a = main color, b = deep tone, c = bright accent, d = near-black tint
  var PAL = {
    fire:  { a: '#ff8a3d', b: '#8a2a10', c: '#ffd88a', d: '#2b0d07' },
    water: { a: '#3fb6ff', b: '#0f3a7d', c: '#b5ecff', d: '#06172f' },
    wind:  { a: '#5be08a', b: '#146135', c: '#dcffc8', d: '#082512' },
    light: { a: '#ffd95a', b: '#9a6a14', c: '#fff9de', d: '#3b2907' },
    dark:  { a: '#b47cff', b: '#3a1768', c: '#ecd6ff', d: '#10061f' }
  };

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

  function spark(x, y, r) {
    return 'M' + n(x) + ',' + n(y - r) + ' Q' + n(x) + ',' + n(y) + ' ' + n(x + r) + ',' + n(y) +
      ' Q' + n(x) + ',' + n(y) + ' ' + n(x) + ',' + n(y + r) +
      ' Q' + n(x) + ',' + n(y) + ' ' + n(x - r) + ',' + n(y) +
      ' Q' + n(x) + ',' + n(y) + ' ' + n(x) + ',' + n(y - r) + 'Z';
  }

  // ---------- backgrounds ----------
  function background(P, el, id, R) {
    var s = '<defs>' +
      '<linearGradient id="bg' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.b + '"/><stop offset="1" stop-color="' + P.d + '"/></linearGradient>' +
      '<radialGradient id="gl' + id + '" cx="0.5" cy="0.7" r="0.6"><stop offset="0" stop-color="' + P.a + '" stop-opacity="0.75"/><stop offset="1" stop-color="' + P.a + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="fl' + id + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + P.c + '" stop-opacity="0.95"/><stop offset="1" stop-color="' + P.a + '" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      '<rect width="300" height="420" fill="url(#bg' + id + ')"/>' +
      '<rect width="300" height="420" fill="url(#gl' + id + ')"/>';
    var i, x, y, h;
    if (el === 'fire') {
      s += '<path d="M0,300 L40,250 L80,285 L130,225 L180,280 L230,240 L300,290 V420 H0Z" fill="' + P.d + '" opacity=".55"/>';
      for (i = 0; i < 9; i++) {
        x = 10 + i * 34 + R() * 10; h = 60 + R() * 110; y = 350;
        s += '<path d="M' + n(x) + ',' + y + ' C' + n(x - 20) + ',' + n(y - h * 0.4) + ' ' + n(x + 8) + ',' + n(y - h * 0.65) + ' ' + n(x) + ',' + n(y - h) +
          ' C' + n(x + 24) + ',' + n(y - h * 0.6) + ' ' + n(x + 22) + ',' + n(y - h * 0.25) + ' ' + n(x) + ',' + y + 'Z" fill="url(#fl' + id + ')" opacity=".6"/>';
      }
      for (i = 0; i < 16; i++) {
        s += '<circle cx="' + n(R() * 300) + '" cy="' + n(80 + R() * 270) + '" r="' + n(1 + R() * 2) + '" fill="' + P.c + '" opacity=".75"/>';
      }
    } else if (el === 'water') {
      for (i = 0; i < 3; i++) {
        x = 20 + i * 90 + R() * 30;
        s += '<polygon points="' + n(x) + ',0 ' + n(x + 34) + ',0 ' + n(x + 90) + ',330 ' + n(x - 20) + ',330" fill="' + P.c + '" opacity=".09"/>';
      }
      for (i = 0; i < 12; i++) {
        s += '<circle cx="' + n(R() * 300) + '" cy="' + n(90 + R() * 240) + '" r="' + n(2 + R() * 6) + '" fill="none" stroke="' + P.c + '" stroke-width="1.5" opacity=".5"/>';
      }
      for (i = 0; i < 3; i++) {
        y = 300 + i * 30;
        s += '<path d="M0,' + y + ' Q37,' + (y - 16) + ' 75,' + y + ' T150,' + y + ' T225,' + y + ' T300,' + y + ' V420 H0Z" fill="' + P.a + '" opacity="' + n(0.16 + i * 0.1) + '"/>';
      }
    } else if (el === 'wind') {
      s += '<path d="M0,335 Q80,295 160,330 T300,312 V420 H0Z" fill="' + P.d + '" opacity=".55"/>';
      for (i = 0; i < 7; i++) {
        x = R() * 140 - 20; y = 70 + R() * 240;
        s += '<path d="M' + n(x) + ',' + n(y) + ' C' + n(x + 70) + ',' + n(y - 36) + ' ' + n(x + 130) + ',' + n(y + 34) + ' ' + n(x + 190) + ',' + n(y - 8) +
          ' S' + n(x + 240) + ',' + n(y - 40) + ' ' + n(x + 280) + ',' + n(y - 20) + '" fill="none" stroke="' + P.c + '" stroke-width="' + n(1.5 + R() * 2) + '" stroke-linecap="round" opacity=".35"/>';
      }
      for (i = 0; i < 9; i++) {
        x = R() * 300; y = 60 + R() * 280;
        s += '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="8" ry="3.2" transform="rotate(' + n(R() * 180) + ' ' + n(x) + ' ' + n(y) + ')" fill="' + P.a + '" opacity=".65"/>';
      }
    } else if (el === 'light') {
      for (i = 0; i < 12; i++) {
        var a1 = -0.2 + i * 0.29, a2 = a1 + 0.1;
        s += '<polygon points="150,80 ' + n(150 + Math.cos(a1) * 520) + ',' + n(80 + Math.sin(a1) * 520) + ' ' + n(150 + Math.cos(a2) * 520) + ',' + n(80 + Math.sin(a2) * 520) + '" fill="' + P.c + '" opacity=".11"/>';
      }
      s += '<circle cx="150" cy="120" r="74" fill="none" stroke="' + P.c + '" stroke-width="3" opacity=".4"/>' +
        '<circle cx="150" cy="120" r="98" fill="none" stroke="' + P.c + '" stroke-width="2" stroke-dasharray="3 9" opacity=".4"/>';
      for (i = 0; i < 4; i++) {
        s += '<ellipse cx="' + n(R() * 300) + '" cy="' + n(330 + R() * 70) + '" rx="' + n(60 + R() * 50) + '" ry="' + n(14 + R() * 10) + '" fill="#fff" opacity=".1"/>';
      }
    } else {
      s += '<circle cx="222" cy="100" r="48" fill="' + P.c + '" opacity=".9"/><circle cx="238" cy="88" r="44" fill="' + P.b + '"/>';
      for (i = 0; i < 24; i++) {
        s += '<circle cx="' + n(R() * 300) + '" cy="' + n(R() * 300) + '" r="' + n(0.6 + R() * 1.6) + '" fill="' + P.c + '" opacity=".8"/>';
      }
      for (i = 0; i < 5; i++) {
        x = 30 + i * 60 + R() * 20;
        s += '<path d="M' + n(x) + ',420 C' + n(x - 44) + ',340 ' + n(x + 44) + ',290 ' + n(x - 10) + ',200" fill="none" stroke="' + P.a + '" stroke-width="3" stroke-linecap="round" opacity=".35"/>';
      }
      s += '<ellipse cx="150" cy="400" rx="190" ry="40" fill="' + P.a + '" opacity=".16"/>';
    }
    return s;
  }

  // ---------- drawing helpers (figures are drawn with their feet at 0,0, facing up/negative y) ----------
  function limb(P, d, w) {
    return '<path d="' + d + '" fill="none" stroke="' + P.a + '" stroke-width="' + (w + 3) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + P.d + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function shape(P, d, fill) {
    return '<path d="' + d + '" fill="' + fill + '" stroke="' + P.a + '" stroke-width="2" stroke-linejoin="round"/>';
  }
  function body(P, tag) {
    return '<' + tag + ' fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2.5"/>';
  }
  function shadow(w) { return '<ellipse cx="0" cy="3" rx="' + w + '" ry="9" fill="#000" opacity=".4"/>'; }
  function eye(P, x, y, r) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + n(r * 2.3) + '" fill="' + P.c + '" opacity=".25"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + P.c + '"/>';
  }
  function mirror(svg) { return '<g transform="scale(-1 1)">' + svg + '</g>'; }

  // A small element mark that sits above a head.
  function accent(P, el, x, y) {
    if (el === 'fire') {
      return shape(P, 'M' + x + ',' + y + ' C' + (x - 14) + ',' + (y - 14) + ' ' + (x + 2) + ',' + (y - 22) + ' ' + (x - 2) + ',' + (y - 38) +
        ' C' + (x + 14) + ',' + (y - 24) + ' ' + (x + 18) + ',' + (y - 10) + ' ' + x + ',' + y + 'Z', P.c);
    }
    if (el === 'water') {
      return shape(P, 'M' + x + ',' + (y - 34) + ' C' + (x + 16) + ',' + (y - 12) + ' ' + (x + 14) + ',' + y + ' ' + x + ',' + y +
        ' C' + (x - 14) + ',' + y + ' ' + (x - 16) + ',' + (y - 12) + ' ' + x + ',' + (y - 34) + 'Z', P.c);
    }
    if (el === 'wind') {
      return shape(P, 'M' + (x - 14) + ',' + y + ' C' + (x - 6) + ',' + (y - 22) + ' ' + (x + 10) + ',' + (y - 26) + ' ' + (x + 16) + ',' + (y - 30) +
        ' C' + (x + 14) + ',' + (y - 12) + ' ' + x + ',' + (y - 2) + ' ' + (x - 14) + ',' + y + 'Z', P.c);
    }
    if (el === 'light') {
      return '<ellipse cx="' + x + '" cy="' + (y - 10) + '" rx="20" ry="6" fill="none" stroke="' + P.c + '" stroke-width="4"/>';
    }
    return shape(P, 'M' + x + ',' + (y - 34) + ' L' + (x + 10) + ',' + (y - 14) + ' L' + x + ',' + y + ' L' + (x - 10) + ',' + (y - 14) + 'Z', P.c);
  }

  // ---------- faction overlays ----------
  // Immortal (gods): halo, and feathered wings on armored figures.
  // Fallen (demons): horns, and bat wings on robed or armored figures.
  // Mortal (humans): nothing extra.
  function featherWing(P) {
    return shape(P, 'M-26,-172 C-96,-250 -150,-210 -138,-120 C-120,-150 -92,-146 -70,-128 C-62,-112 -44,-118 -26,-138Z', P.c) +
      '<path d="M-60,-190 L-112,-156 M-70,-170 L-124,-136 M-80,-150 L-128,-126" stroke="' + P.b + '" stroke-width="2" opacity=".6"/>';
  }
  function batWing(P) {
    return shape(P, 'M-26,-170 L-120,-236 L-108,-190 L-150,-196 L-122,-150 L-150,-130 L-96,-128 L-60,-112 L-30,-134Z', P.b) +
      '<path d="M-26,-170 L-108,-190 M-26,-170 L-122,-150 M-26,-170 L-96,-128" stroke="' + P.a + '" stroke-width="1.5" opacity=".7"/>';
  }
  function backOverlay(P, fx, wings) {
    if (!wings) { return ''; }
    if (fx === 'immortal') { var w = featherWing(P); return w + mirror(w); }
    if (fx === 'fallen') { var b = batWing(P); return b + mirror(b); }
    return '';
  }
  // Halo or horns for a head centred at (0, y) with radius r.
  function headOverlay(P, fx, y, r) {
    if (fx === 'immortal') {
      return '<ellipse cx="0" cy="' + (y - r - 12) + '" rx="' + (r + 4) + '" ry="7" fill="none" stroke="' + P.c + '" stroke-width="5"/>' +
        '<ellipse cx="0" cy="' + (y - r - 12) + '" rx="' + (r + 4) + '" ry="7" fill="none" stroke="#fff" stroke-width="1.5" opacity=".8"/>';
    }
    if (fx === 'fallen') {
      var t = y - r + 6;
      return shape(P, 'M-' + (r - 6) + ',' + t + ' C-' + (r + 10) + ',' + (t - 10) + ' -' + (r + 14) + ',' + (t - 30) + ' -' + (r + 4) + ',' + (t - 44) +
          ' C-' + (r + 2) + ',' + (t - 26) + ' -' + (r - 6) + ',' + (t - 16) + ' -' + (r - 14) + ',' + (t - 6) + 'Z', P.a) +
        shape(P, 'M' + (r - 6) + ',' + t + ' C' + (r + 10) + ',' + (t - 10) + ' ' + (r + 14) + ',' + (t - 30) + ' ' + (r + 4) + ',' + (t - 44) +
          ' C' + (r + 2) + ',' + (t - 26) + ' ' + (r - 6) + ',' + (t - 16) + ' ' + (r - 14) + ',' + (t - 6) + 'Z', P.a);
    }
    return '';
  }

  // ---------- figures ----------
  function sprite(P, R, el, fx) {
    var fairy = fx === 'immortal';
    var s = shadow(38);
    if (!fairy) { s += limb(P, 'M14,-34 C46,-30 58,-72 38,-88', 6); }
    var wingFill = fairy ? P.c : P.b;
    s += '<g opacity="' + (fairy ? '.8' : '1') + '">' +
      shape(P, 'M-14,-84 C-62,-132 -96,-96 -62,-68 C-74,-60 -44,-56 -16,-62Z', wingFill) +
      shape(P, 'M14,-84 C62,-132 96,-96 62,-68 C74,-60 44,-56 16,-62Z', wingFill) + '</g>';
    s += limb(P, 'M-12,-14 L-14,-2', 10) + limb(P, 'M12,-14 L14,-2', 10);
    s += '<ellipse cx="0" cy="-48" rx="30" ry="38" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2.5"/>';
    s += '<ellipse cx="0" cy="-42" rx="17" ry="24" fill="' + P.b + '" opacity=".75"/>';
    s += limb(P, 'M-26,-56 L-42,-40', 9) + limb(P, 'M26,-56 L42,-40', 9);
    s += '<circle cx="0" cy="-104" r="34" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2.5"/>';
    if (fairy) { s += headOverlay(P, 'immortal', -104, 34); }
    else { s += shape(P, 'M-26,-124 L-34,-156 L-12,-132Z', P.a) + shape(P, 'M26,-124 L34,-156 L12,-132Z', P.a); }
    s += eye(P, -13, -106, 6) + eye(P, 13, -106, 6);
    s += '<path d="M-9,-86 Q0,-79 9,-86" stroke="' + P.c + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    if (!fx) { s += accent(P, el, 0, -150); }
    return s;
  }

  // Shared human body. o.robe draws a long robe instead of legs; o.wide makes a heavier build.
  function human(P, o) {
    var s = '';
    if (o.cape) { s += shape(P, 'M-38,-176 L-70,-8 L70,-8 L38,-176Z', o.cape); }
    if (o.robe) {
      s += shape(P, 'M-36,-178 L-64,0 L64,0 L36,-178Z', P.d);
      s += '<path d="M0,-178 L0,0" stroke="' + P.a + '" stroke-width="2" opacity=".5"/>';
      s += '<path d="M-54,-22 L54,-22" stroke="' + P.c + '" stroke-width="3" opacity=".6"/>';
    } else {
      s += limb(P, 'M-14,-100 L-18,-52 L-16,-8', 20) + limb(P, 'M14,-100 L18,-52 L16,-8', 20);
      s += '<ellipse cx="-17" cy="-4" rx="15" ry="7" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2"/>';
      s += '<ellipse cx="17" cy="-4" rx="15" ry="7" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2"/>';
    }
    var w = o.wide ? 52 : 38;
    s += shape(P, 'M' + (-w) + ',-176 Q0,-192 ' + w + ',-176 L' + (w - 10) + ',-96 Q0,-86 ' + (-(w - 10)) + ',-96Z', P.d);
    s += '<path d="M' + (-(w - 12)) + ',-168 Q0,-158 ' + (w - 12) + ',-168" stroke="' + P.c + '" stroke-width="2" fill="none" opacity=".6"/>';
    s += '<rect x="' + (-(w - 10)) + '" y="-104" width="' + (2 * (w - 10)) + '" height="9" rx="3" fill="' + P.b + '" stroke="' + P.a + '" stroke-width="1.5"/>';
    return s;
  }
  function head(P, r, y) {
    return '<rect x="-8" y="' + (y + r - 6) + '" width="16" height="12" fill="' + P.d + '"/>' +
      '<circle cx="0" cy="' + y + '" r="' + r + '" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2.5"/>' +
      eye(P, -9, y + 2, 4.5) + eye(P, 9, y + 2, 4.5);
  }

  function archer(P, R, el, fx) {
    var s = shadow(46);
    s += shape(P, 'M30,-190 L46,-198 L56,-148 L40,-142Z', P.b);
    s += '<path d="M40,-198 L36,-214 M46,-196 L46,-214 M52,-194 L56,-212" stroke="' + P.c + '" stroke-width="2.5"/>';
    s += human(P, { cape: P.b });
    s += shape(P, 'M-34,-186 C-44,-250 44,-250 34,-186Z', P.b);
    s += head(P, 23, -206);
    s += limb(P, 'M-36,-168 L-64,-152 L-82,-142', 14);
    s += limb(P, 'M36,-168 L10,-156 L-36,-144', 14);
    s += '<path d="M-90,-224 C-144,-176 -144,-108 -90,-60" fill="none" stroke="' + P.c + '" stroke-width="6" stroke-linecap="round"/>';
    s += '<path d="M-90,-224 L-40,-144 L-90,-60" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>';
    s += '<path d="M-96,-143 L-30,-143" stroke="' + P.a + '" stroke-width="3"/>' + shape(P, 'M-100,-143 L-86,-150 L-86,-136Z', P.c);
    s += fx ? headOverlay(P, fx, -206, 23) : '';
    return s;
  }

  function knight(P, R, el, fx) {
    var s = shadow(50);
    s += backOverlay(P, fx, true);
    s += human(P, { cape: P.b });
    s += '<ellipse cx="-46" cy="-172" rx="19" ry="13" fill="' + P.b + '" stroke="' + P.a + '" stroke-width="2"/>';
    s += '<ellipse cx="46" cy="-172" rx="19" ry="13" fill="' + P.b + '" stroke="' + P.a + '" stroke-width="2"/>';
    s += limb(P, 'M-42,-166 L-62,-140 L-60,-118', 15);
    s += limb(P, 'M42,-166 L66,-142 L68,-118', 15);
    s += head(P, 23, -206);
    s += shape(P, 'M-27,-208 C-27,-244 27,-244 27,-208 L27,-196 L-27,-196Z', P.b);
    s += '<path d="M-19,-206 H19" stroke="' + P.c + '" stroke-width="4" stroke-linecap="round"/>';
    s += shape(P, 'M-4,-238 C-34,-266 -40,-224 -16,-212Z', P.a);
    s += shape(P, 'M64,-122 L72,-122 L70,-252 L68,-266 L66,-252Z', P.c);
    s += '<path d="M52,-126 H84" stroke="' + P.a + '" stroke-width="7" stroke-linecap="round"/>';
    s += shape(P, 'M-94,-152 L-50,-152 L-50,-112 C-50,-86 -72,-72 -72,-72 C-72,-72 -94,-86 -94,-112Z', P.b);
    s += shape(P, 'M-72,-136 L-62,-116 L-72,-96 L-82,-116Z', P.c);
    s += fx ? headOverlay(P, fx, -206, 26) : '';
    return s;
  }

  function mage(P, R, el, fx) {
    var s = shadow(58);
    s += backOverlay(P, fx === 'fallen' ? fx : null, true);
    s += human(P, { robe: true });
    s += limb(P, 'M36,-168 L60,-152 L68,-146', 14);
    s += limb(P, 'M-36,-168 L-60,-192 L-66,-212', 14);
    s += '<path d="M68,-262 L68,0" stroke="' + P.a + '" stroke-width="5" stroke-linecap="round"/>';
    s += '<circle cx="68" cy="-270" r="26" fill="' + P.c + '" opacity=".25"/><circle cx="68" cy="-270" r="13" fill="' + P.c + '"/>';
    s += '<circle cx="-68" cy="-226" r="16" fill="' + P.c + '" opacity=".25"/><circle cx="-68" cy="-226" r="8" fill="' + P.c + '"/>';
    s += '<ellipse cx="-68" cy="-226" rx="22" ry="7" fill="none" stroke="' + P.a + '" stroke-width="2" transform="rotate(-25 -68 -226)"/>';
    s += head(P, 23, -206);
    s += shape(P, 'M-36,-226 L0,-296 L36,-226 Q0,-214 -36,-226Z', P.b);
    s += '<ellipse cx="0" cy="-224" rx="42" ry="9" fill="' + P.b + '" stroke="' + P.a + '" stroke-width="2"/>';
    s += '<circle cx="0" cy="-246" r="5" fill="' + P.c + '"/>';
    if (fx === 'immortal') {
      s += '<ellipse cx="0" cy="-306" rx="26" ry="7" fill="none" stroke="' + P.c + '" stroke-width="5"/>';
    } else if (fx === 'fallen') {
      s += shape(P, 'M-30,-232 C-50,-246 -56,-268 -46,-284 C-44,-266 -36,-254 -24,-238Z', P.a) +
        shape(P, 'M30,-232 C50,-246 56,-268 46,-284 C44,-266 36,-254 24,-238Z', P.a);
    }
    return s;
  }

  function seraph(P, R, el) {
    var s = shadow(60);
    var wing = shape(P, 'M-24,-178 C-110,-300 -196,-236 -164,-110 C-152,-152 -112,-152 -82,-122 C-70,-100 -48,-110 -24,-130Z', P.b) +
      shape(P, 'M-24,-160 C-92,-252 -146,-206 -132,-134 C-112,-160 -78,-150 -56,-132Z', P.a) +
      '<path d="M-60,-196 L-120,-160 M-70,-176 L-132,-136 M-80,-156 L-138,-128" stroke="' + P.c + '" stroke-width="2" opacity=".6"/>';
    s += wing + mirror(wing);
    s += human(P, { robe: true });
    s += limb(P, 'M-36,-168 L-26,-132 L0,-122', 14) + limb(P, 'M36,-168 L26,-132 L0,-122', 14);
    s += '<circle cx="0" cy="-122" r="14" fill="' + P.c + '" opacity=".3"/><circle cx="0" cy="-122" r="7" fill="' + P.c + '"/>';
    s += head(P, 23, -206);
    s += '<ellipse cx="0" cy="-246" rx="28" ry="8" fill="none" stroke="' + P.c + '" stroke-width="5"/>';
    s += '<ellipse cx="0" cy="-246" rx="28" ry="8" fill="none" stroke="' + P.a + '" stroke-width="1.5"/>';
    return s;
  }

  function tyrant(P, R, el) {
    var s = shadow(64);
    s += human(P, { wide: true, cape: P.b });
    s += '<circle cx="0" cy="-140" r="13" fill="none" stroke="' + P.c + '" stroke-width="3"/><circle cx="0" cy="-140" r="4" fill="' + P.c + '"/>';
    s += '<ellipse cx="-64" cy="-176" rx="24" ry="15" fill="' + P.b + '" stroke="' + P.a + '" stroke-width="2"/>';
    s += '<ellipse cx="64" cy="-176" rx="24" ry="15" fill="' + P.b + '" stroke="' + P.a + '" stroke-width="2"/>';
    s += shape(P, 'M-76,-186 L-84,-226 L-56,-190Z', P.a) + shape(P, 'M76,-186 L84,-226 L56,-190Z', P.a);
    s += limb(P, 'M-56,-168 L-76,-136 L-66,-108', 18);
    s += limb(P, 'M56,-168 L80,-140 L84,-110', 18);
    s += limb(P, 'M-22,-226 C-52,-236 -62,-266 -44,-292', 9) + limb(P, 'M22,-226 C52,-236 62,-266 44,-292', 9);
    s += head(P, 27, -212);
    s += shape(P, 'M-26,-236 L-18,-256 L-8,-240 L0,-260 L8,-240 L18,-256 L26,-236Z', P.c);
    s += shape(P, 'M78,-110 L92,-110 L94,-308 L85,-328 L76,-308Z', P.c);
    s += '<path d="M62,-116 H108" stroke="' + P.a + '" stroke-width="8" stroke-linecap="round"/>';
    return s;
  }

  function beast(P, R, el, fx) {
    var s = shadow(76);
    if (fx === 'immortal') {
      // Feathered wings for celestial beasts (Pegasus and friends).
      s += '<g transform="translate(-6 -90) rotate(-10)">' + shape(P, 'M0,0 C-30,-90 -110,-110 -120,-60 C-90,-70 -60,-50 -40,-20Z', P.c) +
        '<path d="M-20,-30 L-90,-74 M-30,-14 L-104,-54" stroke="' + P.b + '" stroke-width="2" opacity=".6"/></g>';
    }
    s += limb(P, 'M-62,-84 C-106,-112 -120,-60 -96,-34', 10);
    s += limb(P, 'M-42,-52 L-46,-6', 16) + limb(P, 'M-18,-52 L-16,-6', 16);
    s += '<ellipse cx="0" cy="-74" rx="68" ry="36" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2.5"/>';
    for (var i = 0; i < 6; i++) {
      s += shape(P, 'M' + (-46 + i * 18) + ',-104 L' + (-38 + i * 18) + ',-136 L' + (-28 + i * 18) + ',-106Z', P.a);
    }
    s += limb(P, 'M32,-52 L36,-6', 16) + limb(P, 'M54,-56 L62,-6', 16);
    s += '<ellipse cx="34" cy="-62" rx="26" ry="20" fill="' + P.b + '" opacity=".75"/>';
    s += shape(P, 'M40,-98 L68,-128 L80,-98 L58,-60Z', P.d);
    s += shape(P, 'M70,-132 L66,-166 L90,-138Z', P.d) + shape(P, 'M92,-134 L100,-166 L110,-132Z', P.d);
    s += '<ellipse cx="88" cy="-112" rx="30" ry="24" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2.5"/>';
    s += shape(P, 'M102,-124 L146,-108 L140,-92 L104,-92Z', P.d);
    s += '<circle cx="143" cy="-106" r="4" fill="' + P.c + '"/>';
    s += shape(P, 'M120,-94 L125,-80 L130,-95Z', P.c);
    s += eye(P, 96, -120, 4.5);
    if (fx === 'immortal') {
      s += '<ellipse cx="88" cy="-158" rx="24" ry="6" fill="none" stroke="' + P.c + '" stroke-width="4"/>';
    } else if (fx === 'fallen') {
      s += shape(P, 'M76,-134 C64,-152 66,-170 80,-180 C76,-164 80,-152 88,-140Z', P.a) +
        shape(P, 'M98,-134 C102,-154 112,-166 128,-170 C118,-158 112,-148 106,-134Z', P.a);
    } else {
      s += accent(P, el, 96, -150);
    }
    return s;
  }

  function dragon(P, R, el) {
    var s = shadow(96);
    s += shape(P, 'M-10,-124 L-118,-256 L-90,-210 L-68,-270 L-44,-212 L-16,-256 L6,-150Z', P.b);
    s += shape(P, 'M10,-124 L98,-244 L74,-206 L54,-258 L32,-206 L8,-150Z', P.b);
    s += '<path d="M-90,-210 L-8,-130 M-68,-270 L-6,-134 M-44,-212 L-4,-132" stroke="' + P.a + '" stroke-width="2" opacity=".6"/>';
    s += limb(P, 'M-40,-72 C-102,-62 -130,-22 -150,-52', 18);
    s += shape(P, 'M-150,-52 L-176,-70 L-158,-34Z', P.a);
    s += limb(P, 'M-20,-60 L-24,-8', 18) + limb(P, 'M30,-60 L36,-8', 18);
    s += '<ellipse cx="0" cy="-90" rx="62" ry="44" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2.5"/>';
    s += '<ellipse cx="10" cy="-80" rx="40" ry="28" fill="' + P.b + '" opacity=".75"/>';
    s += limb(P, 'M36,-102 C82,-132 70,-192 96,-216', 30);
    s += shape(P, 'M88,-236 C106,-254 146,-248 162,-224 C146,-208 114,-200 94,-208Z', P.d);
    s += shape(P, 'M96,-244 L70,-286 L108,-252Z', P.a) + shape(P, 'M116,-248 L118,-294 L132,-250Z', P.a);
    s += eye(P, 130, -228, 4.5);
    s += '<path d="M108,-210 Q134,-208 158,-222" stroke="' + P.c + '" stroke-width="2" fill="none"/>';
    s += shape(P, 'M136,-212 L140,-200 L146,-214Z', P.c);
    return s;
  }

  // Axe-wielding fighter (berserker, mercenary, ghoul brute, Siegfried).
  function warrior(P, R, el, fx) {
    var s = shadow(56);
    s += human(P, { wide: true });
    s += '<path d="M-36,-40 L74,-262" stroke="' + P.a + '" stroke-width="7" stroke-linecap="round"/>';
    s += shape(P, 'M62,-270 C100,-272 112,-232 100,-206 C88,-222 74,-230 52,-234Z', P.c);
    s += shape(P, 'M60,-240 C40,-262 30,-280 40,-296 C52,-280 62,-266 70,-256Z', P.c);
    s += limb(P, 'M-46,-168 L-30,-130 L6,-112', 17) + limb(P, 'M46,-168 L58,-140 L40,-150', 17);
    s += head(P, 24, -208);
    s += shape(P, 'M-25,-214 C-22,-242 22,-242 25,-214 C12,-226 -12,-226 -25,-214Z', P.b);
    s += '<path d="M-24,-218 H24" stroke="' + P.c + '" stroke-width="3"/>';
    s += fx ? headOverlay(P, fx, -208, 24) : '';
    return s;
  }

  // Spear fighter (militia, high lancer, Achilles, Valkyrie, Odin).
  function lancer(P, R, el, fx) {
    var s = shadow(48);
    s += backOverlay(P, fx, true);
    s += human(P, { cape: P.b });
    s += '<path d="M58,0 L58,-300" stroke="' + P.a + '" stroke-width="6" stroke-linecap="round"/>';
    s += shape(P, 'M50,-298 L58,-336 L66,-298 L58,-290Z', P.c);
    s += '<path d="M48,-292 H68" stroke="' + P.c + '" stroke-width="4" stroke-linecap="round"/>';
    s += limb(P, 'M40,-166 L58,-140 L58,-118', 15) + limb(P, 'M-40,-166 L-54,-128 L-40,-106', 15);
    s += '<ellipse cx="-62" cy="-118" rx="26" ry="32" fill="' + P.b + '" stroke="' + P.a + '" stroke-width="2"/>';
    s += '<circle cx="-62" cy="-118" r="8" fill="' + P.c + '"/>';
    s += head(P, 23, -206);
    s += shape(P, 'M-26,-208 C-26,-246 26,-246 26,-208 L20,-200 L-20,-200Z', P.b);
    s += '<path d="M0,-238 L0,-196" stroke="' + P.c + '" stroke-width="3"/>';
    s += fx ? headOverlay(P, fx, -206, 26) : shape(P, 'M-2,-240 C-20,-270 10,-280 14,-252Z', P.a);
    return s;
  }

  // Celestial Eastern dragon: long wingless body, whiskers and a pearl (Qinglong).
  function serpent(P, R, el) {
    var s = shadow(100);
    var body = 'M-130,-30 C-70,0 -30,-90 20,-70 C80,-48 104,-150 44,-172 C0,-188 6,-232 58,-244';
    s += '<path d="' + body + '" fill="none" stroke="' + P.a + '" stroke-width="36" stroke-linecap="round"/>';
    s += '<path d="' + body + '" fill="none" stroke="' + P.d + '" stroke-width="31" stroke-linecap="round"/>';
    s += '<path d="' + body + '" fill="none" stroke="' + P.b + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="6 8"/>';
    [[-90, -38], [-40, -62], [10, -78], [66, -92], [62, -160], [20, -196]].forEach(function (pt) {
      s += shape(P, 'M' + pt[0] + ',' + (pt[1] - 14) + ' l8,-18 l8,18Z', P.c);
    });
    s += limb(P, 'M-20,-60 L-30,-24 L-18,-16', 9) + limb(P, 'M70,-110 L96,-90 L104,-100', 9);
    s += shape(P, 'M50,-256 C70,-274 112,-268 128,-248 C114,-234 84,-228 58,-232Z', P.d);
    s += '<path d="M66,-266 L56,-296 M56,-284 L44,-292 M84,-268 L84,-300 M84,-288 L96,-298" stroke="' + P.c + '" stroke-width="4" stroke-linecap="round"/>';
    s += '<path d="M124,-244 C150,-236 160,-210 176,-208 M120,-238 C140,-226 140,-196 156,-186" fill="none" stroke="' + P.c + '" stroke-width="2.5"/>';
    s += eye(P, 98, -252, 4.5);
    s += '<circle cx="-70" cy="-190" r="30" fill="' + P.c + '" opacity=".25"/><circle cx="-70" cy="-190" r="16" fill="' + P.c + '"/>';
    return s;
  }

  var FIGURES = { sprite: sprite, archer: archer, knight: knight, mage: mage, seraph: seraph, tyrant: tyrant, beast: beast, dragon: dragon,
    warrior: warrior, lancer: lancer, serpent: serpent };
  var STYLE_SCALE = { sprite: 1.35, archer: 1.0, knight: 0.95, mage: 0.88, seraph: 0.76, tyrant: 0.86, beast: 1.0, dragon: 0.72,
    warrior: 0.98, lancer: 0.92, serpent: 0.78 };
  var STYLE_DX = { beast: -12, dragon: 8, serpent: -14 };
  var RARITY_SCALE = { N: 0.92, HN: 0.96, R: 1, HR: 1.03, SR: 1.05, SSR: 1.1, L: 1.12 };

  var cache = {};

  // o: { id, element, style, rarity, faction }
  function render(o) {
    var key = o.id + '|' + o.element + '|' + o.style + '|' + o.rarity + '|' + (o.faction || '');
    if (cache[key]) { return cache[key]; }
    var P = PAL[o.element] || PAL.light;
    var id = slug(o.id);
    var R = rng(hash(o.id));
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">';
    s += background(P, o.element, id, R);
    var i;
    if (o.rarity === 'SSR' || o.rarity === 'L') {
      s += '<circle cx="150" cy="230" r="128" fill="' + P.c + '" opacity=".1"/>' +
        '<circle cx="150" cy="230" r="124" fill="none" stroke="' + P.c + '" stroke-width="2" stroke-dasharray="4 10" opacity=".7"/>' +
        '<circle cx="150" cy="230" r="150" fill="none" stroke="' + P.c + '" stroke-width="1.5" opacity=".35"/>';
    } else if (o.rarity === 'SR') {
      s += '<circle cx="150" cy="240" r="110" fill="' + P.c + '" opacity=".07"/>';
    }
    var fig = FIGURES[o.style] || FIGURES.sprite;
    var sc = (STYLE_SCALE[o.style] || 1) * (RARITY_SCALE[o.rarity] || 1);
    s += '<g transform="translate(' + (150 + (STYLE_DX[o.style] || 0)) + ' 356) scale(' + n(sc * 100) / 100 + ')">' + fig(P, R, o.element, o.faction) + '</g>';
    var sparks = { L: 20, SSR: 14, SR: 7, HR: 3 }[o.rarity] || 0;
    for (i = 0; i < sparks; i++) {
      s += '<path d="' + spark(15 + R() * 270, 20 + R() * 330, 3 + R() * 6) + '" fill="' + P.c + '" opacity=".85"/>';
    }
    s += '</svg>';
    cache[key] = s;
    return s;
  }

  var api = {
    // "look" picks the color scene (fire, water, wind, light, dark); it is art only.
    card: function (def) { return render({ id: def.id, element: def.look, style: def.style, rarity: def.rarity, faction: def.faction }); },
    enemy: function (u) { return render({ id: 'foe-' + slug(u.name), element: u.look, style: u.style || 'beast', rarity: u.boss ? 'SSR' : 'R', faction: u.faction }); },
    render: render
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  return api;
})();
