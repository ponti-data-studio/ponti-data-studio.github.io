import { downloadBlob } from "../utils/download.util.js";

/**
 * export.service.js
 * Menangani export Database Context / Prompt / History ke berbagai format.
 * PDF dibuat lewat window.print() pada view khusus supaya tidak perlu
 * dependency berat (menjaga bundle tetap ringan, sesuai prinsip KISS).
 */

function download(filename, content, mime) {
  downloadBlob(filename, content, mime);
}

function jsonToMarkdown(obj, title = "Database Context") {
  let md = `# ${title}\n\n`;
  md += `_Dihasilkan otomatis oleh Ponti Sheets pada ${new Date().toLocaleString("id-ID")}_\n\n`;

  if (obj.spreadsheet) {
    md += `## Metadata Spreadsheet\n\n`;
    md += `- **Nama:** ${obj.spreadsheet.name}\n- **ID:** ${obj.spreadsheet.id}\n- **Locale:** ${obj.spreadsheet.locale}\n- **Timezone:** ${obj.spreadsheet.timezone}\n\n`;
  }
  (obj.sheets || []).forEach((sheet) => {
    md += `## Sheet: ${sheet.name}\n\n`;
    md += `| Kolom | Tipe | PK | FK | Required |\n|---|---|---|---|---|\n`;
    sheet.columns.forEach((c) => {
      const requiredLabel = c.required?.value === "true" ? "TRUE" : c.required?.value === "false" ? "FALSE" : "Unknown";
      md += `| ${c.name} | ${c.type} | ${c.isPrimaryKey ? "✔" : ""} | ${c.isForeignKey ? "✔" : ""} | ${requiredLabel} |\n`;
    });
    md += `\n`;
    if (sheet.formulas?.length) {
      md += `**Formula:**\n\n`;
      sheet.formulas.forEach((f) => { md += `- \`${f.formula}\` (${f.cell}) — ${f.description}\n`; });
      md += `\n`;
    }
  });
  if (obj.businessRules?.length) {
    md += `## Business Rules\n\n`;
    obj.businessRules.forEach((r) => { md += `- ${r}\n`; });
  }
  return md;
}

export const exportService = {
  toSvg(svgMarkup, filename = "diagram.svg") {
    download(filename, svgMarkup, "image/svg+xml");
  },

  toJson(data, filename = "database_context.json") {
    download(filename, JSON.stringify(data, null, 2), "application/json");
  },

  toMarkdown(data, filename = "database_context.md", title) {
    download(filename, jsonToMarkdown(data, title), "text/markdown");
  },

  toTxt(text, filename = "export.txt") {
    download(filename, text, "text/plain");
  },

  toPdfViaPrint(htmlContent, title = "Ponti Sheets Export") {
    const win = window.open("", "_blank");
    win.document.write(`<!doctype html><html><head><title>${title}</title>
      <style>body{font-family:Inter,system-ui,sans-serif;padding:32px;color:#111} h1,h2{color:#000} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;padding:6px;font-size:12px}</style>
      </head><body>${htmlContent}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  },
};
