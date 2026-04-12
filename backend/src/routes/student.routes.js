const router = require("express").Router();
const {
  uploadSubmission, getTestQuestions, submitTestAnswers,
  getMySubmissions, getSubmissionResult, getDashboardStats, getSemesterInfo,
  downloadFile,
} = require("../controllers/student.controller");
const { isStudent } = require("../middleware/auth");
const { upload, processUpload } = require("../middleware/upload");

router.use(isStudent);

router.get("/dashboard",                          getDashboardStats);
router.get("/semester",                           getSemesterInfo);
router.post("/submissions", upload.single("file"), processUpload, uploadSubmission);
router.get("/submissions",                        getMySubmissions);
router.get("/submissions/:submissionId/result",   getSubmissionResult);
router.get("/submissions/:submissionId/download", downloadFile);
router.get("/tests/:testId",                      getTestQuestions);
router.post("/tests/:testId/submit",              submitTestAnswers);

module.exports = router;
