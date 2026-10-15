import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import Button from '../UI/Button'
import Input from '../UI/Input'
import Select from '../UI/Select'
import {
  WARNING_OPTIONS, DATA_TYPES, WARNING_LABELS,
  CELL_COLOR_OPTIONS, CELL_COLOR_MAP,
} from '../../utils/constants'
import { WarningCellRenderer, default as WarningBadge } from './WarningBadge'
import { cn, formatDate, formatNumber, safeJson, unwrapJsonbValue } from '../../utils/helpers'
import { useToast } from '../../contexts/ToastContext'
import {
  updateStudent, createStudent, deleteStudent, deleteStudentsBulk,
} from '../../services/studentService'
import { upsertCustomValue, upsertCustomValuesBulk } from '../../services/columnService'
import { getCellStylesByClass, upsertCellStyle } from '../../services/cellStyleService'
import { insertLog } from '../../services/logService'
import Modal, { ConfirmDialog } from '../UI/Modal'

/**
 * Hàm xây dựng cột AG Grid dựa trên:
 *  - system columns (Mã SV, Họ tên, Ngày sinh, ..., Cảnh báo)
 *  - custom columns (từ DB per class)
 *
 * @param {Array} customColumns - danh sách cột tùy chỉnh
 * @param {boolean} canEdit - user có quyền sửa lớp không
 * @param {Array<string>|null} editableColumns - danh sách key cột được phép sửa (null = admin = tất cả)
 * @param {Object} cellStyles - map { studentId: { columnKey: colorValue } }
 */
