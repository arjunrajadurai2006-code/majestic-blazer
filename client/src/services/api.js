function resolveApiBase() {
  const raw = (import.meta.env.VITE_API_URL || '').trim();

  if (!raw) {
    // If running in browser and on production host (Vercel or custom domain), default to deployed Railway API
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://majestic-blazer-production.up.railway.app/api';
    }
    return '/api';
  }

  let base = raw;
  // If user omitted http/https and relative slash (e.g. "majestic-blazer-production.up.railway.app")
  if (!base.startsWith('http://') && !base.startsWith('https://') && !base.startsWith('/')) {
    base = `https://${base}`;
  }

  // Remove trailing slashes
  base = base.replace(/\/+$/, '');

  // If it's an absolute URL and doesn't end with /api, ensure /api is appended
  if ((base.startsWith('http://') || base.startsWith('https://')) && !base.endsWith('/api')) {
    base = `${base}/api`;
  }

  return base;
}

const TOKEN_KEY = 'mb_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const API_BASE = resolveApiBase();
export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = `${API_BASE}${cleanPath}`;
  if (cleanPath.startsWith('/invoices/') && cleanPath.endsWith('/pdf')) {
    const token = tokenStore.get();
    if (token && !base.includes('token=')) {
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}token=${encodeURIComponent(token)}`;
    }
  }
  return base;
};

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const url = path.startsWith('http') ? path : getApiUrl(path);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error(`Unable to connect to the Majestic Blazer service: ${networkErr.message}. Please check your connection.`);
  }

  const contentType = res.headers.get('content-type') || '';
  let json = {};
  if (contentType.includes('application/json')) {
    json = await res.json().catch(() => ({}));
  } else {
    // Non-JSON response (e.g. HTML 502/503 from edge or SPA rewrite)
    if (!res.ok) {
      throw new Error(`Service temporarily unavailable (HTTP ${res.status}). Please try again shortly.`);
    }
    throw new Error('API route returned invalid response format. Please verify server connectivity.');
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      tokenStore.clear();
      window.dispatchEvent(new Event('mb_auth_expired'));
    }
    const message = json.message || (json.details && json.details[0]?.message) || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.details = json.details;

    // Parse rate limit retry-after duration (in seconds)
    const retryHeader = res.headers.get('Retry-After') || res.headers.get('RateLimit-Reset');
    if (retryHeader && !isNaN(Number(retryHeader))) {
      error.retryAfter = Math.max(1, Math.round(Number(retryHeader)));
    } else if (json.retryAfter && !isNaN(Number(json.retryAfter))) {
      error.retryAfter = Math.max(1, Math.round(Number(json.retryAfter)));
    }

    throw error;
  }
  return json;
}

api.get = (path, opts = {}) => api(path, { ...opts, method: 'GET' });
api.post = (path, body, opts = {}) => api(path, { ...opts, method: 'POST', body });
api.put = (path, body, opts = {}) => api(path, { ...opts, method: 'PUT', body });
api.patch = (path, body, opts = {}) => api(path, { ...opts, method: 'PATCH', body });
api.delete = (path, opts = {}) => api(path, { ...opts, method: 'DELETE' });
api.getApiUrl = getApiUrl;
