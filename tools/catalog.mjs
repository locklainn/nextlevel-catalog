#!/usr/bin/env node
// The catalog's one tool. Validates a domain's data, writes the human review
// page, builds the NextLevel /builds batch, and sends it.
//
//   node tools/catalog.mjs validate movies
//   node tools/catalog.mjs review   movies horror      → domains/movies/collections/horror.md
//   node tools/catalog.mjs batch    movies horror      → prints the batch JSON
//   node tools/catalog.mjs send     movies horror      → POST /builds (needs NEXTLEVEL_TOKEN)
//   node tools/catalog.mjs status   <batchId>          → the app's receipt
//
// Nothing is created in the app until the batch is approved there.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareTitles, titleKey } from './identity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = process.env.NEXTLEVEL_ENDPOINT || 'https://activity-worker.tj-locklainn.workers.dev';
const MAX_OPS = 200;
const MAX_MEMBERS = 200;

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

function loadDomain(domain) {
  const dir = join(ROOT, 'domains', domain);
  if (!existsSync(dir)) die(`no domain "${domain}" (domains/${domain})`);
  const meta = readJSON(join(dir, 'domain.json'));
  const items = readJSON(join(dir, 'items.json'));
  const groups = {};
  for (const f of readdirSync(join(dir, 'collections')).filter(f => f.endsWith('.json'))) {
    groups[f.replace(/\.json$/, '')] = readJSON(join(dir, 'collections', f));
  }
  return { dir, meta, items, groups };
}

// The title an item carries into the app. When two items in a domain are the same
// title to the app (remakes: Halloween 1978 / 2007 / 2018; "The Evil Dead" and
// "Evil Dead", since a leading "The" doesn't count), each gets " (year)" so the
// app never treats them as one thing.
function libraryTitles(items) {
  const byTitle = new Map();
  for (const it of items) {
    const k = titleKey(it.title).core;
    byTitle.set(k, (byTitle.get(k) || 0) + 1);
  }
  const out = new Map();
  for (const it of items) {
    out.set(it.id, byTitle.get(titleKey(it.title).core) > 1 && it.year ? `${it.title} (${it.year})` : it.title);
  }
  return out;
}

function noteFor(meta, it) {
  return (meta.note || '').replace(/\{(\w+)\}/g, (_, k) => it[k] ?? '').replace(/^[\s·]+|[\s·]+$/g, '');
}

function validate(domain, { quiet = false } = {}) {
  const d = loadDomain(domain);
  const errors = [], warnings = [];
  const ids = new Set();
  for (const it of d.items) {
    if (!it.id || !it.title) errors.push(`item missing id/title: ${JSON.stringify(it)}`);
    if (ids.has(it.id)) errors.push(`duplicate item id "${it.id}"`);
    ids.add(it.id);
    for (const f of d.meta.identity || []) if (it[f] == null) errors.push(`${it.id}: missing identity field "${f}"`);
  }
  const titles = libraryTitles(d.items);
  const used = new Set();
  for (const [g, file] of Object.entries(d.groups)) {
    const cids = new Set();
    for (const c of file.collections) {
      if (cids.has(c.id)) errors.push(`${g}: duplicate collection id "${c.id}"`);
      cids.add(c.id);
      const seen = new Set();
      for (const m of c.members) {
        if (!ids.has(m)) errors.push(`${g}/${c.id}: unknown item "${m}"`);
        if (seen.has(m)) errors.push(`${g}/${c.id}: "${m}" listed twice`);
        seen.add(m); used.add(m);
      }
      if (c.members.length > MAX_MEMBERS) errors.push(`${g}/${c.id}: ${c.members.length} members (max ${MAX_MEMBERS})`);
    }
  }
  for (const it of d.items) if (!used.has(it.id)) warnings.push(`item "${it.id}" is in no collection`);

  // Every pair of items, judged by the app's own matcher. "same" would collapse two
  // of ours into one Library item; "candidate" means the app would ask.
  const hazards = [];
  for (let i = 0; i < d.items.length; i++) for (let j = i + 1; j < d.items.length; j++) {
    const a = d.items[i], b = d.items[j];
    const m = compareTitles(titles.get(a.id), titles.get(b.id));
    if (m.verdict === 'same') errors.push(`the app would treat "${titles.get(a.id)}" (${a.id}) and "${titles.get(b.id)}" (${b.id}) as one item`);
    else if (m.verdict === 'candidate') hazards.push([a.id, b.id, m.reason]);
  }

  if (!quiet) {
    for (const e of errors) console.log('ERROR  ' + e);
    for (const w of warnings) console.log('warn   ' + w);
    console.log(`${domain}: ${d.items.length} items, ${Object.values(d.groups).reduce((n, g) => n + g.collections.length, 0)} collections, ${errors.length} errors, ${warnings.length} warnings`);
    console.log(`${hazards.length} pairs the app would flag as possible duplicates of each other:`);
    for (const [a, b, why] of hazards) console.log(`  ${titles.get(a)}  ~  ${titles.get(b)}  (${why})`);
  }
  return { ...d, titles, errors, warnings, hazards };
}

