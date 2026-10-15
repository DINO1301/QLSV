import { cn } from '../../utils/helpers'

export default function Card({ children, className = '', title, actions, padding = 'p-6' }) {
  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          {title && <h3 className="text-base font-semibold text-slate-800">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padding}>{children}</div>
    </div>
  )
}
