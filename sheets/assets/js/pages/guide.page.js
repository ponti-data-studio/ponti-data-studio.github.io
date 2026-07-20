import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";

/**
 * guide.page.js
 * -----------------------------------------------------------------------
 * Panduan Penggunaan Aplikasi (Untuk Orang Awam) — halaman bantuan dalam
 * bahasa sederhana, ditujukan untuk pengguna yang belum familiar dengan
 * istilah teknis database/spreadsheet. Berisi alur pemakaian singkat dan
 * kamus istilah yang bisa dicari.
 * -----------------------------------------------------------------------
 */

const GLOSSARY = [
  {
    category: "Istilah Umum",
    terms: [
      {
        term: "Google Sheets",
        desc: "Aplikasi spreadsheet (lembar kerja) gratis dari Google, mirip Microsoft Excel, tapi bisa dibuka & diedit langsung dari browser dan otomatis tersimpan di Google Drive.",
      },
      {
        term: "Spreadsheet",
        desc: "Satu file Google Sheets secara keseluruhan — ibaratnya seperti satu buku catatan. Satu spreadsheet bisa berisi banyak \"halaman\" (lihat: Sheet).",
      },
      {
        term: "Sheet (Tab)",
        desc: "Satu \"halaman\" di dalam sebuah spreadsheet — yang muncul sebagai tab kecil di bagian bawah Google Sheets. Contoh: dalam satu spreadsheet toko, bisa ada sheet \"Produk\", sheet \"Pelanggan\", sheet \"Transaksi\", dst.",
      },
      {
        term: "Database",
        desc: "Kumpulan data yang tersusun rapi supaya mudah dicari & dihubungkan satu sama lain. Di Ponti Sheets, spreadsheet Google Sheets Anda DIPERLAKUKAN sebagai database — tiap sheet ibarat satu \"tabel\" data.",
      },
      {
        term: "Kolom & Baris",
        desc: "Kolom = arah tegak (atas-bawah), biasanya berisi satu jenis informasi (mis. kolom \"Nama\"). Baris = arah mendatar (kiri-kanan), biasanya berisi satu data lengkap (mis. satu baris = data satu pelanggan).",
      },
    ],
  },
  {
    category: "Login & Keamanan",
    terms: [
      {
        term: "Login Google / OAuth",
        desc: "Cara masuk ke Ponti Sheets memakai akun Google Anda, supaya aplikasi ini diberi izin membaca (dan kadang menulis) spreadsheet Anda. \"OAuth\" adalah nama teknis untuk sistem izin ini — Anda tidak perlu menghafalnya, cukup tahu ini cara resmi & aman dari Google untuk memberi izin ke aplikasi pihak ketiga.",
      },
      {
        term: "Google Client ID",
        desc: "Semacam \"nomor pendaftaran\" yang menandakan aplikasi Ponti Sheets ini sudah terdaftar resmi di Google, supaya tombol Login Google-nya bisa berfungsi. Ini diatur satu kali oleh pemilik/pengelola aplikasi, bukan sesuatu yang perlu Anda urus sebagai pengguna biasa.",
      },
      {
        term: "API Key",
        desc: "Semacam \"kata sandi khusus\" yang Anda dapatkan dari penyedia AI (OpenAI, Gemini, atau Qwen) supaya Ponti Sheets bisa memakai layanan AI mereka atas nama Anda. Diisi di menu Settings, dan hanya tersimpan di perangkat Anda sendiri.",
      },
      {
        term: "Multi-User / Login Gate",
        desc: "Sejak fitur ini ada, semua orang WAJIB login Google dulu sebelum bisa memakai Ponti Sheets. Gunanya: kalau beberapa orang memakai komputer/HP yang sama, data masing-masing (Settings, API Key, riwayat) otomatis terpisah dan tidak saling campur.",
      },
    ],
  },
  {
    category: "Struktur Database",
    terms: [
      {
        term: "Primary Key (PK)",
        desc: "Kolom \"ID unik\" yang membedakan satu baris dengan baris lainnya — mirip NIK di KTP, tidak boleh ada dua yang sama. Biasanya berupa kode seperti PRD001, PRD002, dst.",
      },
      {
        term: "Foreign Key (FK)",
        desc: "Kolom yang \"menunjuk\" ke Primary Key di sheet lain, untuk menghubungkan data antar sheet — mirip nomor rekening di slip transfer bank, cukup simpan nomornya, tidak perlu salin semua data orangnya.",
      },
      {
        term: "Formula",
        desc: "Rumus penghitungan otomatis di Google Sheets, ditulis diawali tanda \"=\" (contoh: =B2*C2 untuk mengalikan dua kolom). Kalau data sumbernya berubah, hasil formula ikut berubah otomatis.",
      },
      {
        term: "Formula Aktif vs Statis",
        desc: "\"Aktif\" artinya rumusnya beneran tertulis di Google Sheets dan terus dihitung ulang otomatis. \"Statis\" artinya hasil hitungannya sudah \"dibekukan\" jadi angka tetap — rumusnya sendiri sudah tidak ada, jadi kalau data sumbernya berubah, nilainya TIDAK ikut berubah lagi.",
      },
      {
        term: "Named Range",
        desc: "\"Nama panggilan\" untuk sekelompok sel, supaya lebih gampang dirujuk daripada mengetik alamat sel mentah — mirip menyimpan nomor telepon sebagai kontak bernama, bukan mengetik nomornya terus-menerus.",
      },
      {
        term: "Data Validation",
        desc: "Aturan pembatas isian sebuah kolom, misalnya cuma boleh diisi lewat dropdown pilihan tertentu, atau harus berupa angka/tanggal/email yang valid — mencegah salah ketik.",
      },
      {
        term: "Conditional Formatting",
        desc: "Pewarnaan otomatis pada sel berdasarkan kondisi tertentu, misalnya sel jadi merah otomatis kalau stok di bawah batas minimum.",
      },
      {
        term: "Freeze Row",
        desc: "Fitur \"mengunci\" baris tertentu (biasanya baris judul/header) supaya tetap terlihat walau Anda scroll ke bawah.",
      },
      {
        term: "Filter",
        desc: "Fitur menyaring baris data supaya cuma yang sesuai kriteria tertentu yang ditampilkan, tanpa menghapus data lainnya.",
      },
      {
        term: "ERD (Entity Relationship Diagram)",
        desc: "Diagram/gambar yang menunjukkan bagaimana sheet-sheet dalam database Anda saling terhubung satu sama lain lewat Primary Key & Foreign Key — supaya struktur data lebih gampang dipahami sekilas, tanpa perlu baca semua data satu-satu.",
      },
      {
        term: "Schema / Skema Database",
        desc: "\"Cetak biru\" struktur database — sheet apa saja yang ada, kolom apa saja di tiap sheet, tipe datanya apa, dan bagaimana sheet-sheet itu saling terhubung. Bukan data itu sendiri, tapi \"bentuk\"-nya.",
      },
      {
        term: "Metadata",
        desc: "\"Data tentang data\" — informasi tambahan yang menjelaskan data, tapi bukan datanya sendiri. Contoh: Ponti Sheets menyimpan info \"kolom ini tipe Currency\" sebagai metadata, terpisah dari angka-angka aslinya.",
      },
    ],
  },
  {
    category: "Istilah AI",
    terms: [
      {
        term: "AI Provider",
        desc: "Perusahaan penyedia layanan AI yang dipakai untuk menghasilkan struktur database atau kode aplikasi — pilihannya OpenAI (ChatGPT), Google Gemini, atau Qwen (Alibaba).",
      },
      {
        term: "Prompt",
        desc: "Instruksi/permintaan yang dikirim ke AI, berisi penjelasan struktur database Anda + permintaan Anda, supaya AI paham apa yang harus dibuatkan.",
      },
      {
        term: "Token",
        desc: "Satuan hitung \"panjang teks\" yang dipakai penyedia AI untuk menentukan biaya & batas kirim — kira-kira 1 token setara 3-4 karakter. Semakin panjang prompt/jawaban, semakin banyak token dipakai.",
      },
      {
        term: "Blueprint Database",
        desc: "Rancangan struktur database lengkap yang dibuatkan AI (sheet, kolom, relasi, dummy data, dll) sebelum benar-benar dibuat jadi Google Sheets sungguhan — semacam \"denah\" sebelum dibangun.",
      },
    ],
  },
  {
    category: "Istilah Lainnya",
    terms: [
      {
        term: "Analisis (Analyze)",
        desc: "Proses Ponti Sheets \"membaca & memahami\" struktur spreadsheet Anda — mendeteksi tipe kolom, PK/FK, formula, dan kualitas datanya secara otomatis.",
      },
      {
        term: "Business Rules (Aturan Bisnis)",
        desc: "Aturan-aturan yang berlaku untuk data Anda, misalnya \"stok tidak boleh minus\" atau \"nomor invoice harus unik\" — dipakai supaya aplikasi yang dibuat AI mematuhi aturan bisnis Anda, bukan cuma ikut struktur datanya saja.",
      },
      {
        term: "Confidence Score",
        desc: "Angka 0–1 yang menunjukkan seberapa yakin Ponti Sheets terhadap tebakannya (mis. tipe kolom atau relasi PK/FK). Semakin dekat ke 1, semakin yakin.",
      },
    ],
  },
];

