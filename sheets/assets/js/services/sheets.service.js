import { googleAuthService } from "./google-auth.service.js";
import { logger } from "../utils/logger.util.js";

/**
 * sheets.service.js
 * Wrapper tipis di atas Google Sheets API v4 & Drive API v3 REST.
 * Semua pemanggilan API mentah HARUS lewat service ini agar
 * controller/UI tidak pernah tahu detail endpoint Google.
 */

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

async function authorizedFetch(url) {
  const token = await googleAuthService.getValidAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google API error (${res.status}): ${body}`);
  }
  return res.json();
}

async function authorizedRequest(method, url, body) {
  const token = await googleAuthService.getValidAccessToken();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Google API error (${res.status}): ${errBody}`);
  }
  return res.json();
}

export const sheetsService = {
  /** Cari spreadsheet milik user via Drive API */
  async listSpreadsheets(query = "") {
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.spreadsheet'${query ? ` and name contains '${query}'` : ""} and trashed=false`
    );
    const url = `${DRIVE_API}?q=${q}&fields=files(id,name,owners,createdTime,modifiedTime)&pageSize=25&orderBy=modifiedTime desc`;
    try {
      const data = await authorizedFetch(url);
      return data.files || [];
    } catch (err) {
      logger.error("sheets-service", "Gagal mengambil daftar spreadsheet", err);
      throw err;
    }
  },

  /** Ambil metadata + struktur lengkap sebuah spreadsheet (grid, formula, formatting, dll) */
  async getSpreadsheetMetadata(spreadsheetId) {
    const url =
      `${SHEETS_API}/${spreadsheetId}?includeGridData=false` +
      `&fields=spreadsheetId,properties,namedRanges,sheets.properties,sheets.merges,` +
      `sheets.basicFilter,sheets.conditionalFormats,sheets.protectedRanges,` +
      `sheets.developerMetadata`;
    return authorizedFetch(url);
  },

  /** Ambil nilai (values) untuk range tertentu, termasuk formula asli */
  async getValues(spreadsheetId, range) {
    const url =
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}` +
      `?valueRenderOption=FORMULA&dateTimeRenderOption=FORMATTED_STRING`;
    const data = await authorizedFetch(url);
    return data.values || [];
  },

  /** Ambil nilai tampilan (bukan formula) untuk keperluan sample data / tipe kolom */
  async getDisplayValues(spreadsheetId, range) {
    const url =
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}` +
      `?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
    const data = await authorizedFetch(url);
    return data.values || [];
  },

  /**
   * Ambil baris header (row 1) + baris contoh (row 2, untuk formula & data
   * validation) sekaligus untuk satu sheet — dipakai Schema Editor untuk
   * membaca struktur kolom yang sudah ada tanpa menarik seluruh grid data.
   */
  async getHeaderAndSampleRow(spreadsheetId, sheetTitle) {
    const range = `'${sheetTitle}'!A1:ZZ2`;
    const url =
      `${SHEETS_API}/${spreadsheetId}?includeGridData=true` +
      `&ranges=${encodeURIComponent(range)}` +
      `&fields=sheets.data.rowData.values(userEnteredValue,formattedValue,dataValidation)`;
    return authorizedFetch(url);
  },

  /** Hitung jumlah baris terisi (termasuk header) di kolom A — estimasi jumlah data */
  async getLastRowCount(spreadsheetId, sheetTitle) {
    const values = await this.getDisplayValues(spreadsheetId, `'${sheetTitle}'!A:A`);
    return values.length;
  },

  /** Hapus sebuah named range (dipakai saat Schema Editor menghapus named range) */
  async deleteNamedRange(spreadsheetId, namedRangeId) {
    return this.batchUpdate(spreadsheetId, [{ deleteNamedRange: { namedRangeId } }]);
  },

  /**
   * Cari developer metadata (metadata tersembunyi milik Ponti Sheets, tidak
   * terlihat di UI Google Sheets) berdasarkan metadataKey-nya. Dipakai Schema
   * Editor untuk menyimpan & membaca kembali tipe/PK/FK kolom secara persis
   * (bukan menebak ulang dari data setiap kali dibuka).
   */
  async searchDeveloperMetadata(spreadsheetId, metadataKey) {
    const url = `${SHEETS_API}/${spreadsheetId}/developerMetadata:search`;
    try {
      return await authorizedRequest("POST", url, {
        dataFilters: [{ developerMetadataLookup: { metadataKey, locationType: "SPREADSHEET" } }],
      });
    } catch (err) {
      logger.warn("sheets-service", "Gagal membaca developer metadata (dianggap belum ada)", err);
      return null;
    }
  },

  // ---------------------------------------------------------------------
  // Metode di bawah ini bersifat WRITE (dipakai khusus oleh Database
  // Builder untuk membuat spreadsheet baru). Fitur Analyze/ERD/dsb tidak
  // pernah memanggil metode ini.
  // ---------------------------------------------------------------------

  /** Membuat spreadsheet baru. Mengembalikan { spreadsheetId, spreadsheetUrl, ... } */
  async createSpreadsheet(properties) {
    return authorizedRequest("POST", SHEETS_API, { properties });
  },

  /** Mengirim sekumpulan write-request (addSheet, format, validation, dll) sekaligus */
  async batchUpdate(spreadsheetId, requests) {
    return authorizedRequest("POST", `${SHEETS_API}/${spreadsheetId}:batchUpdate`, { requests });
  },

  /** Menulis nilai (termasuk formula bila diawali "=") ke sebuah range */
  async updateValues(spreadsheetId, range, values, valueInputOption = "USER_ENTERED") {
    const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`;
    return authorizedRequest("PUT", url, { range, majorDimension: "ROWS", values });
  },

  /** Mengosongkan sebuah range (dipakai Schema Editor saat kolom dihapus/sheet menyusut) */
  async clearRange(spreadsheetId, range) {
    const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
    return authorizedRequest("POST", url, {});
  },
};
