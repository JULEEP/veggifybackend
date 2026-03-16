const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Make sure uploads/reels folder exists
const reelsDir = path.join(__dirname, '../uploads/reels');
if (!fs.existsSync(reelsDir)) {
  fs.mkdirSync(reelsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Reels folder mein save karo
    cb(null, reelsDir);
  },
  filename: function (req, file, cb) {
    // Unique filename banao: reel_vendorId_timestamp.ext
    const { vendorId } = req.params;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `reel_${vendorId}_${uniqueSuffix}${ext}`);
  }
});

// File filter - sirf video files allow karo
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm', 'video/quicktime'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Sirf video files allowed hain (MP4, MOV, AVI, MKV, WEBM)'), false);
  }
};

// Multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

module.exports = upload;