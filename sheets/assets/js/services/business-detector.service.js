import { BUSINESS_TYPES } from "../config/app.config.js";

/**
 * business-detector.service.js
 * -----------------------------------------------------------------------
 * Mendeteksi jenis bisnis dari nama sheet & nama kolom menggunakan
 * keyword scoring sederhana. Bukan machine learning — heuristic murni,
 * cepat, dan bisa dijelaskan (explainable), sesuai kebutuhan produk.
 * -----------------------------------------------------------------------
 */

const KEYWORDS = {
  POS: ["transaksi", "kasir", "struk", "penjualan", "produk", "diskon", "pembayaran", "pos"],
  CRM: ["pelanggan", "customer", "leads", "prospek", "follow up", "deal", "pipeline"],
  Inventory: ["stok", "stock", "sku", "gudang", "barang", "inventori", "inventory"],
  Warehouse: ["gudang", "rak", "lokasi simpan", "warehouse", "penerimaan barang"],
  Accounting: ["akun", "jurnal", "debit", "kredit", "neraca", "laba rugi", "coa"],
  Finance: ["anggaran", "budget", "cashflow", "investasi", "finance", "keuangan"],
  Restaurant: ["menu", "meja", "pesanan", "resep", "bahan baku", "restoran", "cafe"],
  HRIS: ["karyawan", "gaji", "payroll", "cuti", "absensi", "jabatan", "employee"],
  Rental: ["sewa", "rental", "penyewa", "unit", "durasi sewa"],
  Manufacturing: ["produksi", "bom", "bill of material", "work order", "mesin", "manufaktur"],
  "Project Management": ["proyek", "task", "milestone", "sprint", "deadline", "project"],
  Agriculture: ["panen", "lahan", "tanam", "pupuk", "pertanian", "petani"],
  School: ["siswa", "murid", "kelas", "nilai", "sekolah", "guru", "rapor"],
  Hospital: ["pasien", "rawat", "dokter", "obat", "rekam medis", "rumah sakit", "poli"],
};

/**
 * @param {string[]} sheetNames
 * @param {string[]} allColumnNames
 * @returns {{ type: string, confidence: number, scores: Record<string, number> }}
 */
export function detectBusinessType(sheetNames = [], allColumnNames = []) {
  const corpus = [...sheetNames, ...allColumnNames].join(" ").toLowerCase();
  const scores = {};

  for (const type of BUSINESS_TYPES) {
    if (type === "Unknown") continue;
    const keywords = KEYWORDS[type] || [];
    let score = 0;
    for (const kw of keywords) {
      if (corpus.includes(kw)) score += 1;
    }
    scores[type] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topType, topScore] = sorted[0] || ["Unknown", 0];

  if (topScore === 0) {
    return { type: "Unknown", confidence: 0, scores };
  }

  const maxPossible = (KEYWORDS[topType] || []).length || 1;
  const confidence = Math.min(1, Math.round((topScore / maxPossible) * 100) / 100);

  return { type: topType, confidence, scores };
}
