import { supabase } from './supabaseClient'
import { ACTION_TYPES } from '../utils/constants'

/** Lấy danh sách tất cả lớp (theo quyền) */
export const getAllClasses = async () => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('class_name', { ascending: true })
  if (error) throw error
  return data || []
}

/** Lấy lớp theo id */
export const getClassById = async (id) => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Thêm lớp mới */
export const createClass = async (payload) => {
  const { data, error } = await supabase
    .from('classes')
    .insert([{ class_name: payload.class_name.trim(), description: payload.description || null }])
    .select()
    .single()
  if (error) throw error
  return data
}

/** Cập nhật lớp */
export const updateClass = async (id, payload) => {
  const { data, error } = await supabase
    .from('classes')
    .update({
      class_name: payload.class_name?.trim(),
      description: payload.description,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Xóa lớp */
export const deleteClass = async (id) => {
  const { error } = await supabase.from('classes').delete().eq('id', id)
  if (error) throw error
  return true
}

/** Đếm số sinh viên trong 1 lớp */
export const countStudentsInClass = async (classId) => {
  const { count, error } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)
  if (error) throw error
  return count || 0
}

/** Thống kê số sinh viên / lớp */
export const getClassStudentCounts = async () => {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id,
      class_name,
      students:students(count)
    `)
    .order('class_name')
  if (error) throw error
  return (data || []).map((c) => ({
    id: c.id,
    class_name: c.class_name,
    student_count: c.students?.[0]?.count || 0,
  }))
}
