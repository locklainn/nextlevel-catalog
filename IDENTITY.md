# Item identity: what the app now expects (decided 2026-10-26)

For the agent working in this repo. This settles the `METADATA.md` draft (since folded
into `CLAUDE.md`). The app side is built and committed in goalsetters
(`designs/catalog-item-identity.md`, commit `f197e03d`). This file is the catalog's half:
the exact shape the app reads, and how to restructure the items to fit it.

Add a one-line pointer to this file from `CLAUDE.md` when you next commit it.

## What was decided

1. **The title is the name and nothing else.** No year, state or parenthetical in `title`
   in `items.json`. (Movies already comply: `"title": "Halloween"`, `"year": 1978`.)
2. **Key fields = the domain's `identity` minus `title`.** Movies: `year`. Mountains:
   `state`. Books: `author`. Albums: `artist` + `year`.
3. **Only identity fields are keys.** The draft said "title + year, *then* director".
   The "then" is dropped. A director, elevation or range is a description: the app would
   split one item in two over a spelling difference ("Bousman" vs "Bouseman"). When two
   items still tie, a person decides.
4. **The API changes additively** (expand, then contract). Old app builds read `title`;
   new ones read `name` + `keys`. Nothing has to land in a particular order.
5. **Border cases:** a place on a state line takes its **summit's** (or main entrance's)
   state. State and country values are **2-letter codes** (`NH`, `OR`; `CA` for Canada
   outside the US). The app recognises a code in a task only when it's set off, as in
   "(OR)" or ", OR", because a bare "or" or "me" is an English word.
6. **Alternate titles go in `aka`** and are matched like names. So they must not collide:
   *Tenebrae* was released in the US as *Unsane*, and Soderbergh's *Unsane* (2018) is a
   different film.

## The API contract (what the app reads)

Every member in `collections/<id>.json` and every item in `items/<domain>.json`:

```json
{
  "defId": "movies:halloween-1978",
  "id": "halloween-1978",
  "title": "Halloween (1978)",
  "name": "Halloween",
  "keys": { "year": 1978 },
  "aka": [],
  "year": 1978,
  "director": "John Carpenter"
}
```

- `title`: **unchanged.** It keeps the "(1978)" when the domain has two of the name, for
  older app builds. Don't drop it yet (that's the last phase, D).
- `name`: the bare title.
- `keys`: **an explicit object with exactly the identity fields minus `title`.** This is
  the field the app reads for identity. Spreading the domain's fields onto the member (as
  the new `memberJSON` does) is fine for display, **but the app does not read a loose
  `state` field as a key.** Without `keys`, it falls back to `year` only, so two Mount
  Washingtons would arrive looking identical.
- `aka`: alternate titles. Omit it, or send `[]`, when there are none.
- Other fields (`year`, `director`, `elevation`) stay as description.

Each domain in `index.json` also gains:

```json
{ "domain": "movies", "libraryType": "Movies", "items": 317, "collections": 30,
  "identity": ["year"], "qualifier": "{year} · {director}" }
```

`identity` is the key field names (no `title`). `qualifier` is the existing `note`
template; the app will show it as a second line once it stops putting "(1978)" in titles
(app phase C, not built yet).

## Restructuring the items

- **Movies:** no data change, except adding `aka` where a film has another title. First
  uses: `a-bay-of-blood-1971` → `["Twitch of the Death Nerve"]`; `hausu-1977` →
  `["House"]`. Run `validate` after each one. Be wary of one-word alternate titles: "House"
  collides with no title today, but a task "Watched House" would then mean Hausu, which is
  probably right in a horror catalog and wrong once *House* (1985) is added.
  **Ids never change.**
- **A new domain:** each item's identity fields are top-level fields
  (`{"id":"mount-washington-nh","title":"Mount Washington","state":"NH","elevation":6288}`).
  The build derives `keys` from `domain.json` `identity`. Don't hand-write `keys` in the
  source data, so the two can't drift apart.

## What `validate` must enforce

- Every item has every identity field (it already does).
- No two items match on every identity field (it already does).
- **New:** every `aka` is checked with the app's matcher (`tools/identity.mjs`,
  `compareTitles`) against every `title` and every other `aka` in the domain. A `same`
  verdict is an error; a `candidate` gets listed, the way title pairs are today.

## How to check it worked

```sh
node tools/build-site.mjs && node tools/site-check.mjs
node -e "const j=require('./dist/api/v1/items/movies.json'); const h=j.items.find(i=>i.id==='halloween-1978'); console.log(h.name, h.keys, h.title)"
#  → Halloween { year: 1978 } Halloween (1978)
cd ~/goalsetters && NL_CATALOG_DIST=$OLDPWD/dist PATH=~/.nvm/versions/node/v22.22.2/bin:$PATH node scripts/marketplace-verify.mjs
```

The app gate's KEY FIELDS section already covers `name`, `keys` and `aka` (it injects a
two-Mount-Washington domain), and must stay at 0 failed. Today it passes because the app
works out `name` and `keys` from the old shape. After this change, it should pass reading
them straight from the API.

## Not yours to do

- App phases C and D (showing the qualifier line, migrating "(1978)" titles, dropping
  them from `title`) happen in goalsetters.
- Full state names in task text ("in New Hampshire") need an alias table. That gets
  built with the mountains domain, on the app side.
