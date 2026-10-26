# Roadmap: the list of lists

**Goal: 12 categories before we start sending people to the catalog.** Each category is a
set of achievements to earn: follow a list, do the things, watch the checklist fill.

Built **one step at a time**: an agent finishes a step, TJ confirms it, then the next
one starts. Every step ends shippable: validate, fact-check, build, site-check, app gate,
commit. Nothing is deployed without TJ.

## Rules for every category

- **A ladder, not one list.** Each category launches with a **quick win** (finishable in
  a month), a **core** list, and a **long haul**. People speed up as they near the end of
  a list, so a newcomer needs one they can actually finish.
- **Prefer lists with an authority** (a club, an award, a park service, a league). They are
  closed sets we can check for completeness. Editorial rankings (AFI 100, Rolling Stone
  500, IMDb Top 250) are someone else's selection: make our own list with a point of view.
- **Key fields** (`identity` in `domain.json`) are what tell two same-titled items apart.
  Before adding items, ask what could clash. `validate` fails on two items equal on every key.
- **Same Library type, several categories.** National Parks, Ballparks, States and Theme
  Parks all land in the app's **Destinations** type. The app matches by title within a
  type, so a clash across those categories is still a clash; `validate` must check across
  them (step 1).

## The steps

| step | what | Library type | key fields | status |
|---|---|---|---|---|
| 1 | **Multi-category tooling** + ⛰️ **Mountains** (Northeast + California) | Mountains | title + state | next |
| 2 | 🎮 Video Games | Video Games | title + year | |
| 3 | 🏞️ National Parks | Destinations | title + state | |
| 4 | 🗺️ States & Provinces | Destinations | title + country | |
| 5 | 🏟️ Ballparks & Arenas | Destinations | title + city | |
| 6 | 📚 Books | Books | title + author | |
| 7 | 📺 TV | TV Shows | title + startYear | |
| 8 | 🥾 Trails & Hikes | Trails & Hikes | title + region | |
| 9 | 🍸 Cocktails | Recipes | title | |
| 10 | 🎲 Board Games | Board Games | title + year | |
| 11 | 🎢 Theme Parks | Destinations | title + country | |
| 12 | 🎬 Movies beyond horror: Best Picture winners | Movies | title + year | |
| 13 | 🎬 Finish horror (+17 collections) | Movies | title + year | |
| later | **Metadata keys in the app** (goalsetters), which unblocks the clash list below | n/a | n/a | other agent |

Movies already counts as category 1 of 12, so the launch bar is reached at step 11. Steps 12 and 13
deepen movies and can move earlier whenever TJ wants.

**Step 1's tooling:** the site and tools are written for one domain (films):
- `build-site.mjs` hard-codes "film", `year`, `director` and the horror landing copy.
  It needs per-domain nouns and a subtitle line from `domain.json`, category chips on the
  landing page, and generic item pages and structured data.
- `verify-wikidata.mjs` checks year + director. It needs a per-domain check list in
  `domain.json` (elevation + state for peaks, author for books…).
- `catalog.mjs validate` needs to check clashes across categories that share a Library type.
- `site-check.mjs` assumes the first domain is movies.

## Category by category

Quick win → core → long haul. Counts marked ~ are targets; the others are fixed by the list's authority.

### ⛰️ Mountains (step 1)
- **New England State High Points** (6): Washington, Katahdin, Mansfield, Greylock, Frissell, Jerimoth Hill
- **Catskill 3500 Club** (35)
- **New Hampshire 4,000-Footers** (48), AMC
- **Adirondack 46 High Peaks** (46), Adirondack Forty-Sixers
- **New England 4,000-Footers** (67), AMC
- **Northeast 4,000-Footers** (115), AMC
- **California Fourteeners** (12 or 15: pick one rule and write it down)
- **US State High Points** (50): includes Rainier, Hood, Whitney, Denali

