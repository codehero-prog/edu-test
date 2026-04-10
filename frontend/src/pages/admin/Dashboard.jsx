import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import StatsModal from '../../components/StatsModal'
import { cn, formatDate, statusColors, statusLabels } from '../../lib/utils'
import api from '../../lib/api'
import { Users, GraduationCap, FileText, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { PageLoader } from '../../components/Spinner'

function StatBox({ label, value, icon: Icon, color, bg, onClick }) {
  return (
    <button onClick={onClick}
      className="card p-5 text-left hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 cursor-pointer w-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value ?? 0}</p>
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', bg)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
      </div>
    </button>
  )
}

export default function AdminDashboard() {
  const [stats, setStats]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)
  const [modalData, setModalData] = useState([])
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(({ data }) => setStats(data.data.stats))
      .finally(() => setLoading(false))
  }, [])

  const openModal = async (type) => {
    setModal(type)
    setModalLoading(true)
    try {
      if (type === 'teachers') {
        const { data } = await api.get('/admin/teachers?limit=100')
        setModalData(data.data.teachers)
      } else if (type === 'students') {
        const { data } = await api.get('/admin/students?limit=100')
        setModalData(data.data.students)
      } else if (type === 'submissions') {
        const { data } = await api.get('/admin/students?limit=100')
        setModalData(data.data.students)
      } else if (type === 'graded') {
        const { data } = await api.get('/admin/students?limit=100')
        setModalData(data.data.students)
      }
    } finally { setModalLoading(false) }
  }

  if (loading) return <DashboardLayout title="Admin Dashboard"><PageLoader /></DashboardLayout>

  if (!stats) return (
    <DashboardLayout title="Admin Dashboard">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-slate-600 font-medium">Ma'lumotlar yuklanmadi</p>
        <p className="text-slate-400 text-sm mt-1">Sahifani yangilang yoki qayta kiring</p>
        <button onClick={() => window.location.reload()} className="mt-4 btn-primary px-6 py-2">Yangilash</button>
      </div>
    </DashboardLayout>
  )

  const modalTitles = {
    teachers:    "O'qituvchilar ro'yxati",
    students:    "Talabalar ro'yxati",
    submissions: "Jami Ishlar",
    graded:      "Baholangan Ishlar",
  }

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="space-y-5 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatBox label="O'qituvchilar"  value={stats.totalTeachers}
            icon={Users}         color="text-purple-600" bg="bg-purple-50"
            onClick={() => openModal('teachers')} />
          <StatBox label="Talabalar"      value={stats.totalStudents}
            icon={GraduationCap} color="text-blue-600"   bg="bg-blue-50"
            onClick={() => openModal('students')} />
          <StatBox label="Jami Ishlar"    value={stats.totalSubmissions}
            icon={FileText}      color="text-slate-600"  bg="bg-slate-100"
            onClick={() => openModal('submissions')} />
          <StatBox label="Baholangan"     value={stats.totalGradedSubmissions}
            icon={CheckCircle}   color="text-emerald-600" bg="bg-emerald-50"
            onClick={() => openModal('graded')} />
        </div>
      </div>

      <StatsModal
        isOpen={!!modal}
        onClose={() => { setModal(null); setModalData([]) }}
        title={modalTitles[modal] || ''}
        loading={modalLoading}
      >
        {modal === 'teachers' && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {modalData.length === 0 ? <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
            : modalData.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-700 font-bold text-sm">{t.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.email}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {(t.groups || []).map(g => (
                    <span key={g} className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">{g}</span>
                  ))}
                  <span className={cn('badge text-xs', t.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                    {t.isActive ? 'Faol' : 'Blok'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {modal === 'students' && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {modalData.length === 0 ? <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
            : modalData.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-xs">{s.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.email}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  {s.group && <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">{s.group}</span>}
                  <span className="badge bg-slate-100 text-slate-600 border-slate-200 text-xs">{s._count?.submissions ?? 0} ish</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </StatsModal>
    </DashboardLayout>
  )
}
