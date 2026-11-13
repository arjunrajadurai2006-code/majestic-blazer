const rawBase = import.meta.env.VITE_API_URL || '/api';
export const API_BASE = rawBase.replace(/\/+$/, '');
export const getApiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

const TOKEN_KEY = 'mb_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const url = path.startsWith('http') ? path : getApiUrl(path);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(json.message || 'Something went wrong. Please try again.');
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
