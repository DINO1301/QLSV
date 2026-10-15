import { supabase } from './supabaseClient'

/** Lấy phân quyền của 1 user tất cả các lớp */
export const getUserPermissions = async (userId) => {
  const { data, error } = await supabase
    .from('class_permissions')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

/** Lấy quyền của user hiện tại đối với 1 lớp */
export const getMyPermissionForClass = async (classId, userId) => {
  const { data, error } = await supabase
    .from('class_permissions')
    .select('can_view, can_edit, editable_columns')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .maybeSingle()
  if (error) throw error
  return data || { can_view: false, can_edit: false, editable_columns: [] }
}

/** Cập nhật / gán quyền user theo lớp (dùng upsert) */
export const upsertClassPermission = async (userId, classId, canView, canEdit, editableColumns = []) => {
  const { data, error } = await supabase
    .from('class_permissions')
    .upsert(
      {
        user_id: userId,
        class_id: classId,
        can_view: canView,
        can_edit: canEdit,
        editable_columns: editableColumns,
      },
      { onConflict: 'user_id, class_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/** Xóa quyền (không cấp quyền nữa) */
export const deleteClassPermission = async (userId, classId) => {
  const { error } = await supabase
    .from('class_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('class_id', classId)
  if (error) throw error
  return true
}

/** Bulk upsert phân quyền (dùng trong trang Users) */
export const upsertPermissionsBulk = async (rows) => {
  if (!rows?.length) return []
  const { data, error } = await supabase
    .from('class_permissions')
    .upsert(rows, { onConflict: 'user_id, class_id' })
    .select()
  if (error) throw error
  return data || []
}
