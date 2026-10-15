import { cn } from '../../utils/helpers'

export default function Input({
  label,
  error,
  className = '',
  wrapperClass = '',
  id,
  ...rest
}) {
  const inputId = id || rest.name
  return (
    <div className={cn('flex flex-col gap-1', wrapperClass)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-3 py-2 border rounded-md text-sm text-slate-900 placeholder:text-slate-400',
          'bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          error ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-slate-300',
          className
        )}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
