/** fileParser.js — parser file sisi klien.
 *  Gambar & PDF → dataURL (dibaca AI via Vision/File). XLSX/CSV/TXT → teks.
 *  Menambah parser baru: tambahkan cabang di parse() — modul lain tidak berubah. */
const FileParser = {
  MAX_MB: 8,

  async parse(file) {
    if (file.size > this.MAX_MB * 1024 * 1024) {
      throw new Error(file.name + ' melebihi ' + this.MAX_MB + ' MB');
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].indexOf(ext) >= 0) {
      return { name: file.name, kind: 'image', dataUrl: await this.toDataUrl(file) };
    }
    if (ext === 'pdf') {
      return { name: file.name, kind: 'pdf', dataUrl: await this.toDataUrl(file) };
    }
    if (['xlsx', 'xls'].indexOf(ext) >= 0) {
      return { name: file.name, kind: 'text', text: await this.xlsxToText(file) };
    }
    if (['csv', 'txt', 'md', 'json', 'log'].indexOf(ext) >= 0) {
      return { name: file.name, kind: 'text', text: await file.text() };
    }
    if (ext === 'docx' || ext === 'doc') {
      throw new Error('File Word belum didukung — buka dokumennya lalu copy-paste isinya sebagai teks.');
    }
    // fallback: coba baca sebagai teks
    return { name: file.name, kind: 'text', text: await file.text() };
  },

  toDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('Gagal membaca ' + file.name)); };
      r.readAsDataURL(file);
    });
  },

  /** XLSX → teks terstruktur: nama sheet + CSV (maks 80 baris/sheet) agar AI bisa
   *  mendeteksi header, contoh data, relasi, dan struktur database */
  async xlsxToText(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const parts = [];
    wb.SheetNames.forEach(function (sn) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
      const rows = csv.split('\n');
      parts.push('### SHEET: ' + sn + ' (' + rows.length + ' baris)\n' + rows.slice(0, 80).join('\n'));
    });
    return 'WORKBOOK: ' + file.name + '\nJumlah sheet: ' + wb.SheetNames.length +
      ' (' + wb.SheetNames.join(', ') + ')\n\n' + parts.join('\n\n');
  }
};
