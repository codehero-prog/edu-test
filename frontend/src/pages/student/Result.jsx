import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import GradeBadge from '../../components/GradeBadge'
import { cn, formatDate, fileTypeIcons } from '../../lib/utils'
import api from '../../lib/api'
import { downloadSubmission } from '../../lib/download'
import { CheckCircle, XCircle, Loader2, ArrowLeft, Download, MessageSquare } from 'lucide-react'
import { PageLoader } from '../../components/Spinner'

export default function StudentResult() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/student/submissions/${id}/result`)
      .then(({ data }) => setData(data.data.submission))
      .catch(() => navigate('/student/submissions'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <DashboardLayout title="Natija"><PageLoader /></DashboardLayout>

  const test      = data?.tests?.[0]
  const result    = test?.results?.[0]
  const grade     = data?.gradeReport
  const questions = test?.questions || []

  return (
    <DashboardLayout title="Test Natijasi">
      <div className="max-w-xl mx-auto space-y-4 pb-6">
        <Link to="/student/submissions"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors touch-manipulation">
          <ArrowLeft size={16} /> Orqaga
        </Link>

        {/* Score */}
        <div className="card p-6 text-center bg-gradient-to-br from-primary-50 to-white">
          <span className="text-5xl mb-3 block">{fileTypeIcons[data?.fileType] || '📄'}</span>
          <h2 className="text-lg font-bold text-slate-900 mb-1">{data?.title}</h2>
          <p className="text-xs text-slate-500 mb-5">{formatDate(data?.createdAt)}</p>
          <div className="flex items-center justify-center gap-8 mb-5">
            <div>
              <p className="text-5xl font-black text-slate-900">{result?.score ?? 0}</p>
              <p className="text-xs text-slate-500">/ 5 ball</p>
            </div>
            <div className="w-px h-14 bg-slate-200" />
            <div>
              <p className="text-5xl font-black text-primary-600">{result?.percentage?.toFixed(0) ?? 0}%</p>
              <p className="text-xs text-slate-500">Foiz</p>
            </div>
          </div>
          {grade && <GradeBadge grade={grade.gradeNumber} large />}
        </div>

        {/* AI Feedback */}
        {result?.feedback && (
          <div className="card p-4 border-l-4 border-l-primary-500">
            <div className="flex items-start gap-3">
              <MessageSquare size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-700 mb-1">🤖 AI Fikr-Mulohaza</p>
                <p className="text-sm text-slate-600 leading-relaxed">{result.feedback}</p>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        {questions.length > 0 && result?.answers && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Savollar Sharhi</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {questions.map((q, i) => {
                const studentAns = result.answers[i]?.selectedAnswer
                const isCorrect  = studentAns === q.correctAnswer
                return (
                  <div key={i} className={cn('p-4', isCorrect ? 'bg-emerald-50/40' : 'bg-red-50/40')}>
                    <div className="flex items-start gap-2.5 mb-2.5">
                      {isCorrect
                        ? <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                        : <XCircle    size={16} className="text-red-500 mt-0.5 flex-shrink-0" />}
                      <p className="text-sm font-semibold text-slate-800">{i + 1}. {q.question}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 ml-6">
                      {Object.entries(q.options || {}).map(([key, val]) => {
                        const isOk  = key === q.correctAnswer
                        const isStu = key === studentAns
                        return (
                          <div key={key} className={cn('flex items-center gap-1.5 text-xs p-2 rounded-lg',
                            isOk ? 'bg-emerald-100 text-emerald-800 font-semibold' :
                            isStu && !isCorrect ? 'bg-red-100 text-red-700 line-through' : 'text-slate-500 bg-slate-50')}>
                            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                              isOk ? 'bg-emerald-500 text-white' :
                              isStu && !isCorrect ? 'bg-red-400 text-white' : 'bg-slate-200 text-slate-500')}>
                              {key}
                            </span>
                            <span className="truncate">{val}</span>
                          </div>
                        )
                      })}
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-slate-500 mt-2 ml-6 italic">{q.explanation}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link to="/student/upload" className="btn-primary flex-1 justify-center py-3">Yangi Ish</Link>
          {data?.fileUrl && (
            <button
              onClick={() => downloadSubmission(data.submissionId || data.id, data.fileName)}
              className="btn-secondary px-4 py-3 touch-manipulation">
              <Download size={16} />
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
