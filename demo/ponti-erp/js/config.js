/**
 * Central configuration for every module / entity.
 * The generic CRUD engine (see crud.js) reads this config to render
 * list tables, search/filter bars, and add/edit forms without any
 * per-module boilerplate.
 */
const STATUS_OPTIONS = ['Draft', 'Pending', 'Approved', 'Completed', 'Cancelled'];

const ENTITIES = {
  branches: {
    title: 'Cabang (Branches)', icon: 'bi-diagram-3', addLabel: 'Tambah Cabang',
    columns: [
      { key: 'name', label: 'Nama Cabang' }, { key: 'city', label: 'Kota' },
      { key: 'manager', label: 'Manager' }, { key: 'employees', label: 'Jumlah Staff' },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'name', label: 'Nama Cabang', type: 'text', required: true },
      { key: 'city', label: 'Kota', type: 'text', required: true },
      { key: 'manager', label: 'Manager', type: 'text', required: true },
      { key: 'employees', label: 'Jumlah Staff', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Non-Aktif'], required: true },
    ],
    search: ['name', 'city', 'manager'],
  },
  employees: {
    title: 'Karyawan (Employees)', icon: 'bi-people', addLabel: 'Tambah Karyawan',
    columns: [
      { key: 'name', label: 'Nama' }, { key: 'position', label: 'Jabatan' },
      { key: 'department', label: 'Departemen' }, { key: 'branch', label: 'Cabang' },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'name', label: 'Nama Lengkap', type: 'text', required: true },
      { key: 'position', label: 'Jabatan', type: 'text', required: true },
      { key: 'department', label: 'Departemen', type: 'text', required: true },
      { key: 'branch', label: 'Cabang', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'phone', label: 'No. Telepon', type: 'text' },
      { key: 'joinDate', label: 'Tanggal Bergabung', type: 'date', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Cuti', 'Non-Aktif'], required: true },
    ],
    search: ['name', 'position', 'department', 'branch'],
  },
  departments: {
    title: 'Departemen', icon: 'bi-building', addLabel: 'Tambah Departemen',
    columns: [{ key: 'name', label: 'Nama Departemen' }, { key: 'head', label: 'Kepala Departemen' }, { key: 'totalStaff', label: 'Total Staff' }],
    fields: [
      { key: 'name', label: 'Nama Departemen', type: 'text', required: true },
      { key: 'head', label: 'Kepala Departemen', type: 'text', required: true },
      { key: 'totalStaff', label: 'Total Staff', type: 'number' },
    ],
    search: ['name', 'head'],
  },
  businessUnits: {
    title: 'Unit Bisnis', icon: 'bi-briefcase', addLabel: 'Tambah Unit Bisnis',
    columns: [{ key: 'name', label: 'Nama Unit' }, { key: 'description', label: 'Deskripsi' }],
    fields: [
      { key: 'name', label: 'Nama Unit', type: 'text', required: true },
      { key: 'description', label: 'Deskripsi', type: 'textarea' },
    ],
    search: ['name'],
  },

  customers: {
    title: 'Customers', icon: 'bi-person-badge', addLabel: 'Tambah Customer',
    columns: [
      { key: 'name', label: 'Nama Customer' }, { key: 'contact', label: 'Kontak' },
      { key: 'city', label: 'Kota' }, { key: 'segment', label: 'Segmen' },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'name', label: 'Nama Customer', type: 'text', required: true },
      { key: 'contact', label: 'Nama Kontak', type: 'text', required: true },
      { key: 'phone', label: 'No. Telepon', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'city', label: 'Kota', type: 'text' },
      { key: 'segment', label: 'Segmen', type: 'select', options: ['Corporate', 'Retail Chain', 'UMKM'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Non-Aktif'], required: true },
    ],
    search: ['name', 'contact', 'city'],
  },
  quotations: {
    title: 'Quotations', icon: 'bi-file-earmark-text', addLabel: 'Buat Quotation',
    columns: [
      { key: 'number', label: 'No. Quotation' }, { key: 'customer', label: 'Customer' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'total', label: 'Total', currency: true },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'number', label: 'No. Quotation', type: 'text', required: true, auto: 'QUO' },
      { key: 'customer', label: 'Customer', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'total', label: 'Total (Rp)', type: 'number', required: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: true },
    ],
    search: ['number', 'customer'],
    statusFilter: true,
  },
  salesOrders: {
    title: 'Sales Orders', icon: 'bi-cart-check', addLabel: 'Buat Sales Order',
    columns: [
      { key: 'number', label: 'No. SO' }, { key: 'customer', label: 'Customer' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'total', label: 'Total', currency: true },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'number', label: 'No. Sales Order', type: 'text', required: true, auto: 'SO' },
      { key: 'customer', label: 'Customer', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'total', label: 'Total (Rp)', type: 'number', required: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: true },
    ],
    search: ['number', 'customer'],
    statusFilter: true,
  },
  invoices: {
    title: 'Invoices', icon: 'bi-receipt', addLabel: 'Buat Invoice',
    columns: [
      { key: 'number', label: 'No. Invoice' }, { key: 'customer', label: 'Customer' },
      { key: 'dueDate', label: 'Jatuh Tempo', date: true }, { key: 'total', label: 'Total', currency: true },
      { key: 'paid', label: 'Terbayar', currency: true }, { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'number', label: 'No. Invoice', type: 'text', required: true, auto: 'INV' },
      { key: 'customer', label: 'Customer', type: 'text', required: true },
      { key: 'date', label: 'Tanggal Invoice', type: 'date', required: true },
      { key: 'dueDate', label: 'Jatuh Tempo', type: 'date', required: true },
      { key: 'total', label: 'Total (Rp)', type: 'number', required: true },
      { key: 'paid', label: 'Sudah Dibayar (Rp)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: true },
    ],
    search: ['number', 'customer'],
    statusFilter: true,
  },
  payments: {
    title: 'Payments', icon: 'bi-cash-coin', addLabel: 'Catat Pembayaran',
    columns: [
      { key: 'number', label: 'No. Pembayaran' }, { key: 'invoice', label: 'Invoice' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'amount', label: 'Jumlah', currency: true },
      { key: 'method', label: 'Metode' },
    ],
    fields: [
      { key: 'number', label: 'No. Pembayaran', type: 'text', required: true, auto: 'PAY' },
      { key: 'invoice', label: 'No. Invoice', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'amount', label: 'Jumlah (Rp)', type: 'number', required: true },
      { key: 'method', label: 'Metode', type: 'select', options: ['Cash', 'Transfer Bank', 'Kartu Kredit', 'QRIS'], required: true },
    ],
    search: ['number', 'invoice'],
  },

  suppliers: {
    title: 'Suppliers', icon: 'bi-truck', addLabel: 'Tambah Supplier',
    columns: [
      { key: 'name', label: 'Nama Supplier' }, { key: 'contact', label: 'Kontak' },
      { key: 'city', label: 'Kota' }, { key: 'category', label: 'Kategori' },
    ],
    fields: [
      { key: 'name', label: 'Nama Supplier', type: 'text', required: true },
      { key: 'contact', label: 'Nama Kontak', type: 'text', required: true },
      { key: 'phone', label: 'No. Telepon', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'city', label: 'Kota', type: 'text' },
      { key: 'category', label: 'Kategori', type: 'text' },
    ],
    search: ['name', 'contact', 'city'],
  },
  purchaseRequests: {
    title: 'Purchase Requests', icon: 'bi-file-earmark-plus', addLabel: 'Buat Purchase Request',
    columns: [
      { key: 'number', label: 'No. PR' }, { key: 'requestedBy', label: 'Diminta Oleh' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'items', label: 'Item' },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'number', label: 'No. PR', type: 'text', required: true, auto: 'PR' },
      { key: 'requestedBy', label: 'Diminta Oleh', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'items', label: 'Item Diminta', type: 'textarea', required: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: true },
    ],
    search: ['number', 'requestedBy'],
    statusFilter: true,
  },
  purchaseOrders: {
    title: 'Purchase Orders', icon: 'bi-bag-check', addLabel: 'Buat Purchase Order',
    columns: [
      { key: 'number', label: 'No. PO' }, { key: 'supplier', label: 'Supplier' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'total', label: 'Total', currency: true },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'number', label: 'No. PO', type: 'text', required: true, auto: 'PO' },
      { key: 'supplier', label: 'Supplier', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'total', label: 'Total (Rp)', type: 'number', required: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: true },
    ],
    search: ['number', 'supplier'],
    statusFilter: true,
  },
  goodsReceipts: {
    title: 'Goods Receipt', icon: 'bi-box-seam', addLabel: 'Catat Goods Receipt',
    columns: [
      { key: 'number', label: 'No. GR' }, { key: 'po', label: 'No. PO' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'number', label: 'No. GR', type: 'text', required: true, auto: 'GR' },
      { key: 'po', label: 'No. Purchase Order', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: true },
    ],
    search: ['number', 'po'],
    statusFilter: true,
  },
  supplierInvoices: {
    title: 'Supplier Invoice', icon: 'bi-file-earmark-ruled', addLabel: 'Tambah Supplier Invoice',
    columns: [
      { key: 'number', label: 'No. Invoice' }, { key: 'supplier', label: 'Supplier' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'total', label: 'Total', currency: true },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'number', label: 'No. Invoice', type: 'text', required: true, auto: 'SINV' },
      { key: 'supplier', label: 'Supplier', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'total', label: 'Total (Rp)', type: 'number', required: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: true },
    ],
    search: ['number', 'supplier'],
    statusFilter: true,
  },

  products: {
    title: 'Products', icon: 'bi-box', addLabel: 'Tambah Produk',
    columns: [
      { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Nama Produk' },
      { key: 'category', label: 'Kategori' }, { key: 'price', label: 'Harga Jual', currency: true },
      { key: 'stockQty', label: 'Stok' },
    ],
    fields: [
      { key: 'sku', label: 'SKU', type: 'text', required: true },
      { key: 'name', label: 'Nama Produk', type: 'text', required: true },
      { key: 'category', label: 'Kategori', type: 'text', required: true },
      { key: 'unit', label: 'Satuan', type: 'text', required: true },
      { key: 'price', label: 'Harga Jual (Rp)', type: 'number', required: true },
      { key: 'cost', label: 'Harga Modal (Rp)', type: 'number', required: true },
      { key: 'stockQty', label: 'Jumlah Stok', type: 'number', required: true },
      { key: 'minStock', label: 'Stok Minimum', type: 'number', required: true },
      { key: 'warehouse', label: 'Gudang', type: 'text' },
    ],
    search: ['sku', 'name', 'category'],
  },
  categories: {
    title: 'Kategori Produk', icon: 'bi-tags', addLabel: 'Tambah Kategori',
    columns: [{ key: 'name', label: 'Nama Kategori' }],
    fields: [{ key: 'name', label: 'Nama Kategori', type: 'text', required: true }],
    search: ['name'],
  },
  warehouses: {
    title: 'Gudang (Warehouses)', icon: 'bi-building-gear', addLabel: 'Tambah Gudang',
    columns: [{ key: 'name', label: 'Nama Gudang' }, { key: 'location', label: 'Lokasi' }, { key: 'capacity', label: 'Kapasitas' }],
    fields: [
      { key: 'name', label: 'Nama Gudang', type: 'text', required: true },
      { key: 'location', label: 'Lokasi', type: 'text', required: true },
      { key: 'capacity', label: 'Kapasitas', type: 'text' },
    ],
    search: ['name', 'location'],
  },
  stockMovements: {
    title: 'Stock Movement', icon: 'bi-arrow-left-right', addLabel: 'Catat Pergerakan Stok',
    columns: [
      { key: 'product', label: 'Produk' }, { key: 'type', label: 'Tipe', badge: true },
      { key: 'qty', label: 'Qty' }, { key: 'date', label: 'Tanggal', date: true }, { key: 'reference', label: 'Referensi' },
    ],
    fields: [
      { key: 'product', label: 'Produk', type: 'text', required: true },
      { key: 'type', label: 'Tipe', type: 'select', options: ['Masuk', 'Keluar'], required: true },
      { key: 'qty', label: 'Jumlah', type: 'number', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'reference', label: 'No. Referensi', type: 'text' },
    ],
    search: ['product', 'reference'],
  },
  stockOpname: {
    title: 'Stock Opname', icon: 'bi-clipboard-check', addLabel: 'Buat Stock Opname',
    columns: [
      { key: 'warehouse', label: 'Gudang' }, { key: 'date', label: 'Tanggal', date: true },
      { key: 'conductedBy', label: 'Dilakukan Oleh' }, { key: 'variance', label: 'Selisih' }, { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'warehouse', label: 'Gudang', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'conductedBy', label: 'Dilakukan Oleh', type: 'text', required: true },
      { key: 'variance', label: 'Selisih (unit)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Proses', 'Selesai'], required: true },
    ],
    search: ['warehouse', 'conductedBy'],
  },
  stockAdjustments: {
    title: 'Stock Adjustment', icon: 'bi-sliders', addLabel: 'Buat Penyesuaian Stok',
    columns: [
      { key: 'product', label: 'Produk' }, { key: 'date', label: 'Tanggal', date: true },
      { key: 'qtyChange', label: 'Perubahan Qty' }, { key: 'reason', label: 'Alasan' },
    ],
    fields: [
      { key: 'product', label: 'Produk', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'qtyChange', label: 'Perubahan Qty (+/-)', type: 'number', required: true },
      { key: 'reason', label: 'Alasan', type: 'textarea', required: true },
    ],
    search: ['product', 'reason'],
  },

  incomes: {
    title: 'Pemasukan (Income)', icon: 'bi-graph-up-arrow', addLabel: 'Tambah Pemasukan',
    columns: [
      { key: 'source', label: 'Sumber' }, { key: 'category', label: 'Kategori' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'amount', label: 'Jumlah', currency: true },
    ],
    fields: [
      { key: 'source', label: 'Sumber Pemasukan', type: 'text', required: true },
      { key: 'category', label: 'Kategori', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'amount', label: 'Jumlah (Rp)', type: 'number', required: true },
    ],
    search: ['source', 'category'],
  },
  expenses: {
    title: 'Pengeluaran (Expenses)', icon: 'bi-graph-down-arrow', addLabel: 'Tambah Pengeluaran',
    columns: [
      { key: 'description', label: 'Deskripsi' }, { key: 'category', label: 'Kategori' },
      { key: 'date', label: 'Tanggal', date: true }, { key: 'amount', label: 'Jumlah', currency: true },
    ],
    fields: [
      { key: 'description', label: 'Deskripsi', type: 'text', required: true },
      { key: 'category', label: 'Kategori', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'amount', label: 'Jumlah (Rp)', type: 'number', required: true },
    ],
    search: ['description', 'category'],
  },
  cashBank: {
    title: 'Kas & Bank', icon: 'bi-bank', addLabel: 'Tambah Akun',
    columns: [{ key: 'account', label: 'Nama Akun' }, { key: 'type', label: 'Tipe' }, { key: 'balance', label: 'Saldo', currency: true }],
    fields: [
      { key: 'account', label: 'Nama Akun', type: 'text', required: true },
      { key: 'type', label: 'Tipe', type: 'select', options: ['Cash', 'Bank'], required: true },
      { key: 'balance', label: 'Saldo (Rp)', type: 'number', required: true },
    ],
    search: ['account'],
  },

  attendance: {
    title: 'Presensi (Attendance)', icon: 'bi-calendar-check', addLabel: 'Tambah Presensi',
    columns: [
      { key: 'employee', label: 'Karyawan' }, { key: 'date', label: 'Tanggal', date: true },
      { key: 'checkIn', label: 'Jam Masuk' }, { key: 'checkOut', label: 'Jam Keluar' }, { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'employee', label: 'Nama Karyawan', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'checkIn', label: 'Jam Masuk', type: 'text', placeholder: 'HH:MM' },
      { key: 'checkOut', label: 'Jam Keluar', type: 'text', placeholder: 'HH:MM' },
      { key: 'status', label: 'Status', type: 'select', options: ['Hadir', 'Terlambat', 'Absen'], required: true },
    ],
    search: ['employee'],
  },
  leaves: {
    title: 'Cuti (Leave)', icon: 'bi-airplane', addLabel: 'Ajukan Cuti',
    columns: [
      { key: 'employee', label: 'Karyawan' }, { key: 'type', label: 'Jenis Cuti' },
      { key: 'start', label: 'Mulai', date: true }, { key: 'end', label: 'Selesai', date: true }, { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'employee', label: 'Nama Karyawan', type: 'text', required: true },
      { key: 'type', label: 'Jenis Cuti', type: 'select', options: ['Cuti Tahunan', 'Sakit', 'Izin', 'Melahirkan'], required: true },
      { key: 'start', label: 'Tanggal Mulai', type: 'date', required: true },
      { key: 'end', label: 'Tanggal Selesai', type: 'date', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Cancelled'], required: true },
    ],
    search: ['employee', 'type'],
    statusFilter: true,
  },
  overtime: {
    title: 'Lembur (Overtime)', icon: 'bi-clock-history', addLabel: 'Tambah Lembur',
    columns: [
      { key: 'employee', label: 'Karyawan' }, { key: 'date', label: 'Tanggal', date: true },
      { key: 'hours', label: 'Jam Lembur' }, { key: 'reason', label: 'Keterangan' },
    ],
    fields: [
      { key: 'employee', label: 'Nama Karyawan', type: 'text', required: true },
      { key: 'date', label: 'Tanggal', type: 'date', required: true },
      { key: 'hours', label: 'Jam Lembur', type: 'number', required: true },
      { key: 'reason', label: 'Keterangan', type: 'textarea' },
    ],
    search: ['employee', 'reason'],
  },

  leads: {
    title: 'Pipeline CRM', icon: 'bi-funnel', addLabel: 'Tambah Lead',
    columns: [
      { key: 'name', label: 'Nama Lead/Customer' }, { key: 'contact', label: 'Kontak' },
      { key: 'owner', label: 'Sales' }, { key: 'value', label: 'Nilai Deal', currency: true }, { key: 'stage', label: 'Tahap', badge: true },
    ],
    fields: [
      { key: 'name', label: 'Nama Lead/Customer', type: 'text', required: true },
      { key: 'contact', label: 'Nama Kontak', type: 'text', required: true },
      { key: 'owner', label: 'Sales/Owner', type: 'text', required: true },
      { key: 'value', label: 'Nilai Deal (Rp)', type: 'number', required: true },
      { key: 'stage', label: 'Tahap Pipeline', type: 'select', options: ['Lead', 'Contacted', 'Negotiation', 'Proposal', 'Won', 'Lost'], required: true },
    ],
    search: ['name', 'contact', 'owner'],
    stageField: 'stage',
  },

  users: {
    title: 'User Management', icon: 'bi-person-gear', addLabel: 'Tambah User',
    columns: [
      { key: 'username', label: 'Username' }, { key: 'name', label: 'Nama' },
      { key: 'role', label: 'Role', badge: false }, { key: 'email', label: 'Email' },
    ],
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'name', label: 'Nama Lengkap', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'select', options: ['Owner', 'Manager', 'Finance', 'HR', 'Staff'], required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
    ],
    search: ['username', 'name', 'email'],
  },
};

