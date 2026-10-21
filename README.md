# ARK Field Ops

Static player portal for ARK: Survival Ascended official PvP. It combines a persistent raid checklist, a local-only tribe roster, quick official-network links and a curated field kit of external ARK tools.

## Run it

Open `index.html` in a browser, or serve this directory with any static file server. No build step, account, backend or API key is required. The checklist and tribe board are saved in that browser's `localStorage` only.

## Research notes

The information hierarchy follows recurring patterns on ARK community-server sites: make status, rates, maps, events, rules and tribe activity quick to scan. For official PvP, the portal points to live rate and network trackers instead of presenting community-server settings as official data. It links to established taming, breeding and wiki resources rather than duplicating their changing game databases.

The baseline-rate label is not a live feed. Official event boosts may change rates; always check the linked tracker before committing to a long tame or breeding cycle.

## Sources reviewed

- [Studio Wildcard support: game modes](https://support.survivetheark.com/hc/en-us/articles/18374796351767-Different-types-of-game-modes)
- [ARK Status: current official rates and network status](https://arkstatus.com/)
- [Dododex: taming and breeding tools](https://www.dododex.com/)
- [ARK Official Community Wiki](https://ark.wiki.gg/)
- [#JABBA community portal](https://jabbaark.com/) and [NO BS ARK](https://www.nobsark.com/) as examples of community-server portals

