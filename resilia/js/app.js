/*! Resilia 1.0.0 — Financial Survival & Growth App. Built 2026-10-08T19:16:16.991Z */
/* ==== shared/FinCalc.js ==== */
/**
 * Resilia — FinCalc
 * -----------------------------------------------------------------------------
 * Shared, pure calculation engine. NO DOM, NO Apps Script APIs.
 * The same file is built into:
 *   - Calc.gs        (server: analytics.summary, verification)
 *   - JS.html/app.js (client: dashboard works fully offline)
 *
 * All money values are plain numbers in the user's currency.
 * All dates are 'yyyy-MM-dd' strings, months are 'yyyy-MM' strings.
 * Percent inputs in the profile are stored as percent numbers (8 = 8%).
 */
var FinCalc = (function () {
  'use strict';

  var DEFAULT_PROFILE = {
    MonthlyEssentialExpense: 0,          // 0 = estimate from Essential categories
    MonthlyLifestyleExpense: 0,
    ExpectedIncomeGrowth: 5,
    ExpectedInvestmentReturn: 8,
    InflationRate: 4,
    RetirementAge: 55,
    CurrentAge: 30,
    DesiredRetirementMonthlyExpense: 0,  // 0 = use current monthly expense
    EmergencyFundTargetMonths: 6,
    MonthlyInvestment: 0,
    CurrentInvestment: '',               // '' = auto (investable accounts + assets)
    WithdrawalRate: 4,
    SavingsRateTarget: 20,
    HighCostDebtRate: 12
  };

  var LIQUID_ACCOUNT_TYPES = { CASH: 1, BANK: 1, E_WALLET: 1 };
  var INVESTABLE_ASSET_TYPES = { GOLD: 1, STOCK: 1, CRYPTO: 1 };

  var LEVELS = [
    { level: 1, key: 'SURVIVE', name: 'SURVIVE', desc: 'Pemasukan baru cukup (atau belum cukup) menutup pengeluaran.' },
    { level: 2, key: 'STABLE', name: 'STABLE', desc: 'Cash flow positif — ada sisa setiap bulan.' },
    { level: 3, key: 'SECURE', name: 'SECURE', desc: 'Dana darurat memadai dan utang terkendali.' },
    { level: 4, key: 'GROW', name: 'GROW', desc: 'Aset dan kekayaan bersih bertumbuh konsisten.' },
    { level: 5, key: 'FI', name: 'FINANCIAL INDEPENDENCE', desc: 'Hasil portofolio dapat menutup pengeluaran.' }
  ];

  // ---------------------------------------------------------------------------
  // Primitive helpers
  // ---------------------------------------------------------------------------
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v === null || v === undefined || v === '') return 0;
    var n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  }
  function bool(v, dflt) {
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    if (v === null || v === undefined || v === '') return !!dflt;
    var s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function sum(arr, fn) { var s = 0; for (var i = 0; i < arr.length; i++) s += fn ? fn(arr[i]) : arr[i]; return s; }
  function round(x, d) { var f = Math.pow(10, d || 0); return Math.round(x * f) / f; }
  /** Piecewise-linear interpolation; points = [[x,y],...] sorted by x, clamped at both ends. */
  function pw(x, points) {
    if (x <= points[0][0]) return points[0][1];
    for (var i = 1; i < points.length; i++) {
      if (x <= points[i][0]) {
        var a = points[i - 1], b = points[i];
        return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      }
    }
    return points[points.length - 1][1];
  }

  // ---------------------------------------------------------------------------
  // Date helpers — string based, timezone-safe (never uses local Date parsing)
  // ---------------------------------------------------------------------------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) {
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  }
  function parts(s) { var p = String(s).slice(0, 10).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function monthKey(s) { return String(s).slice(0, 7); }
  function addMonths(mk, n) {
    var y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function monthStart(mk) { return mk + '-01'; }
  function monthEnd(mk) { var p = parts(mk + '-01'); return ymd(p.y, p.m + 1, 0); }
  function addDays(s, n) { var p = parts(s); return ymd(p.y, p.m, p.d + n); }
  function dayOfWeek(s) { var p = parts(s); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  function weekStart(s) { var dow = dayOfWeek(s); return addDays(s, dow === 0 ? -6 : 1 - dow); } // Monday
  /** Fractional months from a to b (b later => positive). */
  function monthsBetween(a, b) {
    var pa = parts(a), pb = parts(b);
    return (pb.y - pa.y) * 12 + (pb.m - pa.m) + (pb.d - pa.d) / 30;
  }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

  // ---------------------------------------------------------------------------
  // Default money formatter (client passes an Intl-based one)
  // ---------------------------------------------------------------------------
  function defaultMoney(v, currency) {
    var neg = v < 0, s = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var c = (currency || 'IDR') === 'IDR' ? 'Rp' : (currency + ' ');
    return (neg ? '-' : '') + c + s;
  }
  function pct(v, d) { return (v === null || v === undefined || !isFinite(v)) ? '–' : (round(v, d === undefined ? 1 : d) + '%').replace('.', ','); }
  function months(v) { return (v === null || !isFinite(v)) ? '–' : (round(v, 1) + '').replace('.', ',') + ' bulan'; }

  // ---------------------------------------------------------------------------
  // Data preparation
  // ---------------------------------------------------------------------------
  function alive(arr) {
    var out = [];
    (arr || []).forEach(function (r) { if (r && !bool(r.Deleted, false)) out.push(r); });
    return out;
  }
  function profileOf(data) {
    var p = {}, src = alive(data.profile)[0] || {};
    Object.keys(DEFAULT_PROFILE).forEach(function (k) {
      var v = src[k];
      if (k === 'CurrentInvestment') { p[k] = (v === '' || v === null || v === undefined) ? '' : num(v); return; }
      p[k] = (v === '' || v === null || v === undefined) ? DEFAULT_PROFILE[k] : num(v);
    });
    return p;
  }
  function prepare(data) {
    return {
      transactions: alive(data.transactions).filter(function (t) { return validDate(t.Date); }),
      categories: alive(data.categories),
      accounts: alive(data.accounts),
      assets: alive(data.assets),
      liabilities: alive(data.liabilities),
      goals: alive(data.goals),
      budgets: alive(data.budgets),
      snapshots: alive(data.snapshots),
      profile: profileOf(data),
      currency: ((alive(data.users)[0] || {}).Currency) || 'IDR'
    };
  }

  // ---------------------------------------------------------------------------
  // Cash flow
  // ---------------------------------------------------------------------------
  /** Income/expense between start and end inclusive ('yyyy-MM-dd'). TRANSFER excluded. */
  function cashflow(txs, start, end) {
    var r = { income: 0, expense: 0, net: 0, savingsRate: null, count: 0, expenseByCategory: {}, incomeByCategory: {} };
    for (var i = 0; i < txs.length; i++) {
      var t = txs[i], d = String(t.Date).slice(0, 10);
      if (d < start || d > end) continue;
      var a = Math.abs(num(t.Amount)), c = t.CategoryID || '_none';
      if (t.Type === 'INCOME') { r.income += a; r.incomeByCategory[c] = (r.incomeByCategory[c] || 0) + a; r.count++; }
      else if (t.Type === 'EXPENSE') { r.expense += a; r.expenseByCategory[c] = (r.expenseByCategory[c] || 0) + a; r.count++; }
    }
    r.net = r.income - r.expense;
    r.savingsRate = r.income > 0 ? r.net / r.income * 100 : null;
    return r;
  }
  function monthCashflow(txs, mk) { return cashflow(txs, monthStart(mk), monthEnd(mk)); }
  /** n months ending at endMonth (inclusive), oldest first. */
  function monthlySeries(txs, endMonth, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var mk = addMonths(endMonth, -i), c = monthCashflow(txs, mk);
      out.push({ month: mk, income: c.income, expense: c.expense, net: c.net, savingsRate: c.savingsRate, count: c.count });
    }
    return out;
  }
  /**
   * Monthly averages from the last `n` complete months that contain data (searching 12 months back).
   * Falls back to the current month-to-date if no complete month has data.
   */
  function trailing(txs, today, n) {
    n = n || 3;
    var cur = monthKey(today), picked = [];
    for (var i = 1; i <= 12 && picked.length < n; i++) {
      var mk = addMonths(cur, -i), c = monthCashflow(txs, mk);
      if (c.count > 0) { c.month = mk; picked.push(c); }
    }
    var basis = picked.length ? (picked.length + ' bulan penuh terakhir') : 'bulan berjalan';
    if (!picked.length) {
      var mtd = cashflow(txs, monthStart(cur), today);
      if (mtd.count > 0) { mtd.month = cur; picked.push(mtd); } else basis = 'none';
    }
    var k = picked.length || 1;
    var inc = sum(picked, function (c) { return c.income; }) / k;
    var exp = sum(picked, function (c) { return c.expense; }) / k;
    var expByCat = {};
    picked.forEach(function (c) { Object.keys(c.expenseByCategory).forEach(function (id) { expByCat[id] = (expByCat[id] || 0) + c.expenseByCategory[id] / k; }); });
    return {
      months: picked.map(function (c) { return c.month; }), basis: basis, hasData: picked.length > 0,
      avgIncome: inc, avgExpense: exp, avgNet: inc - exp,
      savingsRate: inc > 0 ? (inc - exp) / inc * 100 : null, expenseByCategory: expByCat
    };
  }

  // ---------------------------------------------------------------------------
  // Balances, assets & net worth
  // ---------------------------------------------------------------------------
  function accountBalances(accounts, txs) {
    var bal = {};
    accounts.forEach(function (a) { bal[a.AccountID] = num(a.InitialBalance); });
    txs.forEach(function (t) {
      var a = Math.abs(num(t.Amount));
      if (t.Type === 'INCOME' && t.AccountID in bal) bal[t.AccountID] += a;
      else if (t.Type === 'EXPENSE' && t.AccountID in bal) bal[t.AccountID] -= a;
      else if (t.Type === 'TRANSFER') {
        if (t.AccountID in bal) bal[t.AccountID] -= a;
        if (t.ToAccountID in bal) bal[t.ToAccountID] += a;
      }
    });
    return bal;
  }

  function balanceSheet(d) {
    var bal = accountBalances(d.accounts, d.transactions);
    var active = d.accounts.filter(function (a) { return bool(a.Active, true); });
    var liquid = 0, investableAuto = 0, accTotal = 0, alloc = {};
    function add(type, v) { alloc[type] = (alloc[type] || 0) + v; }
    active.forEach(function (a) {
      var b = bal[a.AccountID] || 0; accTotal += b;
      if (LIQUID_ACCOUNT_TYPES[a.Type]) { liquid += b; add(a.Type === 'CASH' ? 'CASH' : (a.Type === 'BANK' ? 'BANK' : 'E_WALLET'), b); }
      else if (a.Type === 'INVESTMENT') { investableAuto += b; add('INVESTMENT', b); }
      else add('OTHER', b);
    });
    var assetTotal = 0;
    d.assets.forEach(function (x) {
      var v = num(x.CurrentValue); assetTotal += v; add(x.Type || 'OTHER', v);
      if (x.Type === 'CASH') liquid += v;
      if (INVESTABLE_ASSET_TYPES[x.Type]) investableAuto += v;
    });
    var totalAssets = accTotal + assetTotal;
    var totalLiabilities = sum(d.liabilities, function (l) { return Math.max(0, num(l.Outstanding)); });
    var investable = d.profile.CurrentInvestment === '' ? investableAuto : d.profile.CurrentInvestment;
    var purchase = sum(d.assets, function (x) { return num(x.PurchaseValue); });
    return {
      balances: bal, liquid: liquid, investable: investable, investableAuto: investableAuto,
      investableIsOverride: d.profile.CurrentInvestment !== '',
      totalAssets: totalAssets, totalLiabilities: totalLiabilities, netWorth: totalAssets - totalLiabilities,
      allocation: alloc, accountsTotal: accTotal, assetsTotal: assetTotal,
      assetGain: assetTotal - purchase, assetGainPct: purchase > 0 ? (assetTotal - purchase) / purchase * 100 : null
    };
  }

  /** Snapshots deduped per month (latest UpdatedAt wins), oldest first. */
  function snapshotSeries(snaps) {
    var byMonth = {};
    snaps.forEach(function (s) {
      if (!validDate(s.Date)) return;
      var mk = monthKey(s.Date), cur = byMonth[mk];
      if (!cur || String(s.UpdatedAt || '') > String(cur.UpdatedAt || '')) byMonth[mk] = s;
    });
    return Object.keys(byMonth).sort().map(function (mk) {
      var s = byMonth[mk];
      return { month: mk, date: s.Date, netWorth: num(s.NetWorth), totalAssets: num(s.TotalAssets), totalLiabilities: num(s.TotalLiabilities),
        income: num(s.MonthlyIncome), expense: num(s.MonthlyExpense), savingsRate: num(s.SavingsRate),
        efMonths: num(s.EmergencyFundMonths), score: num(s.FinancialHealthScore) };
    });
  }

  function netWorthTrend(series, today, bs) {
    var cur = monthKey(today);
    var hist = series.filter(function (s) { return s.month < cur; });
    var points = hist.map(function (s) { return { month: s.month, netWorth: s.netWorth, totalAssets: s.totalAssets }; });
    points.push({ month: cur, netWorth: bs.netWorth, totalAssets: bs.totalAssets });
    var last = hist.length ? hist[hist.length - 1] : null;
    function growthFrom(ref, key) {
      if (!ref) return null; var base = ref[key];
      if (base === 0) return null;
      return ((key === 'netWorth' ? bs.netWorth : bs.totalAssets) - base) / Math.abs(base) * 100;
    }
    // reference ~3 months back (earliest snapshot within the last 3 months)
    var ref3 = null;
    for (var i = 0; i < hist.length; i++) { if (hist[i].month >= addMonths(cur, -3)) { ref3 = hist[i]; break; } }
    var rising = hist.length >= 2 && bs.netWorth > hist[hist.length - 1].netWorth && hist[hist.length - 1].netWorth >= hist[hist.length - 2].netWorth;
    return {
      points: points, lastMonth: last ? last.netWorth : null, lastMonthKey: last ? last.month : null,
      growthPct: growthFrom(last, 'netWorth'), growthAbs: last ? bs.netWorth - last.netWorth : null,
      growth3Pct: growthFrom(ref3, 'netWorth'), assetGrowth3Pct: growthFrom(ref3, 'totalAssets'),
      risingTwoMonths: rising, historyMonths: hist.length
    };
  }

  // ---------------------------------------------------------------------------
  // Emergency fund
  // ---------------------------------------------------------------------------
  function essentialExpense(d, tr) {
    if (d.profile.MonthlyEssentialExpense > 0) return { value: d.profile.MonthlyEssentialExpense, basis: 'profil' };
    var ess = {};
    d.categories.forEach(function (c) { if (c.Type === 'EXPENSE' && bool(c.Essential, false)) ess[c.CategoryID] = 1; });
    var v = 0;
    Object.keys(tr.expenseByCategory).forEach(function (id) { if (ess[id]) v += tr.expenseByCategory[id]; });
    if (v > 0) return { value: v, basis: 'kategori esensial (' + tr.basis + ')' };
    if (tr.avgExpense > 0) return { value: tr.avgExpense, basis: 'semua pengeluaran (' + tr.basis + ')' };
    return { value: 0, basis: 'none' };
  }
  function efStatus(m) {
    if (m === null) return { color: 'gray', label: 'Belum ada data', emoji: '⚪' };
    if (m < 1) return { color: 'red', label: 'Kritis', emoji: '🔴' };
    if (m < 3) return { color: 'orange', label: 'Rentan', emoji: '🟠' };
    if (m < 6) return { color: 'yellow', label: 'Cukup', emoji: '🟡' };
    return { color: 'green', label: 'Aman', emoji: '🟢' };
  }
  function emergencyFund(d, bs, ess) {
    var m = ess.value > 0 ? bs.liquid / ess.value : null;
    var target = d.profile.EmergencyFundTargetMonths || 6;
    var targetAmount = target * ess.value;
    var gap = Math.max(0, targetAmount - bs.liquid);
    return {
      months: m, target: target, liquid: bs.liquid, essential: ess.value, essentialBasis: ess.basis,
      targetAmount: targetAmount, gap: gap, monthlyFor12: gap / 12, monthlyFor6: gap / 6,
      progress: m === null ? 0 : clamp(m / target, 0, 1), status: efStatus(m)
    };
  }

  // ---------------------------------------------------------------------------
  // Debt
  // ---------------------------------------------------------------------------
  /** Months to pay off with fixed payment at annual rate (%). null = never (payment <= interest). */
  function payoffMonths(balance, ratePct, payment) {
    if (balance <= 0) return 0;
    if (payment <= 0) return null;
    var r = ratePct / 100 / 12;
    if (r === 0) return Math.ceil(balance / payment);
    if (payment <= balance * r) return null;
    return Math.ceil(-Math.log(1 - r * balance / payment) / Math.log(1 + r));
  }
  function dtiStatus(v) {
    if (v === null) return { color: 'gray', label: 'Belum ada data income' };
    if (v <= 20) return { color: 'green', label: 'Sehat' };
    if (v <= 35) return { color: 'yellow', label: 'Waspada' };
    if (v <= 50) return { color: 'orange', label: 'Tinggi' };
    return { color: 'red', label: 'Kritis' };
  }
  function debt(d, tr) {
    var active = d.liabilities.filter(function (l) { return num(l.Outstanding) > 0; });
    var total = sum(active, function (l) { return num(l.Outstanding); });
    var payment = sum(active, function (l) { return num(l.MinimumPayment); });
    var dti = tr.avgIncome > 0 ? payment / tr.avgIncome * 100 : (payment > 0 ? null : 0);
    var thr = d.profile.HighCostDebtRate;
    var items = active.map(function (l) {
      var rate = num(l.InterestRate);
      return { id: l.DebtID, name: l.Name, type: l.Type, outstanding: num(l.Outstanding), principal: num(l.Principal),
        rate: rate, payment: num(l.MinimumPayment), dueDate: l.DueDate, highCost: rate >= thr,
        payoffMonths: payoffMonths(num(l.Outstanding), rate, num(l.MinimumPayment)),
        paidPct: num(l.Principal) > 0 ? clamp(1 - num(l.Outstanding) / num(l.Principal), 0, 1) : null };
    }).sort(function (a, b) { return b.rate - a.rate || a.outstanding - b.outstanding; }); // avalanche order
    var highCost = items.filter(function (x) { return x.highCost; });
    var recs = [];
    if (dti !== null && dti > 35) recs.push('DTI di atas 35%: hindari utang baru dan prioritaskan pelunasan.');
    if (dti === null) recs.push('Ada cicilan tetapi belum ada pemasukan tercatat — catat pemasukan agar DTI bisa dihitung.');
    if (highCost.length) recs.push('Lunasi utang berbunga tinggi lebih dulu (metode avalanche): ' + highCost[0].name + ' (' + pct(highCost[0].rate) + '/th).');
    items.forEach(function (x) { if (x.payoffMonths === null && x.outstanding > 0) recs.push('Cicilan ' + x.name + ' tidak menutup bunganya — utang ini tidak akan lunas dengan pembayaran saat ini.'); });
    if (!recs.length && total > 0) recs.push('Utang masih terkendali. Pertahankan pembayaran tepat waktu.');
    return { total: total, monthlyPayment: payment, dti: dti, status: dtiStatus(dti), items: items, highCost: highCost, threshold: thr, recommendations: recs };
  }

  // ---------------------------------------------------------------------------
  // Goals
  // ---------------------------------------------------------------------------
  function goals(d, today) {
    return d.goals.map(function (g) {
      var target = num(g.TargetAmount), current = num(g.CurrentAmount), remaining = Math.max(0, target - current);
      var hasDate = validDate(g.TargetDate), overdue = hasDate && g.TargetDate < today && remaining > 0;
      var monthsLeft = hasDate && !overdue ? Math.max(1, Math.ceil(monthsBetween(today, g.TargetDate))) : null;
      var achieved = g.Status === 'ACHIEVED' || (target > 0 && remaining === 0);
      return {
        id: g.GoalID, name: g.Name, target: target, current: current, remaining: remaining,
        progress: target > 0 ? clamp(current / target, 0, 1) : 0, targetDate: hasDate ? g.TargetDate : null,
        monthsLeft: monthsLeft, requiredMonthly: monthsLeft ? remaining / monthsLeft : null,
        overdue: overdue, achieved: achieved, priority: g.Priority || 'MEDIUM', status: achieved ? 'ACHIEVED' : (g.Status || 'ACTIVE'), notes: g.Notes || ''
      };
    }).sort(function (a, b) {
      var pr = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (a.achieved - b.achieved) || ((pr[a.priority] || 1) - (pr[b.priority] || 1)) || String(a.targetDate || '9').localeCompare(String(b.targetDate || '9'));
    });
  }

  // ---------------------------------------------------------------------------
  // Budget
  // ---------------------------------------------------------------------------
  function budgetStatus(d, mk, today) {
    var cf = cashflow(d.transactions, monthStart(mk), monthEnd(mk));
    var catName = {};
    d.categories.forEach(function (c) { catName[c.CategoryID] = c; });
    return d.budgets.filter(function (b) { return b.Month === mk; }).map(function (b) {
      var limit = num(b.LimitAmount), used = cf.expenseByCategory[b.CategoryID] || 0, p = limit > 0 ? used / limit * 100 : 0;
      var color = p > 90 ? 'red' : (p >= 70 ? 'yellow' : 'green');
      var c = catName[b.CategoryID] || {};
      return { id: b.BudgetID, categoryId: b.CategoryID, category: c.Name || '(kategori dihapus)', icon: c.Icon || '', color: color,
        limit: limit, used: used, remaining: limit - used, pct: p, over: Math.max(0, used - limit), exceeded: used > limit };
    }).sort(function (a, b) { return b.pct - a.pct; });
  }

  // ---------------------------------------------------------------------------
  // Retirement & Financial Independence (all in today's money)
  // ---------------------------------------------------------------------------
  function realMonthlyRate(returnPct, inflPct) {
    var realAnnual = (1 + returnPct / 100) / (1 + inflPct / 100) - 1;
    return Math.pow(1 + realAnnual, 1 / 12) - 1;
  }
  function fv(pv, pmt, i, n) {
    if (n <= 0) return pv;
    if (Math.abs(i) < 1e-12) return pv + pmt * n;
    var g = Math.pow(1 + i, n);
    return pv * g + pmt * (g - 1) / i;
  }
  function pmtNeeded(target, pv, i, n) {
    if (n <= 0) return null;
    var g = Math.abs(i) < 1e-12 ? 1 : Math.pow(1 + i, n);
    var rest = target - pv * g;
    if (rest <= 0) return 0;
    return Math.abs(i) < 1e-12 ? rest / n : rest * i / (g - 1);
  }
  /** Months until fv >= target, null if not within maxMonths. */
  function monthsUntil(target, pv, pmt, i, maxMonths) {
    if (pv >= target) return 0;
    var bal = pv;
    for (var m = 1; m <= maxMonths; m++) {
      bal = bal * (1 + i) + pmt;
      if (bal >= target) return m;
    }
    return null;
  }

  function retirement(p, investable, monthlyExpenseNow) {
    var age = p.CurrentAge, retAge = p.RetirementAge;
    var valid = age > 0 && retAge > age && p.WithdrawalRate > 0;
    var years = Math.max(0, retAge - age), n = Math.round(years * 12);
    var i = realMonthlyRate(p.ExpectedInvestmentReturn, p.InflationRate);
    var wr = p.WithdrawalRate / 100;
    var retMonthly = p.DesiredRetirementMonthlyExpense > 0 ? p.DesiredRetirementMonthlyExpense : monthlyExpenseNow;
    var required = wr > 0 ? retMonthly * 12 / wr : 0;
    var projected = fv(investable, p.MonthlyInvestment, i, n);
    var mAge = (valid && required > 0) ? monthsUntil(required, investable, p.MonthlyInvestment, i, Math.max(0, (100 - age) * 12)) : null;
    var inflF = Math.pow(1 + p.InflationRate / 100, years);
    return {
      valid: valid && required > 0,
      reason: !(age > 0 && retAge > age) ? 'Isi usia saat ini dan target usia pensiun (lebih besar dari usia saat ini).' :
        (required <= 0 ? 'Isi pengeluaran pensiun yang diinginkan atau catat pengeluaran bulanan.' : ''),
      currentAge: age, targetAge: retAge, yearsToRetire: years, realMonthlyRate: i,
      realAnnualRate: (Math.pow(1 + i, 12) - 1) * 100,
      retirementMonthlyExpense: retMonthly, required: required, current: investable,
      monthlyInvestment: p.MonthlyInvestment, projected: projected,
      projectedMonthlyIncome: projected * wr / 12, gap: Math.max(0, required - projected),
      progressNow: required > 0 ? clamp(investable / required, 0, 1) : 0,
      projectedCoverage: required > 0 ? projected / required : 0,
      neededMonthly: (valid && required > 0) ? pmtNeeded(required, investable, i, n) : null,
      estimatedAge: mAge === null ? null : age + mAge / 12,
      requiredNominal: required * inflF, projectedNominal: projected * inflF
    };
  }

  function financialIndependence(p, investable, tr, monthlySavings) {
    var fromProfile = p.MonthlyEssentialExpense + p.MonthlyLifestyleExpense;
    var useProfile = p.MonthlyEssentialExpense > 0 && p.MonthlyLifestyleExpense > 0;
    var monthly = useProfile ? fromProfile : tr.avgExpense;
    var basis = useProfile ? 'profil (esensial + gaya hidup)' : ('rata-rata pengeluaran, ' + tr.basis);
    var annual = monthly * 12, wr = p.WithdrawalRate / 100;
    var target = wr > 0 ? annual / wr : 0;
    var i = realMonthlyRate(p.ExpectedInvestmentReturn, p.InflationRate);
    var contrib = p.MonthlyInvestment > 0 ? p.MonthlyInvestment : Math.max(0, monthlySavings);
    var m = target > 0 ? monthsUntil(target, investable, contrib, i, 600) : null;
    return {
      annualExpense: annual, monthlyExpense: monthly, basis: basis, withdrawalRate: p.WithdrawalRate,
      expectedReturn: p.ExpectedInvestmentReturn, inflation: p.InflationRate,
      target: target, investable: investable, progress: target > 0 ? investable / target : 0,
      passiveMonthly: investable * wr / 12, contribution: contrib,
      contributionBasis: p.MonthlyInvestment > 0 ? 'investasi bulanan (profil)' : 'rata-rata surplus bulanan',
      monthsToFI: m, yearsToFI: m === null ? null : m / 12,
      fiAge: (m !== null && p.CurrentAge > 0) ? p.CurrentAge + m / 12 : null,
      achieved: target > 0 && investable >= target, hasData: annual > 0
    };
  }

  // ---------------------------------------------------------------------------
  // Income diversification
  // ---------------------------------------------------------------------------
  function incomeSources(d, today) {
    var cf = cashflow(d.transactions, monthStart(addMonths(monthKey(today), -5)), today);
    var total = cf.income, n = 0;
    Object.keys(cf.incomeByCategory).forEach(function (k) { if (total > 0 && cf.incomeByCategory[k] / total >= 0.1) n++; });
    return { sources: n, total: total };
  }

  // ---------------------------------------------------------------------------
  // Scores
  // ---------------------------------------------------------------------------
  function comp(key, label, max, frac, valueText, insufficient, goodText, badText) {
    frac = insufficient ? 0.5 : clamp(frac, 0, 1);
    return { key: key, label: label, max: max, points: round(frac * max, 1), pct: frac, valueText: valueText,
      insufficient: !!insufficient, goodText: goodText, badText: badText };
  }
  function scoreLabel(s) {
    if (s >= 80) return { label: 'Sangat Sehat', color: 'green' };
    if (s >= 60) return { label: 'Sehat', color: 'green' };
    if (s >= 40) return { label: 'Cukup', color: 'yellow' };
    if (s >= 20) return { label: 'Rentan', color: 'orange' };
    return { label: 'Kritis', color: 'red' };
  }
  function finishScore(components) {
    var total = Math.round(sum(components, function (c) { return c.points; }));
    var lab = scoreLabel(total);
    return {
      score: total, label: lab.label, color: lab.color, components: components,
      strong: components.filter(function (c) { return !c.insufficient && c.pct >= 0.75; }).map(function (c) { return c.goodText; }),
      improve: components.filter(function (c) { return !c.insufficient && c.pct < 0.5; }).map(function (c) { return c.badText; }),
      insufficient: components.filter(function (c) { return c.insufficient; }).map(function (c) { return c.label; })
    };
  }

  function cashflowFrac(tr) {
    if (tr.avgIncome <= 0) return tr.avgExpense > 0 ? 0 : 0.5;
    return pw(tr.avgNet / tr.avgIncome, [[-0.1, 0], [0, 0.4], [0.2, 1]]);
  }
  function debtFrac(db, hasDebt) {
    if (!hasDebt) return 1;
    if (db.dti === null) return 0;
    var f = pw(db.dti, [[15, 1], [35, 0.5], [50, 0]]);
    return db.highCost.length ? f * 0.7 : f;
  }
  function growthFrac(g) { return pw(g, [[-5, 0], [0, 0.4], [5, 1]]); }

  function healthScore(x) {
    var tr = x.trailing, ef = x.emergencyFund, db = x.debt, nw = x.netWorth, fi = x.fi, p = x.profile;
    var annual = tr.avgExpense * 12, hasDebt = db.total > 0;
    var sr = tr.savingsRate;
    return finishScore([
      comp('cashflow', 'Cash Flow', 20, cashflowFrac(tr), tr.hasData ? 'Net ' + x.fmt(tr.avgNet) + '/bln' : '–', !tr.hasData,
        'Cash flow positif (' + x.fmt(tr.avgNet) + '/bulan)', tr.avgNet < 0 ? 'Cash flow negatif: pengeluaran melebihi pemasukan' : 'Surplus bulanan masih tipis'),
      comp('emergency', 'Emergency Fund', 20, ef.months === null ? 0 : ef.months / ef.target, months(ef.months), ef.months === null,
        'Dana darurat ' + months(ef.months), 'Dana darurat baru ' + months(ef.months) + ' (target ' + ef.target + ' bulan)'),
      comp('debt', 'Debt', 15, debtFrac(db, hasDebt), hasDebt ? 'DTI ' + pct(db.dti) : 'Tanpa utang', false,
        hasDebt ? 'Rasio utang terkendali (DTI ' + pct(db.dti) + ')' : 'Tidak memiliki utang',
        db.highCost.length ? 'Ada utang berbunga tinggi' : 'Rasio cicilan terhadap income tinggi (DTI ' + pct(db.dti) + ')'),
      comp('savings', 'Savings', 15, sr === null ? 0 : sr / p.SavingsRateTarget, pct(sr), sr === null,
        'Savings rate ' + pct(sr), 'Savings rate ' + pct(sr) + ' di bawah target ' + pct(p.SavingsRateTarget, 0)),
      comp('nwgrowth', 'Net Worth Growth', 10, growthFrac(nw.growth3Pct || 0), nw.growth3Pct === null ? '–' : (nw.growth3Pct >= 0 ? '+' : '') + pct(nw.growth3Pct), nw.growth3Pct === null,
        'Kekayaan bersih bertumbuh (' + pct(nw.growth3Pct) + ' dalam ~3 bulan)', 'Kekayaan bersih tidak bertumbuh'),
      comp('investment', 'Investment', 10, annual > 0 ? x.balance.investable / annual : 0, x.fmt(x.balance.investable), annual <= 0,
        'Aset investasi setara ' + months(annual > 0 ? x.balance.investable / tr.avgExpense : null) + ' pengeluaran', 'Aset investasi masih kecil dibanding pengeluaran'),
      comp('fi', 'Financial Independence', 10, fi.progress, pct(fi.progress * 100), !fi.hasData,
        'Progres financial independence ' + pct(fi.progress * 100), 'Progres financial independence ' + pct(fi.progress * 100))
    ]);
  }

  function resilienceScore(x) {
    var tr = x.trailing, ef = x.emergencyFund, db = x.debt, nw = x.netWorth, p = x.profile;
    var annual = tr.avgExpense * 12, hasDebt = db.total > 0, sr = tr.savingsRate, inc = x.incomeSources;
    var activeGoals = x.goals.filter(function (g) { return g.status !== 'PAUSED'; });
    var goalFrac = activeGoals.length ? sum(activeGoals, function (g) { return g.progress; }) / activeGoals.length : 0;
    return finishScore([
      comp('emergency', 'Emergency Fund', 20, ef.months === null ? 0 : ef.months / ef.target, months(ef.months), ef.months === null,
        'Dana darurat ' + months(ef.months), 'Dana darurat baru ' + months(ef.months)),
      comp('cashflow', 'Cash Flow', 15, cashflowFrac(tr), tr.hasData ? x.fmt(tr.avgNet) + '/bln' : '–', !tr.hasData,
        'Cash flow positif', 'Cash flow negatif atau tipis'),
      comp('debt', 'Debt', 15, debtFrac(db, hasDebt), hasDebt ? 'DTI ' + pct(db.dti) : 'Tanpa utang', false,
        'Utang terkendali', 'Beban utang tinggi'),
      comp('savings', 'Savings Rate', 10, sr === null ? 0 : sr / p.SavingsRateTarget, pct(sr), sr === null,
        'Savings rate ' + pct(sr), 'Savings rate di bawah target'),
      comp('networth', 'Net Worth', 15, annual > 0 ? pw(x.balance.netWorth / annual, [[0, 0], [2, 1]]) : 0,
        x.fmt(x.balance.netWorth), annual <= 0, 'Kekayaan bersih setara ' + round(annual > 0 ? x.balance.netWorth / annual : 0, 1) + ' tahun pengeluaran', 'Kekayaan bersih rendah atau negatif'),
      comp('income', 'Income Diversification', 10, inc.sources >= 3 ? 1 : (inc.sources === 2 ? 0.7 : (inc.sources === 1 ? 0.3 : 0)),
        inc.sources + ' sumber', inc.total <= 0, inc.sources + ' sumber pemasukan', 'Bergantung pada satu sumber pemasukan'),
      comp('assetgrowth', 'Asset Growth', 10, growthFrac(nw.assetGrowth3Pct || 0), nw.assetGrowth3Pct === null ? '–' : pct(nw.assetGrowth3Pct), nw.assetGrowth3Pct === null,
        'Aset bertumbuh', 'Aset tidak bertumbuh'),
      comp('goals', 'Financial Goals', 5, goalFrac, activeGoals.length ? activeGoals.length + ' tujuan' : 'Belum ada', false,
        'Tujuan finansial berjalan baik', activeGoals.length ? 'Progres tujuan finansial masih rendah' : 'Belum memiliki tujuan finansial')
    ]);
  }

  // ---------------------------------------------------------------------------
  // Level
  // ---------------------------------------------------------------------------
  function level(x) {
    var tr = x.trailing, ef = x.emergencyFund, db = x.debt;
    var c = {
      positive: tr.hasData && tr.avgNet > 0,
      ef3: ef.months !== null && ef.months >= 3,
      dti: db.dti !== null && db.dti <= 35,
      noHighCost: db.highCost.length === 0,
      savings10: tr.savingsRate !== null && tr.savingsRate >= 10,
      nwRising: x.netWorth.risingTwoMonths,
      investing: x.balance.investable > 0,
      fi: tr.avgExpense > 0 && x.balance.investable * (x.profile.WithdrawalRate / 100) / 12 >= tr.avgExpense
    };
    var req = {
      2: [['positive', 'Cash flow rata-rata positif']],
      3: [['ef3', 'Dana darurat ≥ 3 bulan'], ['dti', 'DTI ≤ 35%'], ['noHighCost', 'Tanpa utang berbunga tinggi']],
      4: [['savings10', 'Savings rate ≥ 10%'], ['nwRising', 'Net worth naik 2 bulan berturut-turut'], ['investing', 'Memiliki aset investasi']],
      5: [['fi', 'Hasil portofolio (withdrawal rate) ≥ pengeluaran bulanan']]
    };
    var lv = 1;
    for (var L = 2; L <= 4; L++) {
      if (req[L].every(function (r) { return c[r[0]]; })) lv = L; else break;
    }
    if (c.fi && c.positive) lv = 5;
    var next = lv < 5 ? { level: lv + 1, name: LEVELS[lv].name, missing: req[lv + 1].filter(function (r) { return !c[r[0]]; }).map(function (r) { return r[1]; }) } : null;
    var info = LEVELS[lv - 1];
    return { level: lv, key: info.key, name: info.name, desc: info.desc, criteria: c, next: next, all: LEVELS, requirements: req };
  }

  // ---------------------------------------------------------------------------
  // Insights — only emitted when the underlying data exists
  // ---------------------------------------------------------------------------
  function insights(x, d, today) {
    var out = [], fmt = x.fmt, cur = monthKey(today), prev = addMonths(cur, -1);
    var dayN = parts(today).d;
    var mtd = cashflow(d.transactions, monthStart(cur), today);
    var prevEnd = ymd(parts(prev).y, parts(prev).m, Math.min(dayN, parts(monthEnd(prev)).d));
    var lastPeriod = cashflow(d.transactions, monthStart(prev), prevEnd);
    if (mtd.expense > 0 && lastPeriod.expense > 0) {
      var ch = (mtd.expense - lastPeriod.expense) / lastPeriod.expense * 100;
      if (Math.abs(ch) >= 5) out.push({ type: ch > 0 ? 'warn' : 'good', icon: ch > 0 ? '⚠' : '💡',
        text: 'Pengeluaran Anda ' + (ch > 0 ? 'naik ' : 'turun ') + pct(Math.abs(ch), 0) + ' dibanding periode yang sama bulan lalu (tgl 1–' + dayN + ').' });
    }
    if (x.emergencyFund.months !== null) out.push({ type: 'info', icon: '💡', text: 'Dana darurat Anda saat ini dapat menutup ' + months(x.emergencyFund.months) + ' pengeluaran esensial.' });
    var m1 = monthCashflow(d.transactions, prev), m2 = monthCashflow(d.transactions, addMonths(cur, -2));
    if (m1.savingsRate !== null && m2.savingsRate !== null && Math.abs(m1.savingsRate - m2.savingsRate) >= 3) {
      var down = m1.savingsRate < m2.savingsRate;
      out.push({ type: down ? 'warn' : 'good', icon: down ? '⚠' : '💡', text: 'Savings rate ' + (down ? 'turun' : 'naik') + ' dari ' + pct(m2.savingsRate, 0) + ' menjadi ' + pct(m1.savingsRate, 0) + ' (bulan lalu).' });
    }
    if (x.emergencyFund.gap > 0 && x.emergencyFund.essential > 0) out.push({ type: 'goal', icon: '🎯',
      text: 'Anda perlu sekitar ' + fmt(x.emergencyFund.monthlyFor12) + '/bulan selama 12 bulan untuk mencapai target dana darurat ' + x.emergencyFund.target + ' bulan.' });
    if (mtd.expense > 0) {
      var top = null;
      Object.keys(mtd.expenseByCategory).forEach(function (k) { if (!top || mtd.expenseByCategory[k] > mtd.expenseByCategory[top]) top = k; });
      var share = mtd.expenseByCategory[top] / mtd.expense * 100;
      if (top && share >= 30 && mtd.count >= 3) out.push({ type: 'info', icon: '💡', text: 'Kategori ' + (x.catName(top)) + ' menyerap ' + pct(share, 0) + ' pengeluaran bulan ini.' });
    }
    x.budgets.forEach(function (b) {
      if (b.exceeded) out.push({ type: 'warn', icon: '⚠', text: 'Budget ' + b.category + ' terlampaui ' + fmt(b.over) + '.' });
      else if (b.pct >= 90) out.push({ type: 'warn', icon: '⚠', text: 'Budget ' + b.category + ' sudah terpakai ' + pct(b.pct, 0) + '.' });
    });
    if (m1.count > 0 && m1.net < 0) out.push({ type: 'warn', icon: '⚠', text: 'Bulan lalu Anda defisit ' + fmt(-m1.net) + '.' });
    if (x.debt.dti !== null && x.debt.dti > 35) out.push({ type: 'warn', icon: '⚠', text: 'Cicilan utang memakan ' + pct(x.debt.dti, 0) + ' pemasukan (batas aman ≤ 35%).' });
    if (x.netWorth.growthPct !== null) out.push({ type: x.netWorth.growthPct >= 0 ? 'good' : 'warn', icon: x.netWorth.growthPct >= 0 ? '📈' : '📉',
      text: 'Kekayaan bersih ' + (x.netWorth.growthPct >= 0 ? 'naik ' : 'turun ') + pct(Math.abs(x.netWorth.growthPct)) + ' dibanding bulan lalu.' });
    var activeG = x.goals.filter(function (g) { return !g.achieved && g.requiredMonthly; });
    var need = sum(activeG, function (g) { return g.requiredMonthly; });
    if (need > 0 && x.trailing.hasData && need > Math.max(0, x.trailing.avgNet)) out.push({ type: 'warn', icon: '🎯',
      text: 'Total setoran tujuan yang dibutuhkan ' + fmt(need) + '/bulan, melebihi surplus rata-rata ' + fmt(Math.max(0, x.trailing.avgNet)) + '.' });
    x.goals.forEach(function (g) { if (g.overdue) out.push({ type: 'warn', icon: '⏰', text: 'Tujuan "' + g.name + '" melewati tanggal target dengan sisa ' + fmt(g.remaining) + '.' }); });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Action plan — prioritized: risk → high-cost debt → EF → cash flow → savings → investing → retirement
  // ---------------------------------------------------------------------------
  function actionPlan(x) {
    var A = [], fmt = x.fmt, tr = x.trailing, ef = x.emergencyFund, db = x.debt, surplus = Math.max(0, tr.avgNet);
    function push(o) { A.push(o); }
    if (!tr.hasData) {
      push({ key: 'start', section: 'transactions', title: 'Mulai catat pemasukan & pengeluaran', why: 'Semua analisis bergantung pada data transaksi.', current: '0 transaksi', target: '≥ 1 bulan data', action: 'Catat setiap transaksi selama 30 hari ke depan.' });
    }
    if (tr.hasData && tr.avgNet < 0) {
      var top = Object.keys(tr.expenseByCategory).sort(function (a, b) { return tr.expenseByCategory[b] - tr.expenseByCategory[a]; }).slice(0, 3).map(x.catName);
      push({ key: 'deficit', section: 'cashflow', title: 'Hentikan defisit bulanan', why: 'Defisit menggerus tabungan dan mendorong utang.', current: fmt(tr.avgNet) + '/bulan', target: '≥ ' + fmt(0),
        action: 'Kurangi pengeluaran minimal ' + fmt(-tr.avgNet) + '/bulan. Mulai dari: ' + top.join(', ') + '.', amount: -tr.avgNet });
    }
    if (ef.months !== null && ef.months < 1) {
      var g1 = Math.max(0, ef.essential - ef.liquid);
      push({ key: 'ef-starter', section: 'emergency', title: 'Bangun dana darurat awal (1 bulan)', why: 'Tanpa bantalan, satu kejadian tak terduga bisa memaksa berutang.', current: months(ef.months), target: '1 bulan',
        action: 'Alokasikan ' + fmt(surplus > 0 ? Math.min(surplus, Math.max(g1 / 6, surplus * 0.5)) : g1 / 6) + '/bulan sampai terkumpul ' + fmt(g1) + '.', amount: g1 });
    }
    if (db.highCost.length) {
      var h = db.highCost[0];
      push({ key: 'high-debt', section: 'debt', title: 'Lunasi utang berbunga tinggi: ' + h.name, why: 'Bunga ' + pct(h.rate) + '/th lebih mahal daripada imbal hasil yang realistis.', current: fmt(h.outstanding), target: fmt(0),
        action: 'Bayar minimum semua utang, lalu arahkan dana ekstra' + (surplus > 0 ? ' (mis. ' + fmt(surplus * 0.5) + '/bulan)' : '') + ' ke utang ini (metode avalanche).', amount: h.outstanding });
    }
    if (ef.months !== null && ef.months >= 1 && ef.months < ef.target) {
      push({ key: 'ef', section: 'emergency', title: 'Lengkapi dana darurat', why: 'Target ' + ef.target + ' bulan memberi waktu bila kehilangan pemasukan.', current: months(ef.months), target: ef.target + ' bulan',
        action: 'Alokasikan ' + fmt(ef.monthlyFor12) + '/bulan selama 12 bulan' + (surplus > 0 && ef.monthlyFor12 > surplus ? ' (lebih besar dari surplus Anda ' + fmt(surplus) + ' — perpanjang jangka waktu atau tambah pemasukan)' : '') + '.', amount: ef.gap });
    }
    if (db.dti !== null && db.dti > 35 && !db.highCost.length) {
      push({ key: 'dti', section: 'debt', title: 'Turunkan rasio cicilan (DTI)', why: 'DTI tinggi membuat cash flow rapuh.', current: pct(db.dti), target: '≤ 35%', action: 'Hindari utang baru; percepat pelunasan utang dengan saldo terkecil atau bunga tertinggi.' });
    }
    if (tr.hasData && tr.avgNet >= 0 && tr.savingsRate !== null && tr.savingsRate < 10) {
      push({ key: 'cashflow', section: 'cashflow', title: 'Naikkan savings rate ke ≥ 10%', why: 'Surplus tipis membuat sulit membangun cadangan.', current: pct(tr.savingsRate), target: '10%',
        action: 'Butuh tambahan surplus sekitar ' + fmt(tr.avgIncome * 0.1 - tr.avgNet) + '/bulan (kurangi pengeluaran atau tambah pemasukan).' });
    } else if (tr.savingsRate !== null && tr.savingsRate >= 10 && tr.savingsRate < x.profile.SavingsRateTarget) {
      push({ key: 'savings', section: 'cashflow', title: 'Capai target savings rate ' + pct(x.profile.SavingsRateTarget, 0), why: 'Savings rate adalah mesin utama menuju financial independence.', current: pct(tr.savingsRate), target: pct(x.profile.SavingsRateTarget, 0),
        action: 'Tambah surplus sekitar ' + fmt(tr.avgIncome * x.profile.SavingsRateTarget / 100 - tr.avgNet) + '/bulan.' });
    }
    var readyToInvest = ef.months !== null && ef.months >= Math.min(3, ef.target) && !db.highCost.length && surplus > 0;
    if (readyToInvest && x.profile.MonthlyInvestment <= 0) {
      push({ key: 'invest', section: 'retirement', title: 'Mulai investasi rutin jangka panjang', why: 'Dana darurat sudah memadai dan tidak ada utang mahal.', current: fmt(x.balance.investable), target: 'Rutin setiap bulan',
        action: 'Pertimbangkan menyisihkan sebagian surplus (mis. ' + fmt(surplus * 0.5) + '/bulan) ke instrumen yang sesuai profil risiko Anda, lalu isi "Investasi bulanan" di profil.', disclaimer: true });
    }
    if (x.retirement.valid && x.retirement.gap > 0 && x.retirement.neededMonthly !== null) {
      push({ key: 'retire', section: 'retirement', title: 'Tutup kekurangan dana pensiun', why: 'Proyeksi dana pensiun belum mencapai kebutuhan.', current: fmt(x.retirement.projected) + ' (proyeksi)', target: fmt(x.retirement.required),
        action: 'Investasi sekitar ' + fmt(x.retirement.neededMonthly) + '/bulan hingga usia ' + x.retirement.targetAge + ' (estimasi, bukan jaminan).', disclaimer: true });
    }
    if (x.profileIncomplete) push({ key: 'profile', section: 'settings', title: 'Lengkapi profil keuangan', why: 'Usia dan pengeluaran esensial membuat proyeksi lebih akurat.', current: 'Belum lengkap', target: 'Lengkap', action: 'Isi usia, target pensiun, dan pengeluaran esensial di Pengaturan → Asumsi.' });
    A.forEach(function (a, i) { a.priority = i + 1; });
    return A;
  }

  // ---------------------------------------------------------------------------
  // Main entry — everything the dashboard needs, in one pass
  // ---------------------------------------------------------------------------
  function analyze(raw, opts) {
    opts = opts || {};
    var today = opts.today;
    var d = prepare(raw);
    var fmt = opts.fmtMoney || function (v) { return defaultMoney(v, d.currency); };
    var catMap = {};
    d.categories.forEach(function (c) { catMap[c.CategoryID] = c; });
    var catName = function (id) { return (catMap[id] && catMap[id].Name) || 'Lainnya'; };

    var cur = monthKey(today);
    var tr = trailing(d.transactions, today, 3);
    var bs = balanceSheet(d);
    var ess = essentialExpense(d, tr);
    var x = { fmt: fmt, catName: catName, profile: d.profile, trailing: tr, balance: bs, currency: d.currency };
    x.thisMonth = cashflow(d.transactions, monthStart(cur), today);
    x.lastMonth = monthCashflow(d.transactions, addMonths(cur, -1));
    x.today = cashflow(d.transactions, today, today);
    x.thisWeek = cashflow(d.transactions, weekStart(today), today);
    x.series6 = monthlySeries(d.transactions, cur, 6);
    x.emergencyFund = emergencyFund(d, bs, ess);
    x.debt = debt(d, tr);
    x.snapshots = snapshotSeries(d.snapshots);
    x.netWorth = netWorthTrend(x.snapshots, today, bs);
    x.goals = goals(d, today);
    x.budgets = budgetStatus(d, cur, today);
    x.incomeSources = incomeSources(d, today);
    x.retirement = retirement(d.profile, bs.investable, tr.avgExpense);
    x.fi = financialIndependence(d.profile, bs.investable, tr, tr.avgNet);
    var rawProfile = alive(raw.profile)[0] || {};
    x.profileIncomplete = !(num(rawProfile.CurrentAge) > 0 && num(rawProfile.MonthlyEssentialExpense) > 0);
    x.hasData = tr.hasData;
    x.health = healthScore(x);
    x.resilience = resilienceScore(x);
    x.level = level(x);
    x.insights = insights(x, d, today);
    x.actions = actionPlan(x);
    delete x.fmt; delete x.catName;
    return x;
  }

  /** Snapshot record for the current month (client upserts one per month). */
  function snapshotValues(summary) {
    var m = summary.thisMonth;
    return {
      TotalAssets: round(summary.balance.totalAssets, 2), TotalLiabilities: round(summary.balance.totalLiabilities, 2),
      NetWorth: round(summary.balance.netWorth, 2), MonthlyIncome: round(m.income, 2), MonthlyExpense: round(m.expense, 2),
      SavingsRate: m.savingsRate === null ? 0 : round(m.savingsRate, 2),
      EmergencyFundMonths: summary.emergencyFund.months === null ? 0 : round(summary.emergencyFund.months, 2),
      FinancialHealthScore: summary.hasData ? summary.health.score : 0
    };
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  function monthlyReport(raw, mk, today, summary) {
    var d = prepare(raw), cf = monthCashflow(d.transactions, mk);
    var snap = snapshotSeries(d.snapshots).filter(function (s) { return s.month === mk; })[0];
    var isCurrent = mk === monthKey(today);
    var catMap = {}; d.categories.forEach(function (c) { catMap[c.CategoryID] = c.Name; });
    var cats = Object.keys(cf.expenseByCategory).map(function (k) { return { id: k, name: catMap[k] || 'Lainnya', amount: cf.expenseByCategory[k], share: cf.expense > 0 ? cf.expenseByCategory[k] / cf.expense * 100 : 0 }; })
      .sort(function (a, b) { return b.amount - a.amount; });
    var incs = Object.keys(cf.incomeByCategory).map(function (k) { return { id: k, name: catMap[k] || 'Lainnya', amount: cf.incomeByCategory[k] }; })
      .sort(function (a, b) { return b.amount - a.amount; });
    return {
      month: mk, income: cf.income, expense: cf.expense, savings: cf.net, savingsRate: cf.savingsRate, count: cf.count,
      netWorth: isCurrent && summary ? summary.balance.netWorth : (snap ? snap.netWorth : null),
      debt: isCurrent && summary ? summary.balance.totalLiabilities : (snap ? snap.totalLiabilities : null),
      emergencyFundMonths: isCurrent && summary ? summary.emergencyFund.months : (snap ? snap.efMonths : null),
      expenseByCategory: cats, incomeByCategory: incs
    };
  }
  function yearlyReport(raw, year, today, summary) {
    var d = prepare(raw), y = String(year);
    var monthsArr = [];
    for (var m = 1; m <= 12; m++) {
      var mk = y + '-' + pad(m);
      if (mk > monthKey(today)) break;
      var c = monthCashflow(d.transactions, mk);
      monthsArr.push({ month: mk, income: c.income, expense: c.expense, net: c.net, savingsRate: c.savingsRate });
    }
    var inc = sum(monthsArr, function (r) { return r.income; }), exp = sum(monthsArr, function (r) { return r.expense; });
    var series = snapshotSeries(d.snapshots).filter(function (s) { return s.month.slice(0, 4) === y; });
    var endNW = (y === monthKey(today).slice(0, 4) && summary) ? summary.balance.netWorth : (series.length ? series[series.length - 1].netWorth : null);
    var startNW = series.length ? series[0].netWorth : null;
    return {
      year: y, income: inc, expense: exp, savings: inc - exp, savingsRate: inc > 0 ? (inc - exp) / inc * 100 : null,
      months: monthsArr, netWorthStart: startNW, netWorthEnd: endNW,
      netWorthGrowth: (startNW !== null && endNW !== null) ? endNW - startNW : null,
      netWorthGrowthPct: (startNW && endNW !== null) ? (endNW - startNW) / Math.abs(startNW) * 100 : null,
      goals: summary ? summary.goals : goals(d, today)
    };
  }

  return {
    DEFAULT_PROFILE: DEFAULT_PROFILE, LEVELS: LEVELS,
    analyze: analyze, snapshotValues: snapshotValues, monthlyReport: monthlyReport, yearlyReport: yearlyReport,
    cashflow: function (raw, start, end) { return cashflow(prepare(raw).transactions, start, end); },
    monthlySeries: function (raw, endMonth, n) { return monthlySeries(prepare(raw).transactions, endMonth, n); },
    accountBalances: function (raw) { var d = prepare(raw); return accountBalances(d.accounts, d.transactions); },
    budgetStatus: function (raw, mk) { return budgetStatus(prepare(raw), mk); },
    retirement: retirement, financialIndependence: financialIndependence, fv: fv, pmtNeeded: pmtNeeded,
    realMonthlyRate: realMonthlyRate, payoffMonths: payoffMonths, efStatus: efStatus,
    date: { monthKey: monthKey, addMonths: addMonths, monthStart: monthStart, monthEnd: monthEnd, addDays: addDays, weekStart: weekStart, monthsBetween: monthsBetween, validDate: validDate },
    util: { num: num, bool: bool, pw: pw, round: round }
  };
})();


;
/* ==== js/core/util.js ==== */
/* Resilia — core/util.js : ids, dates (local yyyy-MM-dd, never browser-locale parsing), formatting, DOM helpers */
window.R = window.R || {};
R.U = (function () {
  'use strict';
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** Local calendar date as yyyy-MM-dd (toISOString would shift the day in UTC+7 mornings). */
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  /** UTC timestamp yyyy-MM-ddTHH:mm:ssZ */
  function nowISO() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function monthKey(s) { return String(s || today()).slice(0, 7); }
  function parts(s) { var p = String(s).split('-'); return { y: +p[0], m: +p[1], d: +(p[2] || 1) }; }
  function fmtDate(s, style) {
    if (!s) return '–';
    var p = parts(s);
    if (style === 'long') {
      var dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
      return DAYS[dow] + ', ' + p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y;
    }
    return p.d + ' ' + MON[p.m - 1] + ' ' + p.y;
  }
  function fmtMonth(mk, short) { var p = parts(mk + '-01'); return (short ? MON : MONTHS)[p.m - 1] + ' ' + p.y; }
  function monShort(mk) { return MON[parts(mk + '-01').m - 1]; }
  function relTime(ms) {
    if (!ms) return 'belum pernah';
    var s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; return Math.floor(s / 86400) + ' hari lalu';
  }

  // ---- money ----
  var currency = 'IDR', fmtCache = {};
  function setCurrency(c) { currency = c || 'IDR'; fmtCache = {}; }
  function nf(key, opts) { return fmtCache[key] || (fmtCache[key] = new Intl.NumberFormat('id-ID', opts)); }
  function money(v, o) {
    o = o || {};
    v = Number(v) || 0;
    var digits = currency === 'IDR' || currency === 'JPY' ? 0 : 2;
    var s = nf('m' + digits, { style: 'currency', currency: currency, minimumFractionDigits: 0, maximumFractionDigits: digits }).format(Math.abs(v)).replace(/\s/g, ' ');
    if (currency === 'IDR') s = s.replace(/^Rp\s?/, 'Rp');
    var sign = v < 0 ? '−' : (o.sign && v > 0 ? '+' : '');
    return sign + s;
  }
  /** Compact money for charts / tight spaces: Rp1,2 jt, Rp3,4 M */
  function moneyShort(v) {
    v = Number(v) || 0;
    var a = Math.abs(v), sign = v < 0 ? '−' : '', pre = currency === 'IDR' ? 'Rp' : '';
    function f(x, suf) { return sign + pre + nf('c', { maximumFractionDigits: 1 }).format(x) + suf; }
    if (a >= 1e12) return f(a / 1e12, ' T'); if (a >= 1e9) return f(a / 1e9, ' M');
    if (a >= 1e6) return f(a / 1e6, ' jt'); if (a >= 1e3) return f(a / 1e3, ' rb');
    return sign + pre + Math.round(a);
  }
  function number(v, d) { return nf('n' + (d || 0), { maximumFractionDigits: d || 0 }).format(Number(v) || 0); }
  function pct(v, d) { return (v === null || v === undefined || !isFinite(v)) ? '–' : nf('p' + (d === undefined ? 1 : d), { maximumFractionDigits: d === undefined ? 1 : d }).format(v) + '%'; }
  /** Parse an id-ID formatted amount ("1.250.000" or "1.250,50"). */
  function parseMoney(s) {
    s = String(s === undefined || s === null ? '' : s).replace(/[^\d,.\-]/g, '');
    if (!s) return 0;
    s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function moneyInputValue(v) { if (v === '' || v === null || v === undefined) return ''; return nf('in', { maximumFractionDigits: 2 }).format(Number(v) || 0); }

  // ---- DOM ----
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(el, ev, sel, fn) {
    el.addEventListener(ev, function (e) {
      var t = e.target.closest(sel);
      if (t && el.contains(t)) fn(e, t);
    });
  }
  function icon(name, cls) { return '<svg class="' + (cls || '') + '"><use href="#i-' + name + '"/></svg>'; }
  function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
  function deviceName() {
    var ua = navigator.userAgent;
    var os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Perangkat';
    var br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return br + ' · ' + os;
  }
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  /** CSV with formula-injection protection (cells starting with = + - @ are prefixed with '). */
  function toCSV(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) {
        var s = v === null || v === undefined ? '' : String(v);
        if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
        return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('resilia.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('resilia.' + k, JSON.stringify(v)); } catch (e) { /* storage full / blocked */ } },
    del: function (k) { try { localStorage.removeItem('resilia.' + k); } catch (e) { /* ignore */ } }
  };

  return {
    uuid: uuid, ymd: ymd, today: today, nowISO: nowISO, monthKey: monthKey, fmtDate: fmtDate, fmtMonth: fmtMonth, monShort: monShort, relTime: relTime,
    MONTHS: MONTHS, setCurrency: setCurrency, money: money, moneyShort: moneyShort, number: number, pct: pct, parseMoney: parseMoney, moneyInputValue: moneyInputValue,
    esc: esc, $: $, $$: $$, on: on, icon: icon, debounce: debounce, deviceName: deviceName, download: download, toCSV: toCSV, LS: LS,
    getCurrency: function () { return currency; }
  };
})();

;
/* ==== js/core/store.js ==== */
/* Resilia — core/store.js
 * Local-first data store. Reads come from memory; every write is persisted to IndexedDB
 * (fallback: localStorage) TOGETHER with its sync-queue operation in one transaction,
 * so a change can never be lost between "saved locally" and "queued for the server".
 */
R.Store = (function () {
  'use strict';
  var U = R.U;
  var KEYS = {
    Users: 'UserID', Transactions: 'TransactionID', Categories: 'CategoryID', Accounts: 'AccountID', Assets: 'AssetID',
    Liabilities: 'DebtID', Goals: 'GoalID', Budgets: 'BudgetID', FinancialProfile: 'ProfileID', Snapshots: 'SnapshotID'
  };
  var CALC = {
    Users: 'users', Transactions: 'transactions', Categories: 'categories', Accounts: 'accounts', Assets: 'assets',
    Liabilities: 'liabilities', Goals: 'goals', Budgets: 'budgets', FinancialProfile: 'profile', Snapshots: 'snapshots'
  };
  var DB_NAME = 'resilia', DB_VER = 1;
  var mem = {}, queue = new Map(), meta = {}, inflight = {}, backend = null, version = 0, listeners = [], calcCache = null, seq = 0;

  // ---------------------------------------------------------------------------
  // Persistence adapters
  // ---------------------------------------------------------------------------
  function idbAdapter() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('no indexedDB'));
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        Object.keys(KEYS).forEach(function (n) { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: KEYS[n] }); });
        if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'QueueID' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var db = req.result;
        resolve({
          kind: 'IndexedDB',
          getAll: function (store) {
            return new Promise(function (res, rej) {
              var r = db.transaction(store, 'readonly').objectStore(store).getAll();
              r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { rej(r.error); };
            });
          },
          write: function (changes) {
            if (!changes.length) return Promise.resolve();
            var stores = changes.map(function (c) { return c.store; }).filter(function (s, i, a) { return a.indexOf(s) === i; });
            return new Promise(function (res, rej) {
              var tx = db.transaction(stores, 'readwrite');
              changes.forEach(function (c) { var os = tx.objectStore(c.store); if (c.del !== undefined) os.delete(c.del); else os.put(c.put); });
              tx.oncomplete = function () { res(); };
              tx.onerror = function () { rej(tx.error); }; tx.onabort = function () { rej(tx.error || new Error('aborted')); };
            });
          },
          clear: function () {
            var stores = Object.keys(KEYS).concat(['queue', 'meta']);
            return new Promise(function (res, rej) {
              var tx = db.transaction(stores, 'readwrite');
              stores.forEach(function (s) { tx.objectStore(s).clear(); });
              tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); };
            });
          }
        });
      };
    });
  }

  function lsAdapter() {
    var cache = {};
    function load(store) { if (!cache[store]) cache[store] = U.LS.get('db.' + store, []); return cache[store]; }
    function keyOf(store) { return store === 'queue' ? 'QueueID' : store === 'meta' ? 'k' : KEYS[store]; }
    return {
      kind: 'localStorage',
      getAll: function (store) { return Promise.resolve(load(store).slice()); },
      write: function (changes) {
        var touched = {};
        changes.forEach(function (c) {
          var arr = load(c.store), k = keyOf(c.store), id = c.del !== undefined ? c.del : c.put[k];
          var i = arr.findIndex(function (x) { return x[k] === id; });
          if (c.del !== undefined) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = c.put; else arr.push(c.put);
          touched[c.store] = 1;
        });
        Object.keys(touched).forEach(function (s) { U.LS.set('db.' + s, cache[s]); });
        return Promise.resolve();
      },
      clear: function () { Object.keys(KEYS).concat(['queue', 'meta']).forEach(function (s) { U.LS.del('db.' + s); }); cache = {}; return Promise.resolve(); }
    };
  }

  // ---------------------------------------------------------------------------
  // Init / change notification
  // ---------------------------------------------------------------------------
  function init() {
    return idbAdapter().catch(function (e) { console.warn('IndexedDB unavailable, using localStorage', e); return lsAdapter(); })
      .then(function (b) {
        backend = b;
        var names = Object.keys(KEYS);
        return Promise.all(names.map(function (n) { return b.getAll(n); }).concat([b.getAll('queue'), b.getAll('meta')]));
      })
      .then(function (res) {
        Object.keys(KEYS).forEach(function (n, i) { mem[n] = new Map(); res[i].forEach(function (r) { mem[n].set(r[KEYS[n]], r); }); });
        queue = new Map(); res[res.length - 2].forEach(function (op) { queue.set(op.QueueID, op); seq = Math.max(seq, op.seq || 0); });
        meta = {}; res[res.length - 1].forEach(function (m) { meta[m.k] = m.v; });
        changed();
      });
  }
  function changed() { version++; calcCache = null; listeners.forEach(function (fn) { try { fn(version); } catch (e) { console.error(e); } }); }
  function onChange(fn) { listeners.push(fn); }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------
  function isDeleted(r) { return r.Deleted === true || r.Deleted === 'TRUE'; }
  function all(entity, includeDeleted) {
    var out = [];
    (mem[entity] || new Map()).forEach(function (r) { if (includeDeleted || !isDeleted(r)) out.push(r); });
    return out;
  }
  function get(entity, id) { var r = mem[entity] && mem[entity].get(id); return r && !isDeleted(r) ? r : null; }
  function one(entity) { return all(entity)[0] || null; }
  function calcData() {
    if (calcCache) return calcCache;
    var d = {};
    Object.keys(CALC).forEach(function (n) { d[CALC[n]] = all(n); });
    return (calcCache = d);
  }
  function clean(rec) {
    var o = {};
    Object.keys(rec).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = rec[k]; });
    return o;
  }

  // ---------------------------------------------------------------------------
  // Writes (local first → queue)
  // ---------------------------------------------------------------------------
  function opsFor(entity, id) {
    var out = [];
    queue.forEach(function (op) { if (op.RecordType === entity && op.RecordID === id) out.push(op); });
    return out;
  }
  function enqueue(entity, rec, action) {
    var id = rec[KEYS[entity]], payload = clean(rec);
    var existing = opsFor(entity, id).filter(function (op) { return !inflight[op.QueueID]; })[0];
    if (existing) {
      existing.Action = action === 'DELETE' ? 'DELETE' : (existing.Action === 'CREATE' ? 'CREATE' : action);
      existing.Payload = payload;
      existing.seq = ++seq;
      return existing;
    }
    var op = { QueueID: U.uuid(), RecordType: entity, RecordID: id, Action: action, Payload: payload, CreatedAt: U.nowISO(), Status: 'PENDING', seq: ++seq };
    queue.set(op.QueueID, op);
    return op;
  }
  function persist(changes) {
    return backend.write(changes).catch(function (e) {
      console.error('Persist failed', e);
      if (R.UI) R.UI.toast('Gagal menyimpan ke perangkat: ' + (e && e.message || e), 'error');
      throw e;
    });
  }
  /** Create or update. Returns a Promise that resolves after the record AND its queue op are on disk. */
  function save(entity, input) {
    var key = KEYS[entity];
    var prev = input[key] ? mem[entity].get(input[key]) : null;
    var rec = Object.assign({}, prev || {}, input);
    if (!rec[key]) rec[key] = U.uuid();
    var now = U.nowISO();
    rec.CreatedAt = (prev && prev.CreatedAt) || rec.CreatedAt || now;
    rec.UpdatedAt = now;
    rec.Deleted = false;
    rec._dirty = true;
    delete rec._error;
    mem[entity].set(rec[key], rec);
    var op = enqueue(entity, rec, prev && !isDeleted(prev) ? 'UPDATE' : 'CREATE');
    changed();
    return persist([{ store: entity, put: rec }, { store: 'queue', put: op }]).then(function () { if (R.Sync) R.Sync.schedule(); return rec; });
  }
  /** Soft delete (tombstone is synced so other devices remove it too). */
  function remove(entity, id) {
    var prev = mem[entity].get(id);
    if (!prev) return Promise.resolve();
    var rec = Object.assign({}, prev, { Deleted: true, UpdatedAt: U.nowISO(), _dirty: true });
    mem[entity].set(id, rec);
    var op = enqueue(entity, rec, 'DELETE');
    changed();
    return persist([{ store: entity, put: rec }, { store: 'queue', put: op }]).then(function () { if (R.Sync) R.Sync.schedule(); });
  }
  /** Bulk save (import) in a single transaction. */
  function saveMany(items) {
    var changes = [], now = U.nowISO();
    items.forEach(function (it) {
      var key = KEYS[it.entity]; if (!key || !it.rec[key]) return;
      var prev = mem[it.entity].get(it.rec[key]);
      var rec = Object.assign({}, clean(it.rec), { UpdatedAt: now, _dirty: true });
      rec.CreatedAt = rec.CreatedAt || now;
      mem[it.entity].set(rec[key], rec);
      var op = enqueue(it.entity, rec, isDeleted(rec) ? 'DELETE' : (prev ? 'UPDATE' : 'CREATE'));
      changes.push({ store: it.entity, put: rec }, { store: 'queue', put: op });
    });
    changed();
    return persist(changes).then(function () { if (R.Sync) R.Sync.schedule(); return items.length; });
  }

  // ---------------------------------------------------------------------------
  // Sync support
  // ---------------------------------------------------------------------------
  function pendingOps(limit) {
    var ops = [];
    queue.forEach(function (op) { if (!inflight[op.QueueID]) ops.push(op); });
    ops.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    return limit ? ops.slice(0, limit) : ops;
  }
  function pendingCount() { return queue.size; }
  function markInflight(ops, on) { ops.forEach(function (op) { if (on) inflight[op.QueueID] = 1; else delete inflight[op.QueueID]; }); }

  /** Apply the server's push result. Returns { conflicts, rejected } for user feedback. */
  function ackPush(result) {
    var changes = [], out = { conflicts: [], rejected: [] };
    function settle(type, id, fn) {
      var key = KEYS[type]; if (!key) return;
      var stillPending = opsFor(type, id).length > 0;
      var rec = mem[type].get(id);
      var next = fn(rec, stillPending);
      if (next) { mem[type].set(id, next); changes.push({ store: type, put: next }); }
    }
    function drop(qid) { queue.delete(qid); delete inflight[qid]; changes.push({ store: 'queue', del: qid }); }
    (result.applied || []).forEach(function (a) {
      drop(a.QueueID);
      settle(a.RecordType, a.RecordID, function (rec, pending) {
        if (!rec) return null;
        var n = Object.assign({}, rec, { ServerRev: a.ServerRev });
        if (!pending) { n._dirty = false; delete n._error; }
        return n;
      });
    });
    (result.conflicts || []).forEach(function (c) {
      drop(c.QueueID); out.conflicts.push(c);
      settle(c.RecordType, c.RecordID, function (rec, pending) { return pending ? null : Object.assign({}, c.server, { _dirty: false }); });
    });
    (result.rejected || []).forEach(function (r) {
      drop(r.QueueID); out.rejected.push(r);
      settle(r.RecordType, r.RecordID, function (rec, pending) {
        if (!rec) return null;
        var n = Object.assign({}, rec, { _error: r.message });
        if (!pending) n._dirty = false;
        return n;
      });
    });
    changed();
    return persist(changes).then(function () { return out; });
  }

  /** Merge pulled records; local records with unsynced changes are never overwritten. */
  function applyServer(tables) {
    var changes = [], n = 0;
    Object.keys(tables || {}).forEach(function (type) {
      var key = KEYS[type]; if (!key) return;
      (tables[type] || []).forEach(function (srv) {
        var id = srv[key], local = mem[type].get(id);
        if (local && local._dirty) return;
        if (local && local.ServerRev && srv.ServerRev && Number(local.ServerRev) > Number(srv.ServerRev)) return;
        var rec = Object.assign({}, srv, { _dirty: false });
        mem[type].set(id, rec); changes.push({ store: type, put: rec }); n++;
      });
    });
    if (n) changed();
    return persist(changes).then(function () { return n; });
  }

  function getMeta(k, d) { return k in meta ? meta[k] : d; }
  function setMeta(k, v) { meta[k] = v; return persist([{ store: 'meta', put: { k: k, v: v } }]); }
  function wipe() {
    Object.keys(KEYS).forEach(function (n) { mem[n] = new Map(); });
    queue = new Map(); meta = {}; inflight = {};
    changed();
    return backend.clear();
  }
  function hasData() { return Object.keys(KEYS).some(function (n) { return mem[n] && mem[n].size > 0; }); }
  function exportAll() {
    var d = { app: 'Resilia', format: 1, exportedAt: U.nowISO(), tables: {} };
    Object.keys(KEYS).forEach(function (n) { d.tables[n] = all(n, true).map(clean); });
    return d;
  }

  return {
    KEYS: KEYS, init: init, onChange: onChange, all: all, get: get, one: one, calcData: calcData,
    save: save, remove: remove, saveMany: saveMany, pendingOps: pendingOps, pendingCount: pendingCount, markInflight: markInflight,
    ackPush: ackPush, applyServer: applyServer, getMeta: getMeta, setMeta: setMeta, wipe: wipe, hasData: hasData, exportAll: exportAll,
    version: function () { return version; }, backendKind: function () { return backend ? backend.kind : '-'; },
    hasPending: function (entity, id) { return opsFor(entity, id).length > 0; }
  };
})();

