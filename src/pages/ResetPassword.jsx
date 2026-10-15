import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import { Spinner, PageLoader } from '../components/UI/Skeleton'
import { supabase } from '../services/supabaseClient'

export default function ResetPassword() {
  const { updatePassword, user } = useAuth()
  const { showError, showSuccess } = useToast()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [validSession, setValidSession] = useState(false)

  // Kiểm tra access token recovery hợp lệ từ URL
  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (mounted) {
          setValidSession(!!data.session)
          setCheckingSession(false)
        }
      } catch {
        if (mounted) {
          setValidSession(false)
          setCheckingSession(false)
        }
      }
    }
    check()
    return () => { mounted = false }
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (password.length < 6) return setErr('Mật khẩu phải có ít nhất 6 ký tự')
    if (password !== confirm) return setErr('Mật khẩu xác nhận không khớp')

    setSubmitting(true)
    try {
      const res = await updatePassword(password)
      if (!res.success) {
        setErr(res.error?.message || 'Cập nhật thất bại')
        showError(res.error?.message || 'Cập nhật thất bại')
      } else {
        showSuccess('Đổi mật khẩu thành công! Đăng nhập lại để tiếp tục.')
        setTimeout(() => navigate('/login'), 800)
      }
    } catch (e) {
      setErr(e?.message || 'Lỗi hệ thống')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingSession) return <PageLoader text="Kiểm tra session..." />

  if (!validSession && !user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-navy-50 px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4 animate-fade-in">
          <div className="text-6xl">⏰</div>
          <h1 className="text-xl font-bold text-slate-800">Link không hợp lệ hoặc đã hết hạn</h1>
          <p className="text-sm text-slate-600">
            Vui lòng yêu cầu khôi phục lại mật khẩu lần nữa.
          </p>
          <Link to="/forgot-password">
            <Button variant="primary" className="w-full mt-4">
              Quên mật khẩu
            </Button>
          </Link>
          <Link to="/login" className="block text-primary-600 text-sm hover:underline">
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-navy-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in">
        <div className="relative bg-gradient-to-r from-primary-700 to-primary-900 px-8 py-8 text-white text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
            🔐
          </div>
          <h1 className="text-xl font-bold">Đặt lại mật khẩu</h1>
          <p className="text-sm text-white/80 mt-1">Vui lòng nhập mật khẩu mới của bạn</p>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-5">
          {err && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              ⚠️ {err}
            </div>
          )}

          <Input
            label="Mật khẩu mới"
            type="password"
            placeholder="Tối thiểu 6 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label="Xác nhận mật khẩu"
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={submitting}
            icon={submitting ? <Spinner size="sm" className="text-white" /> : undefined}
          >
            {submitting ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
          </Button>

          <div className="text-center text-sm text-slate-600">
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Quay lại đăng nhập
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
