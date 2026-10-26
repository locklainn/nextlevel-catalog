# Fact check — states & provinces

The sets are closed: the 50 US states and Canada's 10 provinces and 3 territories.
Washington, D.C. is not a state and is not an item. Membership of the lists:

| list | count | source |
|---|---|---|
| The Northeast, Midwest, South, West | 9, 12, 16, 13 | US Census Bureau regions (D.C., in the South, is left out) |
| The Original 13 | 13 | the thirteen colonies, in the order they ratified the Constitution |
| The Lower 48 | 48 | the contiguous states: all 50 but Alaska and Hawaii |
| The Four Corners | 4 | the four states that meet at the Four Corners Monument |
| The Maritimes | 3 | New Brunswick, Nova Scotia, Prince Edward Island (not Newfoundland and Labrador, which is Atlantic Canada) |

`node tools/verify-wikidata.mjs states` matches each by English label, then checks its
ISO 3166-2 code (`US-NH`), its capital (Wikidata's English label, exactly) and its year
(Wikidata's inception, exactly). Run 2026-10-26: **62 of 63 matched on all three.** The one:

- **Prince Edward Island**: Wikidata's inception is 1769, when it became a separate colony.
  Ours is 1873, the year it joined Canada, which is what `year` means for a province.

`year` is statehood, or for the Original 13 the year they ratified the Constitution
(Delaware 1787 to Rhode Island 1790), or the year a province or territory joined Canada.

## Names

- **Hawaii**, with "Hawaiʻi" (the ʻokina spelling) as an alternate name.
- **Quebec**, with "Québec". **Yukon**, its official name since 2003, with "Yukon Territory".
- **New York** and **Washington** carry "New York State" and "Washington State", the way
  people tell them from the city.
- State names and codes are never in `aka`: the app reads "in New Hampshire" and "(NH)"
  from the codes (see `IDENTITY.md`).

`wikidata` on an item is its Wikidata id (Q-number).
