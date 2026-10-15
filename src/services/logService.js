import { supabase } from './supabaseClient'
import { ACTION_TYPES } from '../utils/constants'

/**
 * Ghi 1 activity log.
 * Lý do gọi từ client: Trigger database đã tự động ghi cho students/classes/columns/permissions
 * Hàm này dùng cho các action khác như IMPORT_EXCEL, UPDATE_WARNING tùy chỉnh, ...
 */
export const insertLog = async (params) => {
  const { action, class_id = null, student_id = null, old_data = null, new_data = null } = params
  try {
    // Lấy user_id từ session hiện tại (nếu có)
    const { data: userData } = await supabase.auth.getUser()
    const user_id = userData?.user?.id || null

    // Sử dụng RPC nếu có, hoặc insert thẳng
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        action,
        user_id,
        class_id,
        student_id,
        old_data,
        new_data,
      }])
      .select()
      .single()
    if (error) {
      // Log lỗi nội bộ, không throw để không ảnh hưởng luồng chính
      console.warn('[logService] insertLog lỗi:', error.message)
      return null
    }
    return data
  } catch (e) {
    console.warn('[logService]', e)
    return null
  }
}

/** Lấy danh sách log với filters */
export const getActivityLogs = async (filters = {}, page = 1, pageSize = 50) => {
  let q = supabase
    .from('activity_logs')
    .select(`
      *,
      user:profiles(full_name, username, email, role),
      class:classes(class_name),
      student:students(student_code, full_name)
    `)

  if (filters.userId)   q = q.eq('user_id', filters.userId)
  if (filters.classId)  q = q.eq('class_id', filters.classId)
  if (filters.action)   q = q.eq('action', filters.action)
  if (filters.fromDate) q = q.gte('created_at', filters.fromDate)
  if (filters.toDate)   q = q.lte('created_at', filters.toDate + 'T23:59:59')

  q = q.order('created_at', { ascending: false })

  if (page && pageSize) {
    q = q.range((page - 1) * pageSize, page * pageSize - 1)
  }

  const { data, error } = await q
  if (error) throw error
  return data || []
}
