/** exportService.js — Copy, Markdown, Word (.doc), PDF via print view */
const ExportService = {
  async copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      UI.toast('success', label || 'Disalin ke clipboard');
    } catch (e) { UI.toast('error', 'Gagal menyalin — izinkan akses clipboard'); }
  },

  download(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  },

  markdown(name, text) {
    this.download(this.slug(name) + '.md', 'text/markdown;charset=utf-8', text);
    UI.toast('success', 'File Markdown diunduh');
  },

  word(name, text) {
    const html = '<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">' +
      '<style>body{font-family:Calibri,Arial;font-size:11pt}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4pt 6pt}</style>' +
      '</head><body>' + U.mdToHtml(text) + '</body></html>';
    this.download(this.slug(name) + '.doc', 'application/msword', html);
    UI.toast('success', 'File Word diunduh');
  },

  pdf(name, text) {
    const w = window.open('', '_blank');
    if (!w) { UI.toast('error', 'Popup diblokir — izinkan popup untuk export PDF'); return; }
    w.document.write('<html><head><title>' + U.esc(name) + '</title><meta charset="utf-8">' +
      '<style>body{font-family:Georgia,serif;max-width:760px;margin:32px auto;line-height:1.6;color:#1a1a1a}' +
      'h1,h2,h3{font-family:Arial}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}' +
      '@media print{body{margin:0}}</style></head><body>' + U.mdToHtml(text) +
      '<script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  },

  slug(name) { return String(name || 'dokumen').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase(); }
};
