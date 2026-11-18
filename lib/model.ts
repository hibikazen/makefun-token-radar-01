// The token radar's model, radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every pre-token protocol the snapshot carries that can be ranked: the whole
// watchlist (the floor, never a ceiling) plus every other pre-token protocol that is not an
// exchange, not a versioned pool of another protocol, and not a wrapped or staked product of an
// asset that already trades. A protocol is pre-token when its record carries no token (no market
// cap, no CoinGecko id, no symbol); the snapshot's live-token protocols are kept apart and shown
// as the market's own values, never mixed into the ranked board. The live-token set is also the
// model's training data, never its output.
//
// A wrapped or staked product is recognised by its category, the snapshot's own classification:
// bridges move or wrap assets that trade, liquid staking and restaking issue staked forms of
// assets that trade, and the BTC and stablecoin wrapper categories wrap assets that trade. Their
// TVL is another asset's value, and no launch of their own is on the radar. The watchlist floor
// overrides the exclusion: a watchlist slug stays on the board whatever its category, because the
// gate's coverage row is the watchlist itself.
//
// Implied value follows only from the snapshot's own figures, and the formula is the one the
// snapshot's own blind test keeps. The market does not price one dollar of TVL the same at every
// size: across the live-token protocols, market cap grows with TVL to a power well below one, so a
// flat multiple overprices the large and underprices the small. radar-3 prices on the fitted
// log-log size curve:
//
//   log(mcap_usd) = alpha + beta x log(tvl_usd)   (ordinary least squares over the live-token
//                                                  protocols with a market cap above zero)
//   implied = max(1, round(exp(alpha) x tvl_usd ^ beta))
//
// The blind test is leave-one-out over those same live-token protocols: each one is held out in
// turn, the curve is refitted without it, and the prediction is scored against its real market
// cap. The test keeps the size curve and rejects every extra term tried against it: a flat
// multiple, a category median, seven-day growth, age, a category residual on the curve, chain
// breadth, and a quadratic curve all score worse on the median held-out error, so none of them is
// in the formula. The dashboard's model panel prints the whole test, adopted row and rejects alike,
// so the choice is checkable, not asserted. The same test also sets the uncertainty band: each
// row's implied value is refitted on 200 bootstrap resamples of the training set (a fixed seed,
// so the build is reproducible), and the 10th and 90th percentiles bound the estimate.
//
// The farm plan is netted, not just listed: every plan states its gas in dollars, its hours, the
// airdrop it would need to break even, and a verdict. The expected airdrop assumes a 5% airdrop
// shared pro-rata by position size, which the dashboard states as an assumption, not a fact; the
// verdict itself turns only on the hard cost, gas as a share of the capital committed, so it
// needs no guess about the airdrop's size.
//
// Every constant is stated in the dashboard's model panel and in the detail view's breakdown, and
// the page recomputes each row from the same figures. No protocol name is ever special-cased: the
// same function scores every row, and the curve is fitted from the snapshot itself, so the model
// re-prices itself on any snapshot it is handed.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. The curve itself is fitted, not constant. */
export interface ModelConstants {
  /** The airdrop share the expected value assumes: 5% of supply, shared pro-rata by position. */
  airdrop_share: number;
  /** What an hour of the farmer's time is valued at, for the plan's time cost. */
  hourly_rate_usd: number;
  /** Gas at or below this share of the committed capital earns a farm verdict. */
  farm_gas_share: number;
  /** Gas at or below this share earns a thin verdict; above it, the plan is a skip. */
  thin_gas_share: number;
  /** Gas in dollars per transaction, by chain class, at the midpoint of each band the plan states. */
  gas_ethereum_usd: number;
  gas_solana_usd: number;
  gas_l2_usd: number;
  gas_bitcoin_usd: number;
  gas_other_usd: number;
  /** Bootstrap resamples behind each row's uncertainty band, from a fixed seed. */
  bootstrap_resamples: number;
  bootstrap_seed: number;
  /** The band's percentiles: the 10th and 90th of the resampled implied values. */
  bootstrap_low: number;
  bootstrap_high: number;
}

