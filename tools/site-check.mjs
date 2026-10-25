#!/usr/bin/env node
// Drives the built site (dist/) in headless Chrome at phone and desktop width and
// checks what a visitor gets: no sideways scroll, every poster, search + filters,
// the waitlist form end to end (against a local stand-in), the API with CORS, no
// console errors. Saves screenshots for a person to look at.
//
//   node tools/build-site.mjs && node tools/site-check.mjs [shots-dir]

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SHOTS = process.argv[2] || join(ROOT, '.shots');
const PORT = 8899, WL = 8898, CDP = 9277;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

// Rebuild pointed at the local waitlist stand-in, so the form can be submitted.
execFileSync(process.execPath, [join(ROOT, 'tools/build-site.mjs')], { env: { ...process.env, WAITLIST_URL: `http://127.0.0.1:${WL}/waitlist` }, stdio: 'ignore' });

const site = createServer((req, res) => {
  let p = join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end(readFileSync(join(DIST, '404.html'))); }
  const headers = { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' };
  if (req.url.startsWith('/api/')) headers['Access-Control-Allow-Origin'] = '*';   // what _headers does on Pages
  res.writeHead(200, headers); res.end(readFileSync(p));
}).listen(PORT, '127.0.0.1');
const joined = [];
const wl = createServer((req, res) => {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { joined.push(JSON.parse(b)); res.writeHead(200, h); res.end('{"ok":true}'); });
}).listen(WL, '127.0.0.1');

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=/tmp/site-check-${Date.now()}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); site.close(); wl.close(); } catch {} });

let ws, id = 0; const pending = new Map(); const errors = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evl = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r.result.value; };

async function connect() {
  for (let i = 0; i < 50; i++) { try { const t = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); const p = t.find((x) => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(200); }
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || 'exception');
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value || a.description).join(' ')); });
  await send('Runtime.enable'); await send('Page.enable');
}
async function open(path, width) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 900, deviceScaleFactor: width < 600 ? 3 : 1, mobile: width < 600 });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${path}` });
  for (let i = 0; i < 60; i++) { await sleep(150); if (await evl(`document.readyState==='complete'`)) break; }
  await evl(`document.fonts.ready.then(()=>1)`); await sleep(200);
}
async function shot(name, full = false) {
  mkdirSync(SHOTS, { recursive: true });
  let restore = null;
  if (full) {
    // Stretch the viewport to the page, shoot, put it back. (captureBeyondViewport
    // hangs headless Chrome on long pages.)
    const m = await evl(`({ w: document.documentElement.clientWidth, h: Math.min(document.documentElement.scrollHeight, 7000), mobile: innerWidth < 600 })`);
    restore = m;
    await send('Emulation.setDeviceMetricsOverride', { width: m.w, height: m.h, deviceScaleFactor: 1, mobile: m.mobile });
    await sleep(300);
  }
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, name + '.png'), Buffer.from(s.data, 'base64'));
  if (restore) {
    await send('Emulation.setDeviceMetricsOverride', { width: restore.w, height: restore.mobile ? 844 : 900, deviceScaleFactor: restore.mobile ? 3 : 1, mobile: restore.mobile });
    await sleep(200);
  }
}
const noSideScroll = () => evl(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`);
// Any element sticking out past the right edge (the usual cause of sideways scroll).
const overflowers = () => evl(`[...document.querySelectorAll('body *')].filter(e=>{ if(e.closest('.poster')) return false; const r=e.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 1; }).slice(0,4).map(e=>e.className||e.tagName)`);

