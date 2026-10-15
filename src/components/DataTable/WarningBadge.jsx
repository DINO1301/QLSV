import { WARNING_LABELS, WARNING_OPTIONS } from '../../utils/constants'
import { cn } from '../../utils/helpers'

/**
 * Badge hiển thị cấp độ cảnh báo
 */
export default function WarningBadge({ level, reason, size = 'sm' }) {
  const meta = WARNING_LABELS[level] || WARNING_LABELS[0]
  return (
    <span
      title={reason || meta.text}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium',
        size === 'sm' ? 'text-xs' : 'text-sm',
        meta.bg,
        meta.color
      )}
    >
      <span className={cn('w-2 h-2 rounded-full', meta.dot)} />
      {meta.text}
    </span>
  )
}

/**
 * AG Grid Cell Renderer cho cột cảnh báo (có thể inline edit)
 */
export function WarningCellRenderer(params) {
  if (params.value === undefined || params.value === null) return <span>-</span>
  const level = Number(params.value)
  return <WarningBadge level={level} reason={params.data?.warning_reason} />
}
