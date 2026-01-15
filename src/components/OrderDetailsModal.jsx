import { useState, useEffect } from 'react';
import { X, Clock, Calendar, User, Pencil, Check, AlertTriangle, ArrowRight, Trash2, FileText, Image as ImageIcon } from 'lucide-react';
import { getWorkLogs, updateWorkLog, createWorkLog, deleteWorkLog, getArticleByArticleId } from '../services/storage';
import { useUsers } from '../context/UserContext';
import { pb } from '../lib/pocketbase';

const OrderDetailsModal = ({ order, onClose }) => {
    const { users } = useUsers();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [article, setArticle] = useState(null);

    // Editing State
    const [editingLogId, setEditingLogId] = useState(null);
    const [editData, setEditData] = useState({ user_name: '', quantity_produced: 0 });

    // Split Modal State
    const [splitModal, setSplitModal] = useState(null); // { diff, logId, oldUser }
    const [splitTargetUser, setSplitTargetUser] = useState('');

    useEffect(() => {
        if (order?.db_id) {
            loadLogs();
        }
        if (order?.article_id) {
            loadArticle();
        }
    }, [order]);

    const loadLogs = async () => {
        setLoading(true);
        const data = await getWorkLogs(order.db_id);
        setLogs(data);
        setLoading(false);
    };

    const loadArticle = async () => {
        const artData = await getArticleByArticleId(order.article_id);
        setArticle(artData);
    };

    const getArticleFileUrl = (fieldName) => {
        if (!article || !article[fieldName]) return null;
        return pb.files.getUrl(article, article[fieldName]);
    };

    const openFullScreen = (url) => {
        window.open(url, '_blank');
    };

    const handleStartEdit = (log) => {
        setEditingLogId(log.id);
        setEditData({
            user_name: log.user_name,
            quantity_produced: log.quantity_produced || 0
        });
    };

    const handleCancelEdit = () => {
        setEditingLogId(null);
        setEditData({ user_name: '', quantity_produced: 0 });
    };

    const handleDelete = async (logId) => {
        if (window.confirm('Möchtest du diesen Arbeitsgang wirklich löschen?')) {
            await deleteWorkLog(logId);
            loadLogs();
        }
    };

    const handleSave = async () => {
        const originalLog = logs.find(l => l.id === editingLogId);
        if (!originalLog) return;

        const newQty = parseInt(editData.quantity_produced) || 0;
        const oldQty = parseInt(originalLog.quantity_produced) || 0;

        // Validation: Limit Check
        const orderQty = parseInt(order.quantity) || 0;
        const currentTotal = logs.reduce((sum, log) => sum + (log.quantity_produced || 0), 0);
        const projectedTotal = currentTotal - oldQty + newQty;

        if (orderQty > 0 && projectedTotal > orderQty) {
            alert(`Fehler: Die Gesamtmenge (${projectedTotal}) würde die Auftragsmenge (${orderQty}) überschreiten!`);
            return;
        }

        const diff = oldQty - newQty;

        // Ensure we update user if changed
        const updates = {
            user_name: editData.user_name,
            quantity_produced: newQty
        };

        if (diff > 0) {
            // Quantity reduced - Offer split
            setSplitModal({
                diff,
                logId: editingLogId,
                updates,
                oldUser: originalLog.user_name
            });
            // Default target user to the current editing user or the first verified user
            setSplitTargetUser(users[0]?.name || '');
        } else {
            // Just update
            await executeUpdate(editingLogId, updates);
        }
    };

    const executeUpdate = async (logId, updates) => {
        await updateWorkLog(logId, updates);
        setEditingLogId(null);
        setSplitModal(null);
        loadLogs(); // Reload to refresh
    };

    const handleConfirmSplit = async () => {
        if (!splitModal) return;

        // 1. Update original log
        await updateWorkLog(splitModal.logId, splitModal.updates);

        // 2. Create new log for the difference
        // We need original log details for start/end time
        const originalLog = logs.find(l => l.id === splitModal.logId);

        if (originalLog) {
            await createWorkLog({
                order_id: originalLog.order_id,
                user_name: splitTargetUser,
                start_time: originalLog.start_time,
                end_time: originalLog.end_time,
                quantity_produced: splitModal.diff
            });
        }

        setEditingLogId(null);
        setSplitModal(null);
        loadLogs();
    };

    const handleSkipSplit = async () => {
        if (!splitModal) return;
        // Just update the original, discard the difference
        await executeUpdate(splitModal.logId, splitModal.updates);
    };

    const formatDate = (isoString) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const calculateDuration = (start, end) => {
        if (!end) return 'Läuft...';
        const diff = new Date(end) - new Date(start);
        const minutes = Math.floor(diff / 60000);
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    };

    const totalProduced = logs.reduce((sum, log) => sum + (log.quantity_produced || 0), 0);
    const orderQty = parseInt(order.quantity) || 0;
    const progressPercent = orderQty > 0 ? Math.min(100, (totalProduced / orderQty) * 100) : 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content details-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header-std">
                    <div className="header-title-centered" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h3>Auftrag {order.id}</h3>
                        <span className="company-subtitle">{order.company}</span>
                    </div>
                    <button className="modal-close-std" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="details-body">
                    {/* Progress Card */}
                    <div className="progress-card">
                        <div className="progress-labels">
                            <span>Fortschritt</span>
                            <span className="font-bold">{totalProduced} / {order.quantity || '?'} {order.quantity && 'Stk.'}</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div
                                className="progress-bar-fill"
                                style={{
                                    width: `${progressPercent}%`,
                                    backgroundColor: progressPercent >= 100 ? '#10b981' : '#3b82f6'
                                }}
                            ></div>
                        </div>
                    </div>

                    {/* Article Info Section */}
                    {order.article_id && (
                        <div className="article-info-card">
                            <h4>Artikel: {order.article_id}</h4>
                            {article ? (
                                <div className="article-links-row">
                                    {getArticleFileUrl('drawing') && (
                                        <button className="article-link-btn" onClick={() => openFullScreen(getArticleFileUrl('drawing'))}>
                                            <FileText size={16} /> Zeichnung
                                        </button>
                                    )}
                                    {getArticleFileUrl('image') && (
                                        <button className="article-link-btn" onClick={() => openFullScreen(getArticleFileUrl('image'))}>
                                            <ImageIcon size={16} /> Vorschaubild
                                        </button>
                                    )}
                                    {!getArticleFileUrl('drawing') && !getArticleFileUrl('image') && (
                                        <span className="no-files-text">Keine Dateien hinterlegt</span>
                                    )}
                                </div>
                            ) : (
                                <span className="no-files-text">Artikel nicht gefunden</span>
                            )}
                        </div>
                    )}

                    {/* Work Log List */}
                    <div className="work-logs-section">
                        <h4>Arbeitsgänge</h4>
                        {loading ? (
                            <div className="loading-state">Lade Daten...</div>
                        ) : logs.length === 0 ? (
                            <div className="empty-logs">Noch keine Arbeitszeiten erfasst.</div>
                        ) : (
                            <div className="logs-list">
                                {logs.map(log => {
                                    const isEditing = editingLogId === log.id;
                                    return (
                                        <div key={log.id} className={`log-item ${isEditing ? 'editing' : ''}`}>
                                            {isEditing ? (
                                                /* Edit Mode */
                                                <div className="log-edit-form">
                                                    <div className="edit-row">
                                                        <label>Mitarbeiter:</label>
                                                        <select
                                                            value={editData.user_name}
                                                            onChange={e => setEditData({ ...editData, user_name: e.target.value })}
                                                            className="edit-select"
                                                        >
                                                            {users.map(u => (
                                                                <option key={u.name} value={u.name}>{u.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="edit-row">
                                                        <label>Menge:</label>
                                                        <div className="slider-container-small">
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max={(parseInt(order.quantity) || 0) - (totalProduced - (logs.find(l => l.id === editingLogId)?.quantity_produced || 0))}
                                                                value={editData.quantity_produced}
                                                                onChange={e => setEditData({ ...editData, quantity_produced: parseInt(e.target.value) || 0 })}
                                                                className="edit-slider"
                                                            />
                                                            <span className="slider-value">{editData.quantity_produced} Stk.</span>
                                                        </div>
                                                    </div>
                                                    <div className="edit-actions">
                                                        <button onClick={handleSave} className="btn-save small"><Check size={16} /> Speichern</button>
                                                        <button onClick={handleCancelEdit} className="btn-cancel small"><X size={16} /> Abb.</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* View Mode */
                                                <>
                                                    <div className="log-header">
                                                        <span className="log-user">
                                                            <User size={14} /> {log.user_name}
                                                        </span>
                                                        <span className="log-date">
                                                            <Calendar size={14} /> {formatDate(log.start_time)}
                                                        </span>
                                                    </div>
                                                    <div className="log-details">
                                                        <div className="log-metric">
                                                            <span className="label">Dauer</span>
                                                            <span className="value">
                                                                <Clock size={14} /> {calculateDuration(log.start_time, log.end_time)}
                                                            </span>
                                                        </div>
                                                        <div className="log-metric-group-right">
                                                            {log.quantity_produced > 0 && (
                                                                <div className="log-metric">
                                                                    <span className="label">Menge</span>
                                                                    <span className="value font-bold">+{log.quantity_produced}</span>
                                                                </div>
                                                            )}
                                                            <div className="log-actions">
                                                                <button className="edit-icon-btn" onClick={() => handleStartEdit(log)} title="Bearbeiten">
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button className="delete-icon-btn" onClick={() => handleDelete(log.id)} title="Löschen">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Split Confirm Modal (Overlay inside Modal) */}
                {splitModal && (
                    <div className="split-confirm-overlay">
                        <div className="split-confirm-card">
                            <div className="split-header">
                                <AlertTriangle size={24} color="#f59e0b" />
                                <h4>Menge reduziert</h4>
                            </div>
                            <p>Du hast die Menge um <strong>{splitModal.diff} Stk.</strong> verringert.</p>
                            <p className="split-question">Soll die Differenz einem anderen Mitarbeiter gutgeschrieben werden?</p>

                            <div className="split-target-select">
                                <label>Gutschreiben an:</label>
                                <select
                                    value={splitTargetUser}
                                    onChange={e => setSplitTargetUser(e.target.value)}
                                >
                                    {users.map(u => (
                                        <option key={u.name} value={u.name}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="split-actions">
                                <button onClick={handleConfirmSplit} className="btn-confirm-split">
                                    <ArrowRight size={16} /> Ja, Umbuchen
                                </button>
                                <button onClick={handleSkipSplit} className="btn-skip-split">
                                    Nein, verwerfen
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                .details-modal {
                    max-width: 500px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    position: relative; /* Context */
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    padding-right: 40px; /* Space for close button */
                }
                .close-icon-btn {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: #94a3b8; /* Muted gray background */
                    color: white; /* White X */
                    border: none;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background 0.2s;
                    z-index: 10;
                }
                .close-icon-btn:hover {
                    background: #ef4444; /* Red on hover */
                }
                .header-title {
                    display: flex;
                    flex-direction: column;
                }
                .company-subtitle {
                    font-size: 0.85rem;
                    color: var(--color-text-muted);
                }
                .details-body {
                    padding: 0 20px 20px 20px; /* Remove top padding as header has margin */
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .progress-card {
                    background: #f8fafc;
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid var(--color-border);
                }
                .progress-labels {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                    color: var(--color-text-main);
                }
                .progress-bar-bg {
                    height: 8px;
                    background: #e2e8f0;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .progress-bar-fill {
                    height: 100%;
                    transition: width 0.5s ease-out;
                }
                .article-info-card {
                    background: #f0fdf4;
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid #86efac;
                }
                .article-info-card h4 {
                    margin: 0 0 12px 0;
                    font-size: 1rem;
                    color: #166534;
                }
                .article-links-row {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .article-link-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border: 1px solid #22c55e;
                    border-radius: 8px;
                    background: white;
                    color: #16a34a;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .article-link-btn:hover {
                    background: #dcfce7;
                    border-color: #16a34a;
                }
                .no-files-text {
                    color: #6b7280;
                    font-size: 0.85rem;
                    font-style: italic;
                }
                .work-logs-section h4 {
                    font-size: 1rem;
                    margin-bottom: 12px;
                    color: var(--color-text-main);
                }
                .logs-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .log-item {
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 12px;
                    background: white;
                    position: relative;
                }
                .log-item.editing {
                    border-color: var(--color-primary);
                    background: #eff6ff;
                }
                .log-header {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85rem;
                    color: var(--color-text-muted);
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px dashed var(--color-border);
                }
                .log-header span {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .log-details {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .log-metric {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .log-metric .label {
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                }
                .log-metric .value {
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .empty-logs {
                    text-align: center;
                    color: var(--color-text-muted);
                    font-style: italic;
                    padding: 20px;
                }
                .loading-state {
                    text-align: center;
                    padding: 20px;
                    color: var(--color-text-muted);
                }
                
                /* Edit Styles */
                .log-metric-group-right {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .log-actions {
                    display: flex;
                    gap: 4px;
                }
                .edit-icon-btn, .delete-icon-btn {
                    background: none;
                    border: none;
                    color: var(--color-text-muted);
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .edit-icon-btn:hover {
                    background: #f1f5f9;
                    color: var(--color-primary);
                }
                .delete-icon-btn:hover {
                    background: #fee2e2;
                    color: #ef4444;
                }

                .log-edit-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .edit-row {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .edit-row label {
                    font-size: 0.8rem;
                    color: var(--color-text-muted);
                }
                .edit-select, .edit-input {
                    padding: 6px;
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    font-size: 0.9rem;
                }
                .edit-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 4px;
                }
                .btn-save {
                    flex: 1;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 6px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                }
                .btn-cancel {
                    flex: 1;
                    background: white;
                    color: var(--color-text-muted);
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    padding: 6px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                }

                /* Split Confirmation Overlay */
                .split-confirm-overlay {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(255,255,255,0.95);
                    z-index: 20;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    border-radius: 12px; /* Match modal */
                    backdrop-filter: blur(2px);
                }
                .split-confirm-card {
                    background: white;
                    border: 1px solid var(--color-border);
                    box-shadow: var(--shadow-lg);
                    border-radius: 12px;
                    padding: 20px;
                    width: 100%;
                    max-width: 320px;
                    text-align: center;
                }
                .split-header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 12px;
                    color: #d97706;
                }
                .split-header h4 { margin: 0; font-size: 1.1rem; }
                .split-question { margin: 16px 0; font-weight: 500; }
                .split-target-select {
                    text-align: left;
                    margin-bottom: 20px;
                }
                .split-target-select label {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--color-text-muted);
                    margin-bottom: 4px;
                }
                .split-target-select select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                }
                .split-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .btn-confirm-split {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 10px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                }
                .btn-skip-split {
                    background: transparent;
                    color: var(--color-text-muted);
                    border: none;
                    padding: 8px;
                    font-size: 0.9rem;
                    cursor: pointer;
                    text-decoration: underline;
                }

                /* Small Slider Styles */
                .slider-container-small {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .edit-slider {
                    flex: 1;
                    accent-color: var(--color-primary);
                    cursor: pointer;
                }
                .slider-value {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--color-primary);
                    min-width: 60px;
                    text-align: right;
                }
            `}</style>
        </div>
    );
};

export default OrderDetailsModal;
