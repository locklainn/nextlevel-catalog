# NextLevel Catalog: working here as an agent

Read `README.md` first for the layout, the API and the commands. This file is the
rules: how to add to the catalog without breaking the app that reads it. How the app
tells items apart (`name` + `keys` + `aka`, and what the API must send) is `IDENTITY.md`.
What to build next, in order, is `ROADMAP.md`.

**What this repo is now.** The public catalog at https://nextlevel-collections.pages.dev.
The NextLevel app downloads `/api/v1/` and lets the user **follow** a collection as a
checklist. Following copies nothing: a film becomes a Library item only when the user
already has it or does it. So the job here is: curate the data, rebuild the site, publish.

## Never

- **Never change an item `id` once it is published.** The app stores `movies:<id>` on
  the user's items and the collection checklists. A renamed id is a different film to
  the app, and the user's progress on it is orphaned. Fix a title, year or director in
  place; keep the id, even if it now reads slightly wrong.
- **Never change a collection `id`.** Same reason: followed collections are keyed by it.
- **Never run `catalog.mjs send`.** It proposes a batch that COPIES films into the
  user's Library: the old model, replaced by Follow. TJ has asked for the horror batch to
  be held. Ask before using it for anything.
- **Never deploy, push, or touch the waitlist** without TJ saying so. Deploying is
  publishing; the Pages deploy is a production action and is his to run.
- Don't edit `collections/*.md` (generated) or `dist/` (generated).

## Adding films

`domains/<domain>/items.json` is one item per line, ordered by year. Fields are in
`domain.json`. For movies:

```json
{"id":"the-thing-1982","title":"The Thing","year":1982,"director":"John Carpenter","wikidata":"Q217195"}
```

- `id`: slug of the title + year, lowercase, keeping a leading "the" (`the-thing-1982`).
  One older id breaks that pattern (`cabinet-of-dr-caligari-1920`); leave it, ids never change.
- `title`: the English title it is best known by today. When a film has several (Twitch
  of the Death Nerve / A Bay of Blood, Tenebrae / Unsane), use **Wikidata's English
  label**, so the fact-check matches, and note the other title in `FACT-CHECK.md`.
  Precedent: `a-bay-of-blood-1971`, "Hausu". `year`: first wide or festival release.
- **Define a film once.** If it is already in `items.json`, reference that id; don't add
  a second entry because a new collection wants it.
