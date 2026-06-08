const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  addComment,
  listLocations,
  getIncidentStats,
  incidentReportPdf,
  incidentReportExcel,
  uploadAttachment,
  getMeta,
} = require('../controllers/incidentController');

// File upload config (reuse uploads dir)
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|mp4|mov|pdf|doc|docx/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

router.use(authenticate);

// Meta (dropdowns)
router.get('/meta',      getMeta);
router.get('/locations', listLocations);

// Stats / reports
router.get('/stats',          getIncidentStats);
router.get('/reports/pdf',    incidentReportPdf);
router.get('/reports/excel',  incidentReportExcel);

// Tickets CRUD
router.get('/',          listTickets);
router.post('/',         createTicket);
router.get('/:id',       getTicket);
router.patch('/:id',     updateTicket);

// Activities
router.post('/:id/comments', addComment);

// Attachments
router.post('/:id/attachments', upload.single('file'), uploadAttachment);

module.exports = router;
