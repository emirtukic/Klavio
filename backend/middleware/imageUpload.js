const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function imageFileFilter(req, file, cb) {
  const path = require('path');
  const ext = path.extname(file.originalname).toLowerCase();
  cb(IMAGE_EXTS.includes(ext) ? null : new Error('Tip fajla nije podržan'), IMAGE_EXTS.includes(ext));
}

module.exports = { IMAGE_EXTS, imageFileFilter };
