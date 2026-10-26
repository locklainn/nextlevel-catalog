#!/usr/bin/env node
// Builds the public marketplace from the catalog data: a static website (landing,
// one page per collection, one per item) and a static JSON API the NextLevel app
// reads. Same source, two outputs, no server.
//
//   node tools/build-site.mjs          → dist/
//   npx wrangler@3 pages deploy dist --project-name nextlevel-collections
//
// API (all GET, CORS open, see dist/_headers):
//   /api/v1/index.json                 domains + every collection (no members)
//   /api/v1/collections/<id>.json      one collection with its members
//   /api/v1/items/<domain>.json        every item in a domain
// A thing's global id (defId) is "<domain>:<id>", e.g. "movies:halloween-1978"; a
// collection's is "col:<domain>:<id>", e.g. "col:movies:slashers".

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { titleKey } from './identity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
const SITE = process.env.SITE_URL || 'https://nextlevel-collections.pages.dev';
const WAITLIST = process.env.WAITLIST_URL || 'https://activity-worker.tj-locklainn.workers.dev/waitlist';
const BUILT = new Date().toISOString();

// ---- data -----------------------------------------------------------------------

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const domains = readdirSync(join(ROOT, 'domains')).filter((d) => existsSync(join(ROOT, 'domains', d, 'domain.json'))).map((d) => {
  const dir = join(ROOT, 'domains', d);
  const meta = readJSON(join(dir, 'domain.json'));
  const items = readJSON(join(dir, 'items.json'));
  // Groups in the order domain.json lists them (quick wins first), any others after.
  const rank = (k) => ((meta.groups || []).indexOf(k) + 1 || 99);
  const groups = readdirSync(join(dir, 'collections')).filter((f) => f.endsWith('.json')).map((f) => ({ key: f.slice(0, -5), ...readJSON(join(dir, 'collections', f)) }))
    .sort((a, b) => rank(a.key) - rank(b.key));
  return { ...meta, items, groups };
}).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
const domainOf = new Map(domains.map((d) => [d.domain, d]));

// Categories on the roadmap that aren't built yet: shown as "next shelves" until they are.
const PLANNED = [
  ['mountains', '⛰️', 'Mountains', 'the NH 48, the Adirondack 46, every state high point'],
  ['games', '🎮', 'Video Games', 'Game of the Year winners, FromSoftware, indie darlings'],
  ['national-parks', '🏞️', 'National Parks', "all 63, Utah's Mighty 5, Alaska's 8"],
  ['countries', '🌍', 'Countries', 'every country, continent by continent'],
  ['states', '🗺️', 'States & Provinces', 'all 50 states, the Lower 48, Canada'],
  ['venues', '🏟️', 'Ballparks & Arenas', 'every MLB ballpark, NFL, NBA and NHL'],
  ['books', '📚', 'Books', 'horror classics, Stephen King, the Hugo winners'],
  ['tv', '📺', 'TV', 'prestige drama, comedy, the Emmy winners'],
  ['trails', '🥾', 'Trails & Hikes', 'the great treks and the best day hikes'],
  ['cocktails', '🍸', 'Cocktails', 'the classics, tiki, every IBA official cocktail'],
  ['board-games', '🎲', 'Board Games', 'gateway games, co-op, Spiel des Jahres winners'],
  ['theme-parks', '🎢', 'Theme Parks', 'every Disney park, legendary roller coasters'],
].filter(([d]) => !domainOf.has(d));

