import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'students', label: 'Students' },
  { key: 'orders', label: 'Orders' },
  { key: 'hour_cost_flows', label: 'Hour Cost Flows' },
  { key: 'rollcalls', label: 'Rollcalls' },
]

function DataTable({ rows }) {
  const columns = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)))
    return Array.from(set)
  }, [rows])

  if (!rows?.length) return <p className="muted">No data</p>

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>{String(row?.[c] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function App() {
  const [tab, setTab] = useState('dashboard')
  const [summary, setSummary] = useState(null)
  const [integrity, setIntegrity] = useState(null)
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.summary().then((r) => setSummary(r.data)).catch((e) => setError(String(e.message || e)))
    api.integrity().then((r) => setIntegrity(r.data)).catch((e) => setError(String(e.message || e)))
  }, [])

  useEffect(() => {
    if (tab === 'dashboard') return
    setLoading(true)
    setError('')
    const params = { page, page_size: 20 }
    if (tab === 'students' || tab === 'rollcalls') params.q = q

    const call =
      tab === 'students'
        ? api.students(params)
        : tab === 'orders'
          ? api.orders(params)
          : tab === 'hour_cost_flows'
            ? api.hcf(params)
            : api.rollcalls(params)

    call
      .then((r) => setData(r.data || []))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false))
  }, [tab, page, q])

  return (
    <div className="container">
      <h1>AmilyHub MVP</h1>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => { setTab(t.key); setPage(1) }}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {tab === 'dashboard' ? (
        <div>
          <div className="cards">
            {Object.entries(summary || {}).map(([k, v]) => (
              <div className="card" key={k}>
                <div className="card-key">{k}</div>
                <div className="card-value">{String(v)}</div>
              </div>
            ))}
          </div>
          <h3>Data Integrity</h3>
          <pre>{JSON.stringify(integrity, null, 2)}</pre>
        </div>
      ) : (
        <div>
          {(tab === 'students' || tab === 'rollcalls') && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
          )}
          {loading ? <p className="muted">Loading...</p> : <DataTable rows={data} />}
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
