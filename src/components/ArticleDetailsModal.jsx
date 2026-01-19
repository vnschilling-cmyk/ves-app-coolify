import { useState, useEffect } from 'react';
import { X, Package, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { getArticles } from '../services/storage'; // Changed from getArticleByArticleId
import { pb } from '../lib/pocketbase';

const ArticleDetailsModal = ({ articleId, onClose }) => {
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadArticle = async () => {
            if (!articleId) return;
            setLoading(true);
            try {
                // Fetch all/list of articles to perform lenient matching client-side
                // This bypasses potential "text vs number" filter issues in DB
                const allArticles = await getArticles();

                const searchId = articleId.toString().trim().toLowerCase();
                const found = allArticles.find(a =>
                    (a.article_id || '').toString().trim().toLowerCase() === searchId
                );

                if (found) {
                    setArticle(found);
                    setError(null);
                } else {
                    console.warn("Article not found via JS find:", searchId);
                    setError(`Artikel nicht gefunden. Gesucht: '${articleId}'`);
                }
            } catch (err) {
                console.error(err);
                setError('Fehler beim Laden des Artikels.');
            } finally {
                setLoading(false);
            }
        };

        loadArticle();
    }, [articleId]);

    const getFileUrl = (record, filename) => {
        if (!record || !filename) return null;
        return pb.files.getUrl(record, filename);
    };

    const formatFilename = (filename) => {
        if (!filename) return '';
        // Try to remove PocketBase 10-char random suffix (e.g., _abcdefghij.pdf)
        // Regex looks for underscore + 10 alphanumeric chars + dot + extension
        return filename.replace(/_[a-zA-Z0-9]{10}(\.[a-zA-Z0-9]+)$/, '$1');
    };

    if (!articleId) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title-row">
                        <Package size={24} className="text-primary" />
                        <h3>Artikel Details</h3>
                    </div>
                    <button className="btn-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="state-msg">Lade Artikeldaten...</div>
                    ) : error ? (
                        <div className="state-msg error">
                            {error}
                            <br /><span style={{ fontSize: '0.8em', color: '#94a3b8' }}>Datenbank durchsucht.</span>
                        </div>
                    ) : article ? (
                        <div className="article-details-container">
                            {/* Header Info */}
                            <div className="info-header">
                                <span className="article-number">{article.article_id}</span>
                                <span className="article-desc">{article.description}</span>
                            </div>

                            {/* Media Grid (Drawing & Image) */}
                            <div className="media-grid">
                                {/* Image (Top) */}
                                <div className="media-card">
                                    <div className="media-title"><ImageIcon size={16} /> Bild</div>
                                    {article.image ? (
                                        <div className="media-content-wrapper">
                                            <div className="image-preview-box">
                                                <img
                                                    src={getFileUrl(article, article.image)}
                                                    alt="Artikelbild"
                                                    onClick={() => window.open(getFileUrl(article, article.image), '_blank')}
                                                    className="preview-img"
                                                />
                                            </div>
                                            <div className="media-actions">
                                                {/* Image doesn't usually need filename, but consistency is okay */}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="media-empty">Kein Bild</div>
                                    )}
                                </div>

                                {/* Drawing (Bottom) */}
                                <div className="media-card">
                                    <div className="media-title"><FileText size={16} /> Zeichnung</div>
                                    {article.drawing ? (
                                        <div className="media-content-wrapper">
                                            {/* PDF Preview */}
                                            <div className="pdf-preview-box">
                                                <iframe
                                                    src={`${getFileUrl(article, article.drawing)}#toolbar=0&view=FitH&scrollbar=0&navpanes=0`}
                                                    title="PDF Vorschau"
                                                    className="pdf-frame"
                                                    scrolling="no"
                                                />
                                            </div>
                                            <div className="media-actions">
                                                <span className="file-name" title={article.drawing}>
                                                    {formatFilename(article.drawing)}
                                                </span>
                                                <button
                                                    className="btn-open-file"
                                                    onClick={() => window.open(getFileUrl(article, article.drawing), '_blank')}
                                                >
                                                    <Download size={16} /> Öffnen
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="media-empty">Keine Zeichnung</div>
                                    )}
                                </div>

                                {/* Customer Drawing (New) */}
                                <div className="media-card">
                                    <div className="media-title"><FileText size={16} className="text-secondary" /> Kundenzeichnung</div>
                                    {article.customer_drawing ? (
                                        <div className="media-content-wrapper">
                                            {/* PDF Preview */}
                                            <div className="pdf-preview-box">
                                                <iframe
                                                    src={`${getFileUrl(article, article.customer_drawing)}#toolbar=0&view=FitH&scrollbar=0&navpanes=0`}
                                                    title="Kundenzeichnung Vorschau"
                                                    className="pdf-frame"
                                                    scrolling="no"
                                                />
                                            </div>
                                            <div className="media-actions">
                                                <span className="file-name" title={article.customer_drawing}>
                                                    {formatFilename(article.customer_drawing)}
                                                </span>
                                                <button
                                                    className="btn-open-file"
                                                    onClick={() => window.open(getFileUrl(article, article.customer_drawing), '_blank')}
                                                >
                                                    <Download size={16} /> Öffnen
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="media-empty">Keine Kundenzeichnung</div>
                                    )}
                                </div>
                            </div>

                            {/* Technical Specs */}
                            <div className="specs-table">
                                <div className="spec-row">
                                    <span className="spec-label">Zeichnungs-Nr.:</span>
                                    <span className="spec-value">{article.drawing_number || '-'}</span>
                                </div>
                                <div className="spec-row">
                                    <span className="spec-label">Rohmaterial:</span>
                                    <span className="spec-value">{article.raw_material || '-'}</span>
                                </div>
                                <div className="spec-row">
                                    <span className="spec-label">Kunden-ID:</span>
                                    <span className="spec-value">{article.customer_id || '-'}</span>
                                </div>
                                <div className="spec-row">
                                    <span className="spec-label">Preis:</span>
                                    <span className="spec-value">{(article.unit_price || 0).toFixed(2)} €</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="state-msg">Keine Daten verfügbar.</div>
                    )}
                </div>
            </div>

            <style>{`
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5); z-index: 1000;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px; backdrop-filter: blur(5px);
                }
                .modal-content {
                    background: white; width: 95%; max-width: 360px; /* Mobile friendly narrow width */
                    border-radius: 20px; display: flex; flex-direction: column;
                    box-shadow: var(--shadow-xl); overflow: hidden;
                    max-height: 90vh;
                }
                .modal-header {
                    padding: 16px 20px; border-bottom: 1px solid var(--color-border);
                    display: flex; justify-content: space-between; align-items: center;
                    background: #f8fafc;
                }
                .modal-title-row { display: flex; align-items: center; gap: 10px; }
                .modal-title-row h3 { margin: 0; color: var(--color-text-main); font-size: 1.1rem; }
                .text-primary { color: var(--color-primary); }
                .text-secondary { color: #64748b; }
                
                .btn-close { background: none; border: none; cursor: pointer; color: var(--color-text-muted); }
                
                .modal-body { padding: 20px; overflow-y: auto; }
                
                .state-msg { text-align: center; padding: 20px; color: var(--color-text-muted); }
                .state-msg.error { color: #ef4444; }

                .article-details-container { display: flex; flex-direction: column; gap: 24px; }
                
                .info-header { display: flex; flex-direction: column; gap: 4px; }
                .article-number { font-size: 1.5rem; font-weight: 800; color: var(--color-primary); font-family: monospace; }
                .article-desc { font-size: 1.1rem; color: var(--color-text-main); line-height: 1.4; }

                /* Always stack on narrow modal */
                .media-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }

                .media-card {
                    background: white; border: 1px solid var(--color-border);
                    border-radius: 12px; padding: 12px;
                    display: flex; flex-direction: column; gap: 12px;
                }
                .media-title { font-size: 0.9rem; font-weight: 600; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
                .media-empty { font-size: 0.8rem; color: #cbd5e1; font-style: italic; text-align: center; padding: 20px; }
                
                .media-content-wrapper { display: flex; flex-direction: column; gap: 12px; }

                .pdf-preview-box {
                    width: 100%; aspect-ratio: 210/297; /* DIN A4 */
                    background: white;
                    border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;
                }
                .pdf-frame { 
                    width: 100%; height: 100%; border: none; 
                    overflow: hidden; /* Force hide scrollbars */
                    display: block;
                    transform: scale(1.04); /* Zoom slightly to crop borders */
                    transform-origin: center center;
                }

                .image-preview-box {
                    width: 100%; aspect-ratio: 16/10; background: white;
                    border-radius: 8px; overflow: hidden; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                }
                .preview-img { width: 100%; height: 100%; object-fit: contain; transition: transform 0.2s; transform: scale(1.25); }
                .preview-img:hover { transform: scale(1.35); }
                
                .media-actions { display: flex; flex-direction: column; gap: 6px; }
                .file-name { font-size: 0.8rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace; }
                .btn-open-file {
                    background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;
                    padding: 8px; border-radius: 8px; font-size: 0.85rem; font-weight: 500;
                    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
                    transition: all 0.2s;
                    width: 100%;
                }
                .btn-open-file:hover { background: #dbeafe; }

                .specs-table {
                    display: flex; flex-direction: column; gap: 0;
                    background: #f8fafc; border-radius: 12px; overflow: hidden;
                    border: 1px solid var(--color-border);
                }
                .spec-row {
                    display: flex; justify-content: space-between; padding: 12px 16px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .spec-row:last-child { border-bottom: none; }
                .spec-label { color: var(--color-text-muted); font-size: 0.9rem; }
                .spec-value { font-weight: 600; color: var(--color-text-main); font-size: 0.95rem; }
            `}</style>
        </div>
    );
};

export default ArticleDetailsModal;
