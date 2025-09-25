import Document from '../models/Document.js';
import asyncHandler from 'express-async-handler';
import crypto from 'crypto';

// @desc    Upload a new document
// @route   POST /api/documents/upload
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please select a file');
  }

  const originalFileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  const document = await Document.create({
    filename: req.file.originalname,
    originalFile: req.file.buffer,
    originalFileHash,
    user: req.user._id,
  });

  res.status(201).json({
    _id: document._id,
    filename: document.filename,
    createdAt: document.createdAt,
  });
});

// @desc    Get all documents for a user
// @route   GET /api/documents
const getUserDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ user: req.user._id })
    .select('-originalFile -redactedFile') // Exclude large buffers from the list
    .sort({ createdAt: -1 });

  res.json(documents);
});

// @desc    Download the original file
// @route   GET /api/documents/:id/original
const downloadOriginalFile = asyncHandler(async (req, res) => {
    const document = await Document.findOne({ _id: req.params.id, user: req.user._id });

    if (!document) {
        res.status(404);
        throw new Error("Document not found");
    }

    res.setHeader('Content-Disposition', `attachment; filename=${document.filename}`);
    res.send(document.originalFile);
});

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private
const deleteDocument = asyncHandler(async (req, res) => {
  // Find the document by its ID and ensure it belongs to the logged-in user
  const document = await Document.findOne({ _id: req.params.id, user: req.user._id });

  if (document) {
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: 'Document removed successfully' });
  } else {
    res.status(404);
    throw new Error('Document not found or user not authorized');
  }
});

export { uploadDocument, getUserDocuments, downloadOriginalFile, deleteDocument };