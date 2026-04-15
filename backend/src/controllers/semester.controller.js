const { z } = require("zod");
const prisma = require("../config/prisma");
const { successResponse, errorResponse } = require("../utils/response");

const toInt = (val, def) => {
  const n = parseInt(val);
  return isNaN(n) ? def : n;
};

const createSemester = async (req, res) => {
  const body = {
    ...req.body,
    maxUploads: toInt(req.body.maxUploads, 2),
    questionCount: toInt(req.body.questionCount, 5),
  };
  const schema = z.object({
    name: z.string().min(2),
    groupName: z.string().min(1),
    subject: z.string().min(1),
    deadline: z.string().min(1),
    maxUploads: z.number().int().min(1).max(10).default(2),
    questionCount: z.number().int().min(1).max(30).default(5),
    customPrompt: z.string().max(1000).optional().nullable(),
  });
  const data = schema.parse(body);
  const teacher = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { groups: true },
  });
  if (teacher.groups.length > 0 && !teacher.groups.includes(data.groupName))
    return errorResponse(
      res,
      "Faqat o'z guruhlaringizga semester yarata olasiz",
      403,
    );
  const semester = await prisma.semester.create({
    data: {
      name: data.name,
      groupName: data.groupName,
      subject: data.subject,
      deadline: new Date(data.deadline),
      maxUploads: data.maxUploads,
      questionCount: data.questionCount,
      customPrompt: data.customPrompt || null,
      status: "ACTIVE",
      teacherId: req.user.id,
    },
  });
  return successResponse(res, { semester }, "Semester yaratildi", 201);
};

const getSemesters = async (req, res) => {
  const group = req.query.group || undefined;
  const semesters = await prisma.semester.findMany({
    where: { teacherId: req.user.id, ...(group && { groupName: group }) },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return successResponse(res, { semesters }, "Semesterlar ro'yxati");
};

const updateSemester = async (req, res) => {
  const { semesterId } = req.params;
  const body = {
    ...req.body,
    ...(req.body.maxUploads != null && {
      maxUploads: toInt(req.body.maxUploads, 2),
    }),
    ...(req.body.questionCount != null && {
      questionCount: toInt(req.body.questionCount, 5),
    }),
  };
  const schema = z.object({
    name: z.string().min(2).optional(),
    deadline: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "FINISHED"]).optional(),
    maxUploads: z.number().int().min(1).max(10).optional(),
    questionCount: z.number().int().min(1).max(30).optional(),
    customPrompt: z.string().max(1000).optional().nullable(),
  });
  const data = schema.parse(body);
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, teacherId: req.user.id },
  });
  if (!semester) return errorResponse(res, "Semester topilmadi.", 404);
  const updated = await prisma.semester.update({
    where: { id: semesterId },
    data: {
      ...data,
      ...(data.deadline && { deadline: new Date(data.deadline) }),
    },
  });
  return successResponse(res, { semester: updated }, "Semester yangilandi");
};

const deleteSemester = async (req, res) => {
  const { semesterId } = req.params;
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, teacherId: req.user.id },
  });
  if (!semester) return errorResponse(res, "Semester topilmadi.", 404);
  await prisma.semester.delete({ where: { id: semesterId } });
  return successResponse(res, null, "Semester o'chirildi");
};

const allowExtraAttempt = async (req, res) => {
  const { resultId } = req.params;
  const result = await prisma.testResult.findFirst({
    where: { id: resultId, student: { teacherId: req.user.id } },
  });
  if (!result) return errorResponse(res, "Natija topilmadi.", 404);
  const updated = await prisma.testResult.update({
    where: { id: resultId },
    data: { extraAllowed: true },
  });
  return successResponse(
    res,
    { result: updated },
    "3-urinishga ruxsat berildi",
  );
};

module.exports = {
  createSemester,
  getSemesters,
  updateSemester,
  deleteSemester,
  allowExtraAttempt,
};
