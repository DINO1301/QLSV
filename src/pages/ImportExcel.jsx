import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Card from '../components/UI/Card'
import Button from '../components/UI/Button'
import Select from '../components/UI/Select'
import { ConfirmDialog } from '../components/UI/Modal'
import { PageLoader, Badge, Spinner } from '../components/UI/Skeleton'
import { getAllClasses, createClass } from '../services/classService'
import { getColumnsByClass, createColumn, upsertCustomValuesBulk } from '../services/columnService'
import {
  createStudentsBulk, getStudentByCodeInClass, updateStudent,
} from '../services/studentService'
import { parseExcelFile } from '../services/excelService'
import { insertLog } from '../services/logService'
import { getMyPermissionForClass } from '../services/permissionService'
import { DATA_TYPES } from '../utils/constants'
import { cn } from '../utils/helpers'

/* Danh sách cột hệ thống mặc định map được tự động */
const SYSTEM_COLUMN_PRESETS = [
  { key: 'student_code', label: 'Mã sinh viên', system: true, required: true, aliases: ['mã sv', 'ma sv', 'student_code', 'mssv', 'mã sinh viên', 'ma sinh vien', 'masv'] },
  { key: 'full_name',    label: 'Họ và tên',     system: true, required: true, aliases: ['họ tên', 'ho ten', 'full_name', 'tên', 'ten', 'họ và tên', 'ho va ten', 'hoten'] },
  { key: 'date_of_birth', label: 'Ngày sinh',    system: true, aliases: ['ngày sinh', 'ngay sinh', 'date_of_birth', 'dob', 'sinh nhật', 'sinhnhat', 'ngaysinh'] },
  { key: 'warning_level', label: 'Cảnh báo',     system: true, aliases: ['cảnh báo', 'canh bao', 'warning_level', 'mức cảnh báo', 'muc canh bao', 'canhbao'] },
  { key: 'warning_reason', label: 'Lý do cảnh báo', system: true, aliases: ['lý do', 'ly do', 'warning_reason', 'lý do cb', 'ly do cb'] },
  { key: 'warning_date', label: 'Ngày cảnh báo', system: true, aliases: ['ngày cb', 'warning_date', 'ngay canh bao'] },
  { key: 'warning_note', label: 'Ghi chú cảnh báo', system: true, aliases: ['ghi chú', 'ghi chu', 'warning_note', 'ghichu'] },
]

/* Alias cho cột Lớp */
const CLASS_COLUMN_ALIASES = ['lớp', 'lop', 'lớp học', 'lop hoc', 'class', 'class_name', 'malop', 'mã lớp', 'ma lop', 'lớp(mã)']

const SYSTEM_FIELDS = ['student_code', 'full_name', 'date_of_birth', 'warning_level', 'warning_reason', 'warning_date', 'warning_note']

