/**
 * Mytime — calc.js
 * Semua rumus analitik (lihat docs/ARCHITECTURE.md bagian 7). Fungsi murni, tanpa DOM,
 * dapat diuji di Node. Semua perhitungan memakai data lokal sehingga tetap bekerja offline.
 */
(function (root, factory) {
  var util = (typeof module === 'object' && module.exports) ? require('./util.js') : root.TI.util;
  var mod = factory(util);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.TI = root.TI || {}; root.TI.calc = mod; }
})(typeof self !== 'undefined' ? self : this, function (U) {
  'use strict';

  var PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  var RATING_SCORE = { FULL: 100, PARTIAL: 60, DISTRACTED: 25 };
  var DEFAULT_WEIGHTS = { goalProgress: 20, consistency: 20, learning: 15, careerBusiness: 15, health: 10, focusQuality: 10, planning: 10 };
  var COMPONENT_LABELS = {
    goalProgress: 'Goal Progress', consistency: 'Consistency', learning: 'Learning & Growth',
    careerBusiness: 'Career & Business', health: 'Health', focusQuality: 'Focus Quality', planning: 'Planning & Task Completion'
  };

  function alive(list) { return (list || []).filter(function (r) { return r && !r.Deleted; }); }

  function categoryMap(categories) {
    var m = {};
    (categories || []).forEach(function (c) { m[c.CategoryID] = c; });
    return m;
  }

  // ------------------------------------------------------------------ waktu tercatat

  /**
   * Proyeksikan time entry ke garis waktu tanpa hitung ganda.
   * Bagian yang tumpang tindih dimiliki entry yang mulai lebih dulu (seri: CreatedAt, lalu ID).
   * Entry dengan jeda punya kepadatan Duration/(End−Start) ≤ 1.
   * @return {Array<{entry, start, end, minutes}>}
   */
  function segmentEntries(entries, fromMs, toMs) {
    var items = [];
    alive(entries).forEach(function (e) {
      var s = Date.parse(e.StartTime), en = Date.parse(e.EndTime);
      if (!isFinite(s) || !isFinite(en) || en <= s) return;
      var span = (en - s) / 60000;
      var dur = e.DurationMinutes === '' || e.DurationMinutes === undefined || e.DurationMinutes === null ? span : Number(e.DurationMinutes);
      var density = span > 0 ? Math.min(1, Math.max(0, dur / span)) : 0;
      var cs = Math.max(s, fromMs), ce = Math.min(en, toMs);
      if (ce <= cs) return;
      items.push({ s: s, cs: cs, ce: ce, density: density, entry: e, key: [s, e.CreatedAt || '', e.TimeEntryID || ''] });
    });
    if (!items.length) return [];

    var events = [];
    items.forEach(function (it) {
      events.push({ t: it.cs, kind: 1, it: it });
      events.push({ t: it.ce, kind: 0, it: it });
    });
    events.sort(function (a, b) { return a.t - b.t || a.kind - b.kind; });

    function before(a, b) {
      if (a.key[0] !== b.key[0]) return a.key[0] < b.key[0];
      if (a.key[1] !== b.key[1]) return a.key[1] < b.key[1];
      return a.key[2] < b.key[2];
    }

    var active = [];
    var out = [];
    var prevT = null;
    var i = 0;
    while (i < events.length) {
      var t = events[i].t;
      if (prevT !== null && t > prevT && active.length) {
        var owner = active[0];
        for (var k = 1; k < active.length; k++) if (before(active[k], owner)) owner = active[k];
        var last = out[out.length - 1];
        if (last && last.it === owner && last.end === prevT) last.end = t;
        else out.push({ it: owner, start: prevT, end: t });
      }
      while (i < events.length && events[i].t === t) {
        var ev = events[i];
        if (ev.kind === 1) active.push(ev.it);
        else active.splice(active.indexOf(ev.it), 1);
        i++;
      }
      prevT = t;
    }
    return out.map(function (seg) {
      return { entry: seg.it.entry, start: seg.start, end: seg.end, minutes: (seg.end - seg.start) / 60000 * seg.it.density };
    });
  }

  /** Pecah segmen per hari lokal. @return {date: [{entry, minutes}]} */
  function splitByDay(segments) {
    var byDay = {};
    segments.forEach(function (seg) {
      var density = seg.end > seg.start ? seg.minutes / ((seg.end - seg.start) / 60000) : 0;
      var cursor = seg.start;
      while (cursor < seg.end) {
        var day = U.localDate(cursor);
        var dayEnd = U.dayEndMs(day);
        var stop = Math.min(dayEnd, seg.end);
        (byDay[day] = byDay[day] || []).push({ entry: seg.entry, minutes: (stop - cursor) / 60000 * density });
        cursor = stop;
      }
    });
    return byDay;
  }

  function emptyBuckets() {
    return {
      total: 0, productive: 0, learning: 0, careerBusiness: 0, career: 0, business: 0, health: 0, spiritual: 0,
      relationship: 0, recovery: 0, leisure: 0, distraction: 0, futureBuilding: 0, active: 0
    };
  }

  function addToBuckets(b, entry, minutes, cats) {
    var c = cats[entry.CategoryID];
    var code = c ? c.Code : '';
    var type = c ? c.Type : (entry.ProductivityType || '');
    b.total += minutes;
    if (type === 'GROWTH' || type === 'PRODUCTIVE') b.productive += minutes;
    if (type === 'RECOVERY') b.recovery += minutes;
    if (type === 'LEISURE') b.leisure += minutes;
    if (type === 'DISTRACTION') b.distraction += minutes;
    if (code === 'LEARNING') b.learning += minutes;
    if (code === 'CAREER') { b.career += minutes; b.careerBusiness += minutes; }
    if (code === 'BUSINESS') { b.business += minutes; b.careerBusiness += minutes; }
    if (code === 'HEALTH') b.health += minutes;
    if (code === 'SPIRITUAL') b.spiritual += minutes;
    if (code === 'RELATIONSHIP') b.relationship += minutes;
    var fb = c ? c.FutureBuilding === true : type === 'GROWTH';
    var act = c ? c.CountsActive !== false : type !== 'RECOVERY';
    if (fb) b.futureBuilding += minutes;
    if (act) b.active += minutes;
  }

  function roundBuckets(b) {
    Object.keys(b).forEach(function (k) { b[k] = Math.round(b[k]); });
    return b;
  }

  /**
   * Agregasi waktu dalam rentang tanggal lokal [fromDate, toDate] (inklusif).
   * @return {buckets, byCategory, byDay: {date: buckets}, byGoal, byTask, byActivity, entriesCount}
   */
  function aggregate(data, fromDate, toDate) {
    var cats = categoryMap(data.categories);
    var fromMs = U.dayStartMs(fromDate), toMs = U.dayEndMs(toDate);
    var segs = segmentEntries(data.timeEntries, fromMs, toMs);
    var days = splitByDay(segs);
    var res = { buckets: emptyBuckets(), byCategory: {}, byDay: {}, byGoal: {}, byTask: {}, byActivity: {}, entryIds: {} };
    Object.keys(days).forEach(function (day) {
      if (day < fromDate || day > toDate) return;
      var db = res.byDay[day] = emptyBuckets();
      days[day].forEach(function (p) {
        var e = p.entry, m = p.minutes;
        addToBuckets(res.buckets, e, m, cats);
        addToBuckets(db, e, m, cats);
        res.byCategory[e.CategoryID] = (res.byCategory[e.CategoryID] || 0) + m;
        if (e.GoalID) res.byGoal[e.GoalID] = (res.byGoal[e.GoalID] || 0) + m;
        if (e.TaskID) res.byTask[e.TaskID] = (res.byTask[e.TaskID] || 0) + m;
        var act = (e.Activity || '').trim().toLowerCase();
        if (act) {
          var a = res.byActivity[act] = res.byActivity[act] || { name: e.Activity.trim(), minutes: 0, categoryId: e.CategoryID };
          a.minutes += m;
        }
        res.entryIds[e.TimeEntryID] = true;
      });
      roundBuckets(db);
    });
    roundBuckets(res.buckets);
    ['byCategory', 'byGoal', 'byTask'].forEach(function (k) {
      Object.keys(res[k]).forEach(function (id) { res[k][id] = Math.round(res[k][id]); });
    });
    Object.keys(res.byActivity).forEach(function (k) { res.byActivity[k].minutes = Math.round(res.byActivity[k].minutes); });
    res.entriesCount = Object.keys(res.entryIds).length;
    return res;
  }

  /** Time Investment Ratio = future-building ÷ waktu aktif × 100. */
  function investmentRatio(buckets) {
    if (!buckets || buckets.active <= 0) return null;
    return {
      ratio: Math.round(Math.min(100, buckets.futureBuilding / buckets.active * 100)),
      futureMinutes: buckets.futureBuilding,
      activeMinutes: buckets.active,
      estimated: true
    };
  }

  // ------------------------------------------------------------------ tasks

  function isOpenTask(t) { return t.Status === 'TODO' || t.Status === 'IN_PROGRESS'; }

  function filterTasks(tasks, filter, today, query) {
    var q = (query || '').trim().toLowerCase();
    return alive(tasks).filter(function (t) {
      if (q && (t.Title + ' ' + (t.Description || '') + ' ' + (t.Notes || '')).toLowerCase().indexOf(q) === -1) return false;
      switch (filter) {
        case 'today': return isOpenTask(t) && t.DueDate === today;
        case 'upcoming': return isOpenTask(t) && !!t.DueDate && t.DueDate > today;
        case 'overdue': return isOpenTask(t) && !!t.DueDate && t.DueDate < today;
        case 'completed': return t.Status === 'COMPLETED';
        case 'open': return isOpenTask(t);
        default: return true;
      }
    });
  }

  function sortTasks(tasks, mode) {
    var list = tasks.slice();
    var cmp = {
      priority: function (a, b) {
        return (PRIORITY_RANK[b.Priority] || 0) - (PRIORITY_RANK[a.Priority] || 0) || dueCmp(a, b) || a.Title.localeCompare(b.Title);
      },
      due: function (a, b) { return dueCmp(a, b) || (PRIORITY_RANK[b.Priority] || 0) - (PRIORITY_RANK[a.Priority] || 0); },
      created: function (a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); },
      title: function (a, b) { return a.Title.localeCompare(b.Title); }
    }[mode || 'priority'];
    return list.sort(cmp);
  }
  function dueCmp(a, b) {
    if (!a.DueDate && !b.DueDate) return 0;
    if (!a.DueDate) return 1;
    if (!b.DueDate) return -1;
    return a.DueDate < b.DueDate ? -1 : a.DueDate > b.DueDate ? 1 : 0;
  }

  /** Maks 3 task terpenting hari ini: ditandai bintang → terlambat/jatuh tempo hari ini → prioritas. */
  function mostImportantTasks(tasks, today, limit) {
    var open = alive(tasks).filter(isOpenTask);
    function score(t) {
      var s = 0;
      if (t.Starred) s += 1000;
      if (t.DueDate && t.DueDate <= today) s += 100;
      else if (t.DueDate && U.diffDays(today, t.DueDate) <= 2) s += 40;
      s += (PRIORITY_RANK[t.Priority] || 0) * 10;
      if (t.Status === 'IN_PROGRESS') s += 5;
      return s;
    }
    return open.sort(function (a, b) { return score(b) - score(a) || dueCmp(a, b); }).slice(0, limit || 3);
  }

  // ------------------------------------------------------------------ goals

  function expectedGoalProgress(goal, today) {
    if (!goal.StartDate || !goal.TargetDate) return null;
    var total = U.diffDays(goal.StartDate, goal.TargetDate);
    if (total <= 0) return today >= goal.TargetDate ? 100 : 0;
    var elapsed = U.diffDays(goal.StartDate, today);
    return U.clamp(elapsed / total * 100, 0, 100);
  }

  function goalStats(goal, data, today) {
    var entries = alive(data.timeEntries).filter(function (e) { return e.GoalID === goal.GoalID; });
    var invested = 0;
    if (entries.length) {
      var segs = segmentEntries(entries, -8.64e15, 8.64e15);
      segs.forEach(function (s) { invested += s.minutes; });
    }
    var tasks = alive(data.tasks).filter(function (t) { return t.GoalID === goal.GoalID && t.Status !== 'CANCELLED'; });
    var done = tasks.filter(function (t) { return t.Status === 'COMPLETED'; }).length;
    var expected = expectedGoalProgress(goal, today);
    var daysLeft = goal.TargetDate ? U.diffDays(today, goal.TargetDate) : null;
    return {
      investedMinutes: Math.round(invested),
      progress: Number(goal.Progress) || 0,
      expectedProgress: expected === null ? null : Math.round(expected),
      tasksTotal: tasks.length, tasksDone: done,
      daysLeft: daysLeft
    };
  }

  function activeGoals(goals) {
    return alive(goals).filter(function (g) { return g.Status === 'ACTIVE' && !g.Archived; })
      .sort(function (a, b) {
        return (PRIORITY_RANK[b.Priority] || 0) - (PRIORITY_RANK[a.Priority] || 0) ||
          String(a.TargetDate || '9999').localeCompare(String(b.TargetDate || '9999'));
      });
  }

  // ------------------------------------------------------------------ time budget

  function budgetStatus(data, weekStart, toDate) {
    var agg = aggregate(data, weekStart, toDate);
    var cats = categoryMap(data.categories);
    return alive(data.timeBudgets).filter(function (b) { return b.Active && cats[b.CategoryID] && !cats[b.CategoryID].Deleted; })
      .map(function (b) {
        var target = Number(b.WeeklyTargetMinutes) || 0;
        var actual = agg.byCategory[b.CategoryID] || 0;
        return {
          budget: b, category: cats[b.CategoryID], target: target, actual: actual, diff: actual - target,
          pct: target > 0 ? Math.round(actual / target * 100) : null
        };
      })
      .sort(function (a, b) { return (a.category.SortOrder || 0) - (b.category.SortOrder || 0); });
  }

  // ------------------------------------------------------------------ habits

  function habitDoneDates(habitId, logs) {
    var set = {};
    alive(logs).forEach(function (l) { if (l.HabitID === habitId && l.Status === 'DONE') set[l.Date] = true; });
    return set;
  }

  /** Completion rate habit dalam rentang (hanya tanggal unik dihitung). */
  function habitStats(habit, logs, fromDate, toDate, weekStartsOn) {
    var created = U.localDate(Date.parse(habit.CreatedAt));
    var from = fromDate > created ? fromDate : created;
    var done = habitDoneDates(habit.HabitID, logs);
    if (from > toDate) return { expected: 0, done: 0, rate: null, streak: 0 };
    var days = U.dateRange(from, toDate);
    var expected = 0, achieved = 0;
    if (habit.Frequency === 'WEEKLY') {
      var n = Number(habit.Target) || 1;
      var weeks = {};
      days.forEach(function (d) {
        var w = U.startOfWeek(d, weekStartsOn);
        var wk = weeks[w] = weeks[w] || { days: 0, done: 0 };
        wk.days++;
        if (done[d]) wk.done++;
      });
      Object.keys(weeks).forEach(function (w) {
        var wk = weeks[w];
        var exp = Math.min(n, Math.ceil(n * wk.days / 7));
        expected += exp;
        achieved += Math.min(wk.done, exp);
      });
    } else {
      expected = days.length;
      achieved = days.filter(function (d) { return done[d]; }).length;
    }
    return {
      expected: expected, done: achieved,
      rate: expected > 0 ? Math.round(achieved / expected * 100) : null,
      streak: habitStreak(done, toDate)
    };
  }

  /** Streak harian (informasi tambahan saja, bukan ukuran utama). Hari ini yang belum dicentang tidak memutus streak. */
  function habitStreak(doneSet, today) {
    var d = doneSet[today] ? today : U.addDays(today, -1);
    var n = 0;
    while (doneSet[d]) { n++; d = U.addDays(d, -1); }
    return n;
  }

  function habitsCompletion(habits, logs, fromDate, toDate, weekStartsOn) {
    var list = alive(habits).filter(function (h) { return h.Active; });
    var exp = 0, done = 0;
    list.forEach(function (h) {
      var s = habitStats(h, logs, fromDate, toDate, weekStartsOn);
      exp += s.expected; done += s.done;
    });
    return { habits: list.length, expected: exp, done: done, rate: exp > 0 ? Math.round(done / exp * 100) : null };
  }

  // ------------------------------------------------------------------ fokus

  function focusSummary(sessions, fromDate, toDate) {
    var list = alive(sessions).filter(function (s) {
      var d = U.localDate(Date.parse(s.StartTimestamp));
      return d >= fromDate && d <= toDate;
    });
    var minutes = 0, wSum = 0, wScore = 0;
    var ratings = { FULL: 0, PARTIAL: 0, DISTRACTED: 0 };
    list.forEach(function (s) {
      var m = Number(s.DurationMinutes) || 0;
      minutes += m;
      if (RATING_SCORE[s.FocusRating] !== undefined) {
        ratings[s.FocusRating]++;
        var w = Math.max(1, m);
        wSum += w; wScore += w * RATING_SCORE[s.FocusRating];
      }
    });
    return { sessions: list.length, minutes: minutes, ratings: ratings, quality: wSum ? Math.round(wScore / wSum) : null };
  }

  // ------------------------------------------------------------------ Future Self Score

  function parseWeights(raw) {
    var w = {};
    var src = raw;
    if (typeof raw === 'string') { try { src = JSON.parse(raw); } catch (e) { src = null; } }
    Object.keys(DEFAULT_WEIGHTS).forEach(function (k) {
      var v = src && typeof src[k] === 'number' && src[k] >= 0 ? src[k] : DEFAULT_WEIGHTS[k];
      w[k] = v;
    });
    return w;
  }

  function firstDataDate(data) {
    var first = null;
    alive(data.timeEntries).forEach(function (e) { if (e.Date && (!first || e.Date < first)) first = e.Date; });
    alive(data.habitLogs).forEach(function (l) { if (l.Date && (!first || l.Date < first)) first = l.Date; });
    return first;
  }

  function scoreLabel(score) {
    if (score >= 85) return 'Excellent Progress';
    if (score >= 70) return 'Good Progress';
    if (score >= 50) return 'Building Momentum';
    return 'Getting Started';
  }

  /**
   * Skor 0–100 yang dapat dijelaskan, jendela 7 hari terakhir.
   * Komponen tanpa data/target → tidak tersedia (bobot didistribusikan ulang), bukan nol.
   */
  function futureSelfScore(data, today, opts) {
    opts = opts || {};
    var weights = parseWeights(opts.weights);
    var weekStartsOn = opts.weekStartsOn === undefined ? 1 : opts.weekStartsOn;
    var windowStart = U.addDays(today, -6);
    var first = firstDataDate(data);
    var cats = categoryMap(data.categories);

    var evalStart = first && first > windowStart ? first : windowStart;
    var daysEvaluated = first ? Math.max(1, U.diffDays(evalStart, today) + 1) : 0;
    var factor = Math.min(1, daysEvaluated / 7);

    var agg = aggregate(data, windowStart, today);
    var dataDays = {};
    Object.keys(agg.byDay).forEach(function (d) { if (agg.byDay[d].total > 0) dataDays[d] = true; });
    alive(data.habitLogs).forEach(function (l) { if (l.Date >= windowStart && l.Date <= today) dataDays[l.Date] = true; });
    var daysWithData = Object.keys(dataDays).length;

    var comps = {};

    // Goal progress
    var goals = activeGoals(data.goals).filter(function (g) { return g.StartDate && g.TargetDate && g.StartDate <= today; });
    if (goals.length) {
      var sum = 0;
      goals.forEach(function (g) {
        var exp = expectedGoalProgress(g, today);
        var act = Number(g.Progress) || 0;
        sum += exp <= 0 ? 100 : Math.min(100, act / exp * 100);
      });
      comps.goalProgress = { value: Math.round(sum / goals.length), detail: goals.length + ' goal dibandingkan dengan progres yang diharapkan' };
    } else comps.goalProgress = { value: null, detail: 'Tambahkan goal aktif dengan tanggal mulai & target.' };

    // Consistency
    if (daysEvaluated > 0) {
      var activeDays = 0;
      U.dateRange(evalStart, today).forEach(function (d) {
        if (agg.byDay[d] && agg.byDay[d].futureBuilding >= 15) activeDays++;
      });
      var partA = activeDays / daysEvaluated * 100;
      var hc = habitsCompletion(data.habits, data.habitLogs, evalStart, today, weekStartsOn);
      var val = hc.rate === null ? partA : 0.5 * partA + 0.5 * hc.rate;
      comps.consistency = {
        value: Math.round(val),
        detail: activeDays + '/' + daysEvaluated + ' hari dengan ≥15 menit waktu pengembangan' + (hc.rate === null ? '' : '; habit ' + hc.rate + '%')
      };
    } else comps.consistency = { value: null, detail: 'Belum ada waktu tercatat.' };

    // Budget-based components
    function budgetTarget(codes) {
      var t = 0;
      alive(data.timeBudgets).forEach(function (b) {
        var c = cats[b.CategoryID];
        if (b.Active && c && codes.indexOf(c.Code) !== -1) t += Number(b.WeeklyTargetMinutes) || 0;
      });
      return t;
    }
    function budgetComp(codes, actual, label) {
      var target = budgetTarget(codes) * factor;
      if (target <= 0 || daysEvaluated === 0) return { value: null, detail: 'Atur target mingguan ' + label + ' di Time Budget untuk mengaktifkan komponen ini.' };
      return {
        value: Math.round(Math.min(100, actual / target * 100)),
        detail: U.fmtMinutes(actual, true) + ' dari target ' + U.fmtMinutes(target, true) + (factor < 1 ? ' (target disesuaikan dengan hari pemakaian)' : '')
      };
    }
    comps.learning = budgetComp(['LEARNING'], agg.buckets.learning, 'Learning');
    comps.careerBusiness = budgetComp(['CAREER', 'BUSINESS'], agg.buckets.careerBusiness, 'Career/Business');
    comps.health = budgetComp(['HEALTH'], agg.buckets.health, 'Health');

    // Focus quality
    var fs = focusSummary(data.focusSessions, windowStart, today);
    comps.focusQuality = fs.quality === null
      ? { value: null, detail: 'Belum ada sesi fokus yang dinilai.' }
      : { value: fs.quality, detail: fs.sessions + ' sesi fokus, ' + U.fmtMinutes(fs.minutes, true) };

    // Planning & task completion
    var due = alive(data.tasks).filter(function (t) { return t.DueDate && t.DueDate >= windowStart && t.DueDate <= today && t.Status !== 'CANCELLED'; });
    if (due.length) {
      var doneCount = due.filter(function (t) { return t.Status === 'COMPLETED'; }).length;
      comps.planning = { value: Math.round(doneCount / due.length * 100), detail: doneCount + ' dari ' + due.length + ' task yang jatuh tempo selesai' };
    } else comps.planning = { value: null, detail: 'Belum ada task yang jatuh tempo minggu ini.' };

    var components = Object.keys(DEFAULT_WEIGHTS).map(function (k) {
      return { key: k, label: COMPONENT_LABELS[k], weight: weights[k], value: comps[k].value, detail: comps[k].detail };
    });
    var avail = components.filter(function (c) { return c.value !== null && c.weight > 0; });
    var wsum = avail.reduce(function (s, c) { return s + c.weight; }, 0);
    var enough = daysWithData >= 3 && avail.length >= 2 && wsum > 0;
    if (!enough) {
      return {
        available: false, score: null, label: null, components: components, daysWithData: daysWithData,
        message: 'Belum cukup data untuk menghitung skor secara akurat.'
      };
    }
    var score = Math.round(avail.reduce(function (s, c) { return s + c.weight * c.value; }, 0) / wsum);
    return { available: true, score: score, label: scoreLabel(score), components: components, daysWithData: daysWithData, message: '' };
  }

  // ------------------------------------------------------------------ distraksi & proyeksi

  function projectionHoursPerYear(minutesPerDay) { return Math.round(minutesPerDay * 365 / 60); }

  function simulate(minutesPerDay) {
    var m = Math.max(0, Number(minutesPerDay) || 0);
    return { perDay: m, perWeek: m * 7, perMonth: m * 365 / 12, perYear: m * 365 };
  }

  function distractionSummary(data, today, opts) {
    opts = opts || {};
    var weekStart = U.startOfWeek(today, opts.weekStartsOn === undefined ? 1 : opts.weekStartsOn);
    var cats = categoryMap(data.categories);
    var todayAgg = aggregate(data, today, today);
    var weekAgg = aggregate(data, weekStart, today);
    var trendFrom = U.addDays(today, -13);
    var trendAgg = aggregate(data, trendFrom, today);
    var trend = U.dateRange(trendFrom, today).map(function (d) { return { date: d, minutes: trendAgg.byDay[d] ? trendAgg.byDay[d].distraction : 0 }; });
    var top = Object.keys(weekAgg.byActivity).map(function (k) { return weekAgg.byActivity[k]; })
      .filter(function (a) { var c = cats[a.categoryId]; return c && c.Type === 'DISTRACTION'; })
      .sort(function (a, b) { return b.minutes - a.minutes; }).slice(0, 5);
    var daysSoFar = U.diffDays(weekStart, today) + 1;
    var dailyTarget = Number(opts.dailyTargetMinutes);
    return {
      today: todayAgg.buckets.distraction,
      week: weekAgg.buckets.distraction,
      weekTarget: isFinite(dailyTarget) && dailyTarget >= 0 ? dailyTarget * daysSoFar : null,
      dailyTarget: isFinite(dailyTarget) ? dailyTarget : null,
      trend: trend,
      top: top
    };
  }

  // ------------------------------------------------------------------ review & insight

  function pctChange(curr, prev) {
    if (!prev) return null;
    return Math.round((curr - prev) / prev * 100);
  }

  function daySummary(data, date) {
    var agg = aggregate(data, date, date);
    var tasks = alive(data.tasks);
    var completed = tasks.filter(function (t) { return t.Status === 'COMPLETED' && t.CompletedAt && U.localDate(Date.parse(t.CompletedAt)) === date; });
    var pending = tasks.filter(function (t) { return isOpenTask(t) && t.DueDate && t.DueDate <= date; });
    return { date: date, buckets: agg.buckets, completedTasks: completed, pendingTasks: pending, ratio: investmentRatio(agg.buckets) };
  }

  function weekSummary(data, weekStart, opts) {
    opts = opts || {};
    var weekEnd = U.addDays(weekStart, 6);
    var until = opts.today && opts.today < weekEnd ? opts.today : weekEnd;
    var agg = aggregate(data, weekStart, until);
    var tasks = alive(data.tasks);
    var completed = tasks.filter(function (t) {
      if (t.Status !== 'COMPLETED' || !t.CompletedAt) return false;
      var d = U.localDate(Date.parse(t.CompletedAt));
      return d >= weekStart && d <= until;
    });
    var dueThisWeek = tasks.filter(function (t) { return t.DueDate && t.DueDate >= weekStart && t.DueDate <= until && t.Status !== 'CANCELLED'; });
    var dueDone = dueThisWeek.filter(function (t) { return t.Status === 'COMPLETED'; }).length;
    var focus = focusSummary(data.focusSessions, weekStart, until);
    var habits = habitsCompletion(data.habits, data.habitLogs, weekStart, until, opts.weekStartsOn);
    var goals = Object.keys(agg.byGoal).map(function (id) { return { goalId: id, minutes: agg.byGoal[id] }; })
      .sort(function (a, b) { return b.minutes - a.minutes; });
    return {
      weekStart: weekStart, weekEnd: weekEnd, until: until, agg: agg, buckets: agg.buckets,
      completedCount: completed.length, dueCount: dueThisWeek.length,
      completionRate: dueThisWeek.length ? Math.round(dueDone / dueThisWeek.length * 100) : null,
      focus: focus, habits: habits, goals: goals, ratio: investmentRatio(agg.buckets), hasData: agg.entriesCount > 0
    };
  }

  /** Insight harian: hanya dari data yang benar-benar ada. */
  function dailyInsight(summary) {
    var b = summary.buckets;
    if (b.total <= 0) return 'Belum ada waktu tercatat hari ini. Catat aktivitas pertama untuk melihat ke mana waktumu diinvestasikan.';
    var growth = b.learning + b.careerBusiness;
    if (growth > 0) return 'Hari ini kamu telah menginvestasikan ' + U.fmtMinutes(growth, true) + ' untuk belajar dan mengembangkan bisnis atau karier.';
    if (b.futureBuilding > 0) return 'Hari ini ' + U.fmtMinutes(b.futureBuilding, true) + ' waktumu masuk ke kategori yang membangun masa depan.';
    return 'Hari ini tercatat ' + U.fmtMinutes(b.total, true) + '. Waktu pemulihan dan istirahat juga bagian dari produktivitas.';
  }

  /** Insight mingguan dengan perbandingan hanya bila minggu lalu punya data. */
  function weeklyInsights(curr, prev) {
    var out = [];
    var hasPrev = prev && prev.hasData;
    var labels = [['careerBusiness', 'bisnis & karier'], ['learning', 'belajar'], ['health', 'kesehatan']];
    labels.forEach(function (pair) {
      var c = curr.buckets[pair[0]];
      if (c <= 0) return;
      var line = 'Minggu ini kamu menginvestasikan ' + U.fmtMinutes(c, true) + ' untuk ' + pair[1];
      if (hasPrev) {
        var ch = pctChange(c, prev.buckets[pair[0]]);
        if (ch !== null) line += ch === 0 ? ', sama dengan minggu sebelumnya' : (ch > 0 ? ', meningkat ' : ', turun ') + Math.abs(ch) + '% dibandingkan minggu sebelumnya';
      }
      out.push(line + '.');
    });
    if (curr.buckets.distraction > 0) {
      var d = 'Distraksi tercatat ' + U.fmtMinutes(curr.buckets.distraction, true);
      if (hasPrev && prev.buckets.distraction > 0) {
        var dc = pctChange(curr.buckets.distraction, prev.buckets.distraction);
        d += dc === 0 ? ', sama dengan minggu lalu' : (dc < 0 ? ', berkurang ' : ', bertambah ') + Math.abs(dc) + '% dari minggu lalu';
      }
      out.push(d + '.');
    }
    if (!hasPrev && curr.hasData) out.push('Belum ada data minggu sebelumnya untuk dibandingkan.');
    return out;
  }

  return {
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS, COMPONENT_LABELS: COMPONENT_LABELS, PRIORITY_RANK: PRIORITY_RANK,
    alive: alive, categoryMap: categoryMap, segmentEntries: segmentEntries, splitByDay: splitByDay,
    aggregate: aggregate, investmentRatio: investmentRatio,
    isOpenTask: isOpenTask, filterTasks: filterTasks, sortTasks: sortTasks, mostImportantTasks: mostImportantTasks,
    expectedGoalProgress: expectedGoalProgress, goalStats: goalStats, activeGoals: activeGoals,
    budgetStatus: budgetStatus, habitStats: habitStats, habitDoneDates: habitDoneDates, habitsCompletion: habitsCompletion,
    focusSummary: focusSummary, parseWeights: parseWeights, futureSelfScore: futureSelfScore, scoreLabel: scoreLabel,
    projectionHoursPerYear: projectionHoursPerYear, simulate: simulate, distractionSummary: distractionSummary,
    pctChange: pctChange, daySummary: daySummary, weekSummary: weekSummary, dailyInsight: dailyInsight, weeklyInsights: weeklyInsights
  };
});
