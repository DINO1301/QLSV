import { createContext, useContext, useState, useCallback } from 'react'
import { uid } from '../utils/helpers'

const ToastContext = createContext(null)

/**
 * Toast đơn giản, hiển thị góc dưới bên phải
 * Sử dụng: const { showToast } = useToast();
 *          showToast('Đã lưu', 'success');
 *          showToast('Lỗi', 'error');
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((curr) => curr.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = uid('toast')
    setToasts((curr) => [
      ...curr,
      { id, message, type, created: Date.now() },
    ])
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }, [removeToast])

  const showSuccess = useCallback((msg, dur) => showToast(msg, 'success', dur), [showToast])
  const showError   = useCallback((msg, dur) => showToast(msg, 'error', dur), [showToast])
  const showWarning = useCallback((msg, dur) => showToast(msg, 'warning', dur), [showToast])
  const showInfo    = useCallback((msg, dur) => showToast(msg, 'info', dur), [showToast])

  return (
    <ToastContext.Provider value={{
      toasts,
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      removeToast,
    }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

const typeStyles = {
  success: { bar: 'bg-green-500', text: 'text-green-800', bg: 'bg-green-50 border-green-200', icon: '✓' },
  error:   { bar: 'bg-red-500',   text: 'text-red-800',   bg: 'bg-red-50 border-red-200',     icon: '✕' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50 border-amber-200', icon: '!' },
  info:    { bar: 'bg-blue-500',  text: 'text-blue-800',  bg: 'bg-blue-50 border-blue-200',   icon: 'ⓘ' },
}

function ToastContainer({ toasts, onClose }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-[360px] w-full pointer-events-none">
      {toasts.map((t) => {
        const s = typeStyles[t.type] || typeStyles.info
        return (
          <div
            key={t.id}
            className={`pointer-events-auto overflow-hidden rounded-lg shadow-lg border animate-fade-in ${s.bg}`}
          >
            <div className={`w-1.5 h-full absolute left-0 top-0 ${s.bar}`} />
            <div className="flex items-start gap-3 p-4 pl-5">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full ${s.bar} text-white flex items-center justify-center text-sm font-bold`}>
                {s.icon}
              </div>
              <div className={`flex-1 text-sm font-medium ${s.text}`}>{t.message}</div>
              <button
                onClick={() => onClose(t.id)}
                className={`flex-shrink-0 ${s.text} hover:opacity-70 text-lg leading-none`}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải được dùng trong ToastProvider')
  return ctx
}
