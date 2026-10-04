/**
 * Canchalant — API Client with MongoDB Atlas Auth
 *
 * All HTTP interactions with the FastAPI backend.
 * Points to VITE_API_BASE_URL (or defaults to http://localhost:8000).
 */

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const SERVER_BASE = RAW_BASE.replace(/\/+$/, '');
export const API_BASE = `${SERVER_BASE}/api`;

const TOKEN_KEY = 'canchalant_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getAuthHeaders(extra = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Resolves an image URL: returns Cloudinary HTTPS URLs directly,
 * or prepends the server base for relative paths.
 */
export function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${SERVER_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ── Auth Endpoints ────────────────────────────────────────────────

export async function register(email, password, name = '') {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
  }
  const data = await res.json();
  if (data.access_token) {
    setToken(data.access_token);
  }
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
    throw new Error(err.detail || 'Invalid email or password');
  }
  const data = await res.json();
  if (data.access_token) {
    setToken(data.access_token);
  }
  return data;
}

export async function getMe() {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    clearToken();
    return null;
  }
  return res.json();
}

// ── Pipeline & Gallery Endpoints ─────────────────────────────────

export async function analyzeFrame(imageBase64, options = {}) {
  const res = await fetch(`${API_BASE}/frame/analyze`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      image_base64: imageBase64,
      mode: options.mode || 'passive',
      confidence_threshold: options.confidenceThreshold ?? 0.65,
      blur_threshold: options.blurThreshold ?? 80.0,
    }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Analysis failed (${res.status}): ${errorBody}`);
  }
  return res.json();
}

export async function getGallery(page = 1, limit = 20, filters = {}) {
  const params = new URLSearchParams({ page, limit });
  if (filters.classification) params.set('classification', filters.classification);
  if (filters.tag) params.set('tag', filters.tag);
  const res = await fetch(`${API_BASE}/gallery?${params}`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) throw new Error(`Gallery fetch failed: ${res.status}`);
  return res.json();
}

export async function searchGallery(query, limit = 20) {
  const res = await fetch(`${API_BASE}/gallery/search`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ query, limit }),
  });
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function deleteMoment(id) {
  const res = await fetch(`${API_BASE}/gallery/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
}

export async function healthCheck() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
