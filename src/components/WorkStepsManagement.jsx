import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Folder, FileText, ChevronRight, ChevronDown, Check, Save, FileSpreadsheet, ClipboardCheck, Settings2, Factory, Package, Wrench, ArrowUp, ArrowDown, ArrowRight, FileCheck, RotateCcw, Truck, Calculator, Banknote, Hammer, Cpu, CreditCard, Euro, MapPin, Box } from 'lucide-react';
import { getAppSetting, saveAppSetting } from '../services/storage';

const WorkStepsManagement = ({ onBack }) => {
    // Initial structure based on user request
    const DEFAULT_STEPS = [
        {
            id: 'admin',
            name: 'Administration',
            type: 'group',
            isOpen: true,
            children: [
                { id: 'offer', name: 'Angebot', type: 'step', minutes: 0, timeUnit: 'm', icon: 'FileSpreadsheet', selectedMode: 'manual' },
                { id: 'confirmation', name: 'Auftragsbestätigung', type: 'step', minutes: 0, timeUnit: 'm', icon: 'FileCheck', selectedMode: 'manual' },
                { id: 'order', name: 'Auftrag', type: 'step', minutes: 0, timeUnit: 'm', icon: 'ClipboardCheck', selectedMode: 'manual' },
                { id: 'delivery_note', name: 'Lieferschein', type: 'step', minutes: 0, timeUnit: 'm', icon: 'FileText', selectedMode: 'manual' },
            ]
        },
        { id: 'prep', name: 'Vorbereitung', type: 'step', minutes: 0, timeUnit: 'm', icon: 'Settings2', selectedMode: 'manual' },
        { id: 'prod', name: 'Fertigung', type: 'step', minutes: 0, timeUnit: 'm', icon: 'Factory', selectedMode: 'manual' },
        { id: 'delivery', name: 'Lieferung', type: 'step', minutes: 0, timeUnit: 'm', icon: 'Package', selectedMode: 'delivery_company' },
    ];

    const STEP_OPTIONS = {
        'delivery': [
            { id: 'delivery_company', label: 'An Firma' },
            { id: 'delivery_employee', label: 'An MA' },
            { id: 'pickup_employee', label: 'Abholung' },
            { id: 'stopwatch', label: 'Stoppuhr' }
        ],
        'default': [
            { id: 'manual', label: 'Zeitvorgabe' },
            { id: 'stopwatch', label: 'Stoppuhr' }
        ]
    };

    // Available Icons for Selection
    const AVAILABLE_ICONS = [
        { id: 'Wrench', icon: Wrench, label: 'Standard' },
        { id: 'Settings2', icon: Settings2, label: 'Einstellungen' },
        { id: 'Factory', icon: Factory, label: 'Fabrik' },
        { id: 'Hammer', icon: Hammer, label: 'Hammer' },
        { id: 'Cpu', icon: Cpu, label: 'CNC' },
        { id: 'Package', icon: Package, label: 'Paket' },
        { id: 'Box', icon: Box, label: 'Box' },
        { id: 'Truck', icon: Truck, label: 'LKW' },
        { id: 'MapPin', icon: MapPin, label: 'Ort' },
        { id: 'FileSpreadsheet', icon: FileSpreadsheet, label: 'Tabelle' },
        { id: 'FileText', icon: FileText, label: 'Dokument' },
        { id: 'FileCheck', icon: FileCheck, label: 'Check' },
        { id: 'ClipboardCheck', icon: ClipboardCheck, label: 'Auftrag' },
        { id: 'Calculator', icon: Calculator, label: 'Rechner' },
        { id: 'Banknote', icon: Banknote, label: 'Geld' },
        { id: 'Euro', icon: Euro, label: 'Euro' },
        { id: 'CreditCard', icon: CreditCard, label: 'Karte' },
    ];

    const AVAILABLE_COLORS = [
        '#64748b', // Slate (Default)
        '#ef4444', // Red
        '#f97316', // Orange
        '#f59e0b', // Amber
        '#84cc16', // Lime
        '#10b981', // Emerald
        '#06b6d4', // Cyan
        '#3b82f6', // Blue
        '#6366f1', // Indigo
        '#8b5cf6', // Violet
        '#d946ef', // Fuchsia
        '#f43f5e', // Rose
    ];

    // Icon mapping for work steps
    const STEP_ICONS = {
        'FileSpreadsheet': FileSpreadsheet,
        'ClipboardCheck': ClipboardCheck,
        'Settings2': Settings2,
        'Factory': Factory,
        'Package': Package,
        'FileText': FileText,
        'Wrench': Wrench,
        'FileCheck': FileCheck,
        'Truck': Truck,
        'Calculator': Calculator,
        'Banknote': Banknote,
        'Hammer': Hammer,
        'Cpu': Cpu,
        'CreditCard': CreditCard,
        'Euro': Euro,
        'MapPin': MapPin,
        'Box': Box
    };

    const STEP_COLORS = {
        'FileSpreadsheet': '#3b82f6', // blue-500
        'FileCheck': '#8b5cf6', // violet-500
        'ClipboardCheck': '#10b981', // emerald-500
        'FileText': '#f59e0b', // amber-500
        'Settings2': '#6366f1', // indigo-500
        'Factory': '#ef4444', // red-500
        'Package': '#ec4899', // pink-500
        'Wrench': '#64748b', // slate-500
    };

    const getStepIcon = (iconName) => {
        return STEP_ICONS[iconName] || Wrench;
    };

    const getStepColor = (color) => {
        return color || '#64748b'; // Default to slate if no color set
    };

    const [steps, setSteps] = useState(DEFAULT_STEPS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        loadSteps();
    }, []);

    const loadSteps = async () => {
        setLoading(true);
        try {
            const data = await getAppSetting('work_steps_config', DEFAULT_STEPS);
            if (data) {
                // ... same enrichment logic ...
                const ICON_MAP = {
                    'offer': 'FileSpreadsheet',
                    'confirmation': 'FileCheck',
                    'order': 'ClipboardCheck',
                    'delivery_note': 'FileText',
                    'prep': 'Settings2',
                    'prod': 'Factory',
                    'delivery': 'Package'
                };
                const enrichedData = data.map(step => {
                    const getIconForStep = (s) => {
                        if (s.icon && s.icon !== 'Wrench') return s.icon;
                        if (ICON_MAP[s.id]) return ICON_MAP[s.id];
                        // Name-based fallback for existing items
                        if (s.name === 'Auftragsbestätigung') return 'FileCheck';
                        if (s.name === 'Angebot') return 'FileSpreadsheet';
                        if (s.name === 'Auftrag') return 'ClipboardCheck';
                        if (s.name === 'Lieferschein') return 'FileText';
                        if (s.name === 'Vorbereitung') return 'Settings2';
                        if (s.name === 'Fertigung') return 'Factory';
                        if (s.name === 'Lieferung') return 'Package';
                        return 'Wrench';
                    };

                    if (step.type === 'group' && step.children) {
                        return {
                            ...step,
                            children: step.children.map(child => {
                                const initialModeSettings = child.modeSettings || {};
                                if (!child.modeSettings && (child.minutes || child.timeUnit)) {
                                    initialModeSettings['manual'] = {
                                        minutes: child.minutes || 0,
                                        timeUnit: child.timeUnit || 'm'
                                    };
                                }
                                return {
                                    ...child,
                                    icon: getIconForStep(child),
                                    color: child.color || (STEP_COLORS[getIconForStep(child)] || '#64748b'),
                                    selectedMode: child.selectedMode || 'manual',
                                    modeSettings: initialModeSettings
                                };
                            })
                        };
                    }

                    const initialModeSettings = step.modeSettings || {};
                    if (!step.modeSettings && (step.minutes || step.timeUnit)) {
                        initialModeSettings['manual'] = {
                            minutes: step.minutes || 0,
                            timeUnit: step.timeUnit || 'm'
                        };
                    }

                    return {
                        ...step,
                        icon: getIconForStep(step),
                        color: step.color || (STEP_COLORS[getIconForStep(step)] || '#64748b'),
                        selectedMode: step.selectedMode || (step.id === 'delivery' ? 'delivery_company' : 'manual'),
                        modeSettings: initialModeSettings
                    };
                });
                setSteps(enrichedData);
            }
        } catch (error) {
            console.error("Error loading steps:", error);
            // Fallback to DEFAULT_STEPS if something goes wrong
            setSteps(DEFAULT_STEPS);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setStatusMsg('');
        const success = await saveAppSetting('work_steps_config', steps);
        if (success) {
            setStatusMsg('Gespeichert!');
            setTimeout(() => setStatusMsg(''), 3000);
        } else {
            setStatusMsg('Fehler beim Speichern');
        }
        setSaving(false);
    };

    const handleNameChange = (id, newName, parentId = null) => {
        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: step.children.map(child =>
                            child.id === id ? { ...child, name: newName } : child
                        )
                    };
                }
                return step;
            }));
        } else {
            setSteps(steps.map(step =>
                step.id === id ? { ...step, name: newName } : step
            ));
        }
    };

    const handleMinutesChange = (id, minutes, targetMode, parentId = null) => {
        const newMinutes = parseInt(minutes) || 0;
        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: step.children.map(child => {
                            if (child.id === id) {
                                // Use provided targetMode or fallback to current (though UI now provides it)
                                const modeToUpdate = targetMode || child.selectedMode;
                                return {
                                    ...child,
                                    modeSettings: {
                                        ...child.modeSettings,
                                        [modeToUpdate]: {
                                            ...(child.modeSettings?.[modeToUpdate] || {}),
                                            minutes: newMinutes,
                                            timeUnit: child.modeSettings?.[modeToUpdate]?.timeUnit || 'm' // Preserve unit or default
                                        }
                                    }
                                };
                            }
                            return child;
                        })
                    };
                }
                return step;
            }));
        } else {
            setSteps(steps.map(step => {
                if (step.id === id) {
                    const modeToUpdate = targetMode || step.selectedMode;
                    return {
                        ...step,
                        modeSettings: {
                            ...step.modeSettings,
                            [modeToUpdate]: {
                                ...(step.modeSettings?.[modeToUpdate] || {}),
                                minutes: newMinutes,
                                timeUnit: step.modeSettings?.[modeToUpdate]?.timeUnit || 'm'
                            }
                        }
                    };
                }
                return step;
            }));
        }
    };

    const handleTimeUnitChange = (id, unit, targetMode, parentId = null) => {
        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: step.children.map(child => {
                            if (child.id === id) {
                                const modeToUpdate = targetMode || child.selectedMode;
                                return {
                                    ...child,
                                    modeSettings: {
                                        ...child.modeSettings,
                                        [modeToUpdate]: {
                                            ...(child.modeSettings?.[modeToUpdate] || {}),
                                            minutes: child.modeSettings?.[modeToUpdate]?.minutes || 0, // Preserve minutes or default
                                            timeUnit: unit
                                        }
                                    }
                                };
                            }
                            return child;
                        })
                    };
                }
                return step;
            }));
        } else {
            setSteps(steps.map(step => {
                if (step.id === id) {
                    const modeToUpdate = targetMode || step.selectedMode;
                    return {
                        ...step,
                        modeSettings: {
                            ...step.modeSettings,
                            [modeToUpdate]: {
                                ...(step.modeSettings?.[modeToUpdate] || {}),
                                minutes: step.modeSettings?.[modeToUpdate]?.minutes || 0,
                                timeUnit: unit
                            }
                        }
                    };
                }
                return step;
            }));
        }
    };

    const handleIconChange = (id, newIconName, parentId = null) => {
        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: step.children.map(child =>
                            child.id === id ? { ...child, icon: newIconName } : child
                        )
                    };
                }
                return step;
            }));
        } else {
            setSteps(steps.map(step =>
                step.id === id ? { ...step, icon: newIconName } : step
            ));
        }
    };

    const handleColorChange = (id, newColor, parentId = null) => {
        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: step.children.map(child =>
                            child.id === id ? { ...child, color: newColor } : child
                        )
                    };
                }
                return step;
            }));
        } else {
            setSteps(steps.map(step =>
                step.id === id ? { ...step, color: newColor } : step
            ));
        }
    };

    const handleModeChange = (id, mode, parentId = null) => {
        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: step.children.map(child =>
                            child.id === id ? { ...child, selectedMode: mode } : child
                        )
                    };
                }
                return step;
            }));
        } else {
            setSteps(steps.map(step =>
                step.id === id ? { ...step, selectedMode: mode } : step
            ));
        }
    };


    // Helper to generate unique IDs
    const generateId = () => Math.random().toString(36).substr(2, 9);

    // Drag & Drop State
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverItem, setDragOverItem] = useState(null);
    const dragHoverTimer = useRef(null);
    const dragHoverTarget = useRef(null);

    const handleDragStart = (e, item, parentId = null) => {
        setDraggedItem({ item, parentId });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, targetId, targetParentId = null, targetType = 'step') => {
        e.preventDefault();

        if (draggedItem?.item.id === targetId) return;
        if (draggedItem?.item.type === 'group' && targetParentId === draggedItem.item.id) return;

        // Reset timer if target changed
        if (dragHoverTarget.current !== targetId) {
            if (dragHoverTimer.current) clearTimeout(dragHoverTimer.current);
            dragHoverTarget.current = targetId;

            if (targetType === 'group' || targetType === 'group-header') {
                dragHoverTimer.current = setTimeout(() => {
                    // Open the group
                    setSteps(prevSteps => prevSteps.map(step =>
                        step.id === targetId ? { ...step, isOpen: true } : step
                    ));
                    // Update state to indicate insertion into group
                    setDragOverItem({ id: targetId, parentId: targetParentId, type: 'group-insert' });
                }, 1000);
            }
        }

        // If we are already in insertion mode for this target, keep it
        if (dragOverItem?.id === targetId && dragOverItem?.type === 'group-insert') {
            return;
        }

        setDragOverItem({ id: targetId, parentId: targetParentId, type: targetType });
    };

    const handleDrop = (e, targetId, targetParentId = null, targetType = 'step') => {
        e.preventDefault();

        // Clear timer
        if (dragHoverTimer.current) clearTimeout(dragHoverTimer.current);
        dragHoverTimer.current = null;
        dragHoverTarget.current = null;

        const isInsertIntoGroup = dragOverItem?.type === 'group-insert';
        setDragOverItem(null);

        if (!draggedItem) return;
        if (draggedItem.item.id === targetId) return;

        const sourceId = draggedItem.item.id;
        const sourceParentId = draggedItem.parentId;

        if (isInsertIntoGroup) {
            moveItemToGroup(sourceId, sourceParentId, targetId);
        } else {
            moveItemToTarget(sourceId, sourceParentId, targetId, targetParentId);
        }

        setDraggedItem(null);
    };

    const moveItemToGroup = (sourceId, sourceParentId, targetGroupId) => {
        let newSteps = [...steps];
        let itemToMove;

        // 1. Remove Item from Source
        if (sourceParentId) {
            newSteps = newSteps.map(step => {
                if (step.id === sourceParentId && step.children) {
                    const itemIndex = step.children.findIndex(c => c.id === sourceId);
                    if (itemIndex > -1) {
                        itemToMove = step.children[itemIndex];
                        const newChildren = [...step.children];
                        newChildren.splice(itemIndex, 1);
                        return { ...step, children: newChildren };
                    }
                }
                return step;
            });
        } else {
            const itemIndex = newSteps.findIndex(s => s.id === sourceId);
            if (itemIndex > -1) {
                itemToMove = newSteps[itemIndex];
                newSteps.splice(itemIndex, 1);
            }
        }

        if (!itemToMove) return;

        // 2. Insert into Target Group as last child
        newSteps = newSteps.map(step => {
            if (step.id === targetGroupId) {
                return { ...step, children: [...(step.children || []), itemToMove], isOpen: true };
            }
            return step;
        });

        setSteps(newSteps);
    };

    const moveItemToTarget = (sourceId, sourceParentId, targetId, targetParentId) => {
        let newSteps = [...steps];
        let itemToMove;

        // 1. Remove Item from Source
        if (sourceParentId) {
            newSteps = newSteps.map(step => {
                if (step.id === sourceParentId && step.children) {
                    const itemIndex = step.children.findIndex(c => c.id === sourceId);
                    if (itemIndex > -1) {
                        itemToMove = step.children[itemIndex];
                        const newChildren = [...step.children];
                        newChildren.splice(itemIndex, 1);
                        return { ...step, children: newChildren };
                    }
                }
                return step;
            });
        } else {
            const itemIndex = newSteps.findIndex(s => s.id === sourceId);
            if (itemIndex > -1) {
                itemToMove = newSteps[itemIndex];
                newSteps.splice(itemIndex, 1);
            }
        }

        if (!itemToMove) return;

        // 2. Insert Item at Target        
        if (targetParentId) {
            newSteps = newSteps.map(step => {
                if (step.id === targetParentId) {
                    const targetIndex = step.children.findIndex(c => c.id === targetId);
                    const newChildren = [...step.children];
                    newChildren.splice(targetIndex + 1, 0, itemToMove);
                    return { ...step, children: newChildren };
                }
                return step;
            });
        } else {
            const targetIndex = newSteps.findIndex(s => s.id === targetId);
            newSteps.splice(targetIndex + 1, 0, itemToMove);
        }

        setSteps(newSteps);
    };

    const handleAddConnection = (parentId = null) => {
        const newStep = {
            id: generateId(),
            name: 'Neuer Arbeitsgang',
            type: 'step',
            minutes: 0,
            icon: 'Wrench'
        };

        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: [...(step.children || []), newStep]
                    };
                }
                return step;
            }));
        } else {
            setSteps([...steps, newStep]);
        }
    };

    const handleMove = (id, direction, parentId = null) => {
        const moveItemInList = (list) => {
            const index = list.findIndex(item => item.id === id);
            if (index === -1) return list;

            const newList = [...list];
            if (direction === 'up' && index > 0) {
                [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
            } else if (direction === 'down' && index < list.length - 1) {
                [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
            }
            return newList;
        };

        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId && step.type === 'group') {
                    return { ...step, children: moveItemInList(step.children) };
                }
                return step;
            }));
        } else {
            setSteps(moveItemInList(steps));
        }
    };

    const handleIndent = (id) => {
        const index = steps.findIndex(s => s.id === id);
        if (index <= 0) return; // Cannot indent first item

        const prevItem = steps[index - 1];
        if (prevItem.type !== 'group') return; // Can only indent into a group

        const itemToMove = steps[index];
        const newSteps = [...steps];
        newSteps.splice(index, 1); // Remove from root

        // Add to previous group's children
        const updatedGroup = {
            ...prevItem,
            children: [...(prevItem.children || []), itemToMove],
            isOpen: true // Auto expand
        };
        newSteps[index - 1] = updatedGroup;

        setSteps(newSteps);
    };

    const handleOutdent = (id, parentDesc) => {
        // ParentDesc is the parent group object
        const parentId = parentDesc.id;

        // Find parent index in root
        const parentIndex = steps.findIndex(s => s.id === parentId);
        if (parentIndex === -1) return;

        const parentGroup = steps[parentIndex];
        const itemIndex = parentGroup.children.findIndex(s => s.id === id);
        if (itemIndex === -1) return;

        const itemToMove = parentGroup.children[itemIndex];

        // Remove from group
        const newChildren = [...parentGroup.children];
        newChildren.splice(itemIndex, 1);

        const updatedGroup = { ...parentGroup, children: newChildren };

        const newSteps = [...steps];
        newSteps[parentIndex] = updatedGroup;

        // Insert into root after the group
        newSteps.splice(parentIndex + 1, 0, itemToMove);

        setSteps(newSteps);
    };

    const handleDelete = (id, parentId = null) => {
        if (!confirm('Wirklich löschen?')) return;

        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: step.children.filter(child => child.id !== id)
                    };
                }
                return step;
            }));
        } else {
            setSteps(steps.filter(step => step.id !== id));
        }
    };

    const toggleGroup = (id) => {
        setSteps(steps.map(step =>
            step.id === id ? { ...step, isOpen: !step.isOpen } : step
        ));
    };

    const toggleSettings = (id, parentId = null) => {
        if (parentId) {
            setSteps(steps.map(step => {
                if (step.id === parentId) {
                    return {
                        ...step,
                        children: step.children.map(child =>
                            child.id === id ? { ...child, settingsOpen: !child.settingsOpen } : child
                        )
                    };
                }
                return step;
            }));
        } else {
            setSteps(steps.map(step =>
                step.id === id ? { ...step, settingsOpen: !step.settingsOpen } : step
            ));
        }
    };

    const resetSteps = () => {
        if (!confirm('Möchten Sie alle Arbeitsgänge auf die Standardwerte zurücksetzen? Alle Änderungen gehen verloren.')) return;
        setSteps(DEFAULT_STEPS);
        setStatusMsg('Zurückgesetzt. Bitte Speichern klicken.');
    };


    return (
        <div className="work-steps-page">
            <div className="page-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h2>Arbeitsgänge verwalten</h2>
            </div>

            <button className="add-step-btn" onClick={() => handleAddConnection()}>
                <Plus size={18} /> Neuer Arbeitsgang
            </button>

            <div className="steps-container">
                {loading ? (
                    <div className="loading-state">Lade Einstellungen...</div>
                ) : (
                    steps.map((step, index) => (
                        <div
                            key={step.id}
                            className={`step-item-wrapper ${dragOverItem?.id === step.id ? 'drag-over' : ''}`}
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, step, null)}
                            onDragOver={(e) => handleDragOver(e, step.id, null, step.type)}
                            onDrop={(e) => handleDrop(e, step.id, null, step.type)}
                        >
                            {step.type === 'group' ? (
                                <div className={`group-wrapper ${dragOverItem?.id === step.id && dragOverItem?.type === 'group-insert' ? 'group-insert-highlight' : ''}`}>
                                    <div className="step-row group-header" style={{ paddingLeft: '4px' }}>
                                        <button className="toggle-btn" onClick={(e) => { e.stopPropagation(); toggleGroup(step.id); }} style={{ marginRight: '4px' }}>
                                            {step.isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </button>
                                        <Folder size={20} className="icon-group" />
                                        <input
                                            type="text"
                                            value={step.name}
                                            onChange={(e) => handleNameChange(step.id, e.target.value)}
                                            className="step-name-input group-input"
                                            placeholder="Gruppenname"
                                        />
                                        <div className="row-actions">
                                            <div className="drag-handle" style={{ cursor: 'grab', padding: '0 4px', display: 'flex', color: '#cbd5e1' }}><GripVertical size={16} /></div>
                                            {/* Arrows Removed */}
                                            <button className="action-btn delete" title="Löschen" onClick={(e) => { e.stopPropagation(); handleDelete(step.id); }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    {step.isOpen && (
                                        <div className="group-children">
                                            {step.children.map((child, childIndex) => (
                                                <div key={child.id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                    <div
                                                        className={`step-row child-row ${dragOverItem?.id === child.id ? 'drag-over' : ''}`}
                                                        draggable="true"
                                                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, child, step.id); }}
                                                        onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, child.id, step.id, 'step'); }}
                                                        onDrop={(e) => { e.stopPropagation(); handleDrop(e, child.id, step.id, 'step'); }}
                                                        style={{ paddingLeft: '28px' }}
                                                    >
                                                        {(() => {
                                                            const StepIcon = getStepIcon(child.icon);
                                                            const stepColor = getStepColor(child.color);
                                                            return (
                                                                <>
                                                                    <StepIcon size={18} className="icon-step" style={{ color: stepColor }} />
                                                                    <input
                                                                        type="text"
                                                                        value={child.name}
                                                                        onChange={(e) => handleNameChange(child.id, e.target.value, step.id)}
                                                                        className="step-name-input"
                                                                        placeholder="Name"
                                                                        style={{ color: stepColor, fontWeight: 600 }}
                                                                    />
                                                                </>
                                                            );
                                                        })()}

                                                        <div className="row-actions">
                                                            <button
                                                                className={`action-btn settings-toggle ${child.settingsOpen ? 'active' : ''}`}
                                                                title="Einstellungen"
                                                                onClick={(e) => { e.stopPropagation(); toggleSettings(child.id, step.id); }}
                                                            >
                                                                <Settings2 size={28} />
                                                            </button>
                                                            <button className="action-btn delete" title="Löschen" onClick={(e) => { e.stopPropagation(); handleDelete(child.id, step.id); }}>
                                                                <Trash2 size={28} />
                                                            </button>
                                                            <div className="drag-handle" style={{ cursor: 'grab', padding: '0 4px', display: 'flex', color: '#cbd5e1' }}><GripVertical size={28} /></div>
                                                        </div>
                                                    </div>
                                                    {child.settingsOpen && (
                                                        <div className="settings-panel" style={{ marginLeft: '28px' }}>
                                                            <div className="setting-item">
                                                                <label style={{ marginBottom: '4px' }}>Modus</label>
                                                                <div className="radio-group">
                                                                    {(STEP_OPTIONS[child.id] || STEP_OPTIONS['default']).map(option => (
                                                                        <label key={option.id} className="radio-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`mode-${child.id}`}
                                                                                    value={option.id}
                                                                                    checked={child.selectedMode === option.id}
                                                                                    onChange={(e) => handleModeChange(child.id, e.target.value, step.id)}
                                                                                />
                                                                                <span style={{ marginLeft: '8px' }}>{option.label}</span>
                                                                            </div>
                                                                            {['manual', 'delivery_company', 'delivery_employee', 'pickup_employee'].includes(option.id) && (
                                                                                <div className="inline-time-input" onClick={(e) => e.stopPropagation()}>
                                                                                    <input
                                                                                        type="number"
                                                                                        value={child.modeSettings?.[option.id]?.minutes || 0}
                                                                                        onChange={(e) => handleMinutesChange(child.id, e.target.value, option.id, step.id)}
                                                                                        min="0"
                                                                                        style={{ width: '50px', marginLeft: '8px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                                                    />
                                                                                    <select
                                                                                        value={child.modeSettings?.[option.id]?.timeUnit || 'm'}
                                                                                        onChange={(e) => handleTimeUnitChange(child.id, e.target.value, option.id, step.id)}
                                                                                        style={{ marginLeft: '4px', padding: '2px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                                                    >
                                                                                        <option value="s">s</option>
                                                                                        <option value="m">m</option>
                                                                                        <option value="h">h</option>
                                                                                    </select>
                                                                                </div>
                                                                            )}
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="setting-item">
                                                                <label style={{ marginBottom: '8px' }}>Icon</label>
                                                                <div className="icon-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                    {AVAILABLE_ICONS.map(iconOption => {
                                                                        const IconComp = iconOption.icon;
                                                                        const isSelected = child.icon === iconOption.id;
                                                                        const iconColor = isSelected ? 'var(--color-primary)' : '#64748b';
                                                                        return (
                                                                            <button
                                                                                key={iconOption.id}
                                                                                onClick={() => handleIconChange(child.id, iconOption.id, step.id)}
                                                                                className={`icon-select-btn ${isSelected ? 'active' : ''}`}
                                                                                style={{
                                                                                    width: '36px',
                                                                                    height: '36px',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
                                                                                    borderRadius: '8px',
                                                                                    background: isSelected ? '#eff6ff' : 'white',
                                                                                    cursor: 'pointer',
                                                                                    flexShrink: 0,
                                                                                    padding: 0
                                                                                }}
                                                                                title={iconOption.label}
                                                                            >
                                                                                {IconComp && <IconComp size={20} color={iconColor} style={{ flexShrink: 0 }} />}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            <div className="setting-item">
                                                                <label style={{ marginBottom: '8px' }}>Farbe</label>
                                                                <div className="color-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                    {AVAILABLE_COLORS.map(color => (
                                                                        <button
                                                                            key={color}
                                                                            onClick={() => handleColorChange(child.id, color, step.id)}
                                                                            style={{
                                                                                width: '28px',
                                                                                height: '28px',
                                                                                display: 'block',
                                                                                borderRadius: '6px',
                                                                                background: color,
                                                                                border: child.color === color ? '2px solid white' : 'none',
                                                                                boxShadow: child.color === color ? '0 0 0 2px var(--color-primary)' : 'none',
                                                                                cursor: 'pointer',
                                                                                padding: 0,
                                                                                flexShrink: 0
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="step-item-wrapper" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                    <div className="step-row top-level-row" style={{ paddingLeft: '4px' }}>
                                        {(() => {
                                            const StepIcon = getStepIcon(step.icon);
                                            const stepColor = getStepColor(step.color);
                                            return (
                                                <>
                                                    <StepIcon size={20} className="icon-step" style={{ color: stepColor }} />
                                                    <input
                                                        type="text"
                                                        value={step.name}
                                                        onChange={(e) => handleNameChange(step.id, e.target.value)}
                                                        className="step-name-input"
                                                        placeholder="Name"
                                                        style={{ color: stepColor, fontWeight: 600 }}
                                                    />
                                                </>
                                            );
                                        })()}

                                        <div className="row-actions">
                                            <button
                                                className={`action-btn settings-toggle ${step.settingsOpen ? 'active' : ''}`}
                                                title="Einstellungen"
                                                onClick={(e) => { e.stopPropagation(); toggleSettings(step.id); }}
                                            >
                                                <Settings2 size={28} />
                                            </button>
                                            <button className="action-btn delete" title="Löschen" onClick={(e) => { e.stopPropagation(); handleDelete(step.id); }}>
                                                <Trash2 size={28} />
                                            </button>
                                            <div className="drag-handle" style={{ cursor: 'grab', padding: '0 4px', display: 'flex', color: '#cbd5e1' }}><GripVertical size={28} /></div>
                                        </div>
                                    </div>
                                    {step.settingsOpen && (
                                        <div className="settings-panel" style={{ marginLeft: '4px' }}>
                                            <div className="setting-item">
                                                <label style={{ marginBottom: '4px' }}>Modus</label>
                                                <div className="radio-group">
                                                    {(STEP_OPTIONS[step.id] || STEP_OPTIONS['default']).map(option => (
                                                        <label key={option.id} className="radio-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                <input
                                                                    type="radio"
                                                                    name={`mode-${step.id}`}
                                                                    value={option.id}
                                                                    checked={step.selectedMode === option.id}
                                                                    onChange={(e) => handleModeChange(step.id, e.target.value)}
                                                                />
                                                                <span style={{ marginLeft: '8px' }}>{option.label}</span>
                                                            </div>
                                                            {['manual', 'delivery_company', 'delivery_employee', 'pickup_employee'].includes(option.id) && (
                                                                <div className="inline-time-input" onClick={(e) => e.stopPropagation()}>
                                                                    <input
                                                                        type="number"
                                                                        value={step.modeSettings?.[option.id]?.minutes || 0}
                                                                        onChange={(e) => handleMinutesChange(step.id, e.target.value, option.id)}
                                                                        min="0"
                                                                        style={{ width: '50px', marginLeft: '8px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                                    />
                                                                    <select
                                                                        value={step.modeSettings?.[option.id]?.timeUnit || 'm'}
                                                                        onChange={(e) => handleTimeUnitChange(step.id, e.target.value, option.id)}
                                                                        style={{ marginLeft: '4px', padding: '2px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                                    >
                                                                        <option value="s">s</option>
                                                                        <option value="m">m</option>
                                                                        <option value="h">h</option>
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="setting-item">
                                                <label style={{ marginBottom: '8px' }}>Icon</label>
                                                <div className="icon-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {AVAILABLE_ICONS.map(iconOption => {
                                                        const IconComp = iconOption.icon;
                                                        const isSelected = step.icon === iconOption.id;
                                                        const iconColor = isSelected ? 'var(--color-primary)' : '#64748b';
                                                        return (
                                                            <button
                                                                key={iconOption.id}
                                                                onClick={() => handleIconChange(step.id, iconOption.id)}
                                                                className={`icon-select-btn ${isSelected ? 'active' : ''}`}
                                                                style={{
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
                                                                    borderRadius: '8px',
                                                                    background: isSelected ? '#eff6ff' : 'white',
                                                                    cursor: 'pointer',
                                                                    flexShrink: 0,
                                                                    padding: 0
                                                                }}
                                                                title={iconOption.label}
                                                            >
                                                                {IconComp && <IconComp size={20} color={iconColor} style={{ flexShrink: 0 }} />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="setting-item">
                                                <label style={{ marginBottom: '8px' }}>Farbe</label>
                                                <div className="color-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {AVAILABLE_COLORS.map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => handleColorChange(step.id, color)}
                                                            style={{
                                                                width: '28px',
                                                                height: '28px',
                                                                display: 'block',
                                                                borderRadius: '6px',
                                                                background: color,
                                                                border: step.color === color ? '2px solid white' : 'none',
                                                                boxShadow: step.color === color ? '0 0 0 2px var(--color-primary)' : 'none',
                                                                cursor: 'pointer',
                                                                padding: 0,
                                                                flexShrink: 0
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="actions-footer">
                <div className="footer-content">
                    <span className={`status-msg ${statusMsg.includes('Fehler') ? 'error' : 'success'}`}>
                        {statusMsg}
                    </span>
                    <button
                        className="reset-btn"
                        onClick={resetSteps}
                        title="Auf Standard zurücksetzen"
                        style={{ background: 'none', border: '1px solid #e2e8f0', color: '#64748b', marginRight: 'auto', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <RotateCcw size={16} />
                        <span style={{ fontSize: '0.85rem' }}>Reset</span>
                    </button>
                    <button
                        className="save-btn"
                        onClick={handleSave}
                        disabled={saving || loading}
                    >
                        {saving ? 'Speichere...' : (<><Save size={18} /> Speichern</>)}
                    </button>
                </div>
            </div>

            <style>{`
                .work-steps-page {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    max-width: 100%;
                    overflow-x: hidden;
                    box-sizing: border-box;
                }
                .work-steps-page * {
                    box-sizing: border-box;
                }
                .page-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                    padding: 0 8px;
                    flex-shrink: 0;
                    width: 100%;
                    overflow: hidden;
                }
                .page-header h3 {
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    min-width: 0;
                    flex: 1;
                    font-size: 1.1rem;
                }
                .back-btn {
                    background: none; border: none; cursor: pointer; color: var(--color-text-main);
                    padding: 8px; border-radius: 50%; display: flex;
                    flex-shrink: 0;
                }
                .back-btn:hover { background: #f1f5f9; }
                .page-header h2 { margin: 0; font-size: 1.25rem; }

                .add-step-btn {
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 8px;
                    justify-content: center; 
                    gap: 8px;
                    width: 100%;
                    margin: 0 0 12px 0;
                    padding: 10px 12px;
                    background: var(--color-primary);
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    color: white;
                    font-weight: 600;
                    font-size: 0.9rem;
                    box-shadow: var(--shadow-sm);
                    transition: all 0.2s;
                }
                .add-step-btn:hover { 
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }

                .steps-container {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: 0 0 16px 0;
                    width: 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                
                .step-item-wrapper {
                    width: 100%;
                }

                .actions-footer {
                    padding: 10px 8px;
                    border-top: none;
                    background: transparent;
                    flex-shrink: 0;
                    width: 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                    display: flex;
                    justify-content: flex-end;
                    overflow: hidden;
                }
                
                .footer-content {
                    width: 100%;
                    max-width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 8px;
                }

                .step-row.drag-over {
                    border: 2px dashed var(--color-primary);
                    background: #eff6ff;
                }

                .group-insert-highlight .group-header {
                    background-color: #dbeafe;
                    border-color: #3b82f6;
                }

                
                /* Settings Panel Styles */
                .settings-panel {
                    background: #f8fafc;
                    border: 1px solid var(--color-border);
                    border-top: none;
                    border-radius: 0 0 8px 8px;
                    padding: 12px;
                    margin-top: -4px; /* Connect to row above */
                    margin-bottom: 8px;
                    width: calc(100% - 28px); /* Account for margin-left if needed, dynamic? */
                    width: auto;
                    margin-right: 0;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                
                .step-row.child-row + .settings-panel {
                     /* Specific adjustment for child row panels */
                     margin-bottom: 4px;
                }

                .setting-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .setting-item label {
                    font-size: 0.8rem;
                    color: var(--color-text-muted);
                    font-weight: 500;
                }
                .radio-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-bottom: 8px;
                }
                .radio-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9rem;
                    color: var(--color-text-main);
                    cursor: pointer;
                }
                .radio-label input[type="radio"] {
                    accent-color: var(--color-primary);
                    width: 16px; 
                    height: 16px;
                }
                .input-with-unit {
                    display: flex;
                    align-items: center;
                    background: white;
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    overflow: hidden;
                    width: 120px;
                }
                .input-with-unit input {
                    border: none;
                    padding: 6px 8px;
                    width: 100%;
                    font-size: 0.9rem;
                    outline: none;
                }
                .input-with-unit span {
                    padding: 0 8px;
                    color: var(--color-text-muted);
                    font-size: 0.85rem;
                    background: #f1f5f9;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    border-left: 1px solid var(--color-border);
                }
                
                .action-btn.settings-toggle {
                    margin-right: 4px;
                    color: var(--color-text-light);
                }
                .action-btn.settings-toggle:hover, .action-btn.settings-toggle.active {
                    background: #eff6ff;
                    color: var(--color-primary);
                }

                .step-row {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    background: white;
                    padding: 0; 
                    padding-right: 0; /* Maximize width */
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    transition: border 0.2s;
                    width: 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                    min-height: 40px;
                    overflow: hidden;
                    position: relative; 
                    z-index: 2; /* Keep above settings panel */
                }
                .step-row:focus-within {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
                }
                
                /* Full height drag handle - White Background */
                .step-row .drag-handle {
                    /* Defined below in block */
                }
                
                .step-row .row-actions { 
                    opacity: 1; 
                    margin-left: 0; 
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    height: 100%;
                }

                .row-actions {
                    display: flex; 
                    align-items: center;
                    height: 100%;
                }
                
                .action-btn {
                    width: 56px;
                    height: 100%; /* Full height of row */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: none;
                    cursor: pointer; 
                    color: #64748b; 
                    flex-shrink: 0;
                    transition: background 0.2s, color 0.2s;
                }
                .action-btn:hover { background: #f1f5f9; color: #334155; }
                
                /* Red delete button */
                .action-btn.delete { color: #ef4444; width: 60px; }
                .action-btn.delete:hover { background: #fee2e2; }
                
                /* Drag handle - now grouped with settings? No, it's the divider */
                .step-row .drag-handle {
                    align-self: stretch;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border-left: 1px solid #e2e8f0; /* Border Left now */
                    width: 44px;
                    cursor: grab;
                    color: #94a3b8;
                    margin: 0;
                }
                .step-row .drag-handle:hover {
                    color: #475569;
                    background: #f8fafc;
                }
                
                .action-btn.settings-toggle {
                    width: 56px;
                    color: #64748b;
                    margin-right: 0;
                }
                
                .group-header {
                    background: white; 
                    border-bottom: none;
                }
                .group-header .drag-handle {
                    background: transparent; 
                }

                .group-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    width: 100%;
                    border-radius: 8px;
                    transition: background-color 0.2s;
                }
                .group-children {
                    margin-left: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding-left: 0;
                    border-left: none;
                    width: 100%;
                }

                .toggle-btn {
                    background: none; border: none; cursor: pointer; color: var(--color-text-muted);
                    display: flex; padding: 2px; border-radius: 4px;
                    flex-shrink: 0;
                }
                .toggle-btn:hover { background: #e2e8f0; color: var(--color-text-main); }
                /* .spacer-toggle removed */ 

                .icon-group { color: #475569; flex-shrink: 0; margin-left: 4px; }
                .icon-step { flex-shrink: 0; margin-left: 4px; }  /* Color handled inline */ 

                .step-name-input {
                    flex: 1 1 0px; /* flex-grow, flex-shrink, basis 0 */
                    min-width: 0;
                    max-width: 100%;
                    width: 0; /* Force flex Basis */
                    border: none;
                    background: transparent;
                    font-size: 0.9rem;
                    color: var(--color-text-main);
                    padding: 8px 4px; 
                    border-radius: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .step-name-input:focus {
                    outline: none;
                    background: #eff6ff;
                }
                .group-input {
                    font-weight: 600;
                }

                .minutes-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    background: #f1f5f9;
                    padding: 2px 4px;
                    border-radius: 6px;
                    flex-shrink: 0;
                    margin-right: 2px;
                }
                .step-minutes-input {
                    width: 24px;
                    border: none;
                    background: transparent;
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                    font-weight: 600;
                    color: var(--color-primary);
                    font-size: 0.85rem;
                }
                .step-minutes-input:focus { outline: none; }
                .unit {
                    color: var(--color-text-muted);
                    font-size: 0.75rem;
                }

                .loading-state {
                    text-align: center; color: var(--color-text-muted); padding: 20px;
                }
                .save-btn {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 100px;
                    justify-content: center;
                    font-size: 0.9rem;
                    margin-left: auto;
                }
                .save-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                .status-msg {
                    font-size: 0.85rem;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 150px;
                }
                .status-msg.success { color: #166534; }
                .status-msg.error { color: #ef4444; }
                
                @media (max-width: 480px) {
                    .step-row { padding: 6px 4px; }
                    .page-header h2 { font-size: 1.1rem; }
                }
            `}</style>
        </div >
    );
};

export default WorkStepsManagement;
