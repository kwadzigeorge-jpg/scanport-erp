const router = require('express').Router();
const { expiryReportPdf, expiryReportExcel, noticeReportPdf, noticeReportExcel, nraLetter } = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/expiry/pdf',           expiryReportPdf);
router.get('/expiry/excel',         expiryReportExcel);
router.get('/notices/pdf',          noticeReportPdf);
router.get('/notices/excel',        noticeReportExcel);
router.get('/nra-letter/:certificationId', nraLetter);

module.exports = router;
