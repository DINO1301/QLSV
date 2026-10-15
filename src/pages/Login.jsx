import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import { Spinner } from '../components/UI/Skeleton'
import { cn } from '../utils/helpers'

export default function Login() {
  const { login, user, profile, loading } = useAuth()
  const { showError, showSuccess } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  // Nếu đã đăng nhập thì chuyển hướng
  useEffect(() => {
    if (user && profile && !loading) {
      navigate('/', { replace: true })
    }
  }, [user, profile, loading, navigate])

  const onSubmit = async (e) => {
    e.preventDefault()
    setErrMsg('')
    if (!email.trim()) return setErrMsg('Vui lòng nhập email')
    if (!password) return setErrMsg('Vui lòng nhập mật khẩu')

    setSubmitting(true)
    try {
      const res = await login(email, password)
      if (!res.success) {
        setErrMsg(res.error?.message || 'Đăng nhập thất bại')
        showError(res.error?.message || 'Đăng nhập thất bại')
      } else {
        showSuccess('Đăng nhập thành công!')
      }
    } catch (e) {
      showError(e?.message || 'Lỗi hệ thống')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-navy-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary-700 to-primary-900 px-8 py-10 text-white text-center">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_80%,white_0,transparent_40%)]" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-3xl">
              🎓
            </div>
            <h1 className="text-2xl font-bold text-shadow">HỆ THỐNG QUẢN LÝ SINH VIÊN</h1>
            <p className="text-sm text-white/80 mt-1">QLSV - Student Management System</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-8 space-y-5">
          <h2 className="text-lg font-semibold text-slate-800 text-center">
            Đăng nhập tài khoản
          </h2>

          {errMsg && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <span>⚠️</span>
              <span>{errMsg}</span>
            </div>
          )}

          <Input
            label="Email / Tên đăng nhập"
            type="text"
            placeholder="admin@qlsv.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Mật khẩu"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-slate-600">Ghi nhớ đăng nhập</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
            >
              Quên mật khẩu?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={submitting}
            icon={submitting ? <Spinner size="sm" className="text-white" /> : undefined}
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>

          <div className="text-xs text-center text-slate-500 border-t border-slate-100 pt-4">
            Hệ thống đang sử dụng Supabase Auth.<br />
            Đăng ký tài khoản đầu tiên sẽ được cấp quyền <b>ADMIN</b>.
          </div>
        </form>
      </div>
    </div>
  )
}
