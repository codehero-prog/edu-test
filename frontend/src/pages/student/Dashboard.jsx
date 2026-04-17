import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import Modal from "../../components/Modal";
import GradeBadge from "../../components/GradeBadge";
import {
  cn,
  formatDate,
  statusColors,
  statusLabels,
  fileTypeIcons,
} from "../../lib/utils";
import api from "../../lib/api";
import toast from "react-hot-toast";
import { downloadSubmission } from "../../lib/download";
import {
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  Upload,
  ArrowRight,
  Calendar,
  AlertCircle,
  Brain,
  Download,
  MessageSquare,
  XCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { PageLoader } from "../../components/Spinner";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [detailSub, setDetailSub] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchStats = () => {
    api
      .get("/student/dashboard")
      .then(({ data }) => setStats(data.data.stats))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/student/submissions/${deleteConfirm.id}`);
      toast.success("Ish o'chirildi");
      setDeleteConfirm(null);
      fetchStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xatolik");
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <DashboardLayout title="Mening Panelim">
        <PageLoader />
      </DashboardLayout>
    );

  // stats null bo'lsa (API xatosi) — xato sahifasini ko'rsatamiz
  if (!stats)
    return (
      <DashboardLayout title="Mening Panelim">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-slate-600 font-medium">Ma'lumotlar yuklanmadi</p>
          <p className="text-slate-400 text-sm mt-1">
            Sahifani yangilang yoki qayta kiring
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 btn-primary px-6 py-2"
          >
            Yangilash
          </button>
        </div>
      </DashboardLayout>
    );

  const now = new Date();
  const semesterActive =
    stats?.semester && now <= new Date(stats.semester.deadline);

  const cards = [
    {
      key: "total",
      label: "Qolgan urinishlar",
      value: Math.max(
        0,
        (stats.maxAttempts || 2) - (stats.semesterSubmissions || 0),
      ),
      icon: FileText,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
    {
      key: "submitted",
      label: "Topshirgan",
      value: stats.semesterSubmissions || 0,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      key: "pending",
      label: "Topshirmagan",
      value: stats.notSubmitted || 0,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      key: "avg",
      label: "O'rtacha baho",
      value: stats.avgGrade ? `${stats.avgGrade}/5` : "—",
      icon: TrendingUp,
      color: "text-primary-600",
      bg: "bg-primary-50",
    },
  ];

  const openSubDetail = async (sub) => {
    if (sub.status === "GRADED") {
      setDetailSub({ ...sub, _loading: true });
      setDetailLoading(true);
      try {
        const { data } = await api.get(`/student/submissions/${sub.id}/result`);
        setDetailSub(data.data.submission);
      } catch {
        setDetailSub(sub);
      } finally {
        setDetailLoading(false);
      }
    } else {
      setDetailSub(sub);
    }
  };

  const detailTest = detailSub?.tests?.[0];
  const detailResult = detailTest?.results?.[0];
  const detailGrade = detailSub?.gradeReport;
  const detailQuestions = detailTest?.questions || [];

  return (
    <DashboardLayout title="Mening Panelim">
      <div className="space-y-5 pb-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <button
              key={c.key}
              onClick={() => setModal(c.key)}
              className="card p-4 text-left hover:shadow-md hover:border-primary-200 transition-all active:scale-95 touch-manipulation"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    {c.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {c.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    c.bg,
                  )}
                >
                  <c.icon className={cn("w-5 h-5", c.color)} />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Semester info */}
        {stats?.semester && (
          <div
            className={cn(
              "rounded-2xl p-4 border",
              semesterActive
                ? "bg-emerald-50 border-emerald-200"
                : "bg-slate-50 border-slate-200",
            )}
          >
            <div className="flex items-center gap-3">
              <Calendar
                size={18}
                className={
                  semesterActive ? "text-emerald-600" : "text-slate-400"
                }
              />
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {stats.semester.name}
                </p>
                {stats.semester.subject && (
                  <p className="text-xs font-medium text-indigo-600 mt-0.5">
                    📚 {stats.semester.subject}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-0.5">
                  Deadline: {formatDate(stats.semester.deadline)}
                </p>
              </div>
              {semesterActive ? (
                <span className="ml-auto badge bg-emerald-100 text-emerald-700 border-emerald-200">
                  Faol
                </span>
              ) : now > new Date(stats.semester.deadline) ? (
                <span className="ml-auto badge bg-red-100 text-red-700 border-red-200">
                  Tugagan
                </span>
              ) : (
                <span className="ml-auto badge bg-yellow-100 text-yellow-700 border-yellow-200">
                  Boshlanmagan
                </span>
              )}
            </div>
            {semesterActive &&
              stats.semesterSubmissions < stats.maxAttempts && (
                <Link
                  to={`/student/upload?semesterId=${stats.semester.id}`}
                  className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group touch-manipulation"
                >
                  <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">
                      {stats.maxAttempts - stats.semesterSubmissions}-urinish —
                      Fayl Yuklash
                    </p>
                    <p className="text-xs text-slate-500">
                      PDF, Word yoki Excel
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-primary-400 group-hover:translate-x-1 transition-transform"
                  />
                </Link>
              )}
            {stats.semesterSubmissions >= stats.maxAttempts && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-white rounded-xl p-3 border border-slate-200">
                <AlertCircle size={14} className="text-amber-500" />
                Barcha urinishlar ishlatildi. O'qituvchingizdan 3-imkoniyat
                so'rang.
              </div>
            )}
          </div>
        )}

        {/* Recent submissions */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Oxirgi Ishlarim
            </h2>
            <Link
              to="/student/history"
              className="text-xs text-primary-600 font-medium"
            >
              Barchasi →
            </Link>
          </div>
          {!stats?.recentSubmissions?.length ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Hali ishlar yo'q</p>
            </div>
          ) : (
            stats.recentSubmissions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <span
                  onClick={() => openSubDetail(s)}
                  className="text-xl flex-shrink-0 cursor-pointer"
                >
                  {fileTypeIcons[s.fileType] || "📄"}
                </span>
                <div
                  onClick={() => openSubDetail(s)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <p className="font-medium text-slate-900 text-sm truncate">
                    {s.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(s.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.gradeReport ? (
                    <GradeBadge grade={s.gradeReport.gradeNumber} />
                  ) : (
                    <span
                      className={cn("badge text-xs", statusColors[s.status])}
                    >
                      {statusLabels[s.status]}
                    </span>
                  )}
                  {s.status !== "GRADED" && (
                    <button
                      onClick={() =>
                        setDeleteConfirm({ id: s.id, title: s.title })
                      }
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stat modals */}
      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={
          modal === "total"
            ? "Qolgan Urinishlar"
            : modal === "submitted"
              ? "Topshirgan"
              : modal === "pending"
                ? "Topshirmagan"
                : "O'rtacha baho"
        }
        size="sm"
      >
        <div className="space-y-3">
          {modal === "total" && (
            <div>
              <p className="text-sm text-slate-600 mb-3">
                Semestr bo'yicha urinishlar holati:
              </p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">Jami urinishlar:</p>
                  <strong className="text-xs text-slate-700">
                    {stats?.maxAttempts || 2}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">Ishlatilgan:</p>
                  <strong className="text-xs text-slate-700">
                    {stats?.semesterSubmissions || 0}
                  </strong>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                  <p className="text-xs font-semibold text-slate-600">
                    Qolgan urinishlar:
                  </p>
                  <strong
                    className={`text-sm ${Math.max(0, (stats?.maxAttempts || 2) - (stats?.semesterSubmissions || 0)) === 0 ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {Math.max(
                      0,
                      (stats?.maxAttempts || 2) -
                        (stats?.semesterSubmissions || 0),
                    )}
                  </strong>
                </div>
              </div>
              {Math.max(
                0,
                (stats?.maxAttempts || 2) - (stats?.semesterSubmissions || 0),
              ) === 0 && (
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg p-2">
                  Barcha urinishlar ishlatildi. O'qituvchingizdan 3-imkoniyat
                  so'rang.
                </p>
              )}
            </div>
          )}
          {modal === "submitted" && (
            <div>
              <p className="text-sm text-slate-600 mb-3">
                Baholangan ishlaringiz:{" "}
                <strong>{stats?.gradedSubmissions}</strong>
              </p>
              {stats?.recentSubmissions
                ?.filter((s) => s.status === "GRADED")
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-lg">{fileTypeIcons[s.fileType]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(s.createdAt)}
                      </p>
                    </div>
                    {s.gradeReport && (
                      <GradeBadge grade={s.gradeReport.gradeNumber} />
                    )}
                  </div>
                ))}
            </div>
          )}
          {modal === "pending" && (
            <div>
              <p className="text-sm text-slate-600 mb-3">
                Hali topshirilmagan: <strong>{stats?.notSubmitted}</strong>
              </p>
              {stats?.semester ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-xs text-yellow-800">
                    Deadline:{" "}
                    <strong>{formatDate(stats.semester.deadline)}</strong>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Semestr hali boshlanmagan
                </p>
              )}
            </div>
          )}
          {modal === "avg" && (
            <div className="text-center">
              <p className="text-5xl font-black text-slate-900">
                {stats?.avgGrade || "—"}
              </p>
              <p className="text-slate-500 text-sm mt-1">
                O'rtacha baho (5 tizimida)
              </p>
              {stats?.avgPercentage && (
                <p className="text-primary-600 font-semibold mt-2">
                  {stats.avgPercentage}%
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Submission Detail Modal */}
      <Modal
        isOpen={!!detailSub}
        onClose={() => setDetailSub(null)}
        title="Ish Tafsiloti"
        size="lg"
      >
        {detailLoading || detailSub?._loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          detailSub &&
          !detailSub._loading && (
            <div className="space-y-4">
              <div className="card p-4 text-center bg-gradient-to-br from-primary-50 to-white">
                <span className="text-4xl mb-2 block">
                  {fileTypeIcons[detailSub.fileType] || "📄"}
                </span>
                <h3 className="font-bold text-slate-900 mb-1">
                  {detailSub.title}
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  {formatDate(detailSub.createdAt)}
                </p>
                {detailGrade ? (
                  <>
                    <div className="flex items-center justify-center gap-8 mb-3">
                      <div>
                        <p className="text-4xl font-black text-slate-900">
                          {detailResult?.score ?? 0}
                        </p>
                        <p className="text-xs text-slate-500">
                          / {detailQuestions.length || 5} ball
                        </p>
                      </div>
                      <div className="w-px h-12 bg-slate-200" />
                      <div>
                        <p className="text-4xl font-black text-primary-600">
                          {detailResult?.percentage?.toFixed(0) ?? 0}%
                        </p>
                        <p className="text-xs text-slate-500">Foiz</p>
                      </div>
                    </div>
                    <GradeBadge grade={detailGrade.gradeNumber} large />
                  </>
                ) : (
                  <span
                    className={cn(
                      "badge text-sm",
                      statusColors[detailSub.status],
                    )}
                  >
                    {statusLabels[detailSub.status]}
                  </span>
                )}
              </div>

              {detailResult?.feedback && (
                <div className="card p-4 border-l-4 border-l-primary-500">
                  <div className="flex items-start gap-2">
                    <MessageSquare
                      size={15}
                      className="text-primary-500 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-1">
                        🤖 AI Sharhi
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {detailResult.feedback}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {detailQuestions.length > 0 && detailResult?.answers && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900">
                      Savollar Sharhi
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
                    {detailQuestions.map((q, i) => {
                      const ans = detailResult.answers[i]?.selectedAnswer;
                      const ok = ans === q.correctAnswer;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "p-3",
                            ok ? "bg-emerald-50/40" : "bg-red-50/40",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {ok ? (
                              <CheckCircle
                                size={14}
                                className="text-emerald-600 mt-0.5 flex-shrink-0"
                              />
                            ) : (
                              <XCircle
                                size={14}
                                className="text-red-500 mt-0.5 flex-shrink-0"
                              />
                            )}
                            <div>
                              <p className="text-xs font-semibold text-slate-800">
                                {i + 1}. {q.question}
                              </p>
                              <p className="text-xs mt-1">
                                <span className="text-slate-500">
                                  Sizning:{" "}
                                </span>
                                <span
                                  className={
                                    ok
                                      ? "text-emerald-700 font-semibold"
                                      : "text-red-600 font-semibold"
                                  }
                                >
                                  {ans || "—"}
                                </span>
                                {!ok && (
                                  <span className="text-slate-500 ml-2">
                                    | To'g'ri:{" "}
                                    <span className="text-emerald-700 font-semibold">
                                      {q.correctAnswer}
                                    </span>
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailSub.status === "TESTED" && detailTest && (
                <button
                  onClick={() => {
                    setDetailSub(null);
                    navigate(`/student/test/${detailTest.id}`);
                  }}
                  className="btn-primary w-full py-3"
                >
                  <Brain size={16} /> Testni Topshirish
                </button>
              )}

              <div className="flex gap-3">
                <Link
                  to="/student/history"
                  onClick={() => setDetailSub(null)}
                  className="btn-secondary flex-1 justify-center py-2.5 text-sm text-center"
                >
                  Tarixga o'tish
                </Link>
                {detailSub.fileUrl && (
                  <button
                    onClick={() =>
                      downloadSubmission(detailSub.id, detailSub.fileName)
                    }
                    className="btn-secondary px-4 py-2.5"
                  >
                    <Download size={16} />
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </Modal>
      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Ishni o'chirish"
        message={`"${deleteConfirm?.title}" ni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`}
        danger
      />
    </DashboardLayout>
  );
}
