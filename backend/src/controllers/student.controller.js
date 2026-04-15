const prisma = require("../config/prisma");
const { parseFile } = require("../services/file.service");
const {
  generateTests,
  gradeAnswers,
  generateFeedback,
} = require("../services/ai.service");
const { uploadFile } = require("../services/cloudinary.service");
const {
  successResponse,
  errorResponse,
  paginatedResponse,
} = require("../utils/response");
const { AppError } = require("../middleware/errorHandler");

// ===== UPLOAD SUBMISSION =====
const uploadSubmission = async (req, res) => {
  const { title, semesterId } = req.body;
  if (!title || title.trim().length < 3)
    throw new AppError("Sarlavha kamida 3 belgi bo'lishi kerak.", 400);
  if (!req.file) throw new AppError("Fayl yuklanmadi.", 400);

  const studentId = req.user.id;

  // Semester tekshiruvi
  let semester = null;
  if (semesterId) {
    semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) throw new AppError("Semester topilmadi.", 404);
    if (semester.status !== "ACTIVE")
      throw new AppError("Bu semester faol emas.", 403);
    if (new Date() > new Date(semester.deadline))
      throw new AppError("Semester muddati tugagan.", 403);

    const uploadCount = await prisma.submission.count({
      where: { studentId, semesterId },
    });

    // Extra attempt tekshiruvi
    const hasExtra = await prisma.testResult.findFirst({
      where: {
        studentId,
        extraAllowed: true,
        test: { submission: { semesterId } },
      },
    });
    const maxAllowed = hasExtra ? semester.maxUploads + 1 : semester.maxUploads;

    if (uploadCount >= maxAllowed)
      throw new AppError(
        `Bu semesterda maksimal ${maxAllowed} ta fayl yuklash mumkin.`,
        403,
      );
  }

  const fileType = req.fileType;
  const buffer = req.file.buffer;
  const origName = req.file.originalname;
  const { url: fileUrl } = await uploadFile(buffer, origName);

  let parsedData;
  try {
    parsedData = await parseFile(buffer, fileType);
  } catch (e) {
    throw new AppError(e.message, 400);
  }

  const prevCount = semesterId
    ? await prisma.submission.count({ where: { studentId, semesterId } })
    : 0;

  const submission = await prisma.submission.create({
    data: {
      title: title.trim(),
      fileUrl,
      fileType,
      fileName: origName,
      extractedText: parsedData.text,
      status: "PROCESSING",
      studentId,
      attemptNumber: prevCount + 1,
      ...(semesterId && { semesterId }),
    },
  });

  // AI options — semester dan customPrompt va questionCount olish
  const aiOptions = {
    questionCount: semester?.questionCount || 5,
    customPrompt: semester?.customPrompt || null,
  };

  let questions;
  try {
    questions = await generateTests(parsedData.text, title, aiOptions);
  } catch (e) {
    console.error("🔴 AI XATO:", e.message);
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED" },
    });
    throw new AppError(`AI test yaratishda xatolik: ${e.message}`, 500);
  }

  const test = await prisma.test.create({
    data: { submissionId: submission.id, questions },
  });
  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: "TESTED" },
  });

  return successResponse(
    res,
    {
      submissionId: submission.id,
      testId: test.id,
      title: submission.title,
      fileType,
      wordCount: parsedData.wordCount,
      attemptNumber: submission.attemptNumber,
      totalQuestions: questions.length,
    },
    "Fayl yuklandi va testlar tayyor!",
    201,
  );
};

// ===== GET TEST QUESTIONS =====
const getTestQuestions = async (req, res) => {
  const { testId } = req.params;
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      submission: { select: { studentId: true, title: true } },
      results: {
        where: { studentId: req.user.id },
        select: { id: true, extraAllowed: true },
      },
    },
  });
  if (!test) return errorResponse(res, "Test topilmadi.", 404);
  if (test.submission.studentId !== req.user.id)
    return errorResponse(res, "Bu test sizga tegishli emas.", 403);

  const attempts = test.results.length;
  const extraAllowed = test.results.some((r) => r.extraAllowed);
  const maxAttempts = extraAllowed ? 3 : 2;

  if (attempts >= maxAttempts)
    return errorResponse(
      res,
      `Siz bu testni allaqachon ${attempts} marta topshirgansiz.`,
      400,
    );

  const safeQuestions = test.questions.map((q, i) => ({
    id: i + 1,
    question: q.question,
    options: q.options,
  }));

  return successResponse(
    res,
    {
      testId: test.id,
      submissionTitle: test.submission.title,
      questions: safeQuestions,
      totalQuestions: safeQuestions.length,
      attemptNumber: attempts + 1,
      maxAttempts,
    },
    "Test savollar yuklandi",
  );
};

