/**
 * DataService
 * ------------------------------------------------------------------
 * Abstraction layer between the UI and the storage engine.
 *
 * DEMO MODE NOTICE:
 * This implementation persists data in the browser's IndexedDB so the
 * app works fully offline with no backend. In a production build,
 * the methods below (get / list / add / update / remove) would call
 * a real backend (REST API, Firebase, Supabase, Google Apps Script,
 * etc). Because the UI only ever talks to `DataService`, swapping the
 * storage engine later does NOT require rewriting any screen.
 * ------------------------------------------------------------------
 */
const DataService = (() => {
  const DB_NAME = 'ponti_erp_db';
  const DB_VERSION = 1;
  let dbPromise = null;

  const STORES = [
    'companyProfile', 'branches', 'employees', 'departments', 'businessUnits',
    'customers', 'quotations', 'salesOrders', 'invoices', 'payments',
    'suppliers', 'purchaseRequests', 'purchaseOrders', 'goodsReceipts', 'supplierInvoices',
    'products', 'categories', 'warehouses', 'stock', 'stockMovements', 'stockOpname', 'stockAdjustments',
    'incomes', 'expenses', 'cashBank',
    'attendance', 'leaves', 'overtime',
    'leads', 'opportunities', 'followups',
    'users', 'activityLog'
  ];

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach((store) => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  function tx(store, mode) {
    return openDb().then((db) => db.transaction(store, mode).objectStore(store));
  }

  function uid(prefix) {
    return `${prefix ? prefix + '-' : ''}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  async function list(store) {
    const os = await tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const req = os.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function get(store, id) {
    const os = await tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const req = os.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function add(store, record, prefix) {
    const rec = { id: record.id || uid(prefix), createdAt: nowIso(), updatedAt: nowIso(), ...record };
    rec.id = record.id || rec.id;
    const os = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = os.put(rec);
      req.onsuccess = () => resolve(rec);
      req.onerror = () => reject(req.error);
    });
  }

  async function update(store, id, changes) {
    const existing = await get(store, id);
    if (!existing) throw new Error('Record not found');
    const merged = { ...existing, ...changes, id, updatedAt: nowIso() };
    const os = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = os.put(merged);
      req.onsuccess = () => resolve(merged);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(store, id) {
    const os = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = os.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearAll() {
    const db = await openDb();
    const names = Array.from(db.objectStoreNames);
    await Promise.all(names.map((name) => new Promise((resolve, reject) => {
      const req = db.transaction(name, 'readwrite').objectStore(name).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    })));
  }

  function nowIso() {
    return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  }

  async function isSeeded() {
    const companies = await list('companyProfile');
    return companies.length > 0;
  }

  async function logActivity(text, icon) {
    await add('activityLog', { text, icon: icon || 'bi-check2-circle', ts: nowIso() }, 'act');
  }

  async function seedIfNeeded(force) {
    if (!force && await isSeeded()) return;
    if (force) await clearAll();

    await add('companyProfile', {
      id: 'comp-1',
      name: 'PT Ponti Digital Nusantara',
      legalForm: 'Perseroan Terbatas',
      industry: 'Distribusi & Teknologi',
      npwp: '01.234.567.8-707.000',
      address: 'Jl. Gajah Mada No. 88, Pontianak, Kalimantan Barat',
      phone: '(0561) 745-100',
      email: 'info@pontidigital.co.id',
      founded: '2016-03-14',
    });

    const branches = [
      { name: 'Cabang Pontianak', city: 'Pontianak', manager: 'Andi Saputra', status: 'Aktif', employees: 42 },
      { name: 'Cabang Singkawang', city: 'Singkawang', manager: 'Rina Wulandari', status: 'Aktif', employees: 18 },
      { name: 'Cabang Jakarta', city: 'Jakarta', manager: 'Budi Hartono', status: 'Aktif', employees: 27 },
    ];
    for (const b of branches) await add('branches', b, 'BR');

    const departments = [
      { name: 'Sales & Marketing', head: 'Andi Saputra', totalStaff: 14 },
      { name: 'Purchasing', head: 'Sri Mulyani', totalStaff: 6 },
      { name: 'Finance & Accounting', head: 'Dewi Anggraini', totalStaff: 8 },
      { name: 'Warehouse & Logistics', head: 'Joko Prasetyo', totalStaff: 12 },
      { name: 'Human Resources', head: 'Maya Kusuma', totalStaff: 5 },
    ];
    for (const d of departments) await add('departments', d, 'DEPT');

    const businessUnits = [
      { name: 'IT & Office Equipment', description: 'Penjualan perangkat kantor dan IT' },
      { name: 'Retail Technology', description: 'POS, barcode, dan solusi retail' },
    ];
    for (const u of businessUnits) await add('businessUnits', u, 'BU');

    const employees = [
      { name: 'Andi Saputra', position: 'Sales Manager', department: 'Sales & Marketing', branch: 'Cabang Pontianak', email: 'andi.saputra@pontidigital.co.id', phone: '0812-1234-5601', joinDate: '2018-02-01', status: 'Aktif' },
      { name: 'Budi Hartono', position: 'Purchasing Staff', department: 'Purchasing', branch: 'Cabang Jakarta', email: 'budi.hartono@pontidigital.co.id', phone: '0812-1234-5602', joinDate: '2019-06-11', status: 'Aktif' },
      { name: 'Dewi Anggraini', position: 'Finance Manager', department: 'Finance & Accounting', branch: 'Cabang Pontianak', email: 'dewi.anggraini@pontidigital.co.id', phone: '0812-1234-5603', joinDate: '2017-09-20', status: 'Aktif' },
      { name: 'Joko Prasetyo', position: 'Warehouse Supervisor', department: 'Warehouse & Logistics', branch: 'Cabang Singkawang', email: 'joko.prasetyo@pontidigital.co.id', phone: '0812-1234-5604', joinDate: '2020-01-15', status: 'Aktif' },
      { name: 'Maya Kusuma', position: 'HR Manager', department: 'Human Resources', branch: 'Cabang Pontianak', email: 'maya.kusuma@pontidigital.co.id', phone: '0812-1234-5605', joinDate: '2016-05-03', status: 'Aktif' },
      { name: 'Rina Wulandari', position: 'Branch Manager', department: 'Sales & Marketing', branch: 'Cabang Singkawang', email: 'rina.wulandari@pontidigital.co.id', phone: '0812-1234-5606', joinDate: '2018-11-27', status: 'Aktif' },
      { name: 'Sri Mulyani', position: 'Purchasing Manager', department: 'Purchasing', branch: 'Cabang Pontianak', email: 'sri.mulyani@pontidigital.co.id', phone: '0812-1234-5607', joinDate: '2017-03-08', status: 'Cuti' },
    ];
    for (const e of employees) await add('employees', e, 'EMP');

    const categories = [
      { name: 'Laptop & Komputer' }, { name: 'Printer & Scanner' },
      { name: 'Office Supplies' }, { name: 'POS & Retail Hardware' },
    ];
    for (const c of categories) await add('categories', c, 'CAT');

    const warehouses = [
      { name: 'Gudang Pusat Pontianak', location: 'Pontianak', capacity: '5.000 unit' },
      { name: 'Gudang Jakarta', location: 'Jakarta', capacity: '2.500 unit' },
    ];
    for (const w of warehouses) await add('warehouses', w, 'WH');

    const products = [
      { sku: 'LAP-001', name: 'Laptop Business Pro', category: 'Laptop & Komputer', unit: 'Unit', price: 12500000, cost: 10200000, stockQty: 34, minStock: 10, warehouse: 'Gudang Pusat Pontianak' },
      { sku: 'PRN-002', name: 'Printer Office X', category: 'Printer & Scanner', unit: 'Unit', price: 2350000, cost: 1850000, stockQty: 6, minStock: 8, warehouse: 'Gudang Pusat Pontianak' },
      { sku: 'PPR-003', name: 'Paper A4 (Rim)', category: 'Office Supplies', unit: 'Rim', price: 52000, cost: 41000, stockQty: 480, minStock: 100, warehouse: 'Gudang Jakarta' },
      { sku: 'BCS-004', name: 'Barcode Scanner', category: 'POS & Retail Hardware', unit: 'Unit', price: 875000, cost: 610000, stockQty: 0, minStock: 5, warehouse: 'Gudang Pusat Pontianak' },
      { sku: 'POS-005', name: 'POS Terminal', category: 'POS & Retail Hardware', unit: 'Unit', price: 6450000, cost: 5100000, stockQty: 12, minStock: 5, warehouse: 'Gudang Jakarta' },
      { sku: 'MSE-006', name: 'Wireless Mouse', category: 'Laptop & Komputer', unit: 'Unit', price: 145000, cost: 95000, stockQty: 3, minStock: 15, warehouse: 'Gudang Pusat Pontianak' },
    ];
    for (const p of products) await add('products', p, 'PRD');

    const customers = [
      { name: 'CV Maju Bersama', contact: 'Hendra Wijaya', phone: '0813-1111-2001', email: 'hendra@majubersama.co.id', city: 'Pontianak', segment: 'Corporate', status: 'Aktif' },
      { name: 'PT Nusantara Retail', contact: 'Lisa Permata', phone: '0813-1111-2002', email: 'lisa@nusantararetail.co.id', city: 'Jakarta', segment: 'Retail Chain', status: 'Aktif' },
      { name: 'Toko Sejahtera', contact: 'Ahmad Fauzi', phone: '0813-1111-2003', email: 'ahmad@tokosejahtera.id', city: 'Singkawang', segment: 'UMKM', status: 'Aktif' },
      { name: 'CV Berkah Jaya', contact: 'Siti Aminah', phone: '0813-1111-2004', email: 'siti@berkahjaya.id', city: 'Pontianak', segment: 'UMKM', status: 'Non-Aktif' },
    ];
    for (const c of customers) await add('customers', c, 'CUST');

    const quotations = [
      { number: 'QUO-2026-011', customer: 'CV Maju Bersama', date: '2026-08-02', total: 24500000, status: 'Approved' },
      { number: 'QUO-2026-012', customer: 'PT Nusantara Retail', date: '2026-08-10', total: 62450000, status: 'Pending' },
      { number: 'QUO-2026-013', customer: 'Toko Sejahtera', date: '2026-08-18', total: 5200000, status: 'Draft' },
    ];
    for (const q of quotations) await add('quotations', q, 'QUO');

    const salesOrders = [
      { number: 'SO-2026-001', customer: 'CV Maju Bersama', date: '2026-08-03', total: 24500000, status: 'Completed' },
      { number: 'SO-2026-002', customer: 'PT Nusantara Retail', date: '2026-08-12', total: 62450000, status: 'Approved' },
      { number: 'SO-2026-003', customer: 'Toko Sejahtera', date: '2026-08-20', total: 5200000, status: 'Pending' },
      { number: 'SO-2026-004', customer: 'CV Maju Bersama', date: '2026-08-28', total: 13750000, status: 'Draft' },
    ];
    for (const s of salesOrders) await add('salesOrders', s, 'SO');

    const invoices = [
      { number: 'INV-2026-040', customer: 'CV Maju Bersama', date: '2026-08-04', dueDate: '2026-08-18', total: 24500000, paid: 24500000, status: 'Completed' },
      { number: 'INV-2026-041', customer: 'PT Nusantara Retail', date: '2026-08-13', dueDate: '2026-08-27', total: 62450000, paid: 30000000, status: 'Pending' },
      { number: 'INV-2026-042', customer: 'Toko Sejahtera', date: '2026-08-21', dueDate: '2026-09-04', total: 5200000, paid: 5200000, status: 'Completed' },
      { number: 'INV-2026-043', customer: 'CV Berkah Jaya', date: '2026-07-15', dueDate: '2026-07-29', total: 8300000, paid: 0, status: 'Cancelled' },
    ];
    for (const i of invoices) await add('invoices', i, 'INV');

    const payments = [
      { number: 'PAY-2026-101', invoice: 'INV-2026-040', date: '2026-08-06', amount: 24500000, method: 'Transfer Bank' },
      { number: 'PAY-2026-102', invoice: 'INV-2026-041', date: '2026-08-15', amount: 30000000, method: 'Transfer Bank' },
      { number: 'PAY-2026-103', invoice: 'INV-2026-042', date: '2026-08-22', amount: 5200000, method: 'Cash' },
    ];
    for (const p of payments) await add('payments', p, 'PAY');

    const suppliers = [
      { name: 'PT Digital Supply', contact: 'Rudi Setiawan', phone: '0821-2222-3001', email: 'rudi@digitalsupply.co.id', city: 'Jakarta', category: 'Elektronik' },
      { name: 'CV Sumber Makmur', contact: 'Fitri Handayani', phone: '0821-2222-3002', email: 'fitri@sumbermakmur.id', city: 'Pontianak', category: 'Office Supplies' },
    ];
    for (const s of suppliers) await add('suppliers', s, 'SUP');

    const purchaseRequests = [
      { number: 'PR-2026-018', requestedBy: 'Joko Prasetyo', date: '2026-08-01', items: 'Laptop Business Pro x10', status: 'Approved' },
      { number: 'PR-2026-019', requestedBy: 'Joko Prasetyo', date: '2026-08-14', items: 'Printer Office X x5', status: 'Pending' },
    ];
    for (const p of purchaseRequests) await add('purchaseRequests', p, 'PR');

    const purchaseOrders = [
      { number: 'PO-2026-023', supplier: 'PT Digital Supply', date: '2026-08-05', total: 102000000, status: 'Approved' },
      { number: 'PO-2026-024', supplier: 'CV Sumber Makmur', date: '2026-08-19', total: 19680000, status: 'Pending' },
    ];
    for (const p of purchaseOrders) await add('purchaseOrders', p, 'PO');

    const goodsReceipts = [
      { number: 'GR-2026-030', po: 'PO-2026-023', date: '2026-08-09', status: 'Completed' },
    ];
    for (const g of goodsReceipts) await add('goodsReceipts', g, 'GR');

    const supplierInvoices = [
      { number: 'SINV-2026-055', supplier: 'PT Digital Supply', date: '2026-08-10', total: 102000000, status: 'Pending' },
    ];
    for (const s of supplierInvoices) await add('supplierInvoices', s, 'SINV');

    const stockMovements = [
      { product: 'Laptop Business Pro', type: 'Masuk', qty: 10, date: '2026-08-09', reference: 'GR-2026-030' },
      { product: 'Barcode Scanner', type: 'Keluar', qty: 5, date: '2026-08-11', reference: 'SO-2026-002' },
      { product: 'Wireless Mouse', type: 'Keluar', qty: 20, date: '2026-08-15', reference: 'SO-2026-003' },
    ];
    for (const m of stockMovements) await add('stockMovements', m, 'MOV');

    const stockOpname = [
      { warehouse: 'Gudang Pusat Pontianak', date: '2026-07-31', conductedBy: 'Joko Prasetyo', status: 'Selesai', variance: -2 },
    ];
    for (const s of stockOpname) await add('stockOpname', s, 'OPN');

    const stockAdjustments = [
      { product: 'Wireless Mouse', date: '2026-08-01', qtyChange: -2, reason: 'Barang rusak' },
    ];
    for (const s of stockAdjustments) await add('stockAdjustments', s, 'ADJ');

    const incomes = [
      { source: 'Penjualan Produk', date: '2026-08-31', amount: 485250000, category: 'Sales' },
    ];
    for (const i of incomes) await add('incomes', i, 'INC');

    const expenses = [
      { description: 'Sewa Gudang', date: '2026-08-05', amount: 18000000, category: 'Operasional' },
      { description: 'Gaji Karyawan', date: '2026-08-28', amount: 210000000, category: 'Payroll' },
      { description: 'Listrik & Utilitas', date: '2026-08-10', amount: 9750000, category: 'Operasional' },
    ];
    for (const e of expenses) await add('expenses', e, 'EXP');

    const cashBank = [
      { account: 'Kas Utama', type: 'Cash', balance: 45000000 },
      { account: 'BCA - PT Ponti Digital', type: 'Bank', balance: 218750000 },
      { account: 'Mandiri - Operasional', type: 'Bank', balance: 76300000 },
    ];
    for (const c of cashBank) await add('cashBank', c, 'CB');

    const today = new Date();
    const attendance = [];
    const names = ['Andi Saputra', 'Budi Hartono', 'Dewi Anggraini', 'Joko Prasetyo', 'Maya Kusuma'];
    const statusesAtt = ['Hadir', 'Hadir', 'Hadir', 'Terlambat', 'Hadir'];
    names.forEach((n, idx) => {
      attendance.push({ employee: n, date: '2026-09-08', checkIn: idx === 3 ? '08:35' : '08:02', checkOut: '17:05', status: statusesAtt[idx] });
    });
    for (const a of attendance) await add('attendance', a, 'ATT');

    const leaves = [
      { employee: 'Sri Mulyani', type: 'Cuti Tahunan', start: '2026-09-05', end: '2026-09-12', status: 'Approved' },
      { employee: 'Rina Wulandari', type: 'Sakit', start: '2026-08-20', end: '2026-08-21', status: 'Approved' },
    ];
    for (const l of leaves) await add('leaves', l, 'LV');

    const overtime = [
      { employee: 'Joko Prasetyo', date: '2026-08-30', hours: 3, reason: 'Stock opname akhir bulan' },
    ];
    for (const o of overtime) await add('overtime', o, 'OT');

    const leads = [
      { name: 'Yayasan Cahaya Ilmu', contact: 'Pak Surya', stage: 'Lead', value: 15000000, owner: 'Andi Saputra' },
      { name: 'Koperasi Sejahtera Bersama', contact: 'Bu Nita', stage: 'Contacted', value: 22000000, owner: 'Rina Wulandari' },
      { name: 'PT Cipta Boga', contact: 'Pak Herman', stage: 'Negotiation', value: 48500000, owner: 'Andi Saputra' },
      { name: 'CV Anugerah Teknik', contact: 'Bu Ratna', stage: 'Proposal', value: 31000000, owner: 'Andi Saputra' },
      { name: 'PT Nusantara Retail', contact: 'Lisa Permata', stage: 'Won', value: 62450000, owner: 'Rina Wulandari' },
      { name: 'Toko Bintang Terang', contact: 'Pak Agus', stage: 'Lost', value: 9000000, owner: 'Andi Saputra' },
    ];
    for (const l of leads) await add('leads', l, 'LEAD');

    const users = [
      { username: 'demo', name: 'Akun Demo', role: 'Owner', email: 'demo@pontidata.id' },
      { username: 'manager', name: 'Rina Wulandari', role: 'Manager', email: 'rina@pontidigital.co.id' },
      { username: 'finance', name: 'Dewi Anggraini', role: 'Finance', email: 'dewi@pontidigital.co.id' },
      { username: 'hr', name: 'Maya Kusuma', role: 'HR', email: 'maya@pontidigital.co.id' },
    ];
    for (const u of users) await add('users', u, 'USR');

    const activities = [
      { text: 'Andi membuat Sales Order SO-2026-001', icon: 'bi-cart-check' },
      { text: 'Budi membuat Purchase Order PO-2026-023', icon: 'bi-truck' },
      { text: 'Cabang Pontianak melakukan stock opname', icon: 'bi-boxes' },
      { text: 'Invoice INV-2026-042 telah dibayar', icon: 'bi-cash-coin' },
    ];
    for (const a of activities) await add('activityLog', { ...a, ts: nowIso() }, 'act');
  }

  return {
    list, get, add, update, remove, clearAll, seedIfNeeded, isSeeded, uid, nowIso, logActivity,
  };
})();