export function buildColumnDefs(customColumns, canEdit, editableColumns = null, cellStyles = {}) {
  // Kiểm tra 1 cột có được sửa không
  const isEditable = (field) => {
    if (!canEdit) return false
    if (editableColumns === null || editableColumns === undefined) return true // admin
    return editableColumns.includes(field)
  }

  // Tạo cellStyle function dùng chung: lấy màu từ cellStyles map
  const makeCellStyle = (baseStyle) => (params) => {
    const base = baseStyle || {}
    const sid = params.data?.id
    const key = params.colDef?.field
    const colorVal = sid && key ? cellStyles[sid]?.[key] : undefined
    const bg = colorVal ? CELL_COLOR_MAP[colorVal] : undefined
    return bg ? { ...base, backgroundColor: bg } : base
  }

  const sysCols = [
    {
      headerName: '',
      field: '__checkbox__',
      width: 50,
      pinned: 'left',
      lockPinned: true,
      headerCheckboxSelection: canEdit,
      checkboxSelection: canEdit,
      showDisabledCheckboxes: !canEdit,
      suppressMenu: true,
      suppressMovable: true,
      resizable: false,
      editable: false,
      filter: false,
      maxWidth: 50,
    },
    {
      headerName: 'STT',
      field: '__index__',
      width: 70,
      pinned: 'left',
      lockPinned: true,
      valueGetter: (params) => params.node ? params.node.rowIndex + 1 : '',
      editable: false,
      cellStyle: makeCellStyle({ textAlign: 'center', fontWeight: '600', color: '#64748b' }),
    },
    {
      headerName: 'Mã SV', field: 'student_code',
      width: 120, pinned: 'left', lockPinned: true,
      editable: isEditable('student_code'),
      cellStyle: makeCellStyle({ fontWeight: '600', color: '#1e40af' }),
      singleClickEdit: true,
    },
    {
      headerName: 'Họ tên', field: 'full_name',
      width: 220, pinned: 'left', lockPinned: true,
      editable: isEditable('full_name'),
      cellStyle: makeCellStyle({ fontWeight: '500' }),
      singleClickEdit: false,
    },
    {
      headerName: 'Ngày sinh', field: 'date_of_birth',
      width: 130, editable: isEditable('date_of_birth'),
      cellEditor: 'agDateStringCellEditor',
      valueFormatter: (p) => formatDate(p.value, 'yyyy-MM-dd'),
      cellStyle: makeCellStyle(),
    },
    {
      headerName: 'Cảnh báo', field: 'warning_level',
      width: 130, editable: isEditable('warning_level'),
      cellRenderer: WarningCellRenderer,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: WARNING_OPTIONS.map((o) => o.value),
        valueListGap: 0,
      },
      cellEditorPopup: true,
      valueFormatter: (p) => {
        if (p.value === null || p.value === undefined || p.value === '') return ''
        return WARNING_LABELS[p.value]?.text || p.value
      },
      cellStyle: makeCellStyle(),
    },
    {
      headerName: 'Lý do cảnh báo', field: 'warning_reason',
      width: 220, editable: isEditable('warning_reason'),
      cellStyle: makeCellStyle(),
    },
    {
      headerName: 'Ngày cảnh báo', field: 'warning_date',
      width: 140, editable: isEditable('warning_date'),
      cellEditor: 'agDateStringCellEditor',
      valueFormatter: (p) => formatDate(p.value, 'yyyy-MM-dd'),
      cellStyle: makeCellStyle(),
    },
    {
      headerName: 'Ghi chú cảnh báo', field: 'warning_note',
      width: 220, editable: isEditable('warning_note'),
      cellStyle: makeCellStyle(),
    },
  ]

  // Custom columns vào giữa, trước Cảnh báo (hoặc cuối)
  const customCols = (customColumns || []).map((cc) => {
    const field = `custom:${cc.id}`
    const col = {
      headerName: cc.column_name,
      field,
      colId: field,
      width: 160,
      editable: isEditable(field),
      __custom_column: true,
      __column_def: cc,
      cellStyle: makeCellStyle(),
    }
    switch (cc.data_type) {
      case DATA_TYPES.NUMBER:
        col.cellEditor = 'agNumberCellEditor'
        col.valueGetter = (p) => {
          const v = p.data?.[`custom:${cc.id}`]
          return v === undefined || v === null ? '' : Number(v)
        }
        col.valueFormatter = (p) => {
          const v = p.value
          if (v === null || v === undefined || v === '' || Number.isNaN(v)) return ''
          return formatNumber(v, 2)
        }
        col.cellStyle = makeCellStyle({ textAlign: 'right' })
        break
      case DATA_TYPES.DATE:
        col.cellEditor = 'agDateStringCellEditor'
        col.valueFormatter = (p) => formatDate(p.value, 'yyyy-MM-dd')
        break
      case DATA_TYPES.CHECKBOX:
        col.cellEditor = 'agCheckboxCellEditor'
        col.cellRenderer = (p) => {
          const v = !!p.value
          return (
            <div className="flex items-center justify-center w-full h-full">
              <input type="checkbox" checked={v} readOnly className="w-4 h-4 accent-primary-600" />
            </div>
          )
        }
        col.valueGetter = (p) => {
          const v = p.data?.[`custom:${cc.id}`]
          if (v === true || v === 'true' || v === 1 || v === '1') return true
          if (v === false || v === 'false' || v === 0 || v === '0') return false
          return v || false
        }
        col.width = 90
        col.headerCheckboxSelection = false
        break
      case DATA_TYPES.SELECT:
        col.cellEditor = 'agSelectCellEditor'
        col.cellEditorParams = {
          values: Array.isArray(cc.options) ? cc.options : [],
        }
        col.cellEditorPopup = true
        break
      default: // text
        col.cellEditor = 'agTextCellEditor'
    }
    return col
  })

  const result = []
  // STT, Mã SV, Họ tên, Ngày sinh → custom columns → cảnh báo
  sysCols.forEach((c) => {
    if (c.field === 'warning_level') {
      customCols.forEach((cc) => result.push(cc))
    }
    result.push(c)
  })

  return result
}

/**
 * Map students + custom_values -> rowData flat
 */
