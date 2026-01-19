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
            // Dynamic Import for Storage
            const { getArticleByArticleId } = await import('../services/storage');

            // Dynamic Import for PDF parsing
            const { parsePositionsFromText } = await import('../services/pdfService');
            const result = parsePositionsFromText(text);

            const showSuffix = result.positions.length > 1;

            const enhancedPositions = await Promise.all(result.positions.map(async (p, i) => {
                let description = p.description || '';

                // Check if article exists in DB to override description
                if (p.article_id) {
                    try {
                        const existingArticle = await getArticleByArticleId(p.article_id);
                        if (existingArticle && existingArticle.name) {
                            description = existingArticle.name;
                        }
                    } catch (err) {
                        console.warn('Could not fetch article details for:', p.article_id);
                    }
                }

                return {
                    ...p,
                    temp_id: Math.random().toString(36).substr(2, 9),
                    id: result.globalOrderId
                        ? (showSuffix ? `${result.globalOrderId}-${(i + 1).toString().padStart(2, '0')}` : result.globalOrderId)
                        : p.id,
                    company: result.company || '',
                    contact_person: result.contact_person || '',
                    date: result.globalDate || new Date().toISOString().split('T')[0],
                    article_id: p.article_id || '',
                    drawing_number: p.drawing_number || '',
                    raw_material: p.raw_material || '',
                    description: description
                };
            }));

            setPositions(enhancedPositions);

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
            drawing_number: '',
            raw_material: '',
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
            // Dynamic import for article functions
            const { getArticleByArticleId, createArticle } = await import('../services/storage');

            // 1. Check for missing articles (Legacy check: Creates article if missing, but we store string in order)
            const uniqueArticleIds = [...new Set(positions.filter(p => p.article_id).map(p => p.article_id))];
            const missingArticles = [];

            for (const artId of uniqueArticleIds) {
                const existing = await getArticleByArticleId(artId);
                if (!existing) {
                    const posData = positions.find(p => p.article_id === artId);

                    // Safe calculation for unit price
                    const totalValue = parseFloat(posData?.value) || 0;
                    const quantity = parseFloat(posData?.quantity) || 1;
                    const safeUnitPrice = quantity > 0 ? (totalValue / quantity) : 0;

                    missingArticles.push({
                        article_id: artId,
                        description: posData?.description || 'Neu importierter Artikel',
                        unit_price: isFinite(safeUnitPrice) ? safeUnitPrice : 0,
                        customer_id: posData?.company || '',
                        drawing_number: posData?.drawing_number || '',
                        raw_material: posData?.raw_material || ''
                    });
                }
            }

            // Ask user if they want to create new articles
            if (missingArticles.length > 0) {
                const articleList = missingArticles.map(a => `• ${a.article_id}`).join('\n');
                const confirmCreate = window.confirm(
                    `Folgende Artikel wurden nicht gefunden:\n\n${articleList}\n\nSollen diese Artikel automatisch angelegt werden?`
                );

                if (confirmCreate) {
                    let createdCount = 0;
                    for (const artData of missingArticles) {
                        try {
                            // Use FormData to match ArticleList behavior
                            // Use JSON payload (safer than FormData for no-file uploads)
                            const payload = {
                                article_id: artData.article_id,
                                description: artData.description,
                                unit_price: artData.unit_price || 0, // Ensure Number
                                customer_id: artData.customer_id,
                                drawing_number: artData.drawing_number,
                                raw_material: artData.raw_material,
                                work_steps: ['Büro', 'Einrichtung', 'Fertigung', 'Lieferung'] // Ensure Array
                            };

                            await createArticle(payload);
                            createdCount++;
                        } catch (err) {
                            console.error('Failed to create article:', artData.article_id, err);
                        }
                    }
                    if (createdCount > 0) {
                        alert(`${createdCount} von ${missingArticles.length} Artikel(n) wurden erfolgreich angelegt.`);
                    }
                }
            }

            // 2. Map to Order Objects
            const ordersToSave = positions.map(p => ({
                id: p.id,
                value: parseFloat(p.value.toString().replace(',', '.')) || 0,
                quantity: parseFloat(p.quantity) || 1,
                company: p.company,
                contact_person: p.contact_person,
                date: p.date,
                delivery_date: p.delivery_date || globalData.delivery_date,
                article_id: p.article_id, // Save the String!
                user: ''
            }));

            await saveOrders(ordersToSave, file);
            await fetchOrders();
            alert(`Erfolgreich importiert!${file ? '\nDas PDF wurde gespeichert.' : ''}`);
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
                                <div key={pos.temp_id} className="position-card">
                                    {/* Delete Button - New Style */}
                                    <button
                                        onClick={() => deletePosition(pos.temp_id)}
                                        className="corner-btn delete-corner"
                                        title="Position entfernen"
                                    >
                                        <Trash2 size={24} />
                                    </button>

                                    {/* Card Header: Order ID */}
                                    <div className="card-header-row">
                                        <div className="field-group id-group">
                                            <label>Auftrags-Nr.</label>
                                            <input
                                                className="input-id font-mono"
                                                type="text"
                                                value={pos.id}
                                                onChange={e => handlePositionChange(pos.temp_id, 'id', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Block 1: Customer */}
                                    <div className="card-section">
                                        {/* Company & Contact (Side by Side) */}
                                        <div className="grid-custom-company">
                                            <div className="field-group">
                                                <label>Firma / Kunde</label>
                                                <input
                                                    type="text"
                                                    value={pos.company}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'company', e.target.value)}
                                                    placeholder="Firma..."
                                                />
                                            </div>
                                            <div className="field-group">
                                                <label>Sachbearbeiter</label>
                                                <input
                                                    type="text"
                                                    value={pos.contact_person || ''}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'contact_person', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Order Date & Delivery Date */}
                                        <div className="grid-2-col">
                                            <div className="field-group">
                                                <label>Bestelldatum</label>
                                                <input
                                                    type="date"
                                                    value={pos.date || ''}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'date', e.target.value)}
                                                />
                                            </div>
                                            <div className="field-group">
                                                <label>Liefertermin</label>
                                                <input
                                                    type="date"
                                                    value={pos.delivery_date || ''}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'delivery_date', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Article Data Row (4 Columns) */}
                                        <div className="grid-4-col-custom">
                                            <div className="field-group">
                                                <label>Artikel-Nr.</label>
                                                <input
                                                    type="text"
                                                    value={pos.article_id || ''}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'article_id', e.target.value)}
                                                />
                                            </div>
                                            <div className="field-group">
                                                <label>Zeichnung</label>
                                                <input
                                                    type="text"
                                                    value={pos.drawing_number || ''}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'drawing_number', e.target.value)}
                                                />
                                            </div>
                                            <div className="field-group">
                                                <label>Menge</label>
                                                <input
                                                    type="number"
                                                    value={pos.quantity}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'quantity', e.target.value)}
                                                />
                                            </div>
                                            <div className="field-group">
                                                <label>Gesamtwert</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={pos.value}
                                                    onChange={e => handlePositionChange(pos.temp_id, 'value', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div className="field-group full-width">
                                            <label>Beschreibung</label>
                                            <input
                                                type="text"
                                                value={pos.description}
                                                onChange={e => handlePositionChange(pos.temp_id, 'description', e.target.value)}
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
                    max-width: 393px;
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
                    font-family: inherit; /* Fix: Match font for header date */
                }
                .staging-header-form label {
                    font-size: 0.85rem;
                    color: var(--color-text-muted);
                    font-weight: 500;
                }
                
                .positions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                
                /* Vertical Card Layout */
                .position-card {
                    background: white;
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    box-shadow: var(--shadow-sm);
                    position: relative; /* ENABLE ABSOLUTE POSITIONING */
                    padding-top: 24px; /* Slight top padding incase title overlaps */
                }
                
                .card-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    border-bottom: 1px solid #f1f5f9;
                    padding-bottom: 12px;
                    margin-bottom: 4px;
                }
                
                .card-section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px; /* Standardized gap */
                }
                
                .bg-muted {
                    background: #f8fafc;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #f1f5f9;
                }

                .field-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .field-group label {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    font-weight: 600;
                    text-transform: uppercase;
                }
                
                .field-group input {
                    width: 100%;
                    padding: 4px 8px; /* Slightly tighter vertical padding */
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    font-size: 0.9rem;
                    box-sizing: border-box; 
                    height: 36px; /* Consistent height */
                    font-family: inherit; /* Fix: Force consistent font for dates */
                }
                
                /* Grids */
                .grid-2-col {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                
                /* Custom grid for Company (larger) + Contact (smaller) */
                .grid-custom-company {
                    display: grid;
                    grid-template-columns: 1.5fr 1fr; 
                    gap: 12px;
                }
                
                /* 4-Column Layout for Article Data */
                .grid-4-col-custom {
                    display: grid;
                    grid-template-columns: 1fr 1fr 0.8fr 1fr; /* ArticleID, Drawing, Qty, Value */
                    gap: 12px;
                    /* margin-top removed to rely on card-section gap */
                }
                
                .grid-3-col-auto {
                    display: grid;
                    grid-template-columns: 80px 100px 1fr; /* Fixed widths for Qty/ID */
                    gap: 8px;
                }

                .full-width {
                    width: 100%;
                }
                
                .input-id { background: transparent; border: none !important; font-size: 1.1rem !important; padding: 0 !important; color: var(--color-primary); font-weight: bold; width: auto !important; height: auto !important; }
                .id-group input { background: transparent; border: none; padding: 0; }
                
                /* Corner Button Style (Copied from OrderList) */
                .corner-btn {
                    position: absolute;
                    top: 12px;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 0 !important;
                    outline: none !important;
                    cursor: pointer;
                    color: white !important;
                    transition: all 0.2s;
                    z-index: 100;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.15);
                    padding: 0;
                    margin: 0;
                }
                .delete-corner {
                    right: 12px;
                    background: #ef4444 !important;
                }
                .delete-corner:hover {
                    background: #dc2626 !important;
                    transform: scale(1.1);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.2);
                }

                /* Mobile Tweaks */
                @media (max-width: 500px) {
                    .import-modal-overlay { padding: 0; }
                    .import-modal-content { 
                        width: 100%; 
                        height: 100%; 
                        max-height: 100%; 
                        border-radius: 0; 
                    }
                    .staging-area { padding: 12px; }

                    /* Force single column for all grids on mobile */
                    .grid-2-col, 
                    .grid-custom-company,
                    .grid-4-col-custom { 
                        grid-template-columns: 1fr; 
                    }
                }

                /* Utils */
                .text-primary { color: var(--color-primary); }
                .text-muted { color: var(--color-text-muted); }
                .font-bold { font-weight: 600; }
                .font-mono { font-family: monospace; }
                
                .btn-add-pos {
                    align-self: flex-start; background: white; border: 1px dashed var(--color-border);
                    padding: 8px 16px; border-radius: 8px; color: var(--color-text-muted); cursor: pointer;
                    display: flex; align-items: center; gap: 8px;
                    margin-top: 10px;
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
