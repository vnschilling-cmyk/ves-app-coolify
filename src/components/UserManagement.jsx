import { useState } from 'react';
import { useUsers } from '../context/UserContext';

import { UserPlus, Users, Pencil, Check, X, Trash2, Plus, LogOut } from 'lucide-react';
import avatar_male_1 from '../assets/avatars/avatar_male_1.png';
import avatar_male_2 from '../assets/avatars/avatar_male_2.png';
import avatar_male_3 from '../assets/avatars/avatar_male_3.png';
import avatar_male_4 from '../assets/avatars/avatar_male_4.png';
import avatar_female_1 from '../assets/avatars/avatar_female_1.png';
import avatar_female_2 from '../assets/avatars/avatar_female_2.png';
import avatar_female_3 from '../assets/avatars/avatar_female_3.png';
import avatar_female_4 from '../assets/avatars/avatar_female_4.png';

// Avatars Map
const avatarMap = {
  1: avatar_male_1,
  2: avatar_male_2,
  3: avatar_male_3,
  4: avatar_male_4,
  5: avatar_female_1,
  6: avatar_female_2,
  7: avatar_female_3,
  8: avatar_female_4
};

// Helper to safely get avatar key
const getUserAvatar = (user) => {
  if (user.avatar_id && avatarMap[user.avatar_id]) {
    return avatarMap[user.avatar_id];
  }
  // Fallback: Deterministic assignment based on name
  let hash = 0;
  for (let i = 0; i < user.name.length; i++) {
    hash = user.name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Map hash to 1-8
  const id = (Math.abs(hash) % 8) + 1;
  return avatarMap[id];
};

const UserManagement = () => {
  const { users, addUser, removeUser, updateUser, isAdmin, logout } = useUsers();
  const [newUserFirstname, setNewUserFirstname] = useState('');
  const [newUserLastname, setNewUserLastname] = useState('');
  const [newUserColor, setNewUserColor] = useState('#3b82f6');
  const [newUserAvatar, setNewUserAvatar] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editFirstname, setEditFirstname] = useState('');
  const [editLastname, setEditLastname] = useState('');
  const [editColor, setEditColor] = useState('#000000');
  const [editAvatar, setEditAvatar] = useState(1);

  const handleAddUser = (e) => {
    e.preventDefault();
    if (newUserFirstname.trim() && newUserLastname.trim()) {
      addUser(newUserFirstname, newUserLastname, newUserColor, newUserAvatar);
      setNewUserFirstname('');
      setNewUserLastname('');
      setNewUserAvatar(1);
      setIsAdding(false);
    }
  };

  const startEditing = (user) => {
    setEditingUser(user);
    setEditFirstname(user.firstname || user.name.split(' ')[0] || '');
    setEditLastname(user.lastname || user.name.split(' ').slice(1).join(' ') || '');
    setEditColor(user.color || '#3b82f6');
    setEditAvatar(user.avatar_id || 1);
    setIsAdding(false);
  };

  const saveEditing = () => {
    if (editFirstname.trim() && editLastname.trim()) {
      updateUser(editingUser, editFirstname.trim(), editLastname.trim(), editColor, editAvatar);
    }
    setEditingUser(null);
  };

  const handleDelete = (user) => {
    if (window.confirm(`Möchtest du "${user.name}" und ALLE zugehörigen Daten löschen?`)) {
      removeUser(user);
    }
  };

  return (
    <div className="user-management-section">
      <div className="section-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h2><Users size={24} className="icon-main" /> Team verwalten</h2>
            <p>Verwalte Mitarbeiter und deren Profile.</p>
          </div>
          <button onClick={logout} className="logout-btn" style={{ alignSelf: 'flex-start' }}>
            <LogOut size={18} /> Abmelden
          </button>
        </div>
      </div>

      <div className="user-grid">
        {users.map(u => {
          const isEditing = editingUser?.name === u.name;
          const avatar = getUserAvatar(u);

          return (
            <div key={u.name} className={`user-card ${isEditing ? 'editing' : ''}`} style={{ '--user-color': u.color }}>
              {isEditing ? (
                <div className="card-edit-form">
                  <div className="avatar-selector-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(id => (
                      <div
                        key={id}
                        className={`avatar-option ${editAvatar === id ? 'selected' : ''}`}
                        onClick={() => setEditAvatar(id)}
                      >
                        <img src={avatarMap[id]} alt="avatar" />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Vorname"
                      value={editFirstname}
                      onChange={(e) => setEditFirstname(e.target.value)}
                      autoFocus
                      className="edit-name-input"
                    />
                    <input
                      type="text"
                      placeholder="Nachname"
                      value={editLastname}
                      onChange={(e) => setEditLastname(e.target.value)}
                      className="edit-name-input"
                    />
                  </div>
                  <div className="color-picker-wrapper">
                    <label>Farbe:</label>
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                    />
                  </div>
                  <div className="edit-actions">
                    <button onClick={saveEditing} className="save-btn"><Check size={16} /> Speichern</button>
                    <button onClick={() => setEditingUser(null)} className="cancel-btn"><X size={16} /> Abbrechen</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="card-header-color" style={{ background: u.color }}></div>
                  <div className="avatar-wrapper">
                    <img src={avatar} alt={u.name} className="avatar-img" />
                  </div>
                  <div className="user-info">
                    <h3>{u.name}</h3>
                    <div className="user-stats-badge">Mitarbeiter</div>
                  </div>
                  <div className="card-actions-footer">
                    {isAdmin && (
                      <>
                        <button onClick={() => startEditing(u)} className="footer-btn edit">
                          <Pencil size={16} /> Bearbeiten
                        </button>
                        <button onClick={() => handleDelete(u)} className="footer-btn delete">
                          <Trash2 size={16} /> Löschen
                        </button>
                      </>
                    )}
                    {!isAdmin && (
                      <div className="footer-no-access">Nur Lesen</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Add User Card */}
        {/* Add User Card - Only for Admins */}
        {isAdmin && (
          isAdding ? (
            <div className="user-card add-card-active">
              <h3>Neuer Benutzer</h3>
              {/* ... form content ... */}
              <form onSubmit={handleAddUser} className="add-form">
                <div className="avatar-selector-grid">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(id => (
                    <div
                      key={id}
                      className={`avatar-option ${newUserAvatar === id ? 'selected' : ''}`}
                      onClick={() => setNewUserAvatar(id)}
                    >
                      <img src={avatarMap[id]} alt="avatar" />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Vorname..."
                    value={newUserFirstname}
                    onChange={(e) => setNewUserFirstname(e.target.value)}
                    autoFocus
                    className="add-input"
                  />
                  <input
                    type="text"
                    placeholder="Nachname..."
                    value={newUserLastname}
                    onChange={(e) => setNewUserLastname(e.target.value)}
                    className="add-input"
                  />
                </div>
                <div className="color-picker-row">
                  <span>Farbe wählen:</span>
                  <input
                    type="color"
                    value={newUserColor}
                    onChange={(e) => setNewUserColor(e.target.value)}
                  />
                </div>
                <div className="add-actions">
                  <button type="submit" className="confirm-add-btn" disabled={!newUserFirstname.trim() || !newUserLastname.trim()}>Erstellen</button>
                  <button type="button" onClick={() => setIsAdding(false)} className="cancel-add-btn">Abbrechen</button>
                </div>
              </form>
            </div>
          ) : (
            <button className="user-card add-card-btn" onClick={() => setIsAdding(true)}>
              <div className="add-icon-circle">
                <Plus size={32} />
              </div>
              <span>Benutzer hinzufügen</span>
            </button>
          )
        )}
      </div>

      <style>{`
        .user-management-section {
            padding: 1rem 0;
        }
        .section-header {
            margin-bottom: 2rem;
        }
        .section-header h2 {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 0.5rem;
            color: var(--color-text-main);
        }
        .section-header p {
            color: var(--color-text-muted);
            margin-left: 36px;
        }
        .icon-main {
            color: var(--color-primary);
        }

        .user-grid {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        /* User Card */
        .user-card {
            background: white;
            border-radius: 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            border: 1px solid transparent;
            min-height: 260px;
        }

        .user-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border-color: rgba(var(--color-primary-rgb), 0.1);
        }

        .card-header-color {
            height: 80px;
            width: 100%;
            opacity: 0.8;
        }

        .avatar-wrapper {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: white;
            padding: 4px;
            margin-top: -50px;
            z-index: 10;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .avatar-img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            background: #f8fafc;
        }

        .user-info {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
            flex: 1;
        }

        .user-info h3 {
            margin: 0;
            font-size: 1.25rem;
            color: var(--color-text-main);
            font-weight: 700;
        }

        .user-stats-badge {
            font-size: 0.8rem;
            color: var(--color-text-muted);
            background: #f1f5f9;
            padding: 4px 12px;
            border-radius: 20px;
        }

        /* Footer Actions */
        .card-actions-footer {
            width: 100%;
            display: flex;
            flex-direction: column; /* Stack buttons */
            border-top: 1px solid var(--color-border);
            margin-top: auto;
        }

        .footer-btn {
            width: 100%;
            background: none;
            border: none;
            padding: 12px;
            font-size: 1rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            transition: background 0.2s;
            color: var(--color-text-muted);
        }

        .footer-btn:first-child {
            border-right: none;
            border-bottom: 1px solid var(--color-border);
        }

        .footer-btn:hover {
            background: #f8fafc;
        }

        .footer-btn.edit:hover {
            color: var(--color-primary);
            background: #eff6ff;
        }

        .footer-btn.delete:hover {
            color: #ef4444;
            background: #fef2f2;
        }

        /* Add Card Button */
        .add-card-btn {
            background: #f8fafc;
            border: 2px dashed #cbd5e1;
            cursor: pointer;
            justify-content: center;
            gap: 16px;
            box-shadow: none;
        }
        .add-card-btn:hover {
            background: #f1f5f9;
            border-color: var(--color-primary);
            color: var(--color-primary);
            transform: translateY(-2px);
        }
        .add-icon-circle {
            background: white;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: inherit;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .add-card-btn span {
            font-weight: 600;
            font-size: 1.1rem;
            color: inherit;
        }

        /* Editing / Active Add Styling */
        .card-edit-form, .add-form {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            padding: 20px;
            gap: 16px;
            justify-content: center;
        }
        
        .avatar-selector-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 12px;
            justify-items: center;
        }

        .avatar-option {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent; /* default border */
            opacity: 0.6;
            transition: all 0.2s;
            padding: 2px;
        }

        .avatar-option img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
        }

        .avatar-option:hover {
            opacity: 0.9;
            transform: scale(1.05);
        }

        .avatar-option.selected {
            opacity: 1;
            transform: scale(1.15);
            border-color: var(--color-primary);
            box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
        }

        .edit-name-input, .add-input {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--color-border);
            border-radius: 8px;
            font-size: 1rem;
            text-align: center;
        }
        .edit-name-input:focus, .add-input:focus {
            border-color: var(--color-primary);
            outline: none;
        }

        .color-picker-wrapper, .color-picker-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            font-size: 0.9rem;
            color: var(--color-text-muted);
        }

        .edit-actions, .add-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 8px;
        }

        .save-btn, .confirm-add-btn {
            background: var(--color-primary);
            color: white;
            border: none;
            padding: 10px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .cancel-btn, .cancel-add-btn {
            background: transparent;
            color: var(--color-text-muted);
            border: 1px solid var(--color-border);
            padding: 10px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .add-card-active {
            border: 2px solid var(--color-primary);
            box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.1);
        }

        .logout-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border: 1px solid var(--color-border);
            border-radius: 8px;
            background: white;
            color: var(--color-text-muted);
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }
        .logout-btn:hover {
            border-color: #ef4444;
            color: #ef4444;
            background: #fef2f2;
        }
        
        .footer-no-access {
            flex: 1;
            padding: 12px;
            text-align: center;
            color: var(--color-text-muted);
            font-size: 0.8rem;
            background: #f8fafc;
        }
      `}</style>
    </div>
  );
};

export default UserManagement;