### 🎮 Video Games (step 2)
- **FromSoftware Souls** (~7, ordered)
- **The Game Awards: Game of the Year** (2014 to now, ordered)
- **Indie Darlings** (~20)
- **Horror Games** (~15): cross-links the horror movie catalog
- **The Big Multiplayer Games** (~18)
- **Modern Essentials, 2015 to now** (~40)

### 🏞️ National Parks (step 3)
- **Utah's Mighty 5** · **Alaska's 8** · **California's 9** · **All 63 National Parks**

### 🗺️ States & Provinces (step 4)
- **New England** (6) · **The 7 Continents** · **Canada's Provinces & Territories** (13) · **All 50 States**

### 🏟️ Ballparks & Arenas (step 5)
- **Historic Ballparks** (~5: Fenway, Wrigley, Dodger Stadium…)
- **MLB Ballparks** (30) · **NFL Stadiums** · **NBA Arenas** · **NHL Arenas**
- Venues change names (sponsors) and teams move. Titles get fixed in place, ids never change.
  Shared venues (Madison Square Garden: NBA + NHL) are one item. Check the current season's venues on the web.

### 📚 Books (step 6)
- **Horror Classics** (~12: Frankenstein, Dracula, The Haunting of Hill House…)
- **Stephen King Essentials** (~15): bridges the horror movie catalog
- **Fantasy Series, in order** (The Lord of the Rings, Harry Potter, Narnia)
- **Hugo Award: Best Novel** (closed list)

### 📺 TV (step 7)
- **Horror TV** (~12) · **Comedy Essentials** (~20) · **Prestige Drama** (~25) · **Emmy: Outstanding Drama Series** (closed list)

### 🥾 Trails & Hikes (step 8)
- **White Mountains Classics** (~10: Franconia Ridge, Tuckerman Ravine…)
- **Iconic US Day Hikes** (~20) · **The World's Great Treks** (~12: Tour du Mont Blanc, Inca Trail, Camino Francés)
- **National Scenic Trails** (11) · **New Zealand Great Walks** (check the current count)

### 🍸 Cocktails (step 9)
- **The Mother Cocktails** (~6: Old Fashioned, Martini, Daiquiri, Sidecar, Highball, Flip)
- **Tiki Classics** (~10) · **IBA Official Cocktails** (closed list, three sections: Unforgettables, Contemporary Classics, New Era)

### 🎲 Board Games (step 10)
- **Gateway Games** (~10) · **Co-op Games** (~10) · **Spiel des Jahres Winners** (1979 to now, ordered)

### 🎢 Theme Parks (step 11)
- **Walt Disney World's 4 parks** · **Every Disney Park** (12; check names, Paris is renaming one)
- **Universal Parks** · **Legendary Roller Coasters** (~15)

### 🎬 Movies (steps 12–13)
- **Best Picture Winners** (ordered; reuses films already here, like The Silence of the Lambs)
- **Finish horror:** franchises Romero's Dead, Texas Chain Saw, Hellraiser, Insidious, The Purge;
  subgenres Giallo, Cosmic Horror, Home Invasion, Witches, Killer Dolls, Christmas Horror,
  A24 Horror; optionally director lists (Carpenter, Craven, Flanagan, Peele), Hammer,
  anthologies, Nature Strikes Back.
  None grows Folk Horror, so the app gate's pinned numbers hold.

## Waiting on the app's metadata keys

The app tells same-titled items apart only by a year in parentheses today. These lists
have real clashes and wait until it reads key fields:

- **Cascade Volcanoes**: Mount Adams and Mount Jefferson are also NH 48 peaks
- **Colorado 14ers**: Mount Lincoln is also an NH 48 peak
- **Washington's Bulger List**, **New England Hundred Highest**: same risk, unchecked
- **Countries of the World**: Georgia the country vs Georgia the state
- **The Office** and other US/UK remakes in TV

## Later, not scheduled

Movies: sci-fi, Studio Ghibli, Pixar, MCU and Star Wars in viewing order. Albums (Grammy
Album of the Year). Marathons (World Marathon Majors) and beers, both of which need a new Library type: ask first.
