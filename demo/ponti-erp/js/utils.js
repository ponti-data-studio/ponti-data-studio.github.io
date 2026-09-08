/**
 * Shared formatting & helper utilities.
 * Dates are ALWAYS stored as ISO 8601 "yyyy-MM-dd" (or full timestamp
 * "yyyy-MM-ddTHH:mm:ssZ") to avoid ambiguous parsing across browsers.
 */
const Fmt = {
  rupiah(num) {
    const n = Number(num) || 0;
    return 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  },
  number(num) {
    return Number(num || 0).toLocaleString('id-ID');
  },
  date(iso) {
    if (!iso) return '-';
    const d = /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')) : new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  todayIso() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  },
  nowStampIso() {
    return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  },
  timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
  },
  escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  },
};

const STATUS_BADGE = {
  'Draft': 'badge-status-draft',
  'Pending': 'badge-status-pending',
  'Approved': 'badge-status-approved',
  'Completed': 'badge-status-completed',
  'Cancelled': 'badge-status-cancelled',
  'Aktif': 'badge-status-approved',
  'Non-Aktif': 'badge-status-cancelled',
  'Cuti': 'badge-status-pending',
  'Hadir': 'badge-status-approved',
  'Terlambat': 'badge-status-pending',
  'Absen': 'badge-status-cancelled',
  'Selesai': 'badge-status-completed',
  'Lead': 'badge-stage-lead',
  'Contacted': 'badge-stage-contacted',
  'Negotiation': 'badge-stage-negotiation',
  'Proposal': 'badge-stage-proposal',
  'Won': 'badge-stage-won',
  'Lost': 'badge-stage-lost',
};

function statusBadge(status) {
  const cls = STATUS_BADGE[status] || 'badge-status-draft';
  return `<span class="status-badge ${cls}">${Fmt.escapeHtml(status)}</span>`;
}

function toastSuccess(title) {
  Swal.fire({ icon: 'success', title, timer: 1600, showConfirmButton: false, toast: true, position: 'top-end' });
}
function toastError(title) {
  Swal.fire({ icon: 'error', title, timer: 2200, showConfirmButton: false, toast: true, position: 'top-end' });
}
function confirmDelete(itemLabel) {
  return Swal.fire({
    icon: 'warning',
    title: 'Hapus data ini?',
    html: `Data <b>${Fmt.escapeHtml(itemLabel)}</b> akan dihapus permanen dan tidak dapat dikembalikan.`,
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#C0392B',
    reverseButtons: true,
  }).then((r) => r.isConfirmed);
}
