import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

const tabs = [
  { key: 'dashboard', label: 'Dashboard', desc: '业务概览与数据质量' },
  { key: 'students', label: 'Students', desc: '学员列表与详情' },
  { key: 'orders', label: 'Orders', desc: '订单状态与详情' },
  { key: 'hour_cost_flows', label: 'Flows', desc: '课消流水明细' },

  { key: 'income_expense', label: 'Income / Expense', desc: '收支流水管理' },
]

const pageTitleMap = Object.fromEntries(tabs.map((t) => [t.key, t.label]))
const pageDescMap = Object.fromEntries(tabs.map((t) => [t.key, t.desc]))

function centsToYuan(cents) {
  const n = Number(cents || 0)
  return (n / 100).toFixed(2)
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

function formatFieldName(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase())
}

function EmptyState({ title = 'No data', hint = 'Try adjusting filters or check data import.' }) {
  return (
    <div className="state-card empty">
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  )
}

function LoadingState({ text = 'Loading...' }) {
  return (
    <div className="state-card loading">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  )
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="state-card error">
      <strong>Load failed</strong>
      <p>{error || 'Unknown error'}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

function DataTable({ rows, loading, error, onRetry, onRowClick }) {
  const columns = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)))
    return Array.from(set)
  }, [rows])

  if (loading) return <LoadingState text="Loading table data..." />
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (!rows?.length) return <EmptyState />

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{formatFieldName(c)}</th>
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
        <article className="metric-card" key={card.key}>
          <p>{card.label}</p>
          <h3>{String(card.value)}</h3>
        </article>
      ))}
    </div>
  )
}

function FilterBar({ children, onReset }) {
  return (
    <div className="filter-bar card-shell">
      <div className="filter-row">{children}</div>
      <button className="btn" onClick={onReset}>
        Reset filters
      </button>
    </div>
  )
}

function Pager({ page, meta, onPrev, onNext }) {
  const totalPage = Math.max(1, Math.ceil((meta.total || 0) / (meta.page_size || 1)))
  const disableNext = (meta.page || page) * (meta.page_size || 1) >= (meta.total || 0)

  return (
    <div className="pager card-shell">
      <div>
        Page {meta.page || page} / {totalPage} · Total {meta.total || 0}
      </div>
      <div className="pager-actions">
        <button className="btn" disabled={page <= 1} onClick={onPrev}>
          Prev
        </button>
        <button className="btn" disabled={disableNext} onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  )
}

function DetailPanel({ title, loading, error, data, onClose }) {
  if (!title) return null

  const sections = buildDetailSections(data)

  return (
    <aside className={`detail-panel ${data || loading || error ? 'open' : ''}`}>
      <div className="detail-header">
        <div>
          <p className="muted small">Detail Panel</p>
          <h3>{title}</h3>
        </div>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && <LoadingState text="Loading details..." />}
      {!loading && error && <ErrorState error={error} />}
      {!loading && !error && !data && <EmptyState title="No detail selected" hint="Click a row to inspect detail data." />}

      {!loading && !error && data && (
        <div className="detail-content">
          {sections.map((section) => (
            <section className="detail-section" key={section.title}>
              <h4>{section.title}</h4>
              <div className="kv-grid">
                {section.items.map((item) => (
                  <div className="kv-item" key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </aside>
  )
}

function buildDetailSections(data) {
  if (!data || typeof data !== 'object') return []

  const base = []
  const nested = []

  Object.entries(data).forEach(([key, value]) => {
    const label = formatFieldName(key)
    if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      base.push({ key, label, value: String(value ?? '-') })
      return
    }

    if (Array.isArray(value)) {
      nested.push({
        title: `${label} (${value.length})`,
        items: [{ key: `${key}_summary`, label: 'Summary', value: value.length ? 'Contains nested records' : 'Empty list' }],
      })
      return
    }

    if (typeof value === 'object') {
      const items = Object.entries(value).map(([k, v]) => ({ key: `${key}_${k}`, label: formatFieldName(k), value: String(v ?? '-') }))
      nested.push({ title: label, items: items.length ? items : [{ key: `${key}_empty`, label: 'Value', value: '-' }] })
    }
  })

  return [{ title: 'Basic Fields', items: base.length ? base : [{ key: 'empty', label: 'Value', value: '-' }] }, ...nested]
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

  const isDetailTab = tab === 'students' || tab === 'orders'

  const fetchDashboard = () => {
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
  }

  const fetchList = () => {
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
  }

  useEffect(() => {
    if (tab !== 'dashboard') return
    fetchDashboard()
  }, [tab])

  useEffect(() => {
    if (tab === 'dashboard') return
    fetchList()
  }, [tab, page, q, status, state, direction, studentId, teacherId])

  function switchTab(next) {
    setTab(next)
    setPage(1)
    resetFilters()
    setRows([])
    setMeta({ page: 1, page_size: 20, total: 0 })
    setDetail(null)
    setDetailError('')
  }

  function resetFilters() {
    setQ('')
    setStatus('')
    setState('')
    setDirection('')
    setStudentId('')
    setTeacherId('')
  }

  function loadDetail(row) {
    if (!isDetailTab) return

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

  const orderStateStats = integrity?.orderStateStats || []

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">AmilyHub</div>
        <nav>
          {tabs.map((item) => (
            <button key={item.key} className={`nav-item ${tab === item.key ? 'active' : ''}`} onClick={() => switchTab(item.key)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main-layout">
        <header className="topbar">
          <div>
            <h1>{pageTitleMap[tab]}</h1>
            <p className="muted">{pageDescMap[tab]}</p>
          </div>
          <button className="btn" onClick={() => (tab === 'dashboard' ? fetchDashboard() : fetchList())} disabled={loading || dashboardLoading}>
            {loading || dashboardLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        <main className="content">
          {tab === 'dashboard' ? (
            <section className="stack-lg">
              {dashboardLoading && <LoadingState text="Loading dashboard..." />}
              {!dashboardLoading && dashboardError && <ErrorState error={dashboardError} onRetry={fetchDashboard} />}
              {!dashboardLoading && !dashboardError && (
                <>
                  <SummaryCards summary={summary} />

                  <div className="split-grid">
                    <section className="card-shell">
                      <h3>Order state distribution (sampled)</h3>
                      <DataTable rows={orderStateStats} />
                    </section>
                    <section className="card-shell">
                      <h3>Data integrity</h3>
                      <DataTable rows={integrity?.issues || []} />
                    </section>
                  </div>
                </>
              )}
            </section>
          ) : (
            <section className="content-with-panel">
              <div className="main-content stack-md">
                <FilterBar onReset={resetFilters}>
                  {(tab === 'students' || tab === 'rollcalls') && (
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keyword" />
                  )}

                  {tab === 'students' && <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status" />}

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
                </FilterBar>

                <section className="card-shell">
                  <DataTable rows={rows} loading={loading} error={error} onRetry={fetchList} onRowClick={isDetailTab ? loadDetail : undefined} />
                </section>

                <Pager page={page} meta={meta} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
              </div>

              <DetailPanel
                title={isDetailTab ? `${tab === 'students' ? 'Student' : 'Order'} details` : ''}
                loading={detailLoading}
                error={detailError}
                data={detail}
                onClose={() => {
                  setDetail(null)
                  setDetailError('')
                }}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
