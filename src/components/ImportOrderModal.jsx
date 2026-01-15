import { useState, useRef } from 'react';
import { X, Upload, FileText, Check, Plus, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
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

    // Staging Data
    const [globalData, setGlobalData] = useState({
        company: '',
        date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        user: '' // No user assigned by default for new orders
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

            // Auto-fill extracted extracted global data
            setGlobalData(prev => ({
                ...prev,
                date: result.globalDate || prev.date,
                company: result.company || prev.company
            }));

            setPositions(result.positions.map((p, i) => ({
                ...p,
                temp_id: Math.random().toString(36).substr(2, 9),
                id: p.id || (result.globalOrderId ? `${result.globalOrderId}-${(i + 1).toString().padStart(2, '0')}` : '')
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
            raw: ''
        }]);
    };

    const handleSave = async () => {
        // Validate
        if (!globalData.company) {
            alert('Bitte Firma angeben.');
            return;
        }

        const invalidPos = positions.find(p => !p.id || !p.value);
        if (invalidPos) {
            alert('Bitte sicherstellen, dass alle Positionen eine Auftrags-Nr. und einen Wert haben.');
            return;
        }

        setIsProcessing(true);

        try {
            // Map to Order Objects
            const ordersToSave = positions.map(p => ({
                id: p.id,
                value: parseFloat(p.value.toString().replace(',', '.')) || 0,
                quantity: parseFloat(p.quantity) || 1,
                // Global fields
                company: globalData.company, // + (p.description ? ` - ${p.description}` : ''), // Append desc?
                // Actually, the user wants "separate work orders". 
                // Maybe the "Company" field should hold the Client Name, 
                // and the "Description" should be part of the Order ID or a Note?
                // Our current schema doesn't have "Description".
                // Let's assume Order ID needs to be unique. 
                // Maybe we append Description to Company for context?
                // Or we just rely on ID.

                // Let's append Description to Company so it's visible in the list: "Client A - Metal Plate"
                // Or better: Use Company as Client Main Name.
                // The ID is the tracker.

                date: globalData.date,
                delivery_date: p.delivery_date || globalData.delivery_date,
                user: '' // Explicitly no user for "Erfasst" status
            }));

            await saveOrders(ordersToSave);

            // Refresh
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
                        {/* Global Fields Header */}
                        <div className="staging-header-form">
                            <div className="form-group">
                                <label>Firma / Kunde</label>
                                <input
                                    type="text"
                                    value={globalData.company}
                                    onChange={e => setGlobalData({ ...globalData, company: e.target.value })}
                                    placeholder="z.B. Schmidt GmbH"
                                />
                            </div>
                            <div className="form-group">
                                <label>Datum</label>
                                <input
                                    type="date"
                                    value={globalData.date}
                                    onChange={e => setGlobalData({ ...globalData, date: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                {/* Mitarbeiter selection removed per user request */}
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
                                        <div className="row-group">
                                            <input
                                                className="input-qty"
                                                type="number"
                                                value={pos.quantity}
                                                onChange={e => handlePositionChange(pos.temp_id, 'quantity', e.target.value)}
                                                placeholder="Menge"
                                            />
                                            <input
                                                className="input-desc"
                                                type="text"
                                                value={pos.description}
                                                onChange={e => handlePositionChange(pos.temp_id, 'description', e.target.value)}
                                                placeholder="Beschreibung"
                                            />
                                        </div>
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
                                            <input
                                                className="input-date"
                                                type="date"
                                                value={pos.delivery_date || ''}
                                                onChange={e => handlePositionChange(pos.temp_id, 'delivery_date', e.target.value)}
                                                title="Lieferdatum (leer = Global)"
                                                style={{ width: '130px', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
                                            />
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
                
                /* Upload Area */
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
                .text-primary { color: var(--color-primary); }
                .text-muted { color: var(--color-text-muted); }
                .text-sm { font-size: 0.85rem; }
                .mb-4 { margin-bottom: 1rem; }
                
                /* Staging Area */
                .staging-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .staging-header-form {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    background: white;
                    padding: 16px;
                    border-radius: 12px;
                    box-shadow: var(--shadow-sm);
                }
                @media (max-width: 600px) {
                    .staging-header-form { grid-template-columns: 1fr; }
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
                .pos-actions {
                    padding-top: 8px;
                }
                .btn-delete-row {
                    color: #ef4444;
                    background: #fef2f2;
                    border: none;
                    padding: 6px;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .pos-inputs {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .row-group {
                    display: flex;
                    gap: 8px;
                }
                .row-group input {
                    padding: 8px;
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    font-size: 0.9rem;
                }
                .input-qty { width: 70px; }
                .input-desc { flex: 1; font-weight: 500; }
                .input-id { flex: 1; color: var(--color-primary); font-family: monospace; }
                .input-val { width: 100px; text-align: right; }
                
                .btn-add-pos {
                    align-self: flex-start;
                    background: white;
                    border: 1px dashed var(--color-border);
                    padding: 8px 16px;
                    border-radius: 8px;
                    color: var(--color-text-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .btn-add-pos:hover {
                    color: var(--color-primary);
                    border-color: var(--color-primary);
                }
                
                .staging-footer {
                    margin-top: auto;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding-top: 20px;
                    border-top: 1px solid var(--color-border);
                }
                .btn-cancel {
                    padding: 10px 20px;
                    border: 1px solid var(--color-border);
                    background: white;
                    border-radius: 8px;
                    cursor: pointer;
                }
                .btn-import {
                    padding: 10px 24px;
                    background: var(--color-primary);
                    color: white;
                    border: 1px solid var(--color-primary);
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-import:disabled { opacity: 0.7; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

export default ImportOrderModal;
