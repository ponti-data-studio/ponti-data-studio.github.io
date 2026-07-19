/**
 * schema-diff.service.js
 * Membandingkan schema asli (snapshot saat dibuka) dengan schema hasil
 * editan pengguna, menghasilkan ringkasan perubahan yang bisa dibaca
 * manusia — dipakai di layar konfirmasi sebelum "Terapkan Perubahan"
 * (terutama untuk menyorot aksi yang MENGHAPUS data).
 */

export const schemaDiffService = {
  compute(original, edited) {
    const originalSheetByKey = new Map(original.sheets.map((s) => [s._key, s]));
    const editedSheetByKey = new Map(edited.sheets.map((s) => [s._key, s]));

    const newSheets = edited.sheets.filter((s) => !originalSheetByKey.has(s._key));
    const deletedSheets = original.sheets.filter((s) => !editedSheetByKey.has(s._key));
    const renamedSheets = edited.sheets.filter((s) => {
      const orig = originalSheetByKey.get(s._key);
      return orig && orig.name !== s.name;
    });

    const columnChanges = [];
    edited.sheets.forEach((sheet) => {
      const origSheet = originalSheetByKey.get(sheet._key);
      if (!origSheet) return; // sheet baru, semua kolomnya otomatis "baru", tidak perlu dicatat detail
      const origColByKey = new Map(origSheet.columns.map((c) => [c._key, c]));
      const editedColByKey = new Map(sheet.columns.map((c) => [c._key, c]));

      const newCols = sheet.columns.filter((c) => !origColByKey.has(c._key));
      const deletedCols = origSheet.columns.filter((c) => !editedColByKey.has(c._key));
      const renamedCols = sheet.columns.filter((c) => {
        const orig = origColByKey.get(c._key);
        return orig && orig.name !== c.name;
      });
      const reordered = (() => {
        const origOrder = origSheet.columns.map((c) => c._key).filter((k) => editedColByKey.has(k));
        const newOrder = sheet.columns.map((c) => c._key).filter((k) => origColByKey.has(k));
        return origOrder.join() !== newOrder.join();
      })();

      if (newCols.length || deletedCols.length || renamedCols.length || reordered) {
        columnChanges.push({ sheetName: sheet.name, newCols, deletedCols, renamedCols, reordered });
      }
    });

    const hasDestructive = deletedSheets.length > 0 || columnChanges.some((c) => c.deletedCols.length > 0);

    return { newSheets, deletedSheets, renamedSheets, columnChanges, hasDestructive };
  },
};
