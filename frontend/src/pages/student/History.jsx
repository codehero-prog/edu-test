import { useEffect, useState } from "react";
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
import {
  FileText,
  Loader2,
  Brain,
  CheckCircle,
  XCircle,
  MessageSquare,
  Download,
  Link as LinkIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function StudentHistory() {
  const navigate = useNavigate();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/student/submissions?page=${page}&limit=15`)
      .then(({ data }) => {
        setSubs(data.data.submissions);
        setTotalPages(data.pagination.totalPages);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const openDetail = async (sub) => {
    if (sub.status === "GRADED") {
      setDetailLoading(true);
      setSelected({ ...sub, _loading: true });
      try {
        const { data } = await api.get(`/student/submissions/${sub.id}/result`);
        setSelected(data.data.submission);
      } catch {
        setSelected(sub);
      } finally {
        setDetailLoading(false);
      }
    } else {
      setSelected(sub);
    }
  };

  const test = selected?.tests?.[0];
  const result = test?.results?.[0];
  const grade = selected?.gradeReport;
  const questions = test?.questions || [];

  return (
    <DashboardLayout title="Tarix">
      <div className="space-y-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
          </div>
        ) : subs.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Hali ishlar yo'q</p>
            <Link
              to="/student/upload"
              className="btn-primary inline-flex mt-3 btn-sm"
            >
              Ish yuklash
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subs.map((s) => (
              <div
                key={s.id}
                onClick={() => openDetail(s)}
                className="card p-4 cursor-pointer hover:shadow-md hover:border-primary-200 active:scale-[0.99] transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">
                    {fileTypeIcons[s.fileType] || "📄"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {s.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(s.createdAt)}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {s.gradeReport ? (
                        <GradeBadge grade={s.gradeReport.gradeNumber} />
                      ) : (
                        <span
                          className={cn(
                            "badge text-xs",
                            statusColors[s.status],
                          )}
                        >
                          {statusLabels[s.status]}
                        </span>
                      )}
                      {s.attemptNumber && (
                        <span className="badge bg-slate-100 text-slate-600 border-slate-200 text-xs">
                          {s.attemptNumber}-urinish
                        </span>
                      )}
                      {s.status === "TESTED" && (
                        <span className="badge bg-primary-50 text-primary-700 border-primary-200 text-xs flex items-center gap-1">
                          <Brain size={10} /> Test topshir
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "w-9 h-9 rounded-xl text-sm font-semibold transition-all touch-manipulation",
                  p === page
                    ? "bg-primary-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Ish Tafsiloti"
        size="lg"
      >
        {detailLoading || selected?._loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          selected &&
          !selected._loading && (
            <div className="space-y-4">
              {/* Score */}
              <div className="card p-5 text-center bg-gradient-to-br from-primary-50 to-white">
                <span className="text-4xl mb-2 block">
                  {fileTypeIcons[selected.fileType] || "📄"}
                </span>
                <h3 className="font-bold text-slate-900 mb-1">
                  {selected.title}
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  {formatDate(selected.createdAt)}
                </p>
                {grade ? (
                  <>
                    <div className="flex items-center justify-center gap-8 mb-4">
                      <div>
                        <p className="text-4xl font-black text-slate-900">
                          {result?.score ?? 0}
                        </p>
                        <p className="text-xs text-slate-500">/ 5 ball</p>
                      </div>
                      <div className="w-px h-12 bg-slate-200" />
                      <div>
                        <p className="text-4xl font-black text-primary-600">
                          {result?.percentage?.toFixed(0) ?? 0}%
                        </p>
                        <p className="text-xs text-slate-500">Foiz</p>
                      </div>
                    </div>
                    <GradeBadge grade={grade.gradeNumber} large />
                  </>
                ) : (
                  <span
                    className={cn(
                      "badge text-sm",
                      statusColors[selected.status],
                    )}
                  >
                    {statusLabels[selected.status]}
                  </span>
                )}
              </div>

              {/* AI Feedback */}
              {result?.feedback && (
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
                        {result.feedback}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Questions */}
              {questions.length > 0 && result?.answers && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900">
                      Savollar Sharhi
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {questions.map((q, i) => {
                      const ans = result.answers[i]?.selectedAnswer;
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

              {/* Test pending action */}
              {selected.status === "TESTED" && test && (
                <button
                  onClick={() => {
                    setSelected(null);
                    navigate(`/student/test/${test.id}`);
                  }}
                  className="btn-primary w-full py-3"
                >
                  <Brain size={16} /> Testni Topshirish
                </button>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setSelected(null)}
                  className="btn-secondary flex-1 py-2.5 text-sm"
                >
                  Yopish
                </button>
                {selected.fileUrl && (
                  <a
                    href={sub.fileUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-4 py-2.5"
                  >
                    <Download size={16} />
                  </a>
                )}
              </div>
            </div>
          )
        )}
      </Modal>
    </DashboardLayout>
  );
}
