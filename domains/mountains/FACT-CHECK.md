# Fact check — mountains

Membership comes from each list's own club, so every list is checked for completeness
against the club's list, as reproduced on Wikipedia (2026-10-26):

| list | count | source |
|---|---|---|
| New Hampshire 4,000-Footers, New England 67 | 48, 67 | AMC Four Thousand Footer Club ("Four-thousand footers") |
| Adirondack 46 | 46 | Adirondack Forty-Sixers ("Adirondack High Peaks") |
| Catskill 3500 Club | 35 | Catskill 3500 Club ("Catskill High Peaks") |
| Northeast 115 | 115 | AMC: the 67, the 46, Slide and Hunter |
| California Fourteeners | 12 | "List of California fourteeners": summits with ≥ 300 ft of prominence |
| State high points | 50 | "List of U.S. states by elevation" |

Every name in every list matches its source; no list is missing a peak or has an extra one.

**Elevations** are the club's published figure for a peak on a club list (AMC, ADK,
Catskill 3500, including Tecumseh's traditional 4,003 ft; it was resurveyed at 3,997 in 2019
and stays on the list), and the state-elevation table for the other state high points.
Different surveys differ by a few feet; elevation is a description, never a key.

`node tools/verify-wikidata.mjs mountains` matches each peak by English label or alias,
then checks its state, then its elevation (±100 ft). Run 2026-10-26 over 205 peaks:
**159 matched outright**. The rest:

- **Wikidata has no elevation, or no state, for the peak (35):** mostly Catskill peaks,
  plus Kings Peak (UT) and Crocker Mountain (ME). Each is confirmed by its club list
  or the state table above. Where only the elevation was missing and one entity matched
  name + state, its Q-id is recorded.
- **Not on Wikidata under the club's name (7):** South Kinsman, Zealand Mountain, East
  Osceola, Bigelow West Peak, Wildcat D (NH/ME), Blackhead Mountain, Southwest Hunter (NY).
  All are on their club lists. North Dome (NY) is the same: Wikidata's only North Domes
  are in California and Alaska.
- **Wikidata disagrees, and we kept ours (3):**
  - Mount Rogers, VA: Wikidata 5,988 ft; the state table 5,711 (older figure 5,729). Ours: 5,711.
  - Black Mesa, OK: Wikidata 5,699 ft is the mesa's highest point, in New Mexico. Oklahoma's
    high point, on the same mesa, is 4,975.
  - Street Mountain, NY: Wikidata 4,012 ft; the Forty-Sixers list 4,166. Ours: 4,166.

## Names

- **Denali, AK**, with "Mount McKinley" as an alternate name. The US federal name became Mount McKinley
  again in 2025. The park, Alaska and most climbers say Denali, and both names match a task.
- **Kuwohi, TN**, renamed from Clingmans Dome in 2024 (alternate name: "Clingmans Dome").
- **Hoye-Crest, MD**: Maryland's high point, on Backbone Mountain (alternate name: "Backbone Mountain").
- **Mount Frissell, CT**: Connecticut's high point is on the south slope (2,386 ft); the
  summit itself is in Massachusetts. The item is the Connecticut high point, so its state is CT.
- **Katahdin, ME**: Baxter Peak, the summit (alternate names: "Mount Katahdin", "Baxter Peak").
  Hamlin Peak is its own item.
- **Grace Peak, NY** was East Dix until 2014 (alternate name: "East Dix").
- **Wildcat Mountain, NH** is the A peak (alternate name: "Wildcat A"); Wildcat D is its own item.
- **Bearpen Mountain, NY**: the Catskill 3500 Club counts a higher point about half a mile
  southeast of the summit marked on the USGS map.
- **The Adirondack 46**: Blake, Cliff, Nye and Couchsachraga were later surveyed below
  4,000 ft. The Forty-Sixers kept them on the list, and so do we.

`wikidata` on an item is its Wikidata id (Q-number), where one matched.
