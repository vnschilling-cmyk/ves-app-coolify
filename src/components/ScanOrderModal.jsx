import { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, Loader2, RotateCcw, Plus, ArrowRight } from 'lucide-react';
import { analyzeImage } from '../services/ocrService';

// Note: ScanOrderModal now purely handles Image Capture & OCR.
// It hands off the raw text to ImportOrderModal for parsing/staging.
const ScanOrderModal = ({ onClose, onScanComplete }) => {

    // Stages: capture, processing
    const [stage, setStage] = useState('capture');

    // Multi-page capture
    const [images, setImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const [scanStatus, setScanStatus] = useState('Bereit');
    const [scanProgress, setScanProgress] = useState(0);

    const fileInputRef = useRef(null);

    // Auto-open camera on mount if no images yet
    useEffect(() => {
        if (stage === 'capture' && images.length === 0) {
            const timer = setTimeout(() => {
                fileInputRef.current?.click();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setImages(prev => [...prev, { file, url }]);
        }
    };

    const handleFinish = async () => {
        if (images.length === 0) return;

        setStage('processing');
        let fullText = '';

        try {
            for (let i = 0; i < images.length; i++) {
                setCurrentImageIndex(i);
                setScanStatus(`Verarbeite Seite ${i + 1} von ${images.length}...`);
                setScanProgress(0);

                const text = await analyzeImage(images[i].file, (m) => {
                    setScanProgress(Math.round(m.progress * 100));
                });

                fullText += text + '\n\n';
            }

            setScanStatus('Fertig!');

            // Hand off to Import Modal
            onScanComplete(fullText);

        } catch (error) {
            console.error(error);
            alert('Fehler bei der Texterkennung: ' + error.message);
            setStage('capture');
        }
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="scan-modal-overlay">
            <div className="scan-modal-content">
                <button onClick={onClose} className="modal-close-std"><X size={20} /></button>

                {stage === 'capture' && (
                    <div className="capture-view">
                        <h3>Scannen</h3>
                        <p className="subtitle">Fotos vom Auftrag machen. Mehrere Seiten möglich.</p>

                        <div className="captured-list">
                            {images.map((img, idx) => (
                                <div key={idx} className="captured-thumb">
                                    <img src={img.url} alt={`Seite ${idx + 1}`} />
                                    <button className="remove-btn" onClick={() => removeImage(idx)}><X size={12} /></button>
                                    <span className="page-lbl">{idx + 1}</span>
                                </div>
                            ))}
                            <div className="add-page-btn" onClick={() => fileInputRef.current?.click()}>
                                <Plus size={32} />
                                <span>Seite<br />dazu</span>
                            </div>
                        </div>

                        <div className="actions-footer">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />

                            {images.length > 0 && (
                                <button className="finish-btn" onClick={handleFinish}>
                                    <Check size={20} />
                                    <span>Fertig ({images.length} Seiten)</span>
                                </button>
                            )}
                            {images.length === 0 && (
                                <button className="start-btn" onClick={() => fileInputRef.current?.click()}>
                                    <Camera size={24} />
                                    <span>Kamera starten</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {stage === 'processing' && (
                    <div className="processing-view">
                        <Loader2 size={48} className="animate-spin text-primary" />
                        <h3 className="mt-4">{scanStatus}</h3>

                        <div className="processing-thumb-wrapper">
                            <img src={images[currentImageIndex]?.url} alt="Current" />
                        </div>

                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${scanProgress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        .scan-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.85); /* Darker bg for focus */
            z-index: 9999;
            display: flex;
            flex-direction: column;
            backdrop-filter: blur(5px);
        }

        .scan-modal-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 20px;
            max-width: 393px;
            margin: 0 auto;
            width: 100%;
            height: 100%;
            position: relative;
        }

        .modal-close-std {
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            z-index: 10;
        }

        .capture-view {
            display: flex;
            flex-direction: column;
            height: 100%;
            color: white;
        }
        
        .capture-view h3 {
            margin-top: 40px;
            text-align: center;
            font-size: 1.5rem;
        }
        .subtitle {
            text-align: center;
            color: #cbd5e1;
            margin-bottom: 2rem;
        }

        .captured-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 12px;
            padding: 10px;
            overflow-y: auto;
            flex: 1;
        }

        .captured-thumb {
            position: relative;
            background: #334155;
            border-radius: 12px;
            aspect-ratio: 3/4;
            overflow: hidden;
            border: 2px solid rgba(255,255,255,0.1);
        }
        .captured-thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .remove-btn {
            position: absolute;
            top: 4px;
            right: 4px;
            background: rgba(239, 68, 68, 0.9);
            color: white;
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .page-lbl {
            position: absolute;
            bottom: 4px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.5);
            color: white;
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
        }

        .add-page-btn {
            background: rgba(255,255,255,0.1);
            border: 2px dashed rgba(255,255,255,0.3);
            border-radius: 12px;
            aspect-ratio: 3/4;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: rgba(255,255,255,0.7);
            transition: all 0.2s;
        }
        .add-page-btn:active {
            background: rgba(255,255,255,0.2);
        }

        .actions-footer {
            padding-top: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .finish-btn {
            background: var(--color-primary);
            color: white;
            border: none;
            padding: 16px;
            border-radius: 16px;
            font-size: 1.1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
        }
        .start-btn {
            background: white;
            color: black;
            border: none;
            padding: 16px;
            border-radius: 16px;
            font-size: 1.1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
        }

        .processing-view {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: white;
            text-align: center;
        }
        
        .processing-thumb-wrapper {
            margin: 20px 0;
            width: 150px;
            height: 200px;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid var(--color-primary);
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
        }
        .processing-thumb-wrapper img {
             width: 100%;
             height: 100%;
             object-fit: cover;
        }

        .progress-bar-container {
            width: 100%;
            max-width: 300px;
            height: 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
            overflow: hidden;
        }
        .progress-bar-fill {
            height: 100%;
            background: var(--color-primary);
            transition: width 0.3s;
        }
      `}</style>
        </div>
    );
};

export default ScanOrderModal;
