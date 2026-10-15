import { useEffect, useMemo, useState } from 'react'
import Card from '../components/UI/Card'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import Select from '../components/UI/Select'
import Modal from '../components/UI/Modal'
import { PageLoader, EmptyState, Badge, Skeleton } from '../components/UI/Skeleton'
import { getActivityLogs } from '../services/logService'
import { getAllClasses } from '../services/classService'
import { getAllUsers } from '../services/userService'
import { useAuth } from '../contexts/AuthContext'
import { ACTION_LABELS, ROLE_LABELS } from '../utils/constants'
import { cn, formatDateTime } from '../utils/helpers'

const actionBadge = {
  CREATE_STUDENT:   'success',
  UPDATE_STUDENT:   'primary',
  DELETE_STUDENT:   'danger',
  CREATE_CLASS:     'success',
  UPDATE_CLASS:     'primary',
  DELETE_CLASS:     'danger',
  CREATE_COLUMN:    'success',
  UPDATE_COLUMN:    'primary',
  DELETE_COLUMN:    'danger',
  UPDATE_WARNING:   'warning',
  IMPORT_EXCEL:     'info',
  UPDATE_PERMISSION:'info',
}

export default function ActivityLogs() {
  const { isAdmin } = useAuth()

  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [classes, setClasses] = useState([])
  const [users, setUsers] = useState([])
  const [detail, setDetail] = useState(null)

  const [filters, setFilters] = useState({
    userId: '',
    classId: '',
    action: '',
    fromDate: '',
    toDate: '',
  })
  const [applied, setApplied] = useState(filters)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const loadInitial = async () => {
    try {
      const [c, u] = await Promise.all([getAllClasses(), isAdmin ? getAllUsers() : Promise.resolve([])])
      setClasses(c)
      setUsers(u)
    } catch (_) {}
  }

  const load = async () => {
    setLoading(true)
    try {
      const d = await getActivityLogs(applied, page, PAGE_SIZE)
      setLogs(d)
    } catch (e) { /* handled by service */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadInitial() }, [isAdmin])
  useEffect(() => { load() }, [applied, page])

  const actionOptions = useMemo(() =>
    Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l })), [])

  return (
    <div className="space-y-5">
      {/* Filter */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {isAdmin && (
            <Select
              label="Người thực hiện"
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              options={users.map((u) => ({ value: u.id, label: `${u.full_name || u.username} (${u.email})` }))}
            />
          )}
          <Select
            label="Lớp"
            value={filters.classId}
            onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
            options={classes.map((c) => ({ value: c.id, label: c.class_name }))}
          />
          <Select
            label="Hành động"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            options={actionOptions}
          />
          <Input
            label="Từ ngày"
            type="date"
            value={filters.fromDate}
            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
          />
          <Input
            label="Đến ngày"
            type="date"
            value={filters.toDate}
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          />
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="secondary" onClick={() => {
            const empty = { userId: '', classId: '', action: '', fromDate: '', toDate: '' }
            setFilters(empty); setApplied(empty); setPage(1)
          }}>↺ Đặt lại</Button>
          <Button variant="primary" onClick={() => { setApplied({ ...filters }); setPage(1) }}>🔍 Lọc</Button>
        </div>
      </Card>

      <Card title="Nhật ký hoạt động">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon="📜" text="Chưa có nhật ký hoạt động" />
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Thời gian</th>
                  <th className="px-4 py-3 text-left font-semibold">Người dùng</th>
                  <th className="px-4 py-3 text-left font-semibold">Hành động</th>
                  <th className="px-4 py-3 text-left font-semibold">Lớp</th>
                  <th className="px-4 py-3 text-left font-semibold">Sinh viên</th>
                  <th className="px-4 py-3 text-right font-semibold">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{l.user?.full_name || l.user?.username || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{l.user?.email} · {ROLE_LABELS[l.user?.role] || l.user?.role}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={actionBadge[l.action] || 'default'}>
                        {ACTION_LABELS[l.action] || l.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {l.class?.class_name ? <Badge variant="primary">{l.class.class_name}</Badge> : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {l.student ? (
                        <div>
                          <span className="font-semibold text-primary-700">{l.student.student_code}</span>
                          <span className="ml-2">{l.student.full_name}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(l)}>🔍 Xem</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logs.length >= PAGE_SIZE && (
          <div className="flex justify-end items-center gap-2 pt-4">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</Button>
            <span className="text-sm text-slate-600 px-2">Trang {page}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)}>Sau →</Button>
          </div>
        )}
      </Card>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Chi tiết hoạt động"
        size="lg"
        closeOnBackdrop
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <Grid label="Thời gian" value={formatDateTime(detail.created_at)} />
            <Grid label="Người thực hiện"
                  value={`${detail.user?.full_name || detail.user?.username} (${ROLE_LABELS[detail.user?.role] || detail.user?.role}) · ${detail.user?.email}`} />
            <Grid label="Hành động"
                  value={<Badge variant={actionBadge[detail.action] || 'default'}>{ACTION_LABELS[detail.action] || detail.action}</Badge>} />
            {detail.class?.class_name && <Grid label="Lớp" value={<Badge variant="primary">{detail.class.class_name}</Badge>} />}
            {detail.student && (
              <Grid
                label="Sinh viên"
                value={
                  <div>
                    <span className="font-semibold text-primary-700">{detail.student.student_code}</span>
                    <span className="ml-2 text-slate-700">{detail.student.full_name}</span>
                  </div>
                }
              />
            )}
            <div>
              <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Dữ liệu cũ (trước)</div>
              <JsonView json={detail.old_data} />
            </div>
            <div>
              <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Dữ liệu mới (sau)</div>
              <JsonView json={detail.new_data} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Grid({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-2">
      <div className="text-xs uppercase font-semibold text-slate-500 pt-1">{label}</div>
      <div className="col-span-2 text-slate-800">{value || '—'}</div>
    </div>
  )
}

function JsonView({ json }) {
  if (!json) return <div className="p-3 bg-slate-50 rounded text-slate-400 italic text-xs">(trống)</div>
  return (
    <pre className="p-3 bg-slate-900 text-green-300 rounded-lg text-xs overflow-x-auto font-mono">
      {JSON.stringify(json, null, 2)}
    </pre>
  )
}
