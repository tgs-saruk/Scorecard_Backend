const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = './uploads/';
    if (file.mimetype.startsWith('image/')) {
      uploadPath = './uploads/photos/'; 
      const subdirectory = req.query.type === 'house' ? 'house' : 'senator';
      uploadPath = path.join(uploadPath, subdirectory);

    } else if (
      file.mimetype === 'application/pdf' || 
      file.mimetype === 'text/html' ||
      file.mimetype === 'application/msword' || 
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      uploadPath = './uploads/documents/'; 
    }
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);  
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`); 
  }
});
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg' ];
  const allowedDocumentTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/html",
  ];
  if (allowedImageTypes.includes(file.mimetype) || allowedDocumentTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png, .pdf, .doc, and .docx files are allowed'), false);
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } 
});


module.exports = upload;

