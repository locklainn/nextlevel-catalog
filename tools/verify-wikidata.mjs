#!/usr/bin/env node
// Cross-check a domain against Wikidata: for every item, find entities with that English
// (or all-language) title, label or alias, then apply the domain's checks in order, each narrowing the
// candidates: for movies the year (±1, release dates vary by country), then the director;
// for mountains the state, then the elevation. Writes a report; with --apply, also records
// each matched entity's Wikidata id (Q-number) as `wikidata` in items.json. Nothing else
// is changed.
//
//   node tools/verify-wikidata.mjs movies          → domains/movies/wikidata-report.json
//   node tools/verify-wikidata.mjs movies --apply  → …and fills missing `wikidata` ids
//
// The checks live in domain.json under `wikidata`:
//   classes  optional instance-of filter (films: Q11424 …)
//   checks   [{ field, type, prop?, tol? }], applied in order. Types:
//     year      a date property's year, within ±tol
//     names     a person property; matched on last names ("various" always passes)
//     org       a company property; matched on any distinctive word (not "Studio", "Games")
//     quantity  a number in feet against the property's value in metres, within ±tol feet
//     usState   a two-letter state code against the ISO code of any containing state
//
// Verdicts: ok · <field> (an entity by that title exists, but fails this check) ·
// notfound (no English label or alias matches; check by hand).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const domain = process.argv[2] || 'movies';
const dir = join(ROOT, 'domains', domain);
const items = JSON.parse(readFileSync(join(dir, 'items.json'), 'utf8'));
const cfg = JSON.parse(readFileSync(join(dir, 'domain.json'), 'utf8')).wikidata || {};
const checks = cfg.checks || [];
const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'nextlevel-catalog/0.1 (catalog fact-check; https://nextlevel-collections.pages.dev)';
const FT = 0.3048;

// A company's distinctive words: "Nintendo EPD" and "Nintendo Entertainment Planning &
// Development" share "nintendo"; "Team Cherry" and "Team Asobi" share nothing.
const GENERIC = new Set(['team', 'studio', 'studios', 'games', 'game', 'entertainment', 'interactive', 'inc', 'llc', 'ltd', 'the', 'digital', 'productions', 'software', 'co', 'and', 'company']);
const orgWords = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w && !GENERIC.has(w));
const lastNames = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .split(/\s*(?:&|,| and )\s*/).map((n) => n.trim().split(/\s+/).pop()).filter(Boolean);

// One OPTIONAL clause per check, binding ?c<i>.
const clause = (c, i) => ({
  year: `OPTIONAL { ?x wdt:${c.prop} ?c${i}. }`,
  names: `OPTIONAL { ?x wdt:${c.prop} ?p${i}. ?p${i} rdfs:label ?c${i}. FILTER(LANG(?c${i}) IN ("en", "mul")) }`,
  org: `OPTIONAL { ?x wdt:${c.prop} ?p${i}. ?p${i} rdfs:label ?c${i}. FILTER(LANG(?c${i}) IN ("en", "mul")) }`,
  quantity: `OPTIONAL { ?x p:${c.prop}/psn:${c.prop}/wikibase:quantityAmount ?c${i}. }`,
  usState: `OPTIONAL { ?x wdt:P131+ ?s${i}. ?s${i} wdt:P300 ?c${i}. FILTER(STRSTARTS(?c${i}, "US-")) }`,
}[c.type]);
const valueOf = (c, b) => ({
  year: () => +b.value.slice(0, 4),
  names: () => b.value,
  org: () => b.value,
  quantity: () => +b.value / FT,          // metres → feet
  usState: () => b.value.slice(3),
}[c.type])();
const passes = (c, ours, theirs) => ({
  year: () => theirs.some((y) => Math.abs(y - ours) <= (c.tol ?? 1)),
  names: () => ours === 'various' || theirs.some((d) => lastNames(ours).includes(lastNames(d)[0])),
  org: () => theirs.some((d) => orgWords(d).some((w) => orgWords(ours).includes(w))),
  quantity: () => theirs.some((v) => Math.abs(v - ours) <= (c.tol ?? 100)),
  usState: () => theirs.includes(ours),
}[c.type])();
const show = (c, v) => (c.type === 'quantity' ? Math.round(v) : v);

