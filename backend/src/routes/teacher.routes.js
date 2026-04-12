const router = require("express").Router();
const {
  createStudent, getMyStudents, getStudentDetail,
  getGroupsWithStats, getSemesterStudents,
  getDashboardStats, toggleStudentStatus, deleteStudent,
  createSemester, getSemesters, deleteSemester,
  grantExtraChance, downloadSubmissionFile,
} = require("../controllers/teacher.controller");
const { isTeacher } = require("../middleware/auth");

router.use(isTeacher);

router.get("/dashboard",              getDashboardStats);

// Students
router.post("/students",              createStudent);
router.get("/students",               getMyStudents);
router.get("/students/:studentId",    getStudentDetail);
router.patch("/students/:studentId/toggle", toggleStudentStatus);
router.delete("/students/:studentId", deleteStudent);

// Groups
router.get("/groups",                 getGroupsWithStats);
router.get("/groups/:group/students", getSemesterStudents);

// Semesters
router.post("/semesters",             createSemester);
router.get("/semesters",              getSemesters);
router.delete("/semesters/:id",       deleteSemester);

// Extra chance
router.patch("/grade-reports/:gradeReportId/extra-chance", grantExtraChance);

// Download
router.get("/submissions/:submissionId/download", downloadSubmissionFile);

module.exports = router;