// The line under an item's title ("1978 · John Carpenter"), from the domain's template.
const noteFor = (d, it) => (d.note || '').replace(/\{(\w+)\}/g, (_, k) => (typeof it[k] === 'number' && k !== 'year' ? it[k].toLocaleString('en-US') : it[k] ?? '')).replace(/^[\s·]+|[\s·]+$/g, '');
// The range a collection covers on its domain's span field: "1931–2023", "3,500–6,288 ft".
function spanOf(d, items) {
  const f = d.span?.field; if (!f) return '';
  const v = items.map((m) => m[f]).filter((x) => typeof x === 'number');
  if (!v.length) return '';
  const fmt = (x) => (f === 'year' ? String(x) : x.toLocaleString('en-US'));
  const lo = Math.min(...v), hi = Math.max(...v);
  return (lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`) + (d.span.unit ? ` ${d.span.unit}` : '');
}
const nounFor = (d, n) => (n === 1 ? d.noun || 'item' : d.nouns || 'items');

// An item's key fields (the domain's identity minus the title), and the legacy title older
// app builds read: a name shared within the domain gets its keys, "Halloween (1978)",
// "Saddleback Mountain (ME)". Same rules as catalog.mjs; see IDENTITY.md.
const keysFor = (d, it) => Object.fromEntries((d.identity || []).filter((f) => f !== 'title' && it[f] != null).map((f) => [f, it[f]]));
function displayTitles(d) {
  const n = new Map();
  for (const it of d.items) n.set(titleKey(it.title).core, (n.get(titleKey(it.title).core) || 0) + 1);
  return new Map(d.items.map((it) => {
    const keys = Object.values(keysFor(d, it));
    return [it.id, n.get(titleKey(it.title).core) > 1 && keys.length ? `${it.title} (${keys.join(', ')})` : it.title];
  }));
}

// A collection's accent: picked from a palette by a hash of its id, so it never
// changes between builds and neighbours rarely match.
const PALETTE = ['#ff3b3b', '#ff7a1a', '#ffc21a', '#c6f432', '#27e0a3', '#1ad1ff', '#3d7bff', '#8a5cff', '#d94dff', '#ff4fa3', '#ff6f61', '#9cf2ff'];
const hash = (s) => createHash('sha1').update(s).digest();
const accentOf = (id) => PALETTE[hash(id)[0] % PALETTE.length];
const versionOf = (obj) => hash(JSON.stringify(obj)).toString('hex').slice(0, 12);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, w, ws = w + 's') => `${n} ${n === 1 ? w : ws}`;

const catalog = [];   // every collection, flattened
const itemsById = new Map();   // defId → item + where it appears
for (const d of domains) {
  const titles = displayTitles(d);
  for (const it of d.items) itemsById.set(`${d.domain}:${it.id}`, { ...it, domain: d.domain, displayTitle: titles.get(it.id), collections: [] });
  for (const g of d.groups) for (const c of g.collections) {
    const members = c.members.map((m) => itemsById.get(`${d.domain}:${m}`));
    const entry = { ...c, domain: d.domain, libraryType: d.libraryType, group: g.group, groupKey: g.key, accent: accentOf(c.id), members };
    entry.version = versionOf({ t: c.title, d: c.description, i: c.icon, m: c.members });
    catalog.push(entry);
    for (const m of members) m.collections.push(entry);
  }
}
const totalItems = itemsById.size;

// ---- API --------------------------------------------------------------------------

// Every field the domain declares, so a peak carries its state and elevation as a film carries its year.
// `title` is the legacy title; `name` + `keys` are what the app matches on (IDENTITY.md).
const memberJSON = (m) => {
  const { id, title, displayTitle, domain, collections, wikidata, aka, ...fields } = m;
  return { defId: `${domain}:${id}`, id, title: displayTitle, name: title, keys: keysFor(domainOf.get(domain), m), ...(aka?.length ? { aka } : {}), ...fields, ...(wikidata ? { wikidata } : {}) };
};
const collSummary = (c) => ({
  defId: `col:${c.domain}:${c.id}`, id: c.id, domain: c.domain, libraryType: c.libraryType, group: c.group,
  title: c.title, icon: c.icon, description: c.description, ordered: !!c.ordered, size: c.members.length,
  accent: c.accent, version: c.version, url: `${SITE}/c/${c.id}/`,
});

// ---- HTML -------------------------------------------------------------------------

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&display=swap';

function page({ title, description, path, body, accent = '#c6f432', jsonld }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0b0b10">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230b0b10'/%3E%3Cpath d='M28 70V30l22 26 22-26v40' stroke='%23c6f432' stroke-width='10' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/assets/site.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body style="--accent:${accent}">
<header class="top">
  <a class="brand" href="/"><span class="mark" aria-hidden="true">N</span>NextLevel <span class="brand-sub">Collections</span></a>
  <a class="top-cta" href="#join">Get early access</a>
</header>
${body}
${waitlist()}
<footer class="foot">
  <p><strong>NextLevel</strong> turns the things you do into a record you keep: goals, streaks, and a Legacy of everything you've finished.</p>
  <p class="foot-small">Facts checked against <a href="https://www.wikidata.org/">Wikidata</a>. Built ${BUILT.slice(0, 10)}. Developers: the catalog is a free JSON API at <a href="/api/v1/index.json">/api/v1</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>; credit “NextLevel Catalog”. Source on <a href="https://github.com/locklainn/nextlevel-catalog">GitHub</a>.</p>
</footer>
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

function waitlist(source = '') {
  return `<section class="join" id="join">
  <div class="join-in">
    <h2>Start your collection.</h2>
    <p>The NextLevel app is in private beta. Leave your email and we'll send you an invite when there's room. One email, no newsletter.</p>
    <form class="join-form" action="${WAITLIST}" method="post" data-waitlist>
      <label class="sr" for="wl-email">Email</label>
      <input id="wl-email" type="email" name="email" required placeholder="you@example.com" autocomplete="email">
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <input type="hidden" name="source" value="${esc(source)}">
      <button type="submit">Join the waitlist</button>
    </form>
    <p class="join-msg" role="status" aria-live="polite"></p>
  </div>
</section>`;
}

// A poster: the collection's own titles, set as a typographic wall behind its name.
function poster(c, { big = false } = {}) {
  // Cycle the titles until the wall overfills the poster; a five-film franchise repeats as a pattern.
  const names = c.members.map((m) => esc(m.title));
  const want = big ? 2800 : 2200, parts = [];
  for (let i = 0, n = 0; n < want; i++) { const t = names[i % names.length]; parts.push(t); n += t.length + 3; }
  const wall = parts.join(' <i>/</i> ');
  const d = domainOf.get(c.domain), span = spanOf(d, c.members);
  return `<div class="poster${big ? ' poster-big' : ''}" style="--accent:${c.accent}">
    <div class="poster-wall" aria-hidden="true">${wall}</div>
    <div class="poster-icon" aria-hidden="true">${esc(c.icon)}</div>
    <div class="poster-meta"><span>${c.members.length} ${nounFor(d, c.members.length)}</span>${span ? `<span>${span}</span>` : ''}</div>
  </div>`;
}

// Search text for a card: its own words plus every member's title and text fields (a director, a state).
const searchText = (c) => [c.title, c.description, ...c.members.flatMap((m) => [m.title, ...Object.entries(m).filter(([k, v]) => typeof v === 'string' && !['id', 'domain', 'displayTitle', 'wikidata', 'title'].includes(k)).map(([, v]) => v)])].join(' ').toLowerCase();

function card(c) {
  return `<a class="card" href="/c/${c.id}/" data-group="${esc(c.group)}" data-search="${esc(searchText(c))}">
    ${poster(c)}
    <h3>${esc(c.title)}</h3>
    <p>${esc(c.description)}</p>
  </a>`;
}

const domainColls = (d) => catalog.filter((c) => c.domain === d.domain);
const domainItems = (d) => [...itemsById.values()].filter((m) => m.domain === d.domain).length;

// The hub: one tile per category, a short shelf from each, and what's coming.
function landing() {
  const featured = catalog.find((c) => c.id === domains[0].featured) || catalog[0];
  const body = `<main>
<section class="hero">
  <div class="hero-copy">
    <p class="eyebrow">The collections · ${plural(domains.length, 'category', 'categories')} · ${plural(catalog.length, 'list')} · ${totalItems.toLocaleString('en-US')} things</p>
    <h1>Collect the things<br>worth doing.</h1>
    <p class="lede">Hand-picked lists of what's worth your time: films to watch, peaks to climb, places to go. Follow a list in NextLevel, check things off as you go, and everything you finish becomes part of your Legacy.</p>
    <div class="hero-actions">
      <a class="btn" href="#categories">Browse the categories</a>
      <a class="btn btn-ghost" href="#join">Get early access</a>
    </div>
  </div>
  <a class="hero-poster" href="/c/${featured.id}/" aria-label="${esc(featured.title)}">
    ${poster(featured, { big: true })}
    <span class="hero-poster-title">${esc(featured.title)}</span>
  </a>
</section>

<section class="how">
  <div class="how-step"><span class="how-n">1</span><h2>Follow a list</h2><p>Pick a collection, like every Universal Monster or the 13 Halloween films. Nothing to set up, nothing to import.</p></div>
  <div class="how-step"><span class="how-n">2</span><h2>Do the thing</h2><p>Watch it, climb it, read it. Log it in NextLevel and it's checked off on every list it belongs to.</p></div>
  <div class="how-step"><span class="how-n">3</span><h2>Keep the record</h2><p>Finished things land in your Legacy, with the date you did them. Your Library holds what you've done, not what you've meant to.</p></div>
</section>

<section class="cats" id="categories">
  <h2>The categories</h2>
  <div class="cat-grid">
    ${domains.map((d) => `<a class="cat" href="/${d.domain}/"><span class="cat-icon" aria-hidden="true">${esc(d.icon)}</span><strong>${esc(d.label)}</strong><em>${plural(domainColls(d).length, 'list')} · ${domainItems(d).toLocaleString('en-US')} ${nounFor(d, 2)}</em></a>`).join('\n    ')}
    ${PLANNED.map(([, icon, label, what]) => `<div class="cat cat-soon"><span class="cat-icon" aria-hidden="true">${icon}</span><strong>${esc(label)}</strong><em>Coming: ${esc(what)}</em></div>`).join('\n    ')}
  </div>
</section>

${domains.map((d) => {
  const picks = (d.shelf || []).map((id) => catalog.find((c) => c.id === id)).filter(Boolean);
  const shelf = (picks.length ? picks : domainColls(d)).slice(0, 4);
  return `<section class="shelf">
  <div class="shelf-head"><h2>${esc(d.icon)} ${esc(d.label)}</h2><a href="/${d.domain}/">All ${plural(domainColls(d).length, 'list')} →</a></div>
  <div class="grid grid-small">${shelf.map(card).join('')}</div>
</section>`;
}).join('\n')}
</main>`;
  return page({
    title: 'NextLevel Collections — collect the things worth doing',
    description: `Hand-picked lists of what's worth your time: ${catalog.length} collections across ${domains.map((d) => d.label.toLowerCase()).join(', ')}. Follow one in NextLevel and keep a record of everything you finish.`,
    path: '/', body,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'NextLevel Collections', url: SITE },
  });
}

