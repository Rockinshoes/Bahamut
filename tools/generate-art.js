#!/usr/bin/env node
/*
 * tools/generate-art.js - asks an image AI to paint card and enemy art, and saves it
 * where the game picks it up (assets/cards/<id>.webp).
 *
 * Normally this runs from the "Generate card art" GitHub Action (see README). You can
 * also run it yourself with Node 18+:
 *
 *   node tools/generate-art.js --dry-run                  show the prompts, make nothing
 *   OPENAI_API_KEY=... node tools/generate-art.js --provider openai
 *   GEMINI_API_KEY=... node tools/generate-art.js --provider gemini --only tiamat,odin
 *   REPLICATE_API_TOKEN=... node tools/generate-art.js --provider replicate --limit 5
 *
 * Options:
 *   --provider openai|gemini|replicate   which image service to use (default openai)
 *   --only id1,id2                       only these cards/enemies (enemy ids look like foe-fafnir)
 *   --overwrite                          also redo pictures that already exist
 *   --limit N                            make at most N pictures this run
 *   --cards-only / --enemies-only        restrict to one kind
 *   --dry-run                            print what would be made, call nothing
 *
 * The model each service uses can be changed with the IMAGE_MODEL environment variable.
 * Prompts live in art/prompts.js.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var prompts = require('../art/prompts.js');

var ROOT = path.join(__dirname, '..');
var OUT_DIR = path.join(ROOT, 'assets', 'cards');
var RAW_DIR = path.join(ROOT, 'art', 'raw');

var DEFAULT_MODELS = {
  openai: 'gpt-image-1',
  gemini: 'gemini-2.5-flash-image',
  replicate: 'black-forest-labs/flux-1.1-pro'
};
var KEY_NAMES = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', replicate: 'REPLICATE_API_TOKEN' };

// ---------- command line ----------
function parseArgs(argv) {
  var o = { provider: 'openai', only: [], overwrite: false, limit: 0, dryRun: false, kind: null };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--provider') { o.provider = String(argv[++i] || '').trim() || 'openai'; }
    else if (a === '--only') { o.only = String(argv[++i] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
    else if (a === '--overwrite') { o.overwrite = true; }
    else if (a === '--limit') { o.limit = parseInt(argv[++i], 10) || 0; }
    else if (a === '--dry-run') { o.dryRun = true; }
    else if (a === '--cards-only') { o.kind = 'card'; }
    else if (a === '--enemies-only') { o.kind = 'enemy'; }
    else { throw new Error('Unknown option: ' + a); }
  }
  if (!DEFAULT_MODELS[o.provider]) { throw new Error('Unknown provider "' + o.provider + '". Use openai, gemini or replicate.'); }
  return o;
}

function existingArt(id) {
  return ['.webp', '.png'].some(function (ext) { return fs.existsSync(path.join(OUT_DIR, id + ext)); });
}

// Which pictures to make this run.
function planJobs(o) {
  var jobs = prompts.allJobs();
  if (o.kind) { jobs = jobs.filter(function (j) { return j.kind === o.kind; }); }
  if (o.only.length) {
    var unknown = o.only.filter(function (id) { return !jobs.some(function (j) { return j.id === id; }); });
    if (unknown.length) { throw new Error('Unknown id(s): ' + unknown.join(', ')); }
    jobs = jobs.filter(function (j) { return o.only.indexOf(j.id) !== -1; });
  }
  if (!o.overwrite) { jobs = jobs.filter(function (j) { return !existingArt(j.id); }); }
  if (o.limit > 0) { jobs = jobs.slice(0, o.limit); }
  return jobs;
}

// ---------- image services ----------
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function request(url, init) {
  var res = await fetch(url, init);
  var text = await res.text();
  var body;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  if (!res.ok) {
    var msg = (body && body.error && (body.error.message || body.error)) || (body && body.detail) || text;
    var err = new Error(res.status + ' ' + String(msg).slice(0, 300));
    err.status = res.status;
    throw err;
  }
  return body;
}

async function download(url) {
  var res = await fetch(url);
  if (!res.ok) { throw new Error('Download failed: ' + res.status); }
  return Buffer.from(await res.arrayBuffer());
}

var PROVIDERS = {
  // OpenAI Images API. Portrait 1024x1536; returns base64.
  openai: async function (prompt, key, model) {
    var body = await request('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model, prompt: prompt, size: '1024x1536', n: 1 })
    });
    var d = body.data && body.data[0];
    if (d && d.b64_json) { return Buffer.from(d.b64_json, 'base64'); }
    if (d && d.url) { return download(d.url); }
    throw new Error('OpenAI returned no image.');
  },

  // Google Gemini image models ("Nano Banana"). Returns base64 inline data.
  gemini: async function (prompt, key, model) {
    var body = await request('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4' } }
      })
    });
    var parts = (body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts) || [];
    for (var i = 0; i < parts.length; i++) {
      var inline = parts[i].inlineData || parts[i].inline_data;
      if (inline && inline.data) { return Buffer.from(inline.data, 'base64'); }
    }
    throw new Error('Gemini returned no image.');
  },

  // Replicate (FLUX and other open models). Waits for the prediction, then downloads it.
  replicate: async function (prompt, key, model) {
    var headers = { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'wait' };
    var pred = await request('https://api.replicate.com/v1/models/' + model + '/predictions', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ input: { prompt: prompt, aspect_ratio: '3:4', output_format: 'png' } })
    });
    var tries = 0;
    while (pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled' && tries < 90) {
      await sleep(2000);
      pred = await request(pred.urls.get, { headers: headers });
      tries++;
    }
    if (pred.status !== 'succeeded') { throw new Error('Replicate prediction ' + pred.status + (pred.error ? ': ' + pred.error : '')); }
    var out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!out) { throw new Error('Replicate returned no image.'); }
    return download(out);
  }
};

async function withRetries(fn, label) {
  for (var attempt = 1; ; attempt++) {
    try { return await fn(); }
    catch (e) {
      var retryable = !e.status || e.status === 429 || e.status >= 500;
      if (!retryable || attempt >= 3) { throw e; }
      var wait = attempt * 15000;
      console.log('  ' + label + ': ' + e.message + ' - retrying in ' + (wait / 1000) + 's');
      await sleep(wait);
    }
  }
}

// ---------- saving ----------
function hasCommand(cmd) {
  try { childProcess.execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch (e) { return false; }
}

// Save the original, then a small .webp (600px wide) for the game. Without cwebp
// installed, the PNG itself is used.
function save(id, buffer) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  var raw = path.join(RAW_DIR, id + '.png');
  fs.writeFileSync(raw, buffer);
  ['.webp', '.png'].forEach(function (ext) {
    var old = path.join(OUT_DIR, id + ext);
    if (fs.existsSync(old)) { fs.unlinkSync(old); }
  });
  if (hasCommand('cwebp')) {
    var out = path.join(OUT_DIR, id + '.webp');
    childProcess.execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', '600', '0', raw, '-o', out]);
    return out;
  }
  var png = path.join(OUT_DIR, id + '.png');
  fs.copyFileSync(raw, png);
  return png;
}

// ---------- main ----------
async function main() {
  var o = parseArgs(process.argv.slice(2));
  var jobs = planJobs(o);
  var model = process.env.IMAGE_MODEL || DEFAULT_MODELS[o.provider];
  console.log('Provider: ' + o.provider + ' (model ' + model + '). Pictures to make: ' + jobs.length + '.');
  if (!jobs.length) { console.log('Nothing to do: every picture already exists. Use --overwrite or --only to redo some.'); return 0; }

  if (o.dryRun) {
    jobs.forEach(function (j) { console.log('\n[' + j.id + '] ' + j.name + '\n' + j.prompt); });
    return 0;
  }

  var key = process.env[KEY_NAMES[o.provider]];
  if (!key) {
    throw new Error('No API key. Set ' + KEY_NAMES[o.provider] + ' (in GitHub: Settings > Secrets and variables > Actions).');
  }

  var made = 0, failed = [];
  for (var i = 0; i < jobs.length; i++) {
    var j = jobs[i];
    var label = '[' + (i + 1) + '/' + jobs.length + '] ' + j.id;
    try {
      var buf = await withRetries(function () { return PROVIDERS[o.provider](j.prompt, key, model); }, label);
      var file = save(j.id, buf);
      made++;
      console.log(label + ' -> ' + path.relative(ROOT, file));
    } catch (e) {
      failed.push(j.id);
      console.log(label + ' FAILED: ' + e.message);
      if (e.status === 401 || e.status === 403) { console.log('The API key was refused, so stopping here.'); break; }
    }
  }
  console.log('\nMade ' + made + ' picture(s).' + (failed.length ? ' Failed: ' + failed.join(', ') : ''));
  return failed.length ? 1 : 0;
}

if (require.main === module) {
  main().then(function (code) { process.exitCode = code; }, function (e) { console.error('Error: ' + e.message); process.exitCode = 1; });
}

module.exports = { parseArgs: parseArgs, planJobs: planJobs, PROVIDERS: PROVIDERS, DEFAULT_MODELS: DEFAULT_MODELS };
