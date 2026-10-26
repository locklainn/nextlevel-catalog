# Collection visuals: what the catalog sends so the app can draw a map

For the agent working in this repo. Decided 2026-10-26 with TJ; the app side is in
goalsetters (`designs/collection-visuals.md`). **The app already draws `skyline`** (built and
gated 2026-10-26); `regions` and `points` wait on the data below. Add a one-line pointer to this file from
`CLAUDE.md` when you next commit it.

## The idea

A collection can be shown as a picture that fills in as the user finishes it: the NH 48 as
a skyline of peaks, State High Points as a US map with states coloured in, the NH 48 as pins
on a New Hampshire outline. **The catalog never ships drawing code.** It sends a small
declarative `display` spec plus plain data, and the app has a fixed set of renderers
(`kind`s). A new collection gets a visual by adding a few lines of JSON, never by changing the
app, as long as an existing kind fits. If no kind fits, propose a new one to TJ; don't
invent one, because the app will just ignore it.

**No `display` means a list, as today.** Every field below is additive: an older app ignores
it.

## The contract

### 1. `display` on a collection

In `domains/<domain>/collections/<group>.json`, per collection, optional. The build copies it
to `collections/<id>.json` and to that collection's entry in `index.json`.

```json
{ "id": "nh-48", "display": { "kind": "skyline", "field": "elevation", "unit": "ft" } }
{ "id": "us-state-high-points", "display": { "kind": "regions", "shapes": "us-states", "by": "state" } }
{ "id": "nh-48", "display": { "kind": "points", "shapes": "us-states", "outline": ["NH"] } }
```

A collection has **one** `display`. (The NH 48 gets `skyline` first, then `points` once
coordinates exist.)

| kind | draws | each member must carry |
|---|---|---|
| `skyline` | the peaks as a silhouette, sorted by `field`, filled when done | the numeric `field` (`elevation`: already there) |
| `regions` | a map whose shapes fill in as members are done | the `by` field, whose value names a shape in `shapes` (`state: "NH"`, `country: "FR"`) |
| `points` | pins on an outline | `at: [x, y]`, **computed by the build** (see 3) |
| `shelf` | a wall of covers (later: image licensing first) | (not yet specified) |

### 2. Shape files: `/api/v1/shapes/<id>.json`

Source geometry lives in `shapes/<id>.json` in this repo, and the build copies it to `dist/`.
**The app draws them as-is.** No projection or simplification happens on the phone, so the
build (or a one-off tool, `tools/make-shapes.mjs`) does both:

```json
{ "id": "us-states", "viewBox": "0 0 975 610",
  "source": "US Census cartographic boundary file, 1:20m, 2023 (public domain)",
  "projection": "albersUsa",
  "shapes": { "NH": "M871.2 140.5L…Z", "AK": "M…", "...": "…" } }
```

- **Sources must be public domain:** Natural Earth (world, continents, countries, Canada's
  provinces) or the US Census cartographic boundaries (states). Write the source in `source`
  and in `domains/LICENSE`'s note. Never trace from a copyrighted map.
- **Simplify** until the file is about 100 KB or less, and round coordinates to one
  decimal. It's a fill-in map, not cartography.
- Keys are the same codes the items use (`NH`, `BC`; ISO alpha-2 for countries). The
  `projection` field is informational; `points` needs it (see 3).
- First files: `us-states` (with Alaska and Hawaii as insets: Albers USA), then `world`
  (every country, keyed by ISO 3166-1 alpha-2, plus a `continents` file merged from it),
  then `ca-provinces`.
- **Countries** are a `regions` list over `world`: `{ "kind": "regions", "shapes": "world",
  "by": "country" }`, each item a country with `country: "FR"`. Tiny countries (Vatican,
  Monaco, most island nations) are a few pixels at world scale: keep them in the file, and
  the app will draw a dot where a shape is too small to tap.

### 3. Points: coordinates in, `at` out

- **In the source data:** members get `lat` and `lon` (decimal degrees, 4 places), from
  Wikidata **P625**. Extend `verify-wikidata.mjs`: fetch P625 for items with a Q-id, and on
  `--apply` write `lat`/`lon` where missing. 186 of the 205 mountains have a Q-id; the other
  19 need a hand lookup, recorded in `FACT-CHECK.md`. Coordinates are **description**, never
  identity.
- **In the build:** for a `points` collection, project each member's lat/lon with the shape
  file's projection into its viewBox, and write `at: [x, y]` (one decimal) on that member in
  `collections/<id>.json`. Also write `display.crop`, the viewBox around the `outline`
  shapes plus a small margin, so the app shows NH, not the whole country.
- The app draws: the outline paths, cropped to `crop`; a dot at each `at`.

### 4. What `validate` must enforce

- `display.kind` is one of `skyline`, `regions`, `points`. Anything else is an error.
- `skyline`: every member has a number in `field`.
- `regions`: `shapes/<shapes>.json` exists, and every member's `by` value is a key in it.
  (A shape with no member is fine: the 50-states map for a 48-member list.)
- `points`: every member has `lat`/`lon`, and each lands inside its `crop` after projection.
  A point outside means a wrong coordinate or a wrong state.
- `site-check`: each shape file is under 150 KB and parses.

### 5. The site

The public collection page can draw the same thing from the same JSON: an inline SVG of the
paths, filled for nothing (the site doesn't know what anyone did). It's the best preview the
catalog has, so it's worth doing, but after the app.

## Order (TJ confirms each)

1. **`skyline` on mountain lists.** Data is already there; only `display` is added. The app
   already draws a skyline for any followed list whose members all carry `elevation`, so the
   NH 48, the Adirondack 46 and the rest work today. Adding `display` makes it explicit, and
   lets a mountain list choose `points` later instead.
2. **`shapes/us-states.json` + `regions`** on US State High Points. The same map later serves
   "All 50 States" (roadmap step 4).
3. **Coordinates + `points`** on the NH 48, then the Adirondack 46 and the Catskill 3500.
4. `world` shapes for countries and the 7 Continents; `ca-provinces` for Canada (step 4).

## Not yours to do

- The renderers, colours (the collection's existing `accent`), tap-a-pin, and the fill-in
  animation: the app side.
- Followers pick up a new `display` (and new member fields such as `at`) only when the
  collection's `version` changes. **Today it doesn't:** `build-site.mjs` hashes `{ title,
  description, icon, members }`, and `members` is the list of ids. Add `display` to that
  hash, plus the member fields the visual uses (`elevation`, `at`), so that adding a
  picture re-syncs followers.
- The Mountains Library type: the app now has it built in (verb "Climb"), so `done:
  "climbed"` in `domain.json` and the app agree. A new domain whose `libraryType` the app
  doesn't have yet still gets a generic type ("engaged with"): tell TJ before you start one.
