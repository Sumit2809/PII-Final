import React, { useState } from 'react';
import api from '../services/api';

const FileUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setIsUploading(true);
    setError('');

    try {
      // The endpoint for uploading is '/api/documents/upload'
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploadSuccess(); // Notify the parent component to refresh
    } catch (err) {
      setError(err.response?.data?.message || 'File upload failed.');
    } finally {
      setIsUploading(false);
      setFile(null);
      e.target.reset();
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Upload New Document</h2>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            onChange={handleFileChange}
            className="flex-grow p-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <button
            type="submit"
            disabled={!file || isUploading}
            className="px-6 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </form>
    </div>
  );
};

export default FileUpload;