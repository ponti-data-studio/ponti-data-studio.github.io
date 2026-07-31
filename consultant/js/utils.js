/** utils.js — helper DOM & format */
const U = {
  el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  },
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },
  debounce(fn, ms) {
    let t; return function () { clearTimeout(t); const a = arguments, c = this;
      t = setTimeout(function () { fn.apply(c, a); }, ms); };
  },
  /** Konverter Markdown → HTML sederhana (heading, bold, italic, list, tabel, code) */
  mdToHtml(md) {
    let h = U.esc(md);
    h = h.replace(/```([\s\S]*?)```/g, function (_, c) { return '<pre><code>' + c + '</code></pre>'; });
    h = h.replace(/^###### (.*)$/gm, '<h6>$1</h6>').replace(/^##### (.*)$/gm, '<h5>$1</h5>')
         .replace(/^#### (.*)$/gm, '<h4>$1</h4>').replace(/^### (.*)$/gm, '<h3>$1</h3>')
         .replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')
         .replace(/`([^`]+)`/g, '<code>$1</code>');
    // tabel markdown
    h = h.replace(/((?:^\|.*\|\s*$\n?)+)/gm, function (block) {
      const rows = block.trim().split('\n').filter(function (r) { return !/^\|[\s:|-]+\|$/.test(r.trim()); });
      const tr = rows.map(function (r, i) {
        const cells = r.split('|').slice(1, -1).map(function (c) {
          return '<' + (i === 0 ? 'th' : 'td') + '>' + c.trim() + '</' + (i === 0 ? 'th' : 'td') + '>';
        }).join('');
        return '<tr>' + cells + '</tr>';
      }).join('');
      return '<table border="1" cellspacing="0" cellpadding="6">' + tr + '</table>';
    });
    h = h.replace(/(?:^[-*] .*$\n?)+/gm, function (block) {
      return '<ul>' + block.trim().split('\n').map(function (l) { return '<li>' + l.replace(/^[-*] /, '') + '</li>'; }).join('') + '</ul>';
    });
    h = h.replace(/(?:^\d+\. .*$\n?)+/gm, function (block) {
      return '<ol>' + block.trim().split('\n').map(function (l) { return '<li>' + l.replace(/^\d+\. /, '') + '</li>'; }).join('') + '</ol>';
    });
    return h.split(/\n{2,}/).map(function (p) {
      return /^<(h\d|ul|ol|table|pre)/.test(p.trim()) ? p : '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
  }
};
