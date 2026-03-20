import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'students', label: 'Students' },
  { key: 'orders', label: 'Orders' },
  { key: 'hour_cost_flows', label: 'Hour Cost Flows' },
  { key: 'rollcalls', label: 'Rollcalls' },
  { key: 'income_expense', label: 'Income / Expense' },
]

function DataTable({ rows, onRowClick }) {
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
            <tr key={i} className={onRowClick ? 'row-clickable' : ''} onClick={() => onRowClick?.(row)}>
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

function SummaryCards({ summary }) {
  const cards = [
    { key: 'students', label: 'Students', value: summary?.students ?? 0 },
    { key: 'teachers', label: 'Teachers', value: summary?.teachers ?? 0 },
    { key: 'orders', label: 'Orders', value: summary?.orders ?? 0 },
    { key: 'hour_cost_flows', label: 'Hour Cost Flows', value: summary?.hour_cost_flows ?? 0 },
    { key: 'income_cents', label: 'Income (¥)', value: centsToYuan(summary?.income_cents) },
    { key: 'expense_cents', label: 'Expense (¥)', value: centsToYuan(summary?.expense_cents) },
  ]

  return (
    <div className="cards">
      {cards.map((card) => (
        <div className="card" key={card.key}>
          <div className="card-key">{card.label}</div>
          <div className="card-value">{String(card.value)}</div>
        </div>
      ))}
    </div>
  )
}

function SidePanel({ title, loading, error, data, onClose }) {
  if (!title) return null

  return (
    <aside className="side-panel">
      <div className="side-panel-head">
        <h3>{title}</h3>
        <button onClick={onClose}>Close</button>
      </div>
      {loading && <p className="muted">Loading details...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </aside>
  )
}

function centsToYuan(cents) {
  const n = Number(cents || 0)
  return (n / 100).toFixed(2)
}

export function App() {
  const [tab, setTab] = useState('dashboard')

  const [summary, setSummary] = useState(null)
  const [integrity, setIntegrity] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')

  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ page: 1, page_size: 20, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [state, setState] = useState('')
  const [direction, setDirection] = useState('')
  const [studentId, setStudentId] = useState('')
  const [teacherId, setTeacherId] = useState('')

  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    if (tab !== 'dashboard') return

    setDashboardLoading(true)
    setDashboardError('')

    Promise.all([api.summary(), api.integrity(), api.orders({ page: 1, page_size: 200 })])
      .then(([summaryRes, integrityRes, ordersRes]) => {
        setSummary(summaryRes.data)
        setIntegrity({
          ...integrityRes.data,
          orderStateStats: groupByCount(ordersRes.data || [], 'order_state'),
        })
      })
      .catch((e) => setDashboardError(String(e.message || e)))
      .finally(() => setDashboardLoading(false))
  }, [tab])

  useEffect(() => {
    if (tab === 'dashboard') return

    setLoading(true)
    setError('')

    const params = {
      page,
      page_size: tab === 'students' || tab === 'orders' ? 20 : 50,
    }

    if (tab === 'students') {
      params.q = q
      params.status = status
    }

    if (tab === 'orders') {
      params.state = state
      params.student_id = studentId
    }

    if (tab === 'hour_cost_flows') {
      params.student_id = studentId
      params.teacher_id = teacherId
    }

    if (tab === 'rollcalls') {
      params.q = q
    }

    if (tab === 'income_expense') {
      params.direction = direction
    }

    const call =
      tab === 'students'
        ? api.students(params)
        : tab === 'orders'
          ? api.orders(params)
          : tab === 'hour_cost_flows'
            ? api.hcf(params)
            : tab === 'rollcalls'
              ? api.rollcalls(params)
              : api.incomeExpense(params)

    call
      .then((res) => {
        setRows(res.data || [])
        setMeta(res.page || { page, page_size: params.page_size, total: 0 })
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false))
  }, [tab, page, q, status, state, direction, studentId, teacherId])

  const orderStateStats = integrity?.orderStateStats || []

  function switchTab(next) {
    setTab(next)
    setPage(1)
    setQ('')
    setStatus('')
    setState('')
    setDirection('')
    setStudentId('')
    setTeacherId('')
    setRows([])
    setMeta({ page: 1, page_size: 20, total: 0 })
    setDetail(null)
    setDetailError('')
  }

  function loadDetail(row) {
    if (tab !== 'students' && tab !== 'orders') return

    const key = tab === 'students' ? row?.source_student_id : row?.source_order_id
    if (!key) return

    setDetailLoading(true)
    setDetailError('')

    const call = tab === 'students' ? api.student(key) : api.order(key)

    call
      .then((res) => setDetail(res.data))
      .catch((e) => {
        setDetail(null)
        setDetailError(String(e.message || e))
      })
      .finally(() => setDetailLoading(false))
  }

  return (
    <div className="container">
      <h1>AmilyHub Frontend P0</h1>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => switchTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' ? (
        <section>
          {dashboardLoading && <p className="muted">Loading dashboard...</p>}
          {dashboardError && <p className="error">{dashboardError}</p>}
          {!dashboardLoading && !dashboardError && (
            <>
              <SummaryCards summary={summary} />

              <div className="split-grid">
                <div className="card table-card">
                  <h3>Order state distribution (sampled)</h3>
                  <DataTable rows={orderStateStats} />
                </div>
                <div className="card table-card">
                  <h3>Data integrity</h3>
                  <DataTable rows={integrity?.issues || []} />
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="content-with-panel">
          <div className="main-content">
            <div className="filter-row">
              {(tab === 'students' || tab === 'rollcalls') && (
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keyword" />
              )}

              {tab === 'students' && (
                <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status" />
              )}

              {tab === 'orders' && (
                <>
                  <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Order state" />
                  <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student ID" />
                </>
              )}

              {tab === 'hour_cost_flows' && (
                <>
                  <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student ID" />
                  <input value={teacherId} onChange={(e) => setTeacherId(e.target.value)} placeholder="Teacher ID" />
                </>
              )}

              {tab === 'income_expense' && (
                <input value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Direction (收入/支出/IN/OUT)" />
              )}
            </div>

            {error && <p className="error">{error}</p>}
            {loading ? (
              <p className="muted">Loading...</p>
            ) : (
              <DataTable rows={rows} onRowClick={tab === 'students' || tab === 'orders' ? loadDetail : undefined} />
            )}

            <div className="pager">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </button>
              <span>
                Page {meta.page} / {Math.max(1, Math.ceil((meta.total || 0) / (meta.page_size || 1)))} · Total {meta.total}
              </span>
              <button disabled={(meta.page || page) * (meta.page_size || 1) >= (meta.total || 0)} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>

          <SidePanel
            title={tab === 'students' ? 'Student details' : tab === 'orders' ? 'Order details' : ''}
            loading={detailLoading}
            error={detailError}
            data={detail}
            onClose={() => setDetail(null)}
          />
        </section>
      )}
    </div>
  )
}

function groupByCount(rows, key) {
  const map = new Map()
  for (const row of rows || []) {
    const v = row?.[key] ?? '(empty)'
    map.set(v, (map.get(v) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
