/**
 * Mytime — db.js
 * Wrapper Promise untuk IndexedDB. Satu object store per entitas + queue, conflicts, meta.
 * PIN tidak pernah disimpan di sini.
 */
(function () {
  'use strict';
  var TI = window.TI = window.TI || {};

  /** Nama entitas (sama dengan API) → primary key. */
  var ENTITIES = {
    categories: 'CategoryID',
    tasks: 'TaskID',
    timeEntries: 'TimeEntryID',
    goals: 'GoalID',
    timeBudgets: 'TimeBudgetID',
    habits: 'HabitID',
    habitLogs: 'HabitLogID',
    focusSessions: 'FocusSessionID',
    journal: 'JournalID',
    dailySnapshots: 'SnapshotID',
    weeklySnapshots: 'SnapshotID',
    settings: 'Key'
  };

  var DB_NAME = 'time-investment';
  var DB_VERSION = 1;
  var dbPromise = null;

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) { reject(new Error('Browser ini tidak mendukung IndexedDB.')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        Object.keys(ENTITIES).forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: ENTITIES[name] });
        });
        if (!db.objectStoreNames.contains('queue')) {
          var q = db.createObjectStore('queue', { keyPath: 'opId' });
          q.createIndex('key', 'key', { unique: false });
          q.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('conflicts')) db.createObjectStore('conflicts', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); };
        resolve(db);
      };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('Database lokal sedang dipakai tab lain. Tutup tab lain lalu muat ulang.')); };
    });
    return dbPromise;
  }

  function withStore(stores, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(stores, mode);
        var result;
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Transaksi dibatalkan')); };
        var r = fn(tx);
        if (r && typeof r.then === 'function') r.then(function (v) { result = v; }, reject);
        else result = r;
      });
    });
  }

  function get(store, key) {
    return open().then(function (db) { return reqToPromise(db.transaction(store).objectStore(store).get(key)); });
  }
  function getAll(store) {
    return open().then(function (db) { return reqToPromise(db.transaction(store).objectStore(store).getAll()); });
  }
  function getAllByIndex(store, index, value) {
    return open().then(function (db) {
      return reqToPromise(db.transaction(store).objectStore(store).index(index).getAll(value));
    });
  }
  function put(store, value) {
    return withStore([store], 'readwrite', function (tx) { tx.objectStore(store).put(value); });
  }
  function bulkPut(store, values) {
    if (!values.length) return Promise.resolve();
    return withStore([store], 'readwrite', function (tx) {
      var s = tx.objectStore(store);
      values.forEach(function (v) { s.put(v); });
    });
  }
  function del(store, key) {
    return withStore([store], 'readwrite', function (tx) { tx.objectStore(store).delete(key); });
  }
  function clear(store) {
    return withStore([store], 'readwrite', function (tx) { tx.objectStore(store).clear(); });
  }
  function count(store) {
    return open().then(function (db) { return reqToPromise(db.transaction(store).objectStore(store).count()); });
  }

  function getMeta(k, fallback) {
    return get('meta', k).then(function (row) { return row ? row.v : fallback; });
  }
  function setMeta(k, v) { return put('meta', { k: k, v: v }); }
  function delMeta(k) { return del('meta', k); }

  /** Hapus semua data lokal (tidak menyentuh server). */
  function clearAll() {
    var stores = Object.keys(ENTITIES).concat(['queue', 'conflicts', 'meta']);
    return withStore(stores, 'readwrite', function (tx) {
      stores.forEach(function (s) { tx.objectStore(s).clear(); });
    });
  }

  TI.ENTITIES = ENTITIES;
  TI.db = {
    open: open, withStore: withStore, get: get, getAll: getAll, getAllByIndex: getAllByIndex, put: put, bulkPut: bulkPut,
    del: del, clear: clear, count: count, getMeta: getMeta, setMeta: setMeta, delMeta: delMeta, clearAll: clearAll,
    reqToPromise: reqToPromise
  };
})();