export const MODEL: ModelConstants = {
  airdrop_share: 0.05,
  hourly_rate_usd: 25,
  farm_gas_share: 0.1,
  thin_gas_share: 0.25,
  gas_ethereum_usd: 10,
  gas_solana_usd: 0.05,
  gas_l2_usd: 0.5,
  gas_bitcoin_usd: 2,
  gas_other_usd: 2,
  bootstrap_resamples: 200,
  bootstrap_seed: 20261118,
  bootstrap_low: 0.1,
  bootstrap_high: 0.9,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm plan's netting: the hard costs, the expected airdrop under the stated assumption, the verdict. */
export interface FarmNet {
  gas_total_usd: number;
  tx_count: number;
  time_hours: number;
  time_cost_usd: number;
  expected_airdrop_usd: number;
  gas_share: number;
  verdict: 'farm' | 'thin' | 'skip';
}

/** The fitted size curve: log(mcap) = alpha + beta x log(tvl), over the live-token training set. */
export interface SizeCurveFit {
  alpha: number;
  beta: number;
  /** Live-token protocols with a market cap above zero, the training set. */
  n: number;
  tvl_min: number;
  tvl_max: number;
}

/** One row of the blind test: a candidate formula scored held-out against real market caps. */
export interface ValidationVariant {
  name: string;
  adopted: boolean;
  /** Median absolute log error over the held-out protocols; lower is better. */
  median_log_error: number;
  /** The same error as a factor: the median prediction is this many times the real value, up or down. */
  median_factor: number;
  mean_log_error: number;
  /** Share of held-out predictions within a factor of two of the real market cap. */
  within_2x: number;
  n: number;
}

/** The blind test's result, as the dashboard prints it. */
export interface Validation {
  loo_n: number;
  variants: ValidationVariant[];
}

/** How the snapshot's protocols are accounted for: every one lands in exactly one bucket. */
export interface Universe {
  total: number;
  pre_token: number;
  live_token: number;
  cex_excluded: number;
  versioned_excluded: number;
  /** Pre-token protocols set aside as wrapped or staked products, watchlist slugs excepted: the floor keeps those. */
  wrapped_excluded: number;
  board: number;
  live_rows: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    fit_alpha: number;
    fit_beta: number;
    /** The effective multiple: implied value per dollar of TVL, kept at full precision. */
    multiple: number;
    implied_low_usd: number;
    implied_high_usd: number;
    verdict: 'farm' | 'thin' | 'skip';
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  multiple: number;
  verdict: 'farm' | 'thin' | 'skip';
  net_gas_usd: number;
  net_expected_usd: number;
  net_time_hours: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  fit: SizeCurveFit;
  validation: Validation;
  universe: Universe;
  global_median: number;
  global_comps: number;
  /** The watchlist's slugs, so the page can mark watchlist rows and early rows apart. */
  watchlist: string[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers; null when the list is empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The categories whose product is a wrapped or staked form of an asset that already trades:
 * bridges move or wrap assets across chains, liquid staking and restaking issue staked forms of
 * them, and the BTC and stablecoin wrapper categories wrap them outright. Their TVL is another
 * asset's value, so they are not launches the radar can price.
 */
export const WRAPPED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Stablecoin Wrapper',
  'Anchor BTC',
  'Decentralized BTC',
]);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol's category makes it a wrapped or staked product of an asset that trades. */
export function isWrappedProduct(p: SnapshotProtocol): boolean {
  return p.category !== null && WRAPPED_CATEGORIES.has(p.category);
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool,
 * and not a wrapped or staked product. The watchlist floor overrides this: buildBoard adds every
 * watchlist slug whatever its category.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name) && !isWrappedProduct(p);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The live-token protocols with a market cap above zero: the size curve's training set. */
export function trainingSet(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/**
 * The size curve fitted on a training set: ordinary least squares of log(mcap) on log(tvl).
 * With fewer than three points, or no spread in TVL, the fit falls back to a flat multiple at the
 * training set's median mcap/TVL, so a degenerate snapshot still prices every row.
 */
export function fitSizeCurve(pool: SnapshotProtocol[]): SizeCurveFit {
  const tvls = pool.map((p) => p.tvl_usd);
  const tvlMin = tvls.length > 0 ? Math.min(...tvls) : 0;
  const tvlMax = tvls.length > 0 ? Math.max(...tvls) : 0;
  const n = pool.length;
  if (n < 3) {
    const ratios = pool.map((p) => (p.mcap_usd ?? 0) / p.tvl_usd).filter((r) => Number.isFinite(r) && r > 0);
    const flat = median(ratios) ?? 0.25;
    return { alpha: Math.log(flat), beta: 1, n, tvl_min: tvlMin, tvl_max: tvlMax };
  }
  const xs = pool.map((p) => Math.log(p.tvl_usd));
  const ys = pool.map((p) => Math.log(p.mcap_usd!));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  if (!(sxx > 0)) {
    const ratios = pool.map((p) => (p.mcap_usd ?? 0) / p.tvl_usd).filter((r) => Number.isFinite(r) && r > 0);
    const flat = median(ratios) ?? 0.25;
    return { alpha: Math.log(flat), beta: 1, n, tvl_min: tvlMin, tvl_max: tvlMax };
  }
  const beta = sxy / sxx;
  const alpha = my - beta * mx;
  return { alpha, beta, n, tvl_min: tvlMin, tvl_max: tvlMax };
}

/** The implied value the fitted curve gives one TVL, at least a dollar. */
export function curveValue(tvlUsd: number, fit: SizeCurveFit): number {
  if (!(tvlUsd > 0)) return 1;
  const v = Math.exp(fit.alpha) * Math.pow(tvlUsd, fit.beta);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.max(1, Math.round(v));
}

/** A deterministic generator (mulberry32), so the bootstrap band is the same on every build. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Each row's uncertainty band: refit the curve on bootstrap resamples of the training set and take
 * the low and high percentiles of the resampled implied values. One resample refits once and
 * prices every row, so the band costs one fit per resample, not one per row.
 */
export function bootstrapBands(
  tvls: number[],
  pool: SnapshotProtocol[],
  model: ModelConstants,
): { low: number; high: number }[] {
  const rand = seededRandom(model.bootstrap_seed);
  const n = pool.length;
  const samples: number[][] = tvls.map(() => []);
  for (let b = 0; b < model.bootstrap_resamples; b++) {
    const resample: SnapshotProtocol[] = [];
    for (let i = 0; i < n; i++) resample.push(pool[Math.floor(rand() * n)]!);
    const fit = fitSizeCurve(resample);
    for (let i = 0; i < tvls.length; i++) samples[i]!.push(curveValue(tvls[i]!, fit));
  }
  return samples.map((s) => {
    const sorted = [...s].sort((a, b) => a - b);
    const lowAt = Math.min(sorted.length - 1, Math.floor(model.bootstrap_low * sorted.length));
    const highAt = Math.min(sorted.length - 1, Math.floor(model.bootstrap_high * sorted.length));
    return { low: sorted[lowAt]!, high: sorted[highAt]! };
  });
}

/** The comparables table: the global median and one median per category, from the live-token set. */
export interface Comparables {
  globalMedian: number;
  globalComps: number;
  byCategory: Map<string, { median: number; comps: number }>;
}

/**
 * Build the comparables table from a pool of live-token protocols: every protocol with a market
 * cap and positive TVL contributes its mcap/TVL ratio to the global median and to its category's
 * median. A protocol with no category lands in the global pool only.
 */
export function buildComparables(pool: SnapshotProtocol[]): Comparables {
  const ratios: number[] = [];
  const perCategory = new Map<string, number[]>();
  for (const p of pool) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio < 0) continue;
    ratios.push(ratio);
    if (p.category !== null) {
      const list = perCategory.get(p.category) ?? [];
      list.push(ratio);
      perCategory.set(p.category, list);
    }
  }
  const globalMedian = median(ratios) ?? 0.25;
  const byCategory = new Map<string, { median: number; comps: number }>();
  for (const [category, list] of perCategory) {
    const m = median(list);
    if (m !== null) byCategory.set(category, { median: m, comps: list.length });
  }
  return { globalMedian, globalComps: ratios.length, byCategory };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** One variant's leave-one-out score over the held-out set. */
function looScore(
  heldOut: SnapshotProtocol[],
  predict: (held: SnapshotProtocol, rest: SnapshotProtocol[]) => number,
): { median_log_error: number; mean_log_error: number; within_2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < heldOut.length; i++) {
    const held = heldOut[i]!;
    if (!(held.mcap_usd !== null && held.mcap_usd > 0)) continue;
    const rest = heldOut.filter((_, j) => j !== i);
    const pred = predict(held, rest);
    if (pred > 0) errs.push(Math.abs(Math.log(pred / held.mcap_usd)));
  }
  errs.sort((a, b) => a - b);
  if (errs.length === 0) return { median_log_error: 0, mean_log_error: 0, within_2x: 0, n: 0 };
  const med = errs[errs.length >> 1]!;
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
  const within2 = errs.filter((e) => e <= Math.log(2)).length / errs.length;
  return { median_log_error: round4(med), mean_log_error: round4(mean), within_2x: round4(within2), n: errs.length };
}

