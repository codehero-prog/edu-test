import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../lib/api";
import toast from "react-hot-toast";
import {
  Upload,
  X,
  CheckCircle,
  Loader2,
  Brain,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { cn } from "../../lib/utils";

const ALLOWED = ["pdf", "doc", "docx", "xls", "xlsx"];
const MAX_MB = 10;
const FILE_ICONS = { pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊" };

export default function StudentUpload() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const semesterIdParam = params.get("semesterId");

  const inputRef = useRef(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("form");
  const [result, setResult] = useState(null);
  const [semester, setSemester] = useState(null);

  useEffect(() => {
    if (semesterIdParam) {
      api.get("/student/semesters").then(({ data }) => {
        const sems = data.data.semesters || [];
        const sem = sems.find((s) => s.id === semesterIdParam) || sems[0];
        if (sem) setSemester(sem);
      });
    }
  }, [semesterIdParam]);

  const validate = (f) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED.includes(ext)) {
      toast.error("Faqat PDF, Word yoki Excel qabul qilinadi!");
      return false;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Maksimal ${MAX_MB}MB!`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTitleTouched(true);
    if (!title.trim()) return;
    if (!file) {
      toast.error("Fayl tanlang!");
      return;
    }

    setLoading(true);
    setStep("processing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      if (semesterIdParam) fd.append("semesterId", semesterIdParam);

      const { data } = await api.post("/student/submissions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data.data);
      setStep("done");
      toast.success("Fayl yuklandi va testlar tayyor!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Yuklashda xatolik");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  const ext = file?.name.split(".").pop()?.toLowerCase();
  const titleError = titleTouched && !title.trim();

  if (step === "processing")
    return (
      <DashboardLayout title="Yuklanmoqda...">
        <div className="max-w-sm mx-auto text-center py-12 px-4">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="w-20 h-20 border-4 border-primary-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <Brain className="absolute inset-0 m-auto w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            AI Ishlab Chiqmoqda...
          </h2>
          <p className="text-slate-500 text-sm">Test savollar yaratilmoqda</p>
        </div>
      </DashboardLayout>
    );

  if (step === "done" && result)
    return (
      <DashboardLayout title="Tayyor!">
        <div className="max-w-sm mx-auto text-center py-8 px-4">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Muvaffaqiyatli!
          </h2>
          <p className="text-slate-500 mb-5 text-sm">
            <strong className="text-primary-600">5 ta test savoli</strong>{" "}
            tayyorlandi
          </p>
          {result.attempt && (
            <div className="badge bg-indigo-50 text-indigo-700 border-indigo-200 mb-4 mx-auto">
              {result.attempt}-urinish
            </div>
          )}
          <button
            onClick={() => navigate(`/student/test/${result.testId}`)}
            className="btn-primary w-full py-3.5 mb-3"
          >
            <Brain size={18} /> Testni Boshlash
          </button>
          <button
            onClick={() => {
              setStep("form");
              setFile(null);
              setTitle("");
              setResult(null);
              setTitleTouched(false);
            }}
            className="btn-secondary w-full py-3"
          >
            Yangi Ish Yuklash
          </button>
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout title="Mustaqil Ish Yuklash">
      <div className="max-w-lg mx-auto">
        {/* Semester info */}
        {semester && (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 mb-4">
            <BookOpen size={16} className="text-indigo-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-indigo-900">
                {semester.subject}
              </p>
              <p className="text-xs text-indigo-500">
                {semester.name} • {semester.myUploadCount}/
                {semester.maxUploads || 2} yuklash
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="card p-4">
            <label className="label">
              Mavzu / Sarlavha <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Masalan: Iqtisodiyot 1-mustaqil ish"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              className={cn(
                "input transition-all duration-300",
                titleError
                  ? "border-red-400 ring-2 ring-red-200 scale-[0.97] shadow-inner bg-red-50"
                  : "scale-100",
              )}
              required
              minLength={3}
            />
            {titleError && (
              <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} /> Mavzuni kiriting!
              </p>
            )}
          </div>

          {/* Dropzone */}
          <div className="card p-4">
            <label className="label mb-3 block">
              Fayl <span className="text-red-400">*</span>
            </label>
            {file ? (
              <div className="border-2 border-emerald-300 bg-emerald-50 rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">{FILE_ICONS[ext] || "📄"}</div>
                <p className="font-semibold text-slate-900 text-sm truncate px-4">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg"
                >
                  <X size={12} /> O'chirish
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files[0];
                  if (f && validate(f)) setFile(f);
                }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                  drag
                    ? "border-primary-500 bg-primary-50"
                    : "border-slate-200 hover:border-primary-300 hover:bg-slate-50",
                )}
              >
                <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-700 text-sm">
                  Bosing yoki tashlang
                </p>
                <div className="flex justify-center gap-2 mt-3 flex-wrap">
                  {["PDF", "Word", "Excel"].map((t) => (
                    <span
                      key={t}
                      className="badge bg-slate-100 text-slate-500 border-slate-200 text-xs"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Max {MAX_MB}MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && validate(f)) setFile(f);
              }}
              className="hidden"
            />
          </div>

          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <AlertCircle
              size={15}
              className="text-blue-500 flex-shrink-0 mt-0.5"
            />
            <p className="text-xs text-blue-700">
              AI avtomatik <strong>5 ta test savoli</strong> yaratadi.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !file}
            className="btn-primary w-full py-4 text-base"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Upload size={20} />
            )}
            {loading ? "Yuklanmoqda..." : "Yuklash va Test Yaratish"}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
