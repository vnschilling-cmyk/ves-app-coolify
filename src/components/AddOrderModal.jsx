import { useState, useRef } from 'react';
import { Camera, Upload, Edit, X } from 'lucide-react';
import ScanOrderModal from './ScanOrderModal';
import ImportOrderModal from './ImportOrderModal';

const AddOrderModal = ({ onClose, onSelectManual }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [scannedText, setScannedText] = useState('');

  const handleScan = () => {
    setShowScanner(true);
  };

  const handleImportClick = () => {
    setScannedText('');
    setShowImport(true);
  };

  const handleScanComplete = (text) => {
    setScannedText(text);
    setShowScanner(false);
    setShowImport(true);
  };

  if (showScanner) {
    return <ScanOrderModal onClose={onClose} onScanComplete={handleScanComplete} />;
  }

  if (showImport) {
    return <ImportOrderModal onClose={onClose} initialText={scannedText} />;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header-std">
          <h3>Neuer Auftrag</h3>
          <button onClick={onClose} className="modal-close-std"><X size={20} /></button>
        </div>

        <div className="options-grid">
          <button className="option-btn" onClick={handleScan}>
            <div className="icon-circle scan">
              <Camera size={24} />
            </div>
            <span>Scannen</span>
          </button>

          <button className="option-btn" onClick={handleImportClick}>
            <div className="icon-circle upload">
              <Upload size={24} />
            </div>
            <span>PDF Import</span>
          </button>

          <button className="option-btn" onClick={onSelectManual}>
            <div className="icon-circle manual">
              <Edit size={24} />
            </div>
            <span>Manuell erfassen</span>
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: flex-end; /* Bottom sheet on mobile */
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease-out;
        }
        
        @media (min-width: 640px) {
          .modal-overlay {
            align-items: center;
          }
        }

        .modal-content {
          background: white;
          width: 100%;
          max-width: 500px;
          border-radius: 20px 20px 0 0;
          padding: 1.5rem;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
          animation: slideUp 0.3s ease-out;
        }

        @media (min-width: 640px) {
          .modal-content {
            border-radius: 20px;
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 4px;
        }

        .options-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .option-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
        }
        
        .option-btn span {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--color-text-main);
        }

        .icon-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s;
        }
        
        .option-btn:active .icon-circle {
            transform: scale(0.95);
        }

        .icon-circle.scan { background: #e0e7ff; color: #4338ca; }
        .icon-circle.upload { background: #dcfce7; color: #15803d; }
        .icon-circle.manual { background: #fee2e2; color: #b91c1c; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AddOrderModal;
