import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { historyService } from "../services/history.service.js";
import { formatDate } from "../utils/format.util.js";
import { showToast } from "../components/toast.component.js";

export async function renderHistoryPage() {
  const container = el("div", { class: "page page--history" });
  const listHost = el("div", { class: "list" });

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "History"),
    el("p", { class: "muted" }, "Riwayat prompt & response yang pernah Anda buat."),
  ]));

  const clearBtn = el("button", { class: "btn btn--ghost", onClick: async () => {
    if (confirm("Hapus semua riwayat?")) {
      await historyService.clear();
      showToast("Riwayat dihapus", "success");
      renderList();
    }
  }}, [el("span", { html: icon("trash", { size: 14 }) }), "Hapus Semua"]);
  container.appendChild(el("div", { class: "toolbar" }, [clearBtn]));
  container.appendChild(listHost);

  async function renderList() {
    clear(listHost);
    const entries = await historyService.getAll();
    if (entries.length === 0) {
      listHost.appendChild(el("p", { class: "empty-state" }, "Belum ada riwayat."));
      return;
    }
    entries.forEach((entry) => {
      const details = el("div", { class: "history-details", style: "display:none" }, [
        el("h5", {}, "Prompt"),
        el("pre", { class: "prompt-box" }, entry.prompt),
        el("h5", {}, "Response"),
        el("pre", { class: "response-text" }, entry.response || "(belum ada response)"),
      ]);

      const card = el("div", { class: "card history-card" }, [
        el("div", { class: "history-card__header", onClick: () => {
          details.style.display = details.style.display === "none" ? "block" : "none";
        }}, [
          el("div", {}, [
            el("div", { class: "list__item-title" }, entry.spreadsheetName || "(tanpa nama)"),
            el("div", { class: "list__item-sub" }, `${entry.templateId} · ${entry.provider} · ${formatDate(entry.date)} · ~${entry.tokenEstimate} token`),
          ]),
          el("button", { class: "icon-btn", html: icon("trash", { size: 14 }), onClick: async (e) => {
            e.stopPropagation();
            await historyService.remove(entry.id);
            showToast("Entri dihapus", "success");
            renderList();
          }}),
        ]),
        details,
      ]);
      listHost.appendChild(card);
    });
  }

  await renderList();
  return container;
}
