import express from 'express';
import multer from 'multer';
import { 
  uploadDocument, 
  getUserDocuments, 
  downloadOriginalFile,
  deleteDocument 
} from '../controllers/documentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.route('/')
  .get(protect, getUserDocuments);

router.route('/upload')
  .post(protect, upload.single('file'), uploadDocument);

// This route now handles both GET for downloading and DELETE for removing
router.route('/:id')
  .get(protect, downloadOriginalFile)
  .delete(protect, deleteDocument);

export default router;