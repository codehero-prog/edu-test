const bcrypt = require("bcryptjs");
const { z }  = require("zod");
const prisma = require("../config/prisma");
const { successResponse, errorResponse, paginatedResponse } = require("../utils/response");

// ===== CREATE STUDENT =====
const createStudent = async (req, res) => {
  const { name, email, password, group } = z.object({
    name:     z.string().min(2),
    email:    z.string().email(),
    password: z.string().min(6),
    group:    z.string().min(1, "Guruh kiritilishi shart"),
  }).parse(req.body);

  const teacher = await prisma.user.findUnique({
    where: { id: req.user.id }, select: { groups: true },
  });
  if (teacher.groups.length > 0 && !teacher.groups.includes(group)) {
    return errorResponse(res, `Siz faqat shu guruhlardan biriga talaba qo'sha olasiz: ${teacher.groups.join(", ")}`, 403);
  }
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (exists) return errorResponse(res, "Bu email allaqachon ishlatilgan.", 409);

  const student = await prisma.user.create({
    data: {
      name, email: email.toLowerCase().trim(),
      password: await bcrypt.hash(password, 12),
      role: "STUDENT", group, teacherId: req.user.id, createdById: req.user.id,
    },
    select: { id: true, name: true, email: true, group: true, role: true, isActive: true, createdAt: true },
  });
  return successResponse(res, { student }, "Talaba yaratildi", 201);
};

// ===== GET MY STUDENTS =====
const getMyStudents = async (req, res) => {
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 50;
  const search = req.query.search || "";
  const group  = req.query.group  || "";
  const skip   = (page - 1) * limit;

  const teacher = await prisma.user.findUnique({
    where: { id: req.user.id }, select: { groups: true },
  });

  const where = {
    teacherId: req.user.id, role: "STUDENT",
    ...(group  && { group }),
    ...(search && { OR: [
      { name:  { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ]}),
  };

  const [students, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take: limit,
      select: {
        id: true, name: true, email: true, group: true,
        isActive: true, createdAt: true,
        _count: { select: { submissions: true } },
        gradeReports: {
          take: 1, orderBy: { createdAt: "desc" },
          select: { gradeNumber: true, percentage: true },
        },
      },
      orderBy: [{ group: "asc" }, { name: "asc" }],
    }),
    prisma.user.count({ where }),
  ]);

  return paginatedResponse(res, { students, teacherGroups: teacher.groups },
    { total, page, limit, totalPages: Math.ceil(total / limit) }, "Talabalar");
};

// ===== GET STUDENT DETAIL =====
const getStudentDetail = async (req, res) => {
  const { studentId } = req.params;
  const student = await prisma.user.findFirst({
    where: { id: studentId, teacherId: req.user.id, role: "STUDENT" },
    include: {
      submissions: {
        orderBy: { createdAt: "desc" },
        include: {
          gradeReport: true,
          tests: { include: { results: { select: { score: true, percentage: true, gradeNumber: true, submittedAt: true } } } },
        },
      },
    },
  });
  if (!student) return errorResponse(res, "Talaba topilmadi.", 404);
  return successResponse(res, { student }, "Talaba ma'lumotlari");
};

