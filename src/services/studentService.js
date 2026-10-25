import { supabase } from './supabaseClient'

/**
 * Supabase/PostgREST mặc định chỉ trả tối đa 1000 dòng (max rows).
 * Hàm này tự động phân trang để lấy HẾT dữ liệu.
 * `buildQuery` phải là hàm tạo query mới mỗi lần gọi (PostgREST builder chỉ dùng 1 lần).
 */
const PAGE_SIZE = 1000
export const fetchAllRows = async (buildQuery) => {
  const all = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = data || []
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

/** Lấy tất cả sinh viên của 1 lớp + custom values pivot sẵn */
export const getStudentsByClass = async (classId) => {
  if (!classId) return []

  // 1) Lấy hết sinh viên của lớp (phân trang)
  const students = await fetchAllRows(() =>
    supabase.from('students').select('*').eq('class_id', classId).order('student_code', { ascending: true })
  )
  if (!students.length) return students

  // 2) Lấy hết custom values theo cột của lớp (URL ngắn, không phụ thuộc số sinh viên)
  const { data: cols, error: colErr } = await supabase
    .from('custom_columns')
    .select('id')
    .eq('class_id', classId)
  if (colErr) throw colErr
  const colIds = (cols || []).map((c) => c.id)

  let values = []
  if (colIds.length) {
    values = await fetchAllRows(() =>
      supabase.from('custom_values').select('id, student_id, column_id, value').in('column_id', colIds)
    )
  }

  // 3) Gắn custom_values vào từng sinh viên
  const map = new Map()
  values.forEach((v) => {
    if (!map.has(v.student_id)) map.set(v.student_id, [])
    map.get(v.student_id).push({ id: v.id, column_id: v.column_id, value: v.value })
  })
  return students.map((s) => ({ ...s, custom_values: map.get(s.id) || [] }))
}

/** Lấy toàn bộ sinh viên (đầy đủ trường) của nhiều lớp — dùng cho Import Excel */
export const getStudentsBasicByClasses = async (classIds) => {
  const ids = (classIds || []).filter(Boolean)
  if (!ids.length) return []
  return fetchAllRows(() => supabase.from('students').select('*').in('class_id', ids))
}

/** Lấy TẤT CẢ sinh viên của TẤT CẢ lớp + tất cả custom values */
export const getAllStudentsWithAllCustomColumns = async () => {
  // 1) Lấy hết sinh viên (phân trang)
  const students = await fetchAllRows(() =>
    supabase
      .from('students')
      .select('*, class:classes(id, class_name)')
      .order('student_code', { ascending: true })
  )
  if (!students.length) return { students: [], columns: [] }

  // 2) Lấy hết custom columns của tất cả lớp
  const { data: allCols, error: colErr } = await supabase
    .from('custom_columns')
    .select('*')
    .order('column_order', { ascending: true })
  if (colErr) throw colErr

  // 3) Lấy hết custom values (phân trang)
  const values = await fetchAllRows(() =>
    supabase.from('custom_values').select('id, student_id, column_id, value')
  )

  // 4) Gắn custom_values vào từng sinh viên
  const valMap = new Map()
  values.forEach((v) => {
    if (!valMap.has(v.student_id)) valMap.set(v.student_id, [])
    valMap.get(v.student_id).push({ id: v.id, column_id: v.column_id, value: v.value })
  })

  const mappedStudents = students.map((s) => ({
    ...s,
    class_name: s.class?.class_name,
    custom_values: valMap.get(s.id) || []
  }))

  return {
    students: mappedStudents,
    columns: allCols || []
  }
}

/** Bulk upsert sinh viên theo khóa (class_id, student_code) — dùng cho Import Excel */
export const upsertStudentsBulk = async (rows) => {
  if (!rows?.length) return []
  const CHUNK = 500
  const out = []
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('students')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'class_id,student_code' })
      .select()
    if (error) throw error
    out.push(...(data || []))
  }
  return out
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