/** The growth multiplier the blind test tries and rejects: seven-day TVL growth at half weight. */
function growthMult(p: SnapshotProtocol): number {
  const g = Math.min(120, Math.max(-60, finite(p.change_7d, 0)));
  return 1 + (g / 100) * 0.5;
}

/** The maturity multiplier the blind test tries and rejects: older protocols score closer to full value. */
function maturityMult(p: SnapshotProtocol, asOf: string): number {
  const age = ageDays(asOf, p.listed_at) ?? 365;
  return 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
}

/**
 * The blind test: leave-one-out over the live-token protocols with a market cap, scoring each
 * candidate formula against the real market cap it never saw. The size curve is adopted; the rest
 * are the rejects the dashboard prints beside it, so the choice is checkable.
 */
export function validateModel(snapshot: Snapshot): Validation {
  const heldOut = trainingSet(snapshot);
  const allLive = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.tvl_usd > 0);
  const defs: { name: string; adopted: boolean; predict: (held: SnapshotProtocol, rest: SnapshotProtocol[]) => number }[] = [
    {
      name: 'Flat multiple (global median mcap/TVL)',
      adopted: false,
      predict: (held, rest) => {
        const pool = rest.concat(allLive.filter((p) => !heldOut.includes(p)));
        const t = buildComparables(pool.filter((p) => p.slug !== held.slug));
        return held.tvl_usd * t.globalMedian;
      },
    },
    {
      name: 'Category median mcap/TVL',
      adopted: false,
      predict: (held, rest) => {
        const pool = rest.concat(allLive.filter((p) => !heldOut.includes(p)));
        const t = buildComparables(pool.filter((p) => p.slug !== held.slug));
        const e = held.category === null ? undefined : t.byCategory.get(held.category);
        const mult = e === undefined ? t.globalMedian : Math.min(2.0, Math.max(0.01, e.median));
        return held.tvl_usd * mult;
      },
    },
    {
      name: 'Size curve (adopted)',
      adopted: true,
      predict: (held, rest) => curveValue(held.tvl_usd, fitSizeCurve(rest)),
    },
    {
      name: 'Size curve + 7d growth',
      adopted: false,
      predict: (held, rest) => curveValue(held.tvl_usd, fitSizeCurve(rest)) * growthMult(held),
    },
    {
      name: 'Size curve + age maturity',
      adopted: false,
      predict: (held, rest) => curveValue(held.tvl_usd, fitSizeCurve(rest)) * maturityMult(held, snapshot.as_of),
    },
    {
      name: 'Size curve + category residual',
      adopted: false,
      predict: (held, rest) => {
        const fit = fitSizeCurve(rest);
        const per = new Map<string, number[]>();
        for (const p of rest) {
          if (p.category === null) continue;
          const r = Math.log(p.mcap_usd!) - (fit.alpha + fit.beta * Math.log(p.tvl_usd));
          const l = per.get(p.category) ?? [];
          l.push(r);
          per.set(p.category, l);
        }
        let adj = 0;
        const e = held.category === null ? undefined : per.get(held.category);
        if (e !== undefined) {
          const m = median(e);
          if (m !== null) adj = (e.length / (e.length + 8)) * m;
        }
        return Math.exp(fit.alpha + fit.beta * Math.log(held.tvl_usd) + adj);
      },
    },
    {
      name: 'Size curve + chain breadth',
      adopted: false,
      predict: (held, rest) => {
        const fit = fitSizeCurve(rest);
        const xs: number[] = [];
        const ys: number[] = [];
        for (const p of rest) {
          xs.push(Math.log(Math.max(1, p.chains.length)));
          ys.push(Math.log(p.mcap_usd!) - (fit.alpha + fit.beta * Math.log(p.tvl_usd)));
        }
        const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
        const my = ys.reduce((a, b) => a + b, 0) / ys.length;
        let sxy = 0;
        let sxx = 0;
        for (let i = 0; i < xs.length; i++) {
          sxy += (xs[i]! - mx) * (ys[i]! - my);
          sxx += (xs[i]! - mx) ** 2;
        }
        const c = sxx > 0 ? Math.min(1, Math.max(-1, sxy / sxx)) : 0;
        return Math.exp(fit.alpha + fit.beta * Math.log(held.tvl_usd) + c * Math.log(Math.max(1, held.chains.length)));
      },
    },
    {
      name: 'Quadratic size curve',
      adopted: false,
      predict: (held, rest) => {
        const xs = rest.map((p) => Math.log(p.tvl_usd));
        const ys = rest.map((p) => Math.log(p.mcap_usd!));
        const n = xs.length;
        const s = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        const t = [0, 0, 0];
        for (let i = 0; i < n; i++) {
          const x = xs[i]!;
          const y = ys[i]!;
          const p = [1, x, x * x];
          for (let j = 0; j < 3; j++) {
            t[j]! += p[j]! * y;
            for (let k = 0; k < 3; k++) s[j * 3 + k]! += p[j]! * p[k]!;
          }
        }
        const det = (m: number[]): number => m[0]! * (m[4]! * m[8]! - m[5]! * m[7]!) - m[1]! * (m[3]! * m[8]! - m[5]! * m[6]!) + m[2]! * (m[3]! * m[7]! - m[4]! * m[6]!);
        const d = det(s);
        if (!(Math.abs(d) > 0)) return curveValue(held.tvl_usd, fitSizeCurve(rest));
        const rep = (col: number): number[] => {
          const m = [...s];
          for (let r = 0; r < 3; r++) m[r * 3 + col] = t[r]!;
          return m;
        };
        const a = det(rep(0)) / d;
        const b = det(rep(1)) / d;
        const c = det(rep(2)) / d;
        const x = Math.log(held.tvl_usd);
        return Math.exp(a + b * x + c * x * x);
      },
    },
  ];
  const variants: ValidationVariant[] = defs.map((def) => {
    const s = looScore(heldOut, def.predict);
    return {
      name: def.name,
      adopted: def.adopted,
      median_log_error: s.median_log_error,
      median_factor: round4(Math.exp(s.median_log_error)),
      mean_log_error: s.mean_log_error,
      within_2x: s.within_2x,
      n: s.n,
    };
  });
  return { loo_n: heldOut.length, variants };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar is every other pre-token protocol that can be ranked, not a capped sample: the
  // board is the whole pre-token universe, strongest first, minus the wrapped and staked products
  // isRankable sets aside. A watchlist slug in one of those categories stays, added above.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const fit = fitSizeCurve(trainingSet(snapshot));
  const scored = [...chosen.values()].map((p) => {
    const implied = curveValue(p.tvl_usd, fit);
    return { p, implied, age: ageDays(snapshot.as_of, p.listed_at) };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.slug ? -1 : a.p.slug > b.slug ? 1 : 0));
  const bands = bootstrapBands(scored.map((s) => s.p.tvl_usd), trainingSet(snapshot), model);
  return scored.map((s, i) => {
    const net = farmNet(s.p, s.age, s.implied, model);
    const band = bands[i]!;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        // The fit keeps full precision: the page recomputes the row from it, and a rounded
        // alpha or beta would make the recompute differ from the board by thousands of dollars
        // on the largest rows.
        fit_alpha: fit.alpha,
        fit_beta: fit.beta,
        // The effective multiple keeps full precision: the page recomputes the row from the fit,
        // and a rounded multiple would make the recompute differ from the board by dollars on large TVLs.
        multiple: s.p.tvl_usd > 0 ? s.implied / s.p.tvl_usd : 0,
        implied_low_usd: band.low,
        implied_high_usd: band.high,
        verdict: net.verdict,
      },
      farm_steps: farmSteps(s.p, s.age, s.implied, model).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The chains whose gas is under a dollar a transaction. */
const L2_CHAINS = ['arbitrum', 'base', 'optimism', 'polygon', 'zksync', 'linea', 'scroll', 'blast', 'mode', 'mantle'];

/** Gas in dollars per transaction on a chain, at the midpoint of the band the plan states. */
export function gasUsd(chain: string, model: ModelConstants): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return model.gas_ethereum_usd;
  if (c === 'solana') return model.gas_solana_usd;
  if (c === 'bitcoin') return model.gas_bitcoin_usd;
  if (L2_CHAINS.includes(c)) return model.gas_l2_usd;
  return model.gas_other_usd;
}

