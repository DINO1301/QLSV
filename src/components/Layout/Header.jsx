import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../utils/helpers'

const titleMap = {
  '/':              { title: 'Dashboard',            desc: 'Tổng quan hệ thống' },
  '/classes':       { title: 'Quản lý lớp',          desc: 'Danh sách lớp học' },
  '/warnings':      { title: 'Cảnh báo sinh viên',   desc: 'Sinh viên cần lưu ý' },
  '/import-excel':  { title: 'Import Excel',         desc: 'Thêm sinh viên từ file Excel' },
  '/activity-logs': { title: 'Lịch sử chỉnh sửa',    desc: 'Nhật ký hoạt động' },
  '/users':         { title: 'Quản lý tài khoản',    desc: 'Người dùng & phân quyền' },
  '/settings':      { title: 'Cài đặt',              desc: 'Tùy chỉnh hệ thống' },
}

export default function Header({ collapsed }) {
  const { profile, isAdmin } = useAuth()
  const { pathname } = useLocation()

  let pageInfo = null
  // Xử lý đặc biệt cho route params /classes/:id/students
  if (pathname.startsWith('/classes/') && pathname.endsWith('/students')) {
    pageInfo = { title: 'Danh sách sinh viên', desc: 'Quản lý dữ liệu chi tiết theo lớp' }
  } else {
    pageInfo = titleMap[pathname] || { title: 'Trang', desc: '' }
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="hidden md:flex flex-col">
          <h1 className="text-lg font-bold text-slate-800 leading-tight">{pageInfo?.title}</h1>
          <p className="text-xs text-slate-500 leading-tight">{pageInfo?.desc}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs text-slate-600">
          <span className={cn('w-2 h-2 rounded-full', isAdmin ? 'bg-red-500' : 'bg-green-500')} />
          {isAdmin ? 'Quản trị viên' : 'Người dùng'}
        </div>

        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-semibold shadow-md">
            {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || '?'}
          </div>
          <div className="hidden md:flex flex-col">
            <div className="text-sm font-semibold text-slate-800 leading-tight">
              {profile?.full_name || profile?.username}
            </div>
            <div className="text-xs text-slate-500 leading-tight truncate max-w-[200px]">
              {profile?.email}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