try {
  await connect();
  for (const [label, w] of [['phone', 390], ['desktop', 1280]]) {
    console.log(`\n━━━ ${label} (${w}px) ━━━`);
    await open('/', w);
    check('landing: no sideways scroll', await noSideScroll(), JSON.stringify(await overflowers()));
    check('landing: the display font loaded', await evl(`document.fonts.check('800 40px "Bricolage Grotesque"')`));
    const counts = await evl(`({ cards:document.querySelectorAll('.grid .card').length, walls:[...document.querySelectorAll('.grid .poster-wall')].filter(e=>e.textContent.length>40).length, h1:document.querySelector('h1').textContent })`);
    check('landing: a poster for every collection, each drawn from its titles', counts.cards === 30 && counts.walls === 30, JSON.stringify(counts));
    await shot(`${label}-landing`); await shot(`${label}-landing-full`, true);
    if (label === 'phone') {
      const tgt = await evl(`[...document.querySelectorAll('a.btn, button.chip, .top-cta, .join-form button, .join-form input[type=email]')].map(e=>e.getBoundingClientRect()).filter(r=>r.height && r.height < 38).length`);
      check('phone: every button is a comfortable tap target (≥ 38px)', tgt === 0, `${tgt} small`);
    }
    await evl(`(()=>{ const i=document.querySelector('[data-search-input]'); i.value='carpenter'; i.dispatchEvent(new Event('input')); return 1; })()`);
    const carp = await evl(`[...document.querySelectorAll('.grid .card')].filter(c=>!c.hidden).map(c=>c.querySelector('h3').textContent)`);
    check('search by director finds the lists with his films', carp.length >= 3 && carp.includes('80s Horror') && !carp.includes('Folk Horror'), carp.join(', '));
    await evl(`(()=>{ const i=document.querySelector('[data-search-input]'); i.value='zzqx'; i.dispatchEvent(new Event('input')); return 1; })()`);
    check('a search with no hits says so', await evl(`!document.querySelector('[data-empty]').hidden`));
    await evl(`(()=>{ const i=document.querySelector('[data-search-input]'); i.value=''; i.dispatchEvent(new Event('input')); [...document.querySelectorAll('.chip')].find(c=>c.textContent==='Every film').click(); return 1; })()`);
    const every = await evl(`[...document.querySelectorAll('.grid .card')].filter(c=>!c.hidden).length`);
    check('the "Every film" chip shows the 10 franchise lists', every === 10, String(every));

    await open('/c/franchise-halloween/', w);
    check('collection: no sideways scroll', await noSideScroll(), JSON.stringify(await overflowers()));
    const coll = await evl(`({ n:document.querySelectorAll('.members li').length, first:document.querySelector('.m-t').textContent, num:document.querySelector('.m-n').textContent, title:document.title, ld:JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@type'] })`);
    check('collection: 13 Halloween films, numbered, remakes carry their year', coll.n === 13 && coll.first === 'Halloween (1978)' && coll.num === '1', JSON.stringify(coll));
    check('collection: structured data for search engines', coll.ld === 'ItemList');
    await shot(`${label}-collection`); await shot(`${label}-collection-full`, true);

    await open('/i/movies/the-thing-1982/', w);
    const item = await evl(`({ lists:document.querySelectorAll('.grid .card').length, wd:!!document.querySelector('a[href*="wikidata.org/wiki/Q"]') })`);
    check('item: The Thing lists every collection it is on, links Wikidata', item.lists >= 4 && item.wd, JSON.stringify(item));
    check('item: no sideways scroll', await noSideScroll(), JSON.stringify(await overflowers()));
  }

  console.log('\n━━━ waitlist + API ━━━');
  await open('/c/slashers/', 390);
  await evl(`(()=>{ const f=document.querySelector('[data-waitlist]'); f.querySelector('[name=email]').value='fan@example.com'; f.requestSubmit(); return 1; })()`);
  await sleep(800);
  const msg = await evl(`document.querySelector('.join-msg').textContent`);
  check('the waitlist form submits and thanks you', /on the list/.test(msg) && joined.length === 1, msg);
  check('…and records which page you joined from', joined[0]?.source === '/c/slashers/', JSON.stringify(joined[0]));
  const api = await evl(`fetch('/api/v1/index.json').then(r=>r.json()).then(j=>({ n:j.collections.length, d:j.domains[0], one:j.collections[0].defId }))`);
  check('API index: 30 collections, 317 movies, namespaced ids', api.n === 30 && api.d.items === 317 && /^col:movies:/.test(api.one), JSON.stringify(api));
  const one = await evl(`fetch('/api/v1/collections/horror-essentials.json').then(r=>r.json()).then(j=>({ size:j.size, m:j.members.length, d:j.members[0].defId, v:j.version }))`);
  check('API collection: members carry defIds and the collection a version', one.size === one.m && /^movies:/.test(one.d) && one.v, JSON.stringify(one));
  const headers = readFileSync(join(DIST, '_headers'), 'utf8');
  check('API is CORS-open on Pages (_headers)', /\/api\/\*\s+Access-Control-Allow-Origin: \*/.test(headers));
  await open('/nope/', 1280);
  check('an unknown URL gets the 404 page', await evl(`document.querySelector('h1').textContent`) === 'Not in the collection.');
  check('no console errors on any page', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) { console.error('✗ harness:', e.message); fails++; }

// Leave dist/ built for production, not for the stand-in.
execFileSync(process.execPath, [join(ROOT, 'tools/build-site.mjs')], { stdio: 'ignore' });
console.log(fails ? `\n✗ ${fails} failed` : `\n✓ all passed — screenshots in ${SHOTS}`);
process.exit(fails ? 1 : 0);
