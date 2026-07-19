import { FormulaModel } from "../models/spreadsheet.model.js";

/**
 * formula-analyzer.service.js
 * -----------------------------------------------------------------------
 * Mengekstrak FORMULA ASLI (bukan hasil kalkulasinya) dari data yang
 * diambil dengan valueRenderOption=FORMULA, lalu memberi nama, deskripsi
 * singkat, dan daftar dependency (cell/range yang dirujuk).
 * -----------------------------------------------------------------------
 */

const FORMULA_DESCRIPTIONS = {
  SUM: "Menjumlahkan sekumpulan angka.",
  SUMIF: "Menjumlahkan angka yang memenuhi satu kriteria.",
  SUMIFS: "Menjumlahkan angka yang memenuhi banyak kriteria.",
  QUERY: "Menjalankan query mirip SQL terhadap sebuah range data.",
  FILTER: "Menyaring baris/kolom berdasarkan kondisi tertentu.",
  ARRAYFORMULA: "Menerapkan formula ke seluruh array/range sekaligus.",
  VLOOKUP: "Mencari nilai secara vertikal berdasarkan kolom kunci.",
  XLOOKUP: "Mencari nilai secara fleksibel (pengganti VLOOKUP/HLOOKUP).",
  HLOOKUP: "Mencari nilai secara horizontal berdasarkan baris kunci.",
  INDEX: "Mengambil nilai dari posisi baris/kolom tertentu dalam range.",
  MATCH: "Mencari posisi (index) sebuah nilai dalam range.",
  IF: "Mengembalikan nilai berdasarkan satu kondisi benar/salah.",
  IFS: "Mengembalikan nilai berdasarkan beberapa kondisi berurutan.",
  COUNTIF: "Menghitung jumlah sel yang memenuhi satu kriteria.",
  COUNTIFS: "Menghitung jumlah sel yang memenuhi banyak kriteria.",
  AVERAGE: "Menghitung rata-rata sekumpulan angka.",
  AVERAGEIF: "Menghitung rata-rata dengan satu kriteria.",
  IMPORTRANGE: "Mengimpor data dari spreadsheet lain.",
  UNIQUE: "Mengambil nilai unik dari sebuah range.",
  SORT: "Mengurutkan data dalam sebuah range.",
  TEXT: "Memformat angka/tanggal menjadi teks dengan pola tertentu.",
  CONCATENATE: "Menggabungkan beberapa teks menjadi satu.",
  SPLIT: "Memecah teks menjadi beberapa bagian berdasarkan pemisah.",
  TODAY: "Mengembalikan tanggal hari ini.",
  NOW: "Mengembalikan tanggal & waktu saat ini.",
};

function extractFunctionName(formula) {
  const match = formula.match(/^=\s*([A-Z][A-Z0-9._]*)\s*\(/i);
  return match ? match[1].toUpperCase() : "CUSTOM";
}

function extractDependencies(formula) {
  // Menangkap referensi cell/range sederhana, mis: A1, $B$2, Sheet2!A1:B10
  const re = /([A-Za-z_][A-Za-z0-9_ ]*!)?\$?[A-Z]{1,3}\$?\d+(:\$?[A-Z]{1,3}\$?\d+)?/g;
  const matches = formula.match(re) || [];
  return [...new Set(matches)];
}

/**
 * @param {string} sheetName
 * @param {Array<Array<string>>} formulaGrid - hasil getValues() dengan valueRenderOption=FORMULA
 * @returns {FormulaModel[]}
 */
export function analyzeFormulas(sheetName, formulaGrid = []) {
  const results = [];

  formulaGrid.forEach((row, rowIdx) => {
    row.forEach((cellValue, colIdx) => {
      if (typeof cellValue !== "string" || !cellValue.startsWith("=")) return;

      const name = extractFunctionName(cellValue);
      const colLetter = columnIndexToLetter(colIdx);
      const cellRef = `${sheetName}!${colLetter}${rowIdx + 1}`;

      results.push(
        new FormulaModel({
          cell: cellRef,
          formula: cellValue,
          name,
          description: FORMULA_DESCRIPTIONS[name] || "Formula kustom / kombinasi fungsi.",
          dependencies: extractDependencies(cellValue),
        })
      );
    });
  });

  return results;
}

export function columnIndexToLetter(index) {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}
