import { supabase } from './supabaseClient'

/** Lấy tất cả sinh viên của 1 lớp + custom values pivot sẵn */
export const getStudentsByClass = async (classId) => {
  if (!classId) return []
  const { data, error } = await supabase
    .from('students')
    .select(`
      *,
      custom_values(
        id,
        column_id,
        value
      )
    `)
    .eq('class_id', classId)
    .order('student_code', { ascending: true })
  if (error) throw error
  return data || []
}

/** Thêm 1 sinh viên */
export const createStudent = async (payload) => {
  const { data, error } = await supabase
    .from('students')
    .insert([payload])
    .select()
    .single()
  if (error) throw error
  return data
}

/** Bulk thêm sinh viên (dùng cho Import Excel) */
export const createStudentsBulk = async (rows) => {
  if (!rows?.length) return []
  const { data, error } = await supabase
    .from('students')
    .insert(rows)
    .select()
  if (error) throw error
  return data || []
}

/** Cập nhật 1 sinh viên */
export const updateStudent = async (id, payload) => {
  const { data, error } = await supabase
    .from('students')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Xóa 1 sinh viên */
export const deleteStudent = async (id) => {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
  return true
}

/** Xóa nhiều sinh viên */
export const deleteStudentsBulk = async (ids) => {
  if (!ids?.length) return true
  const { error } = await supabase.from('students').delete().in('id', ids)
  if (error) throw error
  return true
}

/** Kiểm tra trùng mã sinh viên trong lớp */
export const checkDuplicateStudentCode = async (classId, code, excludeId = null) => {
  let q = supabase.from('students').select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('student_code', code?.trim())
  if (excludeId) q = q.neq('id', excludeId)
  const { count, error } = await q
  if (error) throw error
  return (count || 0) > 0
}

/** Lấy sinh viên theo mã trong 1 lớp (dùng để upsert khi import) */
export const getStudentByCodeInClass = async (classId, code) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .eq('student_code', code?.trim())
    .maybeSingle()
  if (error) throw error
  return data
}

/** Lấy sinh viên có cảnh báo theo lớp / cấp độ */
export const getWarningStudents = async (filters = {}) => {
  let q = supabase
    .from('students')
    .select(`
      *,
      class:classes(id, class_name)
    `)
    .gt('warning_level', 0)

  if (filters.classId) q = q.eq('class_id', filters.classId)
  if (filters.level !== undefined && filters.level !== null && filters.level !== '') {
    q = q.eq('warning_level', Number(filters.level))
  }
  if (filters.keyword) {
    const kw = `%${filters.keyword}%`
    q = q.or(`student_code.ilike.${kw},full_name.ilike.${kw}`)
  }
  if (filters.fromDate) q = q.gte('warning_date', filters.fromDate)
  if (filters.toDate) q = q.lte('warning_date', filters.toDate)

  q = q.order('warning_level', { ascending: false }).order('student_code')

  const { data, error } = await q
  if (error) throw error
  return data || []
}

/** Thống kê số sinh viên theo cấp độ cảnh báo */
export const getWarningStats = async () => {
  const all = [0, 1, 2, 3]
  const counts = {}
  for (const lvl of all) {
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('warning_level', lvl)
    if (error) throw error
    counts[lvl] = count || 0
  }
  return counts
}

/** Đếm tổng sinh viên */
export const countAllStudents = async () => {
  const { count, error } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}