function review(domain, group) {
  const d = validate(domain, { quiet: true });
  if (d.errors.length) die(`fix ${d.errors.length} errors first (validate ${domain})`);
  const file = d.groups[group] || die(`no group "${group}"`);
  const byId = new Map(d.items.map(it => [it.id, it]));
  const all = new Set(file.collections.flatMap(c => c.members));
  const L = [];
  L.push(`# ${file.group} — ${file.collections.length} collections, ${all.size} unique ${d.meta.libraryType.toLowerCase()}`);
  L.push('');
  L.push(`Generated by \`node tools/catalog.mjs review ${domain} ${group}\` from \`${group}.json\`. Edit the JSON, not this file.`);
  L.push('');
  for (const c of file.collections) L.push(`- [${c.icon} ${c.title}](#${c.id}) (${c.members.length})`);
  for (const c of file.collections) {
    L.push('', `## ${c.icon} ${c.title}`, `<a id="${c.id}"></a>`, '', `*${c.description}*`, '');
    c.members.forEach((m, i) => {
      const it = byId.get(m);
      L.push(`${c.ordered ? `${i + 1}.` : '-'} **${d.titles.get(m)}** — ${noteFor(d.meta, it)}`);
    });
  }
  const out = join(d.dir, 'collections', `${group}.md`);
  writeFileSync(out, L.join('\n') + '\n');
  console.log(`wrote ${out}`);
}

// One populate_collection per collection. A member carries a ref the FIRST time
// it appears in the batch (and only if the agent hasn't already made it);
// later appearances are title-only and resolve to that same item in the app.
function buildBatch(domain, group, { knownRefs = {} } = {}) {
  const d = validate(domain, { quiet: true });
  if (d.errors.length) die(`fix ${d.errors.length} errors first (validate ${domain})`);
  const file = d.groups[group] || die(`no group "${group}"`);
  const byId = new Map(d.items.map(it => [it.id, it]));
  const reffed = new Set();
  const ops = file.collections.map(c => ({
    op: 'populate_collection',
    ref: `coll-${d.meta.refPrefix}-${c.id}`,
    title: c.title,
    collectionCategory: d.meta.libraryType,
    icon: c.icon,
    description: c.description,
    members: c.members.map(m => {
      const ref = `${d.meta.refPrefix}-${m}`;
      const member = { title: d.titles.get(m), notes: noteFor(d.meta, byId.get(m)) };
      if (!reffed.has(ref) && !knownRefs[ref]) { member.ref = ref; reffed.add(ref); }
      return member;
    }),
  })).filter(op => !knownRefs[op.ref]);
  if (ops.length > MAX_OPS) die(`${ops.length} ops (max ${MAX_OPS}) — split the group`);
  return {
    batchId: `catalog-${domain}-${group}-v1`,
    title: `${file.group}: ${ops.length} ${d.meta.libraryType.toLowerCase()} collections`,
    summary: `From nextlevel-catalog (${domain}/${group}). ${new Set(file.collections.flatMap(c => c.members)).size} unique ${d.meta.libraryType.toLowerCase()}.`,
    ops,
  };
}

async function api(path, init = {}) {
  const token = process.env.NEXTLEVEL_TOKEN || die('set NEXTLEVEL_TOKEN (the activity bearer token)');
  const res = await fetch(ENDPOINT + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) die(`${init.method || 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

function die(msg) { console.error(msg); process.exit(1); }

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'validate') { const r = validate(a); process.exit(r.errors.length ? 1 : 0); }
else if (cmd === 'review') review(a, b);
else if (cmd === 'batch') console.log(JSON.stringify(buildBatch(a, b), null, 2));
else if (cmd === 'send') {
  const state = await api('/builds/state');
  const batch = buildBatch(a, b, { knownRefs: state.refs || {} });
  if (process.argv.includes('--id')) batch.batchId = process.argv[process.argv.indexOf('--id') + 1];
  console.log(JSON.stringify(await api('/builds', { method: 'POST', body: JSON.stringify(batch) })));
  console.log(`batch ${batch.batchId}: ${batch.ops.length} ops — waiting for approval in the app`);
}
else if (cmd === 'status') console.log(JSON.stringify(await api(`/builds?batchId=${encodeURIComponent(a)}`), null, 2));
else die('usage: catalog.mjs validate|review|batch|send <domain> [group]  |  status <batchId>');
