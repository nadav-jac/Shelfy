const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Locations
export const api = {
  locations: {
    list: () => request('/locations'),
    get: (id) => request(`/locations/${id}`),
    create: (data) => request('/locations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/locations/${id}`, { method: 'DELETE' }),
  },
  containers: {
    get: (id) => request(`/containers/${id}`),
    create: (data) => request('/containers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/containers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/containers/${id}`, { method: 'DELETE' }),
  },
  items: {
    create: (data) => request('/items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  },
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
};
