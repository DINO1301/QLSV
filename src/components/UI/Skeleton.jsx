import { cn } from '../../utils/helpers'

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <svg
      className={cn('animate-spin-slow text-primary-600', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export function PageLoader({ text = 'Đang tải...' }) {
  return (
    <div className="min-h-[300px] flex flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <div className="text-sm text-slate-500">{text}</div>
    </div>
  )
}

/** Skeleton đơn giản */
export function Skeleton({ className = '' }) {
  return (
    <div className={cn('animate-pulse bg-slate-200 rounded-md', className)} />
  )
}

export function EmptyState({ text = 'Chưa có dữ liệu', icon = '📭', action }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
      <div className="text-5xl">{icon}</div>
      <div className="text-sm font-medium">{text}</div>
      {action}
    </div>
  )
}

export function Badge({ children, className = '', variant = 'default' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-green-100 text-green-700',
    danger: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      variants[variant], className
    )}>
      {children}
    </span>
  )
}
