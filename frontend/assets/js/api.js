async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.status === 401) { logout(); return; }
  const data = await res.json();
  if (res.status === 403 && data.code) { showAccessBlock(data); return; }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}
function apiGet(path) { return api(path); }
function apiPost(path, body) { return api(path, { method: 'POST', body }); }
function apiPut(path, body) { return api(path, { method: 'PUT', body }); }
function apiDelete(path) { return api(path, { method: 'DELETE' }); }