;
/* ==== js/core/api.js ==== */
/* Resilia — core/api.js
 * One call() for both transports:
 *   mode "gas" → google.script.run.api(req)            (served by HtmlService)
 *   mode "pwa" → fetch POST text/plain to the /exec URL (installable PWA on a static host)
 * Always resolves to the envelope { success, data, message, error } — never throws.
 * Client-side error codes: OFFLINE, NETWORK, TIMEOUT, NOT_CONFIGURED, BAD_RESPONSE.
 */
R.Api = (function () {
  'use strict';
  var U = R.U;
  var cfg = window.RESILIA_CONFIG || {};
  var mode = cfg.mode === 'gas' && window.google && google.script ? 'gas' : 'pwa';

  function apiUrl() { return U.LS.get('apiUrl', '') || cfg.apiUrl || ''; }
  function setApiUrl(u) { U.LS.set('apiUrl', String(u || '').trim()); }
  function fail(code, message) { return { success: false, data: null, message: message, error: { code: code } }; }

  function viaGas(req, timeout) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(fail('TIMEOUT', 'Server tidak merespons. Coba lagi.')); } }, timeout);
      google.script.run
        .withSuccessHandler(function (res) { if (done) return; done = true; clearTimeout(timer); resolve(res && typeof res === 'object' ? res : fail('BAD_RESPONSE', 'Respons server tidak valid.')); })
        .withFailureHandler(function (err) { if (done) return; done = true; clearTimeout(timer); resolve(fail(navigator.onLine ? 'NETWORK' : 'OFFLINE', 'Tidak dapat menghubungi server' + (err && err.message ? ': ' + err.message : '.'))); })
        .api(req);
    });
  }

  function viaFetch(req, timeout) {
    var url = apiUrl();
    if (!url) return Promise.resolve(fail('NOT_CONFIGURED', 'URL server belum diatur.'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout);
    return fetch(url, {
      method: 'POST', redirect: 'follow', cache: 'no-store', credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request → no CORS preflight
      body: JSON.stringify(req), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        try { var j = JSON.parse(t); if (j && typeof j.success === 'boolean') return j; } catch (e) { /* fallthrough */ }
        return fail('BAD_RESPONSE', r.ok ? 'Respons server tidak valid. Periksa URL Web App & akses deployment ("Anyone").' : 'Server error HTTP ' + r.status + '.');
      });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return fail('TIMEOUT', 'Server tidak merespons. Coba lagi.');
      return fail(navigator.onLine ? 'NETWORK' : 'OFFLINE', navigator.onLine ? 'Tidak dapat menghubungi server.' : 'Anda sedang offline.');
    }).then(function (res) { clearTimeout(timer); return res; });
  }

  /** call(action, payload, {timeout, noAuth}) */
  function call(action, payload, opts) {
    opts = opts || {};
    if (!navigator.onLine && !opts.ignoreOffline) return Promise.resolve(fail('OFFLINE', 'Anda sedang offline.'));
    var req = { action: action, payload: payload || {} };
    if (!opts.noAuth) req.token = R.Auth ? R.Auth.token() : null;
    var timeout = opts.timeout || 30000;
    var p = mode === 'gas' ? viaGas(req, timeout) : viaFetch(req, timeout);
    return p.then(function (res) {
      if (!res.success && res.error && (res.error.code === 'AUTH_INVALID' || res.error.code === 'AUTH_REQUIRED') && !opts.noAuth && R.Auth) R.Auth.sessionInvalid(res.message);
      return res;
    });
  }

  function isNetworkError(res) { return res && res.error && ['OFFLINE', 'NETWORK', 'TIMEOUT'].indexOf(res.error.code) >= 0; }

  return { call: call, mode: function () { return mode; }, apiUrl: apiUrl, setApiUrl: setApiUrl, isNetworkError: isNetworkError };
})();

