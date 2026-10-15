import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import ExcelTable, { flattenStudents } from '../components/DataTable/ExcelTable'
import ColumnManager from '../components/DataTable/ColumnManager'
import Card from '../components/UI/Card'
import Button from '../components/UI/Button'
import { PageLoader, EmptyState, Badge } from '../components/UI/Skeleton'
import { getClassById } from '../services/classService'
import { getColumnsByClass } from '../services/columnService'
import { getStudentsByClass } from '../services/studentService'
import { getMyPermissionForClass } from '../services/permissionService'
import { exportToExcel } from '../services/excelService'
import { WARNING_LABELS } from '../utils/constants'
import { formatDate } from '../utils/helpers'

export default function Students() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const { showSuccess, showError, showWarning } = useToast()

  const [classInfo, setClassInfo] = useState(null)
  const [customColumns, setCustomColumns] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [permission, setPermission] = useState({ can_view: false, can_edit: false })

  const [columnManagerOpen, setColumnManagerOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)

  const loadAll = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    try {
      const [cls, cols, list, perm] = await Promise.all([
        getClassById(classId),
        getColumnsByClass(classId),
        getStudentsByClass(classId),
        isAdmin
          ? Promise.resolve({ can_view: true, can_edit: true })
          : getMyPermissionForClass(classId, profile?.id),
      ])
      if (!cls) {
        showError('Lớp không tồn tại hoặc bạn không có quyền xem')
        navigate('/classes')
        return
      }
      setClassInfo(cls)
      setCustomColumns(cols)
      setStudents(list)
      setPermission(perm)

      if (!perm.can_view && !isAdmin) {
        showWarning('Bạn không có quyền xem lớp này')
        navigate('/classes')
      }
    } catch (e) {
      showError(e.message || 'Tải dữ liệu thất bại')
    } finally {
      setLoading(false)
    }
  }, [classId, isAdmin, profile?.id, navigate, showError, showWarning])

  useEffect(() => { loadAll() }, [loadAll])

  const stats = useMemo(() => {
    const wl = { 0: 0, 1: 0, 2: 0, 3: 0 }
    students.forEach((s) => { wl[s.warning_level || 0]++ })
    return { total: students.length, ...wl }
  }, [students])

  /** Export Excel */
  const doExport = async (mode = 'all') => {
    if (!classInfo) return
    setExportBusy(true)
    try {
      const rows = []
      const headerOrder = ['student_code', 'full_name', 'date_of_birth']
      const headerNames = {
        student_code: 'Mã SV',
        full_name: 'Họ tên',
        date_of_birth: 'Ngày sinh',
        warning_level: 'Cảnh báo (Mức)',
        warning_reason: 'Lý do cảnh báo',
        warning_date: 'Ngày cảnh báo',
        warning_note: 'Ghi chú cảnh báo',
      }
      customColumns.forEach((cc) => {
        headerOrder.push(`custom:${cc.id}`)
        headerNames[`custom:${cc.id}`] = cc.column_name
      })
      headerOrder.push('warning_level', 'warning_reason', 'warning_date', 'warning_note')

      const flat = flattenStudents(students)
      let source = flat
      if (mode === 'warning1') source = flat.filter((s) => Number(s.warning_level) === 1)
      if (mode === 'warning2') source = flat.filter((s) => Number(s.warning_level) === 2)
      if (mode === 'warning3') source = flat.filter((s) => Number(s.warning_level) === 3)
      if (mode === 'warnings') source = flat.filter((s) => Number(s.warning_level) > 0)

      source.forEach((r) => {
        const row = {}
        headerOrder.forEach((key) => {
          let v = r[key]
          // Format cảnh báo text
          if (key === 'warning_level') v = WARNING_LABELS[Number(v)]?.text || v
          if (key === 'date_of_birth' || key === 'warning_date') v = formatDate(v)
          if (key.startsWith('custom:')) {
            if (v === null || v === undefined) v = ''
          }
          row[headerNames[key]] = v ?? ''
        })
        rows.push(row)
      })

      const suffix = {
        all: 'ToanBo',
        warnings: 'CanhBao',
        warning1: 'CanhBao1',
        warning2: 'CanhBao2',
        warning3: 'CanhBao3',
      }
      const filename = `${classInfo.class_name}_${suffix[mode]}_${formatDate(new Date(), 'ddMMyyyy')}.xlsx`
      exportToExcel(rows, classInfo.class_name, filename)
      showSuccess(`Xuất Excel thành công: ${filename}`)
    } catch (e) {
      showError(e.message || 'Xuất Excel thất bại')
    } finally {
      setExportBusy(false)
    }
  }

  if (loading) return <PageLoader text="Đang tải dữ liệu sinh viên..." />
  if (!classInfo) {
    return (
      <EmptyState
        icon="🏫"
        text="Lớp không tồn tại"
        action={
          <Link to="/classes">
            <Button variant="primary">← Quay lại danh sách lớp</Button>
          </Link>
        }
      />
    )
  }

  const canEdit = isAdmin || permission.can_edit
  // editableColumns: null = admin (sửa được hết); array = danh sách cột được sửa
  const editableColumns = isAdmin ? null : (permission.editable_columns || [])

  return (
    <div className="space-y-5">
      {/* Breadcrumb + thông tin lớp */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-sm text-slate-500">
              <Link to="/classes" className="text-primary-600 hover:underline">← Quản lý lớp</Link>
              {' / '}
              <span className="font-semibold text-slate-700">{classInfo.class_name}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800">
              🎓 {classInfo.class_name}
            </h2>
            {classInfo.description && (
              <p className="text-sm text-slate-500">{classInfo.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="primary">👨‍🎓 {stats.total} sinh viên</Badge>
              {[1, 2, 3].map((lvl) => {
                const meta = WARNING_LABELS[lvl]
                return (
                  <span
                    key={lvl}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    CB{lvl}: {stats[lvl]}
                  </span>
                )
              })}
              {!canEdit && (
                <Badge variant="info" className="ml-2">
                  👁️ Chỉ xem
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative group">
              <Button variant="success" disabled={exportBusy}>
                {exportBusy ? 'Đang xuất...' : '📤 Export Excel'} ▾
              </Button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10 min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden animate-fade-in">
                {[
                  { k: 'all',      label: 'Toàn bộ sinh viên' },
                  { k: 'warnings', label: 'Tất cả sinh viên cảnh báo' },
                  { k: 'warning1', label: 'Cảnh báo 1 (Xanh)' },
                  { k: 'warning2', label: 'Cảnh báo 2 (Vàng)' },
                  { k: 'warning3', label: 'Cảnh báo 3 (Đỏ)' },
                ].map((opt) => (
                  <button
                    key={opt.k}
                    onClick={() => doExport(opt.k)}
                    className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Excel Table */}
      <ExcelTable
        classInfo={classInfo}
        customColumns={customColumns}
        initialStudents={students}
        canEdit={canEdit}
        canView={true}
        editableColumns={editableColumns}
        onChanged={(signal) => {
          // Reload students/số liệu sau khi thay đổi
          if (signal === 'create' || signal === 'delete') {
            loadAll()
          }
        }}
        onOpenColumnManager={() => setColumnManagerOpen(true)}
      />

      {/* Column Manager */}
      <ColumnManager
        open={columnManagerOpen}
        onClose={() => {
          setColumnManagerOpen(false)
          // Nếu có thay đổi cột → reload để lấy dữ liệu custom_values đúng
          loadAll()
        }}
        classId={classId}
        canEdit={canEdit}
        columns={customColumns}
        setColumns={setCustomColumns}
      />
    </div>
  )
}