// ===== GET GROUPS WITH STATS =====
const getGroupsWithStats = async (req, res) => {
  const teacher = await prisma.user.findUnique({
    where: { id: req.user.id }, select: { groups: true, subject: true },
  });

  const groupStats = await Promise.all(
    teacher.groups.map(async (group) => {
      const [totalStudents, submittedStudents, semester] = await Promise.all([
        prisma.user.count({ where: { teacherId: req.user.id, group, role: "STUDENT" } }),
        prisma.user.count({
          where: {
            teacherId: req.user.id, group, role: "STUDENT",
            submissions: { some: { status: "GRADED" } },
          },
        }),
        prisma.semester.findFirst({
          where: { teacherId: req.user.id, group, isActive: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return {
        group, totalStudents,
        submittedStudents,
        notSubmittedStudents: totalStudents - submittedStudents,
        semester,
      };
    })
  );

  return successResponse(res, { groups: groupStats, subject: teacher.subject }, "Guruhlar");
};

// ===== GET SEMESTER STUDENTS (group detail) =====
const getSemesterStudents = async (req, res) => {
  const { group } = req.params;

  const [students, semester] = await Promise.all([
    prisma.user.findMany({
      where: { teacherId: req.user.id, group, role: "STUDENT" },
      include: {
        submissions: {
          orderBy: { createdAt: "desc" },
          include: {
            gradeReport: {
              select: { id: true, grade: true, gradeNumber: true, percentage: true, extraChance: true },
            },
            tests: {
              select: { id: true, results: { select: { score: true, percentage: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.semester.findFirst({
      where: { teacherId: req.user.id, group, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return successResponse(res, { students, semester, group }, "Guruh talabalari");
};

// ===== DASHBOARD STATS =====
const getDashboardStats = async (req, res) => {
  const teacher = await prisma.user.findUnique({
    where: { id: req.user.id }, select: { subject: true, groups: true },
  });

  const [totalStudents, totalSubmissions, gradedSubmissions] = await Promise.all([
    prisma.user.count({ where: { teacherId: req.user.id, role: "STUDENT" } }),
    prisma.submission.count({ where: { student: { teacherId: req.user.id } } }),
    prisma.submission.count({ where: { status: "GRADED", student: { teacherId: req.user.id } } }),
  ]);

  return successResponse(res, {
    stats: {
      subject: teacher.subject, groups: teacher.groups,
      totalGroups: teacher.groups.length,
      totalStudents, totalSubmissions,
      gradedSubmissions,
      pendingSubmissions: totalSubmissions - gradedSubmissions,
    },
  }, "Dashboard");
};

// ===== TOGGLE STUDENT =====
const toggleStudentStatus = async (req, res) => {
  const { studentId } = req.params;
  const student = await prisma.user.findFirst({
    where: { id: studentId, teacherId: req.user.id, role: "STUDENT" },
  });
  if (!student) return errorResponse(res, "Talaba topilmadi.", 404);
  const updated = await prisma.user.update({
    where: { id: studentId }, data: { isActive: !student.isActive },
    select: { id: true, name: true, isActive: true },
  });
  return successResponse(res, { student: updated },
    `Talaba ${updated.isActive ? "faollashtirildi" : "bloklandi"}`);
};

// ===== DELETE STUDENT =====
const deleteStudent = async (req, res) => {
  const { studentId } = req.params;
  const student = await prisma.user.findFirst({
    where: { id: studentId, teacherId: req.user.id, role: "STUDENT" },
  });
  if (!student) return errorResponse(res, "Talaba topilmadi.", 404);
  await prisma.user.delete({ where: { id: studentId } });
  return successResponse(res, null, "Talaba o'chirildi");
};

// ===== CREATE SEMESTER =====
const createSemester = async (req, res) => {
  const { name, group, startDate, deadline } = z.object({
    name:      z.string().min(2),
    group:     z.string().min(1),
    startDate: z.string(),
    deadline:  z.string(),
  }).parse(req.body);

  const teacher = await prisma.user.findUnique({
    where: { id: req.user.id }, select: { groups: true },
  });
  if (!teacher.groups.includes(group)) {
    return errorResponse(res, "Bu guruh sizga tegishli emas.", 403);
  }

  // Eski aktiv semesterni o'chirish
  await prisma.semester.updateMany({
    where: { teacherId: req.user.id, group, isActive: true },
    data: { isActive: false },
  });

  const semester = await prisma.semester.create({
    data: {
      name, group, teacherId: req.user.id,
      startDate: new Date(startDate),
      deadline:  new Date(deadline),
      isActive: true,
    },
  });
  return successResponse(res, { semester }, "Semestr boshlandi", 201);
};

// ===== GET SEMESTERS =====
const getSemesters = async (req, res) => {
  const { group } = req.query;
  const semesters = await prisma.semester.findMany({
    where: { teacherId: req.user.id, ...(group && { group }) },
    orderBy: { createdAt: "desc" },
  });
  return successResponse(res, { semesters }, "Semestrlar");
};

// ===== DELETE SEMESTER =====
const deleteSemester = async (req, res) => {
  const { id } = req.params;
  const sem = await prisma.semester.findFirst({
    where: { id, teacherId: req.user.id },
  });
  if (!sem) return errorResponse(res, "Semestr topilmadi.", 404);
  await prisma.semester.delete({ where: { id } });
  return successResponse(res, null, "Semestr o'chirildi");
};

// ===== GRANT EXTRA CHANCE =====
const grantExtraChance = async (req, res) => {
  const { gradeReportId } = req.params;
  const report = await prisma.gradeReport.findFirst({
    where: { id: gradeReportId, student: { teacherId: req.user.id } },
  });
  if (!report) return errorResponse(res, "Baho topilmadi.", 404);
  const updated = await prisma.gradeReport.update({
    where: { id: gradeReportId },
    data: { extraChance: true },
  });
  return successResponse(res, { report: updated }, "3-imkoniyat berildi");
};

// ===== DOWNLOAD FILE (teacher) =====
const downloadSubmissionFile = async (req, res) => {
  const prisma = require("../config/prisma");
  const { AppError } = require("../middleware/errorHandler");

  const submission = await prisma.submission.findFirst({
    where: { id: req.params.submissionId },
    select: { fileUrl: true, fileName: true, student: { select: { teacherId: true } } },
  });
  if (!submission) throw new AppError("Fayl topilmadi.", 404);
  if (submission.student.teacherId !== req.user.id) throw new AppError("Ruxsat yo'q.", 403);

  const response = await fetch(submission.fileUrl);
  if (!response.ok) throw new AppError("Fayl yuklab bo'lmadi.", 500);

  const buffer = await response.arrayBuffer();
  const safeName = encodeURIComponent(submission.fileName);

  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${safeName}`);
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(Buffer.from(buffer));
};

module.exports = {
  createStudent, getMyStudents, getStudentDetail,
  getGroupsWithStats, getSemesterStudents,
  getDashboardStats, toggleStudentStatus, deleteStudent,
  createSemester, getSemesters, deleteSemester,
  grantExtraChance, downloadSubmissionFile,
};
