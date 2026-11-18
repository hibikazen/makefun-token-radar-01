// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a searchable, filterable, sortable table, a per-protocol detail view
// with the model's own breakdown and the protocol's netted farm plan, and the live-token set kept
// apart. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var WATCH = {};
  (DATA.watchlist || []).forEach(function (slug) { WATCH[slug] = true; });

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(3) + 'x';
  }
  function fmtFactor(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(2) + 'x';
  }
  // A dollar figure with cents only where they matter: $120, $0.40, $0.05.
  function fmtMoney(n) {
    if (n >= 100) return '$' + Math.round(n);
    return '$' + (Math.round(n * 100) / 100);
  }
  function round4(n) { return Math.round(n * 1e4) / 1e4; }
  // The model in one function: the page recomputes a row from the fitted size curve and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row, fit) {
    if (!(row.tvl_usd > 0)) return 1;
    var v = Math.exp(fit.alpha) * Math.pow(row.tvl_usd, fit.beta);
    if (!isFinite(v) || v <= 0) return 1;
    return Math.max(1, Math.round(v));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL, age
  // and implied value decide the action, the capital, the hold, the gas note, the risk note and
  // the netting, and every step carries its cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  var L2_CHAINS = ['arbitrum', 'base', 'optimism', 'polygon', 'zksync', 'linea', 'scroll', 'blast', 'mode', 'mantle'];
  function gasUsd(chain, model) {
    var c = chain.toLowerCase();
    if (c === 'ethereum') return model.gas_ethereum_usd;
    if (c === 'solana') return model.gas_solana_usd;
    if (c === 'bitcoin') return model.gas_bitcoin_usd;
    if (L2_CHAINS.indexOf(c) >= 0) return model.gas_l2_usd;
    return model.gas_other_usd;
  }
  function gasNote(chain) {
    var c = chain.toLowerCase();
    if (c === 'ethereum') return 'about $5 to $15 of gas per transaction on Ethereum mainnet';
    if (c === 'solana') return 'under $0.05 of fees per transaction on Solana';
    if (c === 'bitcoin') return 'about $1 to $3 of fees per transaction on Bitcoin';
    if (L2_CHAINS.indexOf(c) >= 0) return 'under $1 of gas per transaction on ' + chain;
    return 'about $1 to $3 of gas per transaction on ' + chain;
  }
  function riskNote(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'a borrow can be liquidated if collateral falls, so keep the loan well under the limit';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'liquidity positions lose value when the pool ratio moves against you (impermanent loss)';
    if (c.indexOf('bridge') >= 0) return 'bridged funds sit in a bridge contract until the transfer settles, so never bridge more than you can wait on';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'staked funds may be locked or take days to unstake, so check the unlock window first';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('option') >= 0) return 'leveraged positions can be liquidated in a fast move, so keep the position small';
    if (c.indexOf('prediction') >= 0) return 'a market position can lose its whole stake if the outcome goes the other way';
    if (c.indexOf('rwa') >= 0) return 'real-world assets carry issuer and redemption risk on top of smart-contract risk';
    if (c.indexOf('stable') >= 0) return 'a stable asset can depeg, so check what backs it before minting';
    return 'smart contracts can fail, so never farm with money you cannot afford to lose';
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('option') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('farm') >= 0) return 'Deposit $' + capital + " into " + name + "'s main farm on " + chain + ' and keep the position open.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of payments through ' + name + ' on ' + chain + ' and keep the receipts.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' to ' + name + "'s chain and use one of its apps with the funds.";
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmNet(p, implied, model) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var weeks = Math.ceil(hold / 7);
    var txCount = 2 + weeks + 1;
    var gasTotal = gasUsd(chain, model) * txCount;
    var timeMinutes = 5 + 15 + 10 * weeks + 10 + 5;
    var timeHours = Math.round((timeMinutes / 60) * 10) / 10;
    var timeCost = timeHours * model.hourly_rate_usd;
    var expected = p.tvl_usd > 0 ? implied * model.airdrop_share * (capital / p.tvl_usd) : 0;
    var gasShare = capital > 0 ? gasTotal / capital : 1;
    var verdict = gasShare <= model.farm_gas_share ? 'farm' : gasShare <= model.thin_gas_share ? 'thin' : 'skip';
    return {
      gas_total_usd: Math.round(gasTotal * 100) / 100,
      tx_count: txCount,
      time_hours: timeHours,
      time_cost_usd: Math.round(timeCost * 100) / 100,
      expected_airdrop_usd: Math.round(expected * 100) / 100,
      gas_share: round4(gasShare),
      verdict: verdict
    };
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasNote(chain);
    var model = DATA.model;
    var net = farmNet(p, p.implied_value_usd, model);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'nothing to set up', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
      { text: "Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and check the protocol's own points page after each one.", cost: gas + ' a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay a fee to claim.", cost: 'no fee to check', time: '10 minutes' },
      { text: 'Know the risk before you commit: ' + riskNote(p) + '. Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' },
      { text: 'Net the plan: about ' + fmtMoney(net.gas_total_usd) + ' of gas over ' + net.tx_count + ' transactions and ' + net.time_hours + ' hours of your time (about ' + fmtMoney(net.time_cost_usd) + ' at $' + model.hourly_rate_usd + ' an hour). At a ' + (model.airdrop_share * 100) + '% airdrop shared pro-rata by position size, the expected airdrop is about ' + fmtMoney(net.expected_airdrop_usd) + ', so the plan breaks even on any airdrop above ' + fmtMoney(net.gas_total_usd) + '. Verdict: ' + net.verdict + ' — gas is ' + Math.round(net.gas_share * 100) + '% of the $' + capital + ' position.', cost: fmtMoney(net.gas_total_usd) + ' of gas, ' + fmtMoney(net.time_cost_usd) + ' of time', time: net.time_hours + ' hours over ' + hold + ' days' }
    ].map(stepText);
  }

  function adoptedVariant() {
    var vs = DATA.validation && DATA.validation.variants ? DATA.validation.variants : [];
    for (var i = 0; i < vs.length; i++) if (vs[i].adopted) return vs[i];
    return null;
  }
  function verdictCounts() {
    var counts = { farm: 0, thin: 0, skip: 0 };
    DATA.rows.forEach(function (r) { if (counts[r.verdict] !== undefined) counts[r.verdict]++; });
    return counts;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab') === 'live') state.tab = 'live';
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.multiple; bv = b.multiple; }
      else if (key === 'verdict') { var order = { farm: 0, thin: 1, skip: 2 }; av = order[a.verdict]; bv = order[b.verdict]; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var v = adoptedVariant();
    var vc = verdictCounts();
    var u = DATA.universe;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.board_size + ' pre-token protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: all ' + DATA.watchlist_size + ' of its protocols, plus every other pre-token protocol that is not an exchange, a versioned pool, or a wrapped or staked product of an asset that trades. Each is priced on a size curve fitted to the ' + DATA.fit.n + ' tokens that already trade, and tested blind before it is trusted. Implied value is a model, not a promise.' }),
        el('p', { text: 'Every protocol in the snapshot is accounted for: ' + u.total + ' in all, ' + u.pre_token + ' pre-token and ' + u.live_token + ' live-token. Of the pre-token set, ' + u.cex_excluded + ' are exchanges, ' + u.versioned_excluded + ' are versioned pools and ' + u.wrapped_excluded + ' are wrapped or staked products, set aside; the remaining ' + u.board + ' are the board.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Size curve exponent' }), el('b', { text: 'beta ' + DATA.fit.beta.toFixed(3) + ' on ' + DATA.fit.n + ' tokens' })),
        el('div', { class: 'fact' }, el('span', { text: 'Blind-test median error' }), el('b', { text: v ? fmtFactor(v.median_factor) : 'n/a' })),
        el('div', { class: 'fact' }, el('span', { text: 'Blind test within 2x' }), el('b', { text: v ? Math.round(v.within_2x * 100) + '% of ' + v.n : 'n/a' })),
        el('div', { class: 'fact' }, el('span', { text: 'Farm verdicts' }), el('b', { text: vc.farm + ' farm / ' + vc.thin + ' thin / ' + vc.skip + ' skip' })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chainCounts = {};
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { chainCounts[c] = (chainCounts[c] || 0) + 1; }); });
    var chains = Object.keys(chainCounts).sort(function (a, b) { return chainCounts[b] - chainCounts[a]; }).slice(0, 12);
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c + ' (' + chainCounts[c] + ')', selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function verdictBadge(v) {
    return el('span', { class: 'verdict ' + v, text: v });
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('span', null, el('b', { text: r.name }), WATCH[r.slug] ? el('span', { class: 'watch', text: 'watchlist' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.multiple) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, verdictBadge(r.verdict))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan. The verdict nets the farm plan: farm where gas stays under 10% of the position, thin under 25%, skip above it.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Rank' }),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Multiple'),
            sortHeader('implied', 'Implied value'),
            sortHeader('verdict', 'Verdict')
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_usd !== null && r.tvl_usd > 0 ? fmtMult(r.mcap_usd / r.tvl_usd) : 'n/a' }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking, and they are the training set the size curve is fitted on and blind-tested against.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var fit = DATA.fit;
    var vs = DATA.validation && DATA.validation.variants ? DATA.validation.variants : [];
    var vbody = el('tbody');
    vs.forEach(function (v) {
      vbody.appendChild(el('tr', null,
        el('td', null, el('b', { text: v.name }), v.adopted ? el('span', { class: 'watch', text: 'adopted' }) : null),
        el('td', { class: 'num', text: fmtFactor(v.median_factor) }),
        el('td', { class: 'num', text: v.median_log_error.toFixed(4) }),
        el('td', { class: 'num', text: Math.round(v.within_2x * 100) + '%' })
      ));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'log(mcap) = ' + fit.alpha.toFixed(4) + ' + ' + fit.beta.toFixed(4) + ' x log(tvl), fitted on the ' + fit.n + ' live-token protocols with a market cap\n' +
        'implied = round( exp(' + fit.alpha.toFixed(4) + ') x tvl_usd ^ ' + fit.beta.toFixed(4) + ' )'
      ),
      el('div', { class: 'model-grid' },
        el('div', { class: 'model-cell' },
          el('b', { text: 'A size curve, not a flat multiple' }),
          el('span', { text: 'Market cap grows with TVL to a power well below one (beta ' + fit.beta.toFixed(3) + '), so a flat multiple overprices the large and underprices the small. The curve is fitted on this snapshot\'s own ' + fit.n + ' traded tokens, and it re-fits on any snapshot it is handed.' })
        ),
        el('div', { class: 'model-cell' },
          el('b', { text: 'Tested blind before it is trusted' }),
          el('span', { text: 'Each traded token is held out in turn, the curve is refitted without it, and the prediction is scored against its real market cap. The adopted curve\'s median error is ' + (adoptedVariant() ? fmtFactor(adoptedVariant().median_factor) : 'n/a') + ', with ' + (adoptedVariant() ? Math.round(adoptedVariant().within_2x * 100) + '%' : 'n/a') + ' of predictions within twice the real value. Every extra term tried against it scored worse, so none is in the formula.' })
        ),
        el('div', { class: 'model-cell' },
          el('b', { text: 'Coverage, and what is set aside' }),
          el('span', { text: 'The board covers all ' + DATA.watchlist_size + ' watchlist protocols and every other rankable pre-token protocol: ' + DATA.board_size + ' rows. Exchanges, versioned pools and wrapped or staked products are set aside, because their TVL is another asset\'s value; the watchlist floor keeps any watchlist protocol whatever its category.' })
        )
      ),
      el('h3', { text: 'The blind test, leave-one-out over ' + DATA.validation.loo_n + ' traded tokens' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'ablation' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Candidate formula' }),
            el('th', { scope: 'col', text: 'Median error' }),
            el('th', { scope: 'col', text: 'Median log error' }),
            el('th', { scope: 'col', text: 'Within 2x' })
          )),
          vbody
        )
      ),
      el('p', { class: 'sub', text: 'Median error is the factor by which the median held-out prediction misses the real market cap, up or down. Each row\'s band in the detail view comes from refitting the curve on ' + m.bootstrap_resamples + ' bootstrap resamples of the training set and taking the 10th and 90th percentiles. Farm plans are netted at ' + (m.airdrop_share * 100) + '% of supply shared pro-rata by position size, time at $' + m.hourly_rate_usd + ' an hour, gas at $' + m.gas_ethereum_usd + ' per Ethereum transaction, $' + m.gas_l2_usd + ' per L2 transaction and $' + m.gas_solana_usd + ' per Solana transaction.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.fit);
    var fit = DATA.fit;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (WATCH[row.slug] ? ' - watchlist' : ' - early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Size curve' }), el('b', { class: 'num', text: 'log(mcap) = ' + fit.alpha.toFixed(3) + ' + ' + fit.beta.toFixed(3) + ' x log(tvl)' })),
        el('div', null, el('span', { text: 'Effective multiple' }), el('b', { class: 'num', text: fmtMult(row.multiple) })),
        el('div', null, el('span', { text: 'Bootstrap band (10th-90th)' }), el('b', { class: 'num', text: fmtUsd(row.implied_low_usd) + ' - ' + fmtUsd(row.implied_high_usd) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Seven-day growth ' + fmtPct(row.change_7d) + ' and age ' + fmtAge(row.age_days) + ' are shown for context; the blind test found neither improves the prediction, so neither is in the formula. Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('div', { class: 'net-line' }, verdictBadge(row.verdict),
        el('span', { class: 'sub', text: 'about ' + fmtMoney(row.net_gas_usd) + ' of gas, ' + row.net_time_hours + ' hours of time, expected airdrop about ' + fmtMoney(row.net_expected_usd) + ' at a ' + (DATA.model.airdrop_share * 100) + '% pro-rata airdrop' })
      ),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
    // Pressing / anywhere (outside a field) jumps to the search box.
    if (e.key === '/' && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement ? document.activeElement.tagName : '')) {
      e.preventDefault();
      var q = document.getElementById('q');
      if (q) q.focus();
    }
  });
})();

