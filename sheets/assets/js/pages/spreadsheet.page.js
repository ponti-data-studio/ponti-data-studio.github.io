import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { googleAuthService } from "../services/google-auth.service.js";
import { sheetsService } from "../services/sheets.service.js";
import { showToast } from "../components/toast.component.js";
import { formatDate } from "../utils/format.util.js";
import { renderSkeletonList } from "../components/skeleton.component.js";

export async function renderSpreadsheetPage(navigate) {
  const state = appState.get();

  const container = el("div", { class: "page page--spreadsheet" });
  const listHost = el("div", { class: "spreadsheet-list" });

  async function refreshList(query = "") {
    clear(listHost);
    listHost.appendChild(renderSkeletonList(5));
    try {
      const files = await sheetsService.listSpreadsheets(query);
      clear(listHost);
      appState.set({ spreadsheets: files });
      if (files.length === 0) {
        listHost.appendChild(el("p", { class: "empty-state" }, "Tidak ada spreadsheet ditemukan."));
        return;
      }
      files.forEach((f) => {
        const isActive = state.activeSpreadsheet?.id === f.id;
        listHost.appendChild(
          el("button", { class: `spreadsheet-item ${isActive ? "spreadsheet-item--active" : ""}` , onClick: () => {
            appState.set({ activeSpreadsheet: { id: f.id, name: f.name } });
            showToast(`Spreadsheet "${f.name}" dipilih`, "success");
            navigate("analysis");
          }}, [
            el("span", { class: "spreadsheet-item__icon", html: icon("table", { size: 18 }) }),
            el("div", { class: "spreadsheet-item__meta" }, [
              el("div", { class: "spreadsheet-item__name" }, f.name),
              el("div", { class: "spreadsheet-item__sub" }, `Diubah ${formatDate(f.modifiedTime)}`),
            ]),
          ])
        );
      });
    } catch (err) {
      clear(listHost);
      listHost.appendChild(el("p", { class: "error-state" }, `Gagal memuat: ${err.message}`));
    }
  }

  if (!state.session) {
    container.appendChild(
      el("div", { class: "auth-panel card" }, [
        el("h2", {}, "Login dengan Google"),
        el("p", { class: "muted" }, "Ponti Sheets butuh izin akses ke Google Sheets & Drive Anda untuk menganalisis struktur data, dan juga untuk membuat spreadsheet baru lewat fitur Database Builder."),
        el("p", { class: "hint" }, "Fitur Analyze/Database Context/ERD/Prompt Builder hanya membaca data Anda. Ponti Sheets hanya benar-benar menulis ke spreadsheet saat Anda menekan tombol \"Generate Google Sheets\" di menu Database Builder."),
        el("button", { class: "btn btn--google", onClick: async (e) => {
          const btn = e.currentTarget;
          const originalContent = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = "";
          btn.appendChild(el("span", { class: "spinner" }));
          btn.appendChild(el("span", {}, "Menghubungkan ke Google..."));
          try {
            const session = await googleAuthService.login();
            appState.set({ session });
            showToast("Login berhasil", "success");
            navigate("spreadsheet");
          } catch (err) {
            showToast(err.message, "error");
            btn.disabled = false;
            btn.innerHTML = originalContent;
          }
        }}, [
          el("span", { html: icon("google", { size: 16 }) }),
          el("span", {}, "Login dengan Google"),
        ]),
        el("p", { class: "hint" }, "Belum konfigurasi Google Client ID? Buka menu Settings → Google OAuth."),
      ])
    );
    return container;
  }

  const searchBar = el("div", { class: "search-bar" }, [
    el("span", { html: icon("search-check", { size: 16 }) }),
    el("input", {
      type: "text", placeholder: "Cari spreadsheet...",
      onInput: (e) => refreshList(e.target.value),
    }),
  ]);

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Pilih Spreadsheet"),
    el("p", { class: "muted" }, "Pilih Google Spreadsheet yang akan dianalisis menjadi Database Context."),
  ]));
  container.appendChild(searchBar);
  container.appendChild(listHost);

  refreshList();
  return container;
}