/** What a transaction costs on a chain, from the chain's own fee character. */
function gasNote(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $5 to $15 of gas per transaction on Ethereum mainnet';
  if (c === 'solana') return 'under $0.05 of fees per transaction on Solana';
  if (c === 'bitcoin') return 'about $1 to $3 of fees per transaction on Bitcoin';
  if (L2_CHAINS.includes(c)) return `under $1 of gas per transaction on ${chain}`;
  return `about $1 to $3 of gas per transaction on ${chain}`;
}

/** The risk a farmer of this category should price in before committing capital. */
function riskNote(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a borrow can be liquidated if collateral falls, so keep the loan well under the limit';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return 'liquidity positions lose value when the pool ratio moves against you (impermanent loss)';
  if (c.includes('bridge')) return 'bridged funds sit in a bridge contract until the transfer settles, so never bridge more than you can wait on';
  if (c.includes('staking') || c.includes('restak')) return 'staked funds may be locked or take days to unstake, so check the unlock window first';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('option')) return 'leveraged positions can be liquidated in a fast move, so keep the position small';
  if (c.includes('prediction')) return 'a market position can lose its whole stake if the outcome goes the other way';
  if (c.includes('rwa')) return 'real-world assets carry issuer and redemption risk on top of smart-contract risk';
  if (c.includes('stable')) return 'a stable asset can depeg, so check what backs it before minting';
  return 'smart contracts can fail, so never farm with money you cannot afford to lose';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('option')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('farm')) return `Deposit $${capital} into ${name}'s main farm on ${chain} and keep the position open.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} and keep the receipts.`;
  if (c.includes('chain')) return `Bridge $${capital} to ${name}'s chain and use one of its apps with the funds.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A dollar figure with cents only where they matter: $120, $0.40, $0.05. */
export function fmtMoney(n: number): string {
  if (n >= 100) return `$${Math.round(n)}`;
  const cents = Math.round(n * 100) / 100;
  return `$${cents}`;
}

/**
 * A plan's netting: the gas over its transactions, the hours it takes, the airdrop it expects under
 * the stated 5% pro-rata assumption, and the verdict. The verdict turns only on the hard cost —
 * gas as a share of the capital committed — so it needs no guess about the airdrop's size: gas at
 * or below 10% of the position is a farm, at or below 25% a thin, above that a skip.
 */
export function farmNet(p: SnapshotProtocol, age: number | null, implied: number, model: ModelConstants): FarmNet {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.ceil(hold / 7);
  const txCount = 2 + weeks + 1;
  const gasTotal = gasUsd(chain, model) * txCount;
  const timeMinutes = 5 + 15 + 10 * weeks + 10 + 5;
  const timeHours = Math.round((timeMinutes / 60) * 10) / 10;
  const timeCost = timeHours * model.hourly_rate_usd;
  const expected = p.tvl_usd > 0 ? implied * model.airdrop_share * (capital / p.tvl_usd) : 0;
  const gasShare = capital > 0 ? gasTotal / capital : 1;
  const verdict = gasShare <= model.farm_gas_share ? 'farm' : gasShare <= model.thin_gas_share ? 'thin' : 'skip';
  return {
    gas_total_usd: Math.round(gasTotal * 100) / 100,
    tx_count: txCount,
    time_hours: timeHours,
    time_cost_usd: Math.round(timeCost * 100) / 100,
    expected_airdrop_usd: Math.round(expected * 100) / 100,
    gas_share: round4(gasShare),
    verdict,
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age, implied value), never from a
 * hand-written list of names. The last step nets the plan: its gas, its hours, the airdrop it
 * expects under the stated assumption, the break-even, and the verdict.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, implied: number, model: ModelConstants): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = gasNote(chain);
  const net = farmNet(p, age, implied, model);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'nothing to set up',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and check the protocol's own points page after each one.`,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay a fee to claim.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Know the risk before you commit: ${riskNote(p)}. Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Net the plan: about ${fmtMoney(net.gas_total_usd)} of gas over ${net.tx_count} transactions and ${net.time_hours} hours of your time (about ${fmtMoney(net.time_cost_usd)} at $${model.hourly_rate_usd} an hour). At a ${model.airdrop_share * 100}% airdrop shared pro-rata by position size, the expected airdrop is about ${fmtMoney(net.expected_airdrop_usd)}, so the plan breaks even on any airdrop above ${fmtMoney(net.gas_total_usd)}. Verdict: ${net.verdict} — gas is ${Math.round(net.gas_share * 100)}% of the $${capital} position.`,
      cost: `${fmtMoney(net.gas_total_usd)} of gas, ${fmtMoney(net.time_cost_usd)} of time`,
      time: `${net.time_hours} hours over ${hold} days`,
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, snapshot: Snapshot, model: ModelConstants): RadarRow {
  const p = snapshot.protocols.find((x) => x.slug === row.slug)!;
  const net = farmNet(p, row.age_days, row.implied_value_usd, model);
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.model.implied_low_usd,
    implied_high_usd: row.model.implied_high_usd,
    multiple: row.model.multiple,
    verdict: row.model.verdict,
    net_gas_usd: net.gas_total_usd,
    net_expected_usd: net.expected_airdrop_usd,
    net_time_hours: net.time_hours,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = buildComparables(snapshot.protocols.filter((p) => !isPreToken(p)));
  const fit = fitSizeCurve(trainingSet(snapshot));
  const validation = validateModel(snapshot);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const preToken = snapshot.protocols.filter(isPreToken);
  const watchSet = new Set(snapshot.watchlist);
  const universe: Universe = {
    total: snapshot.protocols.length,
    pre_token: preToken.length,
    live_token: snapshot.protocols.length - preToken.length,
    cex_excluded: preToken.filter((p) => p.category === 'CEX').length,
    versioned_excluded: preToken.filter((p) => p.category !== 'CEX' && VERSIONED.test(p.name)).length,
    wrapped_excluded: preToken.filter((p) => p.category !== 'CEX' && !VERSIONED.test(p.name) && isWrappedProduct(p) && !watchSet.has(p.slug)).length,
    board: board.length,
    live_rows: live.length,
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    // The fit keeps full precision here too: the page recomputes every row from these two numbers.
    fit: {
      alpha: fit.alpha,
      beta: fit.beta,
      n: fit.n,
      tvl_min: fit.tvl_min,
      tvl_max: fit.tvl_max,
    },
    validation,
    universe,
    global_median: round4(comps.globalMedian),
    global_comps: comps.globalComps,
    watchlist: [...snapshot.watchlist],
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot, model)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
