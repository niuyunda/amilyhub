const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function request(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  summary: () => request('/api/v1/dashboard/summary'),
  students: (params) => request('/api/v1/students', params),
  orders: (params) => request('/api/v1/orders', params),
  hcf: (params) => request('/api/v1/hour-cost-flows', params),
  rollcalls: (params) => request('/api/v1/rollcalls', params),
  integrity: () => request('/api/v1/data/integrity'),
}