export default function ImportExcel() {
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const { showSuccess, showError } = useToast()

  const [step, setStep] = useState(1)
  const [classes, setClasses] = useState([])

  // Step 1: Chọn nhiều lớp + tự tạo lớp mới
  const [selectedClasses, setSelectedClasses] = useState([]) // array of classId
  const [autoCreateClass, setAutoCreateClass] = useState(false)
  const [classPerms, setClassPerms] = useState({}) // { classId: canEdit }
  const [checkingPerm, setCheckingPerm] = useState(false)

  // Upload & parse
  const [file, setFile] = useState(null)
  const [sheets, setSheets] = useState({})
  const [sheetNames, setSheetNames] = useState([])
  const [activeSheet, setActiveSheet] = useState('')
  const [parsing, setParsing] = useState(false)

  // Mapping
  const [mapping, setMapping] = useState({})
  // mapping[excelHeader] = { type: 'class'|'system'|'custom'|'new_custom'|'ignore', key, column? }

  const [previewRows, setPreviewRows] = useState([])
  const [validated, setValidated] = useState([])
  const [validating, setValidating] = useState(false)

  const [importing, setImporting] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // Các lớp chưa tồn tại trong DB (đọc từ dữ liệu file)
  const [missingClasses, setMissingClasses] = useState([])

  const loadClasses = async () => setClasses(await getAllClasses())
  useEffect(() => { loadClasses() }, [])

  // Kiểm tra quyền sửa của các lớp được chọn
  useEffect(() => {
    if (!selectedClasses.length) { setClassPerms({}); return }
    setCheckingPerm(true)
    const checks = selectedClasses.map(async (cid) => {
      if (isAdmin) return { cid, canEdit: true }
      const perm = await getMyPermissionForClass(cid, profile?.id)
      return { cid, canEdit: perm.can_edit }
    })
    Promise.all(checks).then((results) => {
      const map = {}
      results.forEach(({ cid, canEdit }) => { map[cid] = canEdit })
      setClassPerms(map)
      setCheckingPerm(false)
    }).catch(() => setCheckingPerm(false))
  }, [selectedClasses, isAdmin, profile?.id])

  // Build map class_name (lowercase) -> class object
  const classMap = useMemo(() => {
    const m = {}
    classes.forEach((c) => { m[String(c.class_name).trim().toLowerCase()] = c })
    return m
  }, [classes])

  const [customColsByClass, setCustomColsByClass] = useState({}) // { classId: [cols] }

  // Khi chọn lớp xong, tải custom columns của tất cả lớp chọn
  useEffect(() => {
    if (!selectedClasses.length) { setCustomColsByClass({}); return }
    const load = async () => {
      const map = {}
      for (const cid of selectedClasses) {
        try { map[cid] = await getColumnsByClass(cid) } catch (_) { map[cid] = [] }
      }
      setCustomColsByClass(map)
    }
    load()
  }, [selectedClasses])

  // Gộp tất cả custom columns (để map trùng tên trong step 3)
  const mergedCustomCols = useMemo(() => {
    const seen = new Map()
    Object.values(customColsByClass).forEach((cols) => {
      cols.forEach((c) => {
        if (!seen.has(c.id)) seen.set(c.id, c)
      })
    })
    return Array.from(seen.values())
  }, [customColsByClass])

  // Các cột hệ thống + custom options cho dropdown map
  const allMappingOptions = useMemo(() => {
    return [
      { value: '__ignore__', label: '— Bỏ qua cột này —' },
      { value: 'class', label: '🏫 Lớp học (phân lớp theo cột này)' },
      { value: '__group_system__', label: '◆ Cột hệ thống', isGroup: true },
      ...SYSTEM_COLUMN_PRESETS.map((s) => ({
        value: `system:${s.key}`,
        label: `${s.label}${s.required ? ' *' : ''}`,
      })),
      { value: '__group_custom__', label: '◆ Cột tùy chỉnh đã có', isGroup: true },
      ...mergedCustomCols.map((cc) => ({
        value: `custom:${cc.id}`,
        label: `${cc.column_name} (${cc.data_type})`,
      })),
      { value: '__group_new__', label: '◆ Tạo cột tùy chỉnh mới', isGroup: true },
      { value: 'new_custom', label: '➕ Tạo cột mới (tự động theo tên cột Excel)' },
    ]
  }, [mergedCustomCols])

  /* === Upload & parse === */
  const onFileSelected = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.xlsx') && !f.name.toLowerCase().endsWith('.xls')) {
      showError('Chỉ chấp nhận file .xlsx hoặc .xls')
      return
    }
    setFile(f)
    setParsing(true)
    try {
      const parsed = await parseExcelFile(f)
      setSheets(parsed.sheets)
      setSheetNames(parsed.sheetNames)
      setActiveSheet(parsed.sheetNames[0])
      setStep(3)
    } catch (err) {
      showError(err.message || 'Parse file thất bại')
    } finally {
      setParsing(false)
    }
  }

  // Sheet thay đổi: tự động mapping
  useEffect(() => {
    if (!activeSheet || !sheets[activeSheet]) return
    const headers = sheets[activeSheet].headers
    const rows = sheets[activeSheet].rows
    setPreviewRows(rows)

    const m = {}
    headers.forEach((h) => {
      const normalized = String(h).trim().toLowerCase()

      // 1) Cột Lớp
      if (CLASS_COLUMN_ALIASES.includes(normalized)) {
        m[h] = { type: 'class' }
        return
      }
      // 2) Cột hệ thống
      const sys = SYSTEM_COLUMN_PRESETS.find((s) => s.aliases.includes(normalized))
      if (sys) { m[h] = { type: 'system', key: sys.key }; return }
      // 3) Cột custom trùng tên
      const cc = mergedCustomCols.find((c) => c.column_name.toLowerCase() === normalized)
      if (cc) { m[h] = { type: 'custom', key: cc.id, column: cc }; return }
      // 4) Mặc định: tạo cột mới
      m[h] = { type: 'new_custom' }
    })
    setMapping(m)

    // Phát hiện các lớp chưa tồn tại trong dữ liệu
    const classHeader = headers.find((h) => m[h]?.type === 'class')
    if (classHeader) {
      const classNames = new Set()
      rows.forEach((r) => {
        const v = String(r[classHeader] ?? '').trim()
        if (v) classNames.add(v.toLowerCase())
      })
      const missing = Array.from(classNames).filter((name) => !classMap[name])
      setMissingClasses(missing.map((n) => n.charAt(0).toUpperCase() + n.slice(1)))
    } else {
      setMissingClasses([])
    }
  }, [activeSheet, sheets, mergedCustomCols, classMap])

  // Header cột lớp
  const classHeader = useMemo(() => {
    return Object.keys(mapping).find((h) => mapping[h]?.type === 'class') || ''
  }, [mapping])

  /* === Validate === */
  const runValidate = async () => {
    setValidating(true)
    const result = []

    const mappedCustom = Object.entries(mapping)
      .filter(([_, v]) => v.type === 'custom')
      .map(([excel, v]) => ({ excel, columnId: v.key, column: v.column }))

    const mappedSystem = Object.entries(mapping)
      .filter(([_, v]) => v.type === 'system')
      .map(([excel, v]) => ({ excel, key: v.key }))

    const mappedNewCustom = Object.entries(mapping)
      .filter(([_, v]) => v.type === 'new_custom')
      .map(([excel]) => excel)

    const hasStudentCode = mappedSystem.some((m) => m.key === 'student_code')
    const hasFullName = mappedSystem.some((m) => m.key === 'full_name')

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i]
      const errors = []
      const payload = { custom_values: {}, new_custom_values: {} }

      // Xác định lớp của dòng này
      let className = ''
      if (classHeader) {
        className = String(row[classHeader] ?? '').trim()
      }
      payload.__class_name__ = className

      // Nếu không có cột lớp mà chỉ chọn 1 lớp → dùng lớp đó
      if (!className && selectedClasses.length === 1) {
        const c = classes.find((x) => x.id === selectedClasses[0])
        className = c?.class_name || ''
        payload.__class_name__ = className
      }

      // Class id tương ứng
      const classObj = classMap[className.toLowerCase()]
      payload.__class_id__ = classObj?.id || null
      if (!classObj && !autoCreateClass) {
        errors.push(`Lớp "${className}" chưa tồn tại. Hãy bật "Tự tạo lớp mới" hoặc tạo lớp trước.`)
      }

      // Extract system
      mappedSystem.forEach(({ excel, key }) => {
        const val = row[excel]
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          payload[key] = val
        }
      })

      if (!hasStudentCode || !payload.student_code?.toString().trim()) {
        errors.push('Thiếu Mã sinh viên')
      }
      if (!hasFullName || !payload.full_name?.toString().trim()) {
        errors.push('Thiếu Họ tên')
      }

      // warning_level parse
      if (payload.warning_level !== undefined && payload.warning_level !== null && payload.warning_level !== '') {
        const text = String(payload.warning_level).toLowerCase()
        if (text.includes('3') || text.includes('cb3')) payload.warning_level = 3
        else if (text.includes('2') || text.includes('cb2')) payload.warning_level = 2
        else if (text.includes('1') || text.includes('cb1')) payload.warning_level = 1
        else payload.warning_level = 0
      } else {
        payload.warning_level = 0
      }

      // custom values (cột đã có)
      mappedCustom.forEach(({ excel, columnId, column }) => {
        const v = row[excel]
        if (v === undefined || v === null || String(v).trim() === '') return
        let value = v
        try {
          if (column?.data_type === DATA_TYPES.NUMBER) {
            value = Number(String(v).replace(/,/g, '.'))
            if (Number.isNaN(value)) throw new Error('Không phải số')
          } else if (column?.data_type === DATA_TYPES.CHECKBOX) {
            value = !!(v === true || v === 'true' || v === 1 || v === '1' || /đúng|yes|co|có/i.test(String(v)))
          } else {
            value = String(v).trim()
          }
        } catch (err) {
          errors.push(`Cột "${excel}": ${err.message}`)
          value = null
        }
        payload.custom_values[columnId] = value
      })

      // new custom values (cột sẽ tạo mới)
      mappedNewCustom.forEach((excel) => {
        const v = row[excel]
        if (v === undefined || v === null || String(v).trim() === '') return
        payload.new_custom_values[excel] = String(v).trim()
      })

      result.push({
        __row_num__: i + 2,
        __errors__: errors,
        __valid__: errors.length === 0,
        ...payload,
      })
    }

    setValidated(result)
    setValidating(false)
    setStep(4)
  }

  /* === Thực thi import === */
  const doImport = async () => {
    setImporting(true)
    try {
      const valid = validated.filter((v) => v.__valid__)
      if (valid.length === 0) throw new Error('Không có dòng hợp lệ để import')

      // 1) Tạo các lớp mới (nếu autoCreateClass)
      const classIdMap = { ...classMap } // name(lower) -> class obj
      const newClassNames = new Set()
      valid.forEach((v) => {
        const name = String(v.__class_name__ || '').trim().toLowerCase()
        if (name && !classIdMap[name]) newClassNames.add(name)
      })

      const createdClassIds = []
      for (const name of newClassNames) {
        try {
          const nc = await createClass({ class_name: name })
          classIdMap[name] = nc
          createdClassIds.push(nc.id)
        } catch (_) { /* lớp có thể đã tạo bởi process khác */ }
      }

      // 2) Tạo các custom column mới cho từng lớp
      // Lấy danh sách các lớp có sinh viên import vào
      const usedClassIds = new Set()
      valid.forEach((v) => {
        const name = String(v.__class_name__ || '').trim().toLowerCase()
        if (classIdMap[name]) usedClassIds.add(classIdMap[name].id)
      })
      // Gộp với các lớp đã chọn (để đồng bộ cột cho các lớp chọn)
      selectedClasses.forEach((id) => usedClassIds.add(id))

      // Các cột mới cần tạo
      const newCustomHeaders = Object.entries(mapping)
        .filter(([_, v]) => v.type === 'new_custom')
        .map(([h]) => h)

      // Map cột mới: { excelHeader: { classId: columnId } }
      const newColumnIdMap = {}
      for (const header of newCustomHeaders) {
        newColumnIdMap[header] = {}
        for (const cid of usedClassIds) {
          try {
            const col = await createColumn({
              class_id: cid,
              column_name: header,
              data_type: DATA_TYPES.TEXT,
              column_order: 999,
            })
            newColumnIdMap[header][cid] = col.id
          } catch (_) { /* có thể cột đã tồn tại */ }
        }
      }

      // 3) Upsert sinh viên theo (class_id, student_code)
      let insertedCount = 0
      let updatedCount = 0
      const cvBulk = []

      for (const v of valid) {
        const name = String(v.__class_name__ || '').trim().toLowerCase()
        const classObj = classIdMap[name]
        if (!classObj) continue
        const classId = classObj.id
        const code = String(v.student_code).trim()

        // Build payload student
        const studentPayload = { class_id: classId }
        SYSTEM_FIELDS.forEach((k) => {
          if (v[k] !== undefined && v[k] !== null && String(v[k]).trim() !== '') {
            studentPayload[k] = (k === 'student_code' || k === 'full_name') ? String(v[k]).trim() : v[k]
          }
        })

        // Tìm sinh viên theo mã trong lớp
        const existing = await getStudentByCodeInClass(classId, code)
        let studentId
        if (existing) {
          // Cập nhật (merge: chỉ ghi đè trường có giá trị)
          const updatePayload = {}
          Object.entries(studentPayload).forEach(([k, val]) => {
            if (k !== 'class_id' && k !== 'student_code') updatePayload[k] = val
          })
          await updateStudent(existing.id, updatePayload)
          studentId = existing.id
          updatedCount++
        } else {
          // Tạo mới
          const created = await createStudentsBulk([studentPayload])
          studentId = created[0]?.id
          insertedCount++
        }

        // Custom values (cột đã có)
        Object.entries(v.custom_values || {}).forEach(([colId, val]) => {
          if (val === null || val === undefined) return
          cvBulk.push({ student_id: studentId, column_id: colId, value: val })
        })
        // Custom values (cột mới tạo)
        Object.entries(v.new_custom_values || {}).forEach(([header, val]) => {
          const colId = newColumnIdMap[header]?.[classId]
          if (colId && val !== null && val !== undefined) {
            cvBulk.push({ student_id: studentId, column_id: colId, value: val })
          }
        })
      }

      // 4) Bulk upsert custom values
      if (cvBulk.length) await upsertCustomValuesBulk(cvBulk)

      // Log
      insertLog({
        action: 'IMPORT_EXCEL',
        new_data: {
          file: file?.name,
          inserted: insertedCount,
          updated: updatedCount,
          new_classes: newClassNames.size,
          new_columns: newCustomHeaders.length,
        },
      })

      setImportResult({
        total: validated.length,
        inserted: insertedCount,
        updated: updatedCount,
        errors: validated.length - insertedCount - updatedCount,
        newClasses: newClassNames.size,
        newColumns: newCustomHeaders.length,
      })
      setConfirmImport(false)
      showSuccess(`Import xong: ${insertedCount} mới, ${updatedCount} cập nhật`)
      setStep(5)
    } catch (e) {
      showError(e.message || 'Import thất bại')
    } finally {
      setImporting(false)
    }
  }

  const importStats = useMemo(() => ({
    valid: validated.filter((v) => v.__valid__).length,
    invalid: validated.filter((v) => !v.__valid__).length,
  }), [validated])

  const excelHeaders = sheets[activeSheet]?.headers || []

  // Tên lớp đầu tiên sau khi import thành công (để mở)
  const firstImportedClassId = useMemo(() => {
    const v = validated.find((x) => x.__valid__ && x.__class_id__)
    return v?.__class_id__ || selectedClasses[0] || null
  }, [validated, selectedClasses])

  const toggleClass = (cid) => {
    setSelectedClasses((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    )
  }

  const canProceedStep1 = useMemo(() => {
    // Phải chọn ít nhất 1 lớp HOẶC bật tự tạo lớp mới
    if (autoCreateClass) return true
    if (selectedClasses.length === 0) return false
    // Tất cả lớp chọn phải có quyền sửa
    return selectedClasses.every((cid) => classPerms[cid])
  }, [selectedClasses, autoCreateClass, classPerms])

  return (
    <div className="space-y-5">
      {/* Steps */}
      <Card>
        <ol className="flex items-center justify-start text-sm gap-2 flex-wrap">
          {[
            { n: 1, label: 'Chọn lớp & quyền' },
            { n: 2, label: 'Upload file' },
            { n: 3, label: 'Map cột' },
            { n: 4, label: 'Preview & Kiểm tra' },
            { n: 5, label: 'Hoàn tất' },
          ].map((s, idx, arr) => (
            <li key={s.n} className="flex items-center gap-2">
              <span className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                step >= s.n ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'
              )}>
                {step > s.n ? '✓' : s.n}
              </span>
              <span className={cn(step >= s.n ? 'font-semibold text-slate-800' : 'text-slate-400')}>{s.label}</span>
              {idx < arr.length - 1 && <span className="w-8 h-px bg-slate-200" />}
            </li>
          ))}
        </ol>
      </Card>

      {/* STEP 1: Chọn lớp (nhiều lớp) */}
      {step === 1 && (
        <Card title="Bước 1: Chọn lớp học để import">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Chọn <b>nhiều lớp</b> mà bạn muốn import sinh viên vào. File Excel cần có cột <b>"Lớp"</b> để hệ thống tự động phân chia sinh viên vào đúng lớp.
              Nếu file có lớp chưa tồn tại, hãy bật tùy chọn bên dưới để tự động tạo lớp mới.
            </p>

            {/* Danh sách lớp dạng checkbox */}
            <div className="border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
              {classes.length === 0 ? (
                <p className="p-6 text-center text-slate-400 text-sm">Chưa có lớp học nào.</p>
              ) : (
                classes.map((c) => {
                  const checked = selectedClasses.includes(c.id)
                  const canEdit = isAdmin || classPerms[c.id]
                  return (
                    <label key={c.id} className={cn(
                      'flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50',
                      !canEdit && checked ? 'bg-red-50' : ''
                    )}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleClass(c.id)}
                        disabled={!canEdit}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-slate-800 text-sm">{c.class_name}</div>
                        {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                      </div>
                      {!canEdit && <span className="text-xs text-red-500">⛔ Không có quyền sửa</span>}
                      {canEdit && checked && <span className="text-xs text-green-600">✅ Đã chọn</span>}
                    </label>
                  )
                })
              )}
            </div>

            {/* Tự tạo lớp mới */}
            <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateClass}
                onChange={(e) => setAutoCreateClass(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <div className="font-medium text-amber-800 text-sm">🔄 Tự động tạo lớp mới</div>
                <div className="text-xs text-amber-700">
                  Nếu file Excel có tên lớp chưa tồn tại trong hệ thống, tự động tạo lớp mới theo tên trong file.
                  {missingClasses.length > 0 && (
                    <div className="mt-1 font-semibold">
                      Lớp sẽ được tạo: {missingClasses.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </label>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                disabled={!canProceedStep1 || checkingPerm}
                onClick={() => setStep(2)}
              >
                Tiếp theo →
              </Button>
              {selectedClasses.length > 0 && (
                <span className="text-sm text-slate-500">
                  Đã chọn {selectedClasses.length} lớp
                  {selectedClasses.some((cid) => !classPerms[cid]) && !isAdmin && (
                    <span className="text-red-500 ml-2">(có lớp không có quyền sửa)</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2: Upload */}
      {step === 2 && (
        <Card title="Bước 2: Chọn file Excel (.xlsx)" actions={
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← Quay lại</Button>
        }>
          <label className="block border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-primary-400 hover:bg-primary-50/40 transition cursor-pointer">
            <div className="text-6xl mb-3">📥</div>
            <p className="font-semibold text-slate-700 mb-1">Nhấp để chọn file hoặc kéo thả vào đây</p>
            <p className="text-xs text-slate-500 mb-4">Hỗ trợ .xlsx, .xls · Dòng đầu tiên là tiêu đề cột · Nên có cột "Lớp"</p>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileSelected} />
            <Button variant="primary" onClick={(e) => { e.preventDefault(); e.target.parentElement.querySelector('input[type=file]').click(); }}>
              📂 Chọn file
            </Button>
            {file && (
              <div className="mt-4 text-sm text-slate-600">
                Đã chọn: <b>{file.name}</b> ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
            {parsing && <div className="mt-3 flex items-center gap-2 justify-center text-primary-600"><Spinner size="sm" />Đang parse file...</div>}
          </label>
        </Card>
      )}

      {/* STEP 3: Map cột */}
      {step === 3 && (
        <Card
          title={`Bước 3: Ghép cột Excel ↔ Hệ thống (Sheet: "${activeSheet}")`}
          actions={
            <div className="flex gap-2">
              {sheetNames.length > 1 && (
                <Select
                  wrapperClass="w-40"
                  value={activeSheet}
                  onChange={(e) => setActiveSheet(e.target.value)}
                  options={sheetNames.map((n) => ({ value: n, label: n }))}
                  placeholder={null}
                />
              )}
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>← Quay lại</Button>
            </div>
          }
        >
          <p className="text-xs text-slate-500 mb-4">
            Hệ thống đã tự động map các cột phổ biến (Lớp, Mã SV, Họ tên...). Các cột chưa nhận diện được sẽ được <b>tự động tạo thành cột tùy chỉnh mới</b>.
            Các cột đánh dấu <span className="text-red-500 font-semibold">*</span> bắt buộc phải có.
          </p>

          {/* Thông báo lớp chưa tồn tại */}
          {missingClasses.length > 0 && (
            <div className={cn(
              'mb-4 p-3 rounded-lg border text-sm',
              autoCreateClass ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'
            )}>
              {autoCreateClass ? (
                <>🆕 Các lớp sau sẽ được <b>tự động tạo mới</b>: <b>{missingClasses.join(', ')}</b></>
              ) : (
                <>⚠️ File có các lớp chưa tồn tại: <b>{missingClasses.join(', ')}</b>. 
                Hãy quay lại Bước 1 bật "Tự động tạo lớp mới" hoặc tạo lớp trước khi import.</>
              )}
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold w-[300px]">Cột trong Excel</th>
                  <th className="px-4 py-3 text-left font-semibold">Map sang</th>
                  <th className="px-4 py-3 text-left font-semibold w-[200px]">Giá trị mẫu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {excelHeaders.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">File không có dữ liệu</td></tr>
                )}
                {excelHeaders.map((h) => {
                  const cur = mapping[h]
                  let curVal = '__ignore__'
                  if (cur) {
                    if (cur.type === 'system') curVal = `system:${cur.key}`
                    else if (cur.type === 'custom') curVal = `custom:${cur.key}`
                    else curVal = cur.type // 'class', 'new_custom', 'ignore'
                  }
                  return (
                    <tr key={h} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">📄 {h}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={curVal}
                          onChange={(e) => {
                            const v = e.target.value
                            let newMap = { ...mapping }
                            if (v === '__ignore__') newMap[h] = { type: 'ignore' }
                            else if (v === 'class') newMap[h] = { type: 'class' }
                            else if (v === 'new_custom') newMap[h] = { type: 'new_custom' }
                            else if (v.startsWith('system:')) newMap[h] = { type: 'system', key: v.slice(7) }
                            else if (v.startsWith('custom:')) {
                              const id = v.slice(7)
                              const col = mergedCustomCols.find((x) => x.id === id)
                              newMap[h] = { type: 'custom', key: id, column: col }
                            }
                            setMapping(newMap)
                          }}
                          className="w-full max-w-md px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        >
                          {allMappingOptions.map((opt, i) => (
                            opt.isGroup ? (
                              <optgroup key={`g${i}`} label={opt.label} />
                            ) : (
                              <option key={i} value={opt.value}>{opt.label}</option>
                            )
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[220px] truncate">
                        {previewRows[0]?.[h] || previewRows[1]?.[h] || <span className="italic">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setStep(2)}>← Quay lại</Button>
            <Button variant="primary" onClick={runValidate} disabled={excelHeaders.length === 0}>
              Xem trước & Kiểm tra lỗi →
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: Preview */}
      {step === 4 && (
        <Card
          title={`Bước 4: Xem trước dữ liệu (${validated.length} dòng)`}
          actions={
            <>
              <Badge variant="success" className="mr-1">✅ {importStats.valid} hợp lệ</Badge>
              {importStats.invalid > 0 && <Badge variant="danger">❌ {importStats.invalid} lỗi</Badge>}
            </>
          }
        >
          {validating ? (
            <PageLoader text="Đang kiểm tra dữ liệu..." />
          ) : (
            <>
              {/* Thống kê hành động */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-xs text-blue-600">Tổng dòng</div>
                  <div className="text-xl font-bold text-blue-700">{validated.length}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-xs text-green-600">Tạo mới</div>
                  <div className="text-xl font-bold text-green-700">
                    {validated.filter((v) => v.__valid__).length}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <div className="text-xs text-amber-600">Lớp mới tạo</div>
                  <div className="text-xl font-bold text-amber-700">{missingClasses.length}</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <div className="text-xs text-purple-600">Cột mới tạo</div>
                  <div className="text-xl font-bold text-purple-700">
                    {Object.values(mapping).filter((v) => v.type === 'new_custom').length}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[480px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600 uppercase tracking-wider z-10">
                    <tr>
                      <th className="px-3 py-2 text-left border-b border-slate-200">Dòng</th>
                      <th className="px-3 py-2 text-left border-b border-slate-200">Lớp</th>
                      <th className="px-3 py-2 text-left border-b border-slate-200">Trạng thái</th>
                      {excelHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 text-left border-b border-slate-200 whitespace-nowrap">{h}</th>
                      ))}
                      <th className="px-3 py-2 text-left border-b border-slate-200">Lỗi (nếu có)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validated.map((row, i) => (
                      <tr key={i} className={row.__valid__ ? '' : 'bg-red-50/60'}>
                        <td className="px-3 py-2 text-slate-500">{row.__row_num__}</td>
                        <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                          {row.__class_name__ || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {row.__valid__ ? (
                            <Badge variant="success">OK</Badge>
                          ) : (
                            <Badge variant="danger">LỖI</Badge>
                          )}
                        </td>
                        {excelHeaders.map((h) => (
                          <td key={h} className="px-3 py-2 whitespace-nowrap max-w-[180px] truncate">
                            {String(row[h] ?? '').slice(0, 60)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-red-600 max-w-[260px]">
                          {row.__errors__?.join('; ') || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between pt-5">
                <Button variant="ghost" onClick={() => setStep(3)}>← Quay lại mapping</Button>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    disabled={importStats.valid === 0 || importing}
                    onClick={() => setConfirmImport(true)}
                    icon={importing ? <Spinner size="sm" className="text-white" /> : undefined}
                  >
                    ✅ Xác nhận Import ({importStats.valid} dòng)
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* STEP 5: Kết quả */}
      {step === 5 && importResult && (
        <Card title="🎉 Import hoàn tất">
          <div className="max-w-2xl mx-auto text-center space-y-4 py-6">
            <div className="text-7xl">✅</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-600">Tổng dòng</div>
                <div className="text-2xl font-bold text-blue-700">{importResult.total}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-xs text-green-600">Tạo mới</div>
                <div className="text-2xl font-bold text-green-700">{importResult.inserted}</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="text-xs text-amber-600">Cập nhật</div>
                <div className="text-2xl font-bold text-amber-700">{importResult.updated}</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-xs text-red-600">Lỗi</div>
                <div className="text-2xl font-bold text-red-700">{importResult.errors}</div>
              </div>
            </div>
            {(importResult.newClasses > 0 || importResult.newColumns > 0) && (
              <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
                🆕 Đã tạo: {importResult.newClasses > 0 && `${importResult.newClasses} lớp mới`}
                {importResult.newClasses > 0 && importResult.newColumns > 0 && ' · '}
                {importResult.newColumns > 0 && `${importResult.newColumns} cột mới`}
              </div>
            )}
            <div className="flex gap-2 justify-center pt-4 flex-wrap">
              <Button variant="secondary" onClick={() => {
                setStep(1); setFile(null); setSheets({}); setValidated([]); setImportResult(null);
                setSelectedClasses([]); setAutoCreateClass(false); setMapping({}); setMissingClasses([]);
              }}>
                🔁 Import file khác
              </Button>
              {firstImportedClassId && (
                <Button variant="primary" onClick={() => navigate(`/classes/${firstImportedClassId}/students`)}>
                  📚 Mở lớp vừa import
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmImport}
        onClose={() => setConfirmImport(false)}
        title="Xác nhận Import"
        message={
          `Bạn sắp import ${importStats.valid} dòng hợp lệ.\n` +
          (missingClasses.length > 0 ? `🆕 Sẽ tạo ${missingClasses.length} lớp mới.\n` : '') +
          `${importStats.invalid > 0 ? `❌ ${importStats.invalid} dòng lỗi sẽ bị BỎ QUA.\n\n` : '\n'}Tiếp tục?`
        }
        confirmText="Import ngay"
        confirmVariant="success"
        loading={importing}
        onConfirm={doImport}
      />
    </div>
  )
}
