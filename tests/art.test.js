/*
 * Tests for the art pipeline (prompts and the generator script). No real API calls:
 * the image services are replaced with fake responses.
 * Run with:  node tests/art.test.js
 */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var D = require('../js/data.js');
var P = require('../art/prompts.js');
var gen = require('../tools/generate-art.js');

var passed = 0, queue = [];
function test(name, fn) { queue.push([name, fn]); }

console.log('Art pipeline');

test('every card and enemy has its own written subject and a full prompt', function () {
  D.CARDS.forEach(function (c) { assert(P.SUBJECTS[c.id], 'no subject for ' + c.id); });
  var jobs = P.allJobs();
  var enemies = 0;
  D.CHAPTERS.forEach(function (ch) { enemies += ch.enemies.length + 1; });
  assert.strictEqual(jobs.length, D.CARDS.length + enemies);
  jobs.forEach(function (j) {
    assert(j.prompt.indexOf(P.STYLE) === 0, j.id + ' does not start with the shared style');
    assert(/Subject: /.test(j.prompt) && /Background: /.test(j.prompt), j.id);
    assert(!/\.\./.test(j.prompt), j.id + ' has a doubled full stop');
  });
  var ids = jobs.map(function (j) { return j.id; });
  assert.strictEqual(new Set(ids).size, ids.length, 'ids must be unique');
});
test('faction rules reach the prompt: Mortal human, Immortal divine, Fallen demonic', function () {
  assert(/ordinary human/.test(P.cardPrompt(D.CARD_BY_ID['captain'])));
  assert(/divine or celestial/.test(P.cardPrompt(D.CARD_BY_ID['odin'])));
  assert(/demonic or monstrous/.test(P.cardPrompt(D.CARD_BY_ID['tiamat'])));
});
test('prompts describe a look in plain words and never name other games or studios', function () {
  P.allJobs().forEach(function (j) {
    assert(!/bahamut|cygames|granblue|shadowverse|in the style of/i.test(j.prompt), j.id + ': ' + j.prompt.slice(0, 80));
  });
});
test('the generator plans only missing pictures, and honours --only, --limit and --overwrite', function () {
  var dir = path.join(__dirname, '..', 'assets', 'cards');
  fs.mkdirSync(dir, { recursive: true });
  var tmp = path.join(dir, 'imp.webp');
  var had = fs.existsSync(tmp);
  if (!had) { fs.writeFileSync(tmp, 'x'); }
  try {
    var all = gen.planJobs(gen.parseArgs([]));
    assert(!all.some(function (j) { return j.id === 'imp'; }), 'existing art is skipped');
    assert(gen.planJobs(gen.parseArgs(['--only', 'imp'])).length === 0);
    assert(gen.planJobs(gen.parseArgs(['--only', 'imp', '--overwrite'])).length === 1);
    assert.strictEqual(gen.planJobs(gen.parseArgs(['--limit', '3'])).length, 3);
    assert(gen.planJobs(gen.parseArgs(['--enemies-only'])).every(function (j) { return j.kind === 'enemy'; }));
    assert.throws(function () { gen.planJobs(gen.parseArgs(['--only', 'not-a-card'])); }, /Unknown id/);
    assert.throws(function () { gen.parseArgs(['--provider', 'midjourney']); }, /Unknown provider/);
  } finally {
    if (!had) { fs.unlinkSync(tmp); }
  }
});

// Fake fetch: answer each service the way its API does.
var PNG = Buffer.from('89504e470d0a1a0a', 'hex');
function fakeFetch(handler) {
  global.fetch = async function (url, init) {
    var r = handler(String(url), init || {});
    return {
      ok: r.status ? r.status < 400 : true, status: r.status || 200,
      text: async function () { return typeof r.body === 'string' ? r.body : JSON.stringify(r.body); },
      arrayBuffer: async function () { return r.bin; }
    };
  };
}
test('OpenAI adapter sends the prompt and reads the base64 image', async function () {
  var seen;
  fakeFetch(function (url, init) { seen = { url: url, init: init }; return { body: { data: [{ b64_json: PNG.toString('base64') }] } }; });
  var buf = await gen.PROVIDERS.openai('a dragon', 'KEY', 'gpt-image-1');
  assert(buf.equals(PNG));
  assert(/api\.openai\.com\/v1\/images\/generations/.test(seen.url));
  assert.strictEqual(seen.init.headers.Authorization, 'Bearer KEY');
  var body = JSON.parse(seen.init.body);
  assert.strictEqual(body.prompt, 'a dragon'); assert.strictEqual(body.size, '1024x1536');
});
test('Gemini adapter reads the inline image data', async function () {
  var seen;
  fakeFetch(function (url, init) {
    seen = { url: url, init: init };
    return { body: { candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: PNG.toString('base64') } }] } }] } };
  });
  var buf = await gen.PROVIDERS.gemini('a dragon', 'KEY', 'gemini-2.5-flash-image');
  assert(buf.equals(PNG));
  assert(/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash-image:generateContent/.test(seen.url));
  assert.strictEqual(seen.init.headers['x-goog-api-key'], 'KEY');
});
test('Replicate adapter waits for the prediction and downloads the result', async function () {
  var calls = [];
  fakeFetch(function (url) {
    calls.push(url);
    if (/predictions$/.test(url)) { return { body: { status: 'starting', urls: { get: 'https://api.replicate.com/v1/predictions/abc' } } }; }
    if (/predictions\/abc$/.test(url)) { return { body: { status: 'succeeded', output: 'https://replicate.delivery/x.png' } }; }
    return { bin: PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length) };
  });
  var buf = await gen.PROVIDERS.replicate('a dragon', 'KEY', 'black-forest-labs/flux-1.1-pro');
  assert(buf.equals(PNG));
  assert(/models\/black-forest-labs\/flux-1\.1-pro\/predictions/.test(calls[0]));
  assert(calls.indexOf('https://replicate.delivery/x.png') !== -1);
});
test('an error from a service is reported with its status', async function () {
  fakeFetch(function () { return { status: 401, body: { error: { message: 'Incorrect API key' } } }; });
  await assert.rejects(gen.PROVIDERS.openai('x', 'BAD', 'gpt-image-1'), function (e) { return e.status === 401 && /Incorrect API key/.test(e.message); });
});

(async function () {
  for (var i = 0; i < queue.length; i++) {
    try { await queue[i][1](); passed++; console.log('  ok  ' + queue[i][0]); }
    catch (e) { console.error('FAIL  ' + queue[i][0] + '\n      ' + e.message); process.exitCode = 1; }
  }
  console.log('\n' + passed + ' art tests passed' + (process.exitCode ? ' (with failures)' : ''));
})();