;
/* ==== js/core/ui.js ==== */
/* Resilia — core/ui.js
 * Dialogs (SweetAlert2 with native fallback), toasts, and a declarative bottom-sheet form builder.
 */
R.UI = (function () {
  'use strict';
  var U = R.U;
  function swal() { return window.Swal && typeof window.Swal.fire === 'function' ? window.Swal : null; }

  // ---------------------------------------------------------------------------
  // Dialogs
  // ---------------------------------------------------------------------------
  function alert(title, html, icon) {
    var S = swal();
    if (!S) { window.alert(title + (html ? '\n\n' + String(html).replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '') : '')); return Promise.resolve(); }
    return S.fire({ title: title, html: html || '', icon: icon || 'info', confirmButtonText: 'OK' });
  }
  function confirm(title, html, o) {
    o = o || {};
    var S = swal();
    if (!S) return Promise.resolve(window.confirm(title + (html ? '\n\n' + String(html).replace(/<[^>]+>/g, '') : '')));
    return S.fire({
      title: title, html: html || '', icon: o.icon || (o.danger ? 'warning' : 'question'), showCancelButton: true, reverseButtons: true, focusCancel: !!o.danger,
      confirmButtonText: o.confirmText || 'Ya', cancelButtonText: o.cancelText || 'Batal',
      customClass: o.danger ? { confirmButton: 'swal2-confirm swal2-styled danger' } : undefined
    }).then(function (r) { return !!r.isConfirmed; });
  }
  /** Typed confirmation for destructive actions. */
  function confirmTyped(title, html, word) {
    var S = swal();
    if (!S) return Promise.resolve(window.prompt(title + '\nKetik ' + word + ' untuk melanjutkan') === word);
    return S.fire({
      title: title, html: html + '<br><br>Ketik <b>' + word + '</b> untuk melanjutkan.', icon: 'warning', input: 'text', inputPlaceholder: word,
      showCancelButton: true, reverseButtons: true, confirmButtonText: 'Lanjutkan', cancelButtonText: 'Batal',
      customClass: { confirmButton: 'swal2-confirm swal2-styled danger' },
      inputValidator: function (v) { return v === word ? null : 'Ketik ' + word + ' dengan tepat'; }
    }).then(function (r) { return !!r.isConfirmed; });
  }
  var toastEl = null, toastTimer = null;
  function toast(msg, icon) {
    var S = swal();
    if (S) {
      S.fire({ toast: true, position: window.innerWidth >= 1080 ? 'bottom-end' : 'top', icon: icon === 'error' ? 'error' : (icon || 'success'), title: msg, showConfirmButton: false, timer: 2600, timerProgressBar: true });
      return;
    }
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.add('hidden'); }, 2600);
  }
  function loading(title, text) {
    var S = swal(); if (!S) return;
    S.fire({ title: title || 'Memuat…', html: text || '', allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, didOpen: function () { S.showLoading(); } });
  }
  function closeLoading() { var S = swal(); if (S && S.isVisible()) S.close(); }

  // ---------------------------------------------------------------------------
  // Sheet form
  // ---------------------------------------------------------------------------
  var openSheets = 0;
  function optHTML(o, v) { return '<option value="' + U.esc(o.value) + '"' + (String(o.value) === String(v) ? ' selected' : '') + '>' + U.esc(o.label) + '</option>'; }

  function fieldHTML(f, v) {
    var id = 'f-' + f.name, req = f.required ? ' required' : '', ph = f.placeholder ? ' placeholder="' + U.esc(f.placeholder) + '"' : '';
    var label = f.label ? '<label for="' + id + '">' + U.esc(f.label) + (f.required ? '' : ' <span class="muted">(opsional)</span>') + '</label>' : '';
    var hint = f.hint ? '<div class="hint">' + f.hint + '</div>' : '';
    var inner = '';
    switch (f.type) {
      case 'money':
        inner = '<input id="' + id + '" name="' + f.name + '" type="text" inputmode="decimal" autocomplete="off" value="' + U.esc(U.moneyInputValue(v)) + '"' + ph + req + '>';
        return '<div class="field money" data-f="' + f.name + '">' + label + inner + hint + '<div class="err"></div></div>';
      case 'number':
        inner = '<input id="' + id + '" name="' + f.name + '" type="number" inputmode="decimal" step="' + (f.step || 'any') + '"' + (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') + ' value="' + U.esc(v === undefined || v === null ? '' : v) + '"' + ph + req + '>';
        break;
      case 'select':
        inner = '<select id="' + id + '" name="' + f.name + '"' + req + '>' + (f.empty ? '<option value="">' + U.esc(f.empty) + '</option>' : '') + (f.options || []).map(function (o) { return optHTML(o, v); }).join('') + '</select>';
        break;
      case 'textarea':
        inner = '<textarea id="' + id + '" name="' + f.name + '" maxlength="' + (f.maxlength || 500) + '"' + ph + '>' + U.esc(v || '') + '</textarea>';
        break;
      case 'toggle':
        return '<div class="field" data-f="' + f.name + '"><label class="toggle"><span><b style="font-weight:650">' + U.esc(f.label) + '</b>' + (f.hint ? '<br><span class="hint">' + f.hint + '</span>' : '') + '</span><input type="checkbox" name="' + f.name + '"' + (v ? ' checked' : '') + '><span class="sw"></span></label></div>';
      case 'seg':
        inner = '<div class="seg full" style="--n:' + f.options.length + '">' + f.options.map(function (o) { return '<button type="button" data-v="' + U.esc(o.value) + '" class="' + (String(o.value) === String(v) ? 'on' : '') + '">' + U.esc(o.label) + '</button>'; }).join('') + '</div>';
        return '<div class="field" data-f="' + f.name + '" data-kind="seg">' + (f.label ? '<span class="flabel">' + U.esc(f.label) + '</span>' : '') + inner + hint + '<div class="err"></div></div>';
      case 'chips':
        inner = '<div class="cat-chips">' + (f.options || []).map(function (o) { return '<button type="button" data-v="' + U.esc(o.value) + '" class="' + (String(o.value) === String(v) ? 'on' : '') + '">' + (o.icon ? '<span>' + U.esc(o.icon) + '</span>' : '') + U.esc(o.label) + '</button>'; }).join('') + '</div>';
        return '<div class="field" data-f="' + f.name + '" data-kind="chips"><span class="flabel">' + U.esc(f.label) + '</span>' + inner + hint + '<div class="err"></div></div>';
      case 'html':
        return '<div class="field" data-f="' + f.name + '">' + (f.html || '') + '</div>';
      default:
        inner = '<input id="' + id + '" name="' + f.name + '" type="' + (f.type || 'text') + '"' + (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + ' value="' + U.esc(v === undefined || v === null ? '' : v) + '"' + ph + req + ' autocomplete="off">';
    }
    return '<div class="field" data-f="' + f.name + '">' + label + inner + hint + '<div class="err"></div></div>';
  }

  /**
   * form({ title, fields, values, submitText, onSubmit(values) → Promise|false, onChange(values, api), buttons:[{text, cls, onClick(values, api)}], validate(values) → {field: msg} })
   * Resolves with the onSubmit result, or null when dismissed.
   */
  function form(cfg) {
    return new Promise(function (resolve) {
      var root = document.getElementById('sheet-root');
      var values = Object.assign({}, cfg.values || {});
      cfg.fields.forEach(function (f) { if (!(f.name in values) && f.value !== undefined) values[f.name] = f.value; });
      var back = document.createElement('div'); back.className = 'sheet-backdrop';
      var sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
      sh.innerHTML = '<div class="sheet-h"><h3>' + U.esc(cfg.title) + '</h3><button class="icon-btn" type="button" data-close aria-label="Tutup">' + U.icon('x') + '</button></div>' +
        '<form class="sheet-b" novalidate></form>' +
        '<div class="sheet-f">' + (cfg.buttons || []).map(function (b, i) { return '<button type="button" class="btn ' + (b.cls || '') + '" data-btn="' + i + '">' + U.esc(b.text) + '</button>'; }).join('') +
        '<button type="button" class="btn primary" data-submit>' + U.esc(cfg.submitText || 'Simpan') + '</button></div>';
      root.appendChild(back); root.appendChild(sh);
      var body = sh.querySelector('.sheet-b');
      var closed = false, busy = false;
      openSheets++;

      function render() {
        body.innerHTML = cfg.fields.map(function (f) { return fieldHTML(f, values[f.name]); }).join('') + '<button type="submit" hidden></button>';
        visibility();
      }
      function visibility() {
        cfg.fields.forEach(function (f) {
          var el = body.querySelector('[data-f="' + f.name + '"]');
          if (el && f.show) el.classList.toggle('hidden', !f.show(values));
        });
      }
      function fieldDef(name) { return cfg.fields.filter(function (f) { return f.name === name; })[0]; }
      function read(target) {
        var name = target.name; if (!name) return;
        var f = fieldDef(name); if (!f) return;
        if (f.type === 'toggle') values[name] = target.checked;
        else if (f.type === 'money') {
          values[name] = target.value.trim() === '' ? '' : U.parseMoney(target.value);
          var formatted = target.value.trim() === '' ? '' : U.moneyInputValue(values[name]);
          if (!/[,.]$/.test(target.value) && target.value !== formatted && !/,\d?$/.test(target.value)) target.value = formatted;
        } else if (f.type === 'number') values[name] = target.value === '' ? '' : Number(target.value);
        else values[name] = target.value;
        changed(name);
      }
      var api = {
        values: values,
        set: function (name, v) { values[name] = v; var f = fieldDef(name); var el = body.querySelector('[data-f="' + name + '"]'); if (f && el) el.outerHTML = fieldHTML(f, v); visibility(); },
        setOptions: function (name, options, v) { var f = fieldDef(name); f.options = options; if (v !== undefined) values[name] = v; api.set(name, values[name]); },
        close: function (r) { close(r); },
        validate: function () { return validate(); }
      };
      function changed(name) { clearErr(name); if (cfg.onChange) cfg.onChange(values, api, name); visibility(); }
      function clearErr(name) { var el = body.querySelector('[data-f="' + name + '"]'); if (el) { el.classList.remove('invalid'); var e = el.querySelector('.err'); if (e) e.textContent = ''; } }
      function setErr(name, msg) { var el = body.querySelector('[data-f="' + name + '"]'); if (el) { el.classList.add('invalid'); var e = el.querySelector('.err'); if (e) e.textContent = msg; } }

      body.addEventListener('input', function (e) { read(e.target); });
      body.addEventListener('change', function (e) { read(e.target); });
      U.on(body, 'click', '[data-kind="seg"] button, [data-kind="chips"] button', function (e, b) {
        var wrap = b.closest('[data-f]'), name = wrap.getAttribute('data-f');
        U.$$('button', wrap).forEach(function (x) { x.classList.toggle('on', x === b); });
        values[name] = b.getAttribute('data-v');
        changed(name);
      });
      body.addEventListener('submit', function (e) { e.preventDefault(); submit(); });

      function validate() {
        var errs = {}, first = null;
        cfg.fields.forEach(function (f) {
          if (f.show && !f.show(values)) return;
          var v = values[f.name];
          if (f.required && (v === '' || v === undefined || v === null || (f.type === 'money' && !(Number(v) > 0) && !f.allowZero))) errs[f.name] = f.requiredMsg || 'Wajib diisi';
          else if ((f.type === 'number' || f.type === 'money') && v !== '' && v !== undefined) {
            if (f.min !== undefined && Number(v) < f.min) errs[f.name] = 'Minimal ' + f.min;
            if (f.max !== undefined && Number(v) > f.max) errs[f.name] = 'Maksimal ' + f.max;
          }
        });
        if (cfg.validate) Object.assign(errs, cfg.validate(values) || {});
        Object.keys(errs).forEach(function (k) { setErr(k, errs[k]); if (!first) first = k; });
        if (first) { var el = body.querySelector('[data-f="' + first + '"]'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return !first;
      }
      function setBusy(b) { busy = b; U.$$('.sheet-f button', sh).forEach(function (x) { x.disabled = b; }); }
      function submit() {
        if (busy || !validate()) return;
        setBusy(true);
        Promise.resolve(cfg.onSubmit ? cfg.onSubmit(values, api) : values).then(function (r) {
          setBusy(false);
          if (r !== false) close(r === undefined ? true : r);
        }, function (err) { setBusy(false); alert('Gagal menyimpan', U.esc(err && err.message || err), 'error'); });
      }
      sh.querySelector('[data-submit]').addEventListener('click', submit);
      U.on(sh, 'click', '[data-btn]', function (e, b) {
        var def = cfg.buttons[+b.getAttribute('data-btn')];
        setBusy(true);
        Promise.resolve(def.onClick(values, api)).then(function (r) { setBusy(false); if (r !== false) close(r); }, function () { setBusy(false); });
      });
      sh.querySelector('[data-close]').addEventListener('click', function () { close(null); });
      back.addEventListener('click', function () { close(null); });
      function onKey(e) { if (e.key === 'Escape' && !(window.Swal && Swal.isVisible())) close(null); }
      document.addEventListener('keydown', onKey);
      if (R.Router) R.Router.pushOverlay(function () { close(null, true); });

      function close(result, fromHistory) {
        if (closed) return; closed = true; openSheets--;
        document.removeEventListener('keydown', onKey);
        if (!fromHistory && R.Router) R.Router.popOverlay();
        sh.classList.remove('open'); back.classList.remove('open');
        setTimeout(function () { sh.remove(); back.remove(); }, 260);
        resolve(result);
      }

      render();
      requestAnimationFrame(function () {
        back.classList.add('open'); sh.classList.add('open');
        var first = body.querySelector(cfg.autofocus ? '[name="' + cfg.autofocus + '"]' : 'input:not([type=checkbox]),select');
        if (first && window.innerWidth >= 720) setTimeout(function () { first.focus(); }, 200);
        if (cfg.autofocus && first) setTimeout(function () { first.focus(); }, 260);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Small render helpers shared by views
  // ---------------------------------------------------------------------------
  function bar(frac, color, thick) { return '<div class="bar ' + (color || '') + (thick ? ' thick' : '') + '"><i style="width:' + Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%"></i></div>'; }
  function empty(ico, text, btn) { return '<div class="empty"><div class="e-ico">' + ico + '</div><div>' + text + '</div>' + (btn || '') + '</div>'; }
  function chip(text, color) { return '<span class="chip ' + (color || '') + '">' + text + '</span>'; }
  function ring(score, max, color, label) {
    var r = 44, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, score / max));
    return '<div class="ring"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="' + r + '" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="9"/>' +
      '<circle cx="52" cy="52" r="' + r + '" fill="none" style="stroke:' + (color || 'currentColor') + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg>' +
      '<div class="rv"><div>' + (label === '%' ? '<b>' + Math.round(f * 100) + '%</b>' : '<b>' + Math.round(score) + '</b><small>/ ' + max + (label ? '<br>' + label : '') + '</small>') + '</div></div></div>';
  }
  var COLOR = { green: 'var(--good)', yellow: '#D4A017', orange: 'var(--orange)', red: 'var(--bad)', gray: 'var(--gray)' };
  function colorVar(c) { return COLOR[c] || c; }
  function disclaimer(text) { return '<div class="disclaimer">ⓘ ' + (text || 'Angka di atas adalah estimasi berdasarkan asumsi yang Anda masukkan, bukan jaminan hasil. Aplikasi ini hanya mencatat dan menghitung — bukan nasihat investasi personal.') + '</div>'; }

  return {
    alert: alert, confirm: confirm, confirmTyped: confirmTyped, toast: toast, loading: loading, closeLoading: closeLoading, form: form,
    bar: bar, empty: empty, chip: chip, ring: ring, colorVar: colorVar, disclaimer: disclaimer, sheetOpen: function () { return openSheets > 0; }
  };
})();

;
/* ==== js/core/charts.js ==== */
/* Resilia — core/charts.js : dependency-free SVG charts (bars, line, donut). Works offline, themed via CSS vars. */
R.Charts = (function () {
  'use strict';
  var U = R.U;
  var PALETTE = ['#0B5D4B', '#C8962E', '#2563EB', '#DB2777', '#7C3AED', '#EA580C', '#0E7490', '#65A30D', '#B91C1C', '#64748B'];

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function width(el) { return Math.max(260, Math.round((el.clientWidth || el.parentNode.clientWidth || 320))); }
  function svg(w, h, inner, label) { return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + U.esc(label || 'grafik') + '">' + inner + '</svg>'; }
  function legend(items) { return '<div class="legend">' + items.map(function (i) { return '<span><i style="background:' + i.color + '"></i>' + U.esc(i.label) + '</span>'; }).join('') + '</div>'; }

  /** Grouped bars. o = { labels, series:[{name,color,values}], height, highlight } */
  function bars(el, o) {
    var w = width(el), h = o.height || 190, padL = 46, padB = 22, padT = 8, ch = h - padB - padT, cw = w - padL - 6;
    var max = 0, min = 0;
    o.series.forEach(function (s) { s.values.forEach(function (v) { max = Math.max(max, v); min = Math.min(min, v); }); });
    max = niceMax(max); min = min < 0 ? -niceMax(-min) : 0;
    var range = max - min || 1, y = function (v) { return padT + ch - (v - min) / range * ch; };
    var n = o.labels.length, gw = cw / n, bw = Math.min(22, (gw * 0.72) / o.series.length);
    var g = '';
    for (var t = 0; t <= 4; t++) {
      var v = min + range * t / 4, yy = y(v);
      g += '<line x1="' + padL + '" x2="' + w + '" y1="' + yy + '" y2="' + yy + '" stroke="currentColor" stroke-opacity=".08"/>';
      g += '<text x="' + (padL - 6) + '" y="' + (yy + 3.5) + '" text-anchor="end">' + U.esc(U.moneyShort(v).replace('Rp', '')) + '</text>';
    }
    o.labels.forEach(function (lab, i) {
      var gx = padL + gw * i + (gw - bw * o.series.length) / 2;
      if (o.highlight === i) g += '<rect x="' + (padL + gw * i + 2) + '" y="' + padT + '" width="' + (gw - 4) + '" height="' + ch + '" rx="6" fill="currentColor" fill-opacity=".05"/>';
      o.series.forEach(function (s, j) {
        var v = s.values[i] || 0, y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v));
        g += '<rect x="' + (gx + j * bw).toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + Math.max(1, y1 - y0).toFixed(1) + '" rx="3" style="fill:' + s.color + '"><title>' + U.esc(s.name + ' ' + lab + ': ' + U.money(v)) + '</title></rect>';
      });
      g += '<text x="' + (padL + gw * i + gw / 2) + '" y="' + (h - 6) + '" text-anchor="middle">' + U.esc(lab) + '</text>';
    });
    el.innerHTML = '<div class="chart" style="color:var(--ink)">' + svg(w, h, g, o.label) + '</div>' + (o.series.length > 1 ? legend(o.series.map(function (s) { return { label: s.name, color: s.color }; })) : '');
  }

  /** Line / area. o = { labels, values, color, height, zero } */
  function line(el, o) {
    var w = width(el), h = o.height || 170, padL = 46, padB = 22, padT = 10, ch = h - padB - padT, cw = w - padL - 12;
    var vals = o.values, n = vals.length;
    if (!n) { el.innerHTML = ''; return; }
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    if (max === min) { max += Math.abs(max) * 0.1 || 1; min -= Math.abs(min) * 0.1 || 1; }
    var pad = (max - min) * 0.12; max += pad; min -= pad;
    var x = function (i) { return padL + (n === 1 ? cw / 2 : cw * i / (n - 1)); }, y = function (v) { return padT + ch - (v - min) / (max - min) * ch; };
    var color = o.color || 'var(--brand)', g = '';
    for (var t = 0; t <= 3; t++) {
      var v = min + (max - min) * t / 3, yy = y(v);
      g += '<line x1="' + padL + '" x2="' + w + '" y1="' + yy + '" y2="' + yy + '" stroke="currentColor" stroke-opacity=".08"/><text x="' + (padL - 6) + '" y="' + (yy + 3.5) + '" text-anchor="end">' + U.esc(U.moneyShort(v).replace('Rp', '')) + '</text>';
    }
    if (min < 0 && max > 0) g += '<line x1="' + padL + '" x2="' + w + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="3 3"/>';
    var pts = vals.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
    g += '<path d="M' + pts.join(' L') + ' L' + x(n - 1).toFixed(1) + ',' + (padT + ch) + ' L' + x(0).toFixed(1) + ',' + (padT + ch) + 'Z" style="fill:' + color + '" fill-opacity=".1"/>';
    g += '<polyline points="' + pts.join(' ') + '" fill="none" style="stroke:' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    vals.forEach(function (v, i) {
      g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (i === n - 1 ? 4.5 : 3) + '" style="fill:' + color + '"><title>' + U.esc(o.labels[i] + ': ' + U.money(v)) + '</title></circle>';
    });
    var step = Math.ceil(n / 7);
    o.labels.forEach(function (lab, i) { if (i % step === 0 || i === n - 1) g += '<text x="' + x(i) + '" y="' + (h - 6) + '" text-anchor="middle">' + U.esc(lab) + '</text>'; });
    el.innerHTML = '<div class="chart" style="color:var(--ink)">' + svg(w, h, g, o.label) + '</div>';
  }

  /** Donut + legend list. o = { items:[{label,value,color?}], center, sub } */
  function donut(el, o) {
    var items = o.items.filter(function (i) { return i.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    if (!total) { el.innerHTML = ''; return; }
    if (items.length > 7) {
      var rest = items.slice(6).reduce(function (s, i) { return s + i.value; }, 0);
      items = items.slice(0, 6).concat([{ label: 'Lainnya', value: rest, color: '#94A3B8' }]);
    }
    var R0 = 54, r1 = 36, cx = 60, cy = 60, a = -Math.PI / 2, g = '';
    items.forEach(function (it, i) {
      it.color = it.color || PALETTE[i % PALETTE.length];
      var frac = it.value / total, a2 = a + frac * Math.PI * 2;
      if (frac >= 0.9999) { g += '<circle cx="60" cy="60" r="' + ((R0 + r1) / 2) + '" fill="none" style="stroke:' + it.color + '" stroke-width="' + (R0 - r1) + '"/>'; }
      else {
        var large = frac > 0.5 ? 1 : 0;
        var p = function (ang, rr) { return (cx + rr * Math.cos(ang)).toFixed(2) + ' ' + (cy + rr * Math.sin(ang)).toFixed(2); };
        g += '<path d="M' + p(a, R0) + ' A' + R0 + ' ' + R0 + ' 0 ' + large + ' 1 ' + p(a2, R0) + ' L' + p(a2, r1) + ' A' + r1 + ' ' + r1 + ' 0 ' + large + ' 0 ' + p(a, r1) + 'Z" style="fill:' + it.color + ';stroke:var(--surface)" stroke-width="1.5"><title>' + U.esc(it.label + ': ' + U.money(it.value)) + '</title></path>';
      }
      a = a2;
    });
    if (o.center) g += '<text x="60" y="' + (o.sub ? 58 : 64) + '" text-anchor="middle" style="font-size:12px;font-weight:700;fill:var(--ink)">' + U.esc(o.center) + '</text>';
    if (o.sub) g += '<text x="60" y="72" text-anchor="middle" style="font-size:9px">' + U.esc(o.sub) + '</text>';
    var list = '<ul class="list" style="flex:1;min-width:0">' + items.map(function (it) {
      return '<li class="row between" style="padding:5px 0;font-size:13.5px"><span class="row ellipsis" style="gap:8px"><i style="width:10px;height:10px;border-radius:3px;background:' + it.color + ';flex:none"></i><span class="ellipsis">' + U.esc(it.label) + '</span></span>' +
        '<span class="num" style="white-space:nowrap"><b>' + U.pct(it.value / total * 100, 0) + '</b> <span class="muted xs">' + U.moneyShort(it.value) + '</span></span></li>';
    }).join('') + '</ul>';
    el.innerHTML = '<div class="row" style="gap:16px;align-items:center"><div class="chart" style="width:128px;flex:none">' + svg(120, 120, g, o.label) + '</div>' + list + '</div>';
  }

  return { bars: bars, line: line, donut: donut, PALETTE: PALETTE };
})();

;
/* ==== js/core/router.js ==== */
/* Resilia — core/router.js
 * SPA-like navigation: menu links are href="javascript:void(0)" data-nav="id";
 * showSection()/hideSection() toggle <section id="sec-…">. Sections render lazily and
 * only re-render when local data changed since their last render.
 * In PWA mode the browser/Android back button is wired via history.pushState.
 */
R.Router = (function () {
  'use strict';
  var U = R.U;
  var current = null, params = {}, rendered = {}, overlays = [], ignorePop = 0, stack = [];
  var TOP = { dashboard: 1, transactions: 1, goals: 1, assets: 1, more: 1 };
  var NAV_OF = { cashflow: 'more', budget: 'more', emergency: 'more', debt: 'more', retirement: 'more', resilience: 'more', plan: 'more', reports: 'more', settings: 'more' };
  var useHistory = false;

  function sectionEl(id) { return document.getElementById('sec-' + id); }
  function hideSection(id) { var el = sectionEl(id); if (el) el.classList.add('hidden'); }
  function showSection(id) {
    var el = sectionEl(id); if (!el) return;
    el.classList.remove('hidden');
    render(id);
  }
  function render(id, force) {
    var el = sectionEl(id), view = R.Views[id];
    if (!el || !view) return;
    var key = R.Store.version() + '|' + U.today();
    if (!force && rendered[id] === key) return;
    rendered[id] = key;
    try { view.render(el, params[id] || {}); }
    catch (e) { console.error(e); el.innerHTML = '<div class="card">' + R.UI.empty('⚠', 'Gagal menampilkan halaman: ' + U.esc(e.message)) + '</div>'; }
  }

  function go(id, p, o) {
    o = o || {};
    if (!R.Views[id]) id = 'dashboard';
    if (p) { params[id] = p; rendered[id] = null; }
    if (current && current !== id) { hideSection(current); if (!o.fromHistory) stack.push(current); }
    var changed = current !== id;
    current = id;
    showSection(id);
    var el = sectionEl(id);
    document.getElementById('page-title').textContent = el.getAttribute('data-title');
    var navId = TOP[id] ? id : (NAV_OF[id] || 'more');
    U.$$('[data-nav]').forEach(function (a) {
      var t = a.getAttribute('data-nav');
      a.classList.toggle('active', a.closest('.sidebar') ? t === id : t === navId);
    });
    document.getElementById('btn-back').classList.toggle('hidden', !!TOP[id] || window.innerWidth >= 1080);
    if (changed) window.scrollTo(0, 0);
    if (useHistory && changed && !o.fromHistory) history.pushState({ sec: id }, '', '#' + id);
    U.LS.set('lastSection', id);
  }
  function back() {
    if (useHistory) { history.back(); return; }
    go(stack.pop() || (NAV_OF[current] ? 'more' : 'dashboard'), null, { fromHistory: true });
  }
  /** Re-render the visible section (after data change); other sections become stale automatically. */
  var refreshCurrent = U.debounce(function () { if (current) render(current); }, 120);

  // ---- overlays (bottom sheets) integrate with the back button ----
  function pushOverlay(closeFn) { overlays.push(closeFn); if (useHistory) history.pushState({ overlay: overlays.length }, ''); }
  function popOverlay() { overlays.pop(); if (useHistory) { ignorePop++; history.back(); } }

  function init() {
    useHistory = R.Api.mode() === 'pwa' && !!(window.history && history.pushState);
    U.on(document.body, 'click', '[data-nav]', function (e, a) { e.preventDefault(); go(a.getAttribute('data-nav')); });
    document.getElementById('btn-back').addEventListener('click', back);
    R.Store.onChange(refreshCurrent);
    window.addEventListener('resize', U.debounce(function () { if (current) render(current, true); }, 250));
    window.addEventListener('scroll', function () { document.getElementById('topbar').classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
    if (useHistory) {
      history.replaceState({ sec: 'dashboard' }, '', location.pathname + location.search);
      window.addEventListener('popstate', function (e) {
        if (ignorePop) { ignorePop--; return; }
        if (overlays.length) { var fn = overlays.pop(); fn(); return; }
        var s = e.state && e.state.sec;
        go(s || 'dashboard', null, { fromHistory: true });
      });
    }
  }

  return {
    init: init, go: go, back: back, render: render, showSection: showSection, hideSection: hideSection,
    current: function () { return current; }, refreshCurrent: refreshCurrent, pushOverlay: pushOverlay, popOverlay: popOverlay,
    invalidate: function () { rendered = {}; }
  };
})();
R.Views = R.Views || {};

;
/* ==== js/core/auth.js ==== */
/* Resilia — core/auth.js
 * PIN login (verified server-side), Lock App, Auto-Lock, Logout.
 * The PIN is never stored. Only the session token is kept (localStorage).
 * Offline unlock (optional) uses a PBKDF2-SHA256 verifier created at the last online login:
 * a deterrent against casual access, not encryption — see ARCHITECTURE §6.
 */
R.Auth = (function () {
  'use strict';
  var U = R.U, LS = U.LS;
  var PBKDF2_ITER = 210000;
  var pin = '', pinMode = 'login', busy = false, lockTimer = null, lastActiveWrite = 0, onUnlocked = null;

  function token() { var t = LS.get('token', null); return t && t.exp > Date.now() ? t.value : null; }
  function settings() { return { autoLockMin: LS.get('autoLockMin', 5), offlineUnlock: LS.get('offlineUnlock', true) }; }
  function setSetting(k, v) { LS.set(k, v); if (k === 'offlineUnlock' && !v) LS.del('verifier'); }

  // ---------------------------------------------------------------------------
  // Offline verifier (PBKDF2)
  // ---------------------------------------------------------------------------
  function subtleOK() { return !!(window.crypto && crypto.subtle && window.TextEncoder); }
  function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b + 256).toString(16).slice(1); }).join(''); }
  function derive(p, saltHex, iter) {
    var salt = new Uint8Array(saltHex.match(/../g).map(function (h) { return parseInt(h, 16); }));
    return crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) { return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, k, 256); })
      .then(toHex);
  }
  function makeVerifier(p) {
    if (!settings().offlineUnlock || !subtleOK()) return Promise.resolve();
    var salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    return derive(p, salt, PBKDF2_ITER).then(function (h) { LS.set('verifier', { salt: salt, hash: h, iter: PBKDF2_ITER }); }).catch(function () { /* optional */ });
  }
  function checkVerifier(p) {
    var v = LS.get('verifier', null);
    if (!v || !subtleOK()) return Promise.resolve(null);
    return derive(p, v.salt, v.iter).then(function (h) {
      var diff = h.length ^ v.hash.length;
      for (var i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ v.hash.charCodeAt(i);
      return diff === 0;
    });
  }

  // ---------------------------------------------------------------------------
  // Login / unlock
  // ---------------------------------------------------------------------------
  function serverLogin(p) {
    return R.Api.call('auth.login', { pin: p, deviceName: U.deviceName() }, { noAuth: true, timeout: 30000 }).then(function (res) {
      if (res.success) {
        LS.set('token', { value: res.data.token, exp: Date.parse(res.data.expiresAt) || (Date.now() + 30 * 864e5) });
        LS.set('pinIsDefault', !!res.data.pinIsDefault);
        LS.del('localFails');
        return makeVerifier(p).then(function () { return res; });
      }
      return res;
    });
  }

  function localUnlock(p) {
    var f = LS.get('localFails', { n: 0, until: 0 });
    if (f.until > Date.now()) return Promise.resolve({ success: false, message: 'Terlalu banyak percobaan offline. Tunggu ' + Math.ceil((f.until - Date.now()) / 60000) + ' menit atau sambungkan internet.' });
    return checkVerifier(p).then(function (ok) {
      if (ok === null) return { success: false, message: 'Buka kunci offline tidak tersedia. Sambungkan ke internet.' };
      if (ok) { LS.del('localFails'); return { success: true, offline: true }; }
      f.n++; if (f.n >= 5) { f.until = Date.now() + 5 * 60000; f.n = 0; }
      LS.set('localFails', f);
      return { success: false, message: 'PIN salah.' };
    });
  }

  function submitPin() {
    if (busy) return;
    if (!/^\d{4,12}$/.test(pin)) { message('PIN minimal 4 digit.'); shake(); return; }
    busy = true; keypadDisabled(true); message('Memverifikasi…');
    var p = pin;
    var attempt = navigator.onLine ? serverLogin(p) : Promise.resolve({ success: false, error: { code: 'OFFLINE' } });
    attempt.then(function (res) {
      if (res.success) return res;
      // Offline (or server unreachable) while LOCKED with a valid session → local verifier
      if (pinMode === 'lock' && token() && R.Api.isNetworkError(res)) return localUnlock(p);
      return res;
    }).then(function (res) {
      busy = false; keypadDisabled(false); pin = ''; renderDots();
      if (res.success) {
        message('');
        LS.del('locked'); touch(true);
        hidePin();
        if (res.offline) R.UI.toast('Dibuka offline. Sinkronisasi saat online.', 'info');
        if (onUnlocked) onUnlocked(res);
        return;
      }
      shake();
      message(res.message || 'Gagal masuk.');
    });
  }

  // ---------------------------------------------------------------------------
  // PIN screen
  // ---------------------------------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function message(m) { el('pin-msg').textContent = m || ''; }
  function shake() { var d = el('pin-dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(60); }
  function keypadDisabled(b) { U.$$('#keypad button').forEach(function (x) { x.disabled = b; }); }
  function renderDots() {
    var n = Math.max(6, pin.length), h = '';
    for (var i = 0; i < n; i++) h += '<span class="' + (i < pin.length ? 'on' : '') + '"></span>';
    el('pin-dots').innerHTML = h;
  }
  function press(k) {
    if (busy) return;
    if (k === 'del') pin = pin.slice(0, -1);
    else if (k === 'ok') return submitPin();
    else if (/^\d$/.test(k) && pin.length < 12) pin += k;
    message(''); renderDots();
  }
  function bindKeypad() {
    U.on(el('keypad'), 'click', 'button', function (e, b) { press(b.getAttribute('data-k')); });
    document.addEventListener('keydown', function (e) {
      if (el('gate-pin').classList.contains('hidden')) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') press('ok');
    });
    el('pin-logout').addEventListener('click', function () {
      R.UI.confirm('Keluar dari perangkat ini?', 'Anda perlu login dengan PIN secara online. Data yang belum tersinkron tetap tersimpan di perangkat.', { confirmText: 'Keluar' })
        .then(function (ok) { if (ok) { clearSession(); showPin('login'); } });
    });
  }
  function showPin(mode, cb) {
    pinMode = mode; pin = ''; if (cb) onUnlocked = cb;
    el('pin-title').textContent = mode === 'lock' ? 'Aplikasi terkunci' : 'Resilia';
    el('pin-sub').textContent = mode === 'lock' ? 'Masukkan PIN untuk membuka' : 'Masukkan PIN untuk masuk';
    el('pin-logout').classList.toggle('hidden', mode !== 'lock');
    el('pin-foot').textContent = mode === 'lock' && !navigator.onLine && LS.get('verifier', null) ? 'Offline · dibuka dengan verifikasi lokal' : 'PIN diverifikasi di server · tidak disimpan di perangkat';
    message(mode === 'login' && !navigator.onLine ? 'Anda offline. Login pertama memerlukan internet.' : '');
    renderDots();
    el('gate-pin').classList.remove('hidden');
    el('app').classList.add('hidden');
  }
  function hidePin() { el('gate-pin').classList.add('hidden'); el('app').classList.remove('hidden'); }

  // ---------------------------------------------------------------------------
  // Lock / auto-lock / logout
  // ---------------------------------------------------------------------------
  function touch(force) {
    var now = Date.now();
    if (force || now - lastActiveWrite > 5000) { LS.set('lastActive', now); lastActiveWrite = now; }
  }
  function shouldLock() {
    if (LS.get('locked', false)) return true;
    var m = settings().autoLockMin;
    return m > 0 && Date.now() - LS.get('lastActive', 0) > m * 60000;
  }
  function lock(reason) {
    LS.set('locked', true);
    if (navigator.onLine && token()) R.Api.call('audit.log', { action: 'LOCK', description: reason || 'manual' });
    showPin('lock');
  }
  function startAutoLock() {
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) { document.addEventListener(ev, function () { touch(false); }, { passive: true }); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && token() && el('gate-pin').classList.contains('hidden') && shouldLock()) lock('auto');
      if (document.visibilityState === 'hidden') touch(true);
    });
    clearInterval(lockTimer);
    lockTimer = setInterval(function () {
      if (token() && el('gate-pin').classList.contains('hidden') && !el('app').classList.contains('hidden') && shouldLock()) lock('auto');
    }, 15000);
  }
  function clearSession() { LS.del('token'); LS.del('verifier'); LS.del('locked'); LS.del('localFails'); }
  function logout() {
    var t = token();
    var p = t && navigator.onLine ? R.Api.call('auth.logout', {}) : Promise.resolve();
    return p.then(function () { clearSession(); });
  }
  /** Server says the token is no longer valid (expired, revoked, PIN changed). */
  function sessionInvalid(msg) {
    if (!token() && !el('gate-pin').classList.contains('hidden')) return;
    LS.del('token'); LS.del('verifier');
    showPin('login');
    message(msg || 'Sesi berakhir. Silakan login kembali.');
  }

  return {
    token: token, settings: settings, setSetting: setSetting, showPin: showPin, hidePin: hidePin, bindKeypad: bindKeypad,
    lock: lock, shouldLock: shouldLock, touch: touch, startAutoLock: startAutoLock, logout: logout, clearSession: clearSession,
    sessionInvalid: sessionInvalid, pinIsDefault: function () { return LS.get('pinIsDefault', false); },
    onUnlocked: function (cb) { onUnlocked = cb; }
  };
})();

;
/* ==== js/core/sync.js ==== */
/* Resilia — core/sync.js
 * Push queued local changes, then pull server changes. Triggers: data change (debounced),
 * coming back online, tab becoming visible, every 60 s, manual refresh.
 * Failures keep the queue intact (it lives in IndexedDB) and retry with exponential backoff.
 * Status: offline 🔴 · syncing 🟡 · online 🟢 (changes waiting) · synced ✓ · error
 */
R.Sync = (function () {
  'use strict';
  var U = R.U, S = R.Store;
  var BATCH = 100, OVERLAP = 5 * 60 * 1000;
  var running = null, rerun = false, timer = null, backoff = 0, status = 'online', lastError = '', listeners = [], started = false;

  function setStatus(s, err) {
    if (!navigator.onLine) s = 'offline';
    status = s; lastError = err || '';
    listeners.forEach(function (fn) { fn(status, S.pendingCount(), lastError); });
  }
  function onStatus(fn) { listeners.push(fn); fn(status, S.pendingCount(), lastError); }
  function idleStatus() { setStatus(S.pendingCount() ? 'online' : 'synced'); }

  function schedule(delay) {
    clearTimeout(timer);
    if (!started) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    timer = setTimeout(function () { run(); }, delay === undefined ? 1500 : delay);
    if (status === 'synced' && S.pendingCount()) setStatus('online');
  }

  function retryLater() {
    backoff = Math.min(backoff ? backoff * 2 : 5000, 5 * 60 * 1000);
    clearTimeout(timer);
    timer = setTimeout(function () { run(); }, backoff);
  }

  /** Run one sync cycle. opts.full = pull everything. Resolves { ok, error? }. */
  function run(opts) {
    opts = opts || {};
    if (!R.Auth.token()) return Promise.resolve({ ok: false, error: 'AUTH' });
    if (!navigator.onLine) { setStatus('offline'); return Promise.resolve({ ok: false, error: 'OFFLINE' }); }
    if (running) { rerun = true; if (opts.full) rerun = 'full'; return running; }
    setStatus('syncing');
    running = pushAll()
      .then(function (r) { return r.ok ? pull(opts.full) : r; })
      .then(function (r) {
        running = null;
        if (r.ok) { backoff = 0; idleStatus(); S.setMeta('lastSyncAt', Date.now()); }
        else if (r.error === 'AUTH') setStatus('error', 'Sesi berakhir');
        else { setStatus(navigator.onLine ? 'error' : 'offline', r.message); retryLater(); }
        if (rerun) { var full = rerun === 'full'; rerun = false; setTimeout(function () { run({ full: full }); }, 50); }
        return r;
      }, function (e) {
        running = null; console.error(e); setStatus('error', String(e && e.message || e)); retryLater();
        return { ok: false, error: 'CLIENT', message: String(e) };
      });
    return running;
  }

  function pushAll() {
    var ops = S.pendingOps(BATCH);
    if (!ops.length) return Promise.resolve({ ok: true });
    S.markInflight(ops, true);
    var body = ops.map(function (o) { return { QueueID: o.QueueID, RecordType: o.RecordType, RecordID: o.RecordID, Action: o.Action, Payload: o.Payload, CreatedAt: o.CreatedAt }; });
    return R.Api.call('sync.push', { ops: body }, { timeout: 60000 }).then(function (res) {
      if (!res.success) {
        S.markInflight(ops, false);
        return { ok: false, error: authErr(res) ? 'AUTH' : res.error.code, message: res.message };
      }
      return S.ackPush(res.data).then(function (fb) {
        if (fb.conflicts.length) R.UI.toast(fb.conflicts.length + ' perubahan bentrok — versi terbaru dari server dipakai.', 'warning');
        if (fb.rejected.length) R.UI.alert('Sebagian data ditolak server', fb.rejected.map(function (r) { return '• ' + r.RecordType + ': ' + r.message; }).slice(0, 6).join('<br>'), 'warning');
        return S.pendingOps(1).length ? pushAll() : { ok: true };
      });
    });
  }

  function pull(full) {
    var last = S.getMeta('lastPull', 0);
    var since = full || !last ? 0 : Math.max(0, last - OVERLAP);
    return R.Api.call('sync.pull', { since: since }, { timeout: 60000 }).then(function (res) {
      if (!res.success) return { ok: false, error: authErr(res) ? 'AUTH' : res.error.code, message: res.message };
      return S.applyServer(res.data.tables).then(function (n) {
        return S.setMeta('lastPull', res.data.serverTime).then(function () { return { ok: true, pulled: n }; });
      });
    });
  }
  function authErr(res) { return res.error && (res.error.code === 'AUTH_INVALID' || res.error.code === 'AUTH_REQUIRED'); }

  function start() {
    if (started) return;
    started = true;
    window.addEventListener('online', function () { setStatus('online'); schedule(300); });
    window.addEventListener('offline', function () { setStatus('offline'); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') schedule(500); });
    setInterval(function () { if (document.visibilityState === 'visible') schedule(0); }, 60000);
    S.onChange(function () { listeners.forEach(function (fn) { fn(status, S.pendingCount(), lastError); }); });
    if (!navigator.onLine) setStatus('offline'); else idleStatus();
  }
  function stop() { started = false; clearTimeout(timer); }

  return { start: start, stop: stop, run: run, schedule: schedule, onStatus: onStatus, status: function () { return status; } };
})();

;
/* ==== js/core/app.js ==== */
/* Resilia — core/app.js : shared app state helpers (memoised analysis, lookups, profile, snapshots, audit) */
R.App = (function () {
  'use strict';
  var U = R.U, S = R.Store;
  var memo = { key: null, value: null };

  /** Full FinCalc analysis of local data — memoised per data version and day. */
  function summary() {
    var key = S.version() + '|' + U.today() + '|' + U.getCurrency();
    if (memo.key !== key) memo = { key: key, value: FinCalc.analyze(S.calcData(), { today: U.today(), fmtMoney: function (v) { return U.money(v); } }) };
    return memo.value;
  }
  function categories(type, includeInactive) {
    return S.all('Categories').filter(function (c) { return (!type || c.Type === type) && (includeInactive || c.Active !== false); })
      .sort(function (a, b) { return String(a.Name).localeCompare(String(b.Name), 'id'); });
  }
  function cat(id) { return S.get('Categories', id) || (id && R.Store.all('Categories', true).filter(function (c) { return c.CategoryID === id; })[0]) || null; }
  function catLabel(id) { var c = cat(id); return c ? c.Name : 'Tanpa kategori'; }
  function catIcon(id) { var c = cat(id); return (c && c.Icon) || '•'; }
  function accounts(includeInactive) {
    return S.all('Accounts').filter(function (a) { return includeInactive || a.Active !== false; })
      .sort(function (a, b) { return String(a.Name).localeCompare(String(b.Name), 'id'); });
  }
  function accountName(id) { var a = S.get('Accounts', id); return a ? a.Name : '—'; }
  /** Categories ordered by how often they were used in the last 90 days (quick add). */
  function categoriesByUsage(type) {
    var since = FinCalc.date.addDays(U.today(), -90), count = {};
    S.all('Transactions').forEach(function (t) { if (t.Type === type && t.Date >= since) count[t.CategoryID] = (count[t.CategoryID] || 0) + 1; });
    return categories(type).sort(function (a, b) { return (count[b.CategoryID] || 0) - (count[a.CategoryID] || 0) || String(a.Name).localeCompare(String(b.Name), 'id'); });
  }

  function profile() { return S.one('FinancialProfile'); }
  function profileValues() {
    var p = profile() || {}, out = {};
    Object.keys(FinCalc.DEFAULT_PROFILE).forEach(function (k) { out[k] = (p[k] === undefined || p[k] === null || (p[k] === '' && k !== 'CurrentInvestment')) ? FinCalc.DEFAULT_PROFILE[k] : p[k]; });
    return out;
  }
  function saveProfile(patch) {
    var p = profile();
    var rec = Object.assign({}, p ? {} : Object.assign({}, FinCalc.DEFAULT_PROFILE, { CurrentAge: 0 }), p || {}, patch);
    if (!rec.ProfileID) rec.ProfileID = U.uuid();
    return S.save('FinancialProfile', rec);
  }
  function user() { return S.one('Users'); }
  function saveUser(patch) {
    var u = user();
    var rec = Object.assign({ Currency: 'IDR' }, u || {}, patch);
    if (!rec.UserID) rec.UserID = U.uuid();
    return S.save('Users', rec);
  }

  /** Keep one Snapshot per month up to date (powers Net Worth Over Time). */
  var snapshotTick = U.debounce(function () {
    if (!R.Auth.token()) return;
    var s = summary();
    if (!s.hasData && !S.all('Accounts').length && !S.all('Assets').length) return;
    var vals = FinCalc.snapshotValues(s), mk = U.monthKey(), cur = null;
    S.all('Snapshots').forEach(function (x) { if (String(x.Date).slice(0, 7) === mk && (!cur || String(x.UpdatedAt) > String(cur.UpdatedAt))) cur = x; });
    if (cur && Object.keys(vals).every(function (k) { return Math.abs(Number(cur[k] || 0) - vals[k]) < 0.5; })) return;
    S.save('Snapshots', Object.assign({ SnapshotID: cur ? cur.SnapshotID : U.uuid() }, cur || {}, vals, { Date: U.today() }));
  }, 4000);

  function audit(action, description, entity) {
    if (navigator.onLine && R.Auth.token()) R.Api.call('audit.log', { action: action, description: description || '', entity: entity || '' });
  }

  function init() {
    S.onChange(function () {
      var u = user();
      if (u && u.Currency && u.Currency !== U.getCurrency()) U.setCurrency(u.Currency);
      snapshotTick();
    });
  }

  return {
    init: init, summary: summary, categories: categories, categoriesByUsage: categoriesByUsage, cat: cat, catLabel: catLabel, catIcon: catIcon,
    accounts: accounts, accountName: accountName, profile: profile, profileValues: profileValues, saveProfile: saveProfile,
    user: user, saveUser: saveUser, audit: audit
  };
})();

;
/* ==== js/core/forms.js ==== */
/* Resilia — core/forms.js : entity forms shared by several sections */
R.Forms = (function () {
  'use strict';
  var U = R.U, S = R.Store, A = R.App, UI = R.UI;

  var ACCOUNT_TYPES = [{ value: 'CASH', label: '💵 Tunai' }, { value: 'BANK', label: '🏦 Bank' }, { value: 'E_WALLET', label: '📱 E-Wallet' }, { value: 'INVESTMENT', label: '📈 Investasi' }, { value: 'OTHER', label: '📦 Lainnya' }];
  var ASSET_TYPES = [{ value: 'CASH', label: '💵 Kas / Tabungan di luar rekening' }, { value: 'GOLD', label: '🥇 Emas' }, { value: 'STOCK', label: '📈 Saham / Reksa dana' }, { value: 'CRYPTO', label: '🪙 Kripto' }, { value: 'PROPERTY', label: '🏠 Properti' }, { value: 'VEHICLE', label: '🚗 Kendaraan' }, { value: 'BUSINESS', label: '🏪 Bisnis' }, { value: 'OTHER', label: '📦 Lainnya' }];
  var DEBT_TYPES = [{ value: 'CREDIT_CARD', label: '💳 Kartu kredit' }, { value: 'PAYLATER', label: '🛒 Paylater' }, { value: 'PERSONAL_LOAN', label: '🤝 Pinjaman pribadi / KTA' }, { value: 'MORTGAGE', label: '🏠 KPR' }, { value: 'VEHICLE_LOAN', label: '🚗 Kredit kendaraan' }, { value: 'BUSINESS_LOAN', label: '🏪 Pinjaman usaha' }, { value: 'FAMILY', label: '👪 Pinjaman keluarga' }, { value: 'OTHER', label: '📦 Lainnya' }];
  function label(list, v) { var x = list.filter(function (o) { return o.value === v; })[0]; return x ? x.label : v; }

  function confirmDelete(what) { return UI.confirm('Hapus ' + what + '?', 'Data akan dihapus di semua perangkat setelah sinkron.', { danger: true, confirmText: 'Hapus' }); }
  function deleteBtn(entity, id, what) {
    return { text: 'Hapus', cls: 'danger', onClick: function () {
      return confirmDelete(what).then(function (ok) { if (!ok) return false; return S.remove(entity, id).then(function () { UI.toast(what.charAt(0).toUpperCase() + what.slice(1) + ' dihapus'); return 'deleted'; }); });
    } };
  }

  // ---------------------------------------------------------------------------
  // Transaction (FAB / quick add)
  // ---------------------------------------------------------------------------
  function catOptions(type) { return A.categoriesByUsage(type).map(function (c) { return { value: c.CategoryID, label: c.Name, icon: c.Icon }; }); }
  function accOptions() { return A.accounts().map(function (a) { return { value: a.AccountID, label: a.Name }; }); }

  function transaction(existing, defaults) {
    var accs = A.accounts();
    if (!accs.length) {
      return UI.confirm('Belum ada akun', 'Buat akun (mis. Tunai atau Rekening Bank) terlebih dahulu untuk mencatat transaksi.', { confirmText: 'Buat akun' })
        .then(function (ok) { return ok ? account() : null; });
    }
    var v = existing ? Object.assign({}, existing) : Object.assign({
      Type: 'EXPENSE', Date: U.today(), AccountID: U.LS.get('lastAccount', '') && S.get('Accounts', U.LS.get('lastAccount', '')) ? U.LS.get('lastAccount', '') : accs[0].AccountID
    }, defaults || {});
    var again = false;
    var fields = [
      { name: 'Type', type: 'seg', options: [{ value: 'EXPENSE', label: 'Pengeluaran' }, { value: 'INCOME', label: 'Pemasukan' }, { value: 'TRANSFER', label: 'Transfer' }] },
      { name: 'Amount', type: 'money', label: 'Nominal', required: true, placeholder: '0', requiredMsg: 'Masukkan nominal lebih dari 0' },
      { name: 'CategoryID', type: 'chips', label: 'Kategori', options: catOptions(v.Type === 'TRANSFER' ? 'EXPENSE' : v.Type), show: function (x) { return x.Type !== 'TRANSFER'; } },
      { name: 'AccountID', type: 'select', label: 'Dari akun', options: accOptions(), required: true },
      { name: 'ToAccountID', type: 'select', label: 'Ke akun', options: accOptions(), empty: 'Pilih akun tujuan', show: function (x) { return x.Type === 'TRANSFER'; } },
      { name: 'Date', type: 'date', label: 'Tanggal', required: true },
      { name: 'Description', type: 'text', label: 'Keterangan', maxlength: 140, placeholder: 'mis. Makan siang' },
      { name: 'Notes', type: 'textarea', label: 'Catatan', maxlength: 500 }
    ];
    var buttons = existing ? [deleteBtn('Transactions', existing.TransactionID, 'transaksi')] : [{ text: 'Simpan & lagi', onClick: function (vals, api) { if (!api.validate()) return false; again = true; return submit(vals); } }];
    function submit(vals) {
      var rec = {
        TransactionID: existing ? existing.TransactionID : undefined, Type: vals.Type, Amount: Math.abs(Number(vals.Amount)), Date: vals.Date,
        CategoryID: vals.Type === 'TRANSFER' ? '' : vals.CategoryID, AccountID: vals.AccountID, ToAccountID: vals.Type === 'TRANSFER' ? vals.ToAccountID : '',
        Description: (vals.Description || '').trim(), Notes: (vals.Notes || '').trim()
      };
      if (!validate(vals, true)) return false;
      U.LS.set('lastAccount', vals.AccountID);
      return S.save('Transactions', rec).then(function () {
        UI.toast(existing ? 'Transaksi diperbarui' : 'Transaksi tersimpan');
        if (again) setTimeout(function () { transaction(null, { Type: vals.Type, AccountID: vals.AccountID, Date: vals.Date }); }, 300);
        return 'saved';
      });
    }
    function validate(x, silent) {
      var e = {};
      if (x.Type !== 'TRANSFER' && !x.CategoryID) e.CategoryID = 'Pilih kategori';
      if (x.Type === 'TRANSFER' && !x.ToAccountID) e.ToAccountID = 'Pilih akun tujuan';
      if (x.Type === 'TRANSFER' && x.ToAccountID && x.ToAccountID === x.AccountID) e.ToAccountID = 'Akun tujuan harus berbeda';
      return silent ? !Object.keys(e).length : e;
    }
    return UI.form({
      title: existing ? 'Edit transaksi' : 'Tambah transaksi', fields: fields, values: v, buttons: buttons, autofocus: existing ? null : 'Amount',
      validate: function (x) { return validate(x, false); },
      onChange: function (x, api, name) {
        if (name === 'Type' && x.Type !== 'TRANSFER') api.setOptions('CategoryID', catOptions(x.Type), '');
        if (name === 'Type') { var lab = document.querySelector('.sheet [data-f="AccountID"] label'); if (lab) lab.textContent = x.Type === 'INCOME' ? 'Ke akun' : 'Dari akun'; }
      },
      onSubmit: function (vals) { again = false; return submit(vals); }
    });
  }

  // ---------------------------------------------------------------------------
  // Account
  // ---------------------------------------------------------------------------
  function account(existing) {
    return UI.form({
      title: existing ? 'Edit akun' : 'Akun baru', values: existing || { Type: 'BANK', Active: true, InitialBalance: 0 },
      fields: [
        { name: 'Name', label: 'Nama akun', required: true, maxlength: 60, placeholder: 'mis. BCA, GoPay, Dompet' },
        { name: 'Type', type: 'select', label: 'Jenis', options: ACCOUNT_TYPES, required: true, hint: 'Tunai/Bank/E-Wallet dihitung sebagai <b>aset likuid</b> (dana darurat). Investasi dihitung untuk FI.' },
        { name: 'InitialBalance', type: 'money', label: 'Saldo awal', allowZero: true, hint: 'Saldo saat mulai dicatat. Saldo berjalan = saldo awal + transaksi.' },
        { name: 'Active', type: 'toggle', label: 'Aktif', hint: 'Akun non-aktif tidak dihitung di total aset.' }
      ],
      buttons: existing ? [deleteBtn('Accounts', existing.AccountID, 'akun')] : [],
      onSubmit: function (x) {
        return S.save('Accounts', { AccountID: existing ? existing.AccountID : undefined, Name: x.Name.trim(), Type: x.Type, InitialBalance: Number(x.InitialBalance) || 0, Active: !!x.Active })
          .then(function () { UI.toast('Akun tersimpan'); return 'saved'; });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Asset
  // ---------------------------------------------------------------------------
  function asset(existing) {
    return UI.form({
      title: existing ? 'Edit aset' : 'Aset baru', values: existing || { Type: 'GOLD', Date: U.today() },
      fields: [
        { name: 'Name', label: 'Nama aset', required: true, maxlength: 80, placeholder: 'mis. Emas Antam 10g' },
        { name: 'Type', type: 'select', label: 'Jenis', options: ASSET_TYPES, required: true },
        { name: 'PurchaseValue', type: 'money', label: 'Nilai beli', allowZero: true },
        { name: 'CurrentValue', type: 'money', label: 'Nilai saat ini', required: true, allowZero: true, hint: 'Perbarui berkala agar net worth akurat.' },
        { name: 'Date', type: 'date', label: 'Tanggal nilai' },
        { name: 'Notes', type: 'textarea', label: 'Catatan' }
      ],
      buttons: existing ? [deleteBtn('Assets', existing.AssetID, 'aset')] : [],
      onSubmit: function (x) {
        return S.save('Assets', { AssetID: existing ? existing.AssetID : undefined, Name: x.Name.trim(), Type: x.Type, PurchaseValue: Number(x.PurchaseValue) || 0, CurrentValue: Number(x.CurrentValue) || 0, Date: x.Date || U.today(), Notes: x.Notes || '' })
          .then(function () { UI.toast('Aset tersimpan'); return 'saved'; });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Debt
  // ---------------------------------------------------------------------------
  function debt(existing) {
    return UI.form({
      title: existing ? 'Edit utang' : 'Utang baru', values: existing || { Type: 'CREDIT_CARD' },
      fields: [
        { name: 'Name', label: 'Nama', required: true, maxlength: 80, placeholder: 'mis. Kartu kredit BCA' },
        { name: 'Type', type: 'select', label: 'Jenis', options: DEBT_TYPES, required: true },
        { name: 'Outstanding', type: 'money', label: 'Sisa utang', required: true, allowZero: true },
        { name: 'Principal', type: 'money', label: 'Pokok awal', allowZero: true, hint: 'Untuk menghitung progres pelunasan.' },
        { name: 'InterestRate', type: 'number', label: 'Bunga per tahun (%)', min: 0, max: 1000, step: '0.01', hint: 'Kartu kredit umumnya 20–30%/th.' },
        { name: 'MinimumPayment', type: 'money', label: 'Cicilan / pembayaran minimum per bulan', allowZero: true },
        { name: 'DueDate', type: 'number', label: 'Tanggal jatuh tempo (1–31)', min: 1, max: 31, step: '1' },
        { name: 'Notes', type: 'textarea', label: 'Catatan' }
      ],
      buttons: existing ? [deleteBtn('Liabilities', existing.DebtID, 'utang')] : [],
      onSubmit: function (x) {
        return S.save('Liabilities', { DebtID: existing ? existing.DebtID : undefined, Name: x.Name.trim(), Type: x.Type, Outstanding: Number(x.Outstanding) || 0, Principal: Number(x.Principal) || Number(x.Outstanding) || 0,
          InterestRate: Number(x.InterestRate) || 0, MinimumPayment: Number(x.MinimumPayment) || 0, DueDate: x.DueDate === '' ? '' : Number(x.DueDate), Notes: x.Notes || '' })
          .then(function () { UI.toast('Utang tersimpan'); return 'saved'; });
      }
    });
  }
  /** Record a payment: reduce outstanding and (optionally) log it as an expense. */
  function debtPayment(d) {
    var bills = A.categories('EXPENSE').filter(function (c) { return /tagihan|bills/i.test(c.Name); })[0] || A.categories('EXPENSE')[0];
    var accs = A.accounts();
    return UI.form({
      title: 'Bayar: ' + d.Name, values: { Amount: Number(d.MinimumPayment) || '', Record: accs.length > 0, AccountID: accs[0] && accs[0].AccountID, CategoryID: bills && bills.CategoryID, Date: U.today() },
      fields: [
        { name: 'Amount', type: 'money', label: 'Jumlah dibayar', required: true, hint: 'Sisa utang saat ini: ' + U.money(d.Outstanding) },
        { name: 'Principal', type: 'html', html: '<div class="hint">Jika sebagian pembayaran adalah bunga, sesuaikan sisa utang secara manual lewat "Edit".</div>' },
        { name: 'Record', type: 'toggle', label: 'Catat sebagai pengeluaran', hint: 'Mengurangi saldo akun dan masuk ke arus kas.' },
        { name: 'AccountID', type: 'select', label: 'Dari akun', options: accOptions(), show: function (x) { return x.Record; } },
        { name: 'CategoryID', type: 'select', label: 'Kategori', options: A.categories('EXPENSE').map(function (c) { return { value: c.CategoryID, label: c.Name }; }), show: function (x) { return x.Record; } },
        { name: 'Date', type: 'date', label: 'Tanggal', show: function (x) { return x.Record; } }
      ],
      onSubmit: function (x) {
        var amt = Number(x.Amount) || 0;
        var p = S.save('Liabilities', Object.assign({}, d, { Outstanding: Math.max(0, Number(d.Outstanding) - amt) }));
        if (x.Record && x.AccountID && x.CategoryID) p = p.then(function () { return S.save('Transactions', { Type: 'EXPENSE', Amount: amt, Date: x.Date || U.today(), CategoryID: x.CategoryID, AccountID: x.AccountID, Description: 'Bayar ' + d.Name, Notes: '' }); });
        return p.then(function () { UI.toast('Pembayaran dicatat'); return 'saved'; });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Goal
  // ---------------------------------------------------------------------------
  var GOAL_TEMPLATES = ['Dana Darurat', 'Menikah', 'Rumah', 'Pendidikan', 'Bisnis', 'Liburan', 'Pensiun'];
  function goal(existing) {
    var fields = [];
    if (!existing) fields.push({ name: 'tpl', type: 'chips', label: 'Template', options: GOAL_TEMPLATES.map(function (t) { return { value: t, label: t }; }) });
    fields.push(
      { name: 'Name', label: 'Nama tujuan', required: true, maxlength: 80 },
      { name: 'TargetAmount', type: 'money', label: 'Target dana', required: true },
      { name: 'CurrentAmount', type: 'money', label: 'Sudah terkumpul', allowZero: true },
      { name: 'TargetDate', type: 'date', label: 'Target tanggal', hint: 'Untuk menghitung setoran per bulan.' },
      { name: 'Priority', type: 'seg', label: 'Prioritas', options: [{ value: 'HIGH', label: 'Tinggi' }, { value: 'MEDIUM', label: 'Sedang' }, { value: 'LOW', label: 'Rendah' }] },
      { name: 'Status', type: 'select', label: 'Status', options: [{ value: 'ACTIVE', label: 'Aktif' }, { value: 'PAUSED', label: 'Ditunda' }, { value: 'ACHIEVED', label: 'Tercapai' }], show: function () { return !!existing; } },
      { name: 'Notes', type: 'textarea', label: 'Catatan' }
    );
    return UI.form({
      title: existing ? 'Edit tujuan' : 'Tujuan baru', values: existing || { Priority: 'MEDIUM', Status: 'ACTIVE', CurrentAmount: 0 }, fields: fields,
      buttons: existing ? [deleteBtn('Goals', existing.GoalID, 'tujuan')] : [],
      onChange: function (x, api, name) {
        if (name === 'tpl') {
          api.set('Name', x.tpl);
          if (x.tpl === 'Dana Darurat') { var ef = A.summary().emergencyFund; if (ef.targetAmount > 0) api.set('TargetAmount', Math.round(ef.targetAmount)); api.set('Priority', 'HIGH'); }
        }
      },
      onSubmit: function (x) {
        return S.save('Goals', { GoalID: existing ? existing.GoalID : undefined, Name: x.Name.trim(), TargetAmount: Number(x.TargetAmount), CurrentAmount: Number(x.CurrentAmount) || 0,
          TargetDate: x.TargetDate || '', Priority: x.Priority || 'MEDIUM', Status: x.Status || 'ACTIVE', Notes: x.Notes || '' })
          .then(function () { UI.toast('Tujuan tersimpan'); return 'saved'; });
      }
    });
  }
  function goalDeposit(g) {
    return UI.form({
      title: 'Tambah dana: ' + g.Name, values: {},
      fields: [{ name: 'Amount', type: 'money', label: 'Jumlah', required: true, hint: 'Terkumpul: ' + U.money(g.CurrentAmount) + ' dari ' + U.money(g.TargetAmount) }],
      onSubmit: function (x) {
        var cur = (Number(g.CurrentAmount) || 0) + Number(x.Amount);
        return S.save('Goals', Object.assign({}, g, { CurrentAmount: cur, Status: cur >= Number(g.TargetAmount) ? 'ACHIEVED' : (g.Status === 'ACHIEVED' ? 'ACTIVE' : g.Status || 'ACTIVE') }))
          .then(function () { UI.toast(cur >= Number(g.TargetAmount) ? '🎉 Tujuan tercapai!' : 'Dana ditambahkan'); return 'saved'; });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Budget & Category
  // ---------------------------------------------------------------------------
  function budget(existing, month) {
    month = (existing && existing.Month) || month || U.monthKey();
    var used = {};
    S.all('Budgets').forEach(function (b) { if (b.Month === month && (!existing || b.BudgetID !== existing.BudgetID)) used[b.CategoryID] = 1; });
    var opts = A.categories('EXPENSE').filter(function (c) { return !used[c.CategoryID]; }).map(function (c) { return { value: c.CategoryID, label: (c.Icon ? c.Icon + ' ' : '') + c.Name }; });
    if (!opts.length) return UI.alert('Semua kategori sudah memiliki budget', 'Edit budget yang ada atau tambah kategori baru di Pengaturan.', 'info');
    return UI.form({
      title: (existing ? 'Edit budget · ' : 'Budget · ') + U.fmtMonth(month), values: existing || { CategoryID: opts[0].value },
      fields: [
        { name: 'CategoryID', type: 'select', label: 'Kategori pengeluaran', options: opts, required: true },
        { name: 'LimitAmount', type: 'money', label: 'Batas per bulan', required: true }
      ],
      buttons: existing ? [deleteBtn('Budgets', existing.BudgetID, 'budget')] : [],
      onSubmit: function (x) {
        return S.save('Budgets', { BudgetID: existing ? existing.BudgetID : undefined, Month: month, CategoryID: x.CategoryID, LimitAmount: Number(x.LimitAmount) })
          .then(function () { UI.toast('Budget tersimpan'); return 'saved'; });
      }
    });
  }
  function category(existing) {
    return UI.form({
      title: existing ? 'Edit kategori' : 'Kategori baru', values: existing || { Type: 'EXPENSE', Active: true, Essential: false, Icon: '📦', Color: '#64748B' },
      fields: [
        { name: 'Type', type: 'seg', options: [{ value: 'EXPENSE', label: 'Pengeluaran' }, { value: 'INCOME', label: 'Pemasukan' }] },
        { name: 'Name', label: 'Nama', required: true, maxlength: 40 },
        { name: 'Icon', label: 'Ikon (emoji)', maxlength: 8 },
        { name: 'Color', type: 'select', label: 'Warna', options: [['#0B5D4B', 'Hijau tua'], ['#15803D', 'Hijau'], ['#2563EB', 'Biru'], ['#7C3AED', 'Ungu'], ['#DB2777', 'Merah muda'], ['#DC2626', 'Merah'], ['#EA580C', 'Oranye'], ['#CA8A04', 'Kuning'], ['#0E7490', 'Toska'], ['#64748B', 'Abu-abu']].map(function (c) { return { value: c[0], label: c[1] }; }) },
        { name: 'Essential', type: 'toggle', label: 'Pengeluaran esensial', hint: 'Kebutuhan pokok yang tetap harus dibayar saat kehilangan pemasukan — dasar perhitungan dana darurat.', show: function (x) { return x.Type === 'EXPENSE'; } },
        { name: 'Active', type: 'toggle', label: 'Aktif' }
      ],
      buttons: existing ? [{ text: 'Nonaktifkan', cls: 'danger', onClick: function () { return S.save('Categories', Object.assign({}, existing, { Active: false })).then(function () { UI.toast('Kategori dinonaktifkan'); }); } }] : [],
      onSubmit: function (x) {
        return S.save('Categories', { CategoryID: existing ? existing.CategoryID : undefined, Name: x.Name.trim(), Type: x.Type, Icon: x.Icon || '', Color: x.Color || '', Essential: x.Type === 'EXPENSE' && !!x.Essential, Active: x.Active !== false })
          .then(function () { UI.toast('Kategori tersimpan'); return 'saved'; });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Financial assumptions (profile)
  // ---------------------------------------------------------------------------
  var PROFILE_FIELDS = {
    CurrentAge: { type: 'number', label: 'Usia saat ini', min: 0, max: 100, step: '1' },
    RetirementAge: { type: 'number', label: 'Target usia pensiun', min: 18, max: 100, step: '1' },
    MonthlyEssentialExpense: { type: 'money', label: 'Pengeluaran esensial / bulan', allowZero: true, hint: 'Kosongkan / 0 = estimasi otomatis dari kategori esensial.' },
    MonthlyLifestyleExpense: { type: 'money', label: 'Pengeluaran gaya hidup / bulan', allowZero: true },
    EmergencyFundTargetMonths: { type: 'select', label: 'Target dana darurat', options: [3, 6, 9, 12].map(function (n) { return { value: n, label: n + ' bulan' }; }) },
    ExpectedIncomeGrowth: { type: 'number', label: 'Kenaikan pemasukan / tahun (%)', min: -50, max: 100, step: '0.1' },
    ExpectedInvestmentReturn: { type: 'number', label: 'Ekspektasi return investasi / tahun (%)', min: -50, max: 100, step: '0.1' },
    InflationRate: { type: 'number', label: 'Inflasi / tahun (%)', min: -10, max: 100, step: '0.1' },
    WithdrawalRate: { type: 'number', label: 'Withdrawal rate (%)', min: 0.5, max: 20, step: '0.1', hint: 'Persentase portofolio yang ditarik per tahun saat pensiun/FI. Umum dipakai 3–4%; ini asumsi, bukan kepastian.' },
    MonthlyInvestment: { type: 'money', label: 'Investasi rutin / bulan', allowZero: true },
    CurrentInvestment: { type: 'money', label: 'Nilai investasi saat ini (override)', allowZero: true, hint: 'Kosongkan = otomatis dari akun Investasi + aset Emas/Saham/Kripto.' },
    DesiredRetirementMonthlyExpense: { type: 'money', label: 'Pengeluaran bulanan saat pensiun (nilai hari ini)', allowZero: true, hint: 'Kosongkan / 0 = sama dengan rata-rata pengeluaran sekarang.' },
    SavingsRateTarget: { type: 'number', label: 'Target savings rate (%)', min: 1, max: 90, step: '1' },
    HighCostDebtRate: { type: 'number', label: 'Batas utang berbunga tinggi (%/th)', min: 0, max: 100, step: '0.5' }
  };
  function profile(keys, title) {
    keys = keys || Object.keys(PROFILE_FIELDS);
    var p = A.profileValues();
    var values = {};
    keys.forEach(function (k) { values[k] = p[k]; });
    return UI.form({
      title: title || 'Asumsi keuangan', values: values,
      fields: keys.map(function (k) { return Object.assign({ name: k }, PROFILE_FIELDS[k]); }),
      validate: function (x) { if ('RetirementAge' in x && x.CurrentAge > 0 && Number(x.RetirementAge) <= Number(x.CurrentAge)) return { RetirementAge: 'Harus lebih besar dari usia saat ini' }; },
      onSubmit: function (x) {
        var patch = {};
        keys.forEach(function (k) {
          var v = x[k];
          if (k === 'CurrentInvestment') patch[k] = v === '' || v === null || v === undefined ? '' : Number(v);
          else patch[k] = v === '' || v === undefined ? (FinCalc.DEFAULT_PROFILE[k] || 0) : Number(v);
        });
        return A.saveProfile(patch).then(function () { UI.toast('Asumsi tersimpan'); return 'saved'; });
      }
    });
  }

  return {
    transaction: transaction, account: account, asset: asset, debt: debt, debtPayment: debtPayment, goal: goal, goalDeposit: goalDeposit,
    budget: budget, category: category, profile: profile, ACCOUNT_TYPES: ACCOUNT_TYPES, ASSET_TYPES: ASSET_TYPES, DEBT_TYPES: DEBT_TYPES, label: label
  };
})();

;
/* ==== js/views/dashboard.js ==== */
/* Resilia — views/dashboard.js : the "am I financially safe?" overview */
R.Views.dashboard = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store;

  function onboarding(s) {
    var tx = S.all('Transactions').length, accs = S.all('Accounts');
    var steps = [
      { done: accs.some(function (a) { return Number(a.InitialBalance) !== 0; }) || tx > 0, text: 'Isi saldo awal akun Anda', act: 'assets' },
      { done: tx > 0, text: 'Catat transaksi pertama', act: 'add-tx' },
      { done: !s.profileIncomplete, text: 'Lengkapi profil: usia & pengeluaran esensial', act: 'profile' },
      { done: S.all('Goals').length > 0, text: 'Buat tujuan finansial pertama', act: 'goals' }
    ];
    if (steps.every(function (x) { return x.done; }) || U.LS.get('onboardDone', false)) return '';
    var n = steps.filter(function (x) { return x.done; }).length;
    return '<div class="card"><h3>🚀 Mulai dari sini <span class="more muted">' + n + '/4</span></h3>' + UI.bar(n / 4) +
      '<ul class="list" style="margin-top:6px">' + steps.map(function (x) {
        return '<li class="item" data-act="' + x.act + '"><span class="ico">' + (x.done ? '✅' : '⬜') + '</span><span class="grow' + (x.done ? ' muted' : '') + '">' + x.text + '</span>' + (x.done ? '' : U.icon('right', 'muted')) + '</li>';
      }).join('') + '</ul><button class="btn ghost sm" data-act="dismiss-onboard">Sembunyikan</button></div>';
  }

  function render(el) {
    var s = A.summary(), h = s.health, lv = s.level, m = s.thisMonth, nw = s.netWorth, ef = s.emergencyFund, db = s.debt;
    var user = A.user(), name = user && user.Name ? ', ' + U.esc(user.Name.split(' ')[0]) : '';
    var html = '<div class="muted small" style="margin:4px 2px 0">Halo' + name + ' · ' + U.fmtDate(U.today(), 'long') + '</div>';

    // ---- Hero: health score + level
    html += '<div class="card hero"><div class="score-wrap">' +
      (s.hasData ? UI.ring(h.score, 100, '#E0B35A') : '<div class="ring"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="44" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="9"/></svg><div class="rv"><div><b>–</b><small>/ 100</small></div></div></div>') +
      '<div class="grow"><div class="label">Financial Health Score</div>' +
      '<div class="mid" style="margin:2px 0 6px">' + (s.hasData ? h.label : 'Belum cukup data') + '</div>' +
      '<span class="chip">LEVEL ' + lv.level + ' · ' + U.esc(lv.name) + '</span>' +
      '<div class="small muted" style="margin-top:6px">' + U.esc(lv.desc) + '</div></div></div>' +
      '<div class="ladder">' + [1, 2, 3, 4, 5].map(function (i) { return '<span class="' + (i <= lv.level ? 'on' : '') + '"></span>'; }).join('') + '</div>' +
      (lv.next ? '<a href="javascript:void(0)" data-nav="resilience" class="small" style="display:block;margin-top:10px;color:#fff;opacity:.9">Menuju ' + U.esc(lv.next.name) + ': ' + U.esc(lv.next.missing.join(' · ')) + ' ›</a>' : '') +
      '</div>';

    html += onboarding(s);

    if (s.hasData && (h.strong.length || h.improve.length)) {
      html += '<div class="card"><h3>Kondisi Anda <a class="more" href="javascript:void(0)" data-nav="resilience">Rincian</a></h3>' +
        (h.strong.length ? '<div class="label">Kuat</div><ul class="bullets">' + h.strong.slice(0, 3).map(function (t) { return '<li><span class="good">✓</span>' + U.esc(t) + '</li>'; }).join('') + '</ul>' : '') +
        (h.improve.length ? '<div class="label" style="margin-top:6px">Perlu diperbaiki</div><ul class="bullets">' + h.improve.slice(0, 3).map(function (t) { return '<li><span class="warn">⚠</span>' + U.esc(t) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>';
    }

    // ---- Cash flow KPIs (this month)
    html += '<div class="section-h">Bulan ini <a class="more" href="javascript:void(0)" data-nav="cashflow">Arus kas ›</a></div>' +
      '<div class="grid k2 k4 kpis">' +
      kpi('Pemasukan', U.money(m.income), 'income', m.count ? '' : 'Belum ada') +
      kpi('Pengeluaran', U.money(m.expense), 'expense', '') +
      kpi('Arus kas bersih', U.money(m.net, { sign: true }), m.net >= 0 ? 'income' : 'expense', '') +
      kpi('Savings rate', U.pct(m.savingsRate), '', 'Target ' + U.pct(s.profile.SavingsRateTarget, 0)) +
      '</div>';

    html += '<div class="grid d-main"><div>';
    // ---- Net worth
    html += '<div class="card"><h3>Kekayaan bersih <a class="more" href="javascript:void(0)" data-nav="assets">Detail ›</a></h3>' +
      '<div class="big money">' + U.money(s.balance.netWorth) + '</div>' +
      '<div class="row wrap small" style="margin-top:4px">' +
      (nw.lastMonth !== null ? '<span class="muted">Bulan lalu ' + U.money(nw.lastMonth) + '</span>' + UI.chip((nw.growthPct >= 0 ? '▲ +' : '▼ ') + U.pct(nw.growthPct), nw.growthPct >= 0 ? 'green' : 'red') : '<span class="muted">Riwayat terbentuk otomatis tiap bulan</span>') +
      '</div><div id="dash-nw" style="margin-top:8px"></div></div>';

    html += '<div class="card"><h3>Arus kas 6 bulan</h3><div id="dash-cf"></div></div></div><div>';

    // ---- EF + debt
    html += '<div class="grid k2">' +
      '<a class="kpi" href="javascript:void(0)" data-nav="emergency" style="color:inherit"><div class="label">🛡 Dana darurat</div><div class="v">' + (ef.months === null ? '–' : U.number(ef.months, 1) + ' bln') + '</div>' +
      '<div style="margin:6px 0 4px">' + UI.bar(ef.progress, ef.status.color) + '</div><div class="s">' + ef.status.emoji + ' ' + ef.status.label + ' · target ' + ef.target + ' bln</div></a>' +
      '<a class="kpi" href="javascript:void(0)" data-nav="debt" style="color:inherit"><div class="label">💳 Utang</div><div class="v">' + U.moneyShort(db.total) + '</div>' +
      '<div class="s" style="margin-top:6px">' + (db.total > 0 ? 'DTI ' + U.pct(db.dti) + ' · ' + db.status.label : 'Bebas utang 🎉') + '</div></a></div>';

    // ---- Next action
    var top = s.actions[0];
    if (top) html += '<div class="card priority p1"><div class="pn">Prioritas #1</div><div class="mid" style="margin:4px 0">' + U.esc(top.title) + '</div><div class="small">' + U.esc(top.action) + '</div>' +
      '<div class="row" style="margin-top:10px"><a class="btn sm primary" href="javascript:void(0)" data-nav="plan">Apa yang harus saya lakukan?</a></div></div>';

    // ---- Insights
    if (s.insights.length) html += '<div class="card"><h3>Insight <a class="more" href="javascript:void(0)" data-nav="resilience">Semua</a></h3>' +
      s.insights.slice(0, 4).map(function (i) { return '<div class="insight ' + i.type + '"><span class="i">' + i.icon + '</span><span>' + U.esc(i.text) + '</span></div>'; }).join('') + '</div>';
    else html += '<div class="card"><h3>Insight</h3><div class="muted small">Insight muncul otomatis setelah ada cukup data transaksi.</div></div>';

    if (R.Main && R.Main.canInstall()) html += '<div class="card flat row"><span style="font-size:22px">📲</span><div class="grow small">Pasang Resilia di layar utama untuk akses cepat & offline.</div><button class="btn sm primary" data-act="install">Pasang</button></div>';
    html += '</div></div>';

    el.innerHTML = html;
    R.Charts.bars(U.$('#dash-cf', el), { labels: s.series6.map(function (x) { return U.monShort(x.month); }), highlight: 5,
      series: [{ name: 'Pemasukan', color: 'var(--income)', values: s.series6.map(function (x) { return x.income; }) }, { name: 'Pengeluaran', color: 'var(--expense)', values: s.series6.map(function (x) { return x.expense; }) }] });
    if (nw.points.length > 1) R.Charts.line(U.$('#dash-nw', el), { labels: nw.points.map(function (p) { return U.monShort(p.month); }), values: nw.points.map(function (p) { return p.netWorth; }), height: 130 });

    if (!el._bound) {
      el._bound = true;
      U.on(el, 'click', '[data-act]', function (e, b) {
        var a = b.getAttribute('data-act');
        if (a === 'add-tx') R.Forms.transaction();
        else if (a === 'profile') R.Forms.profile(['CurrentAge', 'RetirementAge', 'MonthlyEssentialExpense', 'EmergencyFundTargetMonths'], 'Profil keuangan');
        else if (a === 'dismiss-onboard') { U.LS.set('onboardDone', true); R.Router.render('dashboard', true); }
        else if (a === 'install') R.Main.install();
        else R.Router.go(a);
      });
    }
  }
  function kpi(label, value, cls, sub) {
    return '<div class="kpi"><div class="label">' + label + '</div><div class="v money ' + (cls || '') + '">' + value + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
  }
  return { render: render };
})();

;
/* ==== js/views/transactions.js ==== */
/* Resilia — views/transactions.js : search, filter, sort, date range, paginated list */
R.Views.transactions = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store, D = FinCalc.date;
  var st = { period: 'month', q: '', type: '', cat: '', acc: '', from: '', to: '', sort: 'new', limit: 60 };
  var PERIODS = [['today', 'Hari ini'], ['week', 'Minggu ini'], ['month', 'Bulan ini'], ['last', 'Bulan lalu'], ['all', 'Semua'], ['custom', 'Rentang…']];

  function range() {
    var t = U.today(), mk = U.monthKey();
    switch (st.period) {
      case 'today': return [t, t];
      case 'week': return [D.weekStart(t), t];
      case 'month': return [D.monthStart(mk), D.monthEnd(mk)];
      case 'last': var pm = D.addMonths(mk, -1); return [D.monthStart(pm), D.monthEnd(pm)];
      case 'custom': return [st.from || '0000-01-01', st.to || '9999-12-31'];
      default: return ['0000-01-01', '9999-12-31'];
    }
  }
  function filtered() {
    var r = range(), q = st.q.trim().toLowerCase();
    var list = S.all('Transactions').filter(function (t) {
      if (t.Date < r[0] || t.Date > r[1]) return false;
      if (st.type && t.Type !== st.type) return false;
      if (st.cat && t.CategoryID !== st.cat) return false;
      if (st.acc && t.AccountID !== st.acc && t.ToAccountID !== st.acc) return false;
      if (q) {
        var hay = (t.Description + ' ' + t.Notes + ' ' + A.catLabel(t.CategoryID) + ' ' + A.accountName(t.AccountID) + ' ' + t.Amount).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var cmp = {
      'new': function (a, b) { return b.Date.localeCompare(a.Date) || String(b.CreatedAt).localeCompare(String(a.CreatedAt)); },
      'old': function (a, b) { return a.Date.localeCompare(b.Date) || String(a.CreatedAt).localeCompare(String(b.CreatedAt)); },
      'high': function (a, b) { return Number(b.Amount) - Number(a.Amount); },
      'low': function (a, b) { return Number(a.Amount) - Number(b.Amount); }
    }[st.sort];
    return list.sort(cmp);
  }

  function render(el) {
    var s = A.summary();
    var nFilters = ['type', 'cat', 'acc'].filter(function (k) { return st[k]; }).length + (st.sort !== 'new' ? 1 : 0);
    el.innerHTML =
      '<div class="grid" style="grid-template-columns:repeat(3,1fr);margin-top:4px">' +
      mini('Hari ini', s.today.expense) + mini('Minggu ini', s.thisWeek.expense) + mini('Bulan ini', s.thisMonth.expense) + '</div>' +
      '<div class="toolbar"><div class="row"><label class="search grow">' + U.icon('search', 'muted') + '<span class="sr-only">Cari</span><input id="tx-q" type="search" placeholder="Cari keterangan, kategori, nominal…" value="' + U.esc(st.q) + '" autocomplete="off"></label>' +
      '<button class="btn" id="tx-filter" style="padding:0 12px">' + U.icon('filter') + (nFilters ? ' ' + nFilters : '') + '</button></div>' +
      '<div class="seg" style="margin-top:8px">' + PERIODS.map(function (p) { return '<button data-p="' + p[0] + '" class="' + (st.period === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
      '<div id="tx-sum"></div><div id="tx-list"></div>';
    renderList(el);
    if (el._bound) return;
    el._bound = true;
    el.addEventListener('input', U.debounce(function (e) { if (e.target.id === 'tx-q') { st.q = e.target.value; st.limit = 60; renderList(el); } }, 180));
    U.on(el, 'click', '[data-p]', function (e, b) {
      var p = b.getAttribute('data-p');
      if (p === 'custom') return openFilter(true);
      st.period = p; st.limit = 60; render(el);
    });
    U.on(el, 'click', '#tx-filter', function () { openFilter(false); });
    U.on(el, 'click', '[data-tx]', function (e, b) { var t = S.get('Transactions', b.getAttribute('data-tx')); if (t) R.Forms.transaction(t); });
    U.on(el, 'click', '#tx-more', function () { st.limit += 60; renderList(el); });
    U.on(el, 'click', '[data-act="reset"]', function () { st = { period: 'all', q: '', type: '', cat: '', acc: '', from: '', to: '', sort: 'new', limit: 60 }; render(el); });
  }
  function mini(label, v) { return '<div class="kpi" style="padding:10px 12px"><div class="label">' + label + '</div><div class="money expense" style="font-weight:700;font-size:15px;margin-top:2px">' + U.moneyShort(v) + '</div></div>'; }

  function renderList(el) {
    var list = filtered(), inc = 0, exp = 0;
    list.forEach(function (t) { if (t.Type === 'INCOME') inc += Number(t.Amount); else if (t.Type === 'EXPENSE') exp += Number(t.Amount); });
    U.$('#tx-sum', el).innerHTML = list.length ? '<div class="row between small" style="padding:4px 2px 0"><span class="muted">' + list.length + ' transaksi' + (st.period === 'custom' ? ' · ' + U.fmtDate(st.from) + ' – ' + U.fmtDate(st.to) : '') + '</span>' +
      '<span><span class="income money">+' + U.moneyShort(inc) + '</span> · <span class="expense money">−' + U.moneyShort(exp) + '</span></span></div>' : '';
    if (!list.length) {
      U.$('#tx-list', el).innerHTML = '<div class="card">' + (S.all('Transactions').length
        ? UI.empty('🔍', 'Tidak ada transaksi yang cocok.', '<button class="btn" data-act="reset">Tampilkan semua</button>')
        : UI.empty('🧾', 'Belum ada transaksi.<br>Ketuk tombol + untuk mencatat yang pertama.', '')) + '</div>';
      return;
    }
    var shown = list.slice(0, st.limit), html = '', day = null, byDate = st.sort === 'new' || st.sort === 'old', dayTotals = {};
    if (byDate) shown.forEach(function (t) { var d = dayTotals[t.Date] || (dayTotals[t.Date] = 0); dayTotals[t.Date] = d + (t.Type === 'INCOME' ? Number(t.Amount) : t.Type === 'EXPENSE' ? -Number(t.Amount) : 0); });
    html += '<div class="card" style="padding-top:4px;padding-bottom:4px">';
    shown.forEach(function (t) {
      if (byDate && t.Date !== day) {
        day = t.Date;
        html += '<div class="day-h"><span>' + U.fmtDate(day, 'long') + '</span><span class="money">' + U.money(dayTotals[day], { sign: true }) + '</span></div>';
      }
      html += item(t);
    });
    html += '</div>';
    if (list.length > st.limit) html += '<button class="btn block" id="tx-more" style="margin-top:12px">Muat lebih banyak (' + (list.length - st.limit) + ' lagi)</button>';
    U.$('#tx-list', el).innerHTML = html;
  }

  function item(t) {
    var isT = t.Type === 'TRANSFER', c = A.cat(t.CategoryID);
    var title = t.Description || (isT ? 'Transfer' : (c ? c.Name : 'Transaksi'));
    var sub = isT ? A.accountName(t.AccountID) + ' → ' + A.accountName(t.ToAccountID) : (c ? c.Name : '') + ' · ' + A.accountName(t.AccountID);
    var cls = t.Type === 'INCOME' ? 'income' : t.Type === 'EXPENSE' ? 'expense' : 'transfer';
    var sign = t.Type === 'INCOME' ? '+' : t.Type === 'EXPENSE' ? '−' : '';
    var flag = t._error ? '<span class="badge-dot err" title="' + U.esc(t._error) + '"></span>' : (t._dirty ? '<span class="badge-dot" title="Belum tersinkron"></span>' : '');
    return '<div class="item" data-tx="' + U.esc(t.TransactionID) + '"><span class="ico" style="background:' + (c && c.Color ? c.Color + '1F' : 'var(--surface-2)') + '">' + U.esc(isT ? '⇄' : (c && c.Icon) || '•') + '</span>' +
      '<div class="grow"><div class="t ellipsis">' + U.esc(title) + flag + '</div><div class="st ellipsis">' + U.esc(sub) + (st.sort === 'high' || st.sort === 'low' ? ' · ' + U.fmtDate(t.Date) : '') + '</div>' +
      (t._error ? '<div class="xs bad">Ditolak server: ' + U.esc(t._error) + '</div>' : '') + '</div>' +
      '<div class="amt money ' + cls + '">' + sign + U.money(t.Amount) + '</div></div>';
  }

  function openFilter(customRange) {
    var cats = A.categories(null, true).map(function (c) { return { value: c.CategoryID, label: (c.Type === 'INCOME' ? '↓ ' : '↑ ') + c.Name }; });
    var r = range();
    R.UI.form({
      title: 'Filter & urutkan', submitText: 'Terapkan',
      values: { type: st.type, cat: st.cat, acc: st.acc, sort: st.sort, from: st.from || (st.period === 'all' ? '' : r[0]), to: st.to || (st.period === 'all' ? '' : r[1]), useRange: customRange || st.period === 'custom' },
      fields: [
        { name: 'type', type: 'seg', label: 'Jenis', options: [{ value: '', label: 'Semua' }, { value: 'INCOME', label: 'Masuk' }, { value: 'EXPENSE', label: 'Keluar' }, { value: 'TRANSFER', label: 'Transfer' }] },
        { name: 'cat', type: 'select', label: 'Kategori', empty: 'Semua kategori', options: cats },
        { name: 'acc', type: 'select', label: 'Akun', empty: 'Semua akun', options: A.accounts(true).map(function (a) { return { value: a.AccountID, label: a.Name }; }) },
        { name: 'useRange', type: 'toggle', label: 'Rentang tanggal khusus' },
        { name: 'from', type: 'date', label: 'Dari', show: function (x) { return x.useRange; } },
        { name: 'to', type: 'date', label: 'Sampai', show: function (x) { return x.useRange; } },
        { name: 'sort', type: 'select', label: 'Urutkan', options: [{ value: 'new', label: 'Terbaru' }, { value: 'old', label: 'Terlama' }, { value: 'high', label: 'Nominal terbesar' }, { value: 'low', label: 'Nominal terkecil' }] }
      ],
      buttons: [{ text: 'Reset', onClick: function () { st = { period: 'month', q: st.q, type: '', cat: '', acc: '', from: '', to: '', sort: 'new', limit: 60 }; R.Router.render('transactions', true); } }],
      validate: function (x) { if (x.useRange && x.from && x.to && x.from > x.to) return { to: 'Tanggal akhir sebelum tanggal awal' }; },
      onSubmit: function (x) {
        st.type = x.type; st.cat = x.cat; st.acc = x.acc; st.sort = x.sort; st.limit = 60;
        if (x.useRange) { st.period = 'custom'; st.from = x.from || ''; st.to = x.to || ''; }
        else if (st.period === 'custom') { st.period = 'month'; st.from = st.to = ''; }
        R.Router.render('transactions', true);
      }
    });
  }

  return { render: render, setFilter: function (o) { Object.assign(st, o, { limit: 60 }); } };
})();

;
/* ==== js/views/cashflow.js ==== */
/* Resilia — views/cashflow.js : income vs expense, net cash flow, savings rate, categories */
R.Views.cashflow = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store, D = FinCalc.date;
  var period = 'month';
  var PERIODS = [['month', 'Bulan ini'], ['last', 'Bulan lalu'], ['3m', '3 Bulan'], ['6m', '6 Bulan'], ['1y', '1 Tahun']];

  function info() {
    var mk = U.monthKey(), t = U.today();
    switch (period) {
      case 'last': var p = D.addMonths(mk, -1); return { start: D.monthStart(p), end: D.monthEnd(p), months: 1, endMonth: p };
      case '3m': return { start: D.monthStart(D.addMonths(mk, -2)), end: t, months: 3, endMonth: mk };
      case '6m': return { start: D.monthStart(D.addMonths(mk, -5)), end: t, months: 6, endMonth: mk };
      case '1y': return { start: D.monthStart(D.addMonths(mk, -11)), end: t, months: 12, endMonth: mk };
      default: return { start: D.monthStart(mk), end: t, months: 1, endMonth: mk };
    }
  }

  function render(el) {
    var data = S.calcData(), p = info(), cf = FinCalc.cashflow(data, p.start, p.end);
    var seriesN = Math.max(p.months, 6), series = FinCalc.monthlySeries(data, p.endMonth, seriesN);
    var s = A.summary(), avg = p.months > 1 ? ' / ' + p.months + ' bln' : '';
    var cats = Object.keys(cf.expenseByCategory).map(function (id) { var c = A.cat(id); return { label: c ? c.Name : 'Lainnya', value: cf.expenseByCategory[id], color: c && c.Color }; });
    var incs = Object.keys(cf.incomeByCategory).map(function (id) { var c = A.cat(id); return { label: c ? c.Name : 'Lainnya', value: cf.incomeByCategory[id], color: c && c.Color }; });

    el.innerHTML =
      '<div class="seg" style="margin-top:4px">' + PERIODS.map(function (x) { return '<button data-p="' + x[0] + '" class="' + (period === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="small muted" style="margin:8px 2px 0">' + U.fmtDate(p.start) + ' – ' + U.fmtDate(p.end) + '</div>' +
      '<div class="grid k2 k4">' +
      kpi('Pemasukan', U.money(cf.income), 'income', p.months > 1 ? '≈ ' + U.moneyShort(cf.income / p.months) + '/bln' : '') +
      kpi('Pengeluaran', U.money(cf.expense), 'expense', p.months > 1 ? '≈ ' + U.moneyShort(cf.expense / p.months) + '/bln' : '') +
      kpi('Net cash flow', U.money(cf.net, { sign: true }), cf.net >= 0 ? 'income' : 'expense', cf.net >= 0 ? 'Surplus' + avg : 'Defisit' + avg) +
      kpi('Savings rate', U.pct(cf.savingsRate), '', 'Target ' + U.pct(s.profile.SavingsRateTarget, 0)) + '</div>' +
      (cf.count === 0 ? '<div class="card">' + UI.empty('📭', 'Tidak ada transaksi pada periode ini.') + '</div>' : '') +
      '<div class="grid d2"><div class="card"><h3>Pemasukan vs pengeluaran</h3><div id="cf-bars"></div></div>' +
      '<div class="card"><h3>Tren arus kas bersih</h3><div id="cf-net"></div><div class="small muted">Rata-rata ' + U.esc(s.trailing.basis) + ': <b class="money">' + U.money(s.trailing.avgNet, { sign: true }) + '</b>/bulan</div></div></div>' +
      '<div class="grid d2"><div class="card"><h3>Pengeluaran per kategori</h3><div id="cf-cat">' + (cats.length ? '' : '<div class="muted small">Belum ada pengeluaran.</div>') + '</div></div>' +
      '<div class="card"><h3>Sumber pemasukan</h3><div id="cf-inc">' + (incs.length ? '' : '<div class="muted small">Belum ada pemasukan.</div>') + '</div></div></div>' +
      '<div class="card flat small"><b>Rumus.</b> Net Cash Flow = Pemasukan − Pengeluaran. Savings Rate = Net Cash Flow ÷ Pemasukan × 100. Transfer antar akun tidak dihitung.</div>';

    var labels = series.map(function (x) { return seriesN > 6 ? U.monShort(x.month).slice(0, 3) : U.monShort(x.month); });
    var hl = p.months === 1 ? series.map(function (x) { return x.month; }).indexOf(p.endMonth) : undefined;
    R.Charts.bars(U.$('#cf-bars', el), { labels: labels, highlight: hl, series: [
      { name: 'Pemasukan', color: 'var(--income)', values: series.map(function (x) { return x.income; }) },
      { name: 'Pengeluaran', color: 'var(--expense)', values: series.map(function (x) { return x.expense; }) }] });
    R.Charts.line(U.$('#cf-net', el), { labels: labels, values: series.map(function (x) { return x.net; }), color: 'var(--gold)' });
    if (cats.length) R.Charts.donut(U.$('#cf-cat', el), { items: cats, center: U.moneyShort(cf.expense), sub: 'pengeluaran' });
    if (incs.length) R.Charts.donut(U.$('#cf-inc', el), { items: incs, center: U.moneyShort(cf.income), sub: 'pemasukan' });

    if (!el._bound) { el._bound = true; U.on(el, 'click', '[data-p]', function (e, b) { period = b.getAttribute('data-p'); render(el); }); }
  }
  function kpi(label, v, cls, sub) { return '<div class="kpi"><div class="label">' + label + '</div><div class="v money ' + cls + '">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
  return { render: render };
})();

;
/* ==== js/views/budget.js ==== */
/* Resilia — views/budget.js : monthly budget per expense category (🟢 <70% · 🟡 70–90% · 🔴 >90%) */
R.Views.budget = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store, D = FinCalc.date;
  var month = null;
  var EMO = { green: '🟢', yellow: '🟡', red: '🔴' };

  function render(el) {
    month = month || U.monthKey();
    var list = FinCalc.budgetStatus(S.calcData(), month);
    var limit = 0, used = 0;
    list.forEach(function (b) { limit += b.limit; used += b.used; });
    var cf = FinCalc.cashflow(S.calcData(), D.monthStart(month), D.monthEnd(month));
    var budgeted = {}; list.forEach(function (b) { budgeted[b.categoryId] = 1; });
    var unbudgeted = Object.keys(cf.expenseByCategory).filter(function (id) { return !budgeted[id]; })
      .map(function (id) { return { id: id, name: A.catLabel(id), icon: A.catIcon(id), amount: cf.expenseByCategory[id] }; }).sort(function (a, b) { return b.amount - a.amount; });
    var isCurrent = month === U.monthKey();
    var daysLeft = isCurrent ? (+D.monthEnd(month).slice(8) - +U.today().slice(8) + 1) : 0;

    var html = '<div class="card"><div class="month-nav"><button class="icon-btn" data-m="-1" aria-label="Bulan sebelumnya">' + U.icon('left') + '</button><strong>' + U.fmtMonth(month) + '</strong>' +
      '<button class="icon-btn" data-m="1" aria-label="Bulan berikutnya">' + U.icon('right') + '</button></div>';
    if (list.length) {
      var pct = limit > 0 ? used / limit : 0, col = pct > 0.9 ? 'red' : pct >= 0.7 ? 'yellow' : 'green';
      html += '<div class="row between" style="margin-top:8px"><div><div class="label">Terpakai</div><div class="mid money">' + U.money(used) + '</div></div>' +
        '<div style="text-align:right"><div class="label">Total budget</div><div class="mid money">' + U.money(limit) + '</div></div></div>' +
        '<div style="margin-top:8px">' + UI.bar(pct, col, true) + '</div><div class="row between small muted" style="margin-top:6px"><span>' + U.pct(pct * 100, 0) + ' terpakai</span>' +
        (isCurrent && limit > used ? '<span>Sisa ' + U.money(limit - used) + ' · ≈ ' + U.money((limit - used) / Math.max(1, daysLeft)) + '/hari</span>' : '') + '</div>';
    }
    html += '</div>';

    if (!list.length) {
      html += '<div class="card">' + UI.empty('🎯', 'Belum ada budget untuk ' + U.fmtMonth(month) + '.<br>Budget membantu menjaga pengeluaran di bawah pemasukan.',
        '<div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn primary" data-act="add">Tambah budget</button>' + (hasPrev() ? '<button class="btn" data-act="copy">Salin dari bulan lalu</button>' : '') + '</div>') + '</div>';
    } else {
      html += '<div class="section-h">Per kategori <a class="more" href="javascript:void(0)" data-act="add">+ Tambah</a></div><div class="card"><ul class="list">';
      list.forEach(function (b) {
        html += '<li class="item" data-b="' + U.esc(b.id) + '" style="display:block"><div class="row between"><span class="row" style="gap:8px"><span>' + U.esc(b.icon || '•') + '</span><b>' + U.esc(b.category) + '</b></span>' +
          '<span class="small">' + EMO[b.color] + ' <b>' + U.pct(b.pct, 0) + '</b></span></div>' +
          '<div style="margin:8px 0 6px">' + UI.bar(b.pct / 100, b.color) + '</div>' +
          '<div class="row between small muted"><span>Terpakai <span class="money">' + U.money(b.used) + '</span></span><span>Budget <span class="money">' + U.money(b.limit) + '</span></span></div>' +
          (b.exceeded ? '<div class="insight warn" style="margin-top:8px"><span class="i">⚠</span><span><b>Budget terlampaui.</b> Anda sudah mengeluarkan ' + U.money(b.over) + ' di atas budget ' + U.esc(b.category) + '.</span></div>' : '') + '</li>';
      });
      html += '</ul></div>';
      if (!S.all('Budgets').some(function (b) { return b.Month === D.addMonths(month, 1); }) && month === U.monthKey()) html += '<button class="btn block" data-act="copy-next" style="margin-top:12px">Salin budget ke bulan depan</button>';
    }
    if (unbudgeted.length) {
      html += '<div class="section-h">Pengeluaran tanpa budget</div><div class="card"><ul class="list">' + unbudgeted.slice(0, 8).map(function (u) {
        return '<li class="item" data-newb="' + U.esc(u.id) + '"><span class="ico">' + U.esc(u.icon) + '</span><span class="grow">' + U.esc(u.name) + '</span><span class="money small">' + U.money(u.amount) + '</span><span class="chip brand">+ Budget</span></li>';
      }).join('') + '</ul></div>';
    }
    html += '<div class="card flat small">Status: 🟢 di bawah 70% · 🟡 70–90% · 🔴 di atas 90% dari budget.</div>';
    el.innerHTML = html;

    if (el._bound) return;
    el._bound = true;
    U.on(el, 'click', '[data-m]', function (e, b) { month = D.addMonths(month, +b.getAttribute('data-m')); render(el); });
    U.on(el, 'click', '[data-act="add"]', function () { R.Forms.budget(null, month); });
    U.on(el, 'click', '[data-b]', function (e, b) { var x = S.get('Budgets', b.getAttribute('data-b')); if (x) R.Forms.budget(x); });
    U.on(el, 'click', '[data-newb]', function (e, b) {
      R.UI.form({ title: 'Budget ' + A.catLabel(b.getAttribute('data-newb')) + ' · ' + U.fmtMonth(month), fields: [{ name: 'LimitAmount', type: 'money', label: 'Batas per bulan', required: true }],
        onSubmit: function (x) { return S.save('Budgets', { Month: month, CategoryID: b.getAttribute('data-newb'), LimitAmount: Number(x.LimitAmount) }); } });
    });
    U.on(el, 'click', '[data-act="copy"]', function () { copy(D.addMonths(month, -1), month); });
    U.on(el, 'click', '[data-act="copy-next"]', function () { copy(month, D.addMonths(month, 1)); });
  }
  function hasPrev() { var pm = D.addMonths(month, -1); return S.all('Budgets').some(function (b) { return b.Month === pm; }); }
  function copy(from, to) {
    var existing = {}; S.all('Budgets').forEach(function (b) { if (b.Month === to) existing[b.CategoryID] = 1; });
    var items = S.all('Budgets').filter(function (b) { return b.Month === from && !existing[b.CategoryID]; })
      .map(function (b) { return { entity: 'Budgets', rec: { BudgetID: U.uuid(), Month: to, CategoryID: b.CategoryID, LimitAmount: b.LimitAmount } }; });
    if (!items.length) return UI.toast('Tidak ada budget untuk disalin', 'info');
    S.saveMany(items).then(function () { UI.toast(items.length + ' budget disalin ke ' + U.fmtMonth(to)); });
  }
  return { render: render };
})();

;
/* ==== js/views/emergency.js ==== */
/* Resilia — views/emergency.js : "how many months can I survive without income?" */
R.Views.emergency = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store;

  function render(el) {
    var s = A.summary(), ef = s.emergencyFund, b = s.balance;
    var liquidAcc = A.accounts().filter(function (a) { return ['CASH', 'BANK', 'E_WALLET'].indexOf(a.Type) >= 0; });
    var cashAssets = S.all('Assets').filter(function (x) { return x.Type === 'CASH'; });
    var html = '<div class="card hero"><div class="label">Dana darurat Anda cukup untuk</div>' +
      '<div class="big" style="font-size:40px;margin:4px 0">' + (ef.months === null ? '–' : U.number(ef.months, 1)) + ' <span style="font-size:18px;font-weight:600">bulan</span></div>' +
      '<span class="chip">' + ef.status.emoji + ' ' + ef.status.label + '</span>' +
      '<div style="margin-top:14px">' + UI.bar(ef.progress, '', true) + '</div>' +
      '<div class="row between small" style="margin-top:6px"><span class="muted">Progres ke target</span><b>' + U.pct(ef.progress * 100, 0) + ' dari ' + ef.target + ' bulan</b></div></div>';

    if (ef.months === null) html += '<div class="card">' + UI.empty('🛡', 'Catat pengeluaran atau isi <b>pengeluaran esensial</b> di profil agar dana darurat bisa dihitung.', '<button class="btn primary" data-act="ess">Isi pengeluaran esensial</button>') + '</div>';

    html += '<div class="card"><h3>Target</h3><div class="seg full" style="--n:4">' + [3, 6, 9, 12].map(function (n) { return '<button data-t="' + n + '" class="' + (ef.target === n ? 'on' : '') + '">' + n + ' bln</button>'; }).join('') + '</div>' +
      '<div class="kv" style="margin-top:14px"><span>Dana darurat target</span><span class="money">' + U.money(ef.targetAmount) + '</span>' +
      '<span>Aset likuid saat ini</span><span class="money">' + U.money(ef.liquid) + '</span>' +
      '<span>Kekurangan</span><span class="money ' + (ef.gap > 0 ? 'bad' : 'good') + '">' + (ef.gap > 0 ? U.money(ef.gap) : 'Tercapai ✓') + '</span>' +
      (ef.gap > 0 ? '<span>Setoran agar tercapai dalam 6 bulan</span><span class="money">' + U.money(ef.monthlyFor6) + '/bln</span><span>…dalam 12 bulan</span><span class="money">' + U.money(ef.monthlyFor12) + '/bln</span>' : '') +
      '</div>' + (ef.gap > 0 && s.trailing.avgNet > 0 ? '<div class="small muted" style="margin-top:8px">Surplus rata-rata Anda ' + U.money(s.trailing.avgNet) + '/bulan.</div>' : '') + '</div>';

    html += '<div class="card"><h3>Pengeluaran esensial <a class="more" href="javascript:void(0)" data-act="ess">Ubah</a></h3><div class="mid money">' + U.money(ef.essential) + '<span class="small muted"> / bulan</span></div>' +
      '<div class="small muted" style="margin-top:4px">Sumber: ' + U.esc(ef.essentialBasis === 'none' ? 'belum ada data' : ef.essentialBasis) + '. Tandai kategori sebagai "esensial" di Pengaturan → Kategori.</div></div>';

    html += '<div class="card"><h3>Aset likuid</h3><ul class="list">' + liquidAcc.map(function (a) {
      return '<li class="item" data-acc="' + U.esc(a.AccountID) + '"><span class="ico">' + (a.Type === 'CASH' ? '💵' : a.Type === 'BANK' ? '🏦' : '📱') + '</span><span class="grow">' + U.esc(a.Name) + '</span><span class="money">' + U.money(b.balances[a.AccountID] || 0) + '</span></li>';
    }).join('') + cashAssets.map(function (x) { return '<li class="item"><span class="ico">💰</span><span class="grow">' + U.esc(x.Name) + '</span><span class="money">' + U.money(x.CurrentValue) + '</span></li>'; }).join('') +
      (liquidAcc.length + cashAssets.length ? '' : '<li class="muted small">Belum ada akun tunai/bank/e-wallet.</li>') + '</ul></div>';

    html += '<div class="card flat small"><b>Rumus.</b> Dana darurat (bulan) = Aset likuid ÷ Pengeluaran esensial bulanan. Status: 🔴 &lt; 1 bulan · 🟠 1–3 · 🟡 3–6 · 🟢 6+ bulan. Aset likuid = saldo akun Tunai/Bank/E-Wallet + aset jenis Kas. Investasi tidak dihitung karena nilainya bisa turun saat dibutuhkan.</div>';
    el.innerHTML = html;

    if (el._bound) return;
    el._bound = true;
    U.on(el, 'click', '[data-t]', function (e, btn) { A.saveProfile({ EmergencyFundTargetMonths: +btn.getAttribute('data-t') }).then(function () { UI.toast('Target diperbarui'); }); });
    U.on(el, 'click', '[data-act="ess"]', function () { R.Forms.profile(['MonthlyEssentialExpense'], 'Pengeluaran esensial'); });
    U.on(el, 'click', '[data-acc]', function (e, li) { var a = S.get('Accounts', li.getAttribute('data-acc')); if (a) R.Forms.account(a); });
  }
  return { render: render };
})();

;
/* ==== js/views/debt.js ==== */
/* Resilia — views/debt.js : total debt, monthly payment, DTI, avalanche order, payoff estimates */
R.Views.debt = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store, F = R.Forms;

  function render(el) {
    var s = A.summary(), d = s.debt, paid = S.all('Liabilities').filter(function (l) { return Number(l.Outstanding) <= 0; });
    var html = '<div class="grid k2 k4" style="margin-top:4px">' +
      kpi('Total utang', U.money(d.total), '') + kpi('Cicilan / bulan', U.money(d.monthlyPayment), '') +
      kpi('Debt-to-Income', d.dti === null ? '–' : U.pct(d.dti), '<span class="chip ' + d.status.color + '">' + d.status.label + '</span>') +
      kpi('Pemasukan rata-rata', U.money(s.trailing.avgIncome), U.esc(s.trailing.basis)) + '</div>';

    if (d.total > 0) {
      html += '<div class="card"><h3>DTI ' + U.pct(d.dti) + '</h3>' + UI.bar(Math.min(1, (d.dti || 0) / 60), d.status.color === 'gray' ? '' : d.status.color, true) +
        '<div class="row between xs muted" style="margin-top:6px"><span>0%</span><span>Sehat ≤20%</span><span>Batas 35%</span><span>50%+</span></div>' +
        '<div style="margin-top:12px">' + d.recommendations.map(function (r) { return '<div class="insight ' + (/tinggi|tidak akan|DTI di atas/.test(r) ? 'warn' : '') + '"><span class="i">💡</span><span>' + U.esc(r) + '</span></div>'; }).join('') + '</div></div>';
    }

    html += '<div class="section-h">Daftar utang' + (d.items.length > 1 ? ' · urutan pelunasan (bunga tertinggi dulu)' : '') + '<a class="more" href="javascript:void(0)" data-act="add">+ Tambah</a></div>';
    if (!d.items.length) html += '<div class="card">' + UI.empty('🎉', paid.length ? 'Semua utang lunas!' : 'Belum ada utang tercatat.', '<button class="btn" data-act="add">Catat utang</button>') + '</div>';
    d.items.forEach(function (x, i) {
      html += '<div class="card" data-debt="' + U.esc(x.id) + '"><div class="row between"><div class="grow"><div class="row wrap" style="gap:6px"><b>' + (d.items.length > 1 ? (i + 1) + '. ' : '') + U.esc(x.name) + '</b>' +
        (x.highCost ? UI.chip('Bunga tinggi', 'red') : '') + '</div><div class="small muted">' + U.esc(F.label(F.DEBT_TYPES, x.type)) + ' · ' + U.pct(x.rate) + '/th' + (x.dueDate ? ' · jatuh tempo tgl ' + x.dueDate : '') + '</div></div>' +
        '<div style="text-align:right"><div class="mid money">' + U.money(x.outstanding) + '</div><div class="xs muted">sisa</div></div></div>' +
        (x.paidPct !== null ? '<div style="margin:10px 0 4px">' + UI.bar(x.paidPct, 'green') + '</div><div class="xs muted">' + U.pct(x.paidPct * 100, 0) + ' dari pokok ' + U.money(x.principal) + ' sudah dibayar</div>' : '') +
        '<div class="kv small" style="margin-top:10px"><span>Cicilan/bulan</span><span class="money">' + U.money(x.payment) + '</span><span>Estimasi lunas</span><span class="' + (x.payoffMonths === null ? 'bad' : '') + '">' +
        (x.payoffMonths === null ? 'Tidak akan lunas dengan cicilan ini' : x.payoffMonths + ' bulan (' + U.fmtMonth(FinCalc.date.addMonths(U.monthKey(), x.payoffMonths)) + ')') + '</span></div>' +
        '<div class="row" style="margin-top:12px"><button class="btn sm primary" data-pay="' + U.esc(x.id) + '">Catat pembayaran</button><button class="btn sm" data-edit="' + U.esc(x.id) + '">Edit</button></div></div>';
    });
    if (paid.length) html += '<div class="section-h">Lunas</div><div class="card"><ul class="list">' + paid.map(function (l) { return '<li class="item" data-edit="' + U.esc(l.DebtID) + '"><span class="ico">✅</span><span class="grow">' + U.esc(l.Name) + '</span><span class="muted small">Lunas</span></li>'; }).join('') + '</ul></div>';
    html += '<div class="card flat small"><b>Rumus.</b> DTI = Total cicilan bulanan ÷ Pemasukan bulanan × 100. Utang "bunga tinggi" = bunga ≥ ' + U.pct(d.threshold, 0) + '/th (ubah di Asumsi). Estimasi lunas memakai cicilan tetap & bunga majemuk bulanan.</div>';
    el.innerHTML = html;

    if (el._bound) return;
    el._bound = true;
    U.on(el, 'click', '[data-act="add"]', function () { F.debt(); });
    U.on(el, 'click', '[data-edit]', function (e, b) { e.stopPropagation(); var x = S.get('Liabilities', b.getAttribute('data-edit')); if (x) F.debt(x); });
    U.on(el, 'click', '[data-pay]', function (e, b) { e.stopPropagation(); var x = S.get('Liabilities', b.getAttribute('data-pay')); if (x) F.debtPayment(x); });
  }
  function kpi(label, v, sub) { return '<div class="kpi"><div class="label">' + label + '</div><div class="v money">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
  return { render: render };
})();

;
/* ==== js/views/assets.js ==== */
/* Resilia — views/assets.js : net worth (main KPI), net worth over time, allocation, accounts & assets */
R.Views.assets = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store, F = R.Forms;
  var TYPE_LABEL = { CASH: 'Tunai/Kas', BANK: 'Bank', E_WALLET: 'E-Wallet', INVESTMENT: 'Rek. investasi', GOLD: 'Emas', STOCK: 'Saham/RD', CRYPTO: 'Kripto', PROPERTY: 'Properti', VEHICLE: 'Kendaraan', BUSINESS: 'Bisnis', OTHER: 'Lainnya' };
  var TYPE_COLOR = { CASH: '#0B5D4B', BANK: '#0E7490', E_WALLET: '#2563EB', INVESTMENT: '#7C3AED', GOLD: '#C8962E', STOCK: '#DB2777', CRYPTO: '#EA580C', PROPERTY: '#7C2D12', VEHICLE: '#64748B', BUSINESS: '#65A30D', OTHER: '#94A3B8' };
  var ACC_ICON = { CASH: '💵', BANK: '🏦', E_WALLET: '📱', INVESTMENT: '📈', OTHER: '📦' };
  var AST_ICON = { CASH: '💰', GOLD: '🥇', STOCK: '📈', CRYPTO: '🪙', PROPERTY: '🏠', VEHICLE: '🚗', BUSINESS: '🏪', OTHER: '📦' };

  function render(el) {
    var s = A.summary(), b = s.balance, nw = s.netWorth;
    var accs = A.accounts(true), assets = S.all('Assets').sort(function (x, y) { return Number(y.CurrentValue) - Number(x.CurrentValue); });
    var html = '<div class="card hero"><div class="label">Kekayaan bersih (Net Worth)</div><div class="big money" style="margin:4px 0 8px">' + U.money(b.netWorth) + '</div>' +
      '<div class="row wrap small">' + (nw.lastMonth !== null ? '<span class="muted">Bulan lalu ' + U.money(nw.lastMonth) + '</span><span class="chip">' + (nw.growthPct >= 0 ? '▲ +' : '▼ ') + U.pct(nw.growthPct) + ' (' + U.money(nw.growthAbs, { sign: true }) + ')</span>' : '<span class="muted">Pertumbuhan tampil mulai bulan depan</span>') + '</div>' +
      '<div class="grid k2" style="margin-top:14px"><div><div class="label">Total aset</div><div class="money" style="font-weight:700">' + U.money(b.totalAssets) + '</div></div>' +
      '<div><div class="label">Total utang</div><div class="money" style="font-weight:700">' + U.money(b.totalLiabilities) + '</div></div></div></div>';

    html += '<div class="grid d2"><div class="card"><h3>Net worth dari waktu ke waktu</h3><div id="as-nw"></div>' + (nw.points.length < 2 ? '<div class="muted small">Grafik terbentuk dari snapshot bulanan otomatis. Kembali bulan depan untuk melihat tren.</div>' : '') + '</div>' +
      '<div class="card"><h3>Alokasi aset</h3><div id="as-alloc">' + (b.totalAssets > 0 ? '' : '<div class="muted small">Belum ada aset.</div>') + '</div>' +
      (b.assetGainPct !== null ? '<div class="small" style="margin-top:8px">Pertumbuhan nilai aset non-rekening: <b class="' + (b.assetGain >= 0 ? 'good' : 'bad') + '">' + U.money(b.assetGain, { sign: true }) + ' (' + U.pct(b.assetGainPct) + ')</b> dari nilai beli</div>' : '') + '</div></div>';

    html += '<div class="section-h">Akun <a class="more" href="javascript:void(0)" data-act="add-acc">+ Akun</a></div><div class="card"><ul class="list">' +
      (accs.length ? accs.map(function (a) {
        var bal = b.balances[a.AccountID] || 0;
        return '<li class="item" data-acc="' + U.esc(a.AccountID) + '"><span class="ico">' + (ACC_ICON[a.Type] || '•') + '</span><div class="grow"><div class="t">' + U.esc(a.Name) + (a._dirty ? '<span class="badge-dot"></span>' : '') + '</div><div class="st">' + TYPE_LABEL[a.Type] + (a.Active === false ? ' · non-aktif' : '') + '</div></div><div class="amt money ' + (bal < 0 ? 'bad' : '') + '">' + U.money(bal) + '</div></li>';
      }).join('') : '<li class="muted small">Belum ada akun.</li>') + '</ul></div>';

    html += '<div class="section-h">Aset lain <a class="more" href="javascript:void(0)" data-act="add-asset">+ Aset</a></div><div class="card"><ul class="list">' +
      (assets.length ? assets.map(function (x) {
        var gain = Number(x.CurrentValue) - Number(x.PurchaseValue || 0), gp = Number(x.PurchaseValue) > 0 ? gain / Number(x.PurchaseValue) * 100 : null;
        return '<li class="item" data-asset="' + U.esc(x.AssetID) + '"><span class="ico">' + (AST_ICON[x.Type] || '•') + '</span><div class="grow"><div class="t ellipsis">' + U.esc(x.Name) + '</div><div class="st">' + TYPE_LABEL[x.Type] + ' · per ' + U.fmtDate(x.Date) + '</div></div>' +
          '<div style="text-align:right"><div class="amt money">' + U.money(x.CurrentValue) + '</div>' + (gp !== null ? '<div class="xs ' + (gain >= 0 ? 'good' : 'bad') + '">' + (gain >= 0 ? '+' : '') + U.pct(gp) + '</div>' : '') + '</div></li>';
      }).join('') : '<li>' + UI.empty('🥇', 'Catat emas, properti, kendaraan, saham, atau bisnis Anda.', '') + '</li>') + '</ul></div>';

    html += UI.disclaimer('Aplikasi hanya mencatat dan menghitung data finansial Anda — bukan rekomendasi investasi. Akun = saldo kas/bank/e-wallet/rekening investasi; Aset lain = aset di luar rekening. Jangan mencatat hal yang sama di keduanya.');
    el.innerHTML = html;

    if (nw.points.length > 1) R.Charts.line(U.$('#as-nw', el), { labels: nw.points.map(function (p) { return U.monShort(p.month) + (nw.points.length > 12 ? ' ' + p.month.slice(2, 4) : ''); }), values: nw.points.map(function (p) { return p.netWorth; }) });
    if (b.totalAssets > 0) R.Charts.donut(U.$('#as-alloc', el), { items: Object.keys(b.allocation).map(function (k) { return { label: TYPE_LABEL[k] || k, value: b.allocation[k], color: TYPE_COLOR[k] }; }), center: U.moneyShort(b.totalAssets), sub: 'total aset' });

    if (el._bound) return;
    el._bound = true;
    U.on(el, 'click', '[data-act="add-acc"]', function () { F.account(); });
    U.on(el, 'click', '[data-act="add-asset"]', function () { F.asset(); });
    U.on(el, 'click', '[data-acc]', function (e, li) { var a = R.Store.all('Accounts').filter(function (x) { return x.AccountID === li.getAttribute('data-acc'); })[0]; if (a) F.account(a); });
    U.on(el, 'click', '[data-asset]', function (e, li) { var a = S.get('Assets', li.getAttribute('data-asset')); if (a) F.asset(a); });
  }
  return { render: render };
})();

;
/* ==== js/views/goals.js ==== */
/* Resilia — views/goals.js : target, current, remaining, target date, monthly required saving, progress */
R.Views.goals = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store, F = R.Forms;
  var PRI = { HIGH: ['Tinggi', 'red'], MEDIUM: ['Sedang', 'yellow'], LOW: ['Rendah', ''] };

  function render(el) {
    var s = A.summary(), goals = s.goals;
    var active = goals.filter(function (g) { return !g.achieved && g.status !== 'PAUSED'; });
    var need = active.reduce(function (t, g) { return t + (g.requiredMonthly || 0); }, 0);
    var tgt = goals.reduce(function (t, g) { return t + g.target; }, 0), cur = goals.reduce(function (t, g) { return t + Math.min(g.current, g.target); }, 0);
    var html = '';
    if (goals.length) {
      html += '<div class="card hero"><div class="row between"><div><div class="label">Total terkumpul</div><div class="big money">' + U.money(cur) + '</div><div class="small muted">dari ' + U.money(tgt) + '</div></div>' +
        UI.ring(tgt ? cur / tgt * 100 : 0, 100, '#E0B35A', '%') + '</div>' +
        '<div class="kv small" style="margin-top:12px;color:#fff"><span class="muted">Setoran dibutuhkan / bulan</span><span class="money">' + U.money(need) + '</span>' +
        '<span class="muted">Surplus rata-rata / bulan</span><span class="money">' + U.money(Math.max(0, s.trailing.avgNet)) + '</span></div>' +
        (need > Math.max(0, s.trailing.avgNet) && s.trailing.hasData ? '<div class="small" style="margin-top:8px;color:#FDE68A">⚠ Setoran yang dibutuhkan melebihi surplus. Pertimbangkan memundurkan target tanggal atau memprioritaskan.</div>' : '') + '</div>';
    }
    html += '<div class="section-h">Tujuan aktif <a class="more" href="javascript:void(0)" data-act="add">+ Tujuan</a></div>';
    if (!goals.length) html += '<div class="card">' + UI.empty('🎯', 'Belum ada tujuan finansial.<br>Mulai dari dana darurat, lalu rumah, pendidikan, atau pensiun.', '<button class="btn primary" data-act="add">Buat tujuan</button>') + '</div>';
    goals.forEach(function (g) {
      var p = PRI[g.priority] || PRI.MEDIUM;
      html += '<div class="card" data-goal="' + U.esc(g.id) + '"' + (g.status === 'PAUSED' ? ' style="opacity:.7"' : '') + '><div class="row between"><div class="grow"><div class="row" style="gap:6px"><b class="ellipsis">' + U.esc(g.name) + '</b>' + (g.achieved ? UI.chip('Tercapai 🎉', 'green') : g.status === 'PAUSED' ? UI.chip('Ditunda') : UI.chip(p[0], p[1])) + '</div>' +
        '<div class="small muted">' + (g.targetDate ? 'Target ' + U.fmtDate(g.targetDate) + (g.monthsLeft ? ' · ' + g.monthsLeft + ' bln lagi' : '') : 'Tanpa tanggal target') + '</div></div>' +
        '<b class="mid">' + U.pct(g.progress * 100, 0) + '</b></div>' +
        '<div style="margin:10px 0 8px">' + UI.bar(g.progress, g.achieved ? 'green' : g.overdue ? 'red' : 'gold', true) + '</div>' +
        '<div class="grid k2 small" style="gap:4px 12px"><span class="muted">Terkumpul</span><span class="money" style="text-align:right">' + U.money(g.current) + '</span>' +
        '<span class="muted">Target</span><span class="money" style="text-align:right">' + U.money(g.target) + '</span>' +
        '<span class="muted">Sisa</span><span class="money" style="text-align:right">' + U.money(g.remaining) + '</span>' +
        (g.requiredMonthly ? '<span class="muted">Setoran / bulan</span><span class="money" style="text-align:right;font-weight:700">' + U.money(g.requiredMonthly) + '</span>' : '') + '</div>' +
        (g.overdue ? '<div class="insight warn" style="margin-top:8px"><span class="i">⏰</span><span>Tanggal target terlewati. Perbarui tanggal atau tambah dana.</span></div>' : '') +
        (g.achieved ? '' : '<div class="row" style="margin-top:12px"><button class="btn sm primary" data-dep="' + U.esc(g.id) + '">+ Tambah dana</button><button class="btn sm" data-edit="' + U.esc(g.id) + '">Edit</button></div>') + '</div>';
    });
    html += '<div class="card flat small"><b>Rumus.</b> Sisa = Target − Terkumpul. Setoran per bulan = Sisa ÷ Bulan tersisa hingga tanggal target.</div>';
    el.innerHTML = html;

    if (el._bound) return;
    el._bound = true;
    U.on(el, 'click', '[data-act="add"]', function () { F.goal(); });
    U.on(el, 'click', '[data-dep]', function (e, b) { e.stopPropagation(); var g = S.get('Goals', b.getAttribute('data-dep')); if (g) F.goalDeposit(g); });
    U.on(el, 'click', '[data-edit]', function (e, b) { e.stopPropagation(); var g = S.get('Goals', b.getAttribute('data-edit')); if (g) F.goal(g); });
    U.on(el, 'click', '[data-goal]', function (e, c) { if (e.target.closest('button')) return; var g = S.get('Goals', c.getAttribute('data-goal')); if (g) F.goal(g); });
  }
  return { render: render };
})();

;
/* ==== js/views/retirement.js ==== */
/* Resilia — views/retirement.js : Retirement Planner + Financial Independence (live what-if, all in today's money) */
R.Views.retirement = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App;
  var INPUTS = [
    ['CurrentAge', 'Usia saat ini', 'int'], ['RetirementAge', 'Target usia pensiun', 'int'],
    ['CurrentInvestment', 'Investasi saat ini', 'money'], ['MonthlyInvestment', 'Investasi / bulan', 'money'],
    ['ExpectedInvestmentReturn', 'Return / tahun (%)', 'pct'], ['InflationRate', 'Inflasi / tahun (%)', 'pct'],
    ['DesiredRetirementMonthlyExpense', 'Pengeluaran pensiun / bulan', 'money'], ['WithdrawalRate', 'Withdrawal rate (%)', 'pct']
  ];
  var temp = null;

  function render(el) {
    var s = A.summary(), p = A.profileValues();
    temp = Object.assign({}, p);
    var html = '<div class="card"><h3>Asumsi <span class="more muted xs">ubah angka → hasil langsung dihitung</span></h3><div class="grid2">' + INPUTS.map(function (f) {
      var v = p[f[0]], ph = '';
      if (f[0] === 'CurrentInvestment') ph = 'Auto ' + U.moneyShort(s.balance.investableAuto);
      if (f[0] === 'DesiredRetirementMonthlyExpense') { ph = 'Auto ' + U.moneyShort(s.trailing.avgExpense); if (!v) v = ''; }
      var val = f[2] === 'money' ? (v === '' ? '' : U.moneyInputValue(v)) : (f[0] === 'CurrentAge' && !v ? '' : v);
      return '<div class="field"><label for="rt-' + f[0] + '">' + f[1] + '</label><input id="rt-' + f[0] + '" data-k="' + f[0] + '" data-t="' + f[2] + '" type="' + (f[2] === 'money' ? 'text' : 'number') + '" inputmode="decimal" step="any" value="' + U.esc(val) + '" placeholder="' + U.esc(ph) + '"></div>';
    }).join('') + '</div><div class="row"><button class="btn primary" data-act="save">Simpan asumsi</button><span class="small muted" id="rt-dirty"></span></div></div>' +
      '<div id="rt-out"></div>';
    el.innerHTML = html;
    results(el);

    if (el._bound) return;
    el._bound = true;
    el.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-k'); if (!k) return;
      var t = e.target.getAttribute('data-t'), raw = e.target.value;
      if (t === 'money') {
        temp[k] = raw.trim() === '' ? (k === 'CurrentInvestment' ? '' : 0) : U.parseMoney(raw);
        if (raw.trim() !== '' && !/[,.]$/.test(raw)) e.target.value = U.moneyInputValue(temp[k]);
      } else temp[k] = raw === '' ? 0 : Number(raw);
      U.$('#rt-dirty', el).textContent = 'Belum disimpan';
      results(el);
    });
    U.on(el, 'click', '[data-act="save"]', function () {
      if (temp.CurrentAge > 0 && temp.RetirementAge <= temp.CurrentAge) return UI.alert('Periksa usia', 'Target usia pensiun harus lebih besar dari usia saat ini.', 'warning');
      if (!(temp.WithdrawalRate >= 0.5 && temp.WithdrawalRate <= 20)) return UI.alert('Periksa withdrawal rate', 'Withdrawal rate harus antara 0,5% dan 20%.', 'warning');
      var patch = {};
      INPUTS.forEach(function (f) { patch[f[0]] = temp[f[0]]; });
      A.saveProfile(patch).then(function () { UI.toast('Asumsi tersimpan'); });
    });
  }

  function results(el) {
    var s = A.summary(), p = Object.assign({}, FinCalc.DEFAULT_PROFILE, temp);
    var inv = p.CurrentInvestment === '' || p.CurrentInvestment === null ? s.balance.investableAuto : Number(p.CurrentInvestment);
    var r = FinCalc.retirement(p, inv, s.trailing.avgExpense);
    var fi = FinCalc.financialIndependence(p, inv, s.trailing, s.trailing.avgNet);
    var html = '<div class="section-h">Pensiun</div>';
    if (!r.valid) html += '<div class="card">' + UI.empty('🌅', U.esc(r.reason)) + '</div>';
    else {
      html += '<div class="card hero"><div class="row between"><div class="label">Retirement progress</div><b class="mid">' + U.pct(r.progressNow * 100, 0) + '</b></div>' +
        '<div style="margin:8px 0 10px">' + UI.bar(r.progressNow, '', true) + '</div>' +
        '<div class="small muted">Dana saat ini dibanding kebutuhan pensiun. Proyeksi pada usia ' + r.targetAge + ' mencakup <b style="color:#fff">' + U.pct(r.projectedCoverage * 100, 0) + '</b> kebutuhan.</div>' +
        '<div class="grid k2" style="margin-top:14px"><div><div class="label">Estimasi usia pensiun</div><div class="mid">' + (r.estimatedAge === null ? '> 100' : U.number(r.estimatedAge, 1)) + '</div></div>' +
        '<div><div class="label">Target usia pensiun</div><div class="mid">' + r.targetAge + '</div></div></div></div>';
      html += '<div class="card"><div class="kv">' +
        '<span>Proyeksi dana pensiun</span><span class="money">' + U.money(r.projected) + '</span>' +
        '<span>Dana pensiun dibutuhkan</span><span class="money">' + U.money(r.required) + '</span>' +
        '<span>Dana pensiun saat ini</span><span class="money">' + U.money(r.current) + '</span>' +
        '<span>Gap</span><span class="money ' + (r.gap > 0 ? 'bad' : 'good') + '">' + (r.gap > 0 ? U.money(r.gap) : 'Tidak ada ✓') + '</span>' +
        '<span>Proyeksi penghasilan pensiun / bulan</span><span class="money">' + U.money(r.projectedMonthlyIncome) + '</span>' +
        '<span>Kebutuhan pensiun / bulan</span><span class="money">' + U.money(r.retirementMonthlyExpense) + '</span>' +
        (r.neededMonthly !== null ? '<span><b>Investasi / bulan agar tepat target</b></span><span class="money"><b>' + U.money(r.neededMonthly) + '</b></span>' : '') +
        '</div><div class="small muted" style="margin-top:10px">Nilai di atas dalam <b>uang hari ini</b> (return riil ≈ ' + U.pct(r.realAnnualRate) + '/th setelah inflasi). Dalam nilai nominal saat usia ' + r.targetAge + ': kebutuhan ≈ ' + U.moneyShort(r.requiredNominal) + ', proyeksi ≈ ' + U.moneyShort(r.projectedNominal) + '.</div></div>';
    }

    html += '<div class="section-h">Financial Independence</div>';
    if (!fi.hasData) html += '<div class="card">' + UI.empty('🧭', 'Catat pengeluaran atau isi pengeluaran esensial & gaya hidup di Asumsi untuk menghitung target FI.') + '</div>';
    else {
      html += '<div class="card hero"><div class="label">Financial Independence Target</div><div class="big money" style="margin:4px 0">' + U.money(fi.target) + '</div>' +
        '<div class="small muted">= pengeluaran tahunan ' + U.money(fi.annualExpense) + ' ÷ withdrawal rate ' + U.pct(fi.withdrawalRate) + '</div>' +
        '<div style="margin-top:14px">' + UI.bar(Math.min(1, fi.progress), '', true) + '</div>' +
        '<div class="row between small" style="margin-top:6px"><span class="muted">Aset investable ' + U.money(fi.investable) + '</span><b>' + U.pct(fi.progress * 100) + '</b></div></div>' +
        '<div class="card"><div class="kv">' +
        '<span>Pengeluaran tahunan</span><span class="money">' + U.money(fi.annualExpense) + '</span>' +
        '<span>Penghasilan pasif saat ini (est.)</span><span class="money">' + U.money(fi.passiveMonthly) + '/bln</span>' +
        '<span>Kontribusi / bulan</span><span class="money">' + U.money(fi.contribution) + '</span>' +
        '<span>Estimasi waktu menuju FI</span><span>' + (fi.achieved ? 'Tercapai 🎉' : fi.yearsToFI === null ? '> 50 tahun' : U.number(fi.yearsToFI, 1) + ' tahun' + (fi.fiAge ? ' (usia ' + U.number(fi.fiAge, 0) + ')' : '')) + '</span>' +
        '</div><div class="small muted" style="margin-top:8px">Basis pengeluaran: ' + U.esc(fi.basis) + '. Kontribusi: ' + U.esc(fi.contributionBasis) + '.</div></div>';
      html += '<div class="card"><h3>Sensitivitas withdrawal rate</h3><div class="table-wrap"><table class="tbl" style="min-width:0"><thead><tr><th>Withdrawal rate</th><th>Target FI</th><th>Progres</th></tr></thead><tbody>' +
        [3, 3.5, 4, 5].map(function (w) { var t = fi.annualExpense / (w / 100); return '<tr' + (w === Number(p.WithdrawalRate) ? ' style="font-weight:700"' : '') + '><td>' + U.pct(w) + '</td><td>' + U.moneyShort(t) + '</td><td>' + U.pct(fi.investable / t * 100) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="small muted" style="margin-top:6px">Tidak ada satu angka yang pasti benar — withdrawal rate lebih rendah = target lebih besar tetapi lebih konservatif.</div></div>';
    }
    html += UI.disclaimer('Seluruh angka adalah estimasi berdasarkan asumsi return, inflasi, dan withdrawal rate yang Anda masukkan — bukan jaminan hasil. Return investasi tidak pasti dan bisa negatif. Ini bukan nasihat investasi; pertimbangkan berkonsultasi dengan perencana keuangan berlisensi.');
    U.$('#rt-out', el).innerHTML = html;
  }
  return { render: render };
})();

;
/* ==== js/views/resilience.js ==== */
/* Resilia — views/resilience.js : transparent Financial Resilience Score, Health Score breakdown, level ladder, insights */
R.Views.resilience = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App;

  function breakdown(sc) {
    return sc.components.map(function (c) {
      var col = c.insufficient ? '' : c.pct >= 0.75 ? 'green' : c.pct >= 0.5 ? 'yellow' : c.pct >= 0.25 ? 'orange' : 'red';
      return '<div class="comp-row"><span><b>' + U.esc(c.label) + '</b> <span class="muted small">· ' + U.esc(c.valueText) + (c.insufficient ? ' · data belum cukup' : '') + '</span></span>' +
        '<b class="num">' + U.number(c.points, 1) + ' / ' + c.max + '</b>' + UI.bar(c.pct, col) + '</div>';
    }).join('');
  }

  function render(el) {
    var s = A.summary(), r = s.resilience, h = s.health, lv = s.level;
    var html = '';
    if (!s.hasData) html += '<div class="card">' + UI.empty('📊', 'Skor muncul setelah ada data pemasukan & pengeluaran. Mulai catat transaksi.', '<button class="btn primary" data-act="add">Catat transaksi</button>') + '</div>';
    html += '<div class="card hero"><div class="score-wrap">' + UI.ring(s.hasData ? r.score : 0, 100, '#E0B35A') +
      '<div class="grow"><div class="label">Financial Resilience Score</div><div class="mid">' + (s.hasData ? r.label : 'Belum cukup data') + '</div>' +
      '<div class="small muted" style="margin-top:4px">Mengukur seberapa tahan keuangan Anda terhadap guncangan. Ini indikator, bukan ramalan.</div></div></div></div>';

    html += '<div class="grid d2"><div class="card"><h3>Rincian ketahanan</h3>' + breakdown(r) + '</div>';
    html += '<div class="card"><h3>Financial Health Score · ' + (s.hasData ? h.score : '–') + '/100</h3>' + breakdown(h) + '</div></div>';

    html += '<div class="section-h">Level finansial</div><div class="card">';
    lv.all.forEach(function (L) {
      var reached = L.level <= lv.level, req = lv.requirements[L.level] || [];
      html += '<div class="row" style="align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)"><span class="chip ' + (L.level === lv.level ? 'brand' : reached ? 'green' : '') + '" style="min-width:34px;justify-content:center">' + L.level + '</span>' +
        '<div class="grow"><b>' + U.esc(L.name) + '</b>' + (L.level === lv.level ? ' <span class="chip brand">Anda di sini</span>' : '') + '<div class="small muted">' + U.esc(L.desc) + '</div>' +
        (req.length ? '<ul class="bullets small">' + req.map(function (q) { return '<li>' + (lv.criteria[q[0]] ? '<span class="good">✓</span>' : '<span class="muted">○</span>') + U.esc(q[1]) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>';
    });
    html += '<div class="small muted" style="margin-top:8px">Level naik bila semua syarat level tersebut dan level di bawahnya terpenuhi.</div></div>';

    html += '<div class="section-h">Insight</div><div class="card">' + (s.insights.length ? s.insights.map(function (i) { return '<div class="insight ' + i.type + '"><span class="i">' + i.icon + '</span><span>' + U.esc(i.text) + '</span></div>'; }).join('') : '<div class="muted small">Insight muncul otomatis bila datanya cukup.</div>') + '</div>';
    html += '<div class="card flat small"><b>Bobot ketahanan:</b> Dana darurat 20 · Cash flow 15 · Utang 15 · Savings rate 10 · Net worth 15 · Diversifikasi pemasukan 10 · Pertumbuhan aset 10 · Tujuan finansial 5. Komponen dengan data belum cukup diberi nilai netral 50%.</div>';
    el.innerHTML = html;
    if (!el._bound) { el._bound = true; U.on(el, 'click', '[data-act="add"]', function () { R.Forms.transaction(); }); }
  }
  return { render: render };
})();

;
/* ==== js/views/plan.js ==== */
/* Resilia — views/plan.js : "What should I do next?" prioritised by risk → debt → emergency fund → cash flow → savings → investing → retirement */
R.Views.plan = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App;

  function render(el) {
    var s = A.summary(), acts = s.actions;
    var html = '<div class="card flat small" style="margin-top:4px">Urutan prioritas: <b>Risiko</b> → Utang mahal → Dana darurat → Cash flow → Tabungan → Investasi → Pensiun. Rekomendasi dihitung dari data Anda dan diperbarui otomatis.</div>';
    if (!acts.length) html += '<div class="card">' + UI.empty('🏆', 'Tidak ada tindakan mendesak. Pertahankan kebiasaan baik dan tinjau ulang setiap bulan.') + '</div>';
    acts.forEach(function (a) {
      html += '<div class="card priority' + (a.priority === 1 ? ' p1' : '') + '"><div class="pn">Prioritas #' + a.priority + '</div>' +
        '<div class="mid" style="margin:4px 0 2px">' + U.esc(a.title) + '</div><div class="small muted">' + U.esc(a.why) + '</div>' +
        '<div class="grid k2" style="margin-top:12px"><div class="kpi" style="box-shadow:none;background:var(--surface-2)"><div class="label">Saat ini</div><div style="font-weight:700">' + U.esc(a.current) + '</div></div>' +
        '<div class="kpi" style="box-shadow:none;background:var(--surface-2)"><div class="label">Target</div><div style="font-weight:700">' + U.esc(a.target) + '</div></div></div>' +
        '<div class="insight goal" style="margin-top:10px"><span class="i">👉</span><span><b>Tindakan:</b> ' + U.esc(a.action) + '</span></div>' +
        (a.disclaimer ? '<div class="xs muted" style="margin-top:6px">Estimasi; bukan nasihat investasi personal.</div>' : '') +
        '<div class="row" style="margin-top:10px"><a class="btn sm" href="javascript:void(0)" data-nav="' + a.section + '">Buka ' + U.esc(sectionName(a.section)) + ' ›</a></div></div>';
    });
    el.innerHTML = html;
  }
  function sectionName(id) { var e = document.getElementById('sec-' + id); return e ? e.getAttribute('data-title') : id; }
  return { render: render };
})();

;
/* ==== js/views/reports.js ==== */
/* Resilia — views/reports.js : monthly & yearly reports, CSV export, print-to-PDF */
R.Views.reports = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store, D = FinCalc.date;
  var tab = 'month', month = null, year = null;

  function render(el) {
    month = month || U.monthKey(); year = year || +U.today().slice(0, 4);
    var html = '<div class="seg full no-print" style="--n:2;margin-top:4px"><button data-tab="month" class="' + (tab === 'month' ? 'on' : '') + '">Bulanan</button><button data-tab="year" class="' + (tab === 'year' ? 'on' : '') + '">Tahunan</button></div>';
    html += tab === 'month' ? monthly() : yearly();
    el.innerHTML = html;
    if (el._bound) return;
    el._bound = true;
    U.on(el, 'click', '[data-tab]', function (e, b) { tab = b.getAttribute('data-tab'); render(el); });
    U.on(el, 'click', '[data-m]', function (e, b) { month = D.addMonths(month, +b.getAttribute('data-m')); render(el); });
    U.on(el, 'click', '[data-y]', function (e, b) { year += +b.getAttribute('data-y'); render(el); });
    U.on(el, 'click', '[data-act="csv-m"]', exportMonthCSV);
    U.on(el, 'click', '[data-act="csv-y"]', exportYearCSV);
    U.on(el, 'click', '[data-act="print"]', function () { A.audit('EXPORT', 'PDF/print laporan ' + (tab === 'month' ? month : year)); window.print(); });
  }

  function monthly() {
    var r = FinCalc.monthlyReport(S.calcData(), month, U.today(), A.summary());
    var h = '<div class="card"><div class="month-nav no-print"><button class="icon-btn" data-m="-1" aria-label="Sebelumnya">' + U.icon('left') + '</button><strong>' + U.fmtMonth(month) + '</strong><button class="icon-btn" data-m="1" aria-label="Berikutnya">' + U.icon('right') + '</button></div>' +
      '<h3 class="print-only">Laporan Bulanan · ' + U.fmtMonth(month) + '</h3>' +
      '<div class="kv" style="margin-top:10px">' +
      '<span>Pemasukan</span><span class="money income">' + U.money(r.income) + '</span>' +
      '<span>Pengeluaran</span><span class="money expense">' + U.money(r.expense) + '</span>' +
      '<span>Tabungan (net)</span><span class="money">' + U.money(r.savings, { sign: true }) + '</span>' +
      '<span>Savings rate</span><span>' + U.pct(r.savingsRate) + '</span>' +
      '<span>Net worth</span><span class="money">' + (r.netWorth === null ? '–' : U.money(r.netWorth)) + '</span>' +
      '<span>Utang</span><span class="money">' + (r.debt === null ? '–' : U.money(r.debt)) + '</span>' +
      '<span>Dana darurat</span><span>' + (r.emergencyFundMonths === null ? '–' : U.number(r.emergencyFundMonths, 1) + ' bulan') + '</span></div>' +
      (r.netWorth === null && month !== U.monthKey() ? '<div class="xs muted" style="margin-top:6px">Net worth/utang/dana darurat diambil dari snapshot bulanan; tidak ada snapshot untuk bulan ini.</div>' : '') + '</div>';
    h += '<div class="card"><h3>Pengeluaran per kategori</h3>' + (r.expenseByCategory.length ? '<div class="table-wrap"><table class="tbl" style="min-width:0"><thead><tr><th>Kategori</th><th>Jumlah</th><th>%</th></tr></thead><tbody>' +
      r.expenseByCategory.map(function (c) { return '<tr><td>' + U.esc(c.name) + '</td><td>' + U.money(c.amount) + '</td><td>' + U.pct(c.share, 0) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="muted small">Tidak ada pengeluaran.</div>') + '</div>';
    if (r.incomeByCategory.length) h += '<div class="card"><h3>Pemasukan per sumber</h3><div class="kv">' + r.incomeByCategory.map(function (c) { return '<span>' + U.esc(c.name) + '</span><span class="money">' + U.money(c.amount) + '</span>'; }).join('') + '</div></div>';
    h += '<div class="row wrap no-print" style="margin-top:12px"><button class="btn primary" data-act="csv-m">Ekspor CSV transaksi</button><button class="btn" data-act="print">Cetak / Simpan PDF</button></div>';
    return h;
  }

  function yearly() {
    var r = FinCalc.yearlyReport(S.calcData(), year, U.today(), A.summary());
    var h = '<div class="card"><div class="month-nav no-print"><button class="icon-btn" data-y="-1" aria-label="Sebelumnya">' + U.icon('left') + '</button><strong>' + year + '</strong><button class="icon-btn" data-y="1" aria-label="Berikutnya">' + U.icon('right') + '</button></div>' +
      '<h3 class="print-only">Laporan Tahunan · ' + year + '</h3>' +
      '<div class="kv" style="margin-top:10px">' +
      '<span>Pemasukan tahunan</span><span class="money income">' + U.money(r.income) + '</span>' +
      '<span>Pengeluaran tahunan</span><span class="money expense">' + U.money(r.expense) + '</span>' +
      '<span>Tabungan tahunan</span><span class="money">' + U.money(r.savings, { sign: true }) + '</span>' +
      '<span>Savings rate</span><span>' + U.pct(r.savingsRate) + '</span>' +
      '<span>Pertumbuhan net worth</span><span class="money">' + (r.netWorthGrowth === null ? '–' : U.money(r.netWorthGrowth, { sign: true }) + (r.netWorthGrowthPct !== null ? ' (' + U.pct(r.netWorthGrowthPct) + ')' : '')) + '</span></div></div>';
    h += '<div class="card"><h3>Per bulan</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Net</th><th>SR</th></tr></thead><tbody>' +
      r.months.map(function (m) { return '<tr><td>' + U.fmtMonth(m.month, true) + '</td><td>' + U.moneyShort(m.income) + '</td><td>' + U.moneyShort(m.expense) + '</td><td class="' + (m.net >= 0 ? 'income' : 'expense') + '">' + U.moneyShort(m.net) + '</td><td>' + U.pct(m.savingsRate, 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
    h += '<div class="card"><h3>Progres tujuan</h3>' + (r.goals.length ? r.goals.map(function (g) { return '<div style="padding:6px 0"><div class="row between small"><b>' + U.esc(g.name) + '</b><span>' + U.pct(g.progress * 100, 0) + '</span></div>' + UI.bar(g.progress, g.achieved ? 'green' : 'gold') + '</div>'; }).join('') : '<div class="muted small">Belum ada tujuan.</div>') + '</div>';
    h += '<div class="row wrap no-print" style="margin-top:12px"><button class="btn primary" data-act="csv-y">Ekspor CSV ringkasan</button><button class="btn" data-act="print">Cetak / Simpan PDF</button></div>';
    return h;
  }

  function exportMonthCSV() {
    var rows = [['TransactionID', 'Date', 'Type', 'Category', 'Account', 'ToAccount', 'Amount', 'Description', 'Notes']];
    S.all('Transactions').filter(function (t) { return t.Date.slice(0, 7) === month; }).sort(function (a, b) { return a.Date.localeCompare(b.Date); })
      .forEach(function (t) { rows.push([t.TransactionID, t.Date, t.Type, A.catLabel(t.CategoryID), A.accountName(t.AccountID), t.ToAccountID ? A.accountName(t.ToAccountID) : '', t.Amount, t.Description, t.Notes]); });
    U.download('resilia-transaksi-' + month + '.csv', U.toCSV(rows), 'text/csv;charset=utf-8');
    A.audit('EXPORT', 'CSV transaksi ' + month);
    UI.toast((rows.length - 1) + ' transaksi diekspor');
  }
  function exportYearCSV() {
    var r = FinCalc.yearlyReport(S.calcData(), year, U.today(), A.summary());
    var rows = [['Month', 'Income', 'Expense', 'Net', 'SavingsRate']];
    r.months.forEach(function (m) { rows.push([m.month, m.income, m.expense, m.net, m.savingsRate === null ? '' : Math.round(m.savingsRate * 100) / 100]); });
    rows.push(['TOTAL', r.income, r.expense, r.savings, r.savingsRate === null ? '' : Math.round(r.savingsRate * 100) / 100]);
    U.download('resilia-ringkasan-' + year + '.csv', U.toCSV(rows), 'text/csv;charset=utf-8');
    A.audit('EXPORT', 'CSV ringkasan ' + year);
  }
  return { render: render };
})();

;
/* ==== js/views/settings.js ==== */
/* Resilia — views/settings.js : profile, categories, accounts, assumptions, security, data management */
R.Views.settings = (function () {
  'use strict';
  var U = R.U, UI = R.UI, A = R.App, S = R.Store, F = R.Forms;
  var CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'AUD', 'GBP'];

  function row(act, ico, title, sub, right) {
    return '<li class="item" data-act="' + act + '"><span class="ico">' + ico + '</span><div class="grow"><div class="t">' + title + '</div>' + (sub ? '<div class="st">' + sub + '</div>' : '') + '</div>' + (right === undefined ? U.icon('right', 'muted') : right) + '</li>';
  }

  function render(el) {
    var u = A.user() || {}, set = R.Auth.settings(), p = A.profileValues(), theme = U.LS.get('theme', 'auto');
    var cats = A.categories(null, true), lastSync = S.getMeta('lastSyncAt', 0), mode = R.Api.mode();
    var html = '';
    html += '<div class="section-h">Profil</div><div class="card" style="padding-top:4px;padding-bottom:4px"><ul class="list">' +
      row('profile', '👤', U.esc(u.Name || 'Nama belum diisi'), U.esc(u.Email || '') + ' · Mata uang ' + U.esc(u.Currency || 'IDR')) + '</ul></div>';

    html += '<div class="section-h">Keuangan</div><div class="card" style="padding-top:4px;padding-bottom:4px"><ul class="list">' +
      row('assumptions', '🧮', 'Asumsi keuangan', 'Usia ' + (p.CurrentAge || '–') + ' · pensiun ' + p.RetirementAge + ' · return ' + U.pct(p.ExpectedInvestmentReturn) + ' · inflasi ' + U.pct(p.InflationRate) + ' · WR ' + U.pct(p.WithdrawalRate)) +
      row('nav:assets', '🏦', 'Akun', A.accounts(true).length + ' akun') +
      row('nav:budget', '🎯', 'Pengaturan budget', 'Batas pengeluaran per kategori') +
      '</ul></div>';

    html += '<div class="section-h">Kategori <a class="more" href="javascript:void(0)" data-act="add-cat">+ Kategori</a></div><div class="card" style="padding-top:4px;padding-bottom:4px"><ul class="list">' +
      cats.map(function (c) {
        return '<li class="item" data-cat="' + U.esc(c.CategoryID) + '"' + (c.Active === false ? ' style="opacity:.5"' : '') + '><span class="ico" style="background:' + (c.Color ? c.Color + '1F' : '') + '">' + U.esc(c.Icon || '•') + '</span><div class="grow"><div class="t">' + U.esc(c.Name) + '</div><div class="st">' +
          (c.Type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran') + (c.Essential === true || c.Essential === 'TRUE' ? ' · esensial' : '') + (c.Active === false ? ' · non-aktif' : '') + '</div></div></li>';
      }).join('') + '</ul></div>';

    html += '<div class="section-h">Keamanan</div><div class="card"><ul class="list">' +
      row('lock', '🔒', 'Kunci aplikasi sekarang', '') +
      '<li class="item" style="display:block;cursor:default"><div class="t" style="margin-bottom:8px">⏱ Kunci otomatis</div><div class="seg">' +
      [[0, 'Mati'], [1, '1 mnt'], [5, '5 mnt'], [15, '15 mnt'], [30, '30 mnt'], [60, '60 mnt']].map(function (o) { return '<button data-lock="' + o[0] + '" class="' + (set.autoLockMin === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></li>' +
      '<li class="item" style="cursor:default"><label class="toggle grow"><span><b style="font-weight:600">Buka kunci saat offline</b><br><span class="st">Memakai verifikasi lokal (PBKDF2) dari login online terakhir. Matikan untuk selalu wajib online.</span></span><input type="checkbox" id="set-offline"' + (set.offlineUnlock ? ' checked' : '') + '><span class="sw"></span></label></li>' +
      row('pin-info', '🔑', 'Ganti PIN', 'PIN disimpan di server (Script Properties)') +
      row('logout', '🚪', '<span class="bad">Logout</span>', 'Hapus sesi & data dari perangkat ini', '') + '</ul></div>';

    html += '<div class="section-h">Tampilan</div><div class="card"><div class="seg full" style="--n:3">' + [['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']].map(function (t) { return '<button data-theme="' + t[0] + '" class="' + (theme === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div></div>';

    html += '<div class="section-h">Data</div><div class="card" style="padding-top:4px;padding-bottom:4px"><ul class="list">' +
      row('sync', '🔄', 'Sinkronkan sekarang', 'Terakhir: ' + U.relTime(lastSync) + ' · ' + S.pendingCount() + ' perubahan menunggu') +
      row('full-sync', '⤵️', 'Sinkron ulang penuh', 'Unduh ulang semua data dari server') +
      row('export-json', '💾', 'Ekspor data (cadangan JSON)', 'Semua data di perangkat ini') +
      row('export-csv', '📄', 'Ekspor semua transaksi (CSV)', '') +
      row('import', '📥', 'Impor data (JSON)', 'Dari file cadangan Resilia') +
      row('reset', '🗑', '<span class="bad">Reset data lokal</span>', 'Hapus cache perangkat; data di server tidak terhapus', '') +
      '</ul><input type="file" id="set-import" accept="application/json,.json" hidden></div>';

    html += '<div class="section-h">Aplikasi</div><div class="card"><div class="kv small">' +
      '<span>Versi</span><span>Resilia 1.0.0</span>' +
      '<span>Mode</span><span>' + (mode === 'gas' ? 'Apps Script Web App' : 'PWA') + '</span>' +
      '<span>Penyimpanan lokal</span><span>' + S.backendKind() + '</span>' +
      '<span>Status</span><span>' + R.Sync.status() + '</span>' +
      (mode === 'pwa' ? '<span>Server</span><span class="ellipsis" style="max-width:180px" title="' + U.esc(R.Api.apiUrl()) + '">' + U.esc(R.Api.apiUrl().replace(/^https:\/\//, '').slice(0, 32)) + '…</span>' : '') + '</div>' +
      '<div class="row wrap" style="margin-top:12px">' + (mode === 'pwa' ? '<button class="btn sm" data-act="server">Ganti server</button>' : '') + (R.Main && R.Main.canInstall() ? '<button class="btn sm primary" data-act="install">Pasang aplikasi</button>' : '') + '</div>' +
      (mode === 'gas' ? '<div class="small muted" style="margin-top:10px">Mode Apps Script menyimpan data offline, tetapi aplikasi hanya bisa dibuka saat online. Untuk instalasi & buka tanpa internet, gunakan versi PWA (lihat README).</div>' : '') + '</div>';
    el.innerHTML = html;
    if (el._bound) return;
    el._bound = true;
    U.on(el, 'click', '[data-act]', function (e, b) { action(b.getAttribute('data-act'), el); });
    U.on(el, 'click', '[data-cat]', function (e, b) { var c = R.Store.all('Categories').filter(function (x) { return x.CategoryID === b.getAttribute('data-cat'); })[0]; if (c) F.category(c); });
    U.on(el, 'click', '[data-lock]', function (e, b) { R.Auth.setSetting('autoLockMin', +b.getAttribute('data-lock')); R.Auth.touch(true); R.Router.render('settings', true); UI.toast('Kunci otomatis diperbarui'); });
    U.on(el, 'click', '[data-theme]', function (e, b) { var t = b.getAttribute('data-theme'); U.LS.set('theme', t); R.Main.applyTheme(); R.Router.render('settings', true); });
    el.addEventListener('change', function (e) {
      if (e.target.id === 'set-offline') { R.Auth.setSetting('offlineUnlock', e.target.checked); UI.toast(e.target.checked ? 'Aktif setelah login online berikutnya' : 'Buka kunci offline dimatikan', 'info'); }
      if (e.target.id === 'set-import' && e.target.files[0]) importFile(e.target.files[0], e.target);
    });
  }

  function action(a, el) {
    if (a.indexOf('nav:') === 0) return R.Router.go(a.slice(4));
    switch (a) {
      case 'profile': return UI.form({
        title: 'Profil', values: Object.assign({ Currency: 'IDR' }, A.user() || {}),
        fields: [{ name: 'Name', label: 'Nama', maxlength: 80 }, { name: 'Email', type: 'email', label: 'Email', maxlength: 120 },
          { name: 'Currency', type: 'select', label: 'Mata uang', options: CURRENCIES.map(function (c) { return { value: c, label: c }; }), hint: 'Hanya mengubah format tampilan; nilai tidak dikonversi.' }],
        onSubmit: function (x) { return A.saveUser({ Name: (x.Name || '').trim(), Email: (x.Email || '').trim(), Currency: x.Currency }).then(function () { U.setCurrency(x.Currency); R.Router.invalidate(); UI.toast('Profil tersimpan'); }); }
      });
      case 'assumptions': return F.profile();
      case 'add-cat': return F.category();
      case 'lock': return R.Auth.lock('manual');
      case 'pin-info': return UI.alert('Ganti PIN', 'Demi keamanan, PIN tidak bisa diubah dari aplikasi.<br><br>Buka <b>Apps Script → Project Settings → Script Properties</b>, ubah nilai <code>APP_PIN</code> (4–12 digit, disarankan 6+). Semua sesi otomatis dicabut setelah PIN diganti.', 'info');
      case 'logout': return logout();
      case 'sync': return syncNow(false);
      case 'full-sync': return syncNow(true);
      case 'export-json':
        U.download('resilia-backup-' + U.today() + '.json', JSON.stringify(S.exportAll(), null, 1), 'application/json');
        A.audit('EXPORT', 'Backup JSON'); return UI.toast('Cadangan diunduh');
      case 'export-csv': {
        var rows = [['TransactionID', 'Date', 'Type', 'Category', 'Account', 'ToAccount', 'Amount', 'Description', 'Notes']];
        S.all('Transactions').sort(function (x, y) { return x.Date.localeCompare(y.Date); }).forEach(function (t) { rows.push([t.TransactionID, t.Date, t.Type, A.catLabel(t.CategoryID), A.accountName(t.AccountID), t.ToAccountID ? A.accountName(t.ToAccountID) : '', t.Amount, t.Description, t.Notes]); });
        U.download('resilia-semua-transaksi-' + U.today() + '.csv', U.toCSV(rows), 'text/csv;charset=utf-8');
        A.audit('EXPORT', 'CSV semua transaksi'); return UI.toast((rows.length - 1) + ' transaksi diekspor');
      }
      case 'import': return U.$('#set-import', el).click();
      case 'reset': return resetLocal();
      case 'server': return R.Main.showSetup(true);
      case 'install': return R.Main.install();
    }
  }

  function syncNow(full) {
    if (!navigator.onLine) return UI.toast('Anda sedang offline', 'warning');
    UI.loading(full ? 'Mengunduh ulang data…' : 'Menyinkronkan…');
    R.Sync.run({ full: full }).then(function (r) {
      UI.closeLoading();
      if (r.ok) UI.toast('Sinkron selesai'); else UI.alert('Sinkron gagal', U.esc(r.message || r.error || ''), 'error');
      R.Router.render('settings', true);
    });
  }

  function importFile(file, input) {
    var reader = new FileReader();
    reader.onload = function () {
      input.value = '';
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { return UI.alert('File tidak valid', 'Bukan file JSON.', 'error'); }
      if (!data || data.app !== 'Resilia' || !data.tables) return UI.alert('File tidak valid', 'Bukan file cadangan Resilia.', 'error');
      var items = [];
      Object.keys(data.tables).forEach(function (t) { if (S.KEYS[t]) (data.tables[t] || []).forEach(function (rec) { if (rec && rec[S.KEYS[t]]) items.push({ entity: t, rec: rec }); }); });
      UI.confirm('Impor ' + items.length + ' data?', 'Data dengan ID yang sama akan ditimpa, lalu disinkronkan ke server (dan divalidasi di sana).', { confirmText: 'Impor' }).then(function (ok) {
        if (!ok) return;
        S.saveMany(items).then(function () { A.audit('IMPORT', items.length + ' record'); UI.toast(items.length + ' data diimpor'); });
      });
    };
    reader.readAsText(file);
  }

  function resetLocal() {
    var n = S.pendingCount();
    UI.confirmTyped('Reset data lokal?', 'Semua data di perangkat ini akan dihapus lalu diunduh ulang dari server.' + (n ? '<br><b class="bad">' + n + ' perubahan belum tersinkron akan HILANG.</b>' : ''), 'HAPUS').then(function (ok) {
      if (!ok) return;
      A.audit('RESET_LOCAL', 'Reset data lokal');
      S.wipe().then(function () {
        UI.toast('Data lokal dihapus');
        if (navigator.onLine) R.Main.initialSync(); else R.Router.go('dashboard');
      });
    });
  }

  function logout() {
    var n = S.pendingCount();
    var pre = n && navigator.onLine ? R.Sync.run() : Promise.resolve();
    pre.then(function () {
      n = S.pendingCount();
      return UI.confirm('Logout dari perangkat ini?', 'Sesi dicabut dan data lokal dihapus dari perangkat ini.' + (n ? '<br><b class="bad">' + n + ' perubahan belum tersinkron akan hilang.</b>' : ' Semua data aman di server.'), { danger: true, confirmText: 'Logout' });
    }).then(function (ok) {
      if (!ok) return;
      R.Auth.logout().then(function () { return S.wipe(); }).then(function () { R.Main.afterLogout(); });
    });
  }

  return { render: render };
})();

;
/* ==== js/views/more.js ==== */
/* Resilia — views/more.js : "Lainnya" menu on mobile */
R.Views.more = (function () {
  'use strict';
  var U = R.U, A = R.App;
  var TILES = [
    ['plan', 'compass', 'Rencana Aksi'], ['resilience', 'pulse', 'Ketahanan'], ['cashflow', 'flow', 'Arus Kas'],
    ['budget', 'pie', 'Budget'], ['emergency', 'shield', 'Dana Darurat'], ['debt', 'card', 'Utang'],
    ['retirement', 'sun', 'Pensiun & FI'], ['reports', 'file', 'Laporan'], ['settings', 'gear', 'Pengaturan']
  ];
  function render(el) {
    var s = A.summary();
    el.innerHTML = '<div class="card hero row" style="margin-top:4px"><div class="grow"><div class="label">Level Anda</div><div class="mid">' + s.level.level + ' · ' + U.esc(s.level.name) + '</div></div>' +
      (s.hasData ? '<div style="text-align:right"><div class="label">Ketahanan</div><div class="mid">' + s.resilience.score + '/100</div></div>' : '') + '</div>' +
      '<div class="tiles">' + TILES.map(function (t) {
        return '<a class="tile" href="javascript:void(0)" data-nav="' + t[0] + '"><span class="ti">' + U.icon(t[1]) + '</span>' + t[2] + '</a>';
      }).join('') + '</div>' +
      '<button class="btn block" style="margin-top:16px" data-act="lock">' + U.icon('lock') + ' Kunci aplikasi</button>';
    if (!el._bound) { el._bound = true; U.on(el, 'click', '[data-act="lock"]', function () { R.Auth.lock('manual'); }); }
  }
  return { render: render };
})();

;
/* ==== js/main.js ==== */
/* Resilia — main.js : boot sequence, shell wiring, PWA install & service worker
 *
 *  boot → local store → (PWA without server URL → setup) → (no session → PIN login)
 *       → (idle too long → lock screen) → app (render from local data, sync in background)
 */
R.Main = (function () {
  'use strict';
  var U = R.U, UI = R.UI, S = R.Store;
  var started = false, installPrompt = null;

  function applyTheme() {
    var t = U.LS.get('theme', 'auto'), root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  }

  function boot() {
    applyTheme();
    R.Auth.bindKeypad();
    R.Auth.onUnlocked(onAuthenticated);
    S.init().then(function () {
      R.Router.init();
      R.App.init();
      var u = R.App.user(); if (u && u.Currency) U.setCurrency(u.Currency);
      bindShell();
      R.Sync.onStatus(renderStatus);
      registerServiceWorker();
      gate();
    }).catch(function (e) {
      console.error(e);
      UI.alert('Gagal memulai aplikasi', U.esc(e && e.message || e), 'error');
    });
  }

  function gate() {
    if (R.Api.mode() === 'pwa' && !R.Api.apiUrl()) return showSetup(false);
    if (!R.Auth.token()) return R.Auth.showPin('login');
    if (R.Auth.shouldLock()) return R.Auth.showPin('lock');
    startApp();
  }

  function onAuthenticated() {
    if (!started) startApp();
    else { R.Router.render(R.Router.current() || 'dashboard', true); R.Sync.schedule(200); }
  }

  function startApp() {
    started = true;
    R.Auth.hidePin();
    R.Auth.touch(true);
    R.Auth.startAutoLock();
    R.Sync.start();
    renderBanners();
    R.Router.go('dashboard');
    if (!S.hasData() && navigator.onLine) initialSync();
    else R.Sync.schedule(300);
  }

  /** First run on a device (or after reset): download everything with a blocking loader. */
  function initialSync() {
    UI.loading('Menyiapkan data…', 'Mengunduh data dari Google Sheets');
    return R.Sync.run({ full: true }).then(function (r) {
      UI.closeLoading();
      if (!r.ok && r.error !== 'AUTH') UI.alert('Belum bisa mengunduh data', U.esc(r.message || 'Periksa koneksi.') + '<br>Anda tetap bisa mencatat; data akan disinkronkan nanti.', 'warning');
      R.Router.invalidate();
      R.Router.go(R.Router.current() || 'dashboard');
    });
  }

  function afterLogout() {
    R.Sync.stop();
    started = false;
    R.Router.invalidate();
    R.Auth.showPin('login');
  }

  // ---------------------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------------------
  function bindShell() {
    document.getElementById('fab').addEventListener('click', function () { R.Forms.transaction(); });
    document.getElementById('btn-lock').addEventListener('click', function () { R.Auth.lock('manual'); });
    document.getElementById('btn-refresh').addEventListener('click', refresh);
    document.getElementById('sync-pill').addEventListener('click', function () {
      if (!navigator.onLine) return UI.toast('Offline — ' + S.pendingCount() + ' perubahan menunggu', 'info');
      R.Sync.run().then(function (r) { if (r.ok) UI.toast('Tersinkron'); else if (r.error !== 'AUTH') UI.toast('Sinkron gagal: ' + (r.message || r.error), 'error'); });
    });
    document.getElementById('setup-save').addEventListener('click', saveSetup);
    document.getElementById('setup-url').addEventListener('keydown', function (e) { if (e.key === 'Enter') saveSetup(); });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; });
    window.addEventListener('appinstalled', function () { installPrompt = null; UI.toast('Resilia terpasang'); });
  }

  function refresh() {
    var btn = document.getElementById('btn-refresh');
    btn.classList.add('spin');
    var done = function () { btn.classList.remove('spin'); R.Router.render(R.Router.current(), true); };
    if (!navigator.onLine) { done(); return UI.toast('Offline — menampilkan data lokal', 'info'); }
    R.Sync.run().then(function (r) { done(); if (!r.ok && r.error !== 'AUTH') UI.toast('Sinkron gagal: ' + (r.message || r.error), 'error'); });
  }

  function renderStatus(status, pending) {
    var pill = document.getElementById('sync-pill');
    pill.setAttribute('data-s', status);
    var text = { offline: 'Offline', syncing: 'Syncing', online: 'Online', synced: '✓ Synced', error: 'Sync gagal' }[status] || status;
    if (pending && status !== 'syncing') text += ' · ' + pending;
    pill.querySelector('span').textContent = text;
    pill.title = pending ? pending + ' perubahan belum tersinkron' : 'Semua data tersinkron';
    document.getElementById('offline-bar').classList.toggle('hidden', status !== 'offline');
  }

  function renderBanners() {
    var b = '';
    if (R.Auth.pinIsDefault()) b += '<div class="banner">⚠️<span><b>PIN masih default.</b> Ganti <code>APP_PIN</code> di Apps Script → Project Settings → Script Properties.</span></div>';
    document.getElementById('banners').innerHTML = b;
  }

  // ---------------------------------------------------------------------------
  // Server setup (PWA mode)
  // ---------------------------------------------------------------------------
  function showSetup(changing) {
    document.getElementById('setup-url').value = R.Api.apiUrl();
    document.getElementById('setup-msg').textContent = '';
    document.getElementById('gate-setup').classList.remove('hidden');
    document.getElementById('gate-setup').setAttribute('data-changing', changing ? '1' : '');
  }
  function saveSetup() {
    var url = document.getElementById('setup-url').value.trim(), msg = document.getElementById('setup-msg');
    if (!/^https:\/\/[^\s]+$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) { msg.textContent = 'URL harus https:// dan berakhiran /exec'; return; }
    if (!navigator.onLine) { msg.textContent = 'Perlu koneksi internet untuk menghubungkan.'; return; }
    var changing = document.getElementById('gate-setup').getAttribute('data-changing') === '1';
    var prev = R.Api.apiUrl();
    msg.textContent = 'Menghubungkan…';
    R.Api.setApiUrl(url);
    R.Api.call('system.ping', {}, { noAuth: true, timeout: 20000 }).then(function (res) {
      if (!res.success || !res.data || res.data.app !== 'Resilia') {
        R.Api.setApiUrl(prev);
        msg.textContent = res.message || 'Server tidak dikenali. Pastikan deployment Web App dengan akses "Anyone".';
        return;
      }
      var p = changing && url !== prev && S.hasData()
        ? UI.confirmTyped('Ganti server?', 'Data lokal dari server lama akan dihapus dari perangkat ini.', 'GANTI').then(function (ok) {
          if (!ok) { R.Api.setApiUrl(prev); return false; }
          return R.Auth.logout().then(function () { return S.wipe(); }).then(function () { started = false; return true; });
        })
        : Promise.resolve(true);
      return p.then(function (ok) {
        if (!ok) return;
        document.getElementById('gate-setup').classList.add('hidden');
        if (changing && url === prev) return;
        gate();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // PWA
  // ---------------------------------------------------------------------------
  function registerServiceWorker() {
    if (R.Api.mode() !== 'pwa' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            var el = document.getElementById('banners');
            el.insertAdjacentHTML('beforeend', '<div class="banner" id="upd-banner">✨<span>Versi baru tersedia.</span><button class="btn sm primary" onclick="location.reload()">Muat ulang</button></div>');
          }
        });
      });
    }).catch(function (e) { console.warn('SW registration failed', e); });
  }
  function canInstall() { return !!installPrompt; }
  function install() {
    if (!installPrompt) return UI.alert('Pasang aplikasi', 'Gunakan menu browser → <b>Tambahkan ke layar utama</b> / <b>Install app</b>.', 'info');
    installPrompt.prompt();
    installPrompt.userChoice.then(function () { installPrompt = null; R.Router.render(R.Router.current(), true); });
  }

  return { boot: boot, initialSync: initialSync, afterLogout: afterLogout, showSetup: showSetup, applyTheme: applyTheme, canInstall: canInstall, install: install };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', R.Main.boot);
else R.Main.boot();
