import { useEffect } from 'react'
import Button from './Button'
import { cn } from '../../utils/helpers'

/**
 * Modal đơn giản dùng chung.
 * props: open, onClose, title, children, footer, size = 'sm'|'md'|'lg'|'xl'|'2xl'|'full'
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  showClose = true,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && open && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    full: 'max-w-[95vw]',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={() => closeOnBackdrop && onClose?.()}
    >
      <div
        className={cn(
          'w-full bg-white rounded-xl shadow-2xl my-auto border border-slate-200',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            {showClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Xác nhận hành động */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  message,
  confirmText = 'Đồng ý',
  cancelText = 'Hủy',
  confirmVariant = 'danger',
  loading,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      showClose={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang xử lý...' : confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{message}</p>
    </Modal>
  )
}
