import { supabase } from './supabaseClient'

/** Lấy tất cả custom columns của 1 lớp (sắp xếp theo column_order) */
export const getColumnsByClass = async (classId) => {
  const { data, error } = await supabase
    .from('custom_columns')
    .select('*')
    .eq('class_id', classId)
    .order('column_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

/** Lấy tất cả custom columns của TẤT CẢ lớp (dùng cho phân quyền) */
export const getAllColumns = async () => {
  const { data, error } = await supabase
    .from('custom_columns')
    .select('*')
    .order('class_id')
    .order('column_order', { ascending: true })
  if (error) throw error
  return data || []
}

/** Thêm cột */
export const createColumn = async (payload) => {
  const { data, error } = await supabase
    .from('custom_columns')
    .insert([payload])
    .select()
    .single()
  if (error) throw error
  return data
}

/** Cập nhật cột */
export const updateColumn = async (id, payload) => {
  const { data, error } = await supabase
    .from('custom_columns')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Xóa cột */
export const deleteColumn = async (id) => {
  const { error } = await supabase.from('custom_columns').delete().eq('id', id)
  if (error) throw error
  return true
}

/** Cập nhật thứ tự cột hàng loạt */
export const reorderColumns = async (updates) => {
  if (!updates?.length) return true
  const { error } = await supabase.from('custom_columns').upsert(updates)
  if (error) throw error
  return true
}

/* -------------- custom_values -------------- */

/** Upsert 1 giá trị cột tùy chỉnh */
export const upsertCustomValue = async (studentId, columnId, value) => {
  const { data, error } = await supabase
    .from('custom_values')
    .upsert(
      { student_id: studentId, column_id: columnId, value },
      { onConflict: 'student_id, column_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/** Bulk upsert custom values */
export const upsertCustomValuesBulk = async (rows) => {
  if (!rows?.length) return []
  const { data, error } = await supabase
    .from('custom_values')
    .upsert(rows, { onConflict: 'student_id, column_id' })
    .select()
  if (error) throw error
  return data || []
}
