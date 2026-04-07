import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import StatCard from '../../components/StatCard'
import { cn, formatDate, statusColors, statusLabels } from '../../lib/utils'
import api from '../../lib/api'
import { Users, GraduationCap, FileText, CheckCircle, TrendingUp, Clock, BookOpen } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PageLoader } from '../../components/Spinner'

const GRADE_COLORS = ['#ef4444', '#eab308', '#3b82f6', '#10b981']

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(({ data }) => setStats(data.data.stats))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLayout title="Administrator paneli"><PageLoader /></DashboardLayout>

  const chartData = stats ? [
    { name: "2", label: "Qoniqarsiz", count: stats.gradeDistribution?.[2] || 0 },
    { name: "3", label: "Qoniqarli", count: stats.gradeDistribution?.[3] || 0 },
    { name: "4", label: "Yaxshi", count: stats.gradeDistribution?.[4] || 0 },
    { name: "5", label: "A'lo", count: stats.gradeDistribution?.[5] || 0 },
  ] : []

  return (
    <DashboardLayout title="Administrator paneli">
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="O'qituvchilar" value={stats.totalTeachers} icon={Users} iconColor="text-purple-600" iconBg="bg-purple-50" />
          <StatCard title="Talabalar" value={stats.totalStudents} icon={GraduationCap} iconColor="text-blue-600" iconBg="bg-blue-50" />
          <StatCard title="Jami Ishlar" value={stats.totalSubmissions} icon={FileText} iconColor="text-slate-600" iconBg="bg-slate-100" />
          <StatCard title="Baholangan" value={stats.totalGradedSubmissions} icon={CheckCircle} iconColor="text-emerald-600" iconBg="bg-emerald-50"
            subtitle={`Kutilmoqda: ${stats.pendingSubmissions}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Baholar chart */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-500" /> Baholar
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={GRADE_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fanlar */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-amber-500" /> Fanlar bo'yicha
            </h2>
            {!stats.subjects?.length ? (
              <p className="text-slate-400 text-sm text-center py-8">Hali o'qituvchilar yo'q</p>
            ) : (
              <div className="space-y-2">
                {stats.subjects.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-800 truncate">📚 {s.name}</span>
                    <span className="badge bg-amber-50 text-amber-700 border-amber-200 text-xs ml-2 flex-shrink-0">
                      {s.count} ta
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Oxirgi yuklamalar */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-primary-500" /> Oxirgi Yuklamalar
            </h2>
            <div className="space-y-2.5">
              {!stats.recentSubmissions?.length
                ? <p className="text-slate-400 text-sm text-center py-6">Hali ishlar yo'q</p>
                : stats.recentSubmissions.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 truncate">{s.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.student?.name}
                        {s.student?.group && <span className="text-indigo-500 ml-1">({s.student.group})</span>}
                      </p>
                    </div>
                    <span className={cn('badge text-xs flex-shrink-0', statusColors[s.status])}>
                      {statusLabels[s.status]}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