// Sidebar / navigation structure
const MENU = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', view: 'dashboard' },
  {
    key: 'business', label: 'Business', icon: 'bi-building',
    children: [
      { key: 'companyProfile', label: 'Company Profile', view: 'companyProfile' },
      { key: 'branches', label: 'Branches', view: 'entity:branches' },
      { key: 'employees-biz', label: 'Employees', view: 'entity:employees' },
      { key: 'departments', label: 'Departments', view: 'entity:departments' },
      { key: 'businessUnits', label: 'Business Units', view: 'entity:businessUnits' },
    ],
  },
  {
    key: 'sales', label: 'Sales', icon: 'bi-cart3',
    children: [
      { key: 'customers', label: 'Customers', view: 'entity:customers' },
      { key: 'quotations', label: 'Quotations', view: 'entity:quotations' },
      { key: 'salesOrders', label: 'Sales Orders', view: 'entity:salesOrders' },
      { key: 'invoices', label: 'Invoices', view: 'entity:invoices' },
      { key: 'payments', label: 'Payments', view: 'entity:payments' },
    ],
  },
  {
    key: 'purchasing', label: 'Purchasing', icon: 'bi-bag-check',
    children: [
      { key: 'suppliers', label: 'Suppliers', view: 'entity:suppliers' },
      { key: 'purchaseRequests', label: 'Purchase Requests', view: 'entity:purchaseRequests' },
      { key: 'purchaseOrders', label: 'Purchase Orders', view: 'entity:purchaseOrders' },
      { key: 'goodsReceipts', label: 'Goods Receipt', view: 'entity:goodsReceipts' },
      { key: 'supplierInvoices', label: 'Supplier Invoice', view: 'entity:supplierInvoices' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', icon: 'bi-boxes',
    children: [
      { key: 'inventoryOverview', label: 'Overview', view: 'inventoryOverview' },
      { key: 'products', label: 'Products', view: 'entity:products' },
      { key: 'categories', label: 'Categories', view: 'entity:categories' },
      { key: 'warehouses', label: 'Warehouses', view: 'entity:warehouses' },
      { key: 'stockMovements', label: 'Stock Movement', view: 'entity:stockMovements' },
      { key: 'stockOpname', label: 'Stock Opname', view: 'entity:stockOpname' },
      { key: 'stockAdjustments', label: 'Stock Adjustment', view: 'entity:stockAdjustments' },
    ],
  },
  {
    key: 'finance', label: 'Finance', icon: 'bi-cash-stack',
    children: [
      { key: 'financeOverview', label: 'Overview', view: 'financeOverview' },
      { key: 'incomes', label: 'Income', view: 'entity:incomes' },
      { key: 'expenses', label: 'Expenses', view: 'entity:expenses' },
      { key: 'receivables', label: 'Receivables', view: 'receivables' },
      { key: 'payables', label: 'Payables', view: 'payables' },
      { key: 'cashBank', label: 'Cash & Bank', view: 'entity:cashBank' },
    ],
  },
  {
    key: 'hr', label: 'HR', icon: 'bi-person-workspace',
    children: [
      { key: 'hrOverview', label: 'Overview', view: 'hrOverview' },
      { key: 'employees-hr', label: 'Employees', view: 'entity:employees' },
      { key: 'attendance', label: 'Attendance', view: 'entity:attendance' },
      { key: 'leaves', label: 'Leave', view: 'entity:leaves' },
      { key: 'overtime', label: 'Overtime', view: 'entity:overtime' },
      { key: 'payrollSummary', label: 'Payroll Summary', view: 'payrollSummary' },
    ],
  },
  { key: 'crm', label: 'CRM', icon: 'bi-diagram-2', view: 'crm' },
  { key: 'reports', label: 'Reports', icon: 'bi-bar-chart-line', view: 'reports' },
  {
    key: 'settings', label: 'Settings', icon: 'bi-gear',
    children: [
      { key: 'profile', label: 'Profile', view: 'settingsProfile' },
      { key: 'companySettings', label: 'Company Settings', view: 'companyProfile' },
      { key: 'userManagement', label: 'User Management', view: 'entity:users' },
      { key: 'rolePermission', label: 'Role & Permission', view: 'rolePermission' },
      { key: 'appearance', label: 'Appearance', view: 'settingsAppearance' },
      { key: 'notifications', label: 'Notification Settings', view: 'settingsNotifications' },
      { key: 'dataManagement', label: 'Data Management', view: 'settingsData' },
    ],
  },
  { key: 'panduan', label: 'Panduan', icon: 'bi-book', view: 'panduan' },
];

// Bottom navigation (mobile) — most frequently used destinations
const BOTTOM_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', view: 'dashboard' },
  { key: 'sales', label: 'Sales', icon: 'bi-cart3', view: 'entity:salesOrders' },
  { key: 'inventory', label: 'Inventory', icon: 'bi-boxes', view: 'entity:products' },
  { key: 'finance', label: 'Finance', icon: 'bi-cash-stack', view: 'financeOverview' },
  { key: 'more', label: 'Menu', icon: 'bi-grid-3x3-gap', view: 'menu' },
];

const ROLE_ACCESS = {
  Owner: { label: 'Full access ke seluruh modul.', menus: 'all' },
  Manager: { label: 'Business, Sales, Purchasing, Inventory, Reports.', menus: ['dashboard', 'business', 'sales', 'purchasing', 'inventory', 'reports', 'panduan'] },
  Finance: { label: 'Finance, Sales, Purchasing, Reports.', menus: ['dashboard', 'finance', 'sales', 'purchasing', 'reports', 'panduan'] },
  HR: { label: 'HR dan data Employee.', menus: ['dashboard', 'hr', 'reports', 'panduan'] },
  Staff: { label: 'Menu operasional sesuai permission.', menus: ['dashboard', 'sales', 'inventory', 'panduan'] },
};
