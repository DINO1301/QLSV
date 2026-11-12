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
  
  // Sử dụng loop update để tránh lỗi 403 Forbidden của upsert (thường do thiếu quyền INSERT)
  // và đảm bảo RLS hoạt động chính xác với từng dòng.
  for (const item of updates) {
    const { error } = await supabase
      .from('custom_columns')
      .update({ column_order: item.column_order })
      .eq('id', item.id)
    if (error) throw error
  }
  
  return true
}

/** Thêm một cột chung cho tất cả các lớp hiện có (chỉ admin, được bảo vệ ở RPC). */
export const createGlobalColumn = async ({ column_name, data_type, options, column_order }) => {
  const { data, error } = await supabase.rpc('create_global_custom_column', {
    p_column_name: column_name,
    p_data_type: data_type,
    p_options: options || [],
    p_column_order: column_order || 0,
  })
  if (error) throw error
  return data || []
}

/** Sửa định nghĩa của các cột cùng tên trên mọi lớp, giữ nguyên các giá trị đã nhập. */
export const updateGlobalColumn = async (id, { column_name, data_type, options, column_order }) => {
  const { data, error } = await supabase.rpc('update_global_custom_column', {
    p_column_id: id,
    p_column_name: column_name,
    p_data_type: data_type,
    p_options: options || [],
    p_column_order: column_order || 0,
  })
  if (error) throw error
  return data || []
}

/** Xóa các cột cùng tên trên mọi lớp và các giá trị đi kèm. */
export const deleteGlobalColumn = async (id) => {
  const { error } = await supabase.rpc('delete_global_custom_column', { p_column_id: id })
  if (error) throw error
  return true
}

/** Đồng bộ thứ tự các cột trên mọi lớp. */
export const reorderGlobalColumns = async (columnIds) => {
  if (!columnIds?.length) return true
  const { error } = await supabase.rpc('reorder_global_custom_columns', {
    p_column_ids: columnIds,
  })
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

/** Bulk upsert custom values (tự chia lô + loại trùng cặp student_id/column_id) */
export const upsertCustomValuesBulk = async (rows) => {
  if (!rows?.length) return []

  // Loại trùng: Postgres báo lỗi nếu 1 lệnh upsert tác động cùng 1 dòng 2 lần
  const dedup = new Map()
  rows.forEach((r) => {
    if (!r?.student_id || !r?.column_id) return
    dedup.set(`${r.student_id}|${r.column_id}`, r)
  })
  const list = Array.from(dedup.values())

  const CHUNK = 500
  const out = []
  for (let i = 0; i < list.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('custom_values')
      .upsert(list.slice(i, i + CHUNK), { onConflict: 'student_id, column_id' })
      .select()
    if (error) throw error
    out.push(...(data || []))
  }
  return out
}
