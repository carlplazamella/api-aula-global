const multer = require('multer');
const path   = require('path');

// Carpeta del frontend donde quedarán las imágenes
const DEST = path.join(__dirname, '../../src/assets/images');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DEST);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `perfil-${req.params.id}-${Date.now()}${ext}`;
    cb(null, name);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten JPEG o PNG'));
  }
});
