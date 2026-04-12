const prisma = require("../config/prisma");
const { parseFile }    = require("../services/file.service");
const { generateTests, gradeAnswers, generateFeedback } = require("../services/ai.service");
const { uploadFile }   = require("../services/cloudinary.service");
const { successResponse, errorResponse, paginatedResponse } = require("../utils/response");
const { AppError }     = require("../middleware/errorHandler");

// ===== UPLOAD SUBMISSION =====
const uploadSubmission = async (req, res) => {
  const { title } = req.body;
  if (!title || title.trim().length < 3)
    throw new AppError("Sarlavha kamida 3 belgi bo'lishi kerak.", 400);
  if (!req.file) throw new AppError("Fayl yuklanmadi.", 400);

  const studentId = req.user.id;

  // Semesterni tekshirish
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { group: true, teacherId: true },
  });

  if (student.group && student.teacherId) {
    const semester = await prisma.semester.findFirst({
      where: {
        teacherId: student.teacherId,
        group: student.group,
        isActive: true,
      },
    });

    if (!semester) {
      throw new AppError("Semestr hali boshlanmagan. O'qituvchingizga murojaat qiling.", 400);
    }

    const now = new Date();
    if (now < semester.startDate) {
      throw new AppError("Semestr hali boshlanmagan.", 400);
    }
    if (now > semester.deadline) {
      throw new AppError("Semestr muddati tugagan. Fayl yuklash mumkin emas.", 400);
    }

    // 2 ta urinish limiti tekshirish
    const submissionCount = await prisma.submission.count({
      where: { studentId, semesterId: semester.id },
    });

    // 3-imkoniyat tekshirish
    const hasExtraChance = await prisma.gradeReport.findFirst({
      where: { studentId, extraChance: true },
    });

    const maxAttempts = hasExtraChance ? 3 : 2;
    if (submissionCount >= maxAttempts) {
      throw new AppError(`Bu semestrda maksimal ${maxAttempts} ta fayl yuklash mumkin.`, 400);
    }

    // Upload
    const fileType  = req.fileType;
    const buffer    = req.file.buffer;
    const origName  = req.file.originalname;
    const { url: fileUrl } = await uploadFile(buffer, origName);

    let parsedData;
    try { parsedData = await parseFile(buffer, fileType); }
    catch (e) { throw new AppError(e.message, 400); }

    const submission = await prisma.submission.create({
      data: {
        title: title.trim(), fileUrl, fileType,
        fileName: origName,
        extractedText: parsedData.text,
        status: "PROCESSING",
        studentId,
        semesterId: semester.id,
        attemptNumber: submissionCount + 1,
      },
    });

    let questions;
    try { questions = await generateTests(parsedData.text, title); }
    catch (e) {
      console.error("🔴 AI XATO:", e.message);
      await prisma.submission.update({ where: { id: submission.id }, data: { status: "FAILED" } });
      throw new AppError("AI test yaratishda xatolik. Qayta urinib ko'ring.", 500);
    }

    const test = await prisma.test.create({
      data: { submissionId: submission.id, questions },
    });
    await prisma.submission.update({ where: { id: submission.id }, data: { status: "TESTED" } });

    return successResponse(res, {
      submissionId: submission.id, testId: test.id,
      title: submission.title, fileType, wordCount: parsedData.wordCount,
      attemptNumber: submission.attemptNumber, maxAttempts,
    }, "Fayl yuklandi va testlar tayyor!", 201);
  }

  // Semestr yo'q (eski talabalar uchun fallback)
  const fileType = req.fileType;
  const buffer   = req.file.buffer;
  const origName = req.file.originalname;
  const { url: fileUrl } = await uploadFile(buffer, origName);

  let parsedData;
  try { parsedData = await parseFile(buffer, fileType); }
  catch (e) { throw new AppError(e.message, 400); }

  const submission = await prisma.submission.create({
    data: {
      title: title.trim(), fileUrl, fileType,
      fileName: origName, extractedText: parsedData.text,
      status: "PROCESSING", studentId,
    },
  });

  let questions;
  try { questions = await generateTests(parsedData.text, title); }
  catch (e) {
    await prisma.submission.update({ where: { id: submission.id }, data: { status: "FAILED" } });
    throw new AppError("AI test yaratishda xatolik.", 500);
  }

  const test = await prisma.test.create({
    data: { submissionId: submission.id, questions },
  });
  await prisma.submission.update({ where: { id: submission.id }, data: { status: "TESTED" } });

  return successResponse(res, {
    submissionId: submission.id, testId: test.id,
    title: submission.title, fileType, wordCount: parsedData.wordCount,
  }, "Fayl yuklandi va testlar tayyor!", 201);
};

