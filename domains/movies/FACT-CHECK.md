# Fact check — movies

`node tools/verify-wikidata.mjs movies` compares every film's year (±1) and director
with Wikidata, matching English labels and alternate titles. Run 2026-10-25 over 317
films: **304 matched outright**. The other 13 were checked by hand:

- **Same director, different spelling or credit (9):** The Blob (Irvin Yeaworth), A Tale of
  Two Sisters (Kim Ji-woon), Saw II / III / IV and Spiral (Wikidata spells it "Bouseman"),
  Grave Encounters (The Vicious Brothers = Colin Minihan & Stuart Ortiz), Jigsaw (Michael &
  Peter Spierig), Lake Mungo (no director recorded on Wikidata).
- **A different title on Wikidata (4):** House (1977) is our "Hausu"; Twitch of the Death
  Nerve is "A Bay of Blood"; "Blood on Satan's Claw" (we dropped "The" to match); From Dusk
  till Dawn (casing).
- **Kept our year:** Cronos 1993 (Wikidata's earliest date is a 1992 festival), Hell House LLC
  2015 (festival; wide release 2016).

`wikidata` on an item is its Wikidata id (Q-number), where one matched.
