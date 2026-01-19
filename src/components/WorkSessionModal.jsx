import React, { useState, useEffect } from 'react';
import { X, Play, Clock, Save, ChevronRight, ChevronDown, Folder, FileText, FileSpreadsheet, ClipboardCheck, Settings2, Factory, Package, Wrench, FileCheck } from 'lucide-react';
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

    // Icon Mapping Logic (Shared with WorkStepsManagement)
    const STEP_ICONS = {
        'FileSpreadsheet': FileSpreadsheet,
        'ClipboardCheck': ClipboardCheck,
        'Settings2': Settings2,
        'Factory': Factory,
        'Package': Package,
        'FileText': FileText,
        'Wrench': Wrench,
        'FileCheck': FileCheck,
    };



    const getIconComponent = (iconName) => {
        const Icon = STEP_ICONS[iconName] || Wrench;
        return Icon;
    };

    const getStepColor = (step) => {
        return step?.color || 'var(--color-primary)';
    };

    const assignIconToStep = (step) => {
        // ID-based mapping
        const ID_MAP = {
            'offer': 'FileSpreadsheet',
            'confirmation': 'FileCheck',
            'order': 'ClipboardCheck',
            'delivery_note': 'FileText',
            'prep': 'Settings2',
            'prod': 'Factory',
            'delivery': 'Package'
        };

        if (step.icon && step.icon !== 'Wrench') return step.icon;
        if (ID_MAP[step.id]) return ID_MAP[step.id];

        // Name-based fallback
        if (step.name === 'Auftragsbestätigung') return 'FileCheck';
        if (step.name === 'Angebot') return 'FileSpreadsheet';
        if (step.name === 'Auftrag') return 'ClipboardCheck';
        if (step.name === 'Lieferschein') return 'FileText';
        if (step.name === 'Vorbereitung') return 'Settings2';
        if (step.name === 'Fertigung') return 'Factory';
        if (step.name === 'Lieferung') return 'Package';

        return 'Wrench';
    };

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
                        minutes: c.default_minutes || 0,
                        icon: assignIconToStep(c)
                    }))
                }));
                const topLevelSteps = records.filter(r => !r.is_group && !r.parent_id).map(s => ({
                    ...s, type: 'step', minutes: s.default_minutes || 0,
                    icon: assignIconToStep(s)
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
                    { id: 'confirmation', name: 'Bestätigung', type: 'step', minutes: 0, category: 'Administration' }
                ]
            },
            { id: 'prep', name: 'Vorbereitung', type: 'step', minutes: 15, category: 'Vorbereitung' },
            { id: 'prod', name: 'Fertigung', type: 'step', minutes: 0, category: 'Fertigung' },
            { id: 'delivery', name: 'Lieferung', type: 'step', minutes: 0, category: 'Lieferung' },
        ];

        const data = await getAppSetting('work_steps_config', DEFAULT_STEPS);

        // Enrich with icons
        const enriched = (data || DEFAULT_STEPS).map(step => {
            if (step.type === 'group') {
                return {
                    ...step,
                    children: step.children?.map(child => ({
                        ...child,
                        icon: assignIconToStep(child)
                    }))
                };
            }
            return { ...step, icon: assignIconToStep(step) };
        });

        setSteps(enriched);
        setLoading(false);
    };

    const handleStepSelect = (step) => {
        setSelectedStep(step);
        if (step.minutes > 0) {
            setFixedTime(step.minutes);
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
            const logEntry = {
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
            const isSelected = selectedStep?.id === item.id;
            const StepIcon = getIconComponent(item.icon);
            const iconColor = getStepColor(item);

            return (
                <div
                    key={item.id}
                    className={`step-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleStepSelect(item)}
                >
                    <StepIcon size={20} color={iconColor} />
                    <span className="step-name" style={{ color: iconColor, fontWeight: 600 }}>{item.name}</span>
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
                    {!selectedStep ? (
                        <div className="view-selection">
                            <div className="view-header">
                                <h4>Arbeitsgang wählen</h4>
                            </div>
                            <div className="steps-list-container">
                                {loading ? <div className="loading">Lade...</div> : renderStepList(steps)}
                            </div>
                        </div>
                    ) : (
                        <div className="view-config">
                            <div className="selected-header">
                                <button className="back-link" onClick={() => setSelectedStep(null)}>
                                    <ChevronRight size={20} className="rotate-180" style={{ transform: 'rotate(180deg)' }} />
                                    <span>Zurück</span>
                                </button>
                                <div className="current-step">
                                    {(() => {
                                        const Icon = getIconComponent(selectedStep.icon);
                                        const iconColor = getStepColor(selectedStep);
                                        return <Icon size={24} color={iconColor} />;
                                    })()}
                                    <span style={{ color: iconColor, fontWeight: 600 }}>{selectedStep.name}</span>
                                </div>
                            </div>

                            <div className="mode-selection">
                                <label className={`mode-option ${mode === 'Festwert' ? 'active' : ''}`}>
                                    <input type="radio" name="mode" value="Festwert" checked={mode === 'Festwert'} onChange={() => setMode('Festwert')} />
                                    <div className="mode-content mode-clock">
                                        <Clock size={32} strokeWidth={1.5} />
                                    </div>
                                </label>

                                <label className={`mode-option ${mode === 'Stoppuhr' ? 'active' : ''}`}>
                                    <input type="radio" name="mode" value="Stoppuhr" checked={mode === 'Stoppuhr'} onChange={() => setMode('Stoppuhr')} />
                                    <div className="mode-content mode-play">
                                        <Play size={32} strokeWidth={1.5} />
                                    </div>
                                </label>
                            </div>

                            <div className="config-form">
                                {mode === 'Festwert' && (
                                    <div className="fixed-inputs">
                                        <div className="input-group">
                                            <label>Zeit (Minuten)</label>
                                            <input type="number" value={fixedTime} onChange={e => setFixedTime(e.target.value)} min="0" placeholder="0" autoFocus />
                                        </div>
                                        {isManufacturing && (
                                            <div className="input-group">
                                                <label>Gefertigte Menge</label>
                                                <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="0" placeholder="0" />
                                            </div>
                                        )}
                                        <div className="input-group">
                                            <label>Notiz</label>
                                            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Bemerkung..." />
                                        </div>
                                    </div>
                                )}

                                <button className={`start-btn ${mode === 'Stoppuhr' ? 'btn-play' : 'btn-save'}`} onClick={handleSubmit}>
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
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center; z-index: 1000;
                    backdrop-filter: blur(2px);
                }
                .work-session-modal {
                    background: white;
                    width: calc(100vw - 24px); max-width: 380px; 
                    height: 85vh; max-height: 700px;
                    border-radius: 16px; display: flex; flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    overflow: hidden;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                .modal-header {
                    padding: 8px 16px; /* Reduced vertical padding */
                    border-bottom: 1px solid #f1f5f9;
                    display: flex; justify-content: space-between; align-items: center;
                    background: white; z-index: 10;
                }
                .modal-header h3 { margin: 0; font-size: 1.1rem; color: #0f172a; }
                .close-btn { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; border-radius: 50%; display: flex; }
                .close-btn:hover { background: #f1f5f9; color: #64748b; }
                
                .modal-body {
                    flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;
                }

                /* View 1: Selection */
                .view-selection { display: flex; flex-direction: column; height: 100%; }
                .view-header { padding: 8px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                .view-header h4 { margin: 0; font-size: 0.8rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; font-weight: 600; }
                
                .steps-list-container {
                    flex: 1; overflow-y: auto; padding: 8px 0; /* Removed horizontal padding to use full width */
                    scroll-behavior: smooth;
                }

                /* View 2: Config */
                .view-config { display: flex; flex-direction: column; height: 100%; animation: fadeIn 0.3s ease; }
                
                .selected-header {
                    padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
                    display: flex; flex-direction: column; gap: 12px;
                }
                .back-link {
                    background: none; border: none; cursor: pointer; 
                    display: flex; align-items: center; gap: 4px;
                    color: #64748b; font-size: 0.9rem; padding: 0;
                    align-self: flex-start;
                }
                .back-link:hover { color: var(--color-primary); }
                
                .current-step {
                    display: flex; align-items: center; gap: 10px;
                    font-size: 1.25rem; font-weight: 600; color: #0f172a;
                }
                .current-step svg { color: var(--color-primary); }

                .config-form {
                    flex: 1; padding: 24px; padding-bottom: 32px; /* Extra bottom padding */
                    display: flex; flex-direction: column; overflow-y: auto;
                }

                /* Steps Components */
                .step-group { margin-bottom: 4px; }
                .group-header {
                    display: flex; align-items: center; gap: 10px; padding: 12px 20px; /* More padding */
                    cursor: pointer; font-weight: 600; color: #334155;
                    border-bottom: 1px solid #f1f5f9;
                }
                .group-header:active { background: #f1f5f9; }
                .group-children { background: #f8fafc; padding-bottom: 8px; }
                
                .step-item {
                    display: flex; align-items: center; gap: 12px; padding: 14px 20px; /* Use full width padding */
                    cursor: pointer; color: #475569; border-bottom: 1px solid #f1f5f9;
                    font-size: 1rem;
                }
                .step-icon-colored { color: var(--color-primary); }
                .step-name { flex: 1; }
                
                .step-item:last-child { border-bottom: none; }
                .step-item:active { background: #eff6ff; }
                
                .default-badge {
                    margin-left: auto; font-size: 0.75rem; background: #e2e8f0; 
                    padding: 2px 8px; border-radius: 12px; color: #64748b; font-weight: 500;
                }

                /* Config Components */
                .mode-selection {
                    display: flex; gap: 16px; margin: 0 20px 20px 20px;
                }
                .mode-option { flex: 1; cursor: pointer; position: relative; }
                .mode-option input { opacity: 0; position: absolute; }
                .mode-content {
                    border: 2px solid #e2e8f0; border-radius: 12px; height: 80px;
                    display: flex; align-items: center; justify-content: center;
                    color: #94a3b8; background: white;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .mode-option:hover .mode-content { border-color: #cbd5e1; background: #f8fafc; }
                
                /* Active States with Colors */
                .mode-option.active .mode-content {
                    transform: translateY(-2px);
                    background: #fff;
                    box-shadow: 0 4px 10px -2px rgba(0,0,0,0.1);
                }
                .mode-option.active .mode-content.mode-clock {
                    border-color: var(--color-primary); 
                    color: var(--color-primary);
                    background: #eff6ff;
                }
                .mode-option.active .mode-content.mode-play {
                    border-color: #16a34a; /* Green-600 */
                    color: #16a34a;
                    background: #f0fdf4; /* Green-50 */
                }

                .fixed-inputs { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
                .input-group { display: flex; flex-direction: column; gap: 6px; }
                .input-group label { font-size: 0.9rem; font-weight: 500; color: #64748b; }
                .input-group input {
                    padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px;
                    font-size: 1.1rem; outline: none; transition: border 0.2s;
                }
                .input-group input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

                /* Start Button Variants */
                .start-btn {
                    margin-top: auto; width: 100%; padding: 16px;
                    color: white; border: none; border-radius: 12px;
                    font-size: 1.1rem; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                    margin-bottom: 8px; /* Extra bottom safety margin */
                }
                .start-btn:active { transform: scale(0.98); }
                
                .start-btn.btn-save {
                    background: var(--color-primary);
                    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
                }
                .start-btn.btn-save:hover { background: #2563eb; }

                .start-btn.btn-play {
                    background: #16a34a; /* Green-600 */
                    box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.2);
                }
                .start-btn.btn-play:hover { background: #15803d; }

                .save-feedback {
                    margin-top: 12px; padding: 12px; border-radius: 8px;
                    text-align: center; font-weight: 600;
                }
                .save-feedback.success { background: #dcfce7; color: #166534; }
                .save-feedback.error { background: #fee2e2; color: #991b1b; }

            `}</style>
        </div>
    );
};

export default WorkSessionModal;
