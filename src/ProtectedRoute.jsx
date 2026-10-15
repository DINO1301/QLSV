import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { PageLoader } from './components/UI/Skeleton'

/**
 * ProtectedRoute: chỉ cho phép user đã đăng nhập đi qua.
 * Nếu chưa đăng nhập → redirect về /login.
 * @param {boolean} adminOnly - chỉ cho ADMIN đi qua
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, initializing, isAdmin } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <div className="min-h-screen">
        <PageLoader text="Đang kiểm tra đăng nhập..." />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace state={{ denied: true }} />
  }

  return children
}
