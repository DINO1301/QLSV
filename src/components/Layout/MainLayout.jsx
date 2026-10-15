import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '../../utils/helpers'

export default function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === '1'
    } catch { return false }
  })

  const toggle = () => {
    const v = !collapsed
    setCollapsed(v)
    try { localStorage.setItem('sidebar_collapsed', v ? '1' : '0') } catch {}
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header collapsed={collapsed} />
        <main className={cn(
          'flex-1 p-4 sm:p-6 lg:p-8 transition-all',
        )}>
          <div className="animate-fade-in">{children}</div>
        </main>
        <footer className="py-4 px-6 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
          © {new Date().getFullYear()} Hệ thống Quản lý Sinh viên QLSV · Powered by React + Supabase
        </footer>
      </div>
    </div>
  )
}
