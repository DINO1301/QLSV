import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import { Spinner } from '../components/UI/Skeleton'

export default function ForgotPassword() {
  const { forgotPassword } = useAuth()
  const { showError, showSuccess } = useToast()

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!email.trim()) return setErr('Vui lòng nhập email')
    setSubmitting(true)
    try {
      const res = await forgotPassword(email)
      if (!res.success) {
        setErr(res.error?.message || 'Gửi yêu cầu thất bại')
        showError(res.error?.message || 'Gửi yêu cầu thất bại')
      } else {
        showSuccess('Đã gửi link khôi phục mật khẩu vào email của bạn!')
        setDone(true)
      }
    } catch (e) {
      setErr(e?.message || 'Lỗi hệ thống')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-navy-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in">
        <div className="relative bg-gradient-to-r from-primary-700 to-primary-900 px-8 py-8 text-white text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
            🔑
          </div>
          <h1 className="text-xl font-bold">Khôi phục mật khẩu</h1>
          <p className="text-sm text-white/80 mt-1">Nhập email để nhận link đặt lại mật khẩu</p>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-5">
          {done ? (
            <div className="space-y-5">
              <div className="p-4 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
                <p className="font-medium mb-1">✉️ Email đã được gửi!</p>
                <p className="text-green-700 leading-relaxed">
                  Vui lòng kiểm tra hộp thư của <b>{email}</b> và nhấp vào link được cung cấp để đặt lại mật khẩu.
                  Nếu không nhận được, hãy kiểm tra thư mục Spam.
                </p>
              </div>
              <Link to="/login">
                <Button variant="primary" className="w-full">
                  Quay lại trang đăng nhập
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {err && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                  ⚠️ {err}
                </div>
              )}

              <Input
                label="Email của bạn"
                type="email"
                placeholder="nhập email đã đăng ký"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={submitting}
                icon={submitting ? <Spinner size="sm" className="text-white" /> : undefined}
              >
                {submitting ? 'Đang gửi...' : 'Gửi link khôi phục'}
              </Button>

              <div className="text-center text-sm text-slate-600">
                Đã nhớ mật khẩu?{' '}
                <Link to="/login" className="text-primary-600 font-medium hover:underline">
                  Đăng nhập
                </Link>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
