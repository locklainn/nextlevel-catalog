#!/usr/bin/env node
// Cross-check a movie domain against Wikidata: for every item, find films with that
// English title and compare the year (±1, release dates vary by country) and the
// director(s). Read-only; writes a report, changes nothing.
//
//   node tools/verify-wikidata.mjs movies        → domains/movies/wikidata-report.json
//
// Verdicts: ok · year (a film by that title exists, not in that year) · director ·
// notfound (no English label matches — often a different US title; check by hand).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const domain = process.argv[2] || 'movies';
const items = JSON.parse(readFileSync(join(ROOT, 'domains', domain, 'items.json'), 'utf8'));
const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'nextlevel-catalog/0.1 (catalog fact-check; https://nextlevel-collections.pages.dev)';

const lastNames = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .split(/\s*(?:&|,| and )\s*/).map((n) => n.trim().split(/\s+/).pop()).filter(Boolean);

async function query(titles) {
  const values = titles.map((t) => JSON.stringify(t) + '@en').join(' ');
  const q = `SELECT ?title ?film ?date ?dirLabel WHERE {
    VALUES ?title { ${values} }
    { ?film rdfs:label ?title } UNION { ?film skos:altLabel ?title }
    ?film wdt:P31 ?kind.
    VALUES ?kind { wd:Q11424 wd:Q24869 wd:Q506240 wd:Q20650540 wd:Q17123180 }
    OPTIONAL { ?film wdt:P577 ?date. }
    OPTIONAL { ?film wdt:P57 ?dir. ?dir rdfs:label ?dirLabel. FILTER(LANG(?dirLabel) = "en") }
  }`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(SPARQL + '?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    if (res.ok) return (await res.json()).results.bindings;
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error('Wikidata query failed');
}

const byTitle = new Map();   // title → film → { years:Set, dirs:Set }
const titles = [...new Set(items.map((i) => i.title))];
for (let i = 0; i < titles.length; i += 40) {
  const rows = await query(titles.slice(i, i + 40));
  for (const r of rows) {
    const t = r.title.value;
    if (!byTitle.has(t)) byTitle.set(t, new Map());
    const films = byTitle.get(t);
    const f = films.get(r.film.value) || { years: new Set(), dirs: new Set() };
    if (r.date) f.years.add(+r.date.value.slice(0, 4));
    if (r.dirLabel) f.dirs.add(r.dirLabel.value);
    films.set(r.film.value, f);
  }
  process.stderr.write(`  ${Math.min(i + 40, titles.length)}/${titles.length}\r`);
}

const report = items.map((it) => {
  const films = [...(byTitle.get(it.title) || new Map()).entries()];
  if (!films.length) return { id: it.id, verdict: 'notfound', ours: `${it.year} · ${it.director}` };
  const near = films.filter(([, f]) => [...f.years].some((y) => Math.abs(y - it.year) <= 1));
  if (!near.length) {
    return { id: it.id, verdict: 'year', ours: it.year, wikidata: films.map(([u, f]) => ({ u, years: [...f.years].sort() })) };
  }
  const want = lastNames(it.director);
  const match = near.find(([, f]) => [...f.dirs].some((d) => want.includes(lastNames(d)[0])) || it.director === 'various');
  if (match) {
    const exactYear = [...match[1].years].includes(it.year);
    return { id: it.id, verdict: 'ok', ...(exactYear ? {} : { note: `Wikidata's earliest year ${Math.min(...match[1].years)}` }), u: match[0] };
  }
  return { id: it.id, verdict: 'director', ours: it.director, wikidata: near.map(([u, f]) => ({ u, dirs: [...f.dirs], years: [...f.years].sort() })) };
});

writeFileSync(join(ROOT, 'domains', domain, 'wikidata-report.json'), JSON.stringify(report, null, 1) + '\n');
const count = (v) => report.filter((r) => r.verdict === v).length;
console.log(`\n${domain}: ${report.length} items — ok ${count('ok')} · year ${count('year')} · director ${count('director')} · notfound ${count('notfound')}`);
for (const r of report.filter((r) => r.verdict !== 'ok')) console.log(`  ${r.verdict.padEnd(8)} ${r.id}  ours: ${r.ours}  ${r.wikidata ? JSON.stringify(r.wikidata) : ''}`);
const off = report.filter((r) => r.note);
if (off.length) console.log(`\n${off.length} ok but a different year is listed first:`), off.forEach((r) => console.log(`  ${r.id}  ${r.note}`));
