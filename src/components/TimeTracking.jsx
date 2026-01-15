import { useState, useEffect } from 'react';
import { Play, Pause, Square, Timer, Check, X, Plus } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import { useUsers } from '../context/UserContext';
import { getWorkLogs } from '../services/storage';
import './TimeTracking.css';

const TimeTracking = ({ onAddOrder }) => {
    const {
        orders,
        activeSession,
        checkActiveSession,
        startSession,
        stopSession
    } = useOrders();
    const { currentUser } = useUsers();
    console.log('TimeTracking currentUser:', currentUser);

    const [showSelection, setShowSelection] = useState(false);
    const [showStopModal, setShowStopModal] = useState(false);

    // Stop Modal State
    const [producedQty, setProducedQty] = useState('');
    const [markFinished, setMarkFinished] = useState(false);
    const [previousQty, setPreviousQty] = useState(0);

    // Initial check for active session when user changes
    useEffect(() => {
        if (currentUser) {
            checkActiveSession(currentUser.name);
        }
    }, [currentUser]);

    // Fetch previous work logs to calculate remaining quantity
    useEffect(() => {
        const fetchProgress = async () => {
            if (activeSession?.order_id) {
                const logs = await getWorkLogs(activeSession.order_id);
                // Sum all *finished* logs (where quantity_produced > 0)
                const total = logs.reduce((sum, log) => sum + (log.quantity_produced || 0), 0);
                setPreviousQty(total);
            } else {
                setPreviousQty(0);
            }
        };
        fetchProgress();
    }, [activeSession]);

    // Timer Logic
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        let interval;
        if (activeSession) {
            const startTime = new Date(activeSession.start_time).getTime();
            interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);

            // Initial set
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        } else {
            setElapsed(0);
        }
        return () => clearInterval(interval);
    }, [activeSession]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleStart = async (orderId) => {
        const success = await startSession(orderId, currentUser.name);
        if (success) {
            setShowSelection(false);
        }
    };

    const handleStop = async () => {
        await stopSession(producedQty, markFinished);
        setShowStopModal(false);
        setProducedQty('');
        setMarkFinished(false);
    };

    if (!currentUser) return null;

    return (
        <>
            {/* 1. Floating Button / Active Timer */}
            <div className="time-tracking-floater">
                {activeSession ? (
                    <div className="active-timer-card" onClick={() => setShowStopModal(true)}>
                        <div className="timer-info">
                            <span className="timer-label">In Bearbeitung:</span>
                            <span className="timer-order">{activeSession.orders?.order_id || 'Auftrag'}</span>
                            <span className="timer-clock">{formatTime(elapsed)}</span>
                        </div>
                        <button className="stop-btn-mini">
                            <Pause size={20} fill="currentColor" />
                        </button>
                    </div>
                ) : (
                    <button className="start-work-fab" onClick={() => setShowSelection(true)}>
                        <Timer size={24} />
                    </button>
                )}
            </div>

            {/* 2. Order Selection Modal */}
            {showSelection && (
                <div className="modal-overlay" onClick={() => setShowSelection(false)}>
                    <div className="modal-content selection-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-std">
                            <h3>Auftrag wählen</h3>
                            <button className="modal-close-std" onClick={() => setShowSelection(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="order-list-scroll">
                            {orders
                                .filter(o => o.status !== 'Beendet')
                                .map(order => (
                                    <div key={order.db_id} className="order-select-item" onClick={() => handleStart(order.db_id)}>
                                        <div className="order-main">
                                            <strong>{order.id}</strong>
                                            <span className="order-company">{order.company}</span>
                                        </div>
                                        <div className="order-meta">
                                            <span>{order.quantity} {order.quantity && 'Stk.'} </span>
                                            <span className={`status-badge status-${order.status?.toLowerCase().replace(' ', '-') || 'new'}`}>
                                                {order.status || 'Neu'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            }
                            {orders.filter(o => o.status !== 'Beendet').length === 0 && (
                                <div className="empty-state">
                                    <Square size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
                                    <p>Keine offenen Aufträge gefunden.</p>
                                    <span className="empty-hint">Möchtest du einen neuen Auftrag erfassen?</span>
                                    <button
                                        className="confirm-btn mt-4"
                                        onClick={() => {
                                            setShowSelection(false);
                                            onAddOrder?.();
                                        }}
                                    >
                                        <Plus size={18} />
                                        Neuen Auftrag anlegen
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Stop Session Modal */}
            {showStopModal && (
                <div className="modal-overlay" onClick={() => setShowStopModal(false)}>
                    <div className="modal-content stop-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-std">
                            <h3>Arbeit unterbrechen</h3>
                            <button className="modal-close-std" onClick={() => setShowStopModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="stop-modal-body">
                            <div className="time-summary">
                                <span className="label">Laufzeit</span>
                                <span className="value">{formatTime(elapsed)}</span>
                            </div>

                            <div className="input-group-lg">
                                <div className="qty-label-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <label>Produzierte Menge</label>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        Max: <strong>{Math.max(0, (parseInt(activeSession.orders?.quantity) || 0) - previousQty)}</strong>
                                    </span>
                                </div>
                                <div className="slider-container">
                                    <div className="slider-value-display">
                                        {producedQty || 0} <span className="unit">Stk.</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max={Math.max(0, (parseInt(activeSession.orders?.quantity) || 0) - previousQty)}
                                        step="1"
                                        value={producedQty || 0}
                                        onChange={(e) => {
                                            const qty = parseInt(e.target.value) || 0;
                                            setProducedQty(qty.toString());

                                            // Auto-finish logic: if we produce the remaining amount, we are done.
                                            const orderQty = parseInt(activeSession.orders?.quantity) || 0;
                                            const remaining = Math.max(0, orderQty - previousQty);

                                            if (orderQty > 0 && qty >= remaining) {
                                                setMarkFinished(true);
                                            }
                                        }}
                                        className="qty-slider"
                                    />
                                    <div className="slider-labels">
                                        <span>0</span>
                                        <span>{Math.max(0, (parseInt(activeSession.orders?.quantity) || 0) - previousQty)}</span>
                                    </div>
                                </div>
                            </div>

                            <label className={`status-card-checkbox ${markFinished ? 'checked' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={markFinished}
                                    onChange={(e) => setMarkFinished(e.target.checked)}
                                />
                                <div className="checkbox-content">
                                    <div className="checkbox-icon">
                                        {markFinished ? <Check size={20} /> : <Square size={20} />}
                                    </div>
                                    <div className="checkbox-text">
                                        <strong>Auftrag abschließen</strong>
                                        <span>Status wird auf "Beendet" gesetzt</span>
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div className="modal-footer">
                            <button className="cancel-btn-lg" onClick={() => setShowStopModal(false)}>Abbrechen</button>
                            <button className="confirm-btn-lg" onClick={handleStop}>
                                Speichern
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TimeTracking;
