/**
 * syntax-highlight.util.js
 * -----------------------------------------------------------------------
 * Syntax highlighting untuk blok kode di response AI Studio, memakai
 * Prism.js yang dimuat dinamis dari CDN (bukan lewat npm) — konsisten
 * dengan prinsip "tanpa build step" Ponti Sheets, sama seperti ExcelJS
 * di excel-writer.service.js. Plugin autoloader Prism otomatis mengambil
 * grammar bahasa yang dibutuhkan sesuai label bahasa di blok kode (```js,
 * ```python, dst) tanpa perlu mendaftarkan tiap bahasa secara manual.
 * -----------------------------------------------------------------------
 */

const PRISM_VERSION = "1.29.0";
const PRISM_BASE = `https://cdnjs.cloudflare.com/ajax/libs/prism/${PRISM_VERSION}`;
const PRISM_CSS_URL = `${PRISM_BASE}/themes/prism-tomorrow.min.css`;
const PRISM_CORE_URL = `${PRISM_BASE}/prism.min.js`;
const PRISM_AUTOLOADER_URL = `${PRISM_BASE}/plugins/autoloader/prism-autoloader.min.js`;
const PRISM_COMPONENTS_PATH = `${PRISM_BASE}/components/`;

let prismLoadPromise = null;

function loadCssOnce(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Gagal memuat script dari ${src}`));
    document.head.appendChild(script);
  });
}

/** Memuat Prism.js (core + autoloader) dari CDN sekali saja — panggilan
 *  berikutnya memakai instance yang sudah dimuat (di-cache lewat promise). */
export function loadPrism() {
  if (window.Prism?.plugins?.autoloader) return Promise.resolve(window.Prism);
  if (prismLoadPromise) return prismLoadPromise;

  loadCssOnce(PRISM_CSS_URL);
  prismLoadPromise = loadScript(PRISM_CORE_URL)
    .then(() => loadScript(PRISM_AUTOLOADER_URL))
    .then(() => {
      window.Prism.plugins.autoloader.languages_path = PRISM_COMPONENTS_PATH;
      return window.Prism;
    })
    .catch((err) => {
      prismLoadPromise = null; // supaya bisa dicoba lagi kalau gagal (mis. offline)
      throw err;
    });
  return prismLoadPromise;
}

/**
 * Memecah teks response AI jadi segmen teks-biasa & blok-kode, berdasarkan
 * fenced code block markdown (```bahasa ... ```). Response AI biasanya
 * berupa campuran penjelasan + banyak blok kode berbagai bahasa/file.
 * @returns {Array<{type:"text", content:string} | {type:"code", language:string, content:string}>}
 */
export function parseCodeSegments(text) {
  const segments = [];
  const regex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match = regex.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      language: (match[1] || "plaintext").toLowerCase(),
      content: match[2].replace(/\n$/, ""),
    });
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: "text", content: text }];
}
