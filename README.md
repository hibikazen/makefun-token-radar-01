# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hibikazen/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/hibikazen/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: a token launch radar for make.fun's `token-radar-01` bounty. It reads a sealed
DefiLlama snapshot (758 protocols, 40 on the watchlist), ranks 200 pre-token protocols by an
implied value, and hands in a static offline dashboard with a farm plan for every row.

The value model is comparables, not a flat multiple: each protocol is priced at the median
mcap/TVL of the snapshot's own live-token protocols in its category, blended toward the global
median where a category has few comparables, then adjusted for seven-day TVL growth and for how
long it has run with no token. No protocol name is ever special-cased, and the page recomputes
every row from the same figures, so the screenshots, the code and the board agree.

The dashboard is searchable, sortable and filterable by category and chain, with a detail view
per protocol (model breakdown plus farm plan, every step with its cost and time) and a separate
Live token tab for the protocols that already trade.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and
`out/dossier.json`. Open `out/dashboard/index.html` in a browser (no network needed) to see
the board. Node 22.18 or later, standard library only, nothing to install.

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
