import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import Modal from '../../components/Modal'
import GradeBadge from '../../components/GradeBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { cn, formatDate, statusColors, statusLabels, fileTypeIcons } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  BookOpen, Users, Plus, Calendar,
  ChevronRight, ChevronDown, Loader2, Eye, AlertCircle, Play,
  CheckCircle, XCircle, MessageSquare, Download, FileText, Trash2
} from 'lucide-react'

export default function TeacherGroups() {
  const { user } = useAuth()
  const [semesters, setSemesters]             = useState([])
  const [loading, setLoading]                 = useState(true)
  const [selectedGroup, setSelectedGroup]     = useState(null)
  const [groupStudents, setGroupStudents]     = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentLoading, setStudentLoading]   = useState(false)

  const [semModal, setSemModal]           = useState(false)
  // group, startDate — backend talab qiladi
  const [semForm, setSemForm]             = useState({
    name: '', group: '', startDate: '', deadline: ''
  })
  const [semSubmitting, setSemSubmitting] = useState(false)

  // Confirmlar
  const [extraConfirm, setExtraConfirm]   = useState(null) // { gradeReportId }
  const [deleteConfirm, setDeleteConfirm] = useState(null) // semester id

  const myGroups = user?.groups || []

  const fetchSemesters = () => {
    setLoading(true)
    api.get('/teacher/semesters')
      .then(({ data }) => setSemesters(data.data.semesters))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSemesters() }, [])

  const openGroup = async (group) => {
    setSelectedGroup(group)
    setStudentsLoading(true)
    try {
      const { data } = await api.get(`/teacher/students?group=${group}&limit=100`)
      setGroupStudents(data.data.students)
    } finally { setStudentsLoading(false) }
  }

  const openStudent = async (student) => {
    setStudentLoading(true)
    setSelectedStudent({ ...student, _loading: true })
    try {
      const { data } = await api.get(`/teacher/students/${student.id}`)
      setSelectedStudent(data.data.student)
    } finally { setStudentLoading(false) }
  }

  // Backend: POST /teacher/semesters — { name, group, startDate, deadline }
  const handleCreateSemester = async (e) => {
    e.preventDefault()
    setSemSubmitting(true)
    try {
      await api.post('/teacher/semesters', {
        name:      semForm.name,
        group:     semForm.group,
        startDate: new Date(semForm.startDate).toISOString(),
        deadline:  new Date(semForm.deadline).toISOString(),
      })
      toast.success('Semester boshlandi!')
      setSemModal(false)
      setSemForm({ name: '', group: '', startDate: '', deadline: '' })
      fetchSemesters()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Xatolik')
    } finally { setSemSubmitting(false) }
  }

  // Backend: DELETE /teacher/semesters/:id
  const handleDeleteSemester = async (id) => {
    try {
      await api.delete(`/teacher/semesters/${id}`)
      toast.success("Semester o'chirildi")
      fetchSemesters()
    } catch { toast.error('Xatolik') }
  }

  // Backend: PATCH /teacher/grade-reports/:gradeReportId/extra-chance
  const handleExtraAttempt = async (gradeReportId) => {
    try {
      await api.patch(`/teacher/grade-reports/${gradeReportId}/extra-chance`)
      toast.success('3-imkoniyat berildi!')
      if (selectedStudent) openStudent(selectedStudent)
    } catch { toast.error('Xatolik') }
  }

  // Guruhlar bo'yicha semesterlarni guruhlash — field: "group" (not "groupName")
  const groupedSemesters = myGroups.reduce((acc, g) => {
    acc[g] = semesters.filter(s => s.group === g)
    return acc
  }, {})

  const daysLeft = (deadline) => {
    const diff = new Date(deadline) - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const openSemModalForGroup = (group) => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 16) // datetime-local format
    setSemForm({ name: '', group, startDate: todayStr, deadline: '' })
    setSemModal(true)
  }

  return (
    <DashboardLayout title="Guruhlar">
      <div className="space-y-4 pb-6">
        <div className="flex justify-end">
          <button
            onClick={() => {
              setSemForm({ name: '', group: '', startDate: '', deadline: '' })
              setSemModal(true)
            }}
            className="btn-primary">
            <Plus size={16} /> Semester Yaratish
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : myGroups.length === 0 ? (
          <div className="card p-10 text-center text-slate-400 text-sm">Guruhlar topilmadi</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myGroups.map(group => {
              const groupSems = groupedSemesters[group] || []
              // isActive — boolean field (not status enum)
              const activeSem = groupSems.find(s => s.isActive === true)

              return (
                <div key={group} className="card overflow-hidden">
                  {/* Guruh header */}
                  <div className="bg-indigo-600 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-200" />
                        <span className="text-white font-bold text-lg">{group}</span>
                      </div>
                      <button onClick={() => openGroup(group)}
                        className="flex items-center gap-1.5 text-indigo-200 hover:text-white text-xs font-medium transition-colors">
                        <Users size={13} /> Talabalar <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* Faol semester deadline */}
                    {activeSem && (
                      <div className="mt-2 flex items-center gap-2 bg-indigo-700/50 rounded-xl px-3 py-2">
                        <Calendar size={13} className="text-indigo-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-indigo-100 text-xs font-medium truncate">{activeSem.name}</p>
                          <p className="text-indigo-300 text-xs">
                            Deadline: {formatDate(activeSem.deadline)}
                            {' '}
                            <span className={cn('font-semibold',
                              daysLeft(activeSem.deadline) <= 3 ? 'text-red-300' : 'text-emerald-300')}>
                              ({daysLeft(activeSem.deadline)} kun)
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Semester bo'limi */}
                  <div className="p-4 space-y-3">
                    {/* Faol semester yo'q bo'lsa — Boshlash tugmasi */}
                    {!activeSem && (
                      <button onClick={() => openSemModalForGroup(group)}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-sm py-3 rounded-xl transition-all">
                        <Play size={15} />
                        Semester Boshlash
                      </button>
                    )}

                    {groupSems.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">Hali semester yo'q</p>
                    ) : groupSems.map(sem => {
                      const days    = daysLeft(sem.deadline)
                      const expired = days < 0
                      return (
                        <div key={sem.id} className={cn('rounded-xl p-3 border',
                          sem.isActive
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50 opacity-70')}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-sm">{sem.name}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Calendar size={10} />
                                  {expired
                                    ? <span className="text-red-500 font-medium">Deadline o'tgan</span>
                                    : <span className={days <= 3 ? 'text-red-500 font-medium' : ''}>{days} kun qoldi</span>
                                  }
                                </span>
                                <span className={cn('badge text-xs',
                                  sem.isActive
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200')}>
                                  {sem.isActive ? 'Faol' : 'Nofaol'}
                                </span>
                              </div>
                            </div>
                            {/* O'chirish tugmasi */}
                            <button onClick={() => setDeleteConfirm(sem.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex-shrink-0 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Semester yaratish modali ─────────────────────────────────── */}
      <Modal isOpen={semModal} onClose={() => setSemModal(false)} title="Yangi Semester Yaratish">
        <form onSubmit={handleCreateSemester} className="space-y-3">
          <div>
            <label className="label">Semester nomi <span className="text-red-400">*</span></label>
            <input type="text" placeholder="2024-2025 Bahor semestri" required className="input"
              value={semForm.name} onChange={e => setSemForm({ ...semForm, name: e.target.value })} />
          </div>

          {/* group — backendda "group" field */}
          <div>
            <label className="label">Guruh <span className="text-red-400">*</span></label>
            <select required className="input"
              value={semForm.group} onChange={e => setSemForm({ ...semForm, group: e.target.value })}>
              <option value="">Guruh tanlang</option>
              {myGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* startDate — backendda majburiy */}
          <div>
            <label className="label">Boshlanish sanasi <span className="text-red-400">*</span></label>
            <input type="datetime-local" required className="input"
              value={semForm.startDate} onChange={e => setSemForm({ ...semForm, startDate: e.target.value })} />
          </div>

          <div>
            <label className="label">Deadline <span className="text-red-400">*</span></label>
            <input type="datetime-local" required className="input"
              value={semForm.deadline} onChange={e => setSemForm({ ...semForm, deadline: e.target.value })} />
          </div>

          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Deadline tugagandan keyin talabalar fayl yuklay olmaydi.
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={() => setSemModal(false)} className="btn-secondary flex-1">Bekor</button>
            <button type="submit" disabled={semSubmitting} className="btn-primary flex-1">
              {semSubmitting && <Loader2 size={14} className="animate-spin" />} Boshlash
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Guruh talabalari modali ──────────────────────────────────── */}
      <Modal isOpen={!!selectedGroup} onClose={() => { setSelectedGroup(null); setGroupStudents([]) }}
        title={`${selectedGroup} — Talabalar`} size="lg">
        {studentsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {groupStudents.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">Talabalar topilmadi</p>
            ) : groupStudents.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-xs">{s.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{s.name}</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <span className="badge bg-slate-100 text-slate-600 border-slate-200 text-xs">
                      {s._count?.submissions ?? 0} ish
                    </span>
                    {s.gradeReports?.[0] && <GradeBadge grade={s.gradeReports[0].gradeNumber} />}
                    <span className={cn('badge text-xs',
                      s.isActive
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200')}>
                      {s.isActive ? 'Faol' : 'Blok'}
                    </span>
                  </div>
                </div>
                <button onClick={() => openStudent(s)}
                  className="btn-icon bg-primary-50 text-primary-600 hover:bg-primary-100 flex-shrink-0">
                  <Eye size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Talaba tafsilot modali ───────────────────────────────────── */}
      <Modal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)}
        title="Talaba Ma'lumotlari" size="lg">
        {studentLoading || selectedStudent?._loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : selectedStudent && !selectedStudent._loading && (
          <div className="space-y-4">

            {/* Talaba info */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 font-bold text-lg">
                  {selectedStudent.name[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-bold text-slate-900">{selectedStudent.name}</p>
                <p className="text-sm text-slate-500">{selectedStudent.email}</p>
                <div className="flex gap-1.5 mt-1">
                  <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                    {selectedStudent.group}
                  </span>
                  <span className={cn('badge text-xs',
                    selectedStudent.isActive
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-700 border-red-200')}>
                    {selectedStudent.isActive ? 'Faol' : 'Blok'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ishlar */}
            <div>
              <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                Topshirgan ishlar ({selectedStudent.submissions?.length || 0})
              </p>

              {!selectedStudent.submissions?.length ? (
                <div className="text-center py-6 text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Hali ishlar yo'q</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {selectedStudent.submissions.map(sub => {
                    const gr          = sub.gradeReport
                    const results     = sub.tests?.[0]?.results || []
                    const lastResult  = results[results.length - 1]
                    // extraChance — gradeReport ichida
                    const hasExtra    = gr?.extraChance === true
                    const canGiveExtra = results.length >= 2 && !hasExtra && !!gr

                    return (
                      <details key={sub.id} className="bg-slate-50 rounded-xl border border-slate-200 group">

                        {/* Sarlavha */}
                        <summary className="flex items-center gap-2 p-3 cursor-pointer list-none select-none">
                          <ChevronDown size={14}
                            className="text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                          <span className="text-lg flex-shrink-0">
                            {fileTypeIcons[sub.fileType] || '📄'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{sub.title}</p>
                            <p className="text-xs text-slate-400">
                              {formatDate(sub.createdAt)}
                              {sub.attempt && <span> • {sub.attempt}-urinish</span>}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {gr
                              ? <GradeBadge grade={gr.gradeNumber} />
                              : <span className={cn('badge text-xs', statusColors[sub.status])}>
                                  {statusLabels[sub.status]}
                                </span>}
                          </div>
                        </summary>

                        {/* Kengaytirilgan qism */}
                        <div className="px-3 pb-3 pt-2 border-t border-slate-200 space-y-3">

                          {/* Baho statistikasi */}
                          {gr && (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                                <p className="text-lg font-black text-slate-900">{gr.gradeNumber}</p>
                                <p className="text-xs text-slate-400">Baho</p>
                              </div>
                              <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                                <p className="text-lg font-black text-primary-600">
                                  {lastResult?.score ?? 0}/5
                                </p>
                                <p className="text-xs text-slate-400">Ball</p>
                              </div>
                              <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                                <p className="text-lg font-black text-emerald-600">
                                  {gr.percentage?.toFixed(0)}%
                                </p>
                                <p className="text-xs text-slate-400">Foiz</p>
                              </div>
                            </div>
                          )}

                          {/* Test urinishlari soni */}
                          {results.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white rounded-lg p-2 border border-slate-100">
                              <CheckCircle size={12} className="text-emerald-500" />
                              Test {results.length} marta topshirilgan
                            </div>
                          )}

                          {/* Yuklangan fayl — download */}
                          {sub.fileUrl && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                📎 Yuklangan fayl
                              </p>
                              <a
                                href={sub.fileUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-3 py-2.5 hover:border-primary-300 hover:bg-primary-50 transition-all group/file">
                                <span className="text-xl flex-shrink-0">
                                  {fileTypeIcons[sub.fileType] || '📄'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate">{sub.title}</p>
                                  <p className="text-xs text-slate-400 uppercase">{sub.fileType}</p>
                                </div>
                                <Download size={14}
                                  className="text-slate-400 group-hover/file:text-primary-600 flex-shrink-0 transition-colors" />
                              </a>
                            </div>
                          )}

                          {/* 3-imkoniyat — gradeReport.id ishlatiladi (to'g'ri endpoint) */}
                          {canGiveExtra && gr && (
                            <button onClick={() => setExtraConfirm(gr.id)}
                              className="w-full text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors font-semibold">
                              + 3-imkoniyat berish
                            </button>
                          )}
                          {hasExtra && (
                            <p className="text-xs text-emerald-600 text-center bg-emerald-50 py-1.5 rounded-lg">
                              ✅ 3-imkoniyat berilgan
                            </p>
                          )}
                        </div>
                      </details>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Semester o'chirish confirm */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDeleteSemester(deleteConfirm)}
        title="Semesterni o'chirish"
        message="Semester o'chirilsa qaytarib bo'lmaydi. Davom etasizmi?"
        danger
      />

      {/* 3-imkoniyat confirm */}
      <ConfirmDialog
        isOpen={!!extraConfirm}
        onClose={() => setExtraConfirm(null)}
        onConfirm={() => handleExtraAttempt(extraConfirm)}
        title="3-imkoniyat berish"
        message="Bu talabaga qo'shimcha urinish berasizmi?"
      />
    </DashboardLayout>
  )
}