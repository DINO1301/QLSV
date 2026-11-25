import { supabase } from './supabaseClient'

/**
 * Lấy tất cả màu ô của 1 lớp (dựa trên student_id thuộc lớp đó)
 * Trả về map: { [studentId]: { [columnKey]: color } }
 */
export const getCellStylesByClass = async (classId) => {
  if (!classId) return {}
  // Lọc trực tiếp theo lớp qua join students!inner (tránh .in() với hàng nghìn UUID)
  const { data, error } = await supabase
    .from('cell_styles')
    .select('student_id, column_key, color, students!inner(class_id)')
    .eq('students.class_id', classId)
  if (error) throw error

  const map = {}
  ;(data || []).forEach((r) => {
    if (!map[r.student_id]) map[r.student_id] = {}
    map[r.student_id][r.column_key] = r.color
  })
  return map
}

/** Lấy tất cả màu ô trong hệ thống */
export const getCellStylesAll = async () => {
  const { data, error } = await supabase
    .from('cell_styles')
    .select('student_id, column_key, color')
  if (error) throw error

  const map = {}
  ;(data || []).forEach((r) => {
    if (!map[r.student_id]) map[r.student_id] = {}
    map[r.student_id][r.column_key] = r.color
  })
  return map
}

/**
 * Lấy màu ô của 1 sinh viên
 * Trả về: { [columnKey]: color }
 */
export const getCellStylesByStudent = async (studentId) => {
  if (!studentId) return {}
  const { data, error } = await supabase
    .from('cell_styles')
    .select('column_key, color')
    .eq('student_id', studentId)
  if (error) throw error
  const map = {}
  ;(data || []).forEach((r) => { map[r.column_key] = r.color })
  return map
}

/**
 * Xóa nhiều màu ô theo studentId (dùng khi xóa sinh viên)
 */
export const deleteCellStylesByStudent = async (studentId) => {
  const { error } = await supabase
    .from('cell_styles')
    .delete()
    .eq('student_id', studentId)
  if (error) throw error
  return true
}

/**
 * Áp dụng/xóa màu cho NHIỀU ô cùng lúc bằng cách gộp thành ít request (chia lô).
 * targets: [{ studentId, columnKey }]
 * Tránh bắn hàng nghìn request song song gây lỗi net::ERR_INSUFFICIENT_RESOURCES.
 */
export const bulkSetCellStyles = async (targets, color) => {
  const list = (targets || []).filter((t) => t?.studentId && t?.columnKey)
  if (list.length === 0) return true

  const CHUNK = 500

  if (color) {
    // Ghi màu: upsert theo lô, onConflict (student_id, column_key)
    for (let i = 0; i < list.length; i += CHUNK) {
      const chunk = list.slice(i, i + CHUNK).map((t) => ({
        student_id: t.studentId,
        column_key: t.columnKey,
        color,
      }))
      const { error } = await supabase
        .from('cell_styles')
        .upsert(chunk, { onConflict: 'student_id, column_key' })
      if (error) throw error
    }
    return true
  }

  // Xóa màu: nhóm theo column_key rồi xóa theo lô student_id
  const byColumn = {}
  list.forEach((t) => {
    if (!byColumn[t.columnKey]) byColumn[t.columnKey] = new Set()
    byColumn[t.columnKey].add(t.studentId)
  })

  for (const [columnKey, idSet] of Object.entries(byColumn)) {
    const ids = Array.from(idSet)
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { error } = await supabase
        .from('cell_styles')
        .delete()
        .eq('column_key', columnKey)
        .in('student_id', ids.slice(i, i + CHUNK))
      if (error) throw error
    }
  }
  return true
}