export function flattenStudents(students) {
  return (students || []).map((s) => {
    const row = { ...s, id: s.id, class_id: s.class_id }
    // flatten custom values
    ;(s.custom_values || []).forEach((cv) => {
      row[`custom:${cv.column_id}`] = unwrapJsonbValue(cv.value)
    })
    delete row.custom_values
    return row
  })
}

/**
 * AG Grid Bảng sinh viên dạng Excel
 * Props:
 *  - classInfo, customColumns, students, canEdit, canView
 *  - editableColumns: array<string>|null - null = admin (được sửa hết)
 *  - onStudentsChanged(signal)  - callback để page cha refresh danh sách
 */
export default function ExcelTable({
  classInfo,
  customColumns,
  initialStudents,
  canEdit,
  canView,
  editableColumns = null,
  onChanged,
  onOpenColumnManager,
}) {
  const gridRef = useRef(null)
  const { showSuccess, showError } = useToast()

  const [rowData, setRowData] = useState(() => flattenStudents(initialStudents))
  const [quickFilter, setQuickFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [warningFilter, setWarningFilter] = useState('')

  // Cell styles (màu ô): { studentId: { columnKey: colorValue } }
  const [cellStyles, setCellStyles] = useState({})
  // Context menu cho bôi màu ô: { x, y, studentId, columnKey } | null
  const [ctxMenu, setCtxMenu] = useState(null)

  const [newStudentOpen, setNewStudentOpen] = useState(false)
  const [newForm, setNewForm] = useState({
    student_code: '', full_name: '', date_of_birth: '',
    warning_level: 0, warning_reason: '', warning_date: '', warning_note: '',
  })
  const [newErr, setNewErr] = useState({})
  const [newSubmitting, setNewSubmitting] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(null) // 'one' | 'bulk'
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Sync khi initialStudents thay đổi (từ parent)
  useEffect(() => {
    setRowData(flattenStudents(initialStudents))
  }, [initialStudents])

  // Load cell styles khi classInfo thay đổi
  useEffect(() => {
    let cancelled = false
    if (!classInfo?.id) return
    ;(async () => {
      try {
        const map = await getCellStylesByClass(classInfo.id)
        if (!cancelled) setCellStyles(map)
      } catch (_) { /* bỏ qua lỗi load màu */ }
    })()
    return () => { cancelled = true }
  }, [classInfo?.id])

  // Áp dụng warning filter
  const filteredRowData = useMemo(() => {
    if (!warningFilter) return rowData
    const lvl = Number(warningFilter)
    return rowData.filter((r) => Number(r.warning_level) === lvl)
  }, [rowData, warningFilter])

  const columnDefs = useMemo(() => {
    return buildColumnDefs(customColumns, canEdit, editableColumns, cellStyles)
  }, [customColumns, canEdit, editableColumns, cellStyles])

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    suppressMovable: false,
    wrapText: false,
    autoHeight: false,
  }), [])

  const getRowStyle = useCallback((params) => {
    const lvl = Number(params.data?.warning_level || 0)
    if (lvl === 1) return { className: 'row-wl-1' }
    if (lvl === 2) return { className: 'row-wl-2' }
    if (lvl === 3) return { className: 'row-wl-3' }
    return undefined
  }, [])

  const onSelectionChanged = useCallback(() => {
    const nodes = gridRef.current?.api?.getSelectedRows() || []
    setSelectedIds(nodes.map((n) => n.id))
  }, [])

  /**
   * Xử lý right-click trên ô: hiện menu chọn màu (chỉ khi có quyền sửa)
   */
  const onCellContextMenu = useCallback((params) => {
    if (!canEdit) return
    const e = params.event
    if (e) e.preventDefault()
    const sid = params.data?.id
    const key = params.colDef?.field
    if (!sid || !key || key === '__checkbox__' || key === '__index__') return
    setCtxMenu({
      x: e ? e.clientX : 0,
      y: e ? e.clientY : 0,
      studentId: sid,
      columnKey: key,
    })
  }, [canEdit])

  // Đóng context menu khi click ra ngoài / scroll
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [ctxMenu])

  /**
   * Áp dụng màu cho 1 ô (hoặc nhiều ô đang chọn nếu có range selection)
   */
  const applyColor = useCallback(async (color) => {
    if (!ctxMenu) return
    const { studentId, columnKey } = ctxMenu
    setCtxMenu(null)

    // Lấy danh sách các ô trong range selection (nếu có)
    const api = gridRef.current?.api
    let targets = [{ studentId, columnKey }]
    try {
      const ranges = api?.getCellRanges?.() || []
      if (ranges.length > 0) {
        const collected = []
        ranges.forEach((r) => {
          const startRow = r.startRow?.rowIndex
          const endRow = r.endRow?.rowIndex
          const colIds = r.columns.map((c) => c.getColId())
          const minRow = Math.min(startRow ?? 0, endRow ?? 0)
          const maxRow = Math.max(startRow ?? 0, endRow ?? 0)
          for (let i = minRow; i <= maxRow; i++) {
            const node = api.getDisplayedRowAtIndex(i)
            const sid = node?.data?.id
            if (!sid) continue
            colIds.forEach((cid) => {
              if (cid === '__checkbox__' || cid === '__index__') return
              collected.push({ studentId: sid, columnKey: cid })
            })
          }
        })
        if (collected.length > 0) targets = collected
      }
    } catch (_) { /* không có range selection */ }

    try {
      // Cập nhật state local trước để UI nhạy
      setCellStyles((prev) => {
        const next = { ...prev }
        targets.forEach(({ studentId: sid, columnKey: key }) => {
          if (!next[sid]) next[sid] = {}
          if (color) next[sid][key] = color
          else delete next[sid][key]
        })
        return next
      })
      // Lưu DB
      await Promise.all(targets.map(({ studentId: sid, columnKey: key }) =>
        upsertCellStyle(sid, key, color || null)
      ))
      showSuccess(color ? 'Đã áp dụng màu' : 'Đã xóa màu')
    } catch (err) {
      showError(err.message || 'Lưu màu thất bại')
    }
  }, [ctxMenu, showSuccess, showError])

  // Áp dụng quick filter
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.setGridOption('quickFilterText', quickFilter)
    }
  }, [quickFilter])

  /**
   * Lưu giá trị ô thay đổi vào Supabase
   */
  const onCellValueChanged = useCallback(async (ev) => {
    const { data, colDef, oldValue, newValue } = ev
    if (oldValue === newValue) return
    if (!canEdit) {
      showError('Bạn không có quyền sửa dữ liệu lớp này')
      // rollback
      if (gridRef.current?.api) {
        gridRef.current.api.refreshCells({ force: true })
      }
      return
    }

    const field = colDef.field
    const isCustom = colDef.__custom_column
    const colMeta = colDef.__column_def

    try {
      if (isCustom) {
        // upsert custom_values
        await upsertCustomValue(data.id, colMeta.id, newValue ?? null)
      } else {
        // Cập nhật students
        const payload = { [field]: newValue ?? null }
        await updateStudent(data.id, payload)
        // Insert log nếu cảnh báo
        if (field === 'warning_level') {
          insertLog({
            action: 'UPDATE_WARNING',
            class_id: data.class_id,
            student_id: data.id,
            old_data: { warning_level: oldValue },
            new_data: { warning_level: newValue },
          })
        }
      }
      showSuccess('Đã lưu thay đổi')
      // cập nhật lại rowData state để in sync
      setRowData((prev) =>
        prev.map((r) => (r.id === data.id ? { ...r, [field]: newValue } : r))
      )
    } catch (err) {
      showError(err.message || 'Lưu thất bại, dữ liệu sẽ được khôi phục')
      // Rollback giá trị trên grid
      if (gridRef.current?.api) {
        gridRef.current.api.refreshCells({
          rowNodes: [ev.node],
          force: true,
        })
      }
      // Rollback state
      setRowData((prev) =>
        prev.map((r) => (r.id === data.id ? { ...r, [field]: oldValue } : r))
      )
    }
  }, [canEdit, showError, showSuccess])

  /** Thêm sinh viên mới */
  const submitNewStudent = async () => {
    const e = {}
    if (!newForm.student_code.trim()) e.student_code = 'Nhập mã sinh viên'
    if (!newForm.full_name.trim()) e.full_name = 'Nhập họ tên sinh viên'
    setNewErr(e)
    if (Object.keys(e).length) return

    setNewSubmitting(true)
    try {
      const payload = {
        class_id: classInfo.id,
        student_code: newForm.student_code.trim(),
        full_name: newForm.full_name.trim(),
        date_of_birth: newForm.date_of_birth || null,
        warning_level: Number(newForm.warning_level) || 0,
        warning_reason: newForm.warning_reason.trim() || null,
        warning_date: newForm.warning_date || null,
        warning_note: newForm.warning_note.trim() || null,
      }
      const saved = await createStudent(payload)
      setRowData((prev) => [...prev, saved])
      showSuccess(`Đã thêm sinh viên ${saved.student_code}`)
      setNewStudentOpen(false)
      onChanged?.('create')
    } catch (err) {
      showError(err.message || 'Thêm sinh viên thất bại')
    } finally {
      setNewSubmitting(false)
    }
  }

  /** Xóa 1 hoặc nhiều */
  const performDelete = async () => {
    setDeleting(true)
    try {
      if (confirmDelete === 'one' && deleteTarget) {
        await deleteStudent(deleteTarget.id)
        setRowData((prev) => prev.filter((r) => r.id !== deleteTarget.id))
        showSuccess(`Đã xóa sinh viên ${deleteTarget.student_code}`)
      } else if (confirmDelete === 'bulk' && selectedIds.length) {
        await deleteStudentsBulk(selectedIds)
        setRowData((prev) => prev.filter((r) => !selectedIds.includes(r.id)))
        showSuccess(`Đã xóa ${selectedIds.length} sinh viên`)
        gridRef.current?.api?.deselectAll()
      }
      setConfirmDelete(null)
      setDeleteTarget(null)
      onChanged?.('delete')
    } catch (err) {
      showError(err.message || 'Xóa thất bại')
    } finally {
      setDeleting(false)
    }
  }

  /** Export (Export sẽ dùng hook từ ngoài, ở đây chỉ hiển thị nút gọi callback) */

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            placeholder="🔍 Tìm nhanh mã SV / tên..."
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
          />
        </div>
        <Select
          wrapperClass="w-full sm:w-48"
          placeholder="Tất cả cấp độ cảnh báo"
          value={warningFilter}
          onChange={(e) => setWarningFilter(e.target.value)}
          options={WARNING_OPTIONS}
        />
        <div className="flex-1" />
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="success" onClick={() => setNewStudentOpen(true)}>
              ➕ Thêm sinh viên
            </Button>
          )}
          {canEdit && selectedIds.length > 0 && (
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete('bulk')
                setDeleteTarget(null)
              }}
            >
              🗑️ Xóa ({selectedIds.length})
            </Button>
          )}
          <Button variant="secondary" onClick={onOpenColumnManager}>
            📋 Quản lý cột
          </Button>
        </div>
      </div>

      {/* Bảng AG Grid */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div
          className="ag-theme-quartz"
          style={{ height: 'calc(100vh - 380px)', minHeight: 500 }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={filteredRowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={42}
            headerHeight={44}
            rowSelection="multiple"
            enableRangeSelection={true}
            suppressRowClickSelection={true}
            animateRows={true}
            getRowStyle={getRowStyle}
            onSelectionChanged={onSelectionChanged}
            onCellValueChanged={onCellValueChanged}
            onCellContextMenu={onCellContextMenu}
            stopEditingWhenCellsLoseFocus={true}
            enterNavigatesVertically={true}
            enterNavigatesVerticallyAfterEdit={true}
            pagination={true}
            paginationPageSize={50}
            paginationPageSizeSelector={[20, 50, 100, 200]}
            localeText={{
              page: 'Trang',
              to: 'đến',
              of: 'trong tổng',
              next: 'Sau',
              previous: 'Trước',
              first: 'Đầu',
              last: 'Cuối',
              loadingOoo: 'Đang tải...',
              noRowsToShow: 'Không có dữ liệu',
              searchPlaceholder: 'Tìm...',
              filterOoo: 'Lọc',
              applyFilter: 'Áp dụng',
              resetFilter: 'Đặt lại',
            }}
          />
        </div>
      </div>

      {/* Context menu: Bôi màu ô */}
      {ctxMenu && (
        <div
          className="fixed z-[1000] bg-white border border-slate-200 rounded-lg shadow-xl p-2 animate-fade-in"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs text-slate-500 px-2 py-1 font-medium">🎨 Bôi màu ô</div>
          <div className="grid grid-cols-4 gap-1 p-1">
            {CELL_COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => applyColor(c.value)}
                className="w-7 h-7 rounded border border-slate-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: c.bg }}
              />
            ))}
          </div>
          <button
            onClick={() => applyColor(null)}
            className="w-full mt-1 text-xs text-slate-600 hover:bg-slate-100 px-2 py-1 rounded"
          >
            🚫 Xóa màu
          </button>
        </div>
      )}

      {/* Form Thêm sinh viên */}
      <Modal
        open={newStudentOpen}
        onClose={() => !newSubmitting && setNewStudentOpen(false)}
        title="Thêm sinh viên mới"
        size="lg"
        closeOnBackdrop={!newSubmitting}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewStudentOpen(false)} disabled={newSubmitting}>
              Hủy
            </Button>
            <Button variant="primary" onClick={submitNewStudent} disabled={newSubmitting}>
              {newSubmitting ? 'Đang lưu...' : 'Thêm sinh viên'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Mã sinh viên *" value={newForm.student_code}
                 onChange={(e) => setNewForm({ ...newForm, student_code: e.target.value })}
                 error={newErr.student_code} placeholder="SV001" autoFocus />
          <Input label="Họ và tên *" value={newForm.full_name}
                 onChange={(e) => setNewForm({ ...newForm, full_name: e.target.value })}
                 error={newErr.full_name} placeholder="Nguyễn Văn A" />
          <Input label="Ngày sinh" type="date" value={newForm.date_of_birth}
                 onChange={(e) => setNewForm({ ...newForm, date_of_birth: e.target.value })} />
          <Select label="Cảnh báo"
                  value={String(newForm.warning_level)}
                  onChange={(e) => setNewForm({ ...newForm, warning_level: e.target.value })}
                  options={WARNING_OPTIONS}
                  placeholder={null} />
          <Input label="Ngày cảnh báo" type="date" value={newForm.warning_date}
                 onChange={(e) => setNewForm({ ...newForm, warning_date: e.target.value })} />
          <Input label="Lý do cảnh báo" value={newForm.warning_reason}
                 onChange={(e) => setNewForm({ ...newForm, warning_reason: e.target.value })} />
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700 block mb-1">Ghi chú</label>
            <textarea rows={2} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={newForm.warning_note}
                      onChange={(e) => setNewForm({ ...newForm, warning_note: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Confirm xóa */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        title="Xóa sinh viên"
        message={
          confirmDelete === 'one' && deleteTarget
            ? `Bạn có chắc muốn xóa sinh viên:\n${deleteTarget.student_code} - ${deleteTarget.full_name}?\n\nKhông thể hoàn tác.`
            : confirmDelete === 'bulk'
              ? `Bạn có chắc muốn xóa ${selectedIds.length} sinh viên đang chọn?\n\nKhông thể hoàn tác.`
              : ''
        }
        confirmText="Xóa vĩnh viễn"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={performDelete}
      />
    </div>
  )
}
