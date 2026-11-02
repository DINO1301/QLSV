import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import Button from '../UI/Button'
import Input from '../UI/Input'
import Select from '../UI/Select'
import {
  WARNING_OPTIONS, DATA_TYPES, WARNING_LABELS,
  CELL_COLOR_OPTIONS, CELL_COLOR_MAP,
} from '../../utils/constants'
import { WarningCellRenderer } from './WarningBadge'
import { formatDate, formatNumber, unwrapJsonbValue } from '../../utils/helpers'
import { useToast } from '../../contexts/ToastContext'
import {
  updateStudent, deleteStudent, deleteStudentsBulk,
} from '../../services/studentService'
import { upsertCustomValue } from '../../services/columnService'
import { upsertCellStyle, getCellStylesAll } from '../../services/cellStyleService'
import { insertLog } from '../../services/logService'
import { ConfirmDialog } from '../UI/Modal'

export function buildGlobalColumnDefs(uniqueColumnNames, allColumns, canEdit, cellStyles = {}) {
  const isEditable = (field) => {
    return canEdit // Trong dashboard global, admin hoặc người có quyền dashboard có thể sửa
  }

  const makeCellStyle = (baseStyle) => (params) => {
    const base = baseStyle || {}
    const sid = params.data?.id
    const field = params.colDef?.field
    
    // Nếu là cột custom, chúng ta cần tìm column_id thực tế của sinh viên đó
    let colorKey = field
    if (field.startsWith('gcustom:')) {
      const colName = field.replace('gcustom:', '')
      const studentClassId = params.data?.class_id
      const actualCol = allColumns.find(c => c.class_id === studentClassId && c.column_name === colName)
      if (actualCol) {
        colorKey = `custom:${actualCol.id}`
      }
    }

    const colorVal = sid && colorKey ? cellStyles[sid]?.[colorKey] : undefined
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
    },
    {
      headerName: 'Họ tên', field: 'full_name',
      width: 200, pinned: 'left', lockPinned: true,
      editable: isEditable('full_name'),
      cellStyle: makeCellStyle({ fontWeight: '500' }),
    },
    {
      headerName: 'Lớp', field: 'class_name',
      width: 120, pinned: 'left',
      editable: false,
      cellStyle: makeCellStyle({ fontWeight: '500', color: '#6366f1' }),
    },
    {
      headerName: 'Ngày sinh', field: 'date_of_birth',
      width: 120, editable: isEditable('date_of_birth'),
      cellEditor: 'agDateStringCellEditor',
      valueFormatter: (p) => formatDate(p.value, 'yyyy-MM-dd'),
      cellStyle: makeCellStyle(),
    },
  ]

  const customCols = uniqueColumnNames.map((colName) => {
    const field = `gcustom:${colName}`
    // Tìm kiểu dữ liệu phổ biến nhất cho tên cột này (hoặc lấy cái đầu tiên)
    const sampleCol = allColumns.find(c => c.column_name === colName)
    const dataType = sampleCol?.data_type || DATA_TYPES.TEXT

    const col = {
      headerName: colName,
      field,
      colId: field,
      width: 150,
      editable: (params) => {
        if (!canEdit) return false
        // Chỉ cho phép sửa nếu lớp của sinh viên này thực sự có cột này
        const studentClassId = params.data?.class_id
        return allColumns.some(c => c.class_id === studentClassId && c.column_name === colName)
      },
      cellStyle: makeCellStyle(),
      valueGetter: (params) => {
        const studentClassId = params.data?.class_id
        const actualCol = allColumns.find(c => c.class_id === studentClassId && c.column_name === colName)
        if (!actualCol) return null
        return params.data[`custom:${actualCol.id}`]
      },
      valueSetter: (params) => {
        const studentClassId = params.data?.class_id
        const actualCol = allColumns.find(c => c.class_id === studentClassId && c.column_name === colName)
        if (!actualCol) return false
        params.data[`custom:${actualCol.id}`] = params.newValue
        return true
      }
    }

    switch (dataType) {
      case DATA_TYPES.NUMBER:
        col.cellEditor = 'agNumberCellEditor'
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
        col.width = 100
        break
      case DATA_TYPES.SELECT:
        col.cellEditor = 'agSelectCellEditor'
        col.cellEditorParams = (params) => {
          const studentClassId = params.data?.class_id
          const actualCol = allColumns.find(c => c.class_id === studentClassId && c.column_name === colName)
          return {
            values: Array.isArray(actualCol?.options) ? actualCol.options : [],
          }
        }
        col.cellEditorPopup = true
        break
    }
    return col
  })

  const warningCols = [
    {
      headerName: 'Cảnh báo', field: 'warning_level',
      width: 130, editable: isEditable('warning_level'),
      cellRenderer: WarningCellRenderer,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: WARNING_OPTIONS.map((o) => o.value),
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
      width: 200, editable: isEditable('warning_reason'),
      cellStyle: makeCellStyle(),
    },
    {
      headerName: 'Ngày cảnh báo', field: 'warning_date',
      width: 130, editable: isEditable('warning_date'),
      cellEditor: 'agDateStringCellEditor',
      valueFormatter: (p) => formatDate(p.value, 'yyyy-MM-dd'),
      cellStyle: makeCellStyle(),
    },
    {
      headerName: 'Ghi chú cảnh báo', field: 'warning_note',
      width: 200, editable: isEditable('warning_note'),
      cellStyle: makeCellStyle(),
    },
  ]

  return [...sysCols, ...customCols, ...warningCols]
}

