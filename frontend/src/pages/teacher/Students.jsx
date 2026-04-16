import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Modal from "../../components/Modal";
import GradeBadge from "../../components/GradeBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  cn,
  formatDate,
  statusColors,
  statusLabels,
  fileTypeIcons,
} from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  CheckCircle,
  XCircle,
  MessageSquare,
  Download,
  FileText,
} from "lucide-react";

export default function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [teacherGroups, setTeacherGroups] = useState([]);
  const [createModal, setCreateModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    group: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toggleConfirm, setToggleConfirm] = useState(null);
  const [extraConfirm, setExtraConfirm] = useState(null);

  // Detail modal
  const [detailStudent, setDetailStudent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchStudents = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, search });
    if (filterGroup) params.append("group", filterGroup);
    api
      .get(`/teacher/students?${params}`)
      .then(({ data }) => {
        setStudents(data.data.students);
        setPagination(data.pagination);
        if (data.data.teacherGroups?.length)
          setTeacherGroups(data.data.teacherGroups);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStudents();
  }, [page, search, filterGroup]);

  const myGroups =
    teacherGroups.length > 0 ? teacherGroups : user?.groups || [];

  useEffect(() => {
    if (myGroups.length > 0 && !form.group)
      setForm((f) => ({ ...f, group: myGroups[0] }));
  }, [myGroups.length]);

  const openDetail = async (student) => {
    setDetailStudent({ ...student, _loading: true });
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/teacher/students/${student.id}`);
      setDetailStudent(data.data.student);
    } catch {
      toast.error("Ma'lumot yuklanmadi");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/teacher/students", form);
      toast.success("Talaba yaratildi!");
      setSuccessInfo({ ...form });
      setCreateModal(false);
      setForm({ name: "", email: "", password: "", group: myGroups[0] || "" });
      fetchStudents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async () => {
    try {
      const { data } = await api.patch(
        `/teacher/students/${toggleConfirm.id}/toggle`,
      );
      toast.success(data.message);
      fetchStudents();
    } catch {
      toast.error("Xatolik");
    } finally {
      setToggleConfirm(null);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/teacher/students/${deleteConfirm.id}`);
      toast.success("O'chirildi!");
      fetchStudents();
    } catch {
      toast.error("Xatolik");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleExtraAttempt = async (resultId) => {
    try {
      await api.post(`/teacher/grades/${resultId}/extra-attempt`);
      toast.success("3-urinishga ruxsat berildi!");
      if (detailStudent) openDetail(detailStudent);
    } catch {
      toast.error("Xatolik");
    }
  };

  const downloadFile = async (url, fileName) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName || "file";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Yuklab olishda xatolik");
    }
  };

  return (
    <DashboardLayout title="Mening Talabalarim">
      <div className="space-y-4 pb-6">
        {successInfo && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex justify-between gap-3">
              <div className="flex-1 space-y-2">
                <p className="font-bold text-emerald-800 text-sm">
                  ✅ {successInfo.name} yaratildi!
                </p>
                {[
                  ["Guruh", successInfo.group],
                  ["Email", successInfo.email],
                  ["Parol", successInfo.password],
                ].map(([l, v]) => (
                  <div key={l} className="flex items-center gap-2">
                    <span className="text-xs text-emerald-700 font-medium w-12">
                      {l}:
                    </span>
                    <code className="bg-white px-2 py-0.5 rounded-lg text-xs text-emerald-900 border border-emerald-200 flex-1 truncate">
                      {v}
                    </code>
                    <button
                      onClick={() => copyText(v)}
                      className="p-1 rounded hover:bg-emerald-100"
                    >
                      <Copy size={12} className="text-emerald-600" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setSuccessInfo(null)}
                className="text-emerald-400 text-lg"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2 flex-1 min-w-0">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                placeholder="Qidirish..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input pl-9 py-2.5"
              />
            </div>
            {myGroups.length > 0 && (
              <select
                value={filterGroup}
                onChange={(e) => {
                  setFilterGroup(e.target.value);
                  setPage(1);
                }}
                className="input py-2.5 w-auto"
              >
                <option value="">Barchasi</option>
                {myGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={() => setCreateModal(true)}
            className="btn-primary flex-shrink-0"
          >
            <Plus size={16} /> Talaba
          </button>
        </div>

        {/* Desktop table */}
        <div className="card overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    "Talaba",
                    "Guruh",
                    "Ishlar",
                    "Baho",
                    "Holat",
                    "Sana",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      Hali talabalar yo'q
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                            <span className="text-emerald-700 font-bold text-xs">
                              {s.name[0]?.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900">
                              {s.name}
                            </p>
                            <p className="text-xs text-slate-400">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                          {s.group || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="badge bg-slate-100 text-slate-700 border-slate-200 text-xs">
                          {s._count?.submissions ?? 0} ta
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {s.gradeReports?.[0] ? (
                          <GradeBadge grade={s.gradeReports[0].gradeNumber} />
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "badge text-xs",
                            s.isActive
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200",
                          )}
                        >
                          {s.isActive ? "Faol" : "Blok"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">
                        {formatDate(s.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => openDetail(s)}
                            className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() =>
                              setToggleConfirm({
                                id: s.id,
                                name: s.name,
                                isActive: s.isActive,
                              })
                            }
                            className="p-1.5 rounded-lg hover:bg-slate-100"
                          >
                            {s.isActive ? (
                              <ToggleRight
                                size={17}
                                className="text-green-500"
                              />
                            ) : (
                              <ToggleLeft size={17} className="text-red-400" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirm({ id: s.id, name: s.name })
                            }
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
              </div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Hali talabalar yo'q
              </div>
            ) : (
              students.map((s) => (
                <div key={s.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-xs">
                        {s.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-slate-900">
                            {s.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {s.email}
                          </p>
                        </div>
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => openDetail(s)}
                            className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() =>
                              setToggleConfirm({
                                id: s.id,
                                name: s.name,
                                isActive: s.isActive,
                              })
                            }
                            className="p-1.5 rounded-lg hover:bg-slate-100"
                          >
                            {s.isActive ? (
                              <ToggleRight
                                size={17}
                                className="text-green-500"
                              />
                            ) : (
                              <ToggleLeft size={17} className="text-red-400" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirm({ id: s.id, name: s.name })
                            }
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.group && (
                          <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                            {s.group}
                          </span>
                        )}
                        {s.gradeReports?.[0] && (
                          <GradeBadge grade={s.gradeReports[0].gradeNumber} />
                        )}
                        <span className="badge bg-slate-100 text-slate-600 border-slate-200 text-xs">
                          {s._count?.submissions ?? 0} ish
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Jami: {pagination.total}
              </span>
              <div className="flex gap-1.5">
                {Array.from(
                  { length: pagination.totalPages },
                  (_, i) => i + 1,
                ).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                      p === page
                        ? "bg-primary-600 text-white"
                        : "hover:bg-slate-100 text-slate-600",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Yangi Talaba"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="label">
              Ism Familiya <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Karimov Jasur"
              required
              minLength={2}
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">
              Guruh <span className="text-red-400">*</span>
            </label>
            {myGroups.length > 0 ? (
              <select
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
                className="input"
                required
              >
                <option value="">Tanlang</option>
                {myGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Guruh nomi"
                required
                className="input"
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
              />
            )}
          </div>
          <div>
            <label className="label">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">
              Parol <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required
                minLength={6}
                className="input pr-10"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setCreateModal(false)}
              className="btn-secondary flex-1"
            >
              Bekor
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}{" "}
              Yaratish
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        isOpen={!!detailStudent}
        onClose={() => setDetailStudent(null)}
        title="Talaba Ma'lumotlari"
        size="lg"
      >
        {detailLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          detailStudent &&
          !detailStudent._loading && (
            <div className="space-y-4">
              {/* Info */}
              <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-lg">
                    {detailStudent.name?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    {detailStudent.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {detailStudent.email}
                  </p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                      {detailStudent.group}
                    </span>
                    <span
                      className={cn(
                        "badge text-xs",
                        detailStudent.isActive
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200",
                      )}
                    >
                      {detailStudent.isActive ? "Faol" : "Blok"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submissions */}
              <div>
                <p className="text-xs font-bold text-slate-600 mb-2">
                  Topshirgan ishlar ({detailStudent.submissions?.length || 0}):
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {!detailStudent.submissions?.length ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Hali ishlar yo'q
                    </p>
                  ) : (
                    detailStudent.submissions.map((sub) => {
                      const gr = sub.gradeReport;
                      const results = sub.tests?.[0]?.results || [];
                      const lastResult = results[results.length - 1];
                      const hasExtraAllowed = results.some(
                        (r) => r.extraAllowed,
                      );
                      const canGiveExtra =
                        results.length === 2 && !hasExtraAllowed && gr;
                      const questions = sub.tests?.[0]?.questions || [];
                      return (
                        <details
                          key={sub.id}
                          className="bg-slate-50 rounded-xl border border-slate-200 group"
                        >
                          <summary className="flex items-center gap-2 p-3 cursor-pointer list-none">
                            <ChevronDown
                              size={14}
                              className="text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0"
                            />
                            <span className="text-base flex-shrink-0">
                              {fileTypeIcons?.[sub.fileType] || "📄"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">
                                {sub.title}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatDate(sub.createdAt)} •{" "}
                                {sub.attemptNumber || 1}-urinish
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              {gr ? (
                                <GradeBadge grade={gr.gradeNumber} />
                              ) : (
                                <span
                                  className={cn(
                                    "badge text-xs",
                                    statusColors[sub.status],
                                  )}
                                >
                                  {statusLabels[sub.status]}
                                </span>
                              )}
                            </div>
                          </summary>
                          <div className="px-3 pb-3 pt-2 border-t border-slate-200 space-y-2">
                            {/* Fayl yuklab olish */}
                            {sub.fileUrl && (
                              <button
                                onClick={() =>
                                  downloadFile(sub.fileUrl, sub.fileName)
                                }
                                className="flex items-center gap-2 w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-50 transition-colors"
                              >
                                <FileText
                                  size={13}
                                  className="text-indigo-500 flex-shrink-0"
                                />
                                <span className="text-xs text-indigo-700 font-medium flex-1 text-left truncate">
                                  {sub.fileName || "Faylni yuklab olish"}
                                </span>
                                <Download
                                  size={12}
                                  className="text-indigo-400 flex-shrink-0"
                                />
                              </button>
                            )}
                            {/* Ball statistikasi */}
                            {gr && (
                              <div className="flex gap-3 text-xs text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-100">
                                <span>
                                  Ball:{" "}
                                  <strong className="text-slate-800">
                                    {lastResult?.score ?? "—"}/
                                    {questions.length || 5}
                                  </strong>
                                </span>
                                <span>
                                  Foiz:{" "}
                                  <strong className="text-slate-800">
                                    {gr.percentage?.toFixed(0)}%
                                  </strong>
                                </span>
                                <span>
                                  Urinish:{" "}
                                  <strong className="text-slate-800">
                                    {results.length}
                                  </strong>
                                </span>
                              </div>
                            )}
                            {/* AI sharhi */}
                            {lastResult?.feedback && (
                              <div className="flex items-start gap-2 bg-white rounded-lg p-2 border border-slate-200">
                                <MessageSquare
                                  size={12}
                                  className="text-primary-500 mt-0.5 flex-shrink-0"
                                />
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {lastResult.feedback}
                                </p>
                              </div>
                            )}
                            {/* Test savol-javoblari */}
                            {questions.length > 0 && lastResult?.answers && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-500">
                                  Test natijalari:
                                </p>
                                {questions.map((q, i) => {
                                  const ans =
                                    lastResult.answers[i]?.selectedAnswer;
                                  const ok = ans === q.correctAnswer;
                                  return (
                                    <div
                                      key={i}
                                      className={cn(
                                        "rounded-lg p-2 text-xs",
                                        ok
                                          ? "bg-emerald-50 border border-emerald-100"
                                          : "bg-red-50 border border-red-100",
                                      )}
                                    >
                                      <div className="flex items-start gap-1.5">
                                        {ok ? (
                                          <CheckCircle
                                            size={11}
                                            className="text-emerald-600 mt-0.5 flex-shrink-0"
                                          />
                                        ) : (
                                          <XCircle
                                            size={11}
                                            className="text-red-500 mt-0.5 flex-shrink-0"
                                          />
                                        )}
                                        <div>
                                          <p
                                            className={cn(
                                              "font-medium",
                                              ok
                                                ? "text-emerald-800"
                                                : "text-red-800",
                                            )}
                                          >
                                            {i + 1}. {q.question}
                                          </p>
                                          <p className="text-slate-500 mt-0.5">
                                            Javob:{" "}
                                            <span
                                              className={cn(
                                                "font-semibold",
                                                ok
                                                  ? "text-emerald-700"
                                                  : "text-red-600",
                                              )}
                                            >
                                              {ans || "—"}
                                            </span>
                                            {!ok && (
                                              <span className="text-slate-400 ml-2">
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
                            )}
                            {/* Extra attempt */}
                            {canGiveExtra && lastResult && (
                              <button
                                onClick={() => setExtraConfirm(lastResult.id)}
                                className="w-full text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                              >
                                3-urinishga ruxsat berish
                              </button>
                            )}
                            {hasExtraAllowed && (
                              <p className="text-xs text-emerald-600 text-center">
                                ✅ 3-urinish berilgan
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </Modal>

      {/* Confirms */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={`"${deleteConfirm?.name}" ni o'chirish`}
        message="Bu amalni qaytarib bo'lmaydi!"
        danger
      />
      <ConfirmDialog
        isOpen={!!toggleConfirm}
        onClose={() => setToggleConfirm(null)}
        onConfirm={handleToggle}
        title={toggleConfirm?.isActive ? "Bloklash" : "Faollashtirish"}
        message={`"${toggleConfirm?.name}" ni ${toggleConfirm?.isActive ? "bloklamoqchimisiz" : "faollashtirmoqchimisiz"}?`}
      />
      <ConfirmDialog
        isOpen={!!extraConfirm}
        onClose={() => setExtraConfirm(null)}
        onConfirm={() => handleExtraAttempt(extraConfirm)}
        title="3-urinishga ruxsat berish"
        message="Bu talabaga qo'shimcha urinish berasizmi?"
      />
    </DashboardLayout>
  );
}
