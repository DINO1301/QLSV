import { useEffect, useState } from 'react'
import Modal, { ConfirmDialog } from '../UI/Modal'
import Button from '../UI/Button'
import Input from '../UI/Input'
import Select from '../UI/Select'
import { useToast } from '../../contexts/ToastContext'
import {
  createColumn, updateColumn, deleteColumn, reorderColumns,
} from '../../services/columnService'
import { DATA_TYPE_LABELS, DATA_TYPES } from '../../utils/constants'
import { safeJson } from '../../utils/helpers'

/**
 * Modal quản lý cột: xem danh sách, thêm, sửa tên/kiểu, xóa, kéo/đánh lại thứ tự
 */
export default function ColumnManager({
  open,
  onClose,
  classId,
  canEdit,
  columns,      // custom_columns từ state cha
  setColumns,   // setter
}) {
  const { showSuccess, showError } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    column_name: '',
    data_type: DATA_TYPES.TEXT,
    options: '',
    column_order: 0,
  })
  const [formErr, setFormErr] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  // Reset form khi mở modal tạo mới
  const openCreate = () => {
    setEditing(null)
    setForm({
      column_name: '',
      data_type: DATA_TYPES.TEXT,
      options: '',
      column_order: (columns?.length || 0),
    })
    setFormErr({})
    setFormOpen(true)
  }
  const openEdit = (col) => {
    setEditing(col)
    setForm({
      column_name: col.column_name,
      data_type: col.data_type,
      options: Array.isArray(col.options) ? col.options.join('\n') : '',
      column_order: col.column_order,
    })
    setFormErr({})
    setFormOpen(true)
  }

  const submit = async () => {
    const e = {}
    if (!form.column_name.trim()) e.column_name = 'Tên cột không được trống'
    if (form.data_type === DATA_TYPES.SELECT && !form.options.trim()) {
      e.options = 'Cột Select cần ít nhất 1 lựa chọn (mỗi dòng 1 lựa chọn)'
    }
    setFormErr(e)
    if (Object.keys(e).length) return

    setSubmitting(true)
    try {
      const payload = {
        class_id: classId,
        column_name: form.column_name.trim(),
        data_type: form.data_type,
        column_order: Number(form.column_order) || 0,
        options:
          form.data_type === DATA_TYPES.SELECT
            ? form.options.split('\n').map((x) => x.trim()).filter(Boolean)
            : [],
      }
      let saved
      if (editing) {
        saved = await updateColumn(editing.id, payload)
      } else {
        saved = await createColumn(payload)
      }
      // Cập nhật state cục bộ
      setColumns((prev) => {
        const next = editing ? prev.map((x) => x.id === saved.id ? saved : x) : [...prev, saved]
        return next.sort((a, b) => (a.column_order - b.column_order) || a.column_name.localeCompare(b.column_name))
      })
      showSuccess(editing ? 'Đã cập nhật cột' : 'Đã thêm cột mới')
      setFormOpen(false)
    } catch (err) {
      showError(err.message || (editing ? 'Cập nhật thất bại' : 'Thêm cột thất bại'))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async () => {
    if (!confirmDel) return
    try {
      await deleteColumn(confirmDel.id)
      setColumns((prev) => prev.filter((c) => c.id !== confirmDel.id))
      showSuccess(`Đã xóa cột "${confirmDel.column_name}"`)
      setConfirmDel(null)
    } catch (err) {
      showError(err.message || 'Xóa cột thất bại')
    }
  }

  const moveOrder = async (index, dir) => {
    if (reordering) return
    const newArr = [...columns]
    const target = index + dir
    if (target < 0 || target >= newArr.length) return
    
    setReordering(true)
    // Hoán đổi vị trí
    const temp = newArr[index]
    newArr[index] = newArr[target]
    newArr[target] = temp

    // Cập nhật lại column_order cho toàn bộ list để đảm bảo tính liên tục
    const updates = newArr.map((c, idx) => ({ 
      id: c.id, 
      column_order: idx 
    }))

    try {
      await reorderColumns(updates)
      // Cập nhật state với data mới (giữ lại các trường khác của column)
      const updatedColumns = newArr.map((c, idx) => ({ ...c, column_order: idx }))
      setColumns(updatedColumns)
    } catch (e) {
      showError(e.message || 'Thay đổi thứ tự thất bại')
    } finally {
      setReordering(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Quản lý cột dữ liệu"
        size="2xl"
        closeOnBackdrop={!submitting}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Các cột cố định (Mã SV, Họ tên, Ngày sinh, Cảnh báo...) không thể xóa.
              Bạn có thể thêm cột tùy chỉnh theo nhu cầu của lớp.
            </p>
            {canEdit && (
              <Button variant="primary" size="sm" onClick={openCreate}>
                ➕ Thêm cột
              </Button>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Tên cột</th>
                  <th className="px-4 py-3 text-left font-semibold">Kiểu dữ liệu</th>
                  <th className="px-4 py-3 text-left font-semibold">Thứ tự</th>
                  {canEdit && <th className="px-4 py-3 text-right font-semibold">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {columns.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-slate-400">
                      Chưa có cột tùy chỉnh. Nhấn "Thêm cột" để bắt đầu.
                    </td>
                  </tr>
                )}
                {columns.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.column_name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-block px-2 py-0.5 rounded bg-primary-50 text-primary-700 text-xs">
                        {DATA_TYPE_LABELS[c.data_type] || c.data_type}
                      </span>
                      {c.data_type === 'select' && Array.isArray(c.options) && (
                        <span className="ml-2 text-xs text-slate-400">
                          ({c.options.length} lựa chọn)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs w-6 text-center text-slate-400">{idx + 1}</span>
                        {canEdit && (
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveOrder(idx, -1)}
                              disabled={idx === 0 || reordering}
                              className="p-0.5 rounded text-[10px] border border-slate-200 disabled:opacity-30 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-colors"
                              title="Di chuyển lên"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveOrder(idx, +1)}
                              disabled={idx === columns.length - 1 || reordering}
                              className="p-0.5 rounded text-[10px] border border-slate-200 disabled:opacity-30 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-colors"
                              title="Di chuyển xuống"
                            >
                              ▼
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button size="icon_sm" variant="secondary" title="Sửa" onClick={() => openEdit(c)}>✏️</Button>
                        <Button size="icon_sm" variant="danger" title="Xóa" onClick={() => setConfirmDel(c)}>🗑️</Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-5 mt-5 border-t border-slate-100 flex justify-end">
          <Button variant="primary" onClick={onClose}>Hoàn tất</Button>
        </div>
      </Modal>

      {/* Form tạo/sửa cột */}
      <Modal
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        title={editing ? 'Sửa cột' : 'Thêm cột mới'}
        size="md"
        closeOnBackdrop={!submitting}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitting}>Hủy</Button>
            <Button variant="primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Đang lưu...' : (editing ? 'Lưu' : 'Thêm cột')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Tên cột *"
            placeholder="VD: Điểm rèn luyện, Số điện thoại..."
            value={form.column_name}
            onChange={(e) => setForm({ ...form, column_name: e.target.value })}
            error={formErr.column_name}
            autoFocus
          />
          <Select
            label="Kiểu dữ liệu *"
            value={form.data_type}
            onChange={(e) => setForm({ ...form, data_type: e.target.value })}
            options={Object.entries(DATA_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            placeholder={null}
          />
          {form.data_type === DATA_TYPES.SELECT && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Các lựa chọn (mỗi dòng 1 lựa chọn) *
              </label>
              <textarea
                rows={4}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${formErr.options ? 'border-red-400' : 'border-slate-300'}`}
                placeholder={'Giới tính Nam\nNữ\nKhác'}
                value={form.options}
                onChange={(e) => setForm({ ...form, options: e.target.value })}
              />
              {formErr.options && <p className="text-xs text-red-600 mt-1">{formErr.options}</p>}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Xóa cột"
        message={
          confirmDel
            ? `Bạn có chắc muốn xóa cột "${confirmDel.column_name}"?\n\nTất cả dữ liệu của cột này trên ${'TẤT CẢ'} sinh viên sẽ bị xóa vĩnh viễn.\n\nKhông thể hoàn tác.`
            : ''
        }
        confirmText="Xóa cột này"
        confirmVariant="danger"
        onConfirm={onDelete}
      />
    </>
  )
}
