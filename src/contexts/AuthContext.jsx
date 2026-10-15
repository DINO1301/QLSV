import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabaseClient'
import { USER_STATUS } from '../utils/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)            // auth user (session)
  const [profile, setProfile] = useState(null)      // profile mở rộng
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      setProfile(data)
      return data
    } catch (e) {
      console.error('[Auth] Lỗi load profile:', e)
      setProfile(null)
      return null
    }
  }, [])

  const refreshSession = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    } catch (e) {
      console.error('[Auth] Lỗi refresh session:', e)
    } finally {
      setLoading(false)
      setInitializing(false)
    }
  }, [loadProfile])

  // Khởi tạo lần đầu + lắng nghe auth state
  useEffect(() => {
    refreshSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        } else if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        }
        setLoading(false)
        setInitializing(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [refreshSession, loadProfile])

  /** Đăng nhập */
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) return { success: false, error }
    if (data?.user) {
      const p = await loadProfile(data.user.id)
      if (p?.status === USER_STATUS.LOCKED) {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        return {
          success: false,
          error: { message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' },
        }
      }
    }
    return { success: true, data }
  }

  /** Đăng xuất */
  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  /** Quên mật khẩu - gửi email reset */
  const forgotPassword = async (email) => {
    // Sử dụng site URL hiện tại + /reset-password làm redirect
    const site = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${site}/reset-password`,
    })
    if (error) return { success: false, error }
    return { success: true }
  }

  /** Cập nhật mật khẩu mới */
  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { success: false, error }
    return { success: true }
  }

  const isAdmin = profile?.role === 'admin'
  const isActive = profile?.status === USER_STATUS.ACTIVE

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        initializing,
        login,
        logout,
        forgotPassword,
        updatePassword,
        refreshSession,
        isAdmin,
        isActive,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng trong AuthProvider')
  return ctx
}