// ===== GET TEST QUESTIONS =====
const getTestQuestions = async (req, res) => {
  const { testId } = req.params;
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      submission: { select: { studentId: true, title: true } },
      results: { where: { studentId: req.user.id }, select: { id: true } },
    },
  });
  if (!test) return errorResponse(res, "Test topilmadi.", 404);
  if (test.submission.studentId !== req.user.id)
    return errorResponse(res, "Bu test sizga tegishli emas.", 403);
  if (test.results.length > 0)
    return errorResponse(res, "Siz bu testni allaqachon topshirgansiz.", 400);

  const safeQuestions = test.questions.map((q, i) => ({
    id: i + 1, question: q.question, options: q.options,
  }));

  return successResponse(res, {
    testId: test.id, submissionTitle: test.submission.title,
    questions: safeQuestions, totalQuestions: safeQuestions.length,
  }, "Test savollar yuklandi");
};

// ===== SUBMIT TEST =====
const submitTestAnswers = async (req, res) => {
  const { testId } = req.params;
  const { answers } = req.body;
  if (!answers || !Array.isArray(answers) || answers.length !== 5)
    throw new AppError("5 ta savolga ham javob bering.", 400);

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      submission: { select: { studentId: true, extractedText: true } },
      results: { where: { studentId: req.user.id }, select: { id: true } },
    },
  });
  if (!test) return errorResponse(res, "Test topilmadi.", 404);
  if (test.submission.studentId !== req.user.id)
    return errorResponse(res, "Bu test sizga tegishli emas.", 403);
  if (test.results.length > 0)
    return errorResponse(res, "Siz bu testni allaqachon topshirgansiz.", 400);

  const { correctCount, percentage, grade, gradeNumber, results } =
    await gradeAnswers(test.questions, answers);

  let feedback = "";
  try {
    feedback = await generateFeedback(test.submission.extractedText, correctCount, percentage, results);
  } catch {
    feedback = `${correctCount}/5 to'g'ri javob. Ball: ${percentage.toFixed(0)}%`;
  }

  const testResult = await prisma.testResult.create({
    data: { testId, studentId: req.user.id, answers, score: correctCount, percentage, grade, gradeNumber, feedback },
  });

  await prisma.gradeReport.create({
    data: {
      submissionId: test.submissionId, studentId: req.user.id,
      testResultId: testResult.id, grade, gradeNumber, percentage, aiSummary: feedback,
    },
  });

  await prisma.submission.update({ where: { id: test.submissionId }, data: { status: "GRADED" } });

  return successResponse(res, {
    score: correctCount, totalQuestions: 5, percentage,
    grade, gradeNumber, feedback, detailedResults: results,
  }, "Test natijasi saqlandi!");
};

// ===== GET MY SUBMISSIONS =====
const getMySubmissions = async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip  = (page - 1) * limit;

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: req.user.id },
      skip, take: limit,
      select: {
        id: true, title: true, fileType: true, fileName: true,
        fileUrl: true, status: true, attemptNumber: true, createdAt: true,
        tests: { select: { id: true } },
        gradeReport: { select: { gradeNumber: true, percentage: true, grade: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.submission.count({ where: { studentId: req.user.id } }),
  ]);

  return paginatedResponse(res, { submissions },
    { total, page, limit, totalPages: Math.ceil(total / limit) }, "Ishlar");
};

// ===== GET SUBMISSION RESULT =====
const getSubmissionResult = async (req, res) => {
  const { submissionId } = req.params;
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, studentId: req.user.id },
    include: {
      tests: {
        include: {
          results: {
            where: { studentId: req.user.id },
            select: {
              score: true, percentage: true, grade: true,
              gradeNumber: true, feedback: true, answers: true, submittedAt: true,
            },
          },
        },
      },
      gradeReport: true,
    },
  });
  if (!submission) return errorResponse(res, "Topilmadi.", 404);
  return successResponse(res, { submission }, "Natija yuklandi");
};

