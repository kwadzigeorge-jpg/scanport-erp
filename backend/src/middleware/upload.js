const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/maintenance');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xlsx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('File type not allowed. Use PDF, image, or Office documents.'));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