async function query(titles) {
  // English labels, and "mul" ones: Wikidata now often stores a single label for all
  // languages instead of an English one (Elden Ring's game entity has only "mul").
  const values = titles.map((t) => `${JSON.stringify(t)}@en ${JSON.stringify(t)}@mul`).join(' ');
  const q = `SELECT ?title ?x ${checks.map((_, i) => `?c${i}`).join(' ')} WHERE {
    VALUES ?title { ${values} }
    { ?x rdfs:label ?title } UNION { ?x skos:altLabel ?title }
    ${cfg.classes ? `?x wdt:P31 ?kind. VALUES ?kind { ${cfg.classes.map((q) => 'wd:' + q).join(' ')} }` : ''}
    ${checks.map(clause).join('\n    ')}
  }`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(SPARQL + '?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    if (res.ok) return (await res.json()).results.bindings;
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error('Wikidata query failed');
}

const byTitle = new Map();   // title → entity → [Set of values per check]
const titles = [...new Set(items.flatMap((i) => [i.title, ...(i.aka || [])]))];
const BATCH = cfg.batch || 40;
for (let i = 0; i < titles.length; i += BATCH) {
  const rows = await query(titles.slice(i, i + BATCH));
  for (const r of rows) {
    const t = r.title.value;
    if (!byTitle.has(t)) byTitle.set(t, new Map());
    const ents = byTitle.get(t);
    const e = ents.get(r.x.value) || checks.map(() => new Set());
    checks.forEach((c, k) => { if (r[`c${k}`]) e[k].add(valueOf(c, r[`c${k}`])); });
    ents.set(r.x.value, e);
  }
  process.stderr.write(`  ${Math.min(i + BATCH, titles.length)}/${titles.length}\r`);
}

const ours = (it) => checks.map((c) => it[c.field]).join(' · ');
const report = items.map((it) => {
  const seen = new Map();
  for (const t of [it.title, ...(it.aka || [])]) for (const [u, e] of byTitle.get(t) || []) seen.set(u, e);
  let cands = [...seen.entries()];
  if (!cands.length) return { id: it.id, verdict: 'notfound', ours: ours(it) };
  // A candidate with no value for a check can't fail it: Wikidata simply doesn't say. It
  // is kept only when no candidate has a value that passes, and the field is reported as
  // unchecked rather than wrong.
  const unchecked = [];
  for (const [k, c] of checks.entries()) {
    const near = cands.filter(([, e]) => passes(c, it[c.field], [...e[k]]));
    const silent = cands.filter(([, e]) => !e[k].size);
    if (near.length) { cands = near; continue; }
    if (silent.length) { cands = silent; unchecked.push(c.field); continue; }
    return { id: it.id, verdict: c.field, ours: it[c.field], wikidata: cands.map(([u, e]) => ({ u, [c.field]: [...e[k]].map((v) => show(c, v)) })) };
  }
  const [u, e] = cands[0];
  const yearCheck = checks.findIndex((c) => c.type === 'year');
  const exact = yearCheck < 0 || unchecked.includes(checks[yearCheck].field) || [...e[yearCheck]].includes(it[checks[yearCheck].field]);
  if (unchecked.length) return { id: it.id, verdict: 'unchecked', ours: ours(it), missing: unchecked, u: cands.length === 1 ? u : undefined, candidates: cands.length };
  return { id: it.id, verdict: 'ok', ...(exact ? {} : { note: `Wikidata's earliest year ${Math.min(...e[yearCheck])}` }), u };
});

writeFileSync(join(dir, 'wikidata-report.json'), JSON.stringify(report, null, 1) + '\n');
const count = (v) => report.filter((r) => r.verdict === v).length;
console.log(`\n${domain}: ${report.length} items — ok ${count('ok')} · ${checks.map((c) => `${c.field} ${count(c.field)}`).join(' · ')} · notfound ${count('notfound')} · unchecked ${count('unchecked')} (Wikidata has no value to compare)`);
for (const r of report.filter((r) => !['ok', 'unchecked'].includes(r.verdict))) console.log(`  ${r.verdict.padEnd(9)} ${r.id}  ours: ${r.ours}  ${r.wikidata ? JSON.stringify(r.wikidata) : ''}`);
const un = report.filter((r) => r.verdict === 'unchecked');
if (un.length) console.log(`\n${un.length} unchecked: found, but Wikidata has no ${[...new Set(un.flatMap((r) => r.missing))].join('/')} for them. Check against the list's own source.`), un.forEach((r) => console.log(`  ${r.id}  ours: ${r.ours}  missing: ${r.missing.join(', ')}${r.candidates > 1 ? `  (${r.candidates} candidates)` : ''}`));
const off = report.filter((r) => r.note);
if (off.length) console.log(`\n${off.length} ok but a different year is listed first:`), off.forEach((r) => console.log(`  ${r.id}  ${r.note}`));

if (process.argv.includes('--apply')) {
  // Only fill a missing id, only from an 'ok' verdict, or an 'unchecked' one whose key
  // fields did match (one candidate, only a description like elevation missing). A
  // hand-checked item keeps what it has.
  const keyFields = new Set(JSON.parse(readFileSync(join(dir, 'domain.json'), 'utf8')).identity || []);
  const trusted = (r) => r.u && (r.verdict === 'ok' || (r.verdict === 'unchecked' && !r.missing.some((f) => keyFields.has(f))));
  const qid = new Map(report.filter(trusted).map((r) => [r.id, r.u.split('/').pop()]));
  let added = 0;
  for (const it of items) if (!it.wikidata && qid.has(it.id)) { it.wikidata = qid.get(it.id); added++; }
  writeFileSync(join(dir, 'items.json'), '[\n' + items.map((it) => JSON.stringify(it)).join(',\n') + '\n]\n');
  console.log(`\n--apply: recorded ${added} Wikidata id${added === 1 ? '' : 's'} in items.json`);
}
