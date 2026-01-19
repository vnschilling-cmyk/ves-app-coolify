import { useState, useEffect, useRef } from 'react';
import { Package, Search, Pencil, X, Check, Upload, FileText, Image as ImageIcon, Trash2, Clock, ArrowRight, Plus } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { getArticles, updateArticle, createArticle, deleteArticle } from '../services/storage';
import { pb } from '../lib/pocketbase';

const ArticleList = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingArticle, setEditingArticle] = useState(null);
    const [formData, setFormData] = useState({});
    const [pendingUploads, setPendingUploads] = useState({});

    // Delete Confirmation State
    const [articleToDelete, setArticleToDelete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const imageInputRef = useRef(null);
    const drawingInputRef = useRef(null);
    const customerDrawingInputRef = useRef(null);
    const [uploadStatus, setUploadStatus] = useState('');

    // File Preview State
    const [previewFile, setPreviewFile] = useState(null); // { url, type }

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        // Validation
        if (!formData.article_id) {
            alert("Bitte eine Artikelnummer eingeben.");
            return;
        }

        const data = new FormData();
        // Append text fields
        data.append('article_id', formData.article_id || '');
        data.append('drawing_number', formData.drawing_number || '');
        data.append('unit_price', formData.unit_price || 0);
        data.append('description', formData.description || '');
        data.append('customer_id', formData.customer_id || '');
        data.append('raw_material', formData.raw_material || '');
        data.append('production_time', formData.production_time || 0);
        data.append('production_time_unit', formData.production_time_unit || 's');

        // Append array fields
        if (formData.work_steps && Array.isArray(formData.work_steps)) {
            formData.work_steps.forEach(step => {
                data.append('work_steps', step);
            });
        }

        // Append files
        if (pendingUploads.image) data.append('image', pendingUploads.image);
        if (pendingUploads.drawing) data.append('drawing', pendingUploads.drawing);
        if (pendingUploads.customer_drawing) data.append('customer_drawing', pendingUploads.customer_drawing);

        try {
            let result;
            if (editingArticle.id === 'new') {
                const newArticleInitialData = {
                    ...Object.fromEntries(data), // Convert FormData to object for JSON create if needed, but here we use FormData for create
                    article_id: formData.article_id // Ensure ID is explicit if not in FormData? 
                    // Wait, data is FormData. 
                };
                // For create we probably want to support files too, but simpler logic was JSON before.
                // But now we use FormData for create to support files.
                result = await createArticle(data);
            } else {
                result = await updateArticle(editingArticle.id, data);
            }

            if (!result) {
                throw new Error("Speichern fehlgeschlagen (Datenbank-Antwort war leer).");
            }

            // Success Handling
            setEditingArticle(null);
            setFormData({});
            setPendingUploads({});
            setUploadStatus(null);
            await fetchArticles(); // Refresh list
            alert("Artikel erfolgreich gespeichert.");
        } catch (error) {
            console.error(error);
            setUploadStatus('Fehler beim Speichern: ' + (error.message || error));
            alert('Fehler beim Speichern: ' + (error.message || error));
        }
    };

    const handleCreate = () => {
        setEditingArticle({ id: 'new' });
        setFormData({
            article_id: '',
            description: '',
            unit_price: 0,
            customer_id: '',
            drawing_number: '',
            raw_material: '',
            production_time: 0,
            production_time_unit: 's',
            work_steps: ['Büro', 'Einrichtung', 'Fertigung', 'Lieferung']
        });
        setPendingUploads({});
        setUploadStatus('');
    };

    const handleDeleteClick = (article) => {
        setArticleToDelete(article);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!articleToDelete) return;

        const success = await deleteArticle(articleToDelete.id);
        if (success) {
            await fetchArticles();
            if (editingArticle?.id === articleToDelete.id) {
                setEditingArticle(null);
            }
        }
        setIsDeleteModalOpen(false);
        setArticleToDelete(null);
    };

    const handleFileUpload = (type, file) => {
        if (!file) return;

        // Check size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert(`Datei zu groß (${(file.size / 1024 / 1024).toFixed(2)} MB). Max 5 MB.`);
            return;
        }

        setPendingUploads(prev => ({ ...prev, [type]: file }));
    };

    const getFileUrl = (article, fieldName) => {
        if (!article || !article[fieldName]) {
            return null;
        }
        return pb.files.getUrl(article, article[fieldName]);
    };

    const openFullScreen = (url, type) => {
        if (!url) return;
        setPreviewFile({ url, type });
    };

    const taskStyles = {
        'Büro': { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: '#3b82f6', activeBg: '#3b82f6', activeColor: '#ffffff' },
        'Einrichtung': { color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: '#f59e0b', activeBg: '#f59e0b', activeColor: '#ffffff' },
        'Fertigung': { color: '#047857', bg: '#f0fdf4', border: '#bbf7d0', icon: '#10b981', activeBg: '#10b981', activeColor: '#ffffff' },
        'Lieferung': { color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', icon: '#8b5cf6', activeBg: '#8b5cf6', activeColor: '#ffffff' }
    };

    useEffect(() => {
        fetchArticles();
    }, []);

    const fetchArticles = async () => {
        setLoading(true);
        const data = await getArticles();
        setArticles(data);
        setLoading(false);
    };

    const filteredArticles = articles.filter(a => {
        const term = searchTerm.toLowerCase();
        return (
            (a.article_id || '').toLowerCase().includes(term) ||
            (a.description || '').toLowerCase().includes(term) ||
            (a.customer_id || '').toLowerCase().includes(term)
        );
    });

    const startEditing = (article) => {
        setEditingArticle(article);
        setFormData({
            article_id: article.article_id || '',
            description: article.description || '',
            unit_price: article.unit_price || 0,
            customer_id: article.customer_id || '',
            drawing_number: article.drawing_number || '',
            raw_material: article.raw_material || '',
            production_time: article.production_time || 0,
            production_time_unit: article.production_time_unit || 's',
            work_steps: article.work_steps || ['Büro', 'Einrichtung', 'Fertigung', 'Lieferung']
        });
    };

    const cancelEditing = () => {
        setEditingArticle(null);
        setFormData({});
    };



    return (
        <div className="article-list-section">
            <div className="section-header">
                <div>
                    <h2><Package size={24} className="icon-main" /> Artikel verwalten</h2>
                    <p>Technische Daten, Zeichnungen und Bilder zu Artikeln</p>
                </div>
            </div>

            <div className="search-actions-container">
                <button onClick={handleCreate} className="create-btn-full">
                    <Plus size={20} /> Neuen Artikel anlegen
                </button>
                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Artikel suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-state">Lade Artikel...</div>
            ) : filteredArticles.length === 0 && !editingArticle ? (
                <div className="empty-state">
                    {searchTerm ? 'Keine Artikel gefunden.' : 'Noch keine Artikel vorhanden.'}
                </div>
            ) : (
                <div className="article-grid">
                    {/* Create Mode Card */}
                    {editingArticle?.id === 'new' && (
                        <div className="article-card editing">
                            <div className="card-edit-form">
                                <div className="form-head">
                                    <h3>Neuen Artikel anlegen</h3>
                                </div>
                                <div className="form-row-triple">
                                    <div className="form-row">
                                        <label>Artikel-Nr.</label>
                                        <input
                                            type="text"
                                            value={formData.article_id}
                                            onChange={(e) => handleFormChange('article_id', e.target.value)}
                                            placeholder="z.B. 12345"
                                        />
                                    </div>
                                    <div className="form-row">
                                        <label>Zeichn.-Nr.</label>
                                        <input
                                            type="text"
                                            value={formData.drawing_number}
                                            onChange={(e) => handleFormChange('drawing_number', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <label>Einzelpreis (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.unit_price}
                                            onChange={(e) => handleFormChange('unit_price', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <label>Beschreibung</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => handleFormChange('description', e.target.value)}
                                    />
                                </div>

                                <div className="form-row">
                                    <label>Kunde</label>
                                    <input
                                        type="text"
                                        value={formData.customer_id}
                                        onChange={(e) => handleFormChange('customer_id', e.target.value)}
                                    />
                                </div>

                                <div className="form-row-double">
                                    <div className="form-row">
                                        <label>Rohmaterial</label>
                                        <input
                                            type="text"
                                            value={formData.raw_material}
                                            onChange={(e) => handleFormChange('raw_material', e.target.value)}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div className="form-row" style={{ flex: 1 }}>
                                            <label>Zeit / St.</label>
                                            <input
                                                type="number"
                                                value={formData.production_time}
                                                onChange={(e) => handleFormChange('production_time', parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="form-row">
                                            <label>Einheit</label>
                                            <select
                                                value={formData.production_time_unit}
                                                onChange={(e) => handleFormChange('production_time_unit', e.target.value)}
                                                style={{ width: '70px', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '0 8px', height: '100%' }}
                                            >
                                                <option value="s">s</option>
                                                <option value="m">m</option>
                                                <option value="h">h</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>



                                {/* File Uploads */}
                                <div className="file-upload-section">
                                    <div className={`upload-box ${pendingUploads.image ? 'has-file' : ''}`} onClick={() => imageInputRef.current?.click()}>
                                        <ImageIcon size={20} />
                                        <div className="upload-text">
                                            <span className="upload-label">Bild</span>
                                            <span className="upload-status">
                                                {pendingUploads.image ? `Ausgewählt: ${pendingUploads.image.name}` : 'Bild hochladen'}
                                            </span>
                                        </div>
                                        <input
                                            type="file"
                                            ref={imageInputRef}
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleFileUpload('image', e.target.files[0])}
                                        />
                                    </div>
                                    <div className={`upload-box ${pendingUploads.drawing ? 'has-file' : ''}`} onClick={() => drawingInputRef.current?.click()}>
                                        <FileText size={20} />
                                        <div className="upload-text">
                                            <span className="upload-label">Zeichnung (PDF)</span>
                                            <span className="upload-status">
                                                {pendingUploads.drawing ? `Ausgewählt: ${pendingUploads.drawing.name}` : 'Zeichnung hochladen'}
                                            </span>
                                        </div>
                                        <input
                                            type="file"
                                            ref={drawingInputRef}
                                            accept="application/pdf"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleFileUpload('drawing', e.target.files[0])}
                                        />
                                    </div>
                                    <div className={`upload-box ${pendingUploads.customer_drawing ? 'has-file' : ''}`} onClick={() => customerDrawingInputRef.current?.click()}>
                                        <FileText size={20} />
                                        <div className="upload-text">
                                            <span className="upload-label">Kunden-Zeichnung (PDF)</span>
                                            <span className="upload-status">
                                                {pendingUploads.customer_drawing ? `Ausgewählt: ${pendingUploads.customer_drawing.name}` : 'Kunden-Zng. hochladen'}
                                            </span>
                                        </div>
                                        <input
                                            type="file"
                                            ref={customerDrawingInputRef}
                                            accept="application/pdf"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleFileUpload('customer_drawing', e.target.files[0])}
                                        />
                                    </div>
                                </div>

                                <div className="edit-actions">
                                    <button onClick={handleSave} className="save-btn"><Check size={16} /> Speichern</button>
                                    <button onClick={cancelEditing} className="cancel-btn"><X size={16} /> Abbrechen</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {filteredArticles.map(article => {
                        const isEditing = editingArticle?.id === article.id;
                        const imageUrl = getFileUrl(article, 'image');
                        const drawingUrl = getFileUrl(article, 'drawing');

                        return (
                            <div key={article.id} className={`article-card ${isEditing ? 'editing' : ''}`}>
                                {isEditing ? (
                                    <div className="card-edit-form">
                                        <div className="form-row-triple">
                                            <div className="form-row">
                                                <label>Artikel-Nr.</label>
                                                <input
                                                    type="text"
                                                    value={formData.article_id}
                                                    onChange={(e) => handleFormChange('article_id', e.target.value)}
                                                />
                                            </div>
                                            <div className="form-row">
                                                <label>Zeichn.-Nr.</label>
                                                <input
                                                    type="text"
                                                    value={formData.drawing_number}
                                                    onChange={(e) => handleFormChange('drawing_number', e.target.value)}
                                                />
                                            </div>
                                            <div className="form-row">
                                                <label>Einzelpreis (€)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.unit_price}
                                                    onChange={(e) => handleFormChange('unit_price', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <label>Beschreibung</label>
                                            <input
                                                type="text"
                                                value={formData.description}
                                                onChange={(e) => handleFormChange('description', e.target.value)}
                                            />
                                        </div>

                                        <div className="form-row">
                                            <label>Kunde</label>
                                            <input
                                                type="text"
                                                value={formData.customer_id}
                                                onChange={(e) => handleFormChange('customer_id', e.target.value)}
                                            />
                                        </div>

                                        <div className="form-row-double">
                                            <div className="form-row">
                                                <label>Rohmaterial</label>
                                                <input
                                                    type="text"
                                                    value={formData.raw_material}
                                                    onChange={(e) => handleFormChange('raw_material', e.target.value)}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div className="form-row" style={{ flex: 1 }}>
                                                    <label>Zeit / St.</label>
                                                    <input
                                                        type="number"
                                                        value={formData.production_time}
                                                        onChange={(e) => handleFormChange('production_time', parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="form-row">
                                                    <label>Einheit</label>
                                                    <select
                                                        value={formData.production_time_unit}
                                                        onChange={(e) => handleFormChange('production_time_unit', e.target.value)}
                                                        style={{ width: '70px', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '0 8px', height: '100%' }}
                                                    >
                                                        <option value="s">s</option>
                                                        <option value="m">m</option>
                                                        <option value="h">h</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>



                                        {/* File Uploads */}
                                        <div className="file-upload-section">
                                            <div className={`upload-box ${pendingUploads.image ? 'has-file' : ''}`} onClick={() => imageInputRef.current?.click()}>
                                                <ImageIcon size={20} />
                                                <div className="upload-text">
                                                    <span className="upload-label">Bild</span>
                                                    <span className="upload-status">
                                                        {pendingUploads.image ? `Ausgewählt: ${pendingUploads.image.name}` : (editingArticle.image ? 'Bild ersetzen' : 'Bild hochladen')}
                                                    </span>
                                                </div>
                                                <input
                                                    type="file"
                                                    ref={imageInputRef}
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleFileUpload('image', e.target.files[0])}
                                                />
                                            </div>
                                            <div className={`upload-box ${pendingUploads.drawing ? 'has-file' : ''}`} onClick={() => drawingInputRef.current?.click()}>
                                                <FileText size={20} />
                                                <div className="upload-text">
                                                    <span className="upload-label">Zeichnung (PDF)</span>
                                                    <span className="upload-status">
                                                        {pendingUploads.drawing ? `Ausgewählt: ${pendingUploads.drawing.name}` : (editingArticle.drawing ? 'Datei ersetzen' : 'PDF hochladen')}
                                                    </span>
                                                </div>
                                                <input
                                                    type="file"
                                                    ref={drawingInputRef}
                                                    accept="application/pdf"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleFileUpload('drawing', e.target.files[0])}
                                                />
                                            </div>
                                            <div className={`upload-box ${pendingUploads.customer_drawing ? 'has-file' : ''}`} onClick={() => customerDrawingInputRef.current?.click()}>
                                                <FileText size={20} />
                                                <div className="upload-text">
                                                    <span className="upload-label">Kunden-Zeichnung (PDF)</span>
                                                    <span className="upload-status">
                                                        {pendingUploads.customer_drawing ? `Ausgewählt: ${pendingUploads.customer_drawing.name}` : (editingArticle.customer_drawing ? 'Datei ersetzen' : 'PDF hochladen')}
                                                    </span>
                                                </div>
                                                <input
                                                    type="file"
                                                    ref={customerDrawingInputRef}
                                                    accept="application/pdf"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleFileUpload('customer_drawing', e.target.files[0])}
                                                />
                                            </div>
                                        </div>
                                        {uploadStatus && (
                                            <div style={{
                                                marginTop: '8px',
                                                padding: '8px',
                                                borderRadius: '6px',
                                                fontSize: '0.9rem',
                                                backgroundColor: uploadStatus.includes('Fehler') ? '#fee2e2' : (uploadStatus.includes('Warnung') ? '#fef3c7' : '#dcfce7'),
                                                color: uploadStatus.includes('Fehler') ? '#991b1b' : (uploadStatus.includes('Warnung') ? '#92400e' : '#166534'),
                                                textAlign: 'center',
                                                border: '1px solid ' + (uploadStatus.includes('Fehler') ? '#fecaca' : (uploadStatus.includes('Warnung') ? '#fde68a' : '#bbf7d0'))
                                            }}>
                                                {uploadStatus}
                                            </div>
                                        )}

                                        <div className="edit-actions">
                                            <button onClick={handleSave} className="save-btn"><Check size={16} /> Speichern</button>
                                            <button onClick={cancelEditing} className="cancel-btn"><X size={16} /> Abbrechen</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <button onClick={() => startEditing(article)} className="corner-btn edit-corner" title="Bearbeiten">
                                            <Pencil size={24} />
                                        </button>
                                        <button onClick={() => handleDeleteClick(article)} className="corner-btn delete-corner" title="Löschen">
                                            <Trash2 size={24} />
                                        </button>

                                        <div className="card-preview">
                                            {imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={article.article_id}
                                                    className="preview-img"
                                                    onClick={() => openFullScreen(imageUrl, 'image')}
                                                />
                                            ) : (
                                                <div className="no-image">
                                                    <Package size={32} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="card-content">
                                            <h3 className="article-id">{article.article_id || 'Keine ID'}</h3>
                                            <p className="article-desc">{article.description || '-'}</p>
                                            <div className="article-meta">
                                                <span className="meta-price">{(article.unit_price || 0).toFixed(2)} €</span>
                                                {article.drawing_number && <span className="meta-drawing">Zeichnung: {article.drawing_number}</span>}
                                            </div>
                                            <div className="article-links">
                                                {imageUrl && (
                                                    <button className="link-btn" onClick={() => openFullScreen(imageUrl, 'image')}>
                                                        <ImageIcon size={16} /> Ansicht
                                                    </button>
                                                )}

                                                {drawingUrl && (
                                                    <button className="link-btn" onClick={() => openFullScreen(drawingUrl, 'pdf')}>
                                                        <FileText size={16} /> Fertigung
                                                    </button>
                                                )}

                                                {/* Customer Drawing Button - Show if file exists OR if customer_id is set (as placeholder) */}
                                                {(getFileUrl(article, 'customer_drawing') || article.customer_id) && (
                                                    <button
                                                        className={`link-btn ${!getFileUrl(article, 'customer_drawing') ? 'disabled' : ''}`}
                                                        onClick={() => getFileUrl(article, 'customer_drawing') && openFullScreen(getFileUrl(article, 'customer_drawing'), 'pdf')}
                                                        disabled={!getFileUrl(article, 'customer_drawing')}
                                                        style={!getFileUrl(article, 'customer_drawing') ? { opacity: 0.5, cursor: 'not-allowed', background: '#f1f5f9', color: '#94a3b8' } : {}}
                                                        title={!getFileUrl(article, 'customer_drawing') ? "Kein Original hinterlegt" : "Original öffnen"}
                                                    >
                                                        <FileText size={16} /> Original
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )
            }

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                title="Artikel löschen"
                message={`Möchten Sie den Artikel "${articleToDelete?.article_id}" wirklich löschen?`}
                onConfirm={confirmDelete}
                onCancel={() => setIsDeleteModalOpen(false)}
                confirmText="Löschen"
                isDestructive={true}
            />

            {/* File Preview Modal */}
            {previewFile && (
                <div className="file-preview-overlay" onClick={() => setPreviewFile(null)}>
                    <div className="file-preview-modal" onClick={e => e.stopPropagation()}>
                        <button className="preview-close-btn" onClick={() => setPreviewFile(null)}>
                            <X size={24} />
                        </button>
                        <div className="preview-content">
                            {previewFile.type === 'pdf' ? (
                                <iframe
                                    src={`${previewFile.url}#toolbar=0&view=FitH&navpanes=0`}
                                    className="preview-frame"
                                    title="Preview"
                                />
                            ) : (
                                <img
                                    src={previewFile.url}
                                    alt="Preview"
                                    className="preview-image"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .file-preview-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.75);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 2000;
                    padding: 2rem;
                    backdrop-filter: blur(4px);
                }
                .file-preview-modal {
                    background: white;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 1000px;
                    height: 90vh;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    animation: slideUp 0.3s ease-out;
                }
                .preview-close-btn {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    background: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    z-index: 10;
                    color: #64748b;
                    transition: all 0.2s;
                }
                .preview-close-btn:hover {
                    transform: scale(1.1);
                    color: #ef4444;
                }
                .preview-content {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #f1f5f9;
                    overflow: hidden;
                    position: relative;
                }
                .preview-frame {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .preview-image {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .article-list-section {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    min-height: 0;
                    padding: 1rem 0 0 0;
                }
                .section-header {
                    flex-shrink: 0;
                    margin-bottom: 1rem;
                }
                .section-header h2 {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 0.5rem;
                    color: var(--color-text-main);
                }
                .section-header p {
                    color: var(--color-text-muted);
                    margin-left: 36px;
                }
                .icon-main {
                    color: var(--color-primary);
                }

                .search-actions-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .create-btn-full {
                    width: 100%;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 1rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);
                }
                .create-btn-full:hover {
                    background: #4338ca; /* Indigo 700 - Explicit Darker Shade */
                    color: white;
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3);
                }
                .search-bar {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    background: white;
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 0.75rem 1rem;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* Shadow SM */
                    transition: all 0.2s;
                    margin-bottom: 1rem; /* Kept from original */
                }
                .search-bar input {
                    flex: 1; /* Allow input to grow */
                    padding: 0 0 0 12px; /* Adjust padding as icon is inside */
                    border: none; /* Remove border as it's on parent */
                    font-size: 1rem;
                    background: transparent; /* Transparent background */
                }
                .search-bar input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }
                .search-icon {
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--color-text-muted);
                }

                .loading-state, .empty-state {
                    text-align: center;
                    padding: 3rem;
                    color: var(--color-text-muted);
                    background: white;
                    border-radius: 16px;
                    border: 1px solid var(--color-border);
                }

                .article-grid {
                    flex: 1;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 20px;
                    padding-bottom: 1rem;
                    align-content: start;
                }

                .article-card {
                    background: white;
                    border-radius: 16px;
                    border: 1px solid var(--color-border);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: all 0.2s;
                }
                .article-card:hover {
                    box-shadow: var(--shadow-md);
                    transform: translateY(-2px);
                }
                .article-card.editing {
                    border-color: var(--color-primary);
                }

                .card-preview {
                    height: 165px; /* Increased by another ~10% (150px -> 165px) */
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    overflow: hidden;
                    position: relative; /* Context for absolute buttons */
                }
                .preview-img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain; /* Show full image */
                    padding: 2px; /* Minimal padding for max size */
                }
                .no-image {
                    color: #cbd5e1;
                }

                .card-content {
                    padding: 16px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .article-id {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--color-primary);
                    margin: 0;
                    font-family: monospace;
                }
                .article-desc {
                    font-size: 0.9rem;
                    color: var(--color-text-muted);
                    margin: 0;
                    flex: 1;
                }
                .article-card {
                    /* Ensure relative positioning for absolute children */
                    position: relative; 
                }
                .corner-btn {
                    position: absolute;
                    top: 12px;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    cursor: pointer;
                    color: white !important;
                    transition: all 0.2s;
                    z-index: 100; /* Increased Z-Index */
                    box-shadow: 0 4px 6px rgba(0,0,0,0.15);
                    padding: 0;
                    margin: 0;
                }
                
                .edit-corner {
                    left: 12px;
                    background: var(--color-primary) !important; /* App Blue */
                }
                .edit-corner:hover {
                    background: var(--color-primary-dark) !important;
                    transform: scale(1.1);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.2);
                }

                .delete-corner {
                    right: 12px;
                    background: #ef4444 !important; /* Red 500 */
                }
                .delete-corner:hover {
                    background: #dc2626 !important; /* Red 600 */
                    transform: scale(1.1);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.2);
                }
                .article-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    font-size: 0.8rem;
                }
                .meta-price {
                    background: #ecfdf5;
                    color: #059669;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-weight: 600;
                }
                .meta-drawing {
                    background: #f1f5f9;
                    color: var(--color-text-muted);
                    padding: 4px 10px;
                    border-radius: 20px;
                }

                .article-links {
                    display: flex; /* Restored horizontal layout */
                    gap: 8px;
                    margin-top: 8px;
                }
                .link-btn {
                    flex: 1; /* Equal width */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 8px 4px; /* Reduced side padding */
                    border: 1px solid var(--color-border);
                    background: white;
                    border-radius: 8px;
                    color: var(--color-primary);
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    min-width: 0; /* Allow shrinking */
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .link-btn:hover {
                    background: #eff6ff;
                    border-color: var(--color-primary);
                }

                .card-actions-footer {
                    border-top: 1px solid var(--color-border);
                    display: flex; /* Add flex layout */
                }
                .footer-btn {
                    flex: 1;
                    background: none;
                    border: none;
                    padding: 12px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    transition: background 0.2s;
                }
                .footer-btn:first-child {
                    border-right: 1px solid var(--color-border);
                }
                .footer-btn.edit:hover {
                    color: var(--color-primary);
                    background: #eff6ff;
                }
                .footer-btn.delete {
                    /* flex: 1 inherited from .footer-btn */
                    color: #ef4444;
                }
                .footer-btn.delete:hover {
                    background: #fef2f2;
                    color: #dc2626;
                }

                /* File Upload Styles */
                .file-upload-section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 12px;
                }
                .upload-box {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 12px;
                    padding: 12px 16px;
                    border: 1px dashed var(--color-border);
                    border-radius: 8px;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    font-size: 0.9rem;
                    background: #f8fafc;
                    transition: all 0.2s;
                    min-height: auto;
                }
                .upload-box:hover {
                    border-color: var(--color-primary);
                    background: #eff6ff;
                }
                .upload-box.has-file {
                    border-style: solid;
                    border-color: var(--color-primary);
                    background: #eff6ff;
                    color: var(--color-primary);
                }
                .upload-text {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }
                .upload-label {
                    font-weight: 600;
                    color: var(--color-text-main);
                    font-size: 0.85rem;
                }
                .upload-status {
                    font-size: 0.8rem;
                    color: var(--color-text-muted);
                }
                .upload-box.has-file .upload-status {
                    color: var(--color-primary);
                }

                /* Edit Form Styles */
                .card-edit-form {
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .form-row {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 0; /* Important for Grid */
                }
                .form-row label {
                    font-size: 0.8rem;
                    color: var(--color-text-muted);
                    font-weight: 500;
                }
                .form-row input {
                    padding: 10px;
                    width: 100%;
                    box-sizing: border-box;
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    font-size: 0.95rem;
                }
                .form-row input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }
                .form-row-double {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .form-row-triple {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 12px;
                }

                .file-upload-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 8px;
                    margin-top: 8px;
                }
                .upload-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 4px;
                    border: 2px dashed var(--color-border);
                    border-radius: 8px;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    font-size: 0.8rem;
                    text-align: center;
                    transition: all 0.2s;
                    min-height: 80px;
                }
                .upload-box:hover {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                    background: #f8fafc;
                }

                .work-steps-selector {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 4px;
                }
                .step-toggle-btn {
                    padding: 8px 14px;
                    border-radius: 8px;
                    border: 1px solid var(--color-border);
                    background: #f8fafc;
                    color: var(--color-text-muted);
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .step-toggle-btn.active {
                    background: var(--color-primary);
                    color: white;
                    border-color: var(--color-primary);
                }

                .edit-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .save-btn {
                    flex: 1;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 10px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .cancel-btn {
                    flex: 1;
                    background: #ef4444;
                    color: white;
                    border: none;
                    padding: 10px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .cancel-btn:hover {
                    background: #dc2626;
                }
                .create-btn {
                    padding: 8px 16px;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: background 0.2s;
                }
                .create-btn:hover {
                    background: #2563eb; /* slightly darker blue */
                }
                .form-head h3 { margin: 0 0 12px 0; color: var(--color-primary); }
            `}</style>
        </div >
    );
};

export default ArticleList;
