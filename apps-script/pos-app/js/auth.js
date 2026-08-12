/**
 * auth.js - Otentikasi & manajemen sesi
 * Catatan keamanan: Aplikasi berjalan sepenuhnya di sisi klien tanpa backend/server.
 * Hashing password menggunakan Web Crypto API (PBKDF2) hanya untuk mencegah
 * penyimpanan plaintext secara lokal, BUKAN untuk menjamin keamanan tingkat server.
 */

const Auth = (() => {
  const SESSION_KEY = 'session';
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 menit auto-lock
  let currentSession = null;
  let idleTimer = null;
  let onTimeoutCallback = null;

  async function hashPassword(password, saltHex) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API tidak didukung oleh browser ini.');
    }
    const encoder = new TextEncoder();
    const salt = saltHex ? hexToBytes(saltHex) : window.crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );

    const hashHex = bytesToHex(new Uint8Array(derivedBits));
    return { hash: hashHex, salt: bytesToHex(salt) };
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  async function verifyPassword(password, storedHash, storedSalt) {
    try {
      const { hash } = await hashPassword(password, storedSalt);
      return hash === storedHash;
    } catch (err) {
      console.error('verifyPassword error:', err);
      return false;
    }
  }

  async function ensureDefaultUsers() {
    try {
      const users = await DB.getAll(DB.STORES.users);
      if (users.length > 0) return;

      const adminPass = await hashPassword('admin123');
      const cashierPass = await hashPassword('kasir123');

      await DB.add(DB.STORES.users, {
        username: 'admin',
        name: 'Administrator',
        role: 'ADMIN',
        passwordHash: adminPass.hash,
        passwordSalt: adminPass.salt,
        active: true,
        createdAt: new Date().toISOString()
      });

      await DB.add(DB.STORES.users, {
        username: 'kasir',
        name: 'Kasir 1',
        role: 'CASHIER',
        passwordHash: cashierPass.hash,
        passwordSalt: cashierPass.salt,
        active: true,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('ensureDefaultUsers error:', err);
    }
  }

  async function login(username, password) {
    if (!username || !password) {
      return { success: false, message: 'Username dan password wajib diisi.' };
    }
    try {
      const users = await DB.getAllByIndex(DB.STORES.users, 'username', username.trim());
      const user = users[0];
      if (!user || !user.active) {
        return { success: false, message: 'Username tidak ditemukan atau nonaktif.' };
      }
      const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
      if (!valid) {
        return { success: false, message: 'Password salah.' };
      }
      startSession({ id: user.id, username: user.username, name: user.name, role: user.role, isGuest: false });
      return { success: true, user };
    } catch (err) {
      console.error('login error:', err);
      return { success: false, message: 'Terjadi kesalahan sistem saat login.' };
    }
  }

  function loginAsGuest() {
    startSession({ id: 'guest', username: 'guest', name: 'Guest', role: 'GUEST', isGuest: true });
    return { success: true };
  }

  function startSession(sessionData) {
    currentSession = { ...sessionData, loginAt: Date.now() };
    Storage.set(SESSION_KEY, currentSession);
    resetIdleTimer();
  }

  function getSession() {
    if (currentSession) return currentSession;
    const stored = Storage.get(SESSION_KEY, null);
    if (stored) currentSession = stored;
    return currentSession;
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function isGuest() {
    const session = getSession();
    return !!session && session.isGuest;
  }

  function hasRole(...roles) {
    const session = getSession();
    if (!session) return false;
    return roles.includes(session.role);
  }

  function logout() {
    currentSession = null;
    Storage.remove(SESSION_KEY);
    clearTimeout(idleTimer);
  }

  function onSessionTimeout(callback) {
    onTimeoutCallback = callback;
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (!getSession()) return;
    idleTimer = setTimeout(() => {
      logout();
      if (typeof onTimeoutCallback === 'function') {
        onTimeoutCallback();
      }
    }, SESSION_TIMEOUT_MS);
  }

  function registerActivityListeners() {
    ['click', 'keydown', 'touchstart', 'mousemove'].forEach((evt) => {
      document.addEventListener(evt, UI.debounce(() => resetIdleTimer(), 1000), { passive: true });
    });
  }

  return {
    ensureDefaultUsers,
    login,
    loginAsGuest,
    getSession,
    isLoggedIn,
    isGuest,
    hasRole,
    logout,
    hashPassword,
    onSessionTimeout,
    resetIdleTimer,
    registerActivityListeners
  };
})();