// ===== SUBMIT TEST =====
const submitTestAnswers = async (req, res) => {
  const { testId } = req.params;
  const { answers } = req.body;

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      submission: { select: { studentId: true, extractedText: true } },
      results: {
        where: { studentId: req.user.id },
        select: { id: true, extraAllowed: true },
      },
    },
  });
  if (!test) return errorResponse(res, "Test topilmadi.", 404);
  if (test.submission.studentId !== req.user.id)
    return errorResponse(res, "Bu test sizga tegishli emas.", 403);

  const attempts = test.results.length;
  const extraAllowed = test.results.some((r) => r.extraAllowed);
  const maxAttempts = extraAllowed ? 3 : 2;

  if (attempts >= maxAttempts)
    return errorResponse(
      res,
      `Maksimal urinishlar soni tugadi (${maxAttempts}).`,
      400,
    );

  const total = test.questions.length;
  if (!answers || !Array.isArray(answers) || answers.length !== total)
    throw new AppError(`${total} ta savolga ham javob bering.`, 400);

  const { correctCount, percentage, grade, gradeNumber, results } =
    await gradeAnswers(test.questions, answers);

  let feedback = "";
  try {
    feedback = await generateFeedback(
      test.submission.extractedText,
      correctCount,
      percentage,
      results,
    );
  } catch {
    feedback = `${correctCount}/${total} to'g'ri javob. Foiz: ${percentage.toFixed(0)}%`;
  }

  const testResult = await prisma.testResult.create({
    data: {
      testId,
      studentId: req.user.id,
      answers,
      score: correctCount,
      percentage,
      grade,
      gradeNumber,
      feedback,
    },
  });

  // GradeReport — eng yaxshi natija saqlanadi
  const existingReport = await prisma.gradeReport.findUnique({
    where: { submissionId: test.submissionId },
  });

  if (!existingReport || gradeNumber >= existingReport.gradeNumber) {
    if (existingReport) {
      await prisma.gradeReport.update({
        where: { submissionId: test.submissionId },
        data: {
          grade,
          gradeNumber,
          percentage,
          aiSummary: feedback,
          testResultId: testResult.id,
        },
      });
    } else {
      await prisma.gradeReport.create({
        data: {
          submissionId: test.submissionId,
          studentId: req.user.id,
          testResultId: testResult.id,
          grade,
          gradeNumber,
          percentage,
          aiSummary: feedback,
        },
      });
    }
  }

  await prisma.submission.update({
    where: { id: test.submissionId },
    data: { status: "GRADED" },
  });

  return successResponse(
    res,
    {
      score: correctCount,
      totalQuestions: total,
      percentage,
      grade,
      gradeNumber,
      feedback,
      detailedResults: results,
      attemptNumber: attempts + 1,
    },
    "Test natijasi saqlandi!",
  );
};

// ===== GET MY SUBMISSIONS =====
const getMySubmissions = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const skip = (page - 1) * limit;

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: req.user.id },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        fileType: true,
        fileName: true,
        fileUrl: true,
        status: true,
        attemptNumber: true,
        createdAt: true,
        semester: { select: { id: true, name: true, subject: true } },
        tests: { select: { id: true } },
        gradeReport: {
          select: { gradeNumber: true, percentage: true, grade: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.submission.count({ where: { studentId: req.user.id } }),
  ]);

  return paginatedResponse(
    res,
    { submissions },
    { total, page, limit, totalPages: Math.ceil(total / limit) },
    "Ishlar",
  );
};

// ===== GET SUBMISSION RESULT =====
const getSubmissionResult = async (req, res) => {
  const { submissionId } = req.params;
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, studentId: req.user.id },
    include: {
      semester: { select: { name: true, subject: true } },
      tests: {
        include: {
          results: {
            where: { studentId: req.user.id },
            select: {
              id: true,
              score: true,
              percentage: true,
              grade: true,
              gradeNumber: true,
              feedback: true,
              answers: true,
              submittedAt: true,
              extraAllowed: true,
            },
            orderBy: { submittedAt: "asc" },
          },
        },
      },
      gradeReport: true,
    },
  });
  if (!submission) return errorResponse(res, "Topilmadi.", 404);
  return successResponse(res, { submission }, "Natija yuklandi");
};

// ===== GET ACTIVE SEMESTERS =====
const getActiveSemesters = async (req, res) => {
  const student = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { group: true },
  });
  if (!student?.group)
    return successResponse(res, { semesters: [] }, "Guruh topilmadi");

  const semesters = await prisma.semester.findMany({
    where: {
      groupName: student.group,
      status: "ACTIVE",
      deadline: { gte: new Date() },
    },
    include: { teacher: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const semestersWithCount = await Promise.all(
    semesters.map(async (sem) => {
      const myUploadCount = await prisma.submission.count({
        where: { studentId: req.user.id, semesterId: sem.id },
      });
      return { ...sem, myUploadCount };
    }),
  );

  return successResponse(
    res,
    { semesters: semestersWithCount },
    "Faol semesterlar",
  );
};

// ===== DASHBOARD STATS =====
const getDashboardStats = async (req, res) => {
  const studentId = req.user.id;

  const [total, graded, reports] = await Promise.all([
    prisma.submission.count({ where: { studentId } }),
    prisma.submission.count({ where: { studentId, status: "GRADED" } }),
    prisma.gradeReport.aggregate({
      where: { studentId },
      _avg: { gradeNumber: true, percentage: true },
    }),
  ]);

  return successResponse(
    res,
    {
      stats: {
        totalSubmissions: total,
        gradedSubmissions: graded,
        pendingSubmissions: total - graded,
        avgGrade: reports._avg.gradeNumber?.toFixed(1) || null,
        avgPercentage: reports._avg.percentage?.toFixed(1) || null,
      },
    },
    "Dashboard",
  );
};

module.exports = {
  uploadSubmission,
  getTestQuestions,
  submitTestAnswers,
  getMySubmissions,
  getSubmissionResult,
  getDashboardStats,
  getActiveSemesters,
};
