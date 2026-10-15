import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  getAllClasses, getClassStudentCounts, createClass, updateClass, deleteClass,
} from '../services/classService'
import Card from '../components/UI/Card'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import Modal, { ConfirmDialog } from '../components/UI/Modal'
import { PageLoader, EmptyState, Badge, Skeleton } from '../components/UI/Skeleton'
import { debounce, cn } from '../utils/helpers'
import { WARNING_LABELS } from '../utils/constants'

export default function Classes() {
  const { isAdmin } = useAuth()
  const { showSuccess, showError } = useToast()

  const [classes, setClasses] = useState([])
  const [counts, setCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal tạo / sửa lớp
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = tạo mới
  const [form, setForm] = useState({ class_name: '', description: '' })
  const [formErr, setFormErr] = useState({})
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Confirm xóa
  const [confirmDelete, setConfirmDelete] = useState(null) // class record

  const load = async () => {
    setLoading(true)
    try {
      const [list, cnt] = await Promise.all([
        getAllClasses(),
        getClassStudentCounts(),
      ])
      setClasses(list)
      setCounts(cnt)
    } catch (e) {
      console.error(e)
      showError(e.message || 'Tải danh sách lớp thất bại')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const merged = useMemo(() => {
    return classes.map((c) => {
      const info = counts.find((x) => x.id === c.id) || { student_count: 0 }
      return { ...c, student_count: info.student_count }
    })
  }, [classes, counts])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return merged
    return merged.filter(
      (c) =>
        c.class_name.toLowerCase().includes(kw) ||
        (c.description || '').toLowerCase().includes(kw)
    )
  }, [merged, search])

  const openCreate = () => {
    setEditing(null)
    setForm({ class_name: '', description: '' })
    setFormErr({})
    setFormOpen(true)
  }
  const openEdit = (c) => {
    setEditing(c)
    setForm({ class_name: c.class_name, description: c.description || '' })
    setFormErr({})
    setFormOpen(true)
  }

  const validateForm = () => {
    const e = {}
    if (!form.class_name.trim()) e.class_name = 'Tên lớp không được bỏ trống'
    else if (form.class_name.length > 50) e.class_name = 'Tên lớp tối đa 50 ký tự'
    setFormErr(e)
    return Object.keys(e).length === 0
  }

  const submitForm = async () => {
    if (!validateForm()) return
    setFormSubmitting(true)
    try {
      if (editing) {
        await updateClass(editing.id, form)
        showSuccess('Cập nhật lớp thành công')
      } else {
        await createClass(form)
        showSuccess('Tạo lớp thành công')
      }
      setFormOpen(false)
      load()
    } catch (e) {
      showError(e.message || (editing ? 'Cập nhật thất bại' : 'Tạo lớp thất bại'))
    } finally {
      setFormSubmitting(false)
    }
  }

  const onDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteClass(confirmDelete.id)
      showSuccess(`Đã xóa lớp ${confirmDelete.class_name}`)
      setConfirmDelete(null)
      load()
    } catch (e) {
      showError(e.message || 'Xóa lớp thất bại')
    }
  }

  if (loading) return <PageLoader text="Đang tải danh sách lớp..." />

  return (
    <div className="space-y-5">
      {/* Thanh tìm kiếm + hành động */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="w-full sm:max-w-sm">
            <Input
              placeholder="🔍 Tìm kiếm lớp học..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={load} title="Làm mới">
              🔄 Tải lại
            </Button>
            {isAdmin && (
              <Button variant="primary" onClick={openCreate}>
                ➕ Thêm lớp mới
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Danh sách lớp dạng card (responsive) */}
      {filtered.length === 0 ? (
        <EmptyState
          text={search ? 'Không tìm thấy lớp nào phù hợp' : 'Chưa có lớp học nào'}
          icon="🏫"
          action={isAdmin && <Button variant="primary" onClick={openCreate}>➕ Tạo lớp đầu tiên</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-primary-200 transition-all overflow-hidden group"
            >
              <div className="relative h-28 bg-gradient-to-br from-primary-600 via-primary-700 to-navy-800 text-white px-5 py-4 flex items-start justify-between">
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_top_right,white_0,transparent_50%)]" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-shadow">{c.class_name}</h3>
                  <p className="text-xs text-white/75 mt-1 line-clamp-2 max-w-[220px]">
                    {c.description || 'Chưa có mô tả'}
                  </p>
                </div>
                <div className="text-5xl opacity-40 relative">🏫</div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Số sinh viên</div>
                    <div className="text-2xl font-extrabold text-slate-800 mt-0.5">
                      {c.student_count}
                    </div>
                  </div>
                  <Badge variant="primary">{c.student_count} SV</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-500">CB1</div>
                    <div className="font-bold text-green-600">-</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-500">CB2</div>
                    <div className="font-bold text-amber-600">-</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-500">CB3</div>
                    <div className="font-bold text-red-600">-</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Link to={`/classes/${c.id}/students`} className="flex-1">
                    <Button variant="primary" size="sm" className="w-full">
                      ✏️ Xem sinh viên
                    </Button>
                  </Link>
                  {isAdmin && (
                    <>
                      <Button variant="secondary" size="icon_sm" title="Sửa lớp" onClick={() => openEdit(c)}>
                        ✏️
                      </Button>
                      <Button variant="danger" size="icon_sm" title="Xóa lớp" onClick={() => setConfirmDelete(c)}>
                        🗑️
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Tạo / Sửa */}
      <Modal
        open={formOpen}
        onClose={() => !formSubmitting && setFormOpen(false)}
        title={editing ? `Sửa lớp: ${editing.class_name}` : 'Thêm lớp mới'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={formSubmitting}>
              Hủy
            </Button>
            <Button variant="primary" onClick={submitForm} disabled={formSubmitting}>
              {formSubmitting ? 'Đang lưu...' : (editing ? 'Lưu thay đổi' : 'Tạo lớp')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Tên lớp *"
            placeholder="VD: CNTT01"
            value={form.class_name}
            onChange={(e) => setForm({ ...form, class_name: e.target.value })}
            error={formErr.class_name}
            autoFocus
          />
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Mô tả</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Mô tả ngắn gọn về lớp..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Xóa lớp học"
        message={
          confirmDelete
            ? `Bạn có chắc muốn xóa lớp "${confirmDelete.class_name}"?\n\nLớp này có ${confirmDelete.student_count} sinh viên. Toàn bộ sinh viên và dữ liệu liên quan sẽ bị XÓA VĨNH VIỄN.\n\nHành động này không thể hoàn tác.`
            : ''
        }
        confirmText="Xóa lớp này"
        confirmVariant="danger"
        onConfirm={onDelete}
      />
    </div>
  )
}