export async function renderGuidePage() {
  const container = el("div", { class: "page page--guide" });

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Panduan Penggunaan Aplikasi"),
    el("p", { class: "muted" }, "Ditulis untuk yang belum familiar dengan istilah teknis database/spreadsheet — santai saja, tidak ada yang wajib dihafal."),
  ]));

  // ---- Apa itu Ponti Sheets ----
  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "Apa itu Ponti Sheets?"),
    el("p", {}, "Ponti Sheets adalah aplikasi yang membantu Anda mengubah Google Sheets menjadi \"database\" yang rapi, lalu memakai AI untuk membuatkan aplikasi (web, Android, dsb) berdasarkan struktur data itu — tanpa Anda perlu jago coding."),
    el("p", {}, "Singkatnya: Anda siapkan datanya di Google Sheets (atau minta AI buatkan dari nol), Ponti Sheets membantu merapikan strukturnya, lalu AI membuatkan aplikasinya untuk Anda."),
  ]));

  // ---- Alur singkat ----
  const steps = [
    { title: "1. Login Google", desc: "Masuk pakai akun Google Anda — ini juga yang menentukan data Anda terpisah dari pengguna lain di device yang sama." },
    { title: "2. Siapkan Datanya", desc: "Pilih spreadsheet yang sudah ada (menu Spreadsheet), atau minta AI buatkan struktur baru dari nol (menu ✨ Database Builder)." },
    { title: "3. Analisis Otomatis", desc: "Ponti Sheets membaca struktur spreadsheet Anda — mendeteksi kolom, relasi antar sheet, formula, dan memeriksa kualitas datanya." },
    { title: "4. Rapikan Kalau Perlu", desc: "Kalau ada yang mau diubah (tambah kolom, ubah tipe data, dst), pakai menu Schema Editor — perubahannya langsung tersinkron ke Google Sheets asli." },
    { title: "5. Susun Prompt & Generate", desc: "Menu Prompt Builder menyusun instruksi lengkap untuk AI, lalu menu AI Studio mengirimkannya dan menghasilkan aplikasi/kode sungguhan." },
  ];
  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "Alur Pemakaian Singkat"),
    el("div", { class: "guide-steps" }, steps.map((s) =>
      el("div", { class: "guide-step" }, [
        el("div", { class: "guide-step__title" }, s.title),
        el("div", { class: "guide-step__desc" }, s.desc),
      ])
    )),
  ]));

  // ---- Kamus Istilah ----
  const glossaryCard = el("div", { class: "card" });
  const searchInput = el("input", { type: "text", placeholder: "Cari istilah... (mis. \"formula\" atau \"PK\")", class: "guide-search" });
  const resultsHost = el("div", { class: "guide-glossary" });

  function renderGlossary(filterText = "") {
    clear(resultsHost);
    const q = filterText.trim().toLowerCase();
    let totalMatches = 0;

    GLOSSARY.forEach((group) => {
      const matchedTerms = group.terms.filter(
        (t) => !q || t.term.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
      );
      if (matchedTerms.length === 0) return;
      totalMatches += matchedTerms.length;

      resultsHost.appendChild(
        el("div", { class: "guide-glossary__group" }, [
          el("h4", {}, group.category),
          el("dl", { class: "guide-term-list" }, matchedTerms.flatMap((t) => [
            el("dt", {}, t.term),
            el("dd", {}, t.desc),
          ])),
        ])
      );
    });

    if (totalMatches === 0) {
      resultsHost.appendChild(el("p", { class: "muted" }, `Tidak ada istilah yang cocok dengan "${filterText}".`));
    }
  }

  searchInput.addEventListener("input", () => renderGlossary(searchInput.value));

  glossaryCard.append(
    el("h3", {}, "Kamus Istilah"),
    el("p", { class: "muted" }, "Bingung dengan istilah tertentu di aplikasi ini? Cari di sini."),
    searchInput,
    resultsHost
  );
  renderGlossary();
  container.appendChild(glossaryCard);

  // ---- Pertanyaan Umum ----
  const simpleFaq = [
    { q: "Saya orang awam, apa masih bisa pakai aplikasi ini?", a: "Bisa. Anda tidak perlu tahu coding sama sekali. Fokus saja pada apa yang Anda BUTUHKAN (mis. \"aplikasi kasir sederhana\"), AI yang akan mengurus bagian teknisnya." },
    { q: "Data saya aman tidak?", a: "Ponti Sheets tidak punya server sendiri — semua data Anda tetap ada di Google Sheets/Drive milik Anda sendiri, hanya \"dibaca\" oleh aplikasi ini di browser Anda." },
    { q: "Kalau saya salah klik atau salah edit, apa data saya hilang?", a: "Untuk perubahan struktur (lewat Schema Editor), aplikasi akan selalu menampilkan peringatan dulu sebelum menghapus apa pun, dan Anda harus konfirmasi secara sadar sebelum lanjut." },
    { q: "Saya tidak paham istilah yang muncul di aplikasi, harus bagaimana?", a: "Cari istilah itu di Kamus Istilah pada halaman ini — kalau masih belum jelas, coba baca ulang bagian \"Alur Pemakaian Singkat\" di atas untuk konteks yang lebih luas." },
  ];
  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "Pertanyaan Umum"),
    el("div", { class: "guide-faq" }, simpleFaq.map((item) =>
      el("div", { class: "guide-faq__item" }, [
        el("div", { class: "guide-faq__q" }, [el("span", { html: icon("help-circle", { size: 14 }) }), item.q]),
        el("div", { class: "guide-faq__a" }, item.a),
      ])
    )),
  ]));

  return container;
}
