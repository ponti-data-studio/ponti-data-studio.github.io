# DEVELOPMENT.md — Panduan Pengembangan Ponti Arena

Panduan ini untuk kamu yang ingin **menambah konten atau fitur** ke Ponti Arena tanpa perlu
membongkar seluruh codebase dari nol. Setiap bagian berisi langkah konkret, contoh kode nyata dari
game ini, dan checklist testing.

> Baca juga: `README.md` (gambaran umum fitur & arsitektur) dan `ASSET_GUIDE.md` (cara menambah
> musik, animasi skill, dan sound effect).

---

## Daftar Isi

1. [Peta Arsitektur — File Mana Ngapain](#1-peta-arsitektur--file-mana-ngapain)
2. [Menambah Karakter Baru](#2-menambah-karakter-baru)
3. [Menambah Aset Karakter (Gambar)](#3-menambah-aset-karakter-gambar)
4. [Menambah Mekanik Kustom (Skill Unik)](#4-menambah-mekanik-kustom-skill-unik)
5. [Menambah Lokasi Pertarungan (Arena)](#5-menambah-lokasi-pertarungan-arena)
6. [Menambah Stage Campaign](#6-menambah-stage-campaign)
7. [Menambah Mode Permainan Baru](#7-menambah-mode-permainan-baru)
8. [Menambah Fitur Baru (Umum)](#8-menambah-fitur-baru-umum)
9. [Sistem Balance (Class Template)](#9-sistem-balance-class-template)
10. [Sistem Summon (Unit yang Bisa Ditarget)](#10-sistem-summon-unit-yang-bisa-ditarget)
11. [Menambah Achievement](#11-menambah-achievement)
12. [Testing Checklist](#12-testing-checklist)
13. [Kesalahan Umum yang Harus Dihindari](#13-kesalahan-umum-yang-harus-dihindari)

---

## 1. Peta Arsitektur — File Mana Ngapain

```
index.html                  Semua screen (sebagai <section>), semua modal
service-worker.js           Daftar file yang di-cache untuk mode offline (PWA)
manifest.json               Metadata PWA (nama, ikon, warna tema)

css/
  style.css                 Reset, variabel warna/font, global (termasuk anti-select/anti-copy)
  menu.css                  Semua screen non-battle (menu, formasi, draft, roster, modal)
  character.css              Character card, class badge, filter, detail modal
  battle.css                 Layar battle, action menu, resource badge, tooltip
  responsive.css              Breakpoint portrait/landscape

js/
  config.js                  ARENAS, CAMPAIGN_STAGES, ACHIEVEMENT_DEFS, ROLE_META, AI_FORMATION_TEMPLATES
  characters.js               Data 50 karakter: stat dasar, passive, 4 skill (basic/skill1/skill2/ultimate)
  balance.js                  Class template (stat per-class), attack type, defense lean, evasion — SUMBER KEBENARAN TUNGGAL untuk power level
  status-effects.js           Semua status (buff/debuff/CC/DoT/HoT), definisi STATUS_DEFS + StatusEngine
  combat.js                   Rumus damage, crit, evasion, shield, heal — CombatEngine
  targeting.js                Aturan target per targetType, formasi 12-slot, auto-arrange — TargetingEngine
  ai-scoring.js                Threat score, kill confirm, overkill avoidance untuk AI Expert/Master
  character-mechanics.js       SEMUA mekanik unik per-karakter (resource, summon, reposisi, dll) — CharacterMechanics
  skills.js                   Eksekusi skill generik per type (damage/heal/shield/buff/debuff/special) — SkillSystem
  turn-manager.js             Urutan giliran (speed-based), cek victory/defeat — TurnManager
  ai.js                       AI decision-making per difficulty, draft tim Master/Ranked — AISystem
  battle.js                   BattleEngine: kelas utama yang menjalankan satu pertandingan
  storage.js                  localStorage wrapper (save game)
  audio.js                    Semua SFX & musik (synthesized, tanpa file audio)
  assets.js                   Fallback loading gambar karakter (foto → ikon generated → emoji)
  ui.js                       Semua rendering DOM (kartu karakter, battle slot, formasi, dll) — UI
  app.js                      Controller utama: navigasi, alur tiap mode, wiring semua event — App
```

**Alur data satu arah yang penting untuk dipahami:**

```
characters.js (data mentah)
     ↓
balance.js (menormalisasi stat sesuai class, jalan sekali saat load)
     ↓
battle.js (bikin "actor" dari character + posisi formasi)
     ↓
skills.js + character-mechanics.js (eksekusi skill, resolve event)
     ↓
ui.js (render event jadi tampilan)
```

---

## 2. Menambah Karakter Baru

### Langkah 1 — Tambahkan entri di `js/characters.js`

Buka `js/characters.js`, tambahkan objek baru ke array `CHARACTERS` (di baris paling akhir sebelum
`];`). Contoh minimal, karakter tanpa mekanik unik (hanya damage/heal/buff/debuff standar):

```js
{
  id: 'frost_archer',                 // WAJIB unik, huruf kecil, gunakan dash/underscore
  name: 'Frost Archer',
  role: 'Ranged',                     // WAJIB salah satu dari 6: Tank, Fighter, Assassin, Ranged, Mage, Support
  icon: '❄️',                          // Emoji fallback jika foto tidak ada
  color: '#7fb3e0',                   // Warna aksen (border avatar, badge, dll)
  difficulty: 'Normal',               // Easy / Normal / Hard / Master — cuma label UI, tidak memengaruhi stat
  base: { hp: 0, attack: 0, defense: 0, speed: 0, critRate: 0, critDmg: 0 }, // ISI ANGKA APAPUN — akan DITIMPA oleh balance.js sesuai class, lihat #9
  description: 'A ranger who tips every arrow in frost.',
  strengths: ['Consistent single-target pressure', 'Slows targets it hits'],
  weaknesses: ['Fragile', 'No burst window'],
  passive: { name: 'Frostbite', desc: '+10% damage against Slowed targets.' },
  basicAttack: { id: 'frost_shot', name: 'Frost Shot', type: 'damage', targetType: 'single_enemy', power: 1.0, energyGain: 10,
    statuses: [{ id: 'slow', duration: 2, chance: 30 }] },
  skill1: { id: 'ice_volley', name: 'Ice Volley', type: 'damage', targetType: 'front_row', power: 0.85, cooldown: 3, energyGain: 15,
    statuses: [{ id: 'slow', duration: 2, chance: 60 }], desc: 'Volley of icy arrows across the Front Row, slowing them.' },
  skill2: { id: 'piercing_frost', name: 'Piercing Frost', type: 'damage', targetType: 'single_back', power: 1.3, cooldown: 3, energyGain: 15,
    desc: 'Snipes the Back Row.' },
  ultimate: { id: 'blizzard', name: 'Blizzard', type: 'damage', targetType: 'all_enemy', power: 1.2,
    statuses: [{ id: 'slow', duration: 2, chance: 90 }], desc: 'Calls a blizzard on the whole enemy team.' },
},
```

### Field yang wajib ada (kalau lupa satu saja, karakter bisa crash atau tidak tampil benar):

| Field | Keterangan |
|---|---|
| `id` | Unik di seluruh roster. Dipakai untuk file asset, save game, dan referensi internal. |
| `name`, `role`, `icon`, `color`, `difficulty` | Metadata tampilan. `role` **harus** salah satu dari 6 class resmi. |
| `base` | Objek stat — isi apa saja, akan **selalu ditimpa otomatis** oleh `balance.js` berdasarkan `role`. Lihat [§9](#9-sistem-balance-class-template). |
| `description`, `strengths`, `weaknesses` | Ditampilkan di layar detail karakter. |
| `passive` | `{ name, desc }` — deskripsi saja, TIDAK otomatis berefek. Kalau passive-nya harus benar-benar ngasih bonus, lihat [§4](#4-menambah-mekanik-kustom-skill-unik). |
| `basicAttack`, `skill1`, `skill2`, `ultimate` | 4 skill wajib, masing-masing dengan `id` unik (tidak boleh sama dengan skill karakter lain manapun!). |

### Struktur satu skill

```js
{
  id: 'skill_id_unik',        // WAJIB unik di SELURUH game (200+ skill lain sudah pakai banyak nama)
  name: 'Nama Tampil',
  type: 'damage',              // damage | heal | shield | buff | debuff | special
  targetType: 'single_enemy',  // lihat tabel targetType di bawah
  power: 1.0,                  // multiplier terhadap Attack — 1.0 = "normal", makin tinggi makin kuat
  cooldown: 3,                 // HANYA untuk skill1/skill2. basicAttack tidak punya cooldown. ultimate pakai Energy, bukan cooldown.
  energyGain: 15,               // energy yang didapat SAAT skill ini dipakai (basicAttack biasanya 10, skill 15, ultimate tidak perlu field ini)
  statuses: [{ id: 'poison', duration: 3, chance: 70 }],  // opsional, status yang mungkin ter-apply ke target
  desc: 'Deskripsi lengkap yang muncul saat tombol skill di-hold.',
}
```

### Tabel `targetType` yang tersedia

| targetType | Target |
|---|---|
| `single_enemy` | 1 musuh, prioritas Front Row dulu (row protection berlaku) |
| `single_front` / `single_middle` / `single_back` | 1 musuh khusus di row tersebut |
| `any_enemy` | 1 musuh manapun, row protection tidak berlaku (backline access) |
| `front_row` / `middle_row` / `back_row` | Semua musuh di 1 row tersebut (AoE parsial) |
| `all_enemy` | Semua musuh |
| `adjacent_enemies` | 1 target + tetangga sebelahnya (AoE kecil) |
| `single_ally` | 1 sekutu (untuk heal/buff) |
| `all_ally` | Semua sekutu |
| `self` | Diri sendiri |

### `type` skill dan apa yang otomatis terjadi

| type | Efek otomatis |
|---|---|
| `damage` | Hitung damage pakai `power`, terapkan crit/evasion/row-protection, terapkan `statuses` jika ada |
| `heal` | Heal sebesar `power × Attack`, terapkan `statuses` jika ada (biasanya buff) |
| `shield` | Beri shield sebesar formula (lihat `skills.js`), terapkan `statuses` jika ada |
| `buff` | HANYA terapkan `statuses` ke target (tidak damage/heal) |
| `debuff` | HANYA terapkan `statuses` ke target, TAPI kalau `power > 0` juga damage (jadi bisa "damage + debuff" sekaligus) |
| `special` | Tidak melakukan apa-apa otomatis — WAJIB dikombinasikan dengan handler kustom di `character-mechanics.js`, lihat [§4](#4-menambah-mekanik-kustom-skill-unik) |

### Langkah 2 — Registrasikan di `balance.js` (WAJIB, jangan sampai lupa!)

Buka `js/balance.js`, tambahkan `id` karaktermu ke **3 tabel**:

```js
// 1. Attack Type — apakah skill-nya dicek lawan Physical Defense atau Magical Defense musuh
const ATTACK_TYPE_MAP = {
  // ... cari section sesuai role-nya, misal 'Ranged'
  archer: 'physical', ranger: 'physical', /* tambahkan di sini: */ frost_archer: 'physical',
};

// 2. Evasion override — OPSIONAL, hanya kalau karaktermu secara tema lebih/kurang lincah dari rata-rata class-nya
const EVASION_OVERRIDES = {
  illusionist: 14,
  // frost_archer: 9,  // contoh kalau mau di atas baseline Ranged (default 11)
};

// 3. Defense Lean — OPSIONAL, menentukan apakah lebih tahan fisik atau magis (tapi total defense TETAP SAMA dengan sesama class)
const DEFENSE_LEAN = {
  // ... section Ranged
  archer: 0.02, ranger: -0.05, /* tambahkan: */ frost_archer: -0.03, // negatif = sedikit lebih magis-resistant dari baseline Ranged
};
```

> **Kalau kamu tidak menambahkan `id` ke `ATTACK_TYPE_MAP`, karaktermu otomatis dianggap `physical`
> attacker** (aman, tidak crash), dan kalau tidak menambahkan ke `EVASION_OVERRIDES`/`DEFENSE_LEAN`
> otomatis pakai nilai default class-nya (juga aman). Tapi sebaiknya tetap diisi secara sadar
> supaya konsisten dengan tema karaktermu.

### Langkah 3 — (Opsional) Tambah gambar karakter

Lihat [§3](#3-menambah-aset-karakter-gambar) di bawah.

### Langkah 4 — (Opsional) Tambah mekanik unik

Kalau karaktermu punya resource khusus (seperti Ki, Rage, Rune) atau efek yang tidak bisa
diwakili oleh `damage`/`heal`/`buff`/`debuff` standar, lihat [§4](#4-menambah-mekanik-kustom-skill-unik).

### Langkah 5 — Test

```bash
node --check js/characters.js   # pastikan tidak ada typo syntax
```

Lalu jalankan test battle cepat (contoh script Node yang bisa kamu adaptasi — lihat [§12](#12-testing-checklist)
untuk template lengkapnya):

```js
const { BattleEngine } = /* ...load semua js/*.js lewat vm, lihat §12... */;
const battle = new BattleEngine(['frost_archer','knight','cleric','archer','assassin'], ['wizard','gladiator','ninja','monk','soul_reaper'], 'normal', 'volcano');
// jalankan beberapa turn, pastikan tidak crash dan HP/energy masuk akal
```

---

## 3. Menambah Aset Karakter (Gambar)

1. Siapkan gambar **full-body portrait**, rasio disarankan **3:4** (potret), format **PNG**.
2. Beri nama file **PERSIS sama dengan `id` karakter, tapi ganti underscore (`_`) dengan dash (`-`)**
   dan huruf kecil semua. Contoh:
   - `id: 'frost_archer'` → nama file **`frost-archer.png`**
   - `id: 'blood-knight'` → nama file **`blood-knight.png`** (sudah pakai dash, tidak berubah)
3. Taruh di folder `assets/characters/`.
4. Refresh aplikasi. Game otomatis membaca file ini (lewat `js/assets.js`) — **tidak perlu ubah kode apapun**.
5. Kalau file tidak ada / gagal dimuat, game otomatis fallback ke ikon generated (emoji + gradient
   warna dari field `color`) — **tidak akan pernah menampilkan gambar patah**.

> Kenapa dash bukan underscore? Karena beberapa karakter lama pakai `id` dengan underscore
> (`demon_hunter`, `frost_knight`, dst) sementara konvensi nama file dari awal pakai dash. Fungsi
> normalisasi di `assets.js` menangani ini otomatis — kamu tinggal ikuti aturan penamaan file di atas.

---

## 4. Menambah Mekanik Kustom (Skill Unik)

Kalau skill karaktermu butuh logika yang tidak bisa diwakili field standar (`power`, `statuses`),
misalnya:
- Resource khusus (seperti Ki, Rage, Rune, Soul)
- Memanggil summon
- Player harus memilih sesuatu (jumlah HP, slot di grid, jenis rune)
- Efek yang bergantung pada state lain (jumlah sekutu jatuh, row tertentu, dll)

Kamu perlu menulis **handler kustom** di `js/character-mechanics.js`.

### Cara kerja sistem hook

Setiap skill yang di-cast, setelah efek standarnya (damage/heal/dst) selesai, sistem otomatis
memanggil:

```js
CharacterMechanics.onSkillCast(actor, skillDef, targets, events, ctx)
```

Fungsi ini mencari handler dengan nama **persis sama dengan `skillDef.id`** di dalam object
`CharacterMechanics._handlers`, dan memanggilnya kalau ada. Jadi kamu cukup tambahkan:

```js
// di dalam _handlers: { ... }, taruh di section paling bawah sebelum penutup
frostbite_nova(actor, skillDef, targets, events, ctx) {
  // actor = karakter yang cast skill
  // skillDef = definisi skill dari characters.js
  // targets = array actor yang kena efek standar (bisa kosong kalau targetType 'self')
  // events = array event yang akan ditampilkan di battle log — PUSH ke sini, jangan replace
  // ctx = { allActors, fallenCount, battle, chosenSlot, sacrificeAmount, chosenRune, ... }

  targets.forEach(t => {
    if (t.isDead) return;
    StatusEngine.apply(t, 'freeze', 1, actor.id);
    events.push({ type: 'status', actor: actor.id, target: t.id, statusId: 'freeze',
      text: `${t.name} is frozen solid!` });
  });
},
```

### Resource kustom (pola Ki/Rage/Rune)

Tambahkan field baru ke `initActorState(actor)` di bagian atas `character-mechanics.js`:

```js
initActorState(actor) {
  actor.mech = {
    // ...field yang sudah ada...
    myResource: 0,   // TAMBAHKAN DI SINI, beri komentar nama karakternya
  };
  ...
},
```

Lalu buat fungsi gain/spend (contoh dari Ki milik Monk):

```js
gainMyResource(actor, amount) { if (actor.mech) actor.mech.myResource = Math.min(100, actor.mech.myResource + amount); },
spendMyResource(actor, amount) { if (actor.mech) actor.mech.myResource = Math.max(0, actor.mech.myResource - amount); },
```

Panggil `gainMyResource`/`spendMyResource` dari handler skill terkait, atau dari `skills.js` kalau
resource-nya perlu di-gain otomatis setiap serangan (lihat contoh Gladiator/Monk di `skills.js`
bagian awal fungsi `resolve()`).

**Supaya resource-nya tampil di kotak karakter saat battle**, tambahkan entri di `js/ui.js`, fungsi
`getResourceDisplay(actor)`:

```js
if (id === 'karaktermu') return { label: 'MY RESOURCE', text: `${mech.myResource}/100`, pct: mech.myResource, cls: 'res-generic' };
```

### Interaksi player (slot-picker, amount-picker, rune-picker)

Game ini sudah punya 3 pola interaksi siap pakai di `js/app.js`:

1. **Slot-picker** (pilih kotak kosong di grid) — dipakai Engineer, Necromancer, Beastmaster, Void Walker.
   Tambahkan `skillDef.id` kamu ke array `App.SLOT_PICK_SKILLS`. Handler kamu di
   `character-mechanics.js` lalu baca `ctx.chosenSlot` (`{row, column}` atau `null` kalau AI yang cast).

2. **Amount-picker** (slider pilih angka) — dipakai Shadow Priest.
   Tambahkan entri ke `App.AMOUNT_PICK_SKILLS`:
   ```js
   my_skill_id: { label: 'Deskripsi yang muncul di slider', ratio: 2 }, // ratio hanya untuk teks preview
   ```
   Handler kamu baca `ctx.sacrificeAmount` (angka, atau `null`/`undefined` kalau AI — sediakan fallback!).

3. **Custom picker** (contoh: Rune Master pilih Fire/Guard/Wind) — lihat `App.openRunePicker()` di
   `app.js` sebagai referensi kalau butuh UI pilihan custom serupa (bikin modal baru di `index.html`,
   pola serupa `#rune-picker-modal`).

**PENTING:** Untuk AI (musuh atau karakter yang dikendalikan AI), `ctx.chosenSlot`/`ctx.sacrificeAmount`/
`ctx.chosenRune` akan selalu `null`/`undefined` karena AI tidak melewati UI picker. **Handler kamu
WAJIB punya fallback default** kalau nilai ini kosong (lihat contoh Shadow Priest atau Rune Master's
`inscribeRune()` — selalu ada fallback rotasi/persentase tetap).

### Menambah status effect baru

Kalau butuh status baru (misal efek unik yang belum ada), tambahkan ke `STATUS_DEFS` di
`js/status-effects.js`:

```js
my_new_status: { name: 'Nama Tampil', icon: '✨', kind: 'stat', stackable: false, maxStacks: 1, category: 'buff', stat: 'attack', percent: 20 },
```

`kind` yang tersedia:
- `'stat'` — modifikasi stat (butuh `stat` dan `percent`) — attack/speed/physicalDefense/magicalDefense/evasion/critRate
- `'dot'` / `'hot'` — damage/heal per turn (butuh `tickPercent`)
- `'cc'` — crowd control (kalau bikin skip giliran, tambahkan `skipTurn: true`)
- `'special'` — logika custom sepenuhnya, ditangani manual di `combat.js`/`skills.js`

---

## 5. Menambah Lokasi Pertarungan (Arena)

Arena di game ini **tidak butuh gambar** — cukup gradient warna CSS. Buka `js/config.js`:

```js
const ARENAS = [
  { id: 'medieval-castle', name: 'Medieval Castle', gradient: ['#2b2440', '#4a3b63'] },
  // ...arena lain...
  { id: 'sky-temple', name: 'Sky Temple', gradient: ['#1a2b4a', '#3d5a8c'] },  // TAMBAHKAN DI SINI
];
```

Itu saja — arena baru otomatis muncul di layar "Choose Arena" (`openArenaSelect()` di `app.js`
membaca array ini secara dinamis, tidak ada hardcode).

**Kalau mau arena punya gambar background sungguhan** (bukan cuma gradient), tambahkan field
`backgroundImage: 'assets/arenas/sky-temple.jpg'` lalu update `openArenaSelect()` di `app.js` untuk
memakai `background-image` alih-alih `background: linear-gradient(...)` kalau field ini ada
(sediakan fallback ke gradient kalau gambar gagal dimuat, konsisten dengan pola fallback aset lain
di game ini).

---

## 6. Menambah Stage Campaign

Buka `js/config.js`, tambahkan ke array `CAMPAIGN_STAGES`:

```js
const CAMPAIGN_STAGES = [
  // ...stage 1-5 yang sudah ada...
  { stage: 6, name: 'Sky Temple Ascension', arena: 'sky-temple', difficulty: 'expert',
    enemyTeam: ['mirror_knight', 'rune_master', 'shadow_priest', 'void_walker', 'dragon_knight'],
    rewardXP: 400 },
];
```

| Field | Keterangan |
|---|---|
| `stage` | Nomor urut, dipakai untuk urutan tampilan |
| `name` | Judul stage |
| `arena` | Harus `id` arena yang valid dari `ARENAS` |
| `difficulty` | `easy` / `normal` / `hard` / `expert` / `master` — menentukan kecerdasan AI |
| `enemyTeam` | Array 5 `id` karakter (formasi otomatis diatur `TargetingEngine.buildAutoFormation`) |
| `rewardXP` | XP yang didapat saat menang |

Tidak perlu perubahan kode lain — layar Campaign (`openCampaign()` di `app.js`) membaca array ini
secara dinamis, termasuk logika "stage terkunci sampai stage sebelumnya menang".

---

## 7. Menambah Mode Permainan Baru

Setiap mode di game ini (Quick Battle, Ranked, Campaign, Practice) mengikuti pola yang sama:

```
Main Menu button (data-nav)
   ↓
App.navigate() routing di app.js
   ↓
Screen alur mode (bisa pakai ulang Team Builder / Formation, atau screen baru)
   ↓
App.launchBattle(playerFormation, enemyFormation) → BattleEngine baru dibuat
   ↓
Battle screen (dipakai bersama SEMUA mode, tidak perlu dibuat ulang)
   ↓
Result screen (dipakai bersama SEMUA mode)
```

### Contoh: menambah mode "Survival" (menang beruntun lawan tim makin kuat)

**Langkah 1 — Tombol menu.** Di `index.html`, tambahkan ke `#screen-main-menu`:
```html
<button class="btn btn-secondary" type="button" data-nav="survival">Survival</button>
```

**Langkah 2 — Routing.** Di `js/app.js`, fungsi `navigate()`:
```js
if (target === 'survival') { this.openSurvivalIntro(); return; }
```

**Langkah 3 — Alur mode.** Tulis fungsi baru di `app.js` mengikuti pola mode lain. Untuk mode yang
butuh Team Builder standar (pilih 5 karakter lalu atur formasi), pakai ulang fungsi yang sudah ada:
```js
openSurvivalIntro() {
  this.mode = 'survival';
  this.survivalWins = 0;
  this.difficulty = 'normal'; // bisa naik otomatis tiap menang, lihat startNextSurvivalRound()
  this.openTeamBuilder();  // TIDAK PERLU ditulis ulang — sudah ada, cukup pastikan this.mode sudah diset
},
```

**Langkah 4 — Override titik keputusan tim musuh.** Kalau mode-mu butuh logika enemy team yang
berbeda dari Quick Battle biasa (seperti Ranked pakai `this.rankedEnemyTeam`), tambahkan cabang
serupa di `openArenaSelect()`'s tombol arena, atau buat fungsi `launchBattle` versi sendiri:
```js
// di dalam handler klik arena-card, sudah ada pola if/else untuk mode 'ranked' — tambahkan cabang serupa:
if (this.mode === 'survival') {
  enemyTeam = this.buildSurvivalEnemyTeam(this.survivalWins); // fungsi baru, makin banyak menang makin kuat
}
```

**Langkah 5 — Hook hasil battle.** Cari fungsi `endBattle(result)` di `app.js` (dipanggil
setelah battle selesai untuk SEMUA mode, dengan `result` berisi `'victory'` atau `'defeat'`),
tambahkan cabang untuk mode-mu:
```js
if (this.mode === 'survival' && victory) {
  this.survivalWins++;
  // tampilkan tombol "Continue to Round N+1" alih-alih tombol biasa
}
```

> **Prinsip penting:** Battle screen, Formation screen, dan Result screen SELALU dipakai bersama
> oleh semua mode. Jangan buat screen battle baru — cukup atur `this.mode` sebagai penanda, lalu
> cabangkan logika di titik-titik keputusan (`openArenaSelect`, `endBattle`, dst) berdasarkan nilai
> `this.mode` itu, persis seperti pola `if (this.mode === 'ranked')` yang sudah ada.

---

## 8. Menambah Fitur Baru (Umum)

Tidak ada resep tunggal untuk "fitur baru", tapi berikut pola-pola yang sudah dipakai di game ini
dan sebaiknya diikuti supaya konsisten:

- **UI baru (modal, tombol, layar)**: tambahkan HTML di `index.html`, style di file CSS yang sesuai
  konteksnya (`menu.css` untuk non-battle, `battle.css` untuk battle), lalu wiring event di `app.js`
  lewat fungsi `wireXxx()` yang dipanggil dari `init()`.
- **Perubahan aturan battle** (damage formula, evasion, dll): selalu di `combat.js` (`CombatEngine`),
  JANGAN sebar logika damage ke file lain.
- **Perubahan aturan target**: selalu di `targeting.js` (`TargetingEngine`).
- **Perubahan urutan giliran / kondisi menang-kalah**: selalu di `turn-manager.js` (`TurnManager`).
- **State per-pertandingan yang perlu dibagi ke banyak skill** (seperti `globalFreeze` milik
  Chronomancer): taruh sebagai properti langsung di `BattleEngine` (`this.xxx` di constructor
  `battle.js`), lalu akses lewat `ctx.battle.xxx` di handler manapun (karena `ctx.battle` selalu
  diteruskan — lihat `_resolveAction()` di `battle.js`).
- **Selalu jalankan test setelah perubahan** — lihat [§12](#12-testing-checklist).

---

## 9. Sistem Balance (Class Template)

**JANGAN PERNAH edit angka stat (`hp`, `attack`, `defense`, dst) langsung di objek `base` pada
`characters.js`.** Semua karakter di 1 class (Tank/Fighter/Assassin/Ranged/Mage/Support) **wajib**
punya power budget yang sama, diatur terpusat di `js/balance.js`:

```js
const CLASS_BALANCE_TEMPLATE = {
  Tank:     { hp: 1250, attack: 96,  speed: 73,  defenseTotal: 236, critRate: 6,  critDmg: 150, evasion: 4,  physicalRatio: 0.55 },
  Fighter:  { hp: 1030, attack: 144, speed: 100, defenseTotal: 158, critRate: 13, critDmg: 162, evasion: 9,  physicalRatio: 0.60 },
  Assassin: { hp: 790,  attack: 135, speed: 105, defenseTotal: 110, critRate: 18, critDmg: 170, evasion: 10, physicalRatio: 0.58 },
  Ranged:   { hp: 870,  attack: 134, speed: 101, defenseTotal: 134, critRate: 17, critDmg: 162, evasion: 11, physicalRatio: 0.55 },
  Mage:     { hp: 830,  attack: 136, speed: 92,  defenseTotal: 122, critRate: 10, critDmg: 158, evasion: 7,  physicalRatio: 0.38 },
  Support:  { hp: 860,  attack: 86,  speed: 93,  defenseTotal: 128, critRate: 8,  critDmg: 150, evasion: 4,  physicalRatio: 0.42 },
};
```

Fungsi `applyClassBalance(CHARACTERS)` dipanggil **sekali** saat game load, menimpa `base.hp`,
`base.attack`, dst SEMUA karakter sesuai `role`-nya. Jadi:

- **Kalau mau buff/nerf 1 class secara keseluruhan** (misal semua Tank kurang kuat) → ubah angka di
  `CLASS_BALANCE_TEMPLATE`, otomatis berlaku ke semua karakter class itu.
- **Kalau mau buff/nerf 1 karakter spesifik** → JANGAN ubah stat dasarnya. Ubah lewat:
  - `power` di skill-nya (di `characters.js`)
  - `cooldown` skill-nya
  - Magnitude status yang di-apply (chance/duration di `statuses: [...]`)
  - Mekanik kustom di `character-mechanics.js` (kalau ada)
- **Variasi Physical/Magical Defense antar karakter sekelas** (biar tidak identik total) diatur di
  `DEFENSE_LEAN` — nilai positif = lebih tahan fisik, negatif = lebih tahan sihir, TAPI total
  defense budget-nya tetap sama dengan sesama class (lihat contoh Paladin vs Gladiator di komentar
  file `balance.js`).

Setelah ubah `balance.js`, **selalu jalankan test battle** untuk pastikan tidak ada karakter yang
jadi terlalu dominan/lemah (lihat [§12](#12-testing-checklist), khususnya bagian "test power per class").

---

## 10. Sistem Summon (Unit yang Bisa Ditarget)

Ada 2 jenis summon di game ini, pilih sesuai kebutuhan:

### A. Summon visual saja (seperti Turret Engineer, Totem Spirit Shaman)
Tidak bisa diserang musuh, cuma representasi visual dari buff/durability yang sudah ada. Pola:
`CharacterMechanics.findSummonSlot(owner, allActors)` untuk cari slot kosong, simpan `{row, column}`
di `actor.mech.xxxSlot`, lalu daftarkan di `getActiveSummons(allActors)` supaya ter-render.

### B. Summon nyata (seperti Skeleton Necromancer, Beast Beastmaster)
Unit sungguhan yang bisa diserang & mati, tapi TIDAK pernah dapat giliran sendiri. Pakai:

```js
const newSummon = ctx.battle.createSummon(owner, {
  name: 'Nama Unit', icon: '💀', color: '#c9c9c9',
  hp: 100, attack: 50, attackType: 'physical',
}, ctx.chosenSlot); // chosenSlot opsional, null = auto-pilih slot kosong

if (newSummon) {
  // simpan referensinya kalau perlu dipanggil lagi nanti, contoh:
  owner.mech.mySummonId = newSummon.id;
}
```

Summon jenis B otomatis:
- Bisa ditarget lewat `TargetingEngine` (karena benar-benar masuk `battle.actors`)
- TIDAK PERNAH dapat giliran sendiri (dikecualikan di `TurnManager.livingActors()`)
- TIDAK dihitung untuk menang/kalah (dikecualikan di `TurnManager.checkVictoryDefeat()`)
- Otomatis ter-render di grid battle (karena posisinya `{row, column}` sama seperti karakter biasa)

Untuk memicu summon ini menyerang bersamaan dengan pemiliknya, gunakan
`ctx.battle.livingSummonsOf(owner.id)` untuk ambil daftar summon yang masih hidup, lalu panggil
`CombatEngine.calculateDamage`/`CombatEngine.applyDamage` dengan `source` = summon tersebut (lihat
contoh lengkap fungsi `skeleton_attack` atau `command_beast` di `character-mechanics.js`).

### Summon yang mati bisa langsung di-summon ulang

Ini **sudah otomatis** untuk summon jenis B (`createSummon`) — tidak perlu kode tambahan. Alasannya:
`findSummonSlot()`/`TargetingEngine.findOpenSlot()` hanya menganggap slot terisi kalau ada actor
hidup (`!a.isDead`) di situ. Begitu summon lama mati (baik kena serangan musuh, atau di-hapus manual
lewat handler kayak `summon_beast`'s replace-logic), slotnya otomatis dianggap kosong lagi dan bisa
dipakai summon baru — walau actor lamanya sendiri masih ada di `battle.actors` (memang sengaja
tidak dihapus dari array, cuma ditandai `isDead: true`, supaya tidak mengacaukan index/referensi
lain yang mungkin masih menunjuk ke situ).

**Yang perlu kamu jaga saat menulis handler cast baru**: kalau karaktermu punya field referensi ke
summon-nya sendiri (pola `owner.mech.xxxId = summon.id`, seperti `beastId` milik Beastmaster),
JANGAN asumsikan field itu selalu menunjuk ke summon yang masih hidup. Selalu cek ulang:
```js
const summon = ctx.allActors.find(a => a.id === owner.mech.xxxId && !a.isDead);
if (!summon) { /* sudah mati atau belum pernah disummon - tangani dengan aman */ }
```
Lihat contoh nyata di handler `command_beast` dan hook passive Beastmaster di `skills.js`.

---

## 11. Menambah Achievement

Buka `js/config.js`, tambahkan ke `ACHIEVEMENT_DEFS`:

```js
const ACHIEVEMENT_DEFS = [
  // ...achievement yang sudah ada...
  { id: 'summon_master', name: 'Summon Master', desc: 'Have 3 summons alive at once.' },
];
```

Lalu cari titik yang sesuai di `js/app.js` untuk memanggil:
```js
this.unlockAchievement('summon_master');
```

Fungsi `unlockAchievement(id)` sudah menangani: cek duplikat, simpan ke save game, tampilkan toast
notifikasi. Kamu tinggal panggil di kondisi yang tepat (biasanya di dalam `playEvents()` saat
memproses event battle, atau di `endBattle()` setelah battle selesai).

---

## 12. Testing Checklist

Game ini **tidak punya test runner otomatis** (murni vanilla JS, tanpa build step), jadi semua
testing dilakukan lewat script Node.js sekali-pakai yang me-load file game via `vm` module. Berikut
template yang bisa kamu adaptasi (simpan sebagai `test.js` lalu `node test.js`):

```js
const fs = require('fs');
const vm = require('vm');
const files = [
  'js/config.js','js/characters.js','js/balance.js','js/status-effects.js','js/combat.js',
  'js/targeting.js','js/ai-scoring.js','js/character-mechanics.js','js/skills.js',
  'js/turn-manager.js','js/ai.js','js/battle.js',
];
let combined = files.map(f => fs.readFileSync(f, 'utf8')).join('\n;\n');
combined += '\n;({CHARACTERS, BattleEngine, AISystem, TargetingEngine, getCharacterById})';
const sandbox = { console };
vm.createContext(sandbox);
const { CHARACTERS, BattleEngine, AISystem, TargetingEngine, getCharacterById } = vm.runInContext(combined, sandbox, { filename: 'test.js' });

// === CEK DASAR: karakter baru terdaftar dengan benar ===
console.log('Total karakter:', CHARACTERS.length);
const ids = CHARACTERS.map(c => c.id);
console.log('Tidak ada ID duplikat:', new Set(ids).size === ids.length);

// === STRESS TEST: banyak battle acak, cek crash & slot collision ===
let crashes = 0;
for (let i = 0; i < 200; i++) {
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  const p = shuffled.slice(0, 5), e = shuffled.slice(5, 10);
  try {
    const pf = TargetingEngine.buildAutoFormation(p);
    const ef = TargetingEngine.buildAutoFormation(e);
    const battle = new BattleEngine(pf, ef, ['easy','normal','hard','expert','master'][i % 5], 'volcano');
    let guard = 0;
    while (battle.status === 'active' && guard < 4000) {
      guard++;
      const begin = battle.beginTurn();
      if (begin.result || !begin.actor) break;
      if (begin.skipped) continue;
      if (begin.actor.side === 'enemy') battle.runEnemyTurn();
      else {
        const decision = AISystem.decide(begin.actor, battle.actors, 'hard');
        if (!decision) battle.submitPlayerAction('defend', null);
        else battle.submitPlayerAction(decision.actionKey, decision.target ? decision.target.id : null);
      }
      // Validasi invariant penting:
      battle.actors.forEach(a => {
        if (Number.isNaN(a.hp) || a.hp < 0) throw new Error('HP invalid: ' + a.id);
        if (a.position.column < 0 || a.position.column > 3) throw new Error('Kolom di luar 0-3: ' + a.id);
      });
      const slots = {};
      battle.actors.filter(a => !a.isDead).forEach(a => {
        const key = a.side + '-' + a.position.row + '-' + a.position.column;
        if (slots[key]) throw new Error('TABRAKAN SLOT: ' + key);
        slots[key] = a.id;
      });
    }
  } catch (err) {
    crashes++;
    console.log('CRASH:', err.message);
  }
}
console.log('Crash:', crashes, '/ 200');
```

### Checklist manual setelah menambah konten:

- [ ] `node --check js/namafile.js` untuk setiap file yang diubah (cek syntax error)
- [ ] Jalankan stress test di atas — pastikan 0 crash, 0 tabrakan slot
- [ ] Kalau nambah karakter: pastikan `id`-nya tidak duplikat, dan `id` setiap skill juga tidak duplikat
- [ ] Kalau nambah mekanik dengan resource: cek resource tidak pernah negatif atau melebihi cap
- [ ] Kalau nambah reposisi/summon: cek tidak ada 2 unit menumpuk di slot yang sama (lihat validasi
      "TABRAKAN SLOT" di script di atas — ini bug nyata yang pernah terjadi sebelumnya!)
- [ ] Buka `index.html` lewat local server (`python3 -m http.server`) dan cek visual manual di browser
- [ ] Kalau nambah UI baru: pastikan semua `id` HTML yang direferensikan di JS benar-benar ada di `index.html`

---

## 13. Kesalahan Umum yang Harus Dihindari

1. **Lupa `id` skill unik** — kalau 2 karakter pakai `id` skill yang sama, event/animasi/passive-check
   yang berbasis `skillDef.id` bisa saling tabrakan secara diam-diam (tidak selalu crash, tapi bug
   halus). Selalu grep dulu: `grep -rn "id: 'skill_id_kamu'" js/characters.js`.

2. **Edit `base` stat langsung di `characters.js`** — akan selalu ditimpa oleh `balance.js`, jadi
   perubahanmu tidak akan pernah terlihat. Selalu lewat `CLASS_BALANCE_TEMPLATE`, `DEFENSE_LEAN`,
   atau `EVASION_OVERRIDES`.

3. **Reposisi karakter tanpa cek slot kosong** — kalau bikin skill yang memindah row karakter,
   SELALU pakai `CharacterMechanics.reposition(actor, direction, ctx.allActors)` (dengan parameter
   ketiga!), bukan langsung `actor.position = {...}`. Tanpa `allActors`, fungsi ini tidak bisa cek
   tabrakan kolom dan bisa membuat 2 unit menumpuk di kotak yang sama (bug nyata yang pernah terjadi).

4. **Lupa fallback untuk AI** — kalau skill-mu butuh input player (`ctx.chosenSlot`,
   `ctx.sacrificeAmount`, dll), AI TIDAK PERNAH mengisi nilai ini. Handler kamu wajib punya default
   yang masuk akal kalau nilai-nilai ini kosong, atau AI akan softlock/skill jadi tidak berefek.

5. **Membuat summon baru tanpa exclude dari turn order** — kalau bikin unit summon jenis "nyata"
   (lihat [§10](#10-sistem-summon-unit-yang-bisa-ditarget)), SELALU pakai `battle.createSummon()`
   (bukan bikin actor manual), supaya otomatis ter-exclude dari giliran dan kondisi menang/kalah.

6. **Menambah class ke-7** — game ini sengaja dibatasi **6 class resmi** (Tank/Fighter/Assassin/
   Ranged/Mage/Support). Kalau butuh varian gameplay baru, gunakan mekanik kustom di
   `character-mechanics.js`, bukan bikin class baru — akan merusak `CLASS_BALANCE_TEMPLATE` dan
   seluruh filter/badge UI yang mengasumsikan tepat 6 class.

7. **Lupa cek `MAX_PER_ROW`** — grid battle tetap 12 kotak (4 per row), tidak bisa ditumpuk. Kalau
   nulis logika penempatan sendiri (bukan lewat `TargetingEngine.findOpenSlot`/`createSummon`),
   selalu hormati batas 4 per row.

8. **Menambah item HTML baru tanpa cek `id` unik** — `document.getElementById()` akan diam-diam
   mengembalikan elemen pertama yang cocok kalau ada duplikat `id`, menyebabkan bug yang sangat
   membingungkan untuk di-debug. Selalu pastikan `id` di `index.html` unik di seluruh file.

---

*Dokumen ini ditulis berdasarkan struktur kode Ponti Arena per revisi terakhir. Kalau ada bagian
arsitektur yang berubah signifikan di masa depan, update juga bagian [§1](#1-peta-arsitektur--file-mana-ngapain)
supaya tetap akurat sebagai peta navigasi.*
