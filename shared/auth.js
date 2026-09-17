/**
 * Brokers Together - Central Authentication & Session Handler
 * Strictly adheres to Single Source of Truth (SSoT) and Zero Hardcoding.
 */

(function(window) {
  'use strict';

  const AUTH_STORAGE_KEY = 'bt_auth_user';
  const TOKEN_STORAGE_KEY = 'bt_auth_token';
  const API_BASE = window.ENV_API_URL || 'http://localhost:5050';

  const AuthManager = {
    // 1. Session & Storage
    getUser() {
      try {
        const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error('Error parsing stored user:', e);
        return null;
      }
    },

    getToken() {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY) || null;
    },

    setSession(user, token) {
      if (user) sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    },

    clearSession() {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    },

    isAuthenticated() {
      const user = this.getUser();
      const token = this.getToken();
      return !!(user && token);
    },

    // 2. Safe Redirection & ReturnURL
    sanitizeReturnUrl(url) {
      if (!url) return null;
      try {
        const decoded = decodeURIComponent(url).trim();
        if (decoded.startsWith('http://') || decoded.startsWith('https://') || decoded.startsWith('//')) {
          const parsed = new URL(decoded, window.location.origin);
          if (parsed.origin !== window.location.origin) {
            return null;
          }
          return parsed.pathname + parsed.search + parsed.hash;
        }
        if (/^(\/?[a-zA-Z0-9_\-\.\?&=#%]+)$/.test(decoded)) {
          return decoded.startsWith('/') ? decoded.slice(1) : decoded;
        }
      } catch (e) {
        console.error('URL parse error:', e);
      }
      return null;
    },

    getReturnUrl() {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('returnUrl') || params.get('redirect');
      return this.sanitizeReturnUrl(raw);
    },

    // 3. Page Protection Guard
    requireAuth(fallbackTarget) {
      if (!this.isAuthenticated()) {
        const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
        const currentSearch = window.location.search || '';
        const target = fallbackTarget || (currentPath + currentSearch);
        const loginUrl = `login.html?returnUrl=${encodeURIComponent(target)}`;
        window.location.replace(loginUrl);
        return false;
      }
      return true;
    },

    // 4. Guest Guard (If already logged in, skip login/signup)
    redirectIfAuthenticated(defaultRoute) {
      if (this.isAuthenticated()) {
        const user = this.getUser();
        const returnUrl = this.getReturnUrl();
        if (returnUrl) {
          window.location.replace(returnUrl);
          return;
        }
        const destination = defaultRoute || (user?.role === 'Developer' ? 'dashboard.html' : 'dashboard.html');
        window.location.replace(destination);
      }
    },

    // 5. Logout Flow
    logout(redirectUrl) {
      this.clearSession();
      window.location.href = redirectUrl || 'index.html';
    },

    // 6. Real API Auth Actions
    async login(identifier, password) {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.setSession(data.user, data.token);
      }
      return { ok: res.ok, status: res.status, data };
    },

    async signup(payload) {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.setSession(data.user, data.token);
      }
      return { ok: res.ok, status: res.status, data };
    },

    async forgotPassword(identifier) {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    },

    async resetPassword(token, newPassword) {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    },

    async verifySession() {
      const token = this.getToken();
      if (!token) return null;
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            this.setSession(data.user, token);
            return data.user;
          }
        } else {
          this.clearSession();
        }
      } catch (err) {
        console.warn('Session check warning:', err);
      }
      return null;
    }
  };

  window.AuthManager = AuthManager;

})(window);
