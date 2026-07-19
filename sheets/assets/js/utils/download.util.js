/**
 * download.util.js — helper unduh file generik (dipakai export.service.js,
 * excel-writer.service.js, dan tempat lain yang butuh trigger download).
 */

export function downloadBlob(filename, data, mime = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
