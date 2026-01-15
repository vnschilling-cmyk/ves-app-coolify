import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Check, Plus, Trash2, ArrowRight } from 'lucide-react';
import { saveOrders } from '../services/storage';
import { useOrders } from '../context/OrderContext';
import { useUsers } from '../context/UserContext';
// Dynamically imported to prevent crash if pdfjs fails
// import { extractTextFromPdf, parsePositionsFromText } from '../services/pdfService';

const ImportOrderModal = ({ onClose, initialText = '' }) => {
    const { fetchOrders } = useOrders();
    const { users } = useUsers();

    const [stage, setStage] = useState(initialText ? 'staging' : 'upload'); // upload, staging, saving
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Staging Global Data
    const [globalData, setGlobalData] = useState({
        date: new Date().toISOString().split('T')[0], // Import Date (Today)
        delivery_date: '',
        user: ''
    });

    const [positions, setPositions] = useState([]);

    const fileInputRef = useRef(null);

    // Handle Initial Text (from Scan)
    useEffect(() => {
        if (initialText) {
            processText(initialText);
        }
    }, [initialText]);

    const handleFileChange = async (e) => {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const processText = async (text) => {
        setIsProcessing(true);
        try {
            // Dynamic Import
            const { parsePositionsFromText } = await import('../services/pdfService');
            const result = parsePositionsFromText(text);

            const showSuffix = result.positions.length > 1;

            setPositions(result.positions.map((p, i) => ({
                ...p,
                temp_id: Math.random().toString(36).substr(2, 9),
                id: result.globalOrderId
                    ? (showSuffix ? `${result.globalOrderId}-${(i + 1).toString().padStart(2, '0')}` : result.globalOrderId)
                    : p.id,
                company: result.company || '',
                contact_person: result.contact_person || '',
                date: result.globalDate || new Date().toISOString().split('T')[0],
                article_id: p.article_id || '' // Ensure this is mapped
            })));

            setStage('staging');
        } catch (error) {
            console.error(error);
            alert('Fehler beim Verarbeiten des Textes: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const processFile = async (uploadedFile) => {
        if (uploadedFile.type !== 'application/pdf') {
            alert('Bitte nur PDF Dateien hochladen.');
            return;
        }

        setFile(uploadedFile);
        setIsProcessing(true);

        try {
            // Dynamic Import
            const { extractTextFromPdf } = await import('../services/pdfService');
            const text = await extractTextFromPdf(uploadedFile);

            // Re-use processText Logic
            await processText(text);

        } catch (error) {
            console.error(error);
            alert('Fehler beim Lesen der PDF: ' + error.message);
            setStage('upload');
            setFile(null);
            setIsProcessing(false); // Ensure off if error
        }
    };

    const handlePositionChange = (id, field, value) => {
        setPositions(prev => prev.map(p =>
            p.temp_id === id ? { ...p, [field]: value } : p
        ));
    };

    const deletePosition = (id) => {
        setPositions(prev => prev.filter(p => p.temp_id !== id));
    };

    const addPosition = () => {
        setPositions(prev => [...prev, {
            temp_id: Math.random().toString(36).substr(2, 9),
            id: '',
            quantity: 1,
            description: 'Neue Position',
            value: 0,
            delivery_date: '',
            company: '',
            contact_person: '',
            date: new Date().toISOString().split('T')[0],
            article_id: '',
            raw: ''
        }]);
    };

    const handleSave = async () => {
        const invalidPos = positions.find(p => !p.id || !p.value || !p.company);
        if (invalidPos) {
            alert('Bitte sicherstellen, dass alle Positionen eine Auftrags-Nr., einen Wert und eine Firma haben.');
            return;
        }

        setIsProcessing(true);

        try {
            // Map to Order Objects
            const ordersToSave = positions.map(p => ({
                id: p.id,
                value: parseFloat(p.value.toString().replace(',', '.')) || 0,
                quantity: parseFloat(p.quantity) || 1,
                company: p.company,
                contact_person: p.contact_person,
                date: p.date,
                delivery_date: p.delivery_date || globalData.delivery_date,
                article_id: p.article_id, // Save article_id
                user: ''
            }));

            await saveOrders(ordersToSave);

            await fetchOrders();
            onClose();
        } catch (error) {
            alert('Fehler beim Speichern: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="import-modal-overlay">
            <div className="import-modal-content">
                <div className="modal-header-std">
                    <h3>PDF Import</h3>
                    <button className="modal-close-std" onClick={onClose}><X size={20} /></button>
                </div>

                {stage === 'upload' && (
                    <div
                        className="upload-area"
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {isProcessing ? (
                            <div className="processing-state">
                                <span>Lese PDF...</span>
                            </div>
                        ) : (
                            <>
                                <Upload size={48} className="text-primary mb-4" />
                                <p>PDF hier ablegen oder klicken</p>
                                <span className="text-muted text-sm">Automatische Erkennung von Positionen</span>
                            </>
                        )}
                        <input
                            type="file"
                            accept="application/pdf"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </div>
                )}

                {stage === 'staging' && (
                    <div className="staging-area">
                        <div className="staging-header-form">
                            <div className="form-group">
                                <label className="text-sm font-medium text-muted">Import Datum (Heute)</label>
                                <input
                                    type="date"
                                    value={globalData.date}
                                    onChange={e => setGlobalData({ ...globalData, date: e.target.value })}
                                    readOnly // Read-only but styled nicely
                                    title="Datum des Imports (Heute)"
                                />
                            </div>
                        </div>

                        <h4>Gefundene Positionen ({positions.length})</h4>

                        <div className="positions-list">
                            {positions.length === 0 && (
                                <div className="empty-state">Keine Positionen erkannt. Bitte manuell hinzufügen.</div>
                            )}

                            {positions.map((pos, idx) => (
                                <div key={pos.temp_id} className="position-row">
                                    <div className="pos-actions">
                                        <button onClick={() => deletePosition(pos.temp_id)} className="btn-delete-row"><Trash2 size={16} /></button>
                                    </div>
                                    <div className="pos-inputs">
                                        {/* Row 1: Company & Date */}
                                        <div className="row-group">
                                            <input
                                                className="input-company"
                                                type="text"
                                                value={pos.company}
                                                onChange={e => handlePositionChange(pos.temp_id, 'company', e.target.value)}
                                                placeholder="Firma / Kunde"
                                            />
                                            <input
                                                className="input-contact"
                                                type="text"
                                                value={pos.contact_person || ''}
                                                onChange={e => handlePositionChange(pos.temp_id, 'contact_person', e.target.value)}
                                                placeholder="Sachbearbeiter"
                                                style={{ flex: 1.5, minWidth: '100px' }}
                                            />
                                            <div className="date-group">
                                                <span className="text-xs text-muted">Bestellt:</span>
                                                <input
                                                    className="input-date"
                                                    type="date"
                                                    value={pos.date || ''}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'date', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Row 2: Quantity, Article ID, Description */}
                                        <div className="row-group">
                                            <input
                                                className="input-qty"
                                                type="number"
                                                value={pos.quantity}
                                                onChange={e => handlePositionChange(pos.temp_id, 'quantity', e.target.value)}
                                                placeholder="Menge"
                                            />
                                            <input
                                                className="input-artid"
                                                type="text"
                                                value={pos.article_id || ''}
                                                onChange={e => handlePositionChange(pos.temp_id, 'article_id', e.target.value)}
                                                placeholder="Artikel-Nr."
                                                title="Artikelnummer (ID)"
                                            />
                                            <input
                                                className="input-desc"
                                                type="text"
                                                value={pos.description}
                                                onChange={e => handlePositionChange(pos.temp_id, 'description', e.target.value)}
                                                placeholder="Beschreibung"
                                            />
                                        </div>

                                        {/* Row 3: Order ID, Value, Delivery Date */}
                                        <div className="row-group">
                                            <input
                                                className="input-id"
                                                type="text"
                                                value={pos.id}
                                                onChange={e => handlePositionChange(pos.temp_id, 'id', e.target.value)}
                                                placeholder="Auftrags-Nr."
                                            />
                                            <input
                                                className="input-val"
                                                type="number"
                                                value={pos.value}
                                                onChange={e => handlePositionChange(pos.temp_id, 'value', e.target.value)}
                                                placeholder="Wert €"
                                            />
                                            <div className="date-group">
                                                <span className="text-xs text-muted">Lieferung:</span>
                                                <input
                                                    className="input-date"
                                                    type="date"
                                                    value={pos.delivery_date || ''}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'delivery_date', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="btn-add-pos" onClick={addPosition}>
                            <Plus size={16} /> Position hinzufügen
                        </button>

                        <div className="staging-footer">
                            <button className="btn-cancel" onClick={() => setStage('upload')}>Zurück</button>
                            <button className="btn-import" onClick={handleSave} disabled={isProcessing}>
                                {isProcessing ? 'Speichere...' : `Alle ${positions.length} Importieren`}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .import-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    backdrop-filter: blur(5px);
                }
                .import-modal-content {
                    background: var(--color-bg);
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    border-radius: 20px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: var(--shadow-xl);
                }
                @media (max-width: 600px) {
                    .import-modal-overlay { padding: 10px; }
                    .import-modal-content { max-height: 95vh; }
                }
                
                .upload-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    border: 2px dashed var(--color-border);
                    margin: 20px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: white;
                }
                .upload-area:hover {
                    border-color: var(--color-primary);
                    background: #f8fafc;
                }
                
                .staging-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                @media (max-width: 600px) {
                    .staging-area { padding: 15px; gap: 15px; }
                }

                .staging-header-form {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    background: white;
                    padding: 16px;
                    border-radius: 12px;
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-border);
                }
                .staging-header-form .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .staging-header-form input {
                    padding: 8px;
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    font-size: 0.9rem;
                    background: #f8fafc; /* Subtle read-only indication */
                    color: var(--color-text-muted);
                    width: 100%;
                }
                .staging-header-form label {
                    font-size: 0.85rem;
                    color: var(--color-text-muted);
                    font-weight: 500;
                }
                
                .positions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .position-row {
                    background: white;
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid var(--color-border);
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                }
                @media (max-width: 600px) {
                    .position-row {
                        flex-direction: row;
                        flex-wrap: wrap;
                        padding: 10px;
                    }
                    .pos-actions { margin-right: -5px; }
                    .input-company { flex-basis: 100% !important; }
                }

                .pos-actions { padding-top: 8px; }
                
                .pos-inputs {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    min-width: 0;
                }
                .row-group {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                @media (max-width: 500px) {
                    .row-group:last-child { flex-wrap: wrap; }
                    .input-id { flex-basis: 100%; }
                    .input-val { flex: 1; }
                    .input-date { flex: 1; }
                }

                .row-group input {
                    padding: 8px;
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    font-size: 0.9rem;
                }
                
                .input-company { flex: 2; font-weight: bold; min-width: 0; }
                .input-qty { width: 70px; }
                .input-artid { width: 100px; border-color: var(--color-primary) !important; color: var(--color-primary); }
                .input-desc { flex: 1; font-weight: 500; min-width: 0; }
                .input-id { flex: 1; font-family: monospace; min-width: 0;}
                .input-val { width: 100px; text-align: right; }
                
                .date-group { display: flex; align-items: center; gap: 4px; }
                .input-date { width: 130px; }

                /* Util */
                .text-primary { color: var(--color-primary); }
                .text-muted { color: var(--color-text-muted); }
                .text-sm { font-size: 0.85rem; }
                .text-xs { font-size: 0.75rem; }
                .mb-4 { margin-bottom: 1rem; }

                .btn-delete-row {
                    color: #ef4444; background: #fef2f2; border: none; padding: 6px; border-radius: 6px; cursor: pointer;
                }
                .btn-add-pos {
                    align-self: flex-start; background: white; border: 1px dashed var(--color-border);
                    padding: 8px 16px; border-radius: 8px; color: var(--color-text-muted); cursor: pointer;
                    display: flex; align-items: center; gap: 8px;
                }
                .staging-footer {
                    margin-top: auto; display: flex; justify-content: flex-end; gap: 12px; padding-top: 20px; border-top: 1px solid var(--color-border);
                }
                .btn-cancel {
                    padding: 10px 20px; border: 1px solid var(--color-border); background: white; border-radius: 8px; cursor: pointer;
                }
                .btn-import {
                    padding: 10px 24px; background: var(--color-primary); color: white; border: 1px solid var(--color-primary);
                    border-radius: 8px; font-weight: 600; cursor: pointer;
                }
                .btn-import:disabled { opacity: 0.7; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

export default ImportOrderModal;
