import React from 'react';

const DocumentList = ({ documents, selectedDocId, onSelectDocument, onDeleteDocument }) => {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Select a Document</h2>
      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc._id}
              className={`p-3 rounded-lg transition-colors flex justify-between items-center ${
                selectedDocId === doc._id
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100'
              }`}
            >
              <div onClick={() => onSelectDocument(doc)} className="cursor-pointer flex-grow break-all pr-4">
                <p className="font-semibold">{doc.filename}</p>
                <p className="text-xs text-gray-500">{doc.isSaved ? 'Saved & Logged' : 'Not Saved'}</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevents the selection handler from firing
                  onDeleteDocument(doc._id);
                }}
                className="text-red-500 hover:text-red-700 font-bold text-lg px-2 rounded-full leading-none"
                title="Delete Document"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">You haven't uploaded any documents yet.</p>
      )}
    </div>
  );
};

export default DocumentList;