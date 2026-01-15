import { useState, useEffect, useRef } from 'react';
import { Package, Search, Pencil, X, Check, Upload, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { getArticles, updateArticle, createArticle } from '../services/storage';
import { pb } from '../lib/pocketbase';

const ArticleList = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingArticle, setEditingArticle] = useState(null);
    const [formData, setFormData] = useState({});

    const imageInputRef = useRef(null);
    const drawingInputRef = useRef(null);

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
            raw_material: article.raw_material || ''
        });
    };

    const cancelEditing = () => {
        setEditingArticle(null);
        setFormData({});
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!editingArticle) return;

        await updateArticle(editingArticle.id, formData);
        await fetchArticles();
        setEditingArticle(null);
    };

    const handleFileUpload = async (type, file) => {
        if (!editingArticle || !file) return;

        const fd = new FormData();
        fd.append(type, file); // 'image' or 'drawing'

        try {
            console.log('Uploading file:', type, file.name);
            await pb.collection('articles').update(editingArticle.id, fd);

            // Refresh articles list
            await fetchArticles();

            // Update editingArticle to reflect new file
            const updated = await pb.collection('articles').getOne(editingArticle.id);
            console.log('Updated article:', updated);
            console.log('Image field:', updated.image);
            console.log('Drawing field:', updated.drawing);
            setEditingArticle(updated);

            alert('Datei erfolgreich hochgeladen!');
        } catch (error) {
            console.error('Upload error:', error);
            alert('Fehler beim Hochladen: ' + error.message);
        }
    };

    const getFileUrl = (article, fieldName) => {
        if (!article || !article[fieldName]) {
            console.log('No file for field:', fieldName, 'article:', article?.article_id);
            return null;
        }
        const url = pb.files.getUrl(article, article[fieldName]);
        console.log('File URL for', fieldName, ':', url);
        return url;
    };

    const openFullScreen = (url, type) => {
        if (type === 'pdf') {
            window.open(url, '_blank');
        } else {
            // Open image in new tab
            window.open(url, '_blank');
        }
    };

    return (
        <div className="article-list-section">
            <div className="section-header">
                <div>
                    <h2><Package size={24} className="icon-main" /> Artikel verwalten</h2>
                    <p>Technische Daten, Zeichnungen und Bilder zu Artikeln</p>
                </div>
            </div>

            <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Artikel suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="loading-state">Lade Artikel...</div>
            ) : filteredArticles.length === 0 ? (
                <div className="empty-state">
                    {searchTerm ? 'Keine Artikel gefunden.' : 'Noch keine Artikel vorhanden.'}
                </div>
            ) : (
                <div className="article-grid">
                    {filteredArticles.map(article => {
                        const isEditing = editingArticle?.id === article.id;
                        const imageUrl = getFileUrl(article, 'image');
                        const drawingUrl = getFileUrl(article, 'drawing');

                        return (
                            <div key={article.id} className={`article-card ${isEditing ? 'editing' : ''}`}>
                                {isEditing ? (
                                    <div className="card-edit-form">
                                        <div className="form-row">
                                            <label>Artikel-Nr.</label>
                                            <input
                                                type="text"
                                                value={formData.article_id}
                                                onChange={(e) => handleFormChange('article_id', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-row">
                                            <label>Beschreibung</label>
                                            <input
                                                type="text"
                                                value={formData.description}
                                                onChange={(e) => handleFormChange('description', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-row-double">
                                            <div className="form-row">
                                                <label>Einzelpreis (€)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.unit_price}
                                                    onChange={(e) => handleFormChange('unit_price', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div className="form-row">
                                                <label>Kunden-ID</label>
                                                <input
                                                    type="text"
                                                    value={formData.customer_id}
                                                    onChange={(e) => handleFormChange('customer_id', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-row-double">
                                            <div className="form-row">
                                                <label>Zeichnungsnummer</label>
                                                <input
                                                    type="text"
                                                    value={formData.drawing_number}
                                                    onChange={(e) => handleFormChange('drawing_number', e.target.value)}
                                                />
                                            </div>
                                            <div className="form-row">
                                                <label>Rohmaterial</label>
                                                <input
                                                    type="text"
                                                    value={formData.raw_material}
                                                    onChange={(e) => handleFormChange('raw_material', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* File Uploads */}
                                        <div className="file-upload-section">
                                            <div className="upload-box" onClick={() => imageInputRef.current?.click()}>
                                                <ImageIcon size={20} />
                                                <span>{editingArticle.image ? 'Bild ersetzen' : 'Bild hochladen'}</span>
                                                <input
                                                    type="file"
                                                    ref={imageInputRef}
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleFileUpload('image', e.target.files[0])}
                                                />
                                            </div>
                                            <div className="upload-box" onClick={() => drawingInputRef.current?.click()}>
                                                <FileText size={20} />
                                                <span>{editingArticle.drawing ? 'Zeichnung ersetzen' : 'Zeichnung hochladen'}</span>
                                                <input
                                                    type="file"
                                                    ref={drawingInputRef}
                                                    accept="application/pdf"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleFileUpload('drawing', e.target.files[0])}
                                                />
                                            </div>
                                        </div>

                                        <div className="edit-actions">
                                            <button onClick={handleSave} className="save-btn"><Check size={16} /> Speichern</button>
                                            <button onClick={cancelEditing} className="cancel-btn"><X size={16} /> Abbrechen</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="card-preview">
                                            {imageUrl ? (
                                                <img src={imageUrl} alt={article.article_id} className="preview-img" onClick={() => openFullScreen(imageUrl, 'image')} />
                                            ) : (
                                                <div className="no-image"><Package size={32} /></div>
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
                                                {drawingUrl && (
                                                    <button className="link-btn" onClick={() => openFullScreen(drawingUrl, 'pdf')}>
                                                        <FileText size={16} /> Zeichnung
                                                    </button>
                                                )}
                                                {imageUrl && (
                                                    <button className="link-btn" onClick={() => openFullScreen(imageUrl, 'image')}>
                                                        <ImageIcon size={16} /> Bild
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="card-actions-footer">
                                            <button onClick={() => startEditing(article)} className="footer-btn edit">
                                                <Pencil size={16} /> Bearbeiten
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
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

                .search-bar {
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 1rem;
                }
                .search-bar input {
                    width: 100%;
                    padding: 12px 12px 12px 44px;
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    font-size: 1rem;
                    background: white;
                }
                .search-bar input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }
                .search-icon {
                    position: absolute;
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
                    height: 140px;
                    background: #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }
                .preview-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
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
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--color-text-main);
                    margin: 0;
                    font-family: monospace;
                }
                .article-desc {
                    font-size: 0.9rem;
                    color: var(--color-text-muted);
                    margin: 0;
                    flex: 1;
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
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .link-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    background: white;
                    color: var(--color-primary);
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .link-btn:hover {
                    background: #eff6ff;
                    border-color: var(--color-primary);
                }

                .card-actions-footer {
                    border-top: 1px solid var(--color-border);
                }
                .footer-btn {
                    width: 100%;
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
                .footer-btn.edit:hover {
                    color: var(--color-primary);
                    background: #eff6ff;
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
                }
                .form-row label {
                    font-size: 0.8rem;
                    color: var(--color-text-muted);
                    font-weight: 500;
                }
                .form-row input {
                    padding: 10px;
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

                .file-upload-section {
                    display: flex;
                    gap: 12px;
                    margin-top: 8px;
                }
                .upload-box {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px;
                    border: 2px dashed var(--color-border);
                    border-radius: 8px;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .upload-box:hover {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                    background: #f8fafc;
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
                    background: transparent;
                    color: var(--color-text-muted);
                    border: 1px solid var(--color-border);
                    padding: 10px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
            `}</style>
        </div>
    );
};

export default ArticleList;
