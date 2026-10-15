import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Card from '../components/UI/Card'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import Select from '../components/UI/Select'
import WarningBadge from '../components/DataTable/WarningBadge'
import { PageLoader, EmptyState, Badge } from '../components/UI/Skeleton'
import { WARNING_OPTIONS, WARNING_LABELS } from '../utils/constants'
import { getAllClasses } from '../services/classService'
import { getWarningStudents } from '../services/studentService'
import { cn, formatDate } from '../utils/helpers'

export default function Warnings() {
  const { isAdmin } = useAuth()
  const { showError } = useToast()

  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [list, setList] = useState([])

  const [filters, setFilters] = useState({
    classId: '',
    level: '',
    keyword: '',
    fromDate: '',
    toDate: '',
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)

  const loadClasses = async () => {
    try {
      const c = await getAllClasses()
      setClasses(c)
    } catch (e) {
      console.error(e)
    }
  }

  const loadList = async () => {
    setLoading(true)
    try {
      const data = await getWarningStudents(appliedFilters)
      setList(data)
    } catch (e) {
      showError(e.message || 'Tải danh sách thất bại')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClasses()
  }, [])
  useEffect(() => { loadList() }, [appliedFilters])

  const stats = useMemo(() => {
    const wl = { 1: 0, 2: 0, 3: 0 }
    list.forEach((s) => {
      const l = Number(s.warning_level)
      if (l >= 1) wl[l]++
    })
    return wl
  }, [list])

  return (
    <div className="space-y-5">
      {/* Filter panel */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select
            label="Lớp học"
            value={filters.classId}
            onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
            options={classes.map((c) => ({ value: c.id, label: c.class_name }))}
          />
          <Select
            label="Cấp độ cảnh báo"
            value={filters.level}
            onChange={(e) => setFilters({ ...filters, level: e.target.value })}
            options={WARNING_OPTIONS.filter((o) => o.value !== 0)}
          />
          <Input
            label="Từ ngày (cảnh báo)"
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
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Mã SV / Họ tên"
                placeholder="Tìm kiếm..."
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={() => setAppliedFilters({ ...filters })}>
            🔍 Áp dụng bộ lọc
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((lvl) => {
          const meta = WARNING_LABELS[lvl]
          return (
            <Card key={lvl} className={cn('border-l-4', lvl === 1 && 'border-l-green-500', lvl === 2 && 'border-l-amber-500', lvl === 3 && 'border-l-red-500')}>
              <div className="flex items-center gap-4">
                <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow', meta.bg)}>
                  ⚠️
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500">{meta.text}</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-0.5">{stats[lvl]}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Danh sách */}
      <Card
        title={`Danh sách sinh viên cảnh báo (${list.length})`}
      >
        {loading ? (
          <PageLoader text="Đang tải danh sách..." />
        ) : list.length === 0 ? (
          <EmptyState
            text="Không có sinh viên nào trong điều kiện lọc"
            icon="✅"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">STT</th>
                  <th className="px-4 py-3 font-semibold">Mã SV</th>
                  <th className="px-4 py-3 font-semibold">Họ tên</th>
                  <th className="px-4 py-3 font-semibold">Lớp</th>
                  <th className="px-4 py-3 font-semibold">Cấp độ</th>
                  <th className="px-4 py-3 font-semibold">Lý do</th>
                  <th className="px-4 py-3 font-semibold">Ngày</th>
                  <th className="px-4 py-3 font-semibold">Ghi chú</th>
                  <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s, idx) => {
                  const lvl = Number(s.warning_level)
                  const rowCls =
                    lvl === 1 ? 'bg-green-50/60' :
                    lvl === 2 ? 'bg-amber-50/60' :
                    lvl === 3 ? 'bg-red-50/60' : ''
                  return (
                    <tr key={s.id} className={`border-t border-slate-100 hover:bg-white ${rowCls}`}>
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-primary-700">{s.student_code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{s.full_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="primary">{s.class?.class_name}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <WarningBadge level={lvl} />
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[240px] truncate">
                        {s.warning_reason || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(s.warning_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate">
                        {s.warning_note || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/classes/${s.class_id}/students`}>
                          <Button variant="ghost" size="sm">
                            Mở lớp →
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
