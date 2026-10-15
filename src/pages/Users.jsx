import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Card from '../components/UI/Card'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import Select from '../components/UI/Select'
import Modal, { ConfirmDialog } from '../components/UI/Modal'
import { PageLoader, EmptyState, Badge, Skeleton } from '../components/UI/Skeleton'
import {
  getAllUsers, updateUserProfile, createNewUser, adminResetPassword,
} from '../services/userService'
import { getAllClasses } from '../services/classService'
import { getAllColumns } from '../services/columnService'
import {
  getUserPermissions, upsertPermissionsBulk,
} from '../services/permissionService'
import {
  ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS, ROLES, SYSTEM_COLUMNS,
} from '../utils/constants'
import { cn, formatDateTime } from '../utils/helpers'

export default function Users() {
  const { profile } = useAuth()
  const { showSuccess, showError, showWarning } = useToast()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [classes, setClasses] = useState([])
  const [allColumns, setAllColumns] = useState([]) // tất cả custom columns (theo class)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = tạo mới
  const [form, setForm] = useState({
    full_name: '', username: '', email: '', password: '', password2: '', role: ROLES.USER, status: USER_STATUS.ACTIVE,
  })
  const [formErr, setFormErr] = useState({})
  const [submitting, setSubmitting] = useState(false)
  // Phân quyền ngay trong form tạo/sửa: { [classId]: { can_view, can_edit, editable_columns: [] } }
  const [formPerms, setFormPerms] = useState({})

  const [permOpen, setPermOpen] = useState(null) // user record
  const [permLoading, setPermLoading] = useState(false)
  const [permData, setPermData] = useState({}) // { [classId]: { can_view, can_edit, editable_columns: [] } }
  const [permSaving, setPermSaving] = useState(false)

  const [confirmStatus, setConfirmStatus] = useState(null) // {user, type: 'lock'|'unlock'|'resetpw'|'delete'}

  // Lấy danh sách cột (system + custom) của 1 lớp để hiển thị checkbox phân quyền
  const getColumnsForClass = useCallback((classId) => {
    const sysCols = SYSTEM_COLUMNS.map((c) => ({ key: c.key, label: c.label }))
    const customCols = (allColumns.filter((c) => c.class_id === classId) || [])
      .map((c) => ({ key: `custom:${c.id}`, label: c.column_name }))
    return [...sysCols, ...customCols]
  }, [allColumns])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [u, c, cols] = await Promise.all([getAllUsers(), getAllClasses(), getAllColumns()])
        setUsers(u)
        setClasses(c)
        setAllColumns(cols)
      } catch (e) { showError(e.message || 'Tải danh sách thất bại') }
      finally { setLoading(false) }
    }
    load()
  }, [showError])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return users
    return users.filter((u) =>
      (u.full_name || '').toLowerCase().includes(kw) ||
      (u.username || '').toLowerCase().includes(kw) ||
      (u.email || '').toLowerCase().includes(kw)
    )
  }, [users, search])

  const openCreate = () => {
    setEditing(null)
    setForm({ full_name: '', username: '', email: '', password: '', password2: '', role: ROLES.USER, status: USER_STATUS.ACTIVE })
    setFormErr({})
    setFormPerms({})
    setFormOpen(true)
  }
  const openEdit = async (u) => {
    setEditing(u)
    setForm({
      full_name: u.full_name || '',
      username: u.username || '',
      email: u.email || '',
      password: '',
      password2: '',
      role: u.role,
      status: u.status,
    })
    setFormErr({})
    // Load quyền hiện tại của user để sửa trong form
    try {
      const perms = await getUserPermissions(u.id)
      const map = {}
      classes.forEach((cls) => {
        const p = perms.find((x) => x.class_id === cls.id)
        map[cls.id] = {
          can_view: !!p?.can_view,
          can_edit: !!p?.can_edit,
          editable_columns: Array.isArray(p?.editable_columns) ? p.editable_columns : [],
        }
      })
      setFormPerms(map)
    } catch (_) {
      setFormPerms({})
    }
    setFormOpen(true)
  }

  const validateForm = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Họ tên không được trống'
    if (!form.username.trim()) e.username = 'Username không được trống'
    if (!form.email.trim()) e.email = 'Email không được trống'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email không hợp lệ'

    if (!editing) {
      if (!form.password) e.password = 'Mật khẩu không được trống'
      else if (form.password.length < 6) e.password = 'Mật khẩu ít nhất 6 ký tự'
      if (form.password !== form.password2) e.password2 = 'Mật khẩu xác nhận không khớp'
    } else if (form.password) {
      if (form.password.length < 6) e.password = 'Mật khẩu ít nhất 6 ký tự'
      if (form.password !== form.password2) e.password2 = 'Mật khẩu xác nhận không khớp'
    }

    setFormErr(e)
    return Object.keys(e).length === 0
  }

  const submitForm = async () => {
    if (!validateForm()) return
    setSubmitting(true)
    try {
      let targetUserId = editing?.id
      if (editing) {
        const p = {
          full_name: form.full_name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          role: form.role,
          status: form.status,
        }
        await updateUserProfile(editing.id, p)
        // Nếu có password → gửi reset email
        if (form.password) {
          try { await adminResetPassword(editing.id, form.password) }
          catch (_) { showWarning('Không thể cập nhật mật khẩu từ client. Gửi email reset thay thế.') }
        }
        showSuccess('Cập nhật thành công')
      } else {
        // Tạo user mới (giả lập signUp - cần tắt email confirm trên Supabase)
        const newUser = await createNewUser({
          email: form.email.trim(),
          password: form.password,
          username: form.username.trim(),
          full_name: form.full_name.trim(),
          role: form.role,
        })
        targetUserId = newUser?.id
        showSuccess('Tạo tài khoản thành công (nếu user đầu tiên → ADMIN tự động)')
      }

      // Lưu phân quyền từ form (nếu có)
      if (targetUserId) {
        const rows = Object.entries(formPerms)
          .map(([classId, p]) => ({
            user_id: targetUserId,
            class_id: classId,
            can_view: !!p.can_view,
            can_edit: !!p.can_edit,
            editable_columns: Array.isArray(p.editable_columns) ? p.editable_columns : [],
          }))
          .filter((r) => r.can_view || r.can_edit)
        if (rows.length) {
          try { await upsertPermissionsBulk(rows) } catch (_) { /* bỏ qua lỗi quyền */ }
        }
      }

      // Refresh
      const u = await getAllUsers()
      setUsers(u)
      setFormOpen(false)
    } catch (e) {
      showError(e.message || (editing ? 'Cập nhật thất bại' : 'Tạo tài khoản thất bại'))
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Toggle permission cho form tạo/sửa (formPerms)
   */
  const toggleFormPerm = (classId, field) => {
    setFormPerms((prev) => {
      const cur = prev[classId] || { can_view: false, can_edit: false, editable_columns: [] }
      const next = { ...cur, [field]: !cur[field] }
      if (field === 'can_edit' && next.can_edit) next.can_view = true
      if (field === 'can_view' && !next.can_view) { next.can_edit = false; next.editable_columns = [] }
      return { ...prev, [classId]: next }
    })
  }

  /**
   * Toggle 1 cột trong editable_columns của form
   */
  const toggleFormColumn = (classId, colKey) => {
    setFormPerms((prev) => {
      const cur = prev[classId] || { can_view: false, can_edit: false, editable_columns: [] }
      const cols = new Set(cur.editable_columns || [])
      if (cols.has(colKey)) cols.delete(colKey); else cols.add(colKey)
      return { ...prev, [classId]: { ...cur, editable_columns: [...cols] } }
    })
  }

  const openPerm = async (u) => {
    setPermOpen(u)
    setPermLoading(true)
    try {
      const perms = await getUserPermissions(u.id)
      const map = {}
      classes.forEach((cls) => {
        const p = perms.find((x) => x.class_id === cls.id)
        map[cls.id] = {
          can_view: !!p?.can_view,
          can_edit: !!p?.can_edit,
          editable_columns: Array.isArray(p?.editable_columns) ? p.editable_columns : [],
        }
      })
      // Luật: can_edit = true thì can_view phải true
      classes.forEach((c) => {
        if (map[c.id].can_edit) map[c.id].can_view = true
      })
      setPermData(map)
    } catch (e) {
      showError(e.message || 'Tải quyền thất bại')
    } finally { setPermLoading(false) }
  }

  const togglePerm = (classId, field) => {
    setPermData((prev) => {
      const cur = prev[classId] || { can_view: false, can_edit: false, editable_columns: [] }
      const next = { ...cur, [field]: !cur[field] }
      // Nếu can_edit → can_view phải true
      if (field === 'can_edit' && next.can_edit) next.can_view = true
      // Nếu can_view tắt → tự tắt can_edit và xóa editable_columns
      if (field === 'can_view' && !next.can_view) { next.can_edit = false; next.editable_columns = [] }
      return { ...prev, [classId]: next }
    })
  }

  /**
   * Toggle 1 cột trong editable_columns của modal phân quyền
   */
  const togglePermColumn = (classId, colKey) => {
    setPermData((prev) => {
      const cur = prev[classId] || { can_view: false, can_edit: false, editable_columns: [] }
      const cols = new Set(cur.editable_columns || [])
      if (cols.has(colKey)) cols.delete(colKey); else cols.add(colKey)
      return { ...prev, [classId]: { ...cur, editable_columns: [...cols] } }
    })
  }

  const savePerm = async () => {
    if (!permOpen) return
    setPermSaving(true)
    try {
      const rows = Object.entries(permData).map(([classId, p]) => {
        return {
          user_id: permOpen.id,
          class_id: classId,
          can_view: !!p.can_view,
          can_edit: !!p.can_edit,
          editable_columns: Array.isArray(p.editable_columns) ? p.editable_columns : [],
        }
      }).filter((r) => r.can_view || r.can_edit)
      await upsertPermissionsBulk(rows)
      showSuccess('Lưu phân quyền thành công')
      setPermOpen(null)
    } catch (e) {
      showError(e.message || 'Lưu thất bại')
    } finally { setPermSaving(false) }
  }

  const actionConfirm = async () => {
    if (!confirmStatus) return
    const u = confirmStatus.user
    const t = confirmStatus.type
    try {
      if (t === 'lock') {
        await updateUserProfile(u.id, { status: USER_STATUS.LOCKED })
        showSuccess(`Đã khóa tài khoản ${u.username}`)
      } else if (t === 'unlock') {
        await updateUserProfile(u.id, { status: USER_STATUS.ACTIVE })
        showSuccess(`Đã mở khóa tài khoản ${u.username}`)
      } else if (t === 'resetpw') {
        await adminResetPassword(u.id)
        showSuccess('Đã gửi link đặt lại mật khẩu vào email người dùng')
      } else if (t === 'delete') {
        showWarning('Xóa user trên Supabase Auth cần service_role. Vui lòng xóa thủ công qua Supabase Dashboard.\nĐã bỏ qua.')
      }
      // Refresh
      const list = await getAllUsers()
      setUsers(list)
      setConfirmStatus(null)
    } catch (e) {
      showError(e.message || 'Thao tác thất bại')
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-full sm:max-w-sm">
            <Input placeholder="🔍 Tìm tên / username / email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="primary" onClick={openCreate}>➕ Tạo tài khoản</Button>
        </div>
      </Card>

      <Card title={`Danh sách tài khoản (${filtered.length})`}>
        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="👥" text="Chưa có tài khoản nào" action={<Button variant="primary" onClick={openCreate}>➕ Tạo tài khoản đầu tiên</Button>} />
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Thông tin</th>
                  <th className="px-4 py-3 text-left">Vai trò</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-left">Ngày tạo</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const me = u.id === profile?.id
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                            {(u.full_name || u.username || '?').charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{u.full_name || u.username}</div>
                            <div className="text-xs text-slate-500">
                              <span className="font-mono">{u.username}</span> · {u.email}
                              {me && <Badge variant="primary" className="ml-2">Bạn</Badge>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === ROLES.ADMIN ? 'danger' : 'primary'}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${USER_STATUS_LABELS[u.status].cls}`}>
                          {USER_STATUS_LABELS[u.status].text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(u.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openPerm(u)}>🔑 Phân quyền</Button>
                        <Button size="icon_sm" variant="secondary" title="Sửa" onClick={() => openEdit(u)}>✏️</Button>
                        {u.role !== ROLES.ADMIN && (
                          <>
                            {u.status === USER_STATUS.ACTIVE ? (
                              <Button size="icon_sm" variant="warning" title="Khóa" onClick={() => setConfirmStatus({ user: u, type: 'lock' })}>🔒</Button>
                            ) : (
                              <Button size="icon_sm" variant="success" title="Mở khóa" onClick={() => setConfirmStatus({ user: u, type: 'unlock' })}>🔓</Button>
                            )}
                          </>
                        )}
                        <Button size="icon_sm" variant="primary" title="Đặt lại mật khẩu" onClick={() => setConfirmStatus({ user: u, type: 'resetpw' })}>🔑</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Form Tạo / Sửa user */}
      <Modal
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        size="lg"
        title={editing ? `Sửa tài khoản ${editing.username}` : 'Tạo tài khoản mới'}
        closeOnBackdrop={!submitting}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitting}>Hủy</Button>
            <Button variant="primary" onClick={submitForm} disabled={submitting}>
              {submitting ? 'Đang lưu...' : (editing ? 'Lưu thay đổi' : 'Tạo tài khoản')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Họ và tên *" value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} error={formErr.full_name} autoFocus />
          <Input label="Username *" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} error={formErr.username} />
          <Input wrapperClass="sm:col-span-2" label="Email *" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} error={formErr.email} />
          <Input label={editing ? 'Mật khẩu mới (để trống = không đổi)' : 'Mật khẩu *'} type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} error={formErr.password} />
          <Input label={editing ? 'Xác nhận mật khẩu mới' : 'Xác nhận mật khẩu *'} type="password" value={form.password2} onChange={(e) => setForm({...form, password2: e.target.value})} error={formErr.password2} />
          <Select
            label="Vai trò"
            value={form.role}
            onChange={(e) => setForm({...form, role: e.target.value})}
            options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            placeholder={null}
          />
          <Select
            label="Trạng thái"
            value={form.status}
            onChange={(e) => setForm({...form, status: e.target.value})}
            options={Object.entries(USER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l.text }))}
            placeholder={null}
          />
        </div>

        {/* Phân quyền lớp học & cột được phép sửa */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">🔐 Phân quyền lớp học</h4>
          <span className="text-xs text-slate-400">Chọn lớp user được xem & các cột được phép sửa</span>
          </div>
          {classes.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
              Chưa có lớp học. Vui lòng tạo lớp trước.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              {classes.map((c) => {
                const p = formPerms[c.id] || { can_view: false, can_edit: false, editable_columns: [] }
                const cols = getColumnsForClass(c.id)
                return (
                  <div key={c.id} className="border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3 px-3 py-2 bg-slate-50">
                      <div className="flex-1">
                        <div className="font-medium text-slate-800 text-sm">{c.class_name}</div>
                        {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={p.can_view}
                          onChange={() => toggleFormPerm(c.id, 'can_view')}
                          className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        👁️ Xem
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={p.can_edit}
                          onChange={() => toggleFormPerm(c.id, 'can_edit')}
                          disabled={!p.can_view}
                          className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 disabled:opacity-40"
                        />
                        ✏️ Sửa
                      </label>
                    </div>
                    {p.can_edit && (
                      <div className="px-3 py-2 bg-white">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-500">Cột được phép sửa:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const all = cols.map((x) => x.key)
                              const cur = new Set(p.editable_columns || [])
                              const allChecked = all.every((k) => cur.has(k))
                              const next = allChecked ? [] : all
                              setFormPerms((prev) => ({
                                ...prev,
                                [c.id]: { ...p, editable_columns: next },
                              }))
                            }}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            {cols.every((x) => (p.editable_columns || []).includes(x.key)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cols.map((col) => (
                            <label key={col.key} className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">
                              <input
                                type="checkbox"
                                checked={(p.editable_columns || []).includes(col.key)}
                                onChange={() => toggleFormColumn(c.id, col.key)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                              />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!editing && (
          <p className="mt-4 text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
            💡 Lưu ý: Để tạo user tự động mà không cần xác nhận email, hãy vào Supabase Dashboard → Authentication → Settings →
            tắt "Confirm email" (Enable email confirmations = OFF). User đầu tiên tạo ra sẽ là <b>ADMIN</b>.
          </p>
        )}
      </Modal>

      {/* Phân quyền theo lớp */}
      <Modal
        open={!!permOpen}
        onClose={() => !permSaving && setPermOpen(null)}
        title={permOpen ? `Phân quyền lớp học: ${permOpen.full_name || permOpen.username}` : ''}
        size="lg"
        closeOnBackdrop={!permSaving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPermOpen(null)} disabled={permSaving}>Đóng</Button>
            <Button variant="primary" onClick={savePerm} disabled={permSaving}>
              {permSaving ? 'Đang lưu...' : '💾 Lưu phân quyền'}
            </Button>
          </>
        }
      >
        {permLoading ? (
          <div className="py-8 flex items-center justify-center"><Skeleton className="h-6 w-56" /></div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              ✅ <b>Xem</b> = chỉ xem dữ liệu. ✏️ <b>Sửa</b> = cho phép thêm/sửa/xóa sinh viên.
              Khi bật <b>Sửa</b>, hãy tích các <b>cột</b> được phép sửa. Nếu không tích cột nào, user chỉ thêm/xóa được nhưng không sửa được ô nào.
            </p>
            {classes.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-lg">
                Chưa có lớp học. Vui lòng tạo lớp trước.
              </p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {classes.map((c) => {
                  const p = permData[c.id] || { can_view: false, can_edit: false, editable_columns: [] }
                  const cols = getColumnsForClass(c.id)
                  return (
                    <div key={c.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50">
                        <div className="flex-1">
                          <div className="font-medium text-slate-800 text-sm">{c.class_name}</div>
                          {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.can_view}
                            onChange={() => togglePerm(c.id, 'can_view')}
                            className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          👁️ Xem
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.can_edit}
                            onChange={() => togglePerm(c.id, 'can_edit')}
                            disabled={!p.can_view}
                            className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 disabled:opacity-40"
                          />
                          ✏️ Sửa
                        </label>
                      </div>
                      {p.can_edit && (
                        <div className="px-3 py-2.5 bg-white border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-500">Cột được phép sửa:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const all = cols.map((x) => x.key)
                                const allChecked = all.every((k) => (p.editable_columns || []).includes(k))
                                setPermData((prev) => ({
                                  ...prev,
                                  [c.id]: { ...p, editable_columns: allChecked ? [] : all },
                                }))
                              }}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              {cols.every((x) => (p.editable_columns || []).includes(x.key)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {cols.map((col) => (
                              <label key={col.key} className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={(p.editable_columns || []).includes(col.key)}
                                  onChange={() => togglePermColumn(c.id, col.key)}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                />
                                {col.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        title={
          confirmStatus?.type === 'lock' ? 'Khóa tài khoản' :
          confirmStatus?.type === 'unlock' ? 'Mở khóa tài khoản' :
          confirmStatus?.type === 'resetpw' ? 'Đặt lại mật khẩu' :
          confirmStatus?.type === 'delete' ? 'Xóa tài khoản' : 'Xác nhận'
        }
        message={
          confirmStatus?.type === 'lock' ? `Khóa tài khoản "${confirmStatus.user.username}"?\nNgười dùng sẽ không đăng nhập được nữa.` :
          confirmStatus?.type === 'unlock' ? `Mở khóa tài khoản "${confirmStatus.user.username}"?` :
          confirmStatus?.type === 'resetpw' ? `Gửi link đặt lại mật khẩu cho "${confirmStatus.user.email}"?` :
          confirmStatus?.type === 'delete' ? `XÓA tài khoản "${confirmStatus.user.username}"?\nHành động không thể hoàn tác.\n\nLưu ý: Xóa user hoàn toàn cần dùng service_role trên Supabase.` :
          ''
        }
        confirmText={
          confirmStatus?.type === 'lock' ? 'Khóa' :
          confirmStatus?.type === 'unlock' ? 'Mở khóa' :
          confirmStatus?.type === 'resetpw' ? 'Gửi email' :
          confirmStatus?.type === 'delete' ? 'Xóa' : 'Đồng ý'
        }
        confirmVariant={
          confirmStatus?.type === 'unlock' || confirmStatus?.type === 'resetpw' ? 'primary' :
          'danger'
        }
        onConfirm={actionConfirm}
      />
    </div>
  )
}
