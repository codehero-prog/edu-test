const router = require("express").Router();
const {
  uploadSubmission,
  getTestQuestions,
  submitTestAnswers,
  getMySubmissions,
  getSubmissionResult,
  getDashboardStats,
  getActiveSemesters,
  deleteSubmission,
} = require("../controllers/student.controller");
const { isStudent } = require("../middleware/auth");
const { upload, processUpload } = require("../middleware/upload");

router.use(isStudent);

router.get("/dashboard", getDashboardStats);
router.get("/semesters", getActiveSemesters);
router.post(
  "/submissions",
  upload.single("file"),
  processUpload,
  uploadSubmission,
);
router.get("/submissions", getMySubmissions);
router.get("/submissions/:submissionId/result", getSubmissionResult);
router.delete("/submissions/:submissionId", deleteSubmission);
router.get("/tests/:testId", getTestQuestions);
router.post("/tests/:testId/submit", submitTestAnswers);

module.exports = router;
