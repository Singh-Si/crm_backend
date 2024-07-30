const multer = require('multer');
const path = require('path');

const setupFileUpload = () => {
  const storage = multer.diskStorage({
    destination:function (req, file, cb) {
        // Specify the directory where uploaded files will be stored
        cb(null, path.join(__dirname,))
      },
    filename: (req, file, callback) => {
      callback(null, Date.now() + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: storage,
    // fileFilter: (req, file, callback) => {
    //   const allowedFileTypes = /pdf|jpg|jpeg|png|gif|mp4|mov|xlsx|csv/;
    //   const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    //   const mimetype = allowedFileTypes.test(file.mimetype);
    //   if (extname && mimetype) {
    //     return callback(null, true);
    //   } else {
    //     callback('Error: Only PDFs, images (jpg, jpeg, png, gif), videos (mp4, mov), Excel (xlsx), and CSV files are allowed.');
    //   }
    // }
  });

  return upload;
};

module.exports = setupFileUpload;
