# Fact check — countries

**The set is the UN's: 193 member states and its 2 observer states, Vatican City and
Palestine. That's 195, the "Every Country" list.** Taiwan and Kosovo are items too, on their
continent's list (Asia, Europe) but not on Every Country, which follows the UN. The
travellers' clubs count far more "countries" (territories, regions); this catalog doesn't.

The 193 were pulled from Wikidata (sovereign states with a current UN membership and an
ISO code) on 2026-10-26: 192 came back. The missing one was **Denmark**, whose UN
membership Wikidata records on "Kingdom of Denmark" and whose ISO code is on "Denmark".

`node tools/verify-wikidata.mjs countries` matches each by English label or alias, then
checks its own ISO 3166-1 alpha-2 code. Run 2026-10-26: **197 of 197 matched.**

## Continents

Continents follow the UN's M49 regions, with the Americas split into North (Canada, the
US, Mexico, Central America, the Caribbean) and South. That puts **Russia in Europe**, and
**Turkey, Cyprus, Georgia, Armenia, Azerbaijan and Kazakhstan in Asia**, which surprises
people about Cyprus (an EU member) and Turkey. Every country is on exactly one continent.

## Names

The title is Wikidata's English label, except where that's the formal name and nobody says
it: **China** (aka "People's Republic of China"), **Netherlands** (aka "Holland", "Kingdom of
the Netherlands"), **Micronesia** (aka "Federated States of Micronesia"), and **Palestine**
(aka "State of Palestine"). Other names a task might use are in `aka`: Czechia, Türkiye,
Côte d'Ivoire, Cabo Verde, East Timor, Swaziland, Burma, Holy See, DR Congo, UAE, USA, UK.

**Georgia** the country and **Georgia** the US state are both Destinations; they are told
apart by `country` (`GE`, `US`). `validate` checks across both categories.

Kosovo's code, `XK`, is the one in common use; it is not an official ISO code.
