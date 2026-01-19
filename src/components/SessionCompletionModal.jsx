import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

const SessionCompletionModal = ({ session, onConfirm, onCancel }) => {
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');

    // Check if we need quantity input
    const isManufacturing = session.category === 'manufacturing';

    const handleSubmit = () => {
        onConfirm({
            quantity: quantity ? parseInt(quantity) : null,
            notes
        });
    };

    return (
        <div className="modal-overlay">
            <div className="completion-modal">
                <div className="modal-header">
                    <h3>Arbeit beenden</h3>
                    <button className="close-btn" onClick={onCancel}><X size={24} /></button>
                </div>

                <div className="modal-body">
                    <p className="summary-text">
                        Du beendest den Arbeitsschritt <strong>{session.stepName}</strong> für Auftrag <strong>{session.orderId}</strong>.
                    </p>

                    {isManufacturing && (
                        <div className="input-field">
                            <label>Gefertigte Menge (Stück)</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                placeholder="0"
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="input-field">
                        <label>Notiz (optional)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Bemerkung..."
                            rows={3}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onCancel}>Abbrechen</button>
                    <button className="confirm-btn" onClick={handleSubmit}>
                        <Save size={18} /> Speichern & Beenden
                    </button>
                </div>
            </div>

            <style>{`
                .completion-modal {
                    background: white; width: 500px; max-width: 90vw;
                    border-radius: 12px; display: flex; flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    animation: zoomIn 0.2s ease-out;
                }
                .modal-header {
                    padding: 16px 24px; border-bottom: 1px solid #e2e8f0;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .modal-header h3 { margin: 0; font-size: 1.25rem; color: #1e293b; }
                
                .modal-body { padding: 24px; }
                .summary-text { margin-bottom: 24px; color: #475569; font-size: 1rem; line-height: 1.5; }
                .summary-text strong { color: #0f172a; }

                .input-field { margin-bottom: 16px; }
                .input-field label { display: block; margin-bottom: 8px; font-weight: 600; color: #475569; }
                .input-field input, .input-field textarea {
                    width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px;
                    font-size: 1rem; font-family: inherit;
                }
                .input-field input:focus, .input-field textarea:focus {
                    outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .modal-footer {
                    padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0;
                    border-radius: 0 0 12px 12px;
                    display: flex; justify-content: flex-end; gap: 12px;
                }
                .cancel-btn {
                    padding: 10px 16px; border: 1px solid #cbd5e1; background: white;
                    border-radius: 8px; font-weight: 600; color: #64748b; cursor: pointer;
                }
                .confirm-btn {
                    padding: 10px 20px; background: var(--color-primary); color: white;
                    border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; gap: 8px;
                }
                .confirm-btn:hover { background: #2563eb; }

                @keyframes zoomIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default SessionCompletionModal;
