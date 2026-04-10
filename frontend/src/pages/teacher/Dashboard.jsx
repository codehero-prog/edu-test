import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { GraduationCap, FileText, CheckCircle, Clock, BookOpen, AlertCircle } from 'lucide-react'
import { PageLoader } from '../../components/Spinner'

function StatBox({ label, value, sub, icon: Icon, color, bg, onClick }) {
  return (
    <button onClick={onClick}
      className="card p-4 text-left hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer w-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{value ?? 0}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
      </div>
    </button>
  )
}

export default function TeacherDashboard() {
  const navigate      = useNavigate()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/teacher/dashboard')
      .then(({ data }) => setStats(data.data.stats))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLayout title="O'qituvchi Paneli"><PageLoader /></DashboardLayout>

  if (!stats) return (
    <DashboardLayout title="O'qituvchi Paneli">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-slate-600 font-medium">Ma'lumotlar yuklanmadi</p>
        <p className="text-slate-400 text-sm mt-1">Sahifani yangilang yoki qayta kiring</p>
        <button onClick={() => window.location.reload()} className="mt-4 btn-primary px-6 py-2">Yangilash</button>
      </div>
    </DashboardLayout>
  )

  const totalGroups = stats.groupStats?.length || 0

  return (
    <DashboardLayout title="O'qituvchi Paneli">
      <div className="space-y-5 pb-6">
        {/* Subject + Groups */}
        {stats.subject && (
          <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-indigo-900">{stats.subject}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(stats.groups || []).map(g => (
                <span key={g} className="badge bg-indigo-100 text-indigo-700 border-indigo-300 font-bold">{g}</span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Guruhlar soni"    value={totalGroups}
            icon={BookOpen}      color="text-indigo-600"  bg="bg-indigo-50"
            onClick={() => navigate('/teacher/groups')} />
          <StatBox label="Talabalar"        value={stats.totalStudents}
            icon={GraduationCap} color="text-blue-600"   bg="bg-blue-50"
            onClick={() => navigate('/teacher/students')} />
          <StatBox label="Topshirganlar"    value={stats.gradedSubmissions}
            icon={CheckCircle}   color="text-emerald-600" bg="bg-emerald-50"
            sub={`${stats.totalSubmissions} ta jami`}
            onClick={() => navigate('/teacher/groups')} />
          <StatBox label="Topshirmaganlar"  value={stats.pendingSubmissions}
            icon={Clock}         color="text-yellow-600"  bg="bg-yellow-50"
            onClick={() => navigate('/teacher/groups')} />
        </div>
      </div>
    </DashboardLayout>
  )
}
