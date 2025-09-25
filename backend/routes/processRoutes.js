import express from 'express';
import {
  detectPii,
  redactDocument,
  saveAndLogDocument,
  verifyDocument,
  getAccessLogs,
} from '../controllers/processController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/detect/:id', protect, detectPii);
router.post('/redact/:id', protect, redactDocument);
router.post('/save/:id', protect, saveAndLogDocument);
router.get('/verify/:id', protect, verifyDocument);
router.get('/logs/:id', protect, getAccessLogs);

export default router;