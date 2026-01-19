import { useState, useEffect } from 'react';
import { X, Clock, Calendar, User, Trash2, Pencil, Check, ArrowRight, FileText, AlertTriangle, Image as ImageIcon, Package } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
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

    // --- New Processing Mask State ---
    const { currentUser, isAdmin } = useUsers();
    const { activeSession, startSession, stopSession, fetchOrders } = useOrders();
    const [view, setView] = useState('overview'); // 'overview' or 'process'
    const [processStep, setProcessStep] = useState(1);
    const [selectedTaskType, setSelectedTaskType] = useState(null);
    const [selectedMode, setSelectedMode] = useState('Zeitaufnahme');
    const [stopwatchStatus, setStopwatchStatus] = useState('idle'); // 'idle', 'running', 'paused'
    const [seconds, setSeconds] = useState(0);
    const [localQty, setLocalQty] = useState(0);

    const taskStyles = {
        'Büro': { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: '#3b82f6' },
        'Einrichtung': { color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: '#f59e0b' },
        'Fertigung': { color: '#047857', bg: '#f0fdf4', border: '#bbf7d0', icon: '#10b981' },
        'Lieferung': { color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', icon: '#8b5cf6' }
    };

    // Timer Effect
    useEffect(() => {
        let interval = null;
        if (stopwatchStatus === 'running') {
            interval = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [stopwatchStatus]);

    // Sync with global active session if it exists for this order
    useEffect(() => {
        if (activeSession && activeSession.order_id === order.db_id) {
            setView('process');
            setProcessStep(3);
            setSelectedTaskType(activeSession.task_type);
            setSelectedMode(activeSession.mode);
            setStopwatchStatus('running');

            // Calculate elapsed time
            const start = new Date(activeSession.start_time);
            const now = new Date();
            const elapsed = Math.floor((now - start) / 1000);
            setSeconds(elapsed);
        }
    }, [activeSession, order.db_id]);

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
            quantity_produced: log.quantity_produced || 0,
            duration_minutes: log.duration_minutes || 0
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

    const calculateDuration = (log) => {
        if (log.duration_minutes > 0) return `${log.duration_minutes}m`;
        if (!log.end_time) return 'Läuft...';
        const diff = new Date(log.end_time) - new Date(log.start_time);
        const minutes = Math.floor(diff / 60000);
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const totalProduced = logs.reduce((sum, log) => sum + (log.quantity_produced || 0), 0);
    const orderQty = parseInt(order.quantity) || 0;
    const progressPercent = orderQty > 0 ? Math.min(100, (totalProduced / orderQty) * 100) : 0;

    // --- Processing Handlers ---
    const handleStartProcess = () => {
        setView('process');
        setProcessStep(1);
    };

    const handleTaskSelect = (type) => {
        setSelectedTaskType(type);
        setProcessStep(2);
        // Reset quantity: only relevant for Fertigung
        if (type === 'Fertigung') {
            setLocalQty(0);
        } else {
            setLocalQty(1);
        }
    };

    const handleModeSelect = async (mode) => {
        setSelectedMode(mode);
        if (mode === 'Standard') {
            // Immediate Save flow for Standard
            // Note: In a real app, you might want a "Save" button here too, 
            // but the prompt says "schließt ihn sofort ab".
            handleFinishStandard(mode);
        } else {
            // Start Stopwatch
            setProcessStep(3);
        }
    };

    const handleStartStopwatch = async () => {
        console.log("Starting stopwatch with TaskType:", selectedTaskType);
        setStopwatchStatus('running');
        await startSession(order.db_id, currentUser.name, selectedTaskType, 'Zeitaufnahme');
    };

    const handlePauseStopwatch = () => {
        setStopwatchStatus('paused');
    };

    const handleResumeStopwatch = () => {
        setStopwatchStatus('running');
    };

    const handleFinishStandard = async () => {
        const timeKey = {
            'Büro': 'time_office',
            'Einrichtung': 'time_setup',
            'Fertigung': 'time_production',
            'Lieferung': 'time_delivery'
        }[selectedTaskType];

        const duration = article ? (article[timeKey] || 15) : 15;

        const payload = {
            order_id: order.db_id,
            user_name: currentUser.name,
            task_type: selectedTaskType,
            mode: 'Standard',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            quantity_produced: localQty,
            duration_minutes: duration
        };
        console.log("Creating Standard WorkLog payload:", payload);
        await createWorkLog(payload);

        // Feedback and Reset
        setView('overview');
        loadLogs();
        if (fetchOrders) fetchOrders();
    };

    const handleFinishStopwatch = async () => {
        // Validation for Fertigung
        if (selectedTaskType === 'Fertigung') {
            const totalRemaining = orderQty - totalProduced;
            if (localQty > totalRemaining) {
                alert(`Fehler: Die Menge (${localQty}) überschreitet die Restmenge (${totalRemaining})!`);
                return;
            }
        }

        const durationMinutes = Math.ceil(seconds / 60);

        // Final Completion Logic: 
        // 1. All mandatory task types (defined in article) must exist
        // 2. Fertigung quantity must reach target
        const requiredTasks = article?.work_steps || ['Büro', 'Einrichtung', 'Fertigung', 'Lieferung'];
        const taskTypes = new Set(logs.map(l => l.task_type));
        taskTypes.add(selectedTaskType);
        const allTasksDone = requiredTasks.every(t => taskTypes.has(t));
        const qtyMet = (totalProduced + (selectedTaskType === 'Fertigung' ? localQty : 0)) >= orderQty;

        const isCompleted = allTasksDone && qtyMet;

        await stopSession(localQty, isCompleted, durationMinutes);

        // Reset
        setView('overview');
        setStopwatchStatus('idle');
        setSeconds(0);
        loadLogs();
        if (fetchOrders) fetchOrders();
    };

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content details-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header-std">
                    <button
                        className="modal-back-btn"
                        onClick={() => view === 'process' ? setView('overview') : onClose()}
                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    >
                        {view === 'process' ? <ArrowRight style={{ transform: 'rotate(180deg)' }} size={20} /> : <X size={20} />}
                    </button>
                    <div className="header-title-centered" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h3>{view === 'process' ? 'Bearbeitungsmaske' : `Auftrag ${order.id}`}</h3>
                        <span className="company-subtitle">{order.company}</span>
                    </div>
                    <div style={{ width: 24 }}></div> {/* Spacer */}
                </div>

                <div className="details-body">
                    {view === 'process' ? (
                        <div className="processing-mask">
                            {processStep === 1 && (
                                <div className="step-content">
                                    <h4>1. Arbeitsgang wählen</h4>
                                    <div className="task-type-grid">
                                        {(article?.work_steps || ['Büro', 'Einrichtung', 'Fertigung', 'Lieferung']).map(type => {
                                            const style = taskStyles[type] || { color: '#475569', bg: '#f8fafc', border: '#e2e8f0', icon: '#64748b' };
                                            return (
                                                <button
                                                    key={type}
                                                    className={`task-type-btn ${selectedTaskType === type ? 'active' : ''}`}
                                                    onClick={() => handleTaskSelect(type)}
                                                    style={{
                                                        backgroundColor: style.bg,
                                                        borderColor: selectedTaskType === type ? style.icon : style.border,
                                                        color: style.color
                                                    }}
                                                >
                                                    <div style={{ color: style.icon }}>
                                                        {type === 'Büro' && <FileText size={32} />}
                                                        {type === 'Einrichtung' && <Clock size={32} />}
                                                        {type === 'Fertigung' && <Package size={32} />}
                                                        {type === 'Lieferung' && <ArrowRight size={32} />}
                                                    </div>
                                                    <span>{type}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {processStep === 2 && (
                                <div className="step-content">
                                    <h4>2. Modus wählen</h4>
                                    <div className="mode-selection-group">
                                        <button className="mode-option" onClick={() => handleModeSelect('Standard')}>
                                            <div className="mode-info">
                                                <strong>Standard</strong>
                                                <span>Nutzt Pauschalzeit aus Artikel</span>
                                            </div>
                                            <Check size={20} />
                                        </button>
                                        <button className="mode-option highlight" onClick={() => handleModeSelect('Zeitaufnahme')}>
                                            <div className="mode-info">
                                                <strong>Zeitaufnahme</strong>
                                                <span>Stoppuhr starten</span>
                                            </div>
                                            <Clock size={20} />
                                        </button>
                                    </div>
                                    <button className="back-step-btn" onClick={() => setProcessStep(1)}>Zurück</button>
                                </div>
                            )}

                            {processStep === 3 && (
                                <div className="step-content">
                                    <div className="stopwatch-display">
                                        <span className="timer-label">{selectedTaskType} - {selectedMode}</span>
                                        <div className="timer-value">{formatTime(seconds)}</div>

                                        <div className="timer-controls">
                                            {stopwatchStatus === 'idle' && (
                                                <button className="btn-timer start" onClick={handleStartStopwatch}>
                                                    Start
                                                </button>
                                            )}
                                            {stopwatchStatus === 'running' && (
                                                <button className="btn-timer pause" onClick={handlePauseStopwatch}>
                                                    Pause
                                                </button>
                                            )}
                                            {stopwatchStatus === 'paused' && (
                                                <button className="btn-timer start" onClick={handleResumeStopwatch}>
                                                    Weiter
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quantity Section */}
                                    <div className="processing-qty-section">
                                        <div className="qty-header">
                                            <label>Fertigungsmenge</label>
                                            <span className="remaining">Rest: {orderQty - totalProduced} Stk.</span>
                                        </div>

                                        <div className="qty-control">
                                            <input
                                                type="range"
                                                min="0"
                                                max={orderQty - totalProduced}
                                                value={localQty}
                                                onChange={(e) => setLocalQty(parseInt(e.target.value) || 0)}
                                                disabled={selectedTaskType !== 'Fertigung'}
                                            />
                                            <input
                                                type="number"
                                                value={localQty}
                                                onChange={(e) => setLocalQty(parseInt(e.target.value) || 0)}
                                                className="qty-input-manual"
                                                disabled={selectedTaskType !== 'Fertigung'}
                                            />
                                        </div>
                                    </div>

                                    <div className="process-footer">
                                        <button
                                            className="btn-finish-process"
                                            disabled={stopwatchStatus === 'idle'}
                                            onClick={handleFinishStopwatch}
                                        >
                                            Vorgang abschließen & Speichern
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Actions Header */}
                            <div className="view-actions-header" style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-start-work" onClick={handleStartProcess} style={{ flex: 1 }}>
                                    <Clock size={18} /> Arbeitsgang erfassen
                                </button>
                                {order.original_pdf && (
                                    <button
                                        className="btn-start-work"
                                        onClick={() => window.open(pb.files.getUrl({ id: order.db_id, collectionName: 'orders' }, order.original_pdf), '_blank')}
                                        style={{ flex: 1, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                                    >
                                        <FileText size={18} /> PDF Öffnen
                                    </button>
                                )}
                            </div>

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
                            {(order.article_id || order.original_pdf) && (
                                <div className="article-info-card">
                                    {order.article_id && <h4>Artikel: {order.article_id}</h4>}
                                    <div className="article-content-wrapper">
                                        {/* Existing Article Image Logic */}
                                        {article && getArticleFileUrl('image') && (
                                            <div
                                                className="article-preview-container"
                                                onClick={() => openFullScreen(getArticleFileUrl('image'))}
                                                style={{ marginBottom: '16px', cursor: 'pointer', textAlign: 'center' }}
                                            >
                                                <img
                                                    src={getArticleFileUrl('image')}
                                                    alt="Artikel Vorschau"
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '180px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #e2e8f0',
                                                        objectFit: 'contain'
                                                    }}
                                                />
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                                    <ImageIcon size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                    Tippen zum Vergrößern
                                                </div>
                                            </div>
                                        )}

                                        <div className="article-links-row">
                                            {article && getArticleFileUrl('drawing') && (
                                                <button className="article-link-btn" onClick={() => openFullScreen(getArticleFileUrl('drawing'))}>
                                                    <FileText size={16} /> Zeichnung öffnen
                                                </button>
                                            )}

                                            {!order.original_pdf && (!article || (!getArticleFileUrl('drawing') && !getArticleFileUrl('image'))) && (
                                                <span className="no-files-text">Keine Dateien hinterlegt</span>
                                            )}
                                        </div>
                                    </div>
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
                                                            <div className="edit-row">
                                                                <label>Dauer (Minuten):</label>
                                                                <input
                                                                    type="number"
                                                                    value={editData.duration_minutes}
                                                                    onChange={e => setEditData({ ...editData, duration_minutes: parseInt(e.target.value) || 0 })}
                                                                    className="edit-input"
                                                                />
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
                                                                {/* Task Badge */}
                                                                <span
                                                                    className="log-task-badge"
                                                                    style={{
                                                                        backgroundColor: (taskStyles[log.task_type] || taskStyles['Büro']).bg,
                                                                        color: (taskStyles[log.task_type] || taskStyles['Büro']).color,
                                                                        border: `1px solid ${(taskStyles[log.task_type] || taskStyles['Büro']).border}`,
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: '700',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        marginRight: '8px'
                                                                    }}
                                                                >
                                                                    {log.task_type || 'Allgemein'}
                                                                </span>

                                                                <span className="log-user">
                                                                    <User size={14} /> {log.user_name}
                                                                </span>
                                                                <span className="log-date" style={{ marginLeft: 'auto' }}>
                                                                    <Calendar size={14} /> {formatDate(log.start_time)}
                                                                </span>
                                                            </div>
                                                            <div className="log-details">
                                                                <div className="log-metric">
                                                                    <span className="label">Dauer</span>
                                                                    <span className="value">
                                                                        <Clock size={14} /> {calculateDuration(log)}
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
                        </>
                    )}
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
                    max-width: 393px;
                    width: 95%;
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
                /* New Processing Mask Styles */
                .processing-mask {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    padding: 10px 0;
                }
                .step-content h4 {
                    margin-bottom: 16px;
                    color: var(--color-text-main);
                    text-align: center;
                }
                .task-type-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .task-type-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 24px 16px;
                    background: white;
                    border: 2px solid var(--color-border);
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: var(--shadow-sm);
                }
                .task-type-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }
                .task-type-btn.active {
                    transform: scale(0.98);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
                }
                .task-type-btn span {
                    font-weight: 700;
                    font-size: 1rem;
                }

                .mode-selection-group {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .mode-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px;
                    background: white;
                    border: 2px solid var(--color-border);
                    border-radius: 16px;
                    cursor: pointer;
                    text-align: left;
                    color: var(--color-text-main); /* Override default button white text */
                }
                .mode-option.highlight {
                    border-color: #f59e0b;
                    background: #fffbeb;
                    color: #451a03; /* Dark brown for contrast on yellow */
                }
                .mode-option:hover {
                    background: #f8fafc;
                    border-color: var(--color-primary);
                }
                .mode-option.highlight:hover {
                    background: #fef3c7;
                    border-color: #d97706;
                }
                .mode-info {
                    display: flex;
                    flex-direction: column;
                }
                .mode-info strong { font-size: 1.1rem; }
                .mode-info span { font-size: 0.85rem; color: var(--color-text-muted); }

                .stopwatch-display {
                    background: #0f172a;
                    color: white;
                    padding: 30px 20px;
                    border-radius: 20px;
                    text-align: center;
                    margin-bottom: 24px;
                }
                .timer-label {
                    display: block;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #94a3b8;
                    margin-bottom: 8px;
                }
                .timer-value {
                    font-size: 3.5rem;
                    font-weight: 700;
                    font-family: monospace;
                    margin-bottom: 20px;
                }
                .timer-controls {
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                }
                .btn-timer {
                    padding: 12px 30px;
                    border-radius: 12px;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    font-size: 1rem;
                }
                .btn-timer.start { background: #10b981; color: white; }
                .btn-timer.pause { background: #f59e0b; color: white; }

                .processing-qty-section {
                    background: #f8fafc;
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid var(--color-border);
                    margin-bottom: 20px;
                }
                .qty-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }
                .qty-header .remaining { color: var(--color-primary); font-weight: 600; }
                .qty-control {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .qty-input-manual {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    font-size: 1.25rem;
                    font-weight: 700;
                    text-align: center;
                }

                .btn-finish-process {
                    width: 100%;
                    padding: 16px;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 1.1rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .btn-finish-process:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .view-actions-header {
                    margin-bottom: 20px;
                }
                .btn-start-work {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 14px;
                    background: #f0f7ff;
                    color: var(--color-primary);
                    border: 2px solid var(--color-primary);
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                }
                .back-step-btn {
                    width: 100%;
                    margin-top: 12px;
                    background: white;
                    border: 1px solid var(--color-border);
                    color: var(--color-text-muted);
                    padding: 12px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .back-step-btn:hover {
                    background: #f1f5f9;
                    color: var(--color-text-main);
                }

                /* Original Styles Preserved Below */
            `}</style>
        </div>
    );
};

export default OrderDetailsModal;
