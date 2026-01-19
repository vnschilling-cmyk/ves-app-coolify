import React, { useState, useEffect, useRef } from 'react';
import { Square, Play, Pause, ArrowLeft, ImageIcon } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import SessionCompletionModal from './SessionCompletionModal';
import { pb } from '../lib/pocketbase';
import { getArticles } from '../services/storage';

const ActiveSessionPage = ({ onBack }) => {
    const { activeSession, stopSession, orders } = useOrders();
    const [elapsed, setElapsed] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [pausedTime, setPausedTime] = useState(0); // Total paused duration
    const [showStopModal, setShowStopModal] = useState(false);
    const [articles, setArticles] = useState([]);
    const pauseStartRef = useRef(null);

    // Load articles for image lookup
    useEffect(() => {
        const loadArticles = async () => {
            const allArticles = await getArticles();
            setArticles(allArticles);
        };
        loadArticles();
    }, []);

    // Find the order to get article details
    const order = orders.find(o => o.id === activeSession?.orderId || o.order_id === activeSession?.orderId);

    useEffect(() => {
        if (!activeSession) return;
        if (isPaused) return; // Don't update while paused

        const interval = setInterval(() => {
            const start = new Date(activeSession.startTime).getTime();
            const now = new Date().getTime();
            // Subtract total paused time from elapsed
            setElapsed(Math.floor((now - start - pausedTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSession, isPaused, pausedTime]);

    if (!activeSession) return null;

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handlePauseToggle = () => {
        if (isPaused) {
            // Resuming - add paused duration
            const pauseDuration = Date.now() - pauseStartRef.current;
            setPausedTime(prev => prev + pauseDuration);
            pauseStartRef.current = null;
        } else {
            // Pausing - record start time
            pauseStartRef.current = Date.now();
        }
        setIsPaused(!isPaused);
    };

    const handleStopClick = () => {
        // If paused, calculate final paused time
        if (isPaused && pauseStartRef.current) {
            const pauseDuration = Date.now() - pauseStartRef.current;
            setPausedTime(prev => prev + pauseDuration);
        }
        setShowStopModal(true);
    };

    const handleConfirmStop = async (data) => {
        const durationMinutes = Math.ceil(elapsed / 60);
        await stopSession({ ...data, durationMinutes });
        setShowStopModal(false);
        if (onBack) onBack();
    };

    // Get article image URL - same logic as OrderList
    const getImageUrl = () => {
        if (order?.expand?.article_id?.image) {
            return pb.files.getUrl(order.expand.article_id, order.expand.article_id.image);
        }
        if (order?.article_id && articles.length > 0) {
            const art = articles.find(a => a.article_id === order.article_id);
            if (art && art.image) {
                return pb.files.getUrl(art, art.image);
            }
        }
        return null;
    };

    const articleImage = getImageUrl();

    // Get article description (not customer name)
    const getArticleDescription = () => {
        // First try expanded article name
        if (order?.expand?.article_id?.name) return order.expand.article_id.name;
        // Then try lookup by article_id
        if (order?.article_id && articles.length > 0) {
            const art = articles.find(a => a.article_id === order.article_id);
            if (art?.name) return art.name;
        }
        // Fallback to order description if available
        if (order?.description) return order.description;
        return 'Artikel';
    };

    return (
        <>
            <div className="session-page">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={18} />
                    <span>Zurück</span>
                </button>

                <div className="session-content">
                    {/* Article Preview - Larger */}
                    <div className="article-preview">
                        {articleImage ? (
                            <img src={articleImage} alt="Artikelvorschau" />
                        ) : (
                            <div className="no-image">
                                <ImageIcon size={48} strokeWidth={1} />
                            </div>
                        )}
                    </div>

                    {/* Article Info */}
                    <div className="article-info">
                        <div className="article-number">{activeSession.orderId}</div>
                        <div className="article-name">{getArticleDescription()}</div>
                        <div className="work-step-badge">
                            {activeSession.stepName}
                        </div>
                    </div>

                    {/* Timer Display */}
                    <div className="timer-container">
                        <div className={`timer-circle ${isPaused ? 'paused' : ''}`}>
                            <div className="timer-value">{formatTime(elapsed)}</div>
                            <div className="timer-label">
                                {isPaused ? 'PAUSIERT' : 'LAUFEND'}
                            </div>
                        </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="control-buttons">
                        <button
                            className={`pause-btn ${isPaused ? 'is-paused' : ''}`}
                            onClick={handlePauseToggle}
                        >
                            {isPaused ? (
                                <>
                                    <Play size={22} fill="currentColor" />
                                    <span>Fortsetzen</span>
                                </>
                            ) : (
                                <>
                                    <Pause size={22} />
                                    <span>Pause</span>
                                </>
                            )}
                        </button>

                        <button className="stop-session-btn" onClick={handleStopClick}>
                            <Square size={20} fill="currentColor" />
                            <span>Stopp</span>
                        </button>
                    </div>
                </div>
            </div>

            {showStopModal && (
                <SessionCompletionModal
                    session={activeSession}
                    onConfirm={handleConfirmStop}
                    onCancel={() => setShowStopModal(false)}
                />
            )}

            <style>{`
                .session-page {
                    height: 100vh;
                    max-height: 100vh;
                    overflow: hidden;
                    background: #ffffff;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .back-btn {
                    background: white;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                    padding: 8px 14px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    width: fit-content;
                    transition: all 0.2s;
                    flex-shrink: 0;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .back-btn:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }

                .session-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 28px;
                    padding: 0;
                    min-height: 0;
                }

                .article-preview {
                    width: 307px;
                    height: 307px;
                    background: transparent;
                    border-radius: 0;
                    overflow: visible;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .article-preview img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .no-image {
                    color: #cbd5e1;
                }

                .article-info {
                    text-align: center;
                    flex-shrink: 0;
                }
                .article-number {
                    font-size: 1.5rem;
                    font-weight: 700;
                    font-family: 'Inter', monospace;
                    color: #1e293b;
                    letter-spacing: 0.5px;
                }
                .article-name {
                    font-size: 0.9rem;
                    color: #64748b;
                    margin-top: 4px;
                    max-width: 300px;
                    line-height: 1.3;
                }
                .work-step-badge {
                    display: inline-block;
                    margin-top: 8px;
                    padding: 5px 14px;
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    border-radius: 20px;
                    color: white;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .timer-container {
                    flex-shrink: 0;
                }
                .timer-circle {
                    width: 160px;
                    height: 160px;
                    border-radius: 50%;
                    background: white;
                    border: 4px solid #22c55e;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 30px rgba(34, 197, 94, 0.25);
                    transition: all 0.3s ease;
                }
                .timer-circle.paused {
                    border-color: #f59e0b;
                    box-shadow: 0 8px 30px rgba(245, 158, 11, 0.25);
                }
                .timer-value {
                    font-size: 1.9rem;
                    font-weight: 700;
                    font-family: 'Inter', monospace;
                    color: #1e293b;
                    letter-spacing: 2px;
                }
                .timer-label {
                    font-size: 0.7rem;
                    color: #22c55e;
                    margin-top: 4px;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    font-weight: 600;
                }
                .timer-circle.paused .timer-label {
                    color: #f59e0b;
                }

                .control-buttons {
                    display: flex;
                    gap: 12px;
                    flex-shrink: 0;
                }

                .pause-btn {
                    background: white;
                    border: 2px solid #f59e0b;
                    color: #f59e0b;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .pause-btn:hover {
                    background: #fef3c7;
                }
                .pause-btn.is-paused {
                    background: #22c55e;
                    border-color: #22c55e;
                    color: white;
                }
                .pause-btn.is-paused:hover {
                    background: #16a34a;
                }

                .stop-session-btn {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    border: none;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
                    transition: all 0.2s;
                }
                .stop-session-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
                }
            `}</style>
        </>
    );
};

export default ActiveSessionPage;
