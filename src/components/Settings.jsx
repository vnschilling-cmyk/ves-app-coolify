import React from 'react';
import { Users, ChevronRight, ListChecks } from 'lucide-react';

const Settings = ({ onNavigate }) => {
    return (
        <div className="settings-page">
            <h2 className="page-title">Einstellungen</h2>

            <div className="settings-menu">
                <button
                    className="settings-item"
                    onClick={() => onNavigate('users')}
                >
                    <div className="settings-item-icon bg-blue">
                        <Users size={20} color="white" />
                    </div>
                    <div className="settings-item-content">
                        <span className="settings-item-title">Benutzerverwaltung</span>
                        <span className="settings-item-desc">Benutzer anlegen und verwalten</span>
                    </div>
                    <ChevronRight size={18} className="settings-chevron" />
                </button>

                <button
                    className="settings-item"
                    onClick={() => onNavigate('work-steps')}
                >
                    <div className="settings-item-icon bg-emerald">
                        <ListChecks size={20} color="white" />
                    </div>
                    <div className="settings-item-content">
                        <span className="settings-item-title">Arbeitsgänge</span>
                        <span className="settings-item-desc">Arbeitsgänge und Vorgabezeiten verwalten</span>
                    </div>
                    <ChevronRight size={18} className="settings-chevron" />
                </button>

                {/* Placeholder for future settings */}
                {/* 
                <button className="settings-item">
                    <div className="settings-item-icon bg-gray">
                        <SettingsIcon size={20} color="white" />
                    </div>
                    <span>Weitere Einstellungen...</span>
                </button> 
                */}
            </div>

            <style>{`
                .settings-page {
                    padding: 0;
                }
                .page-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 24px;
                    color: var(--color-text-main);
                }
                .settings-menu {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .settings-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: white;
                    padding: 16px;
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    width: 100%;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                    box-shadow: var(--shadow-sm);
                }
                .settings-item:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--color-primary);
                }
                .settings-item-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .bg-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); }
                .bg-emerald { background: linear-gradient(135deg, #10b981, #059669); }
                .bg-gray { background: #64748b; }
                
                .settings-item-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .settings-item-title {
                    font-weight: 600;
                    color: var(--color-text-main);
                    font-size: 1rem;
                }
                .settings-item-desc {
                    color: var(--color-text-muted);
                    font-size: 0.85rem;
                }
                .settings-chevron {
                    color: var(--color-text-muted);
                }
            `}</style>
        </div>
    );
};

export default Settings;
