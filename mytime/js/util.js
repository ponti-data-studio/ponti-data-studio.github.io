/**
 * Mytime — util.js
 * Utilitas murni: UUID, tanggal lokal ↔ UTC, format durasi, builder DOM aman.
 * Konvensi: Date = 'yyyy-MM-dd' (tanggal lokal pengguna), Timestamp = 'yyyy-MM-ddTHH:mm:ssZ' (UTC).
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.TI = root.TI || {}; root.TI.util = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function uuid() {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    var b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Timestamp UTC tanpa milidetik. */
  function toIso(msOrDate) {
    var d = msOrDate instanceof Date ? msOrDate : new Date(msOrDate === undefined ? Date.now() : msOrDate);
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  function nowIso() { return toIso(Date.now()); }

  /** Tanggal lokal (zona waktu perangkat) dari ms/Date. */
  function localDate(msOrDate) {
    var d = msOrDate === undefined ? new Date() : (msOrDate instanceof Date ? msOrDate : new Date(msOrDate));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function today() { return localDate(new Date()); }

  /** 'yyyy-MM-dd' → Date pada 00:00 waktu lokal (tidak bergeser oleh UTC). */
  function parseLocalDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function dayStartMs(dateStr) { return parseLocalDate(dateStr).getTime(); }
  /** Awal hari berikutnya (aman untuk hari 23/25 jam saat DST). */
  function dayEndMs(dateStr) { return parseLocalDate(addDays(dateStr, 1)).getTime(); }

  function addDays(dateStr, n) {
    var d = parseLocalDate(dateStr);
    return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  }
  function diffDays(a, b) {
    // jumlah hari kalender dari a ke b (b - a)
    var da = parseLocalDate(a), db = parseLocalDate(b);
    return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
  }
  /** weekStartsOn: 1 = Senin, 0 = Minggu. */
  function startOfWeek(dateStr, weekStartsOn) {
    var ws = weekStartsOn === undefined ? 1 : Number(weekStartsOn);
    var d = parseLocalDate(dateStr);
    var delta = (d.getDay() - ws + 7) % 7;
    return addDays(dateStr, -delta);
  }
  function startOfMonth(dateStr) { return dateStr.slice(0, 8) + '01'; }
  function startOfYear(dateStr) { return dateStr.slice(0, 5) + '01-01'; }
  function dateRange(from, to) {
    var out = [];
    for (var d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  }

  /** Gabungkan tanggal lokal + 'HH:mm' menjadi timestamp UTC. */
  function localDateTimeToIso(dateStr, hhmm) {
    var d = parseLocalDate(dateStr);
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!d || !m) return null;
    d.setHours(+m[1], +m[2], 0, 0);
    return toIso(d);
  }
  function isoToLocalHHmm(iso) {
    var d = new Date(iso);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 200 → "3 j 20 m"; long → "3 jam 20 menit". */
  function fmtMinutes(min, long) {
    var m = Math.max(0, Math.round(Number(min) || 0));
    var h = Math.floor(m / 60), r = m % 60;
    if (long) {
      if (!h) return r + ' menit';
      return h + ' jam' + (r ? ' ' + r + ' menit' : '');
    }
    if (!h) return r + 'm';
    return h + 'j' + (r ? ' ' + r + 'm' : '');
  }
  function fmtHours(min, digits) {
    var v = (Number(min) || 0) / 60;
    return v.toLocaleString('id-ID', { maximumFractionDigits: digits === undefined ? 1 : digits });
  }
  /** Stopwatch: 3725 dtk → "1:02:05". */
  function fmtClock(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(sec);
  }

  var DAY_FMT = null, SHORT_FMT = null;
  function fmtDateLong(dateStr) {
    DAY_FMT = DAY_FMT || new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return DAY_FMT.format(parseLocalDate(dateStr));
  }
  function fmtDateShort(dateStr) {
    SHORT_FMT = SHORT_FMT || new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
    return SHORT_FMT.format(parseLocalDate(dateStr));
  }
  function relativeDay(dateStr, ref) {
    var d = diffDays(ref || today(), dateStr);
    if (d === 0) return 'Hari ini';
    if (d === 1) return 'Besok';
    if (d === -1) return 'Kemarin';
    return fmtDateShort(dateStr);
  }
  function greeting(date) {
    var h = (date || new Date()).getHours();
    if (h < 12) return 'Good Morning!';
    if (h < 18) return 'Good Afternoon!';
    return 'Good Evening!';
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round(v, digits) { var f = Math.pow(10, digits || 0); return Math.round(v * f) / f; }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /**
   * Builder DOM aman: teks selalu lewat textContent, tidak pernah innerHTML.
   * h('button', { class: 'btn', onclick: fn, 'aria-label': 'x' }, 'Teks', childEl)
   */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  return {
    uuid: uuid, pad: pad, toIso: toIso, nowIso: nowIso, localDate: localDate, today: today,
    parseLocalDate: parseLocalDate, dayStartMs: dayStartMs, dayEndMs: dayEndMs, addDays: addDays, diffDays: diffDays,
    startOfWeek: startOfWeek, startOfMonth: startOfMonth, startOfYear: startOfYear, dateRange: dateRange,
    localDateTimeToIso: localDateTimeToIso, isoToLocalHHmm: isoToLocalHHmm,
    fmtMinutes: fmtMinutes, fmtHours: fmtHours, fmtClock: fmtClock, fmtDateLong: fmtDateLong, fmtDateShort: fmtDateShort,
    relativeDay: relativeDay, greeting: greeting, clamp: clamp, round: round, debounce: debounce,
    h: h, append: append, clear: clear, $: $, $all: $all
  };
});