// ===== DASHBOARD STATS =====
const getDashboardStats = async (req, res) => {
  const studentId = req.user.id;
  const student   = await prisma.user.findUnique({
    where: { id: studentId }, select: { group: true, teacherId: true },
  });

  const [totalSubmissions, gradedSubmissions, avgGrade, recentSubmissions] = await Promise.all([
    prisma.submission.count({ where: { studentId } }),
    prisma.submission.count({ where: { studentId, status: "GRADED" } }),
    prisma.gradeReport.aggregate({
      where: { studentId }, _avg: { gradeNumber: true, percentage: true },
    }),
    prisma.submission.findMany({
      where: { studentId }, take: 5, orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, status: true, fileType: true, createdAt: true, attemptNumber: true,
        gradeReport: { select: { gradeNumber: true, percentage: true } },
        tests: { select: { id: true } },
      },
    }),
  ]);

  // Aktiv semestr
  let semester = null;
  if (student.group && student.teacherId) {
    semester = await prisma.semester.findFirst({
      where: { teacherId: student.teacherId, group: student.group, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // Bu semestrda nechta fayl yuklanganini
  let semesterSubmissions = 0;
  let maxAttempts = 2;
  if (semester) {
    semesterSubmissions = await prisma.submission.count({
      where: { studentId, semesterId: semester.id },
    });
    const hasExtraChance = await prisma.gradeReport.findFirst({
      where: { studentId, extraChance: true },
    });
    if (hasExtraChance) maxAttempts = 3;
  }

  return successResponse(res, {
    stats: {
      totalSubmissions, gradedSubmissions,
      pendingSubmissions: totalSubmissions - gradedSubmissions,
      notSubmitted: Math.max(0, maxAttempts - semesterSubmissions),
      avgGrade:      avgGrade._avg.gradeNumber?.toFixed(1) || null,
      avgPercentage: avgGrade._avg.percentage?.toFixed(1)  || null,
      recentSubmissions, semester, semesterSubmissions, maxAttempts,
    },
  }, "Dashboard");
};

// ===== GET SEMESTER INFO =====
const getSemesterInfo = async (req, res) => {
  const student = await prisma.user.findUnique({
    where: { id: req.user.id }, select: { group: true, teacherId: true },
  });
  if (!student.group || !student.teacherId)
    return successResponse(res, { semester: null }, "Semestr yo'q");

  const semester = await prisma.semester.findFirst({
    where: { teacherId: student.teacherId, group: student.group, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  let submissionCount = 0;
  let maxAttempts = 2;
  if (semester) {
    submissionCount = await prisma.submission.count({
      where: { studentId: req.user.id, semesterId: semester.id },
    });
    const hasExtra = await prisma.gradeReport.findFirst({
      where: { studentId: req.user.id, extraChance: true },
    });
    if (hasExtra) maxAttempts = 3;
  }

  return successResponse(res, {
    semester, submissionCount, maxAttempts,
    canUpload: semester
      ? (new Date() >= new Date(semester.startDate) &&
         new Date() <= new Date(semester.deadline) &&
         submissionCount < maxAttempts)
      : false,
  }, "Semestr ma'lumotlari");
};

// ===== DOWNLOAD FILE =====
const downloadFile = async (req, res) => {
  const submission = await prisma.submission.findFirst({
    where: { id: req.params.submissionId, studentId: req.user.id },
    select: { fileUrl: true, fileName: true, fileType: true },
  });
  if (!submission) throw new AppError("Fayl topilmadi.", 404);

  const response = await fetch(submission.fileUrl);
  if (!response.ok) throw new AppError("Fayl yuklab bo'lmadi.", 500);

  const buffer = await response.arrayBuffer();
  const safeName = encodeURIComponent(submission.fileName);

  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${safeName}`);
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(Buffer.from(buffer));
};

module.exports = {
  uploadSubmission, getTestQuestions, submitTestAnswers,
  getMySubmissions, getSubmissionResult, getDashboardStats, getSemesterInfo,
  downloadFile,
};
