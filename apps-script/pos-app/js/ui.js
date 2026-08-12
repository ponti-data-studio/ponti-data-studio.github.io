/**
 * ui.js - Utility tampilan & helper umum
 */

const UI = (() => {
  function formatCurrency(amount, currencySymbol = 'Rp') {
    const safe = safeNumber(amount);
    const rounded = Math.round(safe);
    const formatted = Math.abs(rounded).toLocaleString('id-ID');
    return `${rounded < 0 ? '-' : ''}${currencySymbol}${formatted}`;
  }

  function formatNumber(amount) {
    return safeNumber(amount).toLocaleString('id-ID');
  }

  function safeNumber(value) {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
    return num;
  }

  // Uang disimpan & dihitung dalam satuan rupiah bulat (integer) untuk menghindari floating point error.
  function money(value) {
    return Math.round(safeNumber(value));
  }

  function formatDate(dateInput, withTime = false) {
    try {
      const d = new Date(dateInput);
      if (Number.isNaN(d.getTime())) return '-';
      const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      if (!withTime) return datePart;
      const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return `${datePart} ${timePart}`;
    } catch (err) {
      console.error('formatDate error:', err);
      return '-';
    }
  }

  function toast(icon, title) {
    try {
      if (typeof Swal === 'undefined') {
        console.warn('SweetAlert2 tidak tersedia, fallback ke alert.');
        return;
      }
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title,
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true
      });
    } catch (err) {
      console.error('toast error:', err);
    }
  }

  function success(title) { toast('success', title); }
  function errorToast(title) { toast('error', title); }
  function info(title) { toast('info', title); }
  function warn(title) { toast('warning', title); }

  function showError(text, title = 'Terjadi Kesalahan') {
    try {
      if (typeof Swal === 'undefined') return;
      Swal.fire({ icon: 'error', title, text });
    } catch (err) {
      console.error('showError error:', err);
    }
  }

  async function confirm(options = {}) {
    try {
      if (typeof Swal === 'undefined') {
        return window.confirm(options.text || 'Apakah Anda yakin?');
      }
      const result = await Swal.fire({
        icon: options.icon || 'warning',
        title: options.title || 'Apakah Anda yakin?',
        text: options.text || '',
        showCancelButton: true,
        confirmButtonText: options.confirmButtonText || 'Ya, Lanjutkan',
        cancelButtonText: options.cancelButtonText || 'Batal',
        confirmButtonColor: options.confirmButtonColor || '#dc2626',
        reverseButtons: true
      });
      return result.isConfirmed;
    } catch (err) {
      console.error('confirm dialog error:', err);
      return false;
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function generateId(prefix = '') {
    return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  function debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function el(id) {
    return document.getElementById(id);
  }

  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  return {
    formatCurrency,
    formatNumber,
    safeNumber,
    money,
    formatDate,
    toast,
    success,
    errorToast,
    info,
    warn,
    showError,
    confirm,
    escapeHtml,
    generateId,
    debounce,
    el,
    qs,
    qsa
  };
})();
