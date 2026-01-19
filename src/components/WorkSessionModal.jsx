import React, { useState, useEffect } from 'react';
import { X, Play, Clock, Save, ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import { getAppSetting } from '../services/storage';
import { pb } from '../lib/pocketbase';

const WorkSessionModal = ({ order, onClose }) => {
    const { startSession, commitSessionToOrder } = useOrders();
    const [steps, setSteps] = useState([]);
    const [loading, setLoading] = useState(true);

    // Selection State
    const [selectedStep, setSelectedStep] = useState(null);
    const [mode, setMode] = useState('Stoppuhr'); // 'Stoppuhr' | 'Festwert'
    const [fixedTime, setFixedTime] = useState(0);
    const [quantity, setQuantity] = useState(0); // For Fixed Time + Manufacturing
    const [notes, setNotes] = useState('');
    const [saveMessage, setSaveMessage] = useState(''); // Feedback message

    useEffect(() => {
        loadSteps();
    }, []);

    const loadSteps = async () => {
        try {
            const records = await pb.collection('work_steps').getFullList({ sort: 'created' });
            if (records && records.length > 0) {
                // Convert flat list to tree
                const groups = records.filter(r => r.is_group && !r.parent_id);
                const tree = groups.map(g => ({
                    ...g,
                    type: 'group',
                    isOpen: true,
                    children: records.filter(r => r.parent_id === g.id && !r.is_group).map(c => ({
                        ...c,
                        type: 'step',
                        minutes: c.default_minutes || 0
                    }))
                }));
                const topLevelSteps = records.filter(r => !r.is_group && !r.parent_id).map(s => ({
                    ...s, type: 'step', minutes: s.default_minutes || 0
                }));

                setSteps([...tree, ...topLevelSteps]);
                setLoading(false);
                return;
            }
        } catch (e) {
            console.log("Using default steps (DB fetch failed or empty)", e);
        }

        // Fallback defaults if not in DB
        const DEFAULT_STEPS = [
            {
                id: 'admin', name: 'Administration', type: 'group', isOpen: true, children: [
                    { id: 'offer', name: 'Angebot', type: 'step', minutes: 0, category: 'Administration' },
                    { id: 'order', name: 'Auftrag', type: 'step', minutes: 0, category: 'Administration' },
                    { id: 'delivery_note', name: 'Lieferschein', type: 'step', minutes: 0, category: 'Administration' },
                ]
            },
            { id: 'prep', name: 'Vorbereitung', type: 'step', minutes: 15, category: 'Vorbereitung' },
            { id: 'prod', name: 'Fertigung', type: 'step', minutes: 0, category: 'Fertigung' },
            { id: 'delivery', name: 'Lieferung', type: 'step', minutes: 0, category: 'Lieferung' },
        ];

        const data = await getAppSetting('work_steps_config', DEFAULT_STEPS);
        // Ensure structure is clean
        setSteps(data || DEFAULT_STEPS);
        setLoading(false);
    };

    const handleStepSelect = (step) => {
        setSelectedStep(step);
        // If fixed time is preferred by default for this step (e.g. > 0), auto separate logic could go here
        // For now, default to stopwatch unless user switches
        if (step.minutes > 0) {
            setFixedTime(step.minutes);
            // Optional: Auto-switch to fixed mode could be annoying, so we just pre-fill value
        } else {
            setFixedTime(0);
        }
    };

    const toggleGroup = (id) => {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, isOpen: !s.isOpen } : s));
    };

    const handleSubmit = async () => {
        if (!selectedStep) return;

        if (mode === 'Stoppuhr') {
            const success = await startSession(
                order.id,
                selectedStep.id,
                selectedStep.name,
                selectedStep.category || 'Vorbereitung',
                'Stoppuhr'
            );
            if (success) onClose();
        } else {
            // Fixed Time Immediate Commit
            const logEntry = {
                // id: crypto.randomUUID(), // Let DB handle ID or Context create it
                stepId: selectedStep.id,
                stepName: selectedStep.name,
                category: selectedStep.category || 'Vorbereitung',
                type: 'Festwert',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                durationMinutes: parseInt(fixedTime) || 0,
                quantity: ((selectedStep.category === 'manufacturing' || selectedStep.category === 'Fertigung') && quantity > 0) ? parseInt(quantity) : null,
                notes: notes
            };

            const success = await commitSessionToOrder(order.id, logEntry);
            if (success) {
                setSaveMessage('Erfolgreich gespeichert!');
                setTimeout(() => onClose(), 1500);
            } else {
                setSaveMessage('Fehler beim Speichern.');
            }
        }
    };

    const renderStepList = (items) => {
        return items.map(item => {
            if (item.type === 'group') {
                return (
                    <div key={item.id} className="step-group">
                        <div className="group-header" onClick={() => toggleGroup(item.id)}>
                            {item.isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            <Folder size={18} className="icon-group" />
                            <span>{item.name}</span>
                        </div>
                        {item.isOpen && item.children && (
                            <div className="group-children">
                                {renderStepList(item.children)}
                            </div>
                        )}
                    </div>
                );
            }
            // Leaf Item
            const isSelected = selectedStep?.id === item.id;
            return (
                <div
                    key={item.id}
                    className={`step-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleStepSelect(item)}
                >
                    <FileText size={18} />
                    <span>{item.name}</span>
                    {item.minutes > 0 && <span className="default-badge">{item.minutes}m</span>}
                </div>
            );
        });
    };

    const isManufacturing = selectedStep?.category === 'manufacturing';

    return (
        <div className="modal-overlay">
            <div className="work-session-modal">
                <div className="modal-header">
                    <h3>Arbeit starten: {order.id}</h3>
                    <button className="close-btn" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="modal-body">
                    <div className="steps-column">
                        <h4>Arbeitsgang wählen</h4>
                        <div className="steps-list-container">
                            {loading ? <div className="loading">Lade...</div> : renderStepList(steps)}
                        </div>
                    </div>

                    <div className="config-column">
                        {selectedStep ? (
                            <>
                                <div className="selected-summary">
                                    <span className="step-label">Gewählt:</span>
                                    <span className="step-value">{selectedStep.name}</span>
                                </div>

                                <div className="mode-selection">
                                    <label className={`mode-option ${mode === 'Stoppuhr' ? 'active' : ''}`}>
                                        <input
                                            type="radio"
                                            name="mode"
                                            value="Stoppuhr"
                                            checked={mode === 'Stoppuhr'}
                                            onChange={() => setMode('Stoppuhr')}
                                        />
                                        <div className="mode-content">
                                            <Play size={24} />
                                            <span>Zeit starten</span>
                                        </div>
                                    </label>

                                    <label className={`mode-option ${mode === 'Festwert' ? 'active' : ''}`}>
                                        <input
                                            type="radio"
                                            name="mode"
                                            value="Festwert"
                                            checked={mode === 'Festwert'}
                                            onChange={() => setMode('Festwert')}
                                        />
                                        <div className="mode-content">
                                            <Clock size={24} />
                                            <span>Zeit buchen</span>
                                        </div>
                                    </label>
                                </div>

                                {mode === 'Festwert' && (
                                    <div className="fixed-inputs">
                                        <div className="input-field">
                                            <label>Zeit (Minuten)</label>
                                            <input
                                                type="number"
                                                value={fixedTime}
                                                onChange={e => setFixedTime(e.target.value)}
                                                min="0"
                                            />
                                        </div>
                                        {isManufacturing && (
                                            <div className="input-field">
                                                <label>Gefertigte Menge</label>
                                                <input
                                                    type="number"
                                                    value={quantity}
                                                    onChange={e => setQuantity(e.target.value)}
                                                    min="0"
                                                />
                                            </div>
                                        )}
                                        <div className="input-field">
                                            <label>Notiz (optional)</label>
                                            <input
                                                type="text"
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                                placeholder="Bemerkung..."
                                            />
                                        </div>
                                    </div>
                                )}

                                <button className="start-btn" onClick={handleSubmit}>
                                    {mode === 'Stoppuhr' ? (
                                        <> <Play size={20} fill="currentColor" /> Zeit starten </>
                                    ) : (
                                        <> <Save size={20} /> Speichern </>
                                    )}
                                </button>

                                {saveMessage && (
                                    <div className={`save-feedback ${saveMessage.includes('Fehler') ? 'error' : 'success'}`}>
                                        {saveMessage}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="placeholder-msg">
                                Bitte wähle links einen Arbeitsgang aus.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
                    display: flex; align-items: center; justify-content: center; z-index: 1000;
                }
                .work-session-modal {
                    background: white; width: calc(100vw - 32px); max-width: 360px; max-height: 85vh;
                    border-radius: 12px; display: flex; flex-direction: column;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    overflow: hidden;
                    margin: 16px;
                }
                .modal-header {
                    padding: 16px 24px; border-bottom: 1px solid #e2e8f0;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .modal-header h3 { margin: 0; font-size: 1.25rem; }
                .close-btn { background: none; border: none; cursor: pointer; color: #64748b; }
                
                .modal-body {
                    flex: 1; display: flex; flex-direction: column; overflow: hidden;
                }
                .steps-column {
                    border-bottom: 1px solid #e2e8f0;
                    display: flex; flex-direction: column; background: #f8fafc;
                    max-height: 300px; /* 50% more height */
                }
                .steps-column h4 { padding: 16px; margin: 0; color: #64748b; font-size: 0.9rem; text-transform: uppercase; }
                
                .steps-list-container {
                    flex: 1; overflow-y: auto; padding: 0 16px 16px 16px;
                }
                
                .step-group { margin-bottom: 4px; }
                .group-header {
                    display: flex; align-items: center; gap: 8px; padding: 8px;
                    cursor: pointer; font-weight: 600; color: #334155;
                    border-radius: 6px;
                }
                .group-header:hover { background: #e2e8f0; }
                .group-children { margin-left: 12px; border-left: 2px solid #cbd5e1; padding-left: 8px; margin-top: 4px; }
                
                .step-item {
                    display: flex; align-items: center; gap: 10px; padding: 10px;
                    cursor: pointer; color: #475569; border-radius: 6px;
                    margin-bottom: 2px; transition: all 0.2s;
                }
                .step-item:hover { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .step-item.selected {
                    background: white; color: var(--color-primary);
                    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.15);
                    border: 1px solid var(--color-primary);
                }
                .default-badge {
                    margin-left: auto; font-size: 0.75rem; background: #e2e8f0; 
                    padding: 2px 6px; border-radius: 10px; color: #64748b;
                }

                .config-column {
                    flex: 1; padding: 24px; display: flex; flex-direction: column; overflow-y: auto;
                }
                .placeholder-msg {
                    color: #94a3b8; text-align: center; margin-top: 100px;
                }
                
                .selected-summary {
                    margin-bottom: 24px; background: #f1f5f9; padding: 12px; border-radius: 8px;
                    display: flex; gap: 8px; align-items: center;
                }
                .step-label { color: #64748b; font-size: 0.9rem; }
                .step-value { font-weight: 600; font-size: 1.1rem; color: #0f172a; }

                .mode-selection {
                    display: flex; gap: 16px; margin-bottom: 24px;
                }
                .mode-option {
                    flex: 1; cursor: pointer; position: relative;
                }
                .mode-option input { opacity: 0; position: absolute; }
                .mode-content {
                    border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px;
                    display: flex; flex-direction: column; align-items: center; gap: 12px;
                    color: #64748b;
                    transition: all 0.2s;
                }
                .mode-option.active .mode-content {
                    border-color: var(--color-primary); background: #eff6ff; color: var(--color-primary);
                }
                
                .fixed-inputs { margin-bottom: 24px; animation: fadeIn 0.3s ease; }
                .input-field { margin-bottom: 16px; }
                .input-field label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 0.9rem; }
                .input-field input { 
                    width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px;
                    font-size: 1rem;
                }

                .start-btn {
                    margin-top: auto; width: 100%; padding: 14px;
                    background: var(--color-primary); color: white; border: none; border-radius: 8px;
                    font-size: 1.1rem; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                }
                .start-btn:hover { background: #2563eb; }

                .save-feedback {
                    margin-top: 12px;
                    padding: 10px;
                    border-radius: 8px;
                    text-align: center;
                    font-weight: 600;
                    animation: fadeIn 0.3s ease;
                }
                .save-feedback.success { background: #d1fae5; color: #059669; }
                .save-feedback.error { background: #fee2e2; color: #dc2626; }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default WorkSessionModal;
