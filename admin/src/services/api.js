function resolveApiBase() {
  const raw = (import.meta.env.VITE_API_URL || '').trim();

  // If running in browser on unified custom domain or Vercel, use relative same-origin /api
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'majesticblazer.com' || host === 'www.majesticblazer.com' || host.includes('vercel.app')) {
      return '/api';
    }
  }

  if (!raw) {
    // If running in browser and on standalone production host, default to deployed Railway API
    if (typeof window !== 'undefined') {
      const h = window.location.hostname;
      const isLocalHost = h === 'localhost' || h === '127.0.0.1' || /^10\.\d+\.\d+\.\d+$/.test(h) || /^192\.168\.\d+\.\d+$/.test(h) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h) || h.endsWith('.local');
      if (!isLocalHost) {
        return 'https://majestic-blazer-production.up.railway.app/api';
      }
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

const TOKEN_KEY = 'mb_admin_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) || localStorage.getItem('mb_token'),
  set: (token) => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('mb_token');
  },
};

export const API_BASE = resolveApiBase();
export const getApiUrl = (path) => {
  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/api') && cleanPath.startsWith('/api/')) {
    cleanPath = cleanPath.slice(4);
  }
  const base = `${API_BASE}${cleanPath}`;
  const pathOnly = cleanPath.split('?')[0];
  if (pathOnly.startsWith('/invoices/') && (pathOnly.endsWith('/pdf') || pathOnly.endsWith('/thermal-pdf'))) {
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
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const url = path.startsWith('http') ? path : getApiUrl(path);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
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

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  return api.post('/upload', formData);
};
