import React from 'react';

const PiiViewer = ({ document, piiToRedact, onPiiSelectionChange, onDetect, onRedact, onSave, onVerify, onGetLogs, loadingAction }) => {
  if (!document) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md h-full flex items-center justify-center">
        <p className="text-gray-500 text-xl">Please select a document to begin.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800 break-all">
        Actions for: <span className="font-bold">{document.filename}</span>
      </h2>

      {/* --- Action Buttons with Individual Loading States --- */}
      <div className="flex flex-wrap gap-4 mb-6 border-b pb-6">
        <button onClick={onDetect} disabled={loadingAction}  className="px-4 py-2 font-semibold text-white bg-gray-400 rounded-lg hover:bg-indigo-700  transition-colors">
          {loadingAction === 'detect' ? 'Detecting...' : 'Detect PII'}
        </button>
        <button
          onClick={onSave}
          disabled={loadingAction || document.detectedPii?.length === 0 || document.isSaved}
          className="btn-success "
        >
          {document.isSaved ? 'Original Saved ✔' : (loadingAction === 'save' ? 'Saving...' : 'Save & Log Original')}
        </button>
        <button
          onClick={onRedact}
          disabled={loadingAction || piiToRedact.size === 0}
          className="btn-danger"
        >
          {loadingAction === 'redact' ? 'Redacting...' : ` Redact Selected (${piiToRedact.size})`}
        </button>
        <button onClick={onVerify} disabled={loadingAction || !document.isSaved} className="btn-secondary">
          {loadingAction === 'verify' ? 'Verifying...' : 'Verify Original'}
        </button>
        <button onClick={onGetLogs} disabled={loadingAction || !document.isSaved} className="btn-secondary">
          {loadingAction === 'logs' ? 'Fetching...' : 'Get Access Logs'}
        </button>
      </div>

      {/* --- PII Display and Selection --- */}
      <div>
        <h3 className="text-xl font-semibold mb-3 text-gray-700">Select PII to Redact On-the-Go</h3>
        {document.detectedPii && document.detectedPii.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {document.detectedPii.map((pii, index) => (
              <label
                key={index}
                className="flex items-center bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={piiToRedact.has(pii.label)}
                  onChange={() => onPiiSelectionChange(pii.label)}
                  className="mr-4 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="flex-grow">
                  <strong className="text-indigo-700 font-semibold w-24">{pii.label}:</strong>
                  <span className="text-gray-800 ml-2">{pii.text}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No PII has been detected for this file yet. Click "Detect PII" to start.</p>
        )}
      </div>
    </div>
  );
};

export default PiiViewer;