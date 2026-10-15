import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { cn } from '../../utils/helpers'
import Button from '../UI/Button'
import { ConfirmDialog } from '../UI/Modal'
import { useState } from 'react'

const menuAdmin = [
  { to: '/',                label: 'Dashboard',        icon: '📊',  adminOnly: false },
  { to: '/classes',         label: 'Quản lý lớp',      icon: '🏫',  adminOnly: false },
  { to: '/warnings',        label: 'Cảnh báo sinh viên', icon: '⚠️', adminOnly: false },
  { to: '/import-excel',    label: 'Import Excel',     icon: '📥',  adminOnly: false },
  { to: '/activity-logs',   label: 'Lịch sử chỉnh sửa', icon: '📜',  adminOnly: false },
  { to: '/users',           label: 'Quản lý tài khoản', icon: '👥',  adminOnly: true },
  { to: '/settings',        label: 'Cài đặt',          icon: '⚙️',  adminOnly: false },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { profile, isAdmin, logout } = useAuth()
  const { showSuccess } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const doLogout = async () => {
    await logout()
    showSuccess('Đăng xuất thành công')
    setConfirmLogout(false)
    navigate('/login', { replace: true })
  }

  const filteredMenu = menuAdmin.filter((m) => !m.adminOnly || isAdmin)

  return (
    <>
      <aside
        className={cn(
          'h-screen sticky top-0 bg-navy-900 text-white transition-all duration-300 flex flex-col',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-16 flex items-center gap-3 px-5 border-b border-white/10',
          collapsed && 'justify-center px-0'
        )}>
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-xl flex-shrink-0 shadow-lg shadow-primary-900/50">
            🎓
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-base font-bold leading-tight truncate">QLSV</div>
              <div className="text-[11px] text-white/50 truncate">Student Manager</div>
            </div>
          )}
        </div>

        {/* User Mini Info */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-sm font-bold">
                {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{profile?.full_name || profile?.username}</div>
                <div className="text-[11px] text-white/50">
                  {isAdmin ? 'Quản trị viên' : 'Người dùng'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredMenu.map((item) => {
            const active =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                    : 'text-white/75 hover:bg-white/10 hover:text-white',
                  collapsed && 'justify-center px-0 py-3'
                )}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer: Logout + Collapse */}
        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            onClick={() => setConfirmLogout(true)}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors',
              collapsed && 'justify-center px-0 py-3'
            )}
            title={collapsed ? 'Đăng xuất' : undefined}
          >
            <span className="text-lg">🚪</span>
            {!collapsed && <span>Đăng xuất</span>}
          </button>

          <button
            onClick={onToggle}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            <span className="text-base">{collapsed ? '➡️' : '⬅️'}</span>
            {!collapsed && <span>Thu gọn thanh menu</span>}
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất không?"
        confirmText="Đăng xuất"
        confirmVariant="danger"
        onConfirm={doLogout}
      />
    </>
  )
}
