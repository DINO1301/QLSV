import { cn } from '../../utils/helpers'

export default function Select({
  label,
  error,
  options = [],
  className = '',
  wrapperClass = '',
  placeholder = '-- Chọn --',
  value,
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
      <select
        id={inputId}
        value={value}
        className={cn(
          'w-full px-3 py-2 border rounded-md text-sm bg-white text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          error ? 'border-red-400' : 'border-slate-300',
          className
        )}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
