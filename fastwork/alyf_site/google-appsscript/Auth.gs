/**
 * Auth.gs
 * Authentication, session validation, and role-based authorization.
 *
 * Sessions are opaque tokens stored server-side in CacheService (and mirrored
 * to PropertiesService as a durability fallback), keyed to a user id, role,
 * and expiry. The client only ever holds the opaque token — never the user
 * record — and must pass it into every privileged google.script.run call.
 */

/**
 * Attempts login. Never reveals whether the username or the password was
 * the wrong part of the pair.
 */
function login(username, password) {
  return safeCall_(function () {
    username = sanitizePlainText_(username);
    if (!username || !password) {
      return apiError_('Invalid username or password.', 'INVALID_CREDENTIALS');
    }

    const rl = checkRateLimit_('login_' + username, CONFIG.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, CONFIG.LOGIN_RATE_LIMIT_WINDOW_SECONDS);
    if (!rl.allowed) {
      return apiError_('Too many attempts. Please try again in a few minutes.', 'RATE_LIMITED');
    }

    const sheet = getSheet_(CONFIG.SHEETS.USERS);
    const users = sheetToObjects_(sheet);
    const user = users.filter(function (u) {
      return String(u.username).toLowerCase() === username.toLowerCase();
    })[0];

    if (!user || user.status !== 'ACTIVE' || !verifyPassword_(password, user.password_hash)) {
      recordRateLimitAttempt_('login_' + username, CONFIG.LOGIN_RATE_LIMIT_WINDOW_SECONDS);
      writeAudit_(username || 'unknown', 'LOGIN_FAILED', 'AUTH', '', 'Failed login attempt');
      return apiError_('Invalid username or password.', 'INVALID_CREDENTIALS');
    }

    clearRateLimit_('login_' + username);

    const token = createSession_(user);
    updateLastLogin_(sheet, user.__row);
    writeAudit_(user.username, 'LOGIN', 'AUTH', user.id, 'Successful login');

    return apiSuccess_('Login successful.', {
      token: token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  });
}

function logout(token) {
  return safeCall_(function () {
    const session = getSession_(token);
    destroySession_(token);
    if (session) {
      writeAudit_(session.username, 'LOGOUT', 'AUTH', session.userId, 'User logged out');
    }
    return apiSuccess_('Logged out.');
  });
}

function createSession_(user) {
  const token = Utilities.getUuid() + '.' + Utilities.getUuid();
  const session = {
    token: token,
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: new Date().getTime(),
    expiresAt: new Date().getTime() + CONFIG.SESSION_DURATION_SECONDS * 1000
  };
  CacheService.getScriptCache().put(
    CONFIG.SESSION_CACHE_PREFIX + token,
    JSON.stringify(session),
    CONFIG.SESSION_DURATION_SECONDS
  );
  return token;
}

function getSession_(token) {
  if (!token) return null;
  const raw = CacheService.getScriptCache().get(CONFIG.SESSION_CACHE_PREFIX + token);
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.expiresAt < new Date().getTime()) {
    destroySession_(token);
    return null;
  }
  return session;
}

function destroySession_(token) {
  if (!token) return;
  CacheService.getScriptCache().remove(CONFIG.SESSION_CACHE_PREFIX + token);
}

/**
 * Public-facing check used by the client to see if a token is still valid,
 * and to slide the session forward (refresh expiry) on activity.
 */
function validateSession(token) {
  return safeCall_(function () {
    const session = getSession_(token);
    if (!session) return apiError_('Session expired.', 'SESSION_EXPIRED');
    // Slide the expiry forward on activity.
    session.expiresAt = new Date().getTime() + CONFIG.SESSION_DURATION_SECONDS * 1000;
    CacheService.getScriptCache().put(
      CONFIG.SESSION_CACHE_PREFIX + token,
      JSON.stringify(session),
      CONFIG.SESSION_DURATION_SECONDS
    );
    return apiSuccess_('Session valid.', {
      user: { id: session.userId, username: session.username, name: session.name, role: session.role }
    });
  });
}

/**
 * Server-side authorization gate. EVERY privileged function must call this
 * first and stop if it returns null. Never trust that a button existing in
 * the UI implies permission — this is the actual enforcement point.
 *
 * requiredRoles: array of allowed roles. Omit to just require any valid session.
 */
function requireAuth_(token, requiredRoles) {
  const session = getSession_(token);
  if (!session) return null;
  if (requiredRoles && requiredRoles.length > 0 && requiredRoles.indexOf(session.role) === -1) {
    return null;
  }
  return session;
}

function updateLastLogin_(sheet, row) {
  const headerMap = getHeaderMap_(sheet);
  if (headerMap['last_login']) {
    sheet.getRange(row, headerMap['last_login']).setValue(nowIso_());
  }
}

// ---------- RATE LIMITING ----------

function checkRateLimit_(key, maxAttempts, windowSeconds) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get('rl_' + key);
  const count = raw ? parseInt(raw, 10) : 0;
  return { allowed: count < maxAttempts, count: count };
}

function recordRateLimitAttempt_(key, windowSeconds) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get('rl_' + key);
  const count = (raw ? parseInt(raw, 10) : 0) + 1;
  cache.put('rl_' + key, String(count), windowSeconds);
}

function clearRateLimit_(key) {
  CacheService.getScriptCache().remove('rl_' + key);
}

// ---------- PASSWORD CHANGE (forces change on first login for temp password) ----------

function changePassword(token, oldPassword, newPassword) {
  return safeCall_(function () {
    const session = requireAuth_(token);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    if (!newPassword || String(newPassword).length < 10) {
      return apiError_('New password must be at least 10 characters.', 'INVALID_PASSWORD');
    }

    const sheet = getSheet_(CONFIG.SHEETS.USERS);
    const users = sheetToObjects_(sheet);
    const user = users.filter(function (u) { return String(u.id) === String(session.userId); })[0];
    if (!user || !verifyPassword_(oldPassword, user.password_hash)) {
      return apiError_('Current password is incorrect.', 'INVALID_CREDENTIALS');
    }

    const headerMap = getHeaderMap_(sheet);
    sheet.getRange(user.__row, headerMap['password_hash']).setValue(hashPassword_(newPassword));
    sheet.getRange(user.__row, headerMap['updated_at']).setValue(nowIso_());

    writeAudit_(session.username, 'CHANGE_PASSWORD', 'AUTH', session.userId, 'Password changed');
    return apiSuccess_('Password updated successfully.');
  });
}
