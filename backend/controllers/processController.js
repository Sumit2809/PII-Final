import Document from '../models/Document.js';
import asyncHandler from 'express-async-handler';
import axios from 'axios';
import crypto from 'crypto';
import { 
  logDocumentCreation, 
  logDocumentAccess,
  verifyDocumentIntegrity,
  getDocumentAccessHistory
} from '../services/blockchainService.js';

// @desc    Detect PII in a document
// @route   POST /api/process/detect/:id
const detectPii = asyncHandler(async (req, res) => {
  const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  const file_b64 = document.originalFile.toString('base64');

  const { data } = await axios.post(`${process.env.PYTHON_SERVICE_URL}/detect`, {
    file_b64,
    filename: document.filename,
  });

  document.detectedPii = data.entities;
  await document.save();

  res.json(data);
});

// @desc    Redact a document on-the-fly and stream it for download
// @route   POST /api/process/redact/:id
const redactDocument = asyncHandler(async (req, res) => {
  const { labels } = req.body;
  const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  const file_b64 = document.originalFile.toString('base64');

  const { data } = await axios.post(`${process.env.PYTHON_SERVICE_URL}/redact`, {
    file_b64,
    filename: document.filename,
    labels,
  });

  const redactedFileBuffer = Buffer.from(data.file_b64, 'base64');
  
  res.setHeader('Content-Disposition', `attachment; filename=${data.filename}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.send(redactedFileBuffer);
});

// @desc    Save the ORIGINAL document's hash and log it on the blockchain
// @route   POST /api/process/save/:id
const saveAndLogDocument = asyncHandler(async (req, res) => {
    const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
    if (!document) {
        res.status(404);
        throw new Error('Document not found.');
    }
    if (document.isSaved) {
        res.status(400);
        throw new Error('Document has already been saved and logged.');
    }
    
    const transactionId = await logDocumentCreation(document.originalFileHash, req.user.address);

    document.isSaved = true;
    document.blockchainTransactionId = transactionId;
    
    // --- THIS LINE CANCELS THE DELETION TIMER ---
    document.expireAt = undefined; 
    
    await document.save();

    res.json({ message: 'Original document hash logged on blockchain successfully.', transactionId });
});

// @desc    Verify the integrity of a saved ORIGINAL document
// @route   GET /api/process/verify/:id
const verifyDocument = asyncHandler(async (req, res) => {
    const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
    if (!document || !document.isSaved) {
        res.status(400);
        throw new Error('Document not found or was not saved.');
    }

    const currentHash = crypto.createHash('sha256').update(document.originalFile).digest('hex');
    if (currentHash !== document.originalFileHash) {
        return res.json({
            integrity: false,
            message: 'Verification Failed: The stored file does not match its original hash.',
            onChainHash: "N/A",
            currentHash,
        });
    }

    const isValidOnChain = await verifyDocumentIntegrity(document.originalFileHash);

    res.json({
        integrity: isValidOnChain,
        message: isValidOnChain ? 'Document integrity verified successfully against the blockchain.' : 'Verification Failed: The hash on the blockchain does not match.',
        onChainHash: document.originalFileHash,
        currentHash,
    });
});

// @desc    Get the blockchain access logs for a document
// @route   GET /api/process/logs/:id
const getAccessLogs = asyncHandler(async (req, res) => {
    const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
    if (!document || !document.isSaved) {
        res.status(400);
        throw new Error('Document not found or was not saved.');
    }
    
    const txId = await logDocumentAccess(document.originalFileHash, req.user.address);
    const history = await getDocumentAccessHistory(document.originalFileHash);

    res.json({ message: `Access logged with tx: ${txId}`, history });
});

export { detectPii, redactDocument, saveAndLogDocument, verifyDocument, getAccessLogs };