# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hibikazen/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/hibikazen/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: a token launch radar for make.fun's `token-radar-01` bounty. It reads a sealed
DefiLlama snapshot (758 protocols, 40 on the watchlist), ranks 197 pre-token protocols by an
implied value, and hands in a static offline dashboard with a netted farm plan for every row.

**View the dashboard live:** https://hibikazen.github.io/makefun-token-radar-01/dashboard/ — no install, just open in desktop Chrome.

The value model is a fitted size curve, not a flat multiple: market cap grows with TVL to a
power well below one across the snapshot's own traded tokens, so each protocol is priced on the
log-log curve fitted to the 128 live-token protocols with a market cap. The curve is kept only
because the snapshot's own blind test keeps it: leave-one-out over those 128 tokens, it predicts
the held-out market cap with a median error of 3.40x, against 5.26x for a flat multiple and
4.20x for a category median. Growth, age, category, chain breadth and a quadratic curve were all
tried and rejected by the same test, so none is in the formula. No protocol name is ever
special-cased, and the page recomputes every row from the same figures, so the screenshots, the
code and the board agree.

The board is the whole pre-token universe the snapshot can rank: all 40 watchlist protocols plus
every other pre-token protocol that is not an exchange, a versioned pool, or a wrapped or staked
product of an asset that trades (bridges, liquid staking and restaking, BTC and stablecoin
wrappers). Every protocol in the snapshot is accounted for in the dashboard: 342 pre-token, 416
live-token, 42 exchanges, 11 versioned pools and 92 wrapped or staked products set aside.

The dashboard is searchable, sortable and filterable by category and chain, with a detail view
per protocol (model breakdown with a bootstrap uncertainty band, plus a farm plan netted to a
farm / thin / skip verdict) and a separate Live token tab for the protocols that already trade.

## The model

`implied = round(exp(alpha) x TVL ^ beta)`, where `alpha` and `beta` come from an ordinary
least-squares fit of `log(mcap)` on `log(tvl)` over the snapshot's live-token protocols with a
market cap above zero (on this snapshot: alpha 6.9646, beta 0.5223, n = 128). Each row's band is
the 10th-90th percentile of 200 bootstrap refits of the curve. The dashboard's model panel prints
the whole blind test, adopted row and rejects alike, and states every constant; the detail view
shows each row's own breakdown. See `lib/model.ts` for the whole derivation.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and
`out/dossier.json`. Open `out/dashboard/index.html` in a browser (no network needed) to see
the board. Node 22.18 or later, standard library only, nothing to install.

`screenshots/` holds three captures of this dashboard: the board, a protocol's detail view, and
a filtered view (the RWA category).

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