- Remakes and same-title films are separate items with their years. `validate` tells you
  when two titles would collide in the app (it runs the app's own matcher).

## Adding a collection

`domains/<domain>/collections/<group>.json` holds `{ group, collections: [...] }`:

```json
{ "id": "folk-horror", "title": "Folk Horror", "icon": "🌾",
  "description": "One sentence on what binds them, written for someone deciding to follow it.",
  "ordered": false, "members": ["the-wicker-man-1973", "..."] }
```

- `ordered: true` = a franchise in viewing order (numbered rows on the site and in the
  app). Otherwise order members by year.
- **Overlap is fine and intended, but deliberate.** A new film can also belong in an era
  list (`horror-70s`…), World Horror or Horror Essentials. Add it there only if it would
  have earned a place on its own; don't stretch an existing list just because a new one
  pulled the film in. Each addition re-versions that list for its followers.
- **Curate.** A collection is a reason to watch these films together; not every film
  that could fit. The existing ones run 5–52 (franchises small, eras and the canon large). A collection that is a subset of another
  with no point of view of its own shouldn't exist.
- **Every item must be in at least one collection.** None is orphaned today; keep it so.
- **Metadata check, before adding items.** Ask: could two items in this domain share a
  title, now or with the next list (a remake, a second Mount Washington, an album named
  after its band)? If the domain's `identity` fields in `domain.json` wouldn't separate
  them, propose a new key field to TJ before adding the items. `validate` fails when two
  items match on every identity field. Adding a key field is safe; renaming or removing
  one is not. The title stays the bare name; key fields carry the rest (the app-side
  design lives in goalsetters).
- Changing a collection's title, description, icon or members changes its `version`,
  and the app re-syncs followers on that. Expected. Just don't churn it for nothing.

## The loop, every change

```sh
node tools/catalog.mjs validate movies              # must say 0 errors (exit 0)
node tools/verify-wikidata.mjs movies --apply       # year ±1 + director vs Wikidata; records Q-ids
node tools/catalog.mjs review movies horror         # regenerates horror.md; read it
node tools/build-site.mjs && node tools/site-check.mjs   # must end with 0 failed
```

`validate` also lists "pairs the app would flag as possible duplicates" (2 today: La
Llorona ~ The Curse of La Llorona, same year; Hausu's alternate title "House" ~ His House). Those are fine: the app asks the user Same/Separate. Only add
to that list knowingly. Anything `verify-wikidata` can't match, check by hand and record in
`domains/<domain>/FACT-CHECK.md`, as the 13 already there are. Then commit. Commit
messages say what changed for a reader of the catalog ("Add Giallo: 14 films"), not the mechanics.

Domains and group files are discovered automatically by the site build. **Known snag:** the home page's "Eras" filter chip lists collection ids by hand
(`tools/build-site.mjs`, search `Eras`). A new era collection, or a new group, needs that
list updated or it gets no chip. "Every film" picks up `ordered` collections on its own.

**Then run the app's gate** (in the app repo, `~/goalsetters`). It serves this repo's `dist/`
to the real app; from a checkout anywhere other than `~/nextlevel-catalog`, pass the path:
```sh
cd ~/goalsetters && NL_CATALOG_DIST=<this repo>/dist PATH=~/.nvm/versions/node/v22.22.2/bin:$PATH node scripts/marketplace-verify.mjs
```
Node 22 is needed (the path above is TJ's nvm install).
(It needs the app's dev server on :4200; if it isn't up, say so rather than starting a
second one.) The gate pins real data: Folk Horror is 11 films with The Wicker Man, Lamb and
Blood on Satan's Claw in it; Zombie Movies exists as `zombies`; both Halloweens (1978,
2018), both Evil Deads (1981, 2013), Evil Dead II and Evil Dead Rise exist. **Adding collections and films is safe:** both checks count collections from the
data, so a new one passes. **Growing Folk Horror, or renaming those films, fails the gate**,
correctly: then update its numbers in the same change and tell TJ.

## Publishing (TJ runs it, or says you may)

```sh
cd ~/nextlevel-catalog && npx wrangler@3 pages deploy dist --project-name nextlevel-collections --branch main --commit-dirty=true
```

Within 12 hours the app picks it up. It keeps a copy of the catalog on the device and
refreshes it at most every 12 h (sooner after a Follow). Check live:
`curl -s https://nextlevel-collections.pages.dev/api/v1/index.json | head`.

## A new domain (mountains, books, beers…)

Make `domains/<domain>/domain.json` with its `libraryType`, which must match a NextLevel
Library type title exactly ("Mountains"; games is "Video Games"), plus a `refPrefix` and an
`identity`: the key fields that tell two same-titled items apart (movies: title + year;
mountains: title + state; books: title + author). Name the ambiguous case they solve
when you propose them to TJ. Then
`items.json` and a collections file. The app side matches by `libraryType`. Ask TJ before
starting one: the site's design and the app's suggestions have only been checked on movies.

## What the app does with this (so you know what matters)

- Each item's `collections` list (computed into `/api/v1/items/<domain>.json`) is how
  the app says "Hereditary is part of something bigger" after a task, and how the task
  editor offers "Evil Dead (2013)" when the user types "Watch Evil Dead". Titles and
  years are what it matches on, so accuracy there is user-visible.
- Outside agents are told (in the app's `/builds/guide`) to check this catalog before
  building a collection, and to suggest collections a film belongs to.
- App side: `goalsetters/src/app/nlcommon/services/marketplace.service.ts`; design:
  `goalsetters/designs/marketplace-catalog.md`.

## How the existing catalog was built (do it the same way)

1. **Draft from knowledge, per collection.** Pick a theme with a point of view, list the
   films that earn a place, write the one-line description. Reuse ids already in
   `items.json`; add new films there.
2. **`validate`** until clean. It caught real collisions: "The Evil Dead" vs "Evil Dead"
   look the same to the app (a leading "The" is ignored), so both carry years in the app.
3. **Fact-check against Wikidata** (`verify-wikidata.mjs`). Most match outright; check the
   rest by hand and write them up in `FACT-CHECK.md`. `--apply` writes each matched film's Q-id into `items.json` (only where missing).
4. **`review`** writes `collections/<group>.md`: read it as a person would.
5. **Build + `site-check`**, then the app gate above, then commit.

No external film database was scraped; titles, years and directors are curated and then
checked. Keep it that way: a smaller, correct catalog beats a big noisy one, because every
title here is something the app may match a user's task against.

## Where it stands (2026-10-25)

- **One domain, movies; one group, `horror`: 317 films in 30 collections.** The 30:
  the canon (Horror Essentials, 52), six eras (pre-1970 → modern), thirteen subgenres
  (slashers, ghosts & possession, zombies, vampires, werewolves, creature features, body
  horror, folk horror, horror comedy, found footage, world horror, Stephen King, Universal
  Monsters), and ten franchises in viewing order (Halloween, Friday the 13th, Elm Street,
  Scream, Evil Dead, Alien, Conjuring, Saw, Final Destination, Child's Play).
- **Live** at https://nextlevel-collections.pages.dev, matching `dist/` (built from the data as of 2026-10-25).
- **Natural next horror collections** (not started; TJ hasn't picked): giallo, cosmic /
  Lovecraftian, home invasion, witches, killer dolls, Christmas horror, "elevated" A24-era
  horror; franchises Texas Chain Saw, Hellraiser, Insidious, Romero's Dead, The Purge.
- **Beyond horror** (a new group in `movies`, e.g. `sci-fi.json`) or a new domain: ask
  TJ which first. The design/marketing site was only checked on horror.
- **Open, not this repo's data:** link-preview images (og:image) and a custom domain for
  the site.
- **Repo:** public at https://github.com/locklainn/nextlevel-catalog (`main`). Push only
  when TJ says so.
- **Held:** the `send` batch (see Never).
- **A public repo.** Everything here is public: no tokens, emails or personal paths in
  code or commits. `send` reads its token from `NEXTLEVEL_TOKEN`; never write it down.
