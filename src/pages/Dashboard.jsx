import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { countAllStudents, getWarningStats, getAllStudentsWithAllCustomColumns } from '../services/studentService'
import { getAllClasses, getClassStudentCounts } from '../services/classService'
import { getAllUsers } from '../services/userService'
import Card from '../components/UI/Card'
import { PageLoader, Skeleton, Badge } from '../components/UI/Skeleton'
import Button from '../components/UI/Button'
import { WARNING_LABELS } from '../utils/constants'
import { Bar } from 'react-chartjs-2'
import GlobalStudentTable from '../components/DataTable/GlobalStudentTable'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function StatCard({ title, value, icon, color = 'primary', footer, loading }) {
  const colors = {
    primary:  'from-primary-500 to-primary-700',
    success:  'from-green-500 to-green-700',
    warning:  'from-amber-500 to-amber-700',
    danger:   'from-red-500 to-red-700',
    navy:     'from-navy-700 to-navy-900',
  }
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{title}</p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-24" />
          ) : (
            <p className="text-3xl font-extrabold text-slate-800 mt-1">{value}</p>
          )}
          {footer && <div className="mt-3">{footer}</div>}
        </div>
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors[color]} text-white flex items-center justify-center text-2xl shadow-md`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const { isAdmin, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [classList, setClassList] = useState([])
  const [studentCount, setStudentCount] = useState(0)
  const [warning, setWarning] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 })
  const [userCount, setUserCount] = useState(0)
  const [error, setError] = useState('')
  const [globalStudents, setGlobalStudents] = useState([])
  const [globalColumns, setGlobalColumns] = useState([])
  const [tableLoading, setTableLoading] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [classes, counts, wStats, students, users] = await Promise.allSettled([
        getAllClasses(),
        getClassStudentCounts(),
        getWarningStats(),
        countAllStudents(),
        isAdmin ? getAllUsers() : Promise.resolve([]),
      ])

      const getVal = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback
      setClassList(getVal(counts, []))
      setStudentCount(getVal(students, 0))
      setWarning(getVal(wStats, { 0: 0, 1: 0, 2: 0, 3: 0 }))
      setUserCount(getVal(users, []).length)
      
      // Load table data separately if needed, or here
      await loadTableData()
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const loadTableData = async () => {
    setTableLoading(true)
    try {
      const { students, columns } = await getAllStudentsWithAllCustomColumns()
      setGlobalStudents(students)
      setGlobalColumns(columns)
    } catch (e) {
      console.error(e)
    } finally {
      setTableLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [isAdmin])

  const chartData = useMemo(() => {
    const labels = classList.map((c) => c.class_name)
    const data   = classList.map((c) => c.student_count || 0)
    return {
      labels,
      datasets: [{
        label: 'Số sinh viên',
        data,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(37, 99, 235)',
        borderWidth: 1,
        borderRadius: 6,
      }],
    }
  }, [classList])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title:  { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  }

  if (loading) return <PageLoader text="Đang tải Dashboard..." />

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          ⚠️ {error}. Có thể do bạn chưa kết nối Supabase hoặc chưa chạy SQL.
        </div>
      )}

      {/* Chào mừng */}
      <Card className="bg-gradient-to-r from-primary-700 via-primary-800 to-navy-800 text-white border-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/70 mb-1">Xin chào</p>
            <h2 className="text-2xl font-bold">{profile?.full_name || profile?.username} 👋</h2>
            <p className="text-sm text-white/80 mt-1">
              {isAdmin ? 'Bạn có toàn quyền quản lý hệ thống.' : 'Bạn có thể xem các lớp đã được cấp quyền.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/classes">
              <Button variant="secondary" size="md" className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                📚 Quản lý lớp
              </Button>
            </Link>
            <Link to="/warnings">
              <Button variant="warning" size="md">
                ⚠️ Cảnh báo ({warning[1] + warning[2] + warning[3]})
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Tổng quan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Tổng số lớp" value={classList.length} icon="🏫" color="navy" loading={loading} />
        <StatCard title="Tổng số sinh viên" value={studentCount} icon="👨‍🎓" color="primary" loading={loading} />
        <StatCard
          title="Cảnh báo CB2 + CB3"
          value={warning[2] + warning[3]}
          icon="🚨"
          color="danger"
          loading={loading}
          footer={
            <div className="flex flex-wrap gap-1 text-xs">
              <Badge variant="success">CB1 {warning[1]}</Badge>
              <Badge variant="warning">CB2 {warning[2]}</Badge>
              <Badge variant="danger">CB3 {warning[3]}</Badge>
            </div>
          }
        />
        {isAdmin ? (
          <StatCard title="Số tài khoản" value={userCount} icon="👥" color="success" loading={loading} />
        ) : (
          <StatCard
            title="Sinh viên bình thường"
            value={warning[0]}
            icon="✅"
            color="success"
            loading={loading}
          />
        )}
      </div>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Thống kê sinh viên theo lớp" className="lg:col-span-2">
          <div className="h-[320px]">
            {classList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Chưa có dữ liệu lớp học
              </div>
            ) : (
              <Bar data={chartData} options={chartOptions} />
            )}
          </div>
        </Card>

        <Card
          title="Cảnh báo theo cấp độ"
          actions={
            <Link to="/warnings">
              <Button variant="ghost" size="sm">Xem chi tiết →</Button>
            </Link>
          }
        >
          <div className="space-y-4">
            {[3, 2, 1, 0].map((lvl) => {
              const meta = WARNING_LABELS[lvl]
              const count = warning[lvl] || 0
              const total = Object.values(warning).reduce((a, b) => a + b, 0) || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={lvl}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                      <span className="text-slate-700 font-medium">{meta.text}</span>
                    </div>
                    <span className="font-semibold text-slate-800">{count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${meta.dot} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Lớp học gần đây */}
      <Card
        title="Danh sách lớp học"
        actions={
          <Link to="/classes">
            <Button variant="primary" size="sm">📚 Xem tất cả</Button>
          </Link>
        }
      >
        {classList.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            Chưa có lớp học. {isAdmin && 'Nhấn "Quản lý lớp" để tạo lớp mới.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3 font-semibold">Lớp</th>
                  <th className="py-3 px-3 font-semibold text-center">Số sinh viên</th>
                  <th className="py-3 px-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {classList.slice(0, 6).map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">{c.class_name}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant="primary">{c.student_count}</Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link to={`/classes/${c.id}/students`}>
                        <Button variant="ghost" size="sm">Xem chi tiết →</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quản lý sinh viên tổng hợp */}
      <Card title="Quản lý sinh viên (Tất cả các lớp)">
        {tableLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Đang tải danh sách sinh viên tổng hợp...</p>
          </div>
        ) : (
          <GlobalStudentTable
            students={globalStudents}
            columns={globalColumns}
            canEdit={isAdmin} // Chỉ Admin được sửa ở Dashboard global hoặc tùy phân quyền
            onChanged={(signal) => {
              if (signal === 'delete' || signal === 'update') {
                // Có thể reload stats nếu cần
                loadAll()
              }
            }}
          />
        )}
      </Card>
    </div>
  )
}
