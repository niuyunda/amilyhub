const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function normalizeError(payload, status) {
  if (!payload) return `API ${status}: request failed`
  if (typeof payload === 'string') return `API ${status}: ${payload}`

  if (payload?.detail?.message) return payload.detail.message
  if (typeof payload?.detail === 'string') return payload.detail
  if (payload?.message) return payload.message
  if (payload?.error) return payload.error

  return `API ${status}: request failed`
}

async function request(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })

  const res = await fetch(url)
  let payload = null

  try {
    payload = await res.json()
  } catch {
    payload = await res.text()
  }

  if (!res.ok) {
    throw new Error(normalizeError(payload, res.status))
  }

  return payload
}

export const api = {
  health: () => request('/api/v1/health'),
  summary: () => request('/api/v1/dashboard/summary'),
  integrity: () => request('/api/v1/data/integrity'),

  students: (params) => request('/api/v1/students', params),
  student: (sourceStudentId) => request(`/api/v1/students/${sourceStudentId}`),

  orders: (params) => request('/api/v1/orders', params),
  order: (sourceOrderId) => request(`/api/v1/orders/${sourceOrderId}`),

  hcf: (params) => request('/api/v1/hour-cost-flows', params),
  rollcalls: (params) => request('/api/v1/rollcalls', params),
  incomeExpense: (params) => request('/api/v1/income-expense', params),
}
