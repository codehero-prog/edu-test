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
  BookOpen,
  Users,
  CheckCircle,
  Clock,
  Plus,
  Calendar,
  ChevronRight,
  Loader2,
  X,
  Eye,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

export default function TeacherGroups() {
  const { user } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupStudents, setGroupStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);

  // Semester modal
  const [semModal, setSemModal] = useState(false);
  const [semForm, setSemForm] = useState({
    name: "",
    groupName: "",
    subject: "",
    deadline: "",
    maxUploads: 2,
    questionCount: 5,
    customPrompt: "",
  });
  const [semSubmitting, setSemSubmitting] = useState(false);

  // Extra attempt confirm
  const [extraConfirm, setExtraConfirm] = useState(null);

  const myGroups = user?.groups || [];

  const fetchSemesters = () => {
    setLoading(true);
    api
      .get("/teacher/semesters")
      .then(({ data }) => setSemesters(data.data.semesters))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  const openGroup = async (group) => {
    setSelectedGroup(group);
    setStudentsLoading(true);
    try {
      const { data } = await api.get(
        `/teacher/students?group=${group}&limit=100`,
      );
      setGroupStudents(data.data.students);
    } finally {
      setStudentsLoading(false);
    }
  };

  const openStudent = async (student) => {
    setStudentLoading(true);
    setSelectedStudent({ ...student, _loading: true });
    try {
      const { data } = await api.get(`/teacher/students/${student.id}`);
      setSelectedStudent(data.data.student);
    } finally {
      setStudentLoading(false);
    }
  };

  const handleCreateSemester = async (e) => {
    e.preventDefault();
    setSemSubmitting(true);
    try {
      const payload = {
        name: semForm.name,
        group: semForm.groupName,
        startDate: new Date().toISOString(),
        deadline: new Date(semForm.deadline).toISOString(),
      };
      await api.post("/teacher/semesters", payload);
      toast.success("Semester yaratildi!");
      setSemModal(false);
      setSemForm({ name: "", groupName: "", subject: "", deadline: "", maxUploads: 2, questionCount: 5, customPrompt: "" });
      fetchSemesters();
    } catch (err) {
      console.error("❌ Semester xato:", err?.response?.data);
      toast.error(err?.response?.data?.message || "Xatolik");
    } finally {
      setSemSubmitting(false);
    }
  };

  const handleExtraAttempt = async (resultId) => {
    try {
      await api.post(`/teacher/grades/${resultId}/extra-attempt`);
      toast.success("3-urinishga ruxsat berildi!");
      // Refresh student data
      if (selectedStudent) openStudent(selectedStudent);
    } catch {
      toast.error("Xatolik");
    }
  };

  const handleToggleStudent = async (studentId, name) => {
    const s = groupStudents.find((s) => s.id === studentId);
    if (!s) return;
    try {
      const { data } = await api.patch(`/teacher/students/${studentId}/toggle`);
      toast.success(data.message);
      openGroup(selectedGroup);
    } catch {
      toast.error("Xatolik");
    }
  };

  // Guruhlar bo'yicha semesterlarni guruhlash
  const groupedSemesters = myGroups.reduce((acc, g) => {
    acc[g] = semesters.filter((s) => s.group === g);
    return acc;
  }, {});

  const daysLeft = (deadline) => {
    const diff = new Date(deadline) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <DashboardLayout title="Guruhlar">
      <div className="space-y-4 pb-6">
        <div className="flex justify-end">
          <button onClick={() => setSemModal(true)} className="btn-primary">
            <Plus size={16} /> Semester Yaratish
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : myGroups.length === 0 ? (
          <div className="card p-10 text-center text-slate-400 text-sm">
            Guruhlar topilmadi
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myGroups.map((group) => {
              const groupSems = groupedSemesters[group] || [];
              const activeSem = groupSems.find((s) => s.isActive);
              return (
                <div key={group} className="card overflow-hidden">
                  {/* Group header */}
                  <div className="bg-indigo-600 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-200" />
                        <span className="text-white font-bold text-lg">
                          {group}
                        </span>
                      </div>
                      <button
                        onClick={() => openGroup(group)}
                        className="flex items-center gap-1.5 text-indigo-200 hover:text-white text-xs font-medium transition-colors"
                      >
                        <Users size={13} /> Talabalar <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Semesters */}
                  <div className="p-4 space-y-3">
                    {groupSems.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">
                        Hali semester yo'q
                      </p>
                    ) : (
                      groupSems.map((sem) => {
                        const days = daysLeft(sem.deadline);
                        const expired = days < 0;
                        return (
                          <div
                            key={sem.id}
                            className={cn(
                              "rounded-xl p-3 border",
                              sem.isActive
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-slate-200 bg-slate-50 opacity-60",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 text-sm">
                                  {sem.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {sem.subject}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Calendar size={10} />
                                    {expired ? (
                                      <span className="text-red-500">
                                        Tugagan
                                      </span>
                                    ) : (
                                      <span
                                        className={
                                          days <= 3
                                            ? "text-red-500 font-medium"
                                            : ""
                                        }
                                      >
                                        {days} kun
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    className={cn(
                                      "badge text-xs",
                                      sem.isActive
                                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                        : "bg-slate-100 text-slate-600 border-slate-200",
                                    )}
                                  >
                                    {sem.isActive ? "Faol" : "Tugagan"}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {sem.deadline ? new Date(sem.deadline).toLocaleDateString("uz-UZ") : ""}
                                  </span>
                                </div>
                              </div>
                              {sem.isActive && (
                                <button
                                  onClick={() =>
                                    toast.promise(
                                      api
                                        .delete(`/teacher/semesters/${sem.id}`)
                                        .then(() => fetchSemesters()),
                                      {
                                        loading: "...",
                                        success: "O'chirildi!",
                                        error: "Xatolik",
                                      },
                                    )
                                  }
                                  className="btn-secondary btn-sm text-xs flex-shrink-0"
                                >
                                  O'chirish
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Semester Modal */}
      <Modal
        isOpen={semModal}
        onClose={() => setSemModal(false)}
        title="Yangi Semester Yaratish"
      >
        <form onSubmit={handleCreateSemester} className="space-y-3">
          <div>
            <label className="label">
              Semester nomi <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="2024-2025 Bahor semestri"
              required
              className="input"
              value={semForm.name}
              onChange={(e) => setSemForm({ ...semForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">
              Guruh <span className="text-red-400">*</span>
            </label>
            <select
              required
              className="input"
              value={semForm.groupName}
              onChange={(e) =>
                setSemForm({ ...semForm, groupName: e.target.value })
              }
            >
              <option value="">Guruh tanlang</option>
              {myGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              Fan nomi <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Matematika"
              required
              className="input"
              value={semForm.subject}
              onChange={(e) =>
                setSemForm({ ...semForm, subject: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">
              Deadline <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              required
              className="input"
              value={semForm.deadline}
              onChange={(e) =>
                setSemForm({ ...semForm, deadline: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Maksimal yuklash soni</label>
            <select
              className="input"
              value={semForm.maxUploads}
              onChange={(e) =>
                setSemForm({ ...semForm, maxUploads: e.target.value })
              }
            >
              <option value={1}>1 ta</option>
              <option value={2}>2 ta (standart)</option>
              <option value={3}>3 ta</option>
            </select>
          </div>
          <div>
            <label className="label">Test savollar soni</label>
            <select
              className="input"
              value={semForm.questionCount}
              onChange={(e) =>
                setSemForm({ ...semForm, questionCount: e.target.value })
              }
            >
              <option value={5}>5 ta (standart)</option>
              <option value={7}>7 ta</option>
              <option value={10}>10 ta</option>
              <option value={15}>15 ta</option>
              <option value={20}>20 ta</option>
            </select>
          </div>
          <div>
            <label className="label">🤖 AI Prompt (ixtiyoriy)</label>
            <textarea
              rows={3}
              placeholder={`Masalan: "5 ta test ber, 3 tasi matematik misol o'rta darajada va 2 tasi oson nazariy savol"\n\nYozmasangiz AI fayldan o'zi savollar tuzadi.`}
              className="input resize-none text-sm"
              value={semForm.customPrompt}
              onChange={(e) =>
                setSemForm({ ...semForm, customPrompt: e.target.value })
              }
              maxLength={1000}
            />
            {semForm.customPrompt && (
              <p className="text-xs text-slate-400 mt-1 text-right">
                {semForm.customPrompt.length}/1000
              </p>
            )}
            <p className="text-xs text-indigo-500 mt-1">
              💡 Prompt yozilsa, har bir talabaning yuklaganidan kelib chiqib
              shu ko'rsatmaga asoslanib savollar tuziladi.
            </p>
          </div>
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setSemModal(false)}
              className="btn-secondary flex-1"
            >
              Bekor
            </button>
            <button
              type="submit"
              disabled={semSubmitting}
              className="btn-primary flex-1"
            >
              {semSubmitting && <Loader2 size={14} className="animate-spin" />}{" "}
              Yaratish
            </button>
          </div>
        </form>
      </Modal>

      {/* Group Students Modal */}
      <Modal
        isOpen={!!selectedGroup}
        onClose={() => {
          setSelectedGroup(null);
          setGroupStudents([]);
        }}
        title={`${selectedGroup} — Talabalar`}
        size="lg"
      >
        {studentsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {groupStudents.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">
                Talabalar topilmadi
              </p>
            ) : (
              groupStudents.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                >
                  <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-xs">
                      {s.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">
                      {s.name}
                    </p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <span className="badge bg-slate-100 text-slate-600 border-slate-200 text-xs">
                        {s._count?.submissions ?? 0} ish
                      </span>
                      {s.gradeReports?.[0] && (
                        <GradeBadge grade={s.gradeReports[0].gradeNumber} />
                      )}
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
                    </div>
                  </div>
                  <button
                    onClick={() => openStudent(s)}
                    className="btn-icon bg-primary-50 text-primary-600 hover:bg-primary-100 flex-shrink-0"
                  >
                    <Eye size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title="Talaba Ma'lumotlari"
        size="lg"
      >
        {studentLoading || selectedStudent?._loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          selectedStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-lg">
                    {selectedStudent.name[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    {selectedStudent.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedStudent.email}
                  </p>
                  <div className="flex gap-1.5 mt-1">
                    <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                      {selectedStudent.group}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submissions */}
              <div>
                <p className="text-xs font-bold text-slate-600 mb-2">
                  Topshirgan ishlar ({selectedStudent.submissions?.length || 0}
                  ):
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {!selectedStudent.submissions?.length ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Hali ishlar yo'q
                    </p>
                  ) : (
                    selectedStudent.submissions.map((sub) => {
                      const gr = sub.gradeReport;
                      const results = sub.tests?.[0]?.results || [];
                      const lastResult = results[results.length - 1];
                      const hasExtraAllowed = results.some(
                        (r) => r.extraAllowed,
                      );
                      const canGiveExtra =
                        results.length === 2 && !hasExtraAllowed;
                      return (
                        <div
                          key={sub.id}
                          className="bg-slate-50 rounded-xl p-3 border border-slate-200"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">
                                {sub.title}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatDate(sub.createdAt)} • {sub.attempt}
                                -urinish
                              </p>
                              {sub.semester && (
                                <p className="text-xs text-indigo-500">
                                  {sub.semester.name}
                                </p>
                              )}
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
                          </div>
                          {gr && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-slate-500">
                                Ball: <strong>{lastResult?.score}/5</strong>
                              </span>
                              <span className="text-xs text-slate-500">
                                Foiz:{" "}
                                <strong>{gr.percentage?.toFixed(0)}%</strong>
                              </span>
                              <span className="text-xs text-slate-500">
                                {results.length} urinish
                              </span>
                              {canGiveExtra && lastResult && (
                                <button
                                  onClick={() => setExtraConfirm(lastResult.id)}
                                  className="ml-auto text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors"
                                >
                                  3-urinish ruxsat
                                </button>
                              )}
                              {hasExtraAllowed && (
                                <span className="ml-auto text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg">
                                  3-urinish berilgan
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </Modal>

      {/* Extra attempt confirm */}
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
