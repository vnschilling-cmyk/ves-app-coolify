import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Bestätigen', cancelText = 'Abbrechen', isDestructive = false }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title-row">
                        {isDestructive && <AlertTriangle size={24} color="#ef4444" />}
                        <h3>{title}</h3>
                    </div>
                    <button className="btn-close" onClick={onCancel}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    <p>{message}</p>
                </div>

                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onCancel}>{cancelText}</button>
                    <button className={`btn-confirm ${isDestructive ? 'destructive' : ''}`} onClick={onConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>

            <style>{`
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5); z-index: 2000;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px; backdrop-filter: blur(5px);
                }
                .modal-content {
                    background: white; width: 100%; max-width: 400px;
                    border-radius: 16px; display: flex; flex-direction: column;
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
                    overflow: hidden;
                    animation: modal-pop 0.2s ease-out;
                }
                @keyframes modal-pop {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .modal-header {
                    padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
                    display: flex; justify-content: space-between; align-items: center;
                    background: #f8fafc;
                }
                .modal-title-row { display: flex; align-items: center; gap: 10px; }
                .modal-title-row h3 { margin: 0; color: #1e293b; font-size: 1.1rem; font-weight: 600; }
                
                .btn-close { background: none; border: none; cursor: pointer; color: #64748b; padding: 4px; display: flex; }
                .btn-close:hover { color: #1e293b; }
                
                .modal-body { padding: 24px 20px; color: #334155; font-size: 1rem; line-height: 1.5; }
                
                .modal-footer {
                    padding: 16px 20px;
                    display: flex; gap: 12px;
                    justify-content: flex-end;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                }
                
                .btn-cancel {
                    padding: 10px 16px; border-radius: 8px; font-weight: 500;
                    background: white; border: 1px solid #cbd5e1; color: #475569;
                    cursor: pointer; transition: all 0.2s;
                }
                .btn-cancel:hover { background: #f1f5f9; }
                
                .btn-confirm {
                    padding: 10px 16px; border-radius: 8px; font-weight: 600;
                    background: #3b82f6; border: none; color: white;
                    cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
                }
                .btn-confirm:hover { background: #2563eb; }
                
                .btn-confirm.destructive { background: #ef4444; }
                .btn-confirm.destructive:hover { background: #dc2626; }
            `}</style>
        </div>
    );
};

export default ConfirmationModal;
