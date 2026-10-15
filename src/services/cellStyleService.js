import { supabase } from './supabaseClient'

/**
 * Lấy tất cả màu ô của 1 lớp (dựa trên student_id thuộc lớp đó)
 * Trả về map: { [studentId]: { [columnKey]: color } }
 */
export const getCellStylesByClass = async (classId) => {
  if (!classId) return {}
  const { data: students, error: e1 } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId)
  if (e1) throw e1
  const ids = (students || []).map((s) => s.id)
  if (!ids.length) return {}

  const { data, error } = await supabase
    .from('cell_styles')
    .select('student_id, column_key, color')
    .in('student_id', ids)
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
 * Upsert màu cho 1 ô (studentId + columnKey)
 * Nếu color là null/undefined/xâu rỗng -> xóa
 */
export const upsertCellStyle = async (studentId, columnKey, color) => {
  if (!studentId || !columnKey) return null
  if (!color) {
    const { error } = await supabase
      .from('cell_styles')
      .delete()
      .eq('student_id', studentId)
      .eq('column_key', columnKey)
    if (error) throw error
    return null
  }
  const { data, error } = await supabase
    .from('cell_styles')
    .upsert(
      { student_id: studentId, column_key: columnKey, color },
      { onConflict: 'student_id, column_key' }
    )
    .select()
    .single()
  if (error) throw error
  return data
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