export function flattenStudentsGlobal(students) {
  return (students || []).map((s) => {
    const row = { ...s, id: s.id, class_id: s.class_id, class_name: s.class?.class_name }
    ;(s.custom_values || []).forEach((cv) => {
      row[`custom:${cv.column_id}`] = unwrapJsonbValue(cv.value)
    })
    delete row.custom_values
    return row
  })
}

export default function GlobalStudentTable({
  students: initialStudents,
  columns: allColumns,
  canEdit,
  onChanged,
}) {
  const gridRef = useRef(null)
  const { showSuccess, showError } = useToast()

  const [rowData, setRowData] = useState(() => flattenStudentsGlobal(initialStudents))
  const [quickFilter, setQuickFilter] = useState('')
  const [filters, setFilters] = useState({}) // Dynamic filters: { field: value }
  const [showFilterForm, setShowFilterForm] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [cellStyles, setCellStyles] = useState({})
  const [ctxMenu, setCtxMenu] = useState(null)
  const [colorMenu, setColorMenu] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setRowData(flattenStudentsGlobal(initialStudents))
  }, [initialStudents])

  // Lọc dữ liệu dựa trên bộ lọc động
  const filteredRowData = useMemo(() => {
    return rowData.filter(row => {
      // 1. Quick filter (Mã SV / Tên)
      if (quickFilter) {
        const q = quickFilter.toLowerCase()
        const matchQuick = 
          String(row.student_code || '').toLowerCase().includes(q) ||
          String(row.full_name || '').toLowerCase().includes(q)
        if (!matchQuick) return false
      }

      // 2. Dynamic filters from form
      for (const [field, val] of Object.entries(filters)) {
        if (val === undefined || val === null || val === '') continue
        
        let rowVal = row[field]
        // Nếu là cột custom gcustom:ColName
        if (field.startsWith('gcustom:')) {
          const colName = field.replace('gcustom:', '')
          const actualCol = allColumns.find(c => c.class_id === row.class_id && c.column_name === colName)
          rowVal = actualCol ? row[`custom:${actualCol.id}`] : null
        }

        const sRowVal = String(rowVal || '').toLowerCase()
        const sFilterVal = String(val).toLowerCase()
        
        if (!sRowVal.includes(sFilterVal)) return false
      }
      return true
    })
  }, [rowData, quickFilter, filters, allColumns])

  // Danh sách các cột để lọc
  const filterableColumns = useMemo(() => {
    const cols = [
      { field: 'student_code', label: 'Mã sinh viên', type: 'text' },
      { field: 'full_name', label: 'Họ tên', type: 'text' },
      { field: 'class_id', label: 'Lớp', type: 'select', options: [] },
      { field: 'warning_level', label: 'Mức độ cảnh báo', type: 'select', options: WARNING_OPTIONS },
      { field: 'gender', label: 'Giới tính', type: 'text' },
      { field: 'student_group', label: 'Nhóm', type: 'text' },
      { field: 'status', label: 'Trạng thái', type: 'text' },
    ]

    // Thêm các cột custom duy nhất
    const uniqueCustomNames = new Set()
    allColumns.forEach(c => uniqueCustomNames.add(c.column_name))
    Array.from(uniqueCustomNames).sort().forEach(name => {
      cols.push({ field: `gcustom:${name}`, label: name, type: 'text' })
    })

    // Cập nhật options cho Lớp
    const classMap = new Map()
    initialStudents.forEach(s => {
      if (s.class_id && s.class?.class_name) classMap.set(s.class_id, s.class.class_name)
    })
    const classCol = cols.find(c => c.field === 'class_id')
    if (classCol) {
      classCol.options = Array.from(classMap.entries()).map(([id, name]) => ({ value: id, label: name }))
    }

    return cols
  }, [allColumns, initialStudents])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const map = await getCellStylesAll()
        if (!cancelled) setCellStyles(map)
      } catch (_) {}
    })()
    return () => { cancelled = true }
  }, [])

  const uniqueColumnNames = useMemo(() => {
    const names = new Set()
    allColumns.forEach(c => names.add(c.column_name))
    return Array.from(names).sort()
  }, [allColumns])

  const columnDefs = useMemo(() => {
    return buildGlobalColumnDefs(uniqueColumnNames, allColumns, canEdit, cellStyles)
  }, [uniqueColumnNames, allColumns, canEdit, cellStyles])

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    suppressMovable: false,
  }), [])

  const onCellValueChanged = useCallback(async (ev) => {
    const { data, colDef, oldValue, newValue } = ev
    if (oldValue === newValue) return

    const field = colDef.field
    const studentClassId = data.class_id

    try {
      if (field.startsWith('gcustom:')) {
        const colName = field.replace('gcustom:', '')
        const actualCol = allColumns.find(c => c.class_id === studentClassId && c.column_name === colName)
        if (actualCol) {
          await upsertCustomValue(data.id, actualCol.id, newValue ?? null)
        }
      } else {
        const payload = { [field]: newValue ?? null }
        await updateStudent(data.id, payload)
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
      setRowData((prev) =>
        prev.map((r) => (r.id === data.id ? { ...r, [field]: newValue } : r))
      )
      onChanged?.('update')
    } catch (err) {
      showError(err.message || 'Lưu thất bại')
      gridRef.current?.api?.refreshCells({ rowNodes: [ev.node], force: true })
    }
  }, [allColumns, showSuccess, showError, onChanged])

  const onCellContextMenu = useCallback((params) => {
    if (!canEdit) return
    const e = params.event
    if (e) e.preventDefault()
    const sid = params.data?.id
    const field = params.colDef?.field
    if (!sid || !field || field === '__checkbox__' || field === '__index__') return

    let colorKey = field
    if (field.startsWith('gcustom:')) {
      const colName = field.replace('gcustom:', '')
      const studentClassId = params.data?.class_id
      const actualCol = allColumns.find(c => c.class_id === studentClassId && c.column_name === colName)
      if (actualCol) {
        colorKey = `custom:${actualCol.id}`
      } else {
        return // Không có cột thực tế thì không bôi màu được
      }
    }

    setCtxMenu({
      x: e ? e.clientX : 0,
      y: e ? e.clientY : 0,
      studentId: sid,
      columnKey: colorKey,
    })
  }, [canEdit, allColumns])

  const applyColor = useCallback(async (color) => {
    const api = gridRef.current?.api
    let targets = []

    const selectedNodes = api.getSelectedNodes()
    const focusedCell = api.getFocusedCell()

    if (selectedNodes.length > 0) {
      // Nếu có chọn hàng qua checkbox -> Bôi màu TOÀN BỘ DÒNG cho các hàng đó
      selectedNodes.forEach(node => {
        const sid = node.data.id
        const studentClassId = node.data.class_id

        // 1. Các cột hệ thống
        const sysFields = [
          'student_code', 'full_name', 'class_name', 'date_of_birth',
          'warning_level', 'warning_reason', 'warning_date', 'warning_note'
        ]
        sysFields.forEach(field => {
          targets.push({ studentId: sid, columnKey: field })
        })

        // 2. Các cột tùy chỉnh của sinh viên đó
        allColumns.forEach(col => {
          if (col.class_id === studentClassId) {
            targets.push({ studentId: sid, columnKey: `custom:${col.id}` })
          }
        })
      })
    } else if (focusedCell) {
      // Nếu không chọn hàng nào qua checkbox -> Chỉ bôi màu Ô đang focus
      const colId = focusedCell.column.getColId()
      const node = api.getDisplayedRowAtIndex(focusedCell.rowIndex)
      const sid = node?.data?.id
      if (sid && colId !== '__checkbox__' && colId !== '__index__') {
        const studentClassId = node.data.class_id
        let key = colId
        if (colId.startsWith('gcustom:')) {
          const colName = colId.replace('gcustom:', '')
          const actualCol = allColumns.find(c => c.class_id === studentClassId && c.column_name === colName)
          if (actualCol) key = `custom:${actualCol.id}`
          else return
        }
        targets = [{ studentId: sid, columnKey: key }]
      }
    }

    if (targets.length === 0) {
      showError('Vui lòng chọn hàng (checkbox) hoặc click vào ô cần bôi màu')
      setColorMenu(null)
      return
    }

    setColorMenu(null)
    try {
      setCellStyles((prev) => {
        const next = { ...prev }
        targets.forEach(({ studentId: sid, columnKey: key }) => {
          if (!next[sid]) next[sid] = {}
          if (color) next[sid][key] = color
          else delete next[sid][key]
        })
        return next
      })
      await Promise.all(targets.map(({ studentId: sid, columnKey: key }) =>
        upsertCellStyle(sid, key, color || null)
      ))
      showSuccess(color ? 'Đã áp dụng màu' : 'Đã xóa màu')
    } catch (err) {
      showError(err.message || 'Lưu màu thất bại')
    }
  }, [allColumns, showSuccess, showError])

  const openColorMenu = (e) => {
    e.stopPropagation() // Ngăn sự kiện bubble lên window làm đóng menu ngay lập tức
    const rect = e.currentTarget.getBoundingClientRect()
    setColorMenu({
      x: rect.left,
      y: rect.bottom + 5
    })
  }

  useEffect(() => {
    if (!ctxMenu && !colorMenu) return
    const close = () => {
      setCtxMenu(null)
      setColorMenu(null)
    }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [ctxMenu, colorMenu])

  const performDelete = async () => {
    setDeleting(true)
    try {
      if (confirmDelete === 'bulk' && selectedIds.length) {
        await deleteStudentsBulk(selectedIds)
        setRowData((prev) => prev.filter((r) => !selectedIds.includes(r.id)))
        showSuccess(`Đã xóa ${selectedIds.length} sinh viên`)
        gridRef.current?.api?.deselectAll()
        onChanged?.('delete')
      }
      setConfirmDelete(null)
    } catch (err) {
      showError(err.message || 'Xóa thất bại')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.setGridOption('quickFilterText', quickFilter)
    }
  }, [quickFilter])

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            placeholder="🔍 Tìm mã SV / tên..."
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
          />
        </div>
        
        <Button 
          variant={showFilterForm ? "primary" : "secondary"} 
          onClick={() => setShowFilterForm(!showFilterForm)}
        >
          {showFilterForm ? "🔼 Đóng lọc" : "🔽 Bộ lọc nâng cao"}
        </Button>

        <div className="flex-1" />
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="secondary" onClick={openColorMenu}>
              🎨 Bôi màu
            </Button>
          )}
          {canEdit && selectedIds.length > 0 && (
            <Button variant="danger" onClick={() => setConfirmDelete('bulk')}>
              🗑️ Xóa ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {showFilterForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-inner grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
          {filterableColumns.map(col => (
            <div key={col.field} className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {col.label}
              </label>
              {col.type === 'select' ? (
                <Select
                  value={filters[col.field] || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, [col.field]: e.target.value }))}
                  options={col.options}
                  placeholder={`Tất cả ${col.label.toLowerCase()}`}
                />
              ) : (
                <Input
                  placeholder={`Lọc ${col.label.toLowerCase()}...`}
                  value={filters[col.field] || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, [col.field]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="col-span-full flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
              🧹 Xóa tất cả bộ lọc
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="ag-theme-quartz" style={{ height: 'calc(100vh - 400px)', minHeight: 500 }}>
          <AgGridReact
            ref={gridRef}
            rowData={filteredRowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={42}
            headerHeight={44}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            animateRows={true}
            onSelectionChanged={() => {
              const nodes = gridRef.current?.api?.getSelectedRows() || []
              setSelectedIds(nodes.map((n) => n.id))
            }}
            onCellValueChanged={onCellValueChanged}
            onCellContextMenu={onCellContextMenu}
            stopEditingWhenCellsLoseFocus={true}
            pagination={true}
            paginationPageSize={50}
            paginationPageSizeSelector={[20, 50, 100]}
            localeText={{ noRowsToShow: 'Không có dữ liệu sinh viên' }}
          />
        </div>
      </div>

      {/* Context menu / Toolbar color picker */}
      {(ctxMenu || colorMenu) && (
        <div
          className="fixed z-[1000] bg-white border border-slate-200 rounded-lg shadow-xl p-2 animate-fade-in"
          style={{ left: (ctxMenu || colorMenu).x, top: (ctxMenu || colorMenu).y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs text-slate-500 px-2 py-1 font-medium">🎨 Chọn màu bôi</div>
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
          <button onClick={() => applyColor(null)} className="w-full mt-1 text-xs text-slate-600 hover:bg-slate-100 px-2 py-1 rounded">
            🚫 Xóa màu
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        title="Xóa sinh viên"
        message={`Bạn có chắc muốn xóa ${selectedIds.length} sinh viên đang chọn?\n\nKhông thể hoàn tác.`}
        confirmText="Xóa vĩnh viễn"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={performDelete}
      />
    </div>
  )
}
