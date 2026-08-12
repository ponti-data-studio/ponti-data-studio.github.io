/**
 * db.js - Lapisan akses IndexedDB
 * Semua operasi CRUD utama aplikasi wajib melalui modul ini.
 */

const DB = (() => {
  const DB_NAME = 'pos_kasir_db';
  const DB_VERSION = 1;

  const STORES = {
    users: 'users',
    products: 'products',
    categories: 'categories',
    customers: 'customers',
    transactions: 'transactions',
    transaction_items: 'transaction_items',
    stock_movements: 'stock_movements',
    expenses: 'expenses',
    settings: 'settings',
    app_state: 'app_state'
  };

  let dbInstance = null;
  let openPromise = null;

  function isIndexedDBSupported() {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  function openDB() {
    if (openPromise) return openPromise;

    openPromise = new Promise((resolve, reject) => {
      if (!isIndexedDBSupported()) {
        reject(new Error('IndexedDB tidak didukung oleh browser ini.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.users)) {
          const store = db.createObjectStore(STORES.users, { keyPath: 'id', autoIncrement: true });
          store.createIndex('username', 'username', { unique: true });
        }

        if (!db.objectStoreNames.contains(STORES.categories)) {
          const store = db.createObjectStore(STORES.categories, { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.products)) {
          const store = db.createObjectStore(STORES.products, { keyPath: 'id', autoIncrement: true });
          store.createIndex('sku', 'sku', { unique: true });
          store.createIndex('barcode', 'barcode', { unique: false });
          store.createIndex('categoryId', 'categoryId', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('isGuestData', 'isGuestData', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.customers)) {
          const store = db.createObjectStore(STORES.customers, { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('phone', 'phone', { unique: false });
          store.createIndex('isGuestData', 'isGuestData', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.transactions)) {
          const store = db.createObjectStore(STORES.transactions, { keyPath: 'id', autoIncrement: true });
          store.createIndex('transactionNumber', 'transactionNumber', { unique: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('cashierId', 'cashierId', { unique: false });
          store.createIndex('customerId', 'customerId', { unique: false });
          store.createIndex('paymentMethod', 'paymentMethod', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('isGuestData', 'isGuestData', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.transaction_items)) {
          const store = db.createObjectStore(STORES.transaction_items, { keyPath: 'id', autoIncrement: true });
          store.createIndex('transactionId', 'transactionId', { unique: false });
          store.createIndex('productId', 'productId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.stock_movements)) {
          const store = db.createObjectStore(STORES.stock_movements, { keyPath: 'id', autoIncrement: true });
          store.createIndex('productId', 'productId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.expenses)) {
          const store = db.createObjectStore(STORES.expenses, { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('isGuestData', 'isGuestData', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.app_state)) {
          db.createObjectStore(STORES.app_state, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        dbInstance.onversionchange = () => {
          dbInstance.close();
        };
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.error('Gagal membuka IndexedDB:', event.target.error);
        reject(event.target.error);
      };

      request.onblocked = () => {
        console.error('Pembukaan IndexedDB terhalang oleh koneksi lain.');
      };
    });

    return openPromise;
  }

  async function getStore(storeName, mode = 'readonly') {
    const db = await openDB();
    const tx = db.transaction(storeName, mode);
    return { tx, store: tx.objectStore(storeName) };
  }

  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function promisifyTx(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaksi database dibatalkan.'));
    });
  }

  async function add(storeName, data) {
    if (!storeName || typeof data !== 'object' || data === null) {
      throw new Error('Data tidak valid untuk operasi add.');
    }
    const { tx, store } = await getStore(storeName, 'readwrite');
    const req = store.add(data);
    const result = await promisifyRequest(req);
    await promisifyTx(tx);
    return result;
  }

  async function put(storeName, data) {
    if (!storeName || typeof data !== 'object' || data === null) {
      throw new Error('Data tidak valid untuk operasi put.');
    }
    const { tx, store } = await getStore(storeName, 'readwrite');
    const req = store.put(data);
    const result = await promisifyRequest(req);
    await promisifyTx(tx);
    return result;
  }

  async function get(storeName, key) {
    if (key === undefined || key === null) return null;
    const { store } = await getStore(storeName, 'readonly');
    const req = store.get(key);
    const result = await promisifyRequest(req);
    return result === undefined ? null : result;
  }

  async function getAll(storeName) {
    const { store } = await getStore(storeName, 'readonly');
    const req = store.getAll();
    const result = await promisifyRequest(req);
    return Array.isArray(result) ? result : [];
  }

  async function getAllByIndex(storeName, indexName, value) {
    const { store } = await getStore(storeName, 'readonly');
    if (!store.indexNames.contains(indexName)) {
      console.error(`Index ${indexName} tidak ditemukan pada store ${storeName}`);
      return [];
    }
    const index = store.index(indexName);
    const req = index.getAll(value);
    const result = await promisifyRequest(req);
    return Array.isArray(result) ? result : [];
  }

  async function remove(storeName, key) {
    const { tx, store } = await getStore(storeName, 'readwrite');
    const req = store.delete(key);
    await promisifyRequest(req);
    await promisifyTx(tx);
    return true;
  }

  async function clearStore(storeName) {
    const { tx, store } = await getStore(storeName, 'readwrite');
    const req = store.clear();
    await promisifyRequest(req);
    await promisifyTx(tx);
    return true;
  }

  async function count(storeName) {
    const { store } = await getStore(storeName, 'readonly');
    const req = store.count();
    return promisifyRequest(req);
  }

  async function checkUnique(storeName, indexName, value, excludeId) {
    if (value === undefined || value === null || value === '') return true;
    try {
      const rows = await getAllByIndex(storeName, indexName, value);
      return rows.every((row) => String(row.id) === String(excludeId));
    } catch (err) {
      console.error('checkUnique error:', err);
      return true;
    }
  }

  async function exportAll() {
    const data = {};
    for (const storeName of Object.values(STORES)) {
      try {
        data[storeName] = await getAll(storeName);
      } catch (err) {
        console.error(`Gagal export store ${storeName}:`, err);
        data[storeName] = [];
      }
    }
    data.__meta = {
      exportedAt: new Date().toISOString(),
      version: DB_VERSION,
      app: 'POS Kasir'
    };
    return data;
  }

  async function importAll(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('File backup tidak valid.');
    }
    for (const storeName of Object.values(STORES)) {
      if (!Array.isArray(data[storeName])) continue;
      await clearStore(storeName);
      const db = await openDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const row of data[storeName]) {
        store.put(row);
      }
      await promisifyTx(tx);
    }
    return true;
  }

  return {
    STORES,
    openDB,
    add,
    put,
    get,
    getAll,
    getAllByIndex,
    remove,
    clearStore,
    count,
    checkUnique,
    exportAll,
    importAll,
    isIndexedDBSupported
  };
})();
