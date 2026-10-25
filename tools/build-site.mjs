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
  const groups = readdirSync(join(dir, 'collections')).filter((f) => f.endsWith('.json')).map((f) => ({ key: f.slice(0, -5), ...readJSON(join(dir, 'collections', f)) }));
  return { ...meta, items, groups };
});

// The title a thing carries (remakes get their year), same rule as catalog.mjs.
function displayTitles(items) {
  const n = new Map();
  for (const it of items) n.set(titleKey(it.title).core, (n.get(titleKey(it.title).core) || 0) + 1);
  return new Map(items.map((it) => [it.id, n.get(titleKey(it.title).core) > 1 && it.year ? `${it.title} (${it.year})` : it.title]));
}

// A collection's accent: picked from a palette by a hash of its id, so it never
// changes between builds and neighbours rarely match.
const PALETTE = ['#ff3b3b', '#ff7a1a', '#ffc21a', '#c6f432', '#27e0a3', '#1ad1ff', '#3d7bff', '#8a5cff', '#d94dff', '#ff4fa3', '#ff6f61', '#9cf2ff'];
const hash = (s) => createHash('sha1').update(s).digest();
const accentOf = (id) => PALETTE[hash(id)[0] % PALETTE.length];
const versionOf = (obj) => hash(JSON.stringify(obj)).toString('hex').slice(0, 12);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const catalog = [];   // every collection, flattened
const itemsById = new Map();   // defId → item + where it appears
for (const d of domains) {
  const titles = displayTitles(d.items);
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

const memberJSON = (m) => ({ defId: `${m.domain}:${m.id}`, id: m.id, title: m.displayTitle, year: m.year, director: m.director, ...(m.wikidata ? { wikidata: m.wikidata } : {}) });
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
  <p class="foot-small">Film facts checked against <a href="https://www.wikidata.org/">Wikidata</a>. Built ${BUILT.slice(0, 10)}. Developers: the catalog is a free JSON API at <a href="/api/v1/index.json">/api/v1</a>.</p>
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
  const names = c.members.map((m) => esc(m.displayTitle));
  const want = big ? 2800 : 2200, parts = [];
  for (let i = 0, n = 0; n < want; i++) { const t = names[i % names.length]; parts.push(t); n += t.length + 3; }
  const wall = parts.join(' <i>/</i> ');
  const years = c.members.map((m) => m.year).filter(Boolean);
  const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '';
  return `<div class="poster${big ? ' poster-big' : ''}" style="--accent:${c.accent}">
    <div class="poster-wall" aria-hidden="true">${wall}</div>
    <div class="poster-icon" aria-hidden="true">${esc(c.icon)}</div>
    <div class="poster-meta"><span>${plural(c.members.length, c.libraryType === 'Movies' ? 'film' : 'item')}</span>${span ? `<span>${span}</span>` : ''}</div>
  </div>`;
}

function card(c) {
  return `<a class="card" href="/c/${c.id}/" data-group="${esc(c.group)}" data-search="${esc((c.title + ' ' + c.description + ' ' + c.members.map((m) => m.title + ' ' + (m.director || '')).join(' ')).toLowerCase())}">
    ${poster(c)}
    <h3>${esc(c.title)}</h3>
    <p>${esc(c.description)}</p>
  </a>`;
}

function landing() {
  const featured = catalog.find((c) => c.id === 'horror-essentials') || catalog[0];
  const kinds = [...new Set(catalog.map((c) => c.group))];
  const body = `<main>
<section class="hero">
  <div class="hero-copy">
    <p class="eyebrow">The collections · ${plural(catalog.length, 'list')} · ${totalItems} ${domains.length === 1 ? domains[0].libraryType.toLowerCase() : 'things'}</p>
    <h1>Collect the things<br>worth doing.</h1>
    <p class="lede">Hand-picked lists of what's worth your time, starting with ${totalItems} horror films. Follow a list in NextLevel, check things off as you go, and everything you finish becomes part of your Legacy.</p>
    <div class="hero-actions">
      <a class="btn" href="#browse">Browse the collections</a>
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

<section class="browse" id="browse">
  <div class="browse-head">
    <h2>Horror, collected</h2>
    <div class="browse-tools">
      <label class="sr" for="q">Search</label>
      <input id="q" type="search" placeholder="Search ${totalItems} films or ${catalog.length} lists" data-search-input>
    </div>
  </div>
  <div class="chips" role="group" aria-label="Filter">
    <button class="chip on" data-filter="">All</button>
    ${[['Eras', ['horror-before-1970', 'horror-70s', 'horror-80s', 'horror-90s', 'horror-2000s', 'horror-modern']], ['Every film', catalog.filter((c) => c.ordered).map((c) => c.id)]].map(([label, ids]) => `<button class="chip" data-filter-ids="${ids.join(' ')}">${label}</button>`).join('')}
  </div>
  <div class="grid" data-grid>
    ${catalog.map(card).join('\n    ')}
  </div>
  <p class="empty" data-empty hidden>No list has that. Try a title, a director, or a kind of horror.</p>
</section>

<section class="soon">
  <h2>Next shelves</h2>
  <ul>
    <li><span>⛰️</span>Mountains<em>the 48 New Hampshire 4,000-footers, the Colorado 14ers</em></li>
    <li><span>🥾</span>Trails<em>the long ones, and the best day hikes</em></li>
    <li><span>📚</span>Books<em>the canon, one genre at a time</em></li>
    <li><span>🍺</span>Beers<em>the styles worth knowing</em></li>
  </ul>
</section>
</main>`;
  return page({
    title: 'NextLevel Collections — collect the things worth doing',
    description: `Hand-picked lists of what's worth your time, starting with ${totalItems} horror films in ${catalog.length} collections. Follow one in NextLevel and keep a record of everything you finish.`,
    path: '/', body,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'NextLevel Collections', url: SITE },
  });
}

