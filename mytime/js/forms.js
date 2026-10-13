/**
 * Mytime — forms.js
 * Form (bottom sheet) untuk membuat & mengedit entitas. Validasi di klien hanya untuk umpan balik
 * cepat; server tetap memvalidasi ulang semua data saat sinkronisasi.
 */
(function () {
  'use strict';
  var TI = window.TI = window.TI || {};
  var U = TI.util, h = U.h;

  var PRIORITIES = [{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' }];
  var TASK_STATUS = [{ value: 'TODO', label: 'To do' }, { value: 'IN_PROGRESS', label: 'Sedang dikerjakan' }, { value: 'COMPLETED', label: 'Selesai' }, { value: 'CANCELLED', label: 'Dibatalkan' }];
  var GOAL_STATUS = [{ value: 'ACTIVE', label: 'Aktif' }, { value: 'PAUSED', label: 'Dijeda' }, { value: 'COMPLETED', label: 'Tercapai' }, { value: 'CANCELLED', label: 'Dibatalkan' }];
  var CAT_TYPES = [
    { value: 'GROWTH', label: 'Pengembangan diri / masa depan' },
    { value: 'PRODUCTIVE', label: 'Produktif (kewajiban, admin)' },
    { value: 'RECOVERY', label: 'Pemulihan (istirahat, tidur)' },
    { value: 'LEISURE', label: 'Hiburan' },
    { value: 'DISTRACTION', label: 'Distraksi' }
  ];
  var PRIORITY_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };

  // ---------------------------------------------------------------- builder
  function field(label, control, hint) {
    var err = h('span', { class: 'err-msg', role: 'alert' });
    var wrap = h('label', { class: 'field' }, h('span', { class: 'lbl', text: label }), control, hint ? h('span', { class: 'hint', text: hint }) : null, err);
    wrap._err = err;
    control._field = wrap;
    var clearOwn = function () { if (err.textContent) { err.textContent = ''; control.classList.remove('invalid'); } };
    control.addEventListener('input', clearOwn);
    control.addEventListener('change', clearOwn);
    return wrap;
  }
  function input(attrs) { return h('input', Object.assign({ class: 'input' }, attrs)); }
  function textarea(attrs) { return h('textarea', Object.assign({ class: 'textarea' }, attrs)); }
  function select(options, value, attrs) {
    var s = h('select', Object.assign({ class: 'select' }, attrs || {}));
    options.forEach(function (o) {
      s.appendChild(h('option', { value: o.value, selected: String(o.value) === String(value === undefined || value === null ? '' : value) }, o.label));
    });
    return s;
  }
  function switchRow(label, checked, hint) {
    var cb = h('input', { type: 'checkbox', checked: !!checked, role: 'switch' });
    var row = h('label', { class: 'switch-row' },
      h('span', null, h('span', { style: { fontWeight: 600 }, text: label }), hint ? h('span', { class: 'hint xs muted', style: { display: 'block' }, text: hint }) : null),
      h('span', { class: 'switch' }, cb, h('span', { class: 'track' })));
    row.input = cb;
    return row;
  }
  function setError(control, msg) {
    var f = control._field;
    control.classList.toggle('invalid', !!msg);
    if (f) f._err.textContent = msg || '';
    if (msg && control.focus) control.focus();
    return !msg;
  }
  function clearErrors(root) {
    U.$all('.invalid', root).forEach(function (el) { el.classList.remove('invalid'); });
    U.$all('.err-msg', root).forEach(function (el) { el.textContent = ''; });
  }

  function categoryOptions(value, opts) {
    opts = opts || {};
    var cats = TI.repo.list('categories').filter(function (c) { return c.Active || c.CategoryID === value; })
      .sort(function (a, b) { return (a.SortOrder || 0) - (b.SortOrder || 0) || a.Name.localeCompare(b.Name); });
    var out = opts.allowEmpty ? [{ value: '', label: opts.emptyLabel || 'Tanpa kategori' }] : [];
    return out.concat(cats.map(function (c) { return { value: c.CategoryID, label: c.Name }; }));
  }
  function goalOptions(value) {
    var goals = TI.repo.list('goals').filter(function (g) { return (g.Status === 'ACTIVE' && !g.Archived) || g.GoalID === value; })
      .sort(function (a, b) { return a.Name.localeCompare(b.Name); });
    return [{ value: '', label: 'Tidak terkait goal' }].concat(goals.map(function (g) { return { value: g.GoalID, label: g.Name }; }));
  }
  function taskOptions(value) {
    var tasks = TI.repo.list('tasks').filter(function (t) { return TI.calc.isOpenTask(t) || t.TaskID === value; });
    tasks = TI.calc.sortTasks(tasks, 'priority');
    return [{ value: '', label: 'Tidak terkait task' }].concat(tasks.map(function (t) { return { value: t.TaskID, label: t.Title }; }));
  }
  function categoryByCode(code) {
    return TI.repo.list('categories').filter(function (c) { return c.Code === code; })[0] || null;
  }
  function defaultCategoryId() {
    var c = categoryByCode('LEARNING') || TI.repo.list('categories')[0];
    return c ? c.CategoryID : '';
  }

  function deleteAction(label, onDelete) {
    return {
      label: label || 'Hapus', kind: 'ghost danger', icon: 'trash-2',
      onClick: function () {
        return TI.ui.confirm('Hapus data ini?', 'Data akan dihapus di semua perangkat setelah sinkronisasi.', { danger: true, confirmText: 'Hapus' })
          .then(function (ok) { if (!ok) return false; return onDelete().then(function () { TI.ui.toast('Dihapus'); return true; }); });
      }
    };
  }

  // ---------------------------------------------------------------- task
  function taskForm(existing, defaults) {
    var t = Object.assign({ Title: '', Description: '', CategoryID: '', GoalID: '', Priority: 'MEDIUM', EstimatedMinutes: '', DueDate: '', Status: 'TODO', Starred: false, Notes: '' }, defaults || {}, existing || {});
    var title = input({ type: 'text', value: t.Title, maxlength: '200', placeholder: 'Mis. Menyelesaikan proposal klien', autocomplete: 'off', autofocus: !existing });
    var prio = t.Priority;
    var prioSeg = TI.ui.segmented(PRIORITIES, prio, function (v) { prio = v; });
    var due = input({ type: 'date', value: t.DueDate });
    var est = input({ type: 'number', inputmode: 'numeric', min: '0', max: '100000', step: '5', value: t.EstimatedMinutes === '' ? '' : String(t.EstimatedMinutes), placeholder: 'Menit' });
    var cat = select(categoryOptions(t.CategoryID, { allowEmpty: true }), t.CategoryID);
    var goal = select(goalOptions(t.GoalID), t.GoalID);
    var status = select(TASK_STATUS, t.Status);
    var star = switchRow('Prioritas hari ini', t.Starred, 'Tampil di Most Important Tasks (maks. 3)');
    var desc = textarea({ value: t.Description, maxlength: '4000', placeholder: 'Detail, langkah, atau tautan' });
    var notes = textarea({ value: t.Notes, maxlength: '4000', placeholder: 'Catatan tambahan' });

    var content = h('div', null,
      field('Judul', title),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Prioritas' }), prioSeg),
      h('div', { class: 'field-row' }, field('Tenggat', due), field('Estimasi (menit)', est)),
      h('div', { class: 'field-row' }, field('Kategori', cat), field('Goal', goal)),
      existing ? field('Status', status) : null,
      h('div', { class: 'field' }, star),
      field('Deskripsi', desc),
      field('Catatan', notes));

    var actions = [];
    if (existing) actions.push(deleteAction('Hapus', function () { return TI.repo.remove('tasks', existing.TaskID); }));
    actions.push({ label: existing ? 'Simpan' : 'Tambah task', kind: 'primary', onClick: function () {
      clearErrors(content);
      var v = title.value.trim();
      if (!v) return setError(title, 'Judul wajib diisi.');
      var e = est.value === '' ? '' : Number(est.value);
      if (e !== '' && (!isFinite(e) || e < 0 || Math.floor(e) !== e)) return setError(est, 'Masukkan menit dalam bilangan bulat.');
      var st = existing ? status.value : 'TODO';
      var rec = Object.assign({}, existing || {}, {
        Title: v, Description: desc.value.trim(), CategoryID: cat.value, GoalID: goal.value, Priority: prio,
        EstimatedMinutes: e, DueDate: due.value, Status: st, Starred: star.input.checked, Notes: notes.value.trim(),
        CompletedAt: st === 'COMPLETED' ? ((existing && existing.CompletedAt) || U.nowIso()) : ''
      });
      return TI.repo.save('tasks', rec).then(function () { TI.ui.toast(existing ? 'Task disimpan' : 'Task ditambahkan'); });
    } });
    return TI.ui.sheet({ title: existing ? 'Edit task' : 'Task baru', content: content, actions: actions });
  }

  function setTaskDone(task, done) {
    var rec = Object.assign({}, task, {
      Status: done ? 'COMPLETED' : 'TODO',
      CompletedAt: done ? U.nowIso() : ''
    });
    return TI.repo.save('tasks', rec).then(function () {
      if (done) TI.ui.toast('Task selesai');
    });
  }

  // ---------------------------------------------------------------- time entry
  function timeEntryForm(existing, defaults) {
    var d = defaults || {};
    var now = new Date();
    var startIso = existing ? existing.StartTime : (d.StartTime || U.toIso(now.getTime() - 60 * 60000));
    var endIso = existing ? existing.EndTime : (d.EndTime || U.toIso(now));
    var e = Object.assign({ Activity: '', CategoryID: defaultCategoryId(), GoalID: '', TaskID: '', Notes: '', Source: 'MANUAL' }, d, existing || {});
    var activity = input({ type: 'text', value: e.Activity, maxlength: '200', placeholder: 'Mis. Membaca buku', autocomplete: 'off', autofocus: !existing });
    var cat = select(categoryOptions(e.CategoryID), e.CategoryID);
    var date = input({ type: 'date', value: existing ? existing.Date : U.localDate(Date.parse(startIso)) });
    var start = input({ type: 'time', value: U.isoToLocalHHmm(startIso) });
    var end = input({ type: 'time', value: U.isoToLocalHHmm(endIso) });
    var spanInit = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
    var dur = input({ type: 'number', inputmode: 'numeric', min: '0', max: '2880', value: String(existing && existing.DurationMinutes !== '' ? existing.DurationMinutes : spanInit) });
    var durHint = h('span', { class: 'hint' });
    var goal = select(goalOptions(e.GoalID), e.GoalID);
    var task = select(taskOptions(e.TaskID), e.TaskID);
    var notes = textarea({ value: e.Notes, maxlength: '2000', placeholder: 'Opsional' });

    function computeSpan() {
      var s = U.localDateTimeToIso(date.value, start.value);
      var en = U.localDateTimeToIso(date.value, end.value);
      if (!s || !en) return null;
      var ms = Date.parse(en) - Date.parse(s);
      if (ms <= 0) { en = U.localDateTimeToIso(U.addDays(date.value, 1), end.value); ms = Date.parse(en) - Date.parse(s); }
      return { start: s, end: en, minutes: Math.round(ms / 60000) };
    }
    function onTimeChange() {
      var sp = computeSpan();
      if (!sp) return;
      dur.value = String(sp.minutes);
      durHint.textContent = (Date.parse(sp.end) - Date.parse(sp.start) > 0 && U.localDate(Date.parse(sp.end)) !== date.value ? 'Berakhir keesokan hari. ' : '') + 'Kurangi bila ada jeda di tengah aktivitas.';
    }
    [date, start, end].forEach(function (el) { el.addEventListener('change', onTimeChange); });
    durHint.textContent = 'Kurangi bila ada jeda di tengah aktivitas.';
    task.addEventListener('change', function () {
      var t = TI.repo.get('tasks', task.value);
      if (t) {
        if (!activity.value.trim()) activity.value = t.Title;
        if (t.GoalID && !goal.value) goal.value = t.GoalID;
        if (t.CategoryID) cat.value = t.CategoryID;
      }
    });

    var durField = field('Durasi aktif (menit)', dur);
    durField.insertBefore(durHint, durField._err);
    var content = h('div', null,
      field('Aktivitas', activity),
      field('Kategori', cat),
      field('Tanggal', date),
      h('div', { class: 'field-row' }, field('Mulai', start), field('Selesai', end)),
      durField,
      field('Task', task),
      field('Goal', goal),
      field('Catatan', notes));

    var actions = [];
    if (existing) actions.push(deleteAction('Hapus', function () { return TI.repo.remove('timeEntries', existing.TimeEntryID); }));
    actions.push({ label: existing ? 'Simpan' : 'Simpan catatan waktu', kind: 'primary', onClick: function () {
      clearErrors(content);
      if (!activity.value.trim()) return setError(activity, 'Isi nama aktivitas.');
      if (!cat.value) return setError(cat, 'Pilih kategori.');
      if (!date.value) return setError(date, 'Pilih tanggal.');
      var sp = computeSpan();
      if (!sp) return setError(start, 'Isi jam mulai dan selesai.');
      if (sp.minutes > 48 * 60) return setError(end, 'Rentang maksimal 48 jam.');
      var dm = Number(dur.value);
      if (!isFinite(dm) || dm < 0 || Math.floor(dm) !== dm) return setError(dur, 'Durasi harus bilangan bulat menit.');
      if (dm > sp.minutes) return setError(dur, 'Durasi tidak boleh melebihi ' + sp.minutes + ' menit (selisih mulai–selesai).');
      if (dm === 0) return setError(dur, 'Durasi minimal 1 menit.');
      var c = TI.repo.get('categories', cat.value);
      var rec = Object.assign({}, existing || {}, {
        Date: date.value, StartTime: sp.start, EndTime: sp.end, DurationMinutes: dm,
        Activity: activity.value.trim(), CategoryID: cat.value, GoalID: goal.value, TaskID: task.value,
        ProductivityType: c ? c.Type : '', Source: existing ? existing.Source : (e.Source || 'MANUAL'),
        FocusSessionID: existing ? existing.FocusSessionID : (e.FocusSessionID || ''), Notes: notes.value.trim()
      });
      return TI.repo.save('timeEntries', rec).then(function () { TI.ui.toast('Waktu tercatat'); });
    } });
    return TI.ui.sheet({ title: existing ? 'Edit catatan waktu' : 'Catat waktu', content: content, actions: actions });
  }

  // ---------------------------------------------------------------- goal
  function goalForm(existing) {
    var g = Object.assign({ Name: '', Description: '', CategoryID: '', StartDate: U.today(), TargetDate: '', Priority: 'HIGH', Status: 'ACTIVE', Progress: 0, Archived: false, EvaluationNotes: '' }, existing || {});
    var name = input({ type: 'text', value: g.Name, maxlength: '150', placeholder: 'Mis. Menguasai programming', autocomplete: 'off', autofocus: !existing });
    var desc = textarea({ value: g.Description, maxlength: '4000', placeholder: 'Seperti apa “tercapai” itu? Tulis ukuran yang jelas.' });
    var cat = select(categoryOptions(g.CategoryID, { allowEmpty: true }), g.CategoryID);
    var startD = input({ type: 'date', value: g.StartDate });
    var target = input({ type: 'date', value: g.TargetDate });
    var prio = g.Priority;
    var prioSeg = TI.ui.segmented(PRIORITIES, prio, function (v) { prio = v; });
    var status = select(GOAL_STATUS, g.Status);
    var progVal = h('span', { class: 'num', text: (Number(g.Progress) || 0) + '%' });
    var prog = input({ type: 'range', min: '0', max: '100', step: '5', value: String(Number(g.Progress) || 0), style: { padding: '0', minHeight: '44px', border: '0', boxShadow: 'none' } });
    prog.addEventListener('input', function () { progVal.textContent = prog.value + '%'; });
    var evalNotes = textarea({ value: g.EvaluationNotes, maxlength: '4000', placeholder: 'Apa yang berjalan baik, apa yang perlu diubah?' });

    var progField = h('div', { class: 'field' }, h('span', { class: 'lbl row between' }, h('span', { text: 'Progres aktual' }), progVal), prog,
      h('span', { class: 'hint', text: 'Isi berdasarkan hasil nyata, bukan jumlah jam. Waktu yang diinvestasikan dihitung terpisah.' }));
    var content = h('div', null,
      field('Nama goal', name),
      field('Deskripsi & ukuran keberhasilan', desc),
      field('Kategori', cat),
      h('div', { class: 'field-row' }, field('Mulai', startD), field('Target', target)),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Prioritas' }), prioSeg),
      existing ? field('Status', status) : null,
      progField,
      existing ? field('Catatan evaluasi', evalNotes) : null);

    var actions = [];
    if (existing) actions.push(deleteAction('Hapus', function () { return TI.repo.remove('goals', existing.GoalID); }));
    actions.push({ label: existing ? 'Simpan' : 'Buat goal', kind: 'primary', onClick: function () {
      clearErrors(content);
      if (!name.value.trim()) return setError(name, 'Nama goal wajib diisi.');
      if (startD.value && target.value && target.value < startD.value) return setError(target, 'Target tidak boleh sebelum tanggal mulai.');
      var st = existing ? status.value : 'ACTIVE';
      var p = Number(prog.value);
      if (st === 'COMPLETED' && p < 100) p = 100;
      var rec = Object.assign({}, existing || {}, {
        Name: name.value.trim(), Description: desc.value.trim(), CategoryID: cat.value, StartDate: startD.value, TargetDate: target.value,
        Priority: prio, Status: st, Progress: p, Archived: existing ? !!existing.Archived : false, EvaluationNotes: evalNotes.value.trim()
      });
      return TI.repo.save('goals', rec).then(function () { TI.ui.toast(existing ? 'Goal disimpan' : 'Goal dibuat'); });
    } });
    return TI.ui.sheet({ title: existing ? 'Edit goal' : 'Goal baru', content: content, actions: actions });
  }

  // ---------------------------------------------------------------- habit
  function habitForm(existing) {
    var hb = Object.assign({ Name: '', Description: '', Frequency: 'DAILY', Target: 1, CategoryID: '', GoalID: '', Active: true }, existing || {});
    var name = input({ type: 'text', value: hb.Name, maxlength: '120', placeholder: 'Mis. Membaca buku 20 menit', autocomplete: 'off', autofocus: !existing });
    var desc = textarea({ value: hb.Description, maxlength: '2000', placeholder: 'Opsional' });
    var freq = hb.Frequency;
    var targetSel = select([1, 2, 3, 4, 5, 6, 7].map(function (n) { return { value: n, label: n + ' hari per minggu' }; }), hb.Frequency === 'WEEKLY' ? hb.Target : 3);
    var targetField = field('Target', targetSel);
    targetField.classList.toggle('hidden', freq !== 'WEEKLY');
    var freqSeg = TI.ui.segmented([{ value: 'DAILY', label: 'Setiap hari' }, { value: 'WEEKLY', label: 'Beberapa kali seminggu' }], freq, function (v) {
      freq = v; targetField.classList.toggle('hidden', v !== 'WEEKLY');
    });
    var cat = select(categoryOptions(hb.CategoryID, { allowEmpty: true }), hb.CategoryID);
    var goal = select(goalOptions(hb.GoalID), hb.GoalID);
    var active = switchRow('Aktif', hb.Active, 'Habit nonaktif tidak dihitung dalam completion rate');
    var content = h('div', null,
      field('Nama habit', name),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Frekuensi' }), freqSeg),
      targetField,
      h('div', { class: 'field-row' }, field('Kategori', cat), field('Goal', goal)),
      field('Deskripsi', desc),
      existing ? h('div', { class: 'field' }, active) : null);
    var actions = [];
    if (existing) actions.push(deleteAction('Hapus', function () { return TI.repo.remove('habits', existing.HabitID); }));
    actions.push({ label: existing ? 'Simpan' : 'Tambah habit', kind: 'primary', onClick: function () {
      clearErrors(content);
      if (!name.value.trim()) return setError(name, 'Nama habit wajib diisi.');
      var rec = Object.assign({}, existing || {}, {
        Name: name.value.trim(), Description: desc.value.trim(), Frequency: freq, Target: freq === 'WEEKLY' ? Number(targetSel.value) : 1,
        CategoryID: cat.value, GoalID: goal.value, Active: existing ? active.input.checked : true
      });
      return TI.repo.save('habits', rec).then(function () { TI.ui.toast(existing ? 'Habit disimpan' : 'Habit ditambahkan'); });
    } });
    return TI.ui.sheet({ title: existing ? 'Edit habit' : 'Habit baru', content: content, actions: actions });
  }

  // ---------------------------------------------------------------- kategori
  function categoryForm(existing) {
    var c = Object.assign({ Name: '', Code: '', Color: '#64748B', Type: 'GROWTH', FutureBuilding: true, CountsActive: true, Active: true, SortOrder: 100, IsSystem: false }, existing || {});
    var name = input({ type: 'text', value: c.Name, maxlength: '60', autocomplete: 'off', autofocus: !existing });
    var code = input({ type: 'text', value: c.Code, maxlength: '32', autocapitalize: 'characters', readonly: !!c.IsSystem, placeholder: 'Mis. SIDE_PROJECT' });
    if (!existing) name.addEventListener('input', function () { code.value = name.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32); });
    var color = h('input', { type: 'color', class: 'color-input', value: c.Color });
    var type = select(CAT_TYPES, c.Type);
    var fb = switchRow('Membangun masa depan', c.FutureBuilding, 'Dihitung dalam Time Investment Ratio');
    var act = switchRow('Termasuk waktu aktif', c.CountsActive, 'Matikan untuk tidur/istirahat agar tidak menurunkan rasio');
    var on = switchRow('Kategori aktif', c.Active, 'Kategori nonaktif disembunyikan dari pilihan, data lama tetap ada');
    type.addEventListener('change', function () {
      if (existing) return;
      fb.input.checked = type.value === 'GROWTH';
      act.input.checked = type.value !== 'RECOVERY';
    });
    var content = h('div', null,
      h('div', { class: 'field-row', style: { gridTemplateColumns: '1fr auto' } }, field('Nama', name), field('Warna', color)),
      field('Kode', code, c.IsSystem ? 'Kode kategori bawaan tidak dapat diubah.' : 'Huruf besar, angka, garis bawah.'),
      field('Jenis waktu', type),
      h('div', { class: 'field' }, fb, act, on));
    var actions = [];
    if (existing && !existing.IsSystem) actions.push(deleteAction('Hapus', function () { return TI.repo.remove('categories', existing.CategoryID); }));
    actions.push({ label: existing ? 'Simpan' : 'Tambah kategori', kind: 'primary', onClick: function () {
      clearErrors(content);
      if (!name.value.trim()) return setError(name, 'Nama wajib diisi.');
      var cd = code.value.trim().toUpperCase();
      if (!/^[A-Z0-9_]{1,32}$/.test(cd)) return setError(code, 'Gunakan huruf besar, angka, atau garis bawah.');
      var dup = TI.repo.list('categories').some(function (x) { return x.Code === cd && (!existing || x.CategoryID !== existing.CategoryID); });
      if (dup) return setError(code, 'Kode sudah dipakai kategori lain.');
      var rec = Object.assign({}, existing || {}, {
        Name: name.value.trim(), Code: cd, Color: color.value.toUpperCase(), Type: type.value,
        FutureBuilding: fb.input.checked, CountsActive: act.input.checked, Active: on.input.checked,
        IsSystem: !!c.IsSystem, SortOrder: existing ? existing.SortOrder : 200
      });
      return TI.repo.save('categories', rec).then(function () { TI.ui.toast('Kategori disimpan'); });
    } });
    return TI.ui.sheet({ title: existing ? 'Edit kategori' : 'Kategori baru', content: content, actions: actions });
  }

  // ---------------------------------------------------------------- time budget
  function budgetForm(existing, presetCategoryId) {
    var b = Object.assign({ CategoryID: presetCategoryId || '', WeeklyTargetMinutes: 300, Active: true }, existing || {});
    var used = {};
    TI.repo.list('timeBudgets').forEach(function (x) { if (x.Active && (!existing || x.TimeBudgetID !== existing.TimeBudgetID)) used[x.CategoryID] = true; });
    var opts = categoryOptions(b.CategoryID).filter(function (o) { return !used[o.value]; });
    if (!opts.length) { TI.ui.alertInfo('Semua kategori sudah punya target', 'Ubah target yang ada untuk menyesuaikannya.'); return null; }
    var cat = select(opts, b.CategoryID || opts[0].value);
    var hours = input({ type: 'number', inputmode: 'numeric', min: '0', max: '168', value: String(Math.floor(b.WeeklyTargetMinutes / 60)) });
    var mins = input({ type: 'number', inputmode: 'numeric', min: '0', max: '59', step: '5', value: String(b.WeeklyTargetMinutes % 60) });
    var active = switchRow('Aktif', b.Active);
    var content = h('div', null,
      field('Kategori', cat),
      h('div', { class: 'field-row' }, field('Jam per minggu', hours), field('Menit', mins)),
      h('p', { class: 'hint small muted', style: { marginTop: '10px' }, text: 'Target bersifat fleksibel. Sesuaikan dengan kondisi dan prioritasmu sendiri.' }),
      existing ? h('div', { class: 'field' }, active) : null);
    var actions = [];
    if (existing) actions.push(deleteAction('Hapus', function () { return TI.repo.remove('timeBudgets', existing.TimeBudgetID); }));
    actions.push({ label: 'Simpan target', kind: 'primary', onClick: function () {
      clearErrors(content);
      var hh = Number(hours.value || 0), mm = Number(mins.value || 0);
      if (!isFinite(hh) || hh < 0 || hh > 168 || Math.floor(hh) !== hh) return setError(hours, '0–168 jam.');
      if (!isFinite(mm) || mm < 0 || mm > 59 || Math.floor(mm) !== mm) return setError(mins, '0–59 menit.');
      var total = hh * 60 + mm;
      if (total > 10080) return setError(hours, 'Maksimal 168 jam per minggu.');
      var rec = Object.assign({}, existing || {}, { CategoryID: cat.value, WeeklyTargetMinutes: total, Active: existing ? active.input.checked : true });
      return TI.repo.save('timeBudgets', rec).then(function () { TI.ui.toast('Target disimpan'); });
    } });
    return TI.ui.sheet({ title: existing ? 'Edit target mingguan' : 'Target mingguan', content: content, actions: actions });
  }

  TI.forms = {
    PRIORITY_LABEL: PRIORITY_LABEL, TASK_STATUS: TASK_STATUS, GOAL_STATUS: GOAL_STATUS, CAT_TYPES: CAT_TYPES,
    field: field, input: input, textarea: textarea, select: select, switchRow: switchRow, setError: setError, clearErrors: clearErrors,
    categoryOptions: categoryOptions, goalOptions: goalOptions, taskOptions: taskOptions, categoryByCode: categoryByCode, defaultCategoryId: defaultCategoryId,
    task: taskForm, setTaskDone: setTaskDone, timeEntry: timeEntryForm, goal: goalForm, habit: habitForm, category: categoryForm, budget: budgetForm
  };
})();
