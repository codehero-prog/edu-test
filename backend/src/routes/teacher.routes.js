const router = require("express").Router();
const {
  createStudent,
  getMyStudents,
  getStudentDetail,
  getGroupsWithStats,
  getSemesterStudents,
  getDashboardStats,
  toggleStudentStatus,
  deleteStudent,
  grantExtraChance,
  downloadSubmissionFile,
} = require("../controllers/teacher.controller");
const {
  createSemester,
  getSemesters,
  updateSemester,
  deleteSemester,
  allowExtraAttempt,
} = require("../controllers/semester.controller");
const { isTeacher } = require("../middleware/auth");

router.use(isTeacher);

router.get("/dashboard", getDashboardStats);

// Students
router.post("/students", createStudent);
router.get("/students", getMyStudents);
router.get("/students/:studentId", getStudentDetail);
router.patch("/students/:studentId/toggle", toggleStudentStatus);
router.delete("/students/:studentId", deleteStudent);

// Groups
router.get("/groups", getGroupsWithStats);
router.get("/groups/:group/students", getSemesterStudents);

// Semesters — semester.controller.js
router.post("/semesters", createSemester);
router.get("/semesters", getSemesters);
router.patch("/semesters/:semesterId", updateSemester);
router.delete("/semesters/:semesterId", deleteSemester);

// Extra attempt
router.post("/grades/:resultId/extra-attempt", allowExtraAttempt);

// Extra chance (eski)
router.patch("/grade-reports/:gradeReportId/extra-chance", grantExtraChance);

// Download
router.get("/submissions/:submissionId/download", downloadSubmissionFile);

module.exports = router;