// A category's own page: every list in it, with search and the domain's filter chips.
function categoryPage(d) {
  const colls = domainColls(d), n = domainItems(d);
  const groups = [...new Set(colls.map((c) => c.group))];
  const chips = [
    ...(groups.length > 1 ? groups.map((g) => ({ label: g, ids: colls.filter((c) => c.group === g).map((c) => c.id) })) : []),
    ...(d.chips || []).map((ch) => ({ label: ch.label, ids: ch.ordered ? colls.filter((c) => c.ordered).map((c) => c.id) : ch.ids })),
  ];
  const body = `<main>
<section class="browse cat-page" id="browse">
  <p class="eyebrow"><a href="/#categories">Categories</a> · ${plural(colls.length, 'list')} · ${n.toLocaleString('en-US')} ${nounFor(d, n)}</p>
  <h1>${esc(d.icon)} ${esc(d.label)}</h1>
  ${d.blurb ? `<p class="lede">${esc(d.blurb)}</p>` : ''}
  <div class="browse-head">
    <div class="browse-tools">
      <label class="sr" for="q">Search</label>
      <input id="q" type="search" placeholder="Search ${n.toLocaleString('en-US')} ${nounFor(d, n)} or ${colls.length} lists" data-search-input>
    </div>
  </div>
  ${chips.length ? `<div class="chips" role="group" aria-label="Filter">
    <button class="chip on" data-filter="">All</button>
    ${chips.map((ch) => `<button class="chip" data-filter-ids="${ch.ids.join(' ')}">${esc(ch.label)}</button>`).join('')}
  </div>` : ''}
  <div class="grid" data-grid>
    ${colls.map(card).join('\n    ')}
  </div>
  <p class="empty" data-empty hidden>No list has that. Try another name.</p>
</section>
</main>`;
  return page({
    title: `${d.label} — ${plural(colls.length, 'list')} · NextLevel Collections`,
    description: `${d.blurb || ''} ${colls.length} collections, ${n} ${nounFor(d, n)}. Follow one in NextLevel and check them off as you go.`.trim(),
    path: `/${d.domain}/`, body,
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${d.label} — NextLevel Collections`, url: `${SITE}/${d.domain}/` },
  });
}

// Structured data for one item, in its domain's schema.org type.
const itemLD = (m) => {
  const d = domainOf.get(m.domain);
  return {
    '@type': d.schemaType || 'Thing', name: m.title,
    ...(m.year ? { dateCreated: String(m.year) } : {}),
    ...(m.director ? { director: { '@type': 'Person', name: m.director } } : {}),
    ...(m.wikidata ? { sameAs: `https://www.wikidata.org/wiki/${m.wikidata}` } : {}),
  };
};

function collectionPage(c) {
  const related = catalog.filter((x) => x !== c && x.group === c.group)
    .map((x) => ({ x, shared: x.members.filter((m) => c.members.includes(m)).length }))
    .sort((a, b) => b.shared - a.shared).slice(0, 4).map((r) => r.x);
  const d = domainOf.get(c.domain), nouns = `${c.members.length} ${nounFor(d, c.members.length)}`;
  const body = `<main class="coll">
<section class="coll-hero">
  ${poster(c, { big: true })}
  <div class="coll-copy">
    <p class="eyebrow"><a href="/${d.domain}/">${esc(d.label)}</a> · ${esc(c.group)} · ${nouns}</p>
    <h1>${esc(c.title)}</h1>
    <p class="lede">${esc(c.description)}</p>
    <div class="hero-actions">
      <a class="btn" href="#join">Follow in NextLevel</a>
      <button class="btn btn-ghost" data-share>Share</button>
    </div>
    <p class="coll-note">Following keeps this list in your app. A${/^[aeiou]/i.test(d.noun || 'item') ? 'n' : ''} ${esc(d.noun || 'item')} only joins your Library once you've ${esc(d.done || 'done')} it.</p>
  </div>
</section>
<ol class="members${c.ordered ? ' members-ordered' : ''}">
  ${c.members.map((m, i) => `<li><a href="/i/${m.domain}/${m.id}/"><span class="m-n">${c.ordered ? i + 1 : ''}</span><span class="m-t">${esc(m.displayTitle)}</span><span class="m-d">${esc(noteFor(d, m))}</span></a></li>`).join('\n  ')}
</ol>
${related.length ? `<section class="related"><h2>More like this</h2><div class="grid grid-small">${related.map(card).join('')}</div></section>` : ''}
</main>`;
  return page({
    title: `${c.title} — ${nouns} · NextLevel Collections`,
    description: `${c.description} ${c.members.slice(0, 6).map((m) => m.displayTitle).join(', ')}, and ${c.members.length - 6 > 0 ? c.members.length - 6 + ' more' : 'more'}.`,
    path: `/c/${c.id}/`, body, accent: c.accent,
    jsonld: {
      '@context': 'https://schema.org', '@type': 'ItemList', name: c.title, description: c.description,
      itemListOrder: c.ordered ? 'https://schema.org/ItemListOrderAscending' : 'https://schema.org/ItemListUnordered', numberOfItems: c.members.length,
      itemListElement: c.members.map((m, i) => ({ '@type': 'ListItem', position: i + 1, item: itemLD(m) })),
    },
  });
}

function itemPage(m) {
  const d = domainOf.get(m.domain), note = noteFor(d, m);
  const body = `<main class="item">
  <p class="eyebrow"><a href="/${d.domain}/">${esc(d.label)}</a></p>
  <h1>${esc(m.displayTitle)}</h1>
  <p class="lede">${esc(note)}${m.wikidata ? `${note ? ' · ' : ''}<a href="https://www.wikidata.org/wiki/${m.wikidata}">Wikidata</a>` : ''}</p>
  <h2 class="item-h">On ${plural(m.collections.length, 'list')}</h2>
  <div class="grid grid-small">${m.collections.map(card).join('')}</div>
</main>`;
  return page({
    title: `${m.displayTitle}${note ? ` · ${note}` : ''} — on ${plural(m.collections.length, 'list')} · NextLevel Collections`,
    description: `${m.title}${note ? `, ${note}` : ''}. It's on ${m.collections.map((c) => c.title).join(', ')}.`,
    path: `/i/${m.domain}/${m.id}/`, body, accent: m.collections[0]?.accent,
    jsonld: { '@context': 'https://schema.org', ...itemLD(m) },
  });
}

// ---- write ------------------------------------------------------------------------

const write = (rel, text) => { const p = join(OUT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
rmSync(OUT, { recursive: true, force: true });

write('api/v1/index.json', JSON.stringify({
  version: 1, generatedAt: BUILT, site: SITE,
  license: { data: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', attribution: `"NextLevel Catalog" (${SITE}), CC BY 4.0` },
  domains: domains.map((d) => ({ domain: d.domain, libraryType: d.libraryType, items: d.items.length, collections: catalog.filter((c) => c.domain === d.domain).length, identity: (d.identity || []).filter((f) => f !== 'title'), qualifier: d.note || '' })),
  collections: catalog.map(collSummary),
}, null, 1));
for (const c of catalog) write(`api/v1/collections/${c.id}.json`, JSON.stringify({ ...collSummary(c), members: c.members.map(memberJSON) }, null, 1));
for (const d of domains) write(`api/v1/items/${d.domain}.json`, JSON.stringify({ domain: d.domain, libraryType: d.libraryType, items: [...itemsById.values()].filter((m) => m.domain === d.domain).map((m) => ({ ...memberJSON(m), collections: m.collections.map((c) => c.id) })) }, null, 1));

write('index.html', landing());
for (const d of domains) write(`${d.domain}/index.html`, categoryPage(d));
for (const c of catalog) write(`c/${c.id}/index.html`, collectionPage(c));
for (const m of itemsById.values()) write(`i/${m.domain}/${m.id}/index.html`, itemPage(m));
write('404.html', page({ title: 'Not here — NextLevel Collections', description: 'That page is not in the collection.', path: '/404', body: `<main class="item"><h1>Not in the collection.</h1><p class="lede"><a href="/">Back to every list</a></p></main>` }));

write('assets/site.css', readFileSync(join(ROOT, 'site', 'site.css'), 'utf8'));
write('assets/site.js', readFileSync(join(ROOT, 'site', 'site.js'), 'utf8'));
write('_headers', `/api/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300
  Content-Type: application/json; charset=utf-8
/assets/*
  Cache-Control: public, max-age=3600
`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', ...domains.map((d) => `/${d.domain}/`), ...catalog.map((c) => `/c/${c.id}/`), ...[...itemsById.values()].map((m) => `/i/${m.domain}/${m.id}/`)].map((p) => `<url><loc>${SITE}${p}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`built dist/: ${catalog.length} collection pages, ${itemsById.size} item pages, API v1 → ${SITE}`);
