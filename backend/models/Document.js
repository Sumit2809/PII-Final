import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  // Core file details
  filename: { type: String, required: true },
  originalFile: { type: Buffer, required: true },
  originalFileHash: { type: String, required: true },
  
  // Link to the user who uploaded the document
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  
  // PII detection results from the Python service
  detectedPii: { type: [Object], default: [] },
  
  // Workflow and blockchain fields
  isSaved: { type: Boolean, default: false },
  blockchainTransactionId: { type: String },

  // --- NEW AUTO-DELETE FIELD ---
  // This field will hold the timestamp for when the document should expire.
  expireAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000), // Default to 5 minutes from creation
  },

  accessLogs: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    transactionId: { type: String },
  }],

}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// --- NEW TTL INDEX ---
// This tells MongoDB to automatically delete documents from this collection
// when the 'expireAt' time is reached. This index enables the auto-delete feature.
documentSchema.index({ "expireAt": 1 }, { expireAfterSeconds: 0 });

const Document = mongoose.model('Document', documentSchema);

export default Document;