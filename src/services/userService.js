import { supabase } from './supabaseClient'

/** Lấy tất cả profile (dành cho admin) */
export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/** Cập nhật profile của user */
export const updateUserProfile = async (userId, payload) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Tạo user mới (dành cho ADMIN) - KHÔNG cần Edge Function, KHÔNG cần service_role.
 *
 * Cách hoạt động:
 *  1. Lưu session admin hiện tại
 *  2. Gọi signUp tạo user mới (Supabase sẽ tự đăng nhập user mới này)
 *  3. Khôi phục lại session admin (để admin không bị đá ra)
 *  4. Cập nhật role trong profiles
 *
 * ⚠️ Yêu cầu: Trong Supabase Dashboard → Authentication → Providers → Email,
 *    hãy TẮT "Confirm email" (Enable email confirmations = OFF)
 *    để user được tạo ra đăng nhập được ngay mà không cần xác nhận email.
 */
export const createNewUser = async (payload) => {
  const { email, password, username, full_name, role } = payload

  // 1) Lưu session admin hiện tại
  const { data: { session: adminSession } } = await supabase.auth.getSession()

  // 2) Tạo user mới qua signUp
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name },
    },
  })

  if (error) throw error

  // 3) Khôi phục session admin ngay lập tức
  if (adminSession) {
    const { error: restoreError } = await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    })
    if (restoreError) console.warn('Khôi phục session admin lỗi:', restoreError.message)
  }

  const user = data.user

  // 4) Cập nhật role vào profiles (trigger đã tạo profile, ta set role)
  if (user && role) {
    try {
      await supabase
        .from('profiles')
        .update({ role, full_name, username })
        .eq('id', user.id)
    } catch (_) { /* bỏ qua */ }
  }

  return user
}

/** Reset mật khẩu user (nếu có quyền admin) */
export const adminResetPassword = async (userId, newPassword) => {
  // Frontend không có service_role, chỉ có thể gọi bằng function nếu có
  // Giải pháp đơn giản: gửi link reset password
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single()
  if (profile?.email) {
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email)
    if (error) throw error
    return { type: 'email', email: profile.email }
  }
  return { type: 'none' }
}