function collectionPage(c) {
  const related = catalog.filter((x) => x !== c && x.group === c.group)
    .map((x) => ({ x, shared: x.members.filter((m) => c.members.includes(m)).length }))
    .sort((a, b) => b.shared - a.shared).slice(0, 4).map((r) => r.x);
  const body = `<main class="coll">
<section class="coll-hero">
  ${poster(c, { big: true })}
  <div class="coll-copy">
    <p class="eyebrow"><a href="/#browse">${esc(c.group)}</a> · ${plural(c.members.length, 'film')}</p>
    <h1>${esc(c.title)}</h1>
    <p class="lede">${esc(c.description)}</p>
    <div class="hero-actions">
      <a class="btn" href="#join">Follow in NextLevel</a>
      <button class="btn btn-ghost" data-share>Share</button>
    </div>
    <p class="coll-note">Following keeps this list in your app. A film only joins your Library once you've watched it.</p>
  </div>
</section>
<ol class="members${c.ordered ? ' members-ordered' : ''}">
  ${c.members.map((m, i) => `<li><a href="/i/${m.domain}/${m.id}/"><span class="m-n">${c.ordered ? i + 1 : ''}</span><span class="m-t">${esc(m.displayTitle)}</span><span class="m-d">${m.year} · ${esc(m.director)}</span></a></li>`).join('\n  ')}
</ol>
${related.length ? `<section class="related"><h2>More like this</h2><div class="grid grid-small">${related.map(card).join('')}</div></section>` : ''}
</main>`;
  return page({
    title: `${c.title} — ${c.members.length} films · NextLevel Collections`,
    description: `${c.description} ${c.members.slice(0, 6).map((m) => m.displayTitle).join(', ')}, and ${c.members.length - 6 > 0 ? c.members.length - 6 + ' more' : 'more'}.`,
    path: `/c/${c.id}/`, body, accent: c.accent,
    jsonld: {
      '@context': 'https://schema.org', '@type': 'ItemList', name: c.title, description: c.description,
      itemListOrder: c.ordered ? 'https://schema.org/ItemListOrderAscending' : 'https://schema.org/ItemListUnordered', numberOfItems: c.members.length,
      itemListElement: c.members.map((m, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Movie', name: m.title, dateCreated: String(m.year), director: { '@type': 'Person', name: m.director }, ...(m.wikidata ? { sameAs: `https://www.wikidata.org/wiki/${m.wikidata}` } : {}) } })),
    },
  });
}

function itemPage(m) {
  const body = `<main class="item">
  <p class="eyebrow"><a href="/#browse">Horror</a> · ${m.year}</p>
  <h1>${esc(m.displayTitle)}</h1>
  <p class="lede">${m.year} · directed by ${esc(m.director)}${m.wikidata ? ` · <a href="https://www.wikidata.org/wiki/${m.wikidata}">Wikidata</a>` : ''}</p>
  <h2 class="item-h">On ${plural(m.collections.length, 'list')}</h2>
  <div class="grid grid-small">${m.collections.map(card).join('')}</div>
</main>`;
  return page({
    title: `${m.displayTitle} (${m.year}) — on ${plural(m.collections.length, 'list')} · NextLevel Collections`,
    description: `${m.title}, ${m.year}, directed by ${m.director}. It's on ${m.collections.map((c) => c.title).join(', ')}.`,
    path: `/i/${m.domain}/${m.id}/`, body, accent: m.collections[0]?.accent,
    jsonld: { '@context': 'https://schema.org', '@type': 'Movie', name: m.title, dateCreated: String(m.year), director: { '@type': 'Person', name: m.director }, ...(m.wikidata ? { sameAs: `https://www.wikidata.org/wiki/${m.wikidata}` } : {}) },
  });
}

// ---- write ------------------------------------------------------------------------

const write = (rel, text) => { const p = join(OUT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
rmSync(OUT, { recursive: true, force: true });

write('api/v1/index.json', JSON.stringify({
  version: 1, generatedAt: BUILT, site: SITE,
  domains: domains.map((d) => ({ domain: d.domain, libraryType: d.libraryType, items: d.items.length, collections: catalog.filter((c) => c.domain === d.domain).length })),
  collections: catalog.map(collSummary),
}, null, 1));
for (const c of catalog) write(`api/v1/collections/${c.id}.json`, JSON.stringify({ ...collSummary(c), members: c.members.map(memberJSON) }, null, 1));
for (const d of domains) write(`api/v1/items/${d.domain}.json`, JSON.stringify({ domain: d.domain, libraryType: d.libraryType, items: [...itemsById.values()].filter((m) => m.domain === d.domain).map((m) => ({ ...memberJSON(m), collections: m.collections.map((c) => c.id) })) }, null, 1));

write('index.html', landing());
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
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', ...catalog.map((c) => `/c/${c.id}/`), ...[...itemsById.values()].map((m) => `/i/${m.domain}/${m.id}/`)].map((p) => `<url><loc>${SITE}${p}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`built dist/: ${catalog.length} collection pages, ${itemsById.size} item pages, API v1 → ${SITE}`);
