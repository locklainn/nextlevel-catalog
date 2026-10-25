# NextLevel Catalog

Agents: read `CLAUDE.md` before changing anything.

**Live:** https://nextlevel-collections.pages.dev — the public site, and the JSON API the app
reads at `/api/v1/`.

A catalog of the things a person can collect, earn or complete: movies to watch,
mountains to climb, trails to hike, beers to try. In NextLevel each one becomes a
**Library item**, and a curated set becomes a **collection** ("Horror Essentials",
"The 48 New Hampshire 4,000-footers").

This repo is the source of truth for that data. It is reviewed here, by a person,
before anything reaches the app.

## Layout

```
domains/<domain>/
  domain.json             the Library type it maps to ("Movies"), ref prefix, note template
  items.json              every item in the domain, one per line, with a stable id
  collections/<group>.json  collections that list item ids
  collections/<group>.md    the review page, generated (don't edit)
tools/catalog.mjs         validate · review · batch · send · status
tools/identity.mjs        the app's own title matcher, copied (see Identity)
tools/verify-wikidata.mjs fact-check years and directors (domains/<d>/FACT-CHECK.md)
tools/build-site.mjs      dist/: the website + /api/v1 JSON, from the same data
tools/site-check.mjs      drives dist/ in headless Chrome at phone + desktop width
site/                     the site's CSS and JS
```

An item is defined **once** per domain and referenced by id from any number of
collections, so *The Thing* is the same item in "80s Horror", "Creature Features" and
"Body Horror".

**Ids never change once sent.** The app knows each item by the ref `<prefix>-<id>`
(`mv-the-thing-1982`). Renaming an id makes the app think it's a different thing.

## Identity

Each domain says which fields make an item unique (`identity`). For movies it is
title + year. Two items that share a title (remakes: *Halloween* 1978 / 2007 / 2018)
reach the app as "Halloween (1978)", "Halloween (2007)" and "Halloween (2018)".
A leading "The" doesn't count, so "The Evil Dead" and "Evil Dead" get years too.

`validate` judges every pair of items with `tools/identity.mjs`, which is NextLevel's
own matcher (`src/app/nlcommon/definitions/library-identity.ts`, compiled to JS). It
fails on two items the app would treat as one, and lists the pairs the app would ask
you about. Re-copy it when the app's matcher changes.

## Workflow

```sh
node tools/catalog.mjs validate movies          # ids, references, duplicates, title hazards
node tools/catalog.mjs review   movies horror   # writes collections/horror.md for review
node tools/catalog.mjs batch    movies horror   # prints the /builds batch (dry run)
NEXTLEVEL_TOKEN=… node tools/catalog.mjs send movies horror
node tools/catalog.mjs status catalog-movies-horror-v1
```

**`send` is superseded; don't run it** (the app now *follows* collections instead of copying them; see `CLAUDE.md`). It proposes a batch to the NextLevel agent-builds endpoint. **Nothing is created
until it is approved in the app's Activity Inbox.** Batches are idempotent by
`batchId`, and members the app already made (refs in `/builds/state`) aren't re-sent.

## Domains

| domain | Library type | groups |
|---|---|---|
| movies | Movies | horror |

## Publish the site

```sh
node tools/build-site.mjs && node tools/site-check.mjs          # build, then check it
npx wrangler@3 pages deploy dist --project-name nextlevel-collections --branch main
```

The API is static JSON, CORS-open (`dist/_headers`):

| path | what |
|---|---|
| `/api/v1/index.json` | domains, and every collection without members |
| `/api/v1/collections/<id>.json` | one collection with its members |
| `/api/v1/items/<domain>.json` | every item in a domain, with the collections it's on |

Ids: an item is `movies:<id>`, a collection `col:movies:<id>`. A collection's `version`
changes when its title, description, icon or members do — the app re-syncs on that.

## The waitlist

The site's form posts to the activity Worker (`POST /waitlist`). There is no read
endpoint on purpose. Read it with your Cloudflare login, from `goalsetters/activity-worker`:

```sh
npx wrangler@3 kv key list --binding ACTIVITY --prefix waitlist:
```
