import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './ProtectedRoute'
import MainLayout from './components/Layout/MainLayout'

import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Classes from './pages/Classes'
import Students from './pages/Students'
import Warnings from './pages/Warnings'
import ImportExcel from './pages/ImportExcel'
import ActivityLogs from './pages/ActivityLogs'
import Users from './pages/Users'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes (tất cả đều đăng nhập được vào) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout><Dashboard /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/classes"
              element={
                <ProtectedRoute>
                  <MainLayout><Classes /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/classes/:classId/students"
              element={
                <ProtectedRoute>
                  <MainLayout><Students /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/warnings"
              element={
                <ProtectedRoute>
                  <MainLayout><Warnings /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import-excel"
              element={
                <ProtectedRoute>
                  <MainLayout><ImportExcel /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity-logs"
              element={
                <ProtectedRoute>
                  <MainLayout><ActivityLogs /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <MainLayout><Settings /></MainLayout>
                </ProtectedRoute>
              }
            />
            {/* Admin-only: Quản lý tài khoản */}
            <Route
              path="/users"
              element={
                <ProtectedRoute adminOnly>
                  <MainLayout><Users /></MainLayout>
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
                  <div className="text-7xl mb-4">🔍</div>
                  <h1 className="text-2xl font-bold text-slate-800 mb-2">404 - Trang không tồn tại</h1>
                  <a href="/" className="mt-4 inline-block text-primary-600 font-medium hover:underline">
                    ← Về trang chủ
                  </a>
                </div>
              }
            />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
