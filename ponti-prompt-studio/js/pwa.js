/* =========================================================
   pwa.js — service worker registration
   ========================================================= */
(function () {
  "use strict";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // A new version is available; it will activate on next load.
                console.info("Ponti Prompt Studio: versi baru siap, akan aktif saat halaman dimuat ulang.");
              }
            });
          });
        })
        .catch((err) => {
          console.warn("Service worker gagal didaftarkan. Mode offline mungkin tidak tersedia.", err);
        });
    });
  }
})();
