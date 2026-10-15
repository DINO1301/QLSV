import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Card from '../components/UI/Card'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import { PageLoader } from '../components/UI/Skeleton'
import { supabase } from '../services/supabaseClient'
import { updateUserProfile } from '../services/userService'

export default function Settings() {
  const { profile, isAdmin, refreshSession } = useAuth()
  const { showSuccess, showError } = useToast()

  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    username: profile?.username || '',
    email: profile?.email || '',
  })
  const [passwordForm, setPasswordForm] = useState({ old: '', new1: '', new2: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      // Update auth email nếu đổi email
      if (profileForm.email !== profile?.email) {
        const { error } = await supabase.auth.updateUser({ email: profileForm.email })
        if (error) throw error
      }
      // Update profile
      await updateUserProfile(profile.id, {
        full_name: profileForm.full_name.trim(),
        username: profileForm.username.trim(),
        email: profileForm.email.trim(),
      })
      showSuccess('Cập nhật thông tin thành công')
      await refreshSession()
    } catch (e) {
      showError(e.message || 'Cập nhật thất bại')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    const e = {}
    if (!passwordForm.old) e.old = 'Nhập mật khẩu cũ'
    if (passwordForm.new1.length < 6) e.new1 = 'Mật khẩu mới ít nhất 6 ký tự'
    if (passwordForm.new1 !== passwordForm.new2) e.new2 = 'Xác nhận không khớp'
    if (Object.keys(e).length) {
      showError(e[Object.keys(e)[0]])
      return
    }
    setChangingPw(true)
    try {
      // Verify mật khẩu cũ (cách: signIn với mật khẩu cũ)
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordForm.old,
      })
      if (signErr) throw new Error('Mật khẩu cũ không đúng')
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new1 })
      if (error) throw error
      showSuccess('Đổi mật khẩu thành công')
      setPasswordForm({ old: '', new1: '', new2: '' })
    } catch (e) {
      showError(e.message || 'Đổi mật khẩu thất bại')
    } finally { setChangingPw(false) }
  }

  if (!profile) return <PageLoader />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <Card title="👤 Hồ sơ cá nhân">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <Input label="Họ và tên" value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} />
            <Input label="Username" value={profileForm.username} onChange={(e) => setProfileForm({...profileForm, username: e.target.value})} />
            <Input wrapperClass="sm:col-span-2" label="Email" type="email" value={profileForm.email} onChange={(e) => setProfileForm({...profileForm, email: e.target.value})} />
          </div>
          <div className="mt-5">
            <Button variant="primary" onClick={saveProfile} disabled={savingProfile}>
              💾 {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </Card>

        <Card title="🔐 Đổi mật khẩu">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <Input wrapperClass="sm:col-span-2" label="Mật khẩu hiện tại" type="password"
                   value={passwordForm.old} onChange={(e) => setPasswordForm({...passwordForm, old: e.target.value})} />
            <Input label="Mật khẩu mới" type="password"
                   value={passwordForm.new1} onChange={(e) => setPasswordForm({...passwordForm, new1: e.target.value})} />
            <Input label="Xác nhận mật khẩu mới" type="password"
                   value={passwordForm.new2} onChange={(e) => setPasswordForm({...passwordForm, new2: e.target.value})} />
          </div>
          <div className="mt-5">
            <Button variant="primary" onClick={changePassword} disabled={changingPw}>
              🔑 {changingPw ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="ℹ️ Thông tin tài khoản">
          <div className="space-y-3 text-sm">
            <InfoRow label="Vai trò" value={
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isAdmin ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'}`}>
                {isAdmin ? 'Quản trị viên' : 'Người dùng'}
              </span>
            } />
            <InfoRow label="ID" value={<code className="text-xs bg-slate-100 px-2 py-0.5 rounded break-all">{profile.id}</code>} />
            <InfoRow label="Ngày tạo" value={new Date(profile.created_at).toLocaleString('vi-VN')} />
          </div>
        </Card>

        <Card title="🛠️ Hướng dẫn cấu hình Supabase">
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
            <li>Đăng ký Supabase & tạo project mới</li>
            <li>Mở SQL Editor, chạy 4 file trong thư mục <code className="bg-slate-100 px-1 rounded">supabase/*.sql</code> theo thứ tự</li>
            <li>Sao chép <b>Project URL</b> và <b>anon public key</b> → dán vào file <code className="bg-slate-100 px-1 rounded">.env</code></li>
            <li>Tắt "Enable email confirmations" trong Authentication → Settings để tạo user nhanh</li>
            <li>Đăng ký user đầu tiên sẽ tự động là <b>ADMIN</b></li>
          </ol>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-3 border-b border-slate-100 pb-2">
      <span className="text-xs uppercase font-semibold text-slate-500 pt-1 shrink-0">{label}</span>
      <span className="text-right text-slate-800">{value}</span>
    </div>
  )
}
