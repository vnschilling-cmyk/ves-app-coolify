import React, { useState, useEffect } from 'react';
import { Square, Timer } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import SessionCompletionModal from './SessionCompletionModal';

const GlobalTimer = () => {
    const { activeSession, stopSession } = useOrders();
    const [elapsed, setElapsed] = useState(0);
    const [showStopModal, setShowStopModal] = useState(false);

    useEffect(() => {
        if (!activeSession) {
            setElapsed(0);
            return;
        }

        const interval = setInterval(() => {
            const start = new Date(activeSession.startTime).getTime();
            const now = new Date().getTime();
            setElapsed(Math.floor((now - start) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSession]);

    if (!activeSession) return null;

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleStopClick = () => {
        setShowStopModal(true);
    };

    const handleConfirmStop = async (data) => {
        // Calculate minutes based on actual elapsed if not provided
        const durationMinutes = Math.ceil(elapsed / 60);
        await stopSession({ ...data, durationMinutes });
        setShowStopModal(false);
    };

    return (
        <>
            <div className="global-timer-floater">
                <div className="timer-info">
                    <div className="timer-label">Aktiver Auftrag</div>
                    <div className="timer-order">{activeSession.orderId}</div>
                    <div className="timer-step">{activeSession.stepName}</div>
                </div>

                <div className="timer-display">
                    <Timer size={16} />
                    <span>{formatTime(elapsed)}</span>
                </div>

                <button className="stop-btn" onClick={handleStopClick}>
                    <Square size={16} fill="currentColor" />
                    <span>Stopp</span>
                </button>
            </div>

            {showStopModal && (
                <SessionCompletionModal
                    session={activeSession}
                    onConfirm={handleConfirmStop}
                    onCancel={() => setShowStopModal(false)}
                />
            )}

            <style>{`
                .global-timer-floater {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    background: #1e293b;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
                    z-index: 9999;
                    animation: slideUp 0.3s ease-out;
                    border: 1px solid rgba(255,255,255,0.1);
                    pointer-events: auto;
                }

                .timer-info {
                    display: flex; flex-direction: column;
                }
                .timer-label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
                .timer-order { font-weight: 700; font-family: monospace; font-size: 1rem; }
                .timer-step { font-size: 0.85rem; color: #cbd5e1; }

                .timer-display {
                    background: rgba(0,0,0,0.3);
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-family: monospace;
                    font-size: 1.25rem;
                    font-weight: 600;
                    display: flex; align-items: center; gap: 8px;
                    color: #4ade80;
                }

                .stop-btn {
                    background: #ef4444; border: none; color: white;
                    padding: 8px 16px; border-radius: 6px; font-weight: 600;
                    cursor: pointer; display: flex; align-items: center; gap: 8px;
                    transition: all 0.2s;
                }
                .stop-btn:hover { background: #dc2626; transform: translateY(-1px); }

                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                /* Responsive: Position above navigation bar on mobile */
                @media (max-width: 768px) {
                    .global-timer-floater {
                        bottom: 80px;
                        left: 16px;
                        right: 16px;
                        padding: 10px 16px;
                        gap: 12px;
                        border-radius: 10px;
                    }
                    
                    .timer-info {
                        flex: 1;
                        min-width: 0;
                    }
                    
                    .timer-order {
                        font-size: 0.9rem;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    
                    .timer-step {
                        font-size: 0.75rem;
                    }
                    
                    .timer-display {
                        padding: 4px 8px;
                        font-size: 1rem;
                    }
                    
                    .stop-btn {
                        padding: 6px 12px;
                        font-size: 0.85rem;
                    }
                    
                    .stop-btn span {
                        display: none;
                    }
                }
            `}</style>
        </>
    );
};

export default GlobalTimer;
