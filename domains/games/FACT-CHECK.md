# Fact check — video games

`node tools/verify-wikidata.mjs games` matches each game by its English or all-language
Wikidata label (or alias), among entities that are a video game, then checks the year
(±1) and the developer. Run 2026-10-26 over 106 games: **101 matched outright**; the other
5 were checked by hand, and every game has its Q-id.

- **Wikidata's label differs only in capitals (2):** SOMA (Q15121353) and NieR: Automata
  (Q21078985). The app's matcher ignores case, so the titles stay as written.
- **Same developer, credited differently (1):** Super Meat Boy is Team Meat (Edmund McMillen
  and Tommy Refenes); Wikidata lists McMillen alone.
- **Solo developers named as the person, as Wikidata does (4):** Braid (Jonathan Blow, whose
  studio is Number None), A Short Hike (Adam Robinson-Yu, "adamgryu"), Animal Well (Billy
  Basso, whose studio is Shared Memory), and Mega Crit for Slay the Spire (our draft said
  "MegaCrit").
- **Kept our year:** Overwatch 2, 2022 (released 4 October 2022; Wikidata's earliest date is 2023).

The Game Awards' Game of the Year list (2014–2025) was checked against the 2025 results:
Clair Obscur: Expedition 33 won on 11 December 2025.

## Rules for this domain

- **The year is the 1.0 release.** A game that left early access counts from its full launch
  (Hades 2020, Baldur's Gate 3 2023, Dead Cells 2018, Slay the Spire 2019); one still in early
  access counts from its early-access launch (Phasmophobia 2020, Lethal Company 2023).
- **Remakes are their own items** and the horror list prefers them, because they are what
  people play now: Resident Evil 2 (2019), Resident Evil 4 (2023), Dead Space (2023), Silent
  Hill 2 (2024). An original added later gets its own item and its own year.
- **Full titles, with short names as `aka`:** "Sekiro: Shadows Die Twice" (aka Sekiro),
  "The Witcher 3: Wild Hunt" (aka The Witcher 3), "Grand Theft Auto V" (aka GTA V, GTA Online).
- **Online games count once played.** The Big Online Games' description says so: they have
  no end to finish.
- **Overwatch (2016) is on the Game of the Year list** though its servers closed in 2022,
  when Overwatch 2 replaced it. The list is a record of the winners.
