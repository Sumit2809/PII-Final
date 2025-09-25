import React, { useState, useEffect } from 'react';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import DocumentList from '../components/DocumentList';
import PiiViewer from '../components/PiiViewer';
import Modal from '../components/Modal';

const DashboardPage = () => {
  // --- STATE MANAGEMENT ---
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [piiToRedact, setPiiToRedact] = useState(new Set());
  const [loadingAction, setLoadingAction] = useState(null); // Changed from boolean to string/null
  const [error, setError] = useState('');
  const [modalContent, setModalContent] = useState(null);

  // --- DATA FETCHING ---
  const fetchDocuments = async () => {
    try {
      setError('');
      const { data } = await api.get('/documents');
      setDocuments(data);
    } catch (err) {
      setError('Failed to fetch documents. Please try refreshing the page.');
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // --- EVENT HANDLERS ---
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleUploadSuccess = () => {
    fetchDocuments();
    setSelectedDoc(null);
    setPiiToRedact(new Set());
  };
  
  const handleSelectDocument = (doc) => {
    setSelectedDoc(doc);
    setPiiToRedact(new Set());
  };

  const handlePiiSelectionChange = (label) => {
    const newSet = new Set(piiToRedact);
    if (newSet.has(label)) {
      newSet.delete(label);
    } else {
      newSet.add(label);
    }
    setPiiToRedact(newSet);
  };

  const handleDeleteDocument = async (docId) => {
    if (window.confirm('Are you sure you want to permanently delete this document?')) {
      try {
        setLoadingAction('delete'); // Set specific loading state
        setError('');
        await api.delete(`/documents/${docId}`);
        setDocuments(prevDocs => prevDocs.filter(doc => doc._id !== docId));
        if (selectedDoc && selectedDoc._id === docId) {
          setSelectedDoc(null);
        }
      } catch (err) {
        setError('Failed to delete the document.');
      } finally {
        setLoadingAction(null); // Clear loading state
      }
    }
  };

  // --- API INTERACTION LOGIC (Updated with specific loading states) ---

  const handleDetect = async () => {
    if (!selectedDoc) return;
    setLoadingAction('detect');
    setError('');
    try {
      const { data } = await api.post(`/process/detect/${selectedDoc._id}`);
      const updatedDoc = { ...selectedDoc, detectedPii: data.entities };
      setSelectedDoc(updatedDoc);
      setDocuments(docs => docs.map(d => d._id === selectedDoc._id ? updatedDoc : d));
    } catch (err) {
      setError(err.response?.data?.message || 'PII Detection failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRedact = async () => {
    if (!selectedDoc || piiToRedact.size === 0) return;
    setLoadingAction('redact');
    setError('');
    try {
        const labelsToRedact = Array.from(piiToRedact);
        const response = await api.post(`/process/redact/${selectedDoc._id}`, 
            { labels: labelsToRedact },
            { responseType: 'blob' }
        );
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `redacted-${selectedDoc.filename}`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (err) {
        setError('Redaction failed. Please try again.');
    } finally {
        setLoadingAction(null);
    }
  };

  const handleSave = async () => {
    if (!selectedDoc) return;
    setLoadingAction('save');
    setError('');
    try {
        const { data } = await api.post(`/process/save/${selectedDoc._id}`);
        setModalContent({
            title: "Save Successful",
            content: <p>Original document's hash has been permanently logged to the blockchain. <br/> <b>Transaction ID:</b> <span className="font-mono break-all text-sm">{data.transactionId}</span></p>
        });
        fetchDocuments(); 
        setSelectedDoc(prev => ({...prev, isSaved: true}));
    } catch (err) {
        setError(err.response?.data?.message || 'Failed to save and log document.');
    } finally {
        setLoadingAction(null);
    }
  };

  const handleVerify = async () => {
    if (!selectedDoc) return;
    setLoadingAction('verify');
    setError('');
    try {
        const { data } = await api.get(`/process/verify/${selectedDoc._id}`);
        setModalContent({
            title: "Integrity Verification Result",
            content: ( <div className="space-y-3"> <p className={`font-bold text-xl ${data.integrity ? 'text-green-600' : 'text-red-600'}`}>{data.message}</p> <p className="mt-4 text-xs font-mono break-all bg-gray-100 p-2 rounded"><b>On-Chain Hash (Original):</b> {data.onChainHash}</p> <p className="mt-2 text-xs font-mono break-all bg-gray-100 p-2 rounded"><b>Current Hash (Original):</b> {data.currentHash}</p> </div> )
        });
    } catch (err) {
        setError(err.response?.data?.message || 'Verification failed.');
    } finally {
        setLoadingAction(null);
    }
  };

  const handleGetLogs = async () => {
    if (!selectedDoc) return;
    setLoadingAction('logs');
    setError('');
    try {
        const { data } = await api.get(`/process/logs/${selectedDoc._id}`);
        setModalContent({
            title: "Blockchain Access Logs",
            content: ( <div className="space-y-2 text-sm"> <p className="pb-2 mb-2 border-b">A new access event for the original document has been logged. <br/><b>Tx ID:</b> <span className="font-mono break-all">{data.message.split(': ')[1]}</span></p> <h4 className="font-bold pt-2">Complete On-Chain History:</h4> {data.history.length > 0 ? ( <ul className="list-disc pl-5 font-mono text-xs max-h-60 overflow-y-auto"> {data.history.map((log, i) => ( <li key={i}>Accessed by {log.accessor} on {new Date(log.timestamp).toLocaleString()}</li> ))} </ul> ) : <p>No previous access logs found.</p>} </div> )
        });
    } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch access logs.');
    } finally {
        setLoadingAction(null);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      {modalContent && <Modal title={modalContent.title} content={modalContent.content} onClose={() => setModalContent(null)} />}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl md:text-4xl font-bold text-gray-800 text-center md:text-left">
          PII Redaction & Audit Dashboard
        </h1>
        <button onClick={handleLogout} className="px-6 py-2 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 w-full md:w-auto">
          Logout
        </button>
      </header>
      {error && <p className="text-red-500 bg-red-100 p-3 my-4 rounded-md">{error}</p>}
      <div className="mb-8">
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <DocumentList 
          documents={documents}
          selectedDocId={selectedDoc?._id}
          onSelectDocument={handleSelectDocument}
          onDeleteDocument={handleDeleteDocument}
        />
        <PiiViewer
          document={selectedDoc}
          piiToRedact={piiToRedact}
          onPiiSelectionChange={handlePiiSelectionChange}
          onDetect={handleDetect}
          onRedact={handleRedact}
          onSave={handleSave}
          onVerify={handleVerify}
          onGetLogs={handleGetLogs}
          loadingAction={loadingAction}
        />
      </div>
    </div>
  );
};

export default DashboardPage;