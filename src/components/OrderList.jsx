import { useState, useRef, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useUsers } from '../context/UserContext';
import { Download, Search, Trash2, AlertOctagon, Info, FileText, Pencil, Save, X, ImageIcon, ClipboardList, Play, Hammer, Truck, Check, ChevronDown, ChevronUp, Wrench, FileSpreadsheet, ClipboardCheck, Settings2, Factory, Package } from 'lucide-react';
import { saveAs } from 'file-saver';
import ArticleDetailsModal from './ArticleDetailsModal';
import OrderDetailsModal from './OrderDetailsModal';
import WorkSessionModal from './WorkSessionModal';
import { pb } from '../lib/pocketbase';
import { getArticles, getAppSetting, saveAppSetting, updateWorkLog, deleteWorkLog } from '../services/storage';


const STATUS_FLOW = {
  'open': { label: 'Offen', next: 'in_progress', icon: Play, color: '#f59e0b', bg: '#fef3c7' }, // Amber
  'in_progress': { label: 'In Bearbeitung', next: 'done', icon: Hammer, color: '#3b82f6', bg: '#dbeafe' }, // Blue
  'done': { label: 'Gefertigt', next: 'delivered', icon: Truck, color: '#8b5cf6', bg: '#ede9fe' }, // Violet
  'delivered': { label: 'Ausgeliefert', next: 'open', icon: Check, color: '#10b981', bg: '#d1fae5' } // Emerald
};

const OrderList = () => {
  const { orders, removeOrder, updateOrder, fetchOrders } = useOrders();
  const { users } = useUsers();

  // Article Lookup Logic
  const [articles, setArticles] = useState([]);
  useEffect(() => {
    const loadArticles = async () => {
      const allArticles = await getArticles();
      setArticles(allArticles);
    };
    loadArticles();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null); // ID of order being edited
  const [editForm, setEditForm] = useState({});
  const [activeOrderForSession, setActiveOrderForSession] = useState(null);
  const [workSteps, setWorkSteps] = useState([]);
  const [workStepsConfig, setWorkStepsConfig] = useState(null); // Full tree structure
  const [expandedStepsOrder, setExpandedStepsOrder] = useState(null); // Which order has steps expanded
  const [editingStep, setEditingStep] = useState(null); // { orderId, stepId }
  const [stepEditMinutes, setStepEditMinutes] = useState(0);

  // Load work steps from DB or defaults
  useEffect(() => {
    loadWorkSteps();
  }, []);

  const loadWorkSteps = async () => {
    try {
      // Fallback defaults with icons, NO 'Angebot'
      const DEFAULT_STEPS = [
        { id: 'order', name: 'Auftrag', minutes: 0, icon: 'ClipboardCheck' },
        { id: 'prep', name: 'Vorbereitung', minutes: 15, icon: 'Settings2' },
        { id: 'prod', name: 'Fertigung', minutes: 0, icon: 'Factory' },
        { id: 'delivery', name: 'Lieferung', minutes: 0, icon: 'Package' },
      ];

      const config = await getAppSetting('work_steps_config', DEFAULT_STEPS);
      setWorkStepsConfig(config);

      // Icon mapping helper
      const ICON_MAP = {
        'offer': 'FileSpreadsheet',
        'order': 'ClipboardCheck',
        'delivery_note': 'FileText',
        'prep': 'Settings2',
        'prod': 'Factory',
        'delivery': 'Package'
      };

      // Flatten structure for list display
      const flatSteps = [];
      const traverse = (items) => {
        if (!items) return;
        items.forEach(item => {
          if (item.type === 'group' && item.children) {
            traverse(item.children);
          } else {
            // Ensure icon
            const icon = item.icon || ICON_MAP[item.id] || 'Wrench';
            flatSteps.push({ ...item, icon });
          }
        });
      };
      traverse(config);
      setWorkSteps(flatSteps);
    } catch (e) {
      console.log("Loading work steps failed", e);
    }
  };

  // Icon mapping for work steps
  const STEP_ICONS = {
    'FileSpreadsheet': FileSpreadsheet,
    'ClipboardCheck': ClipboardCheck,
    'Settings2': Settings2,
    'Factory': Factory,
    'Package': Package,
    'Wrench': Wrench,
  };

  const getStepIcon = (iconName) => {
    return STEP_ICONS[iconName] || Wrench;
  };

  const toggleStepsExpanded = (e, orderId) => {
    e.stopPropagation();
    setExpandedStepsOrder(prev => prev === orderId ? null : orderId);
  };

  /* 
   * NEW: Work Log (Time Entry) Edit Logic 
   */
  const [editingLogId, setEditingLogId] = useState(null);
  const [logEditMinutes, setLogEditMinutes] = useState(0);

  const handleEditLog = (e, log) => {
    e.stopPropagation();
    setEditingLogId(log.id);
    setLogEditMinutes(log.duration_minutes || 0);
  };

  const handleSaveLog = async (e, logId) => {
    e.stopPropagation();
    try {
      await updateWorkLog(logId, { duration_minutes: parseInt(logEditMinutes) || 0 });
      setEditingLogId(null);
      await fetchOrders();
    } catch (err) {
      console.error('Failed to update log', err);
      alert("Fehler beim Speichern");
    }
  };

  const handleDeleteLog = async (e, logId, orderId) => {
    e.stopPropagation();
    if (!confirm('Zeit-Eintrag wirklich löschen?')) return;

    try {
      const success = await deleteWorkLog(logId);
      if (success) {
        await fetchOrders();
      } else {
        alert("Fehler beim Löschen: Eintrag konnte nicht entfernt werden.");
      }
    } catch (err) {
      console.error('Failed to delete log', err);
      alert("Fehler beim Löschen");
    }
  };

  // Keep old config handlers for now or remove if obsolete?
  // User asked for "Arbeitsgänge müssen bearbeitbar sein", meaning the logs.
  // The old config code (lines 115-184) was for the Global Config template. 
  // We can leave it or comment it out. I'll leave safely but not use it for logs.
  const handleEditStepConfig = (e, orderId, step) => {
    e.stopPropagation();
    setEditingStep({ orderId, stepId: step.id });
    setStepEditMinutes(step.minutes || 0);
  };

  // Filter logic
  const filteredOrders = orders.filter(order => {
    const safeId = order.id || '';
    const safeUser = order.user || '';
    return safeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      safeUser.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Delete Handlers
  const handleDeleteRequest = (order) => {
    setDeleteConfirmation(order);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const success = await removeOrder(deleteConfirmation.id);
    if (success) setDeleteConfirmation(null);
    else alert("Fehler beim Löschen.");
  };

  // Edit Handlers
  const startEditing = (order) => {
    setEditingOrder(order.id);
    setEditForm({
      company: order.company,
      quantity: order.quantity,
      value: order.value,
      delivery_date: order.delivery_date ? new Date(order.delivery_date).toISOString().split('T')[0] : ''
    });
  };

  const cancelEditing = () => {
    setEditingOrder(null);
    setEditForm({});
  };

  const saveEditing = async (id) => {
    try {
      await updateOrder(id, editForm);
      setEditingOrder(null);
    } catch (error) {
      console.error("Failed to update order:", error);
      alert("Fehler beim Speichern der Änderungen.");
    }
  };

  // Status Handler
  const handleStatusCycle = async (e, order) => {
    e.stopPropagation();
    const currentStatus = order.status || 'open';
    const nextStatusKey = STATUS_FLOW[currentStatus]?.next || 'open';

    try {
      await updateOrder(order.id, { status: nextStatusKey });
    } catch (error) {
      console.error("Failed to update status:", error);
      // alert("Fehler beim Status-Update."); // Optional: silent fail or notify
    }
  };

  // Export Logic
  const handleExport = () => {
    if (orders.length === 0) {
      alert("Keine Daten zum Exportieren");
      return;
    }
    let csvContent = "Auftrags-Nr.;Datum;Firma;Menge;Wert;Benutzer;Lieferdatum;Status\n";
    filteredOrders.forEach(order => {
      const statusLabel = STATUS_FLOW[order.status || 'open']?.label || 'Offen';
      const row = [
        order.id,
        new Date(order.date).toLocaleDateString('de-DE'),
        order.company || '',
        order.quantity || '',
        (order.value || 0).toFixed(2).replace('.', ','),
        order.user,
        order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('de-DE') : '',
        statusLabel
      ].join(";");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "auftraege_export.csv");
  };

  // Helper: Get Image URL
  const getImageUrl = (order) => {
    // 1. Try expand
    if (order.expand?.article_id?.image) {
      return pb.files.getUrl(order.expand.article_id, order.expand.article_id.image);
    }

    // 2. Try lookup by string ID
    if (order.article_id && articles.length > 0) {
      const art = articles.find(a => a.article_id === order.article_id);
      if (art && art.image) {
        return pb.files.getUrl(art, art.image);
      }
    }

    return null;
  };

  // Helper: Get PDF URL
  const getPdfUrl = (order) => {
    if (order.original_pdf) {
      return pb.files.getUrl({ id: order.db_id, collectionName: 'orders' }, order.original_pdf);
    }
    return null;
  }

  return (
    <div className="article-list-section">
      {/* Header Section (Matching ArticleList) */}
      <div className="section-header">
        <div>
          <h2><ClipboardList size={24} className="icon-main" /> Auftrags-Cockpit</h2>
          <p>Verwaltung der laufenden und abgeschlossenen Aufträge</p>
        </div>
      </div>

      {/* Actions Section (Matching ArticleList) */}
      <div className="search-actions-container">
        <button onClick={handleExport} className="create-btn-full">
          <Download size={20} /> Liste exportieren
        </button>
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Aufträge suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="articles-grid">
        {filteredOrders.map(order => {
          const isEditing = editingOrder === order.id;
          const imgUrl = getImageUrl(order);
          const pdfUrl = getPdfUrl(order);

          const currentStatusKey = order.status || 'open';
          const statusConfig = STATUS_FLOW[currentStatusKey] || STATUS_FLOW['open'];
          const StatusIcon = statusConfig.icon;

          return (
            <div key={order.id} className={`article-card ${isEditing ? 'editing' : ''}`} onClick={() => !isEditing && setSelectedOrder(order)}>
              {/* Corner Buttons */}
              {isEditing ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); saveEditing(order.id); }} className="corner-btn edit-corner" title="Speichern">
                    <Save size={24} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); cancelEditing(); }} className="corner-btn delete-corner" title="Abbrechen" style={{ background: '#94a3b8 !important' }}>
                    <X size={24} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={(e) => { e.stopPropagation(); startEditing(order); }} className="corner-btn edit-corner" title="Bearbeiten">
                    <Pencil size={24} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(order); }} className="corner-btn delete-corner" title="Löschen">
                    <Trash2 size={24} />
                  </button>
                </>
              )}

              {/* Preview Image */}
              <div className="card-preview">
                {imgUrl ? (
                  <img src={imgUrl} alt="Artikel" className="preview-img" />
                ) : (
                  <div className="no-image">
                    <ImageIcon size={48} strokeWidth={1} />
                  </div>
                )}
              </div>

              {/* Status Play Button - Absolute in Card now */}
              {!isEditing && (
                <button
                  className="status-cycle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log("Play button clicked", order);
                    alert("Button Clicked: " + order.id);
                    setActiveOrderForSession(order);
                  }}
                  onMouseDown={(e) => {
                    console.log("Mouse Down on button", order.id);
                  }}
                  style={{ backgroundColor: statusConfig.color, zIndex: 10, cursor: 'pointer', pointerEvents: 'auto' }}
                  title="Arbeit starten / Status ändern"
                >
                  <StatusIcon size={27} strokeWidth={2.5} color="white" />
                </button>
              )}

              <div className="article-content">
                {/* Header Row: ID + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <h3 className="article-title" style={{ margin: 0 }}>{order.id}</h3>
                  <div className="status-indicator" style={{ marginBottom: 0 }}>
                    <span className="status-dot" style={{ background: statusConfig.color }}></span>
                    {statusConfig.label}
                  </div>
                </div>
                {isEditing ? (
                  <div className="edit-form-grid" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editForm.company || ''}
                      onChange={e => setEditForm({ ...editForm, company: e.target.value })}
                      placeholder="Firma"
                      className="edit-input"
                    />
                    <div className="edit-row">
                      <input
                        type="number"
                        value={editForm.quantity}
                        onChange={e => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                        className="edit-input"
                        placeholder="Menge"
                      />
                      <input
                        type="number"
                        value={editForm.value}
                        onChange={e => setEditForm({ ...editForm, value: parseFloat(e.target.value) || 0 })}
                        className="edit-input"
                        placeholder="Wert"
                      />
                    </div>
                    <input
                      type="date"
                      value={editForm.delivery_date}
                      onChange={e => setEditForm({ ...editForm, delivery_date: e.target.value })}
                      className="edit-input"
                    />
                  </div>
                ) : (
                  <>
                    <div className="article-subtitle">{order.company}</div>

                    {/* Description Lookup */}
                    {(() => {
                      const desc = order.expand?.article_id?.name ||
                        (articles.find(a => a.article_id === order.article_id)?.name);
                      return desc && (
                        <div className="article-subtitle" style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                          {desc}
                        </div>
                      );
                    })()}

                    <div className="article-meta">
                      <span className="meta-price">{(order.value || 0).toFixed(2)} €</span>
                      <span className="meta-drawing">{order.quantity} St.</span>
                    </div>
                    <div className="article-meta-date" style={{ marginTop: '4px', fontSize: '0.8rem', color: '#64748b' }}>
                      Liefer: {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('de-DE') : '-'}
                    </div>
                  </>
                )}

                <div className="article-links" style={{ position: 'relative' }}>
                  {/* Status Play Button - Floating Above Article Link */}
                  {pdfUrl && (
                    <button
                      className="link-btn"
                      onClick={(e) => { e.stopPropagation(); window.open(pdfUrl, '_blank'); }}
                    >
                      <FileText size={16} /> Original
                    </button>
                  )}
                  {/* Link to Article */}
                  {order.expand?.article_id?.article_id || order.article_id ? (
                    <button
                      className="link-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const artId = order.expand?.article_id?.article_id || order.article_id;
                        if (artId) setSelectedArticleId(artId);
                      }}
                    >
                      <Info size={16} /> {order.expand?.article_id?.article_id || order.article_id}
                    </button>
                  ) : null}

                </div>

                {/* Work Steps Section (History) */}
                <div
                  className={`work-steps-section ${(!order.time_logs || order.time_logs.length === 0) ? 'empty-placeholder' : ''}`}
                  onClick={e => e.stopPropagation()}
                  style={(!order.time_logs || order.time_logs.length === 0) ? { opacity: 0.6, pointerEvents: 'none', background: '#f8fafc', border: '1px dashed #cbd5e1' } : {}}
                >
                  <div
                    className="work-steps-toggle"
                    style={{ cursor: (!order.time_logs || order.time_logs.length === 0) ? 'default' : 'pointer' }}
                    onClick={(e) => {
                      if (order.time_logs && order.time_logs.length > 0) toggleStepsExpanded(e, order.id);
                    }}
                  >
                    <Wrench size={16} style={(!order.time_logs || order.time_logs.length === 0) ? { color: '#94a3b8' } : {}} />
                    <span style={(!order.time_logs || order.time_logs.length === 0) ? { color: '#94a3b8' } : {}}>
                      Arbeitsgänge
                    </span>
                    <span className="count-badge" style={{ background: '#e2e8f0', color: '#64748b', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px' }}>
                      {order.time_logs ? order.time_logs.length : 0}
                    </span>

                    {order.time_logs && order.time_logs.length > 0 && (
                      expandedStepsOrder === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                    )}
                  </div>

                  {order.time_logs && order.time_logs.length > 0 && expandedStepsOrder === order.id && (
                    <div className="work-steps-list">
                      {order.time_logs.map(log => {
                        const stepName = log.expand?.work_step_id?.name || 'Unbekannt';
                        const isRunning = !log.end_time;
                        const isEditingLog = editingLogId === log.id;

                        return (
                          <div key={log.id} className="work-step-item" style={{ cursor: 'default' }}>

                            {/* Edit Mode */}
                            {isEditingLog ? (
                              <div className="step-edit-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <Wrench size={14} className="step-icon" />
                                <span className="step-name" style={{ flex: 1 }}>{stepName}</span>
                                <input
                                  type="number"
                                  value={logEditMinutes}
                                  onChange={(e) => setLogEditMinutes(e.target.value)}
                                  className="step-time-input"
                                  min="0"
                                  autoFocus
                                  style={{ width: '60px', padding: '2px 4px', fontSize: '0.85rem' }}
                                />
                                <span className="step-unit">m</span>
                                <button
                                  className="step-action-btn save"
                                  onClick={(e) => handleSaveLog(e, log.id)}
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  className="step-action-btn cancel"
                                  onClick={(e) => { e.stopPropagation(); setEditingLogId(null); }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              /* View Mode */
                              <>
                                <Wrench size={14} className="step-icon" />
                                <span className="step-name" style={{ flex: 1 }}>{stepName}</span>
                                <span className="step-minutes" style={{ marginRight: '8px' }}>
                                  {isRunning ? 'Läuft...' : (log.duration_minutes ? `${log.duration_minutes}m` : '0m')}
                                </span>

                                <div className="step-actions">
                                  <button
                                    className="step-action-btn edit"
                                    onClick={(e) => handleEditLog(e, log)}
                                    title="Zeit bearbeiten"
                                  >
                                    <Pencil size={10} />
                                  </button>
                                  <button
                                    className="step-action-btn delete"
                                    onClick={(e) => handleDeleteLog(e, log.id, order.id)}
                                    title="Eintrag löschen"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {deleteConfirmation && (
        <div className="delete-confirm-overlay" onClick={() => setDeleteConfirmation(null)}>
          <div className="delete-confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Auftrag löschen?</h3>
            <p>Soll der Auftrag {deleteConfirmation.id} wirklich gelöscht werden?</p>
            <div className="delete-actions">
              <button className="cancel-btn" onClick={() => setDeleteConfirmation(null)}>Abbrechen</button>
              <button className="confirm-btn" onClick={confirmDelete}>Löschen</button>
            </div>
          </div>
        </div>
      )}

      {selectedArticleId && (
        <ArticleDetailsModal
          articleId={selectedArticleId}
          onClose={() => setSelectedArticleId(null)}
        />
      )}

      {/* OrderDetailsModal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* WorkSessionModal */}
      {activeOrderForSession && (
        <WorkSessionModal
          order={activeOrderForSession}
          onClose={() => setActiveOrderForSession(null)}
        />
      )}


      <style>{`
                 /* Header Styles (Same as ArticleList) */
                .article-list-section {
                    padding: 20px;
                    padding-bottom: 80px; /* Spacer for fixed footer if any */
                }
                .section-header {
                   margin-bottom: 24px;
                   display: flex;
                   align-items: center;
                   justify-content: space-between;
                }
                .section-header h2 {
                   font-size: 1.5rem;
                   font-weight: 800;
                   color: var(--color-text-main);
                   margin: 0;
                   display: flex;
                   align-items: center;
                   gap: 12px;
                }
                 .icon-main {
                   color: var(--color-primary);
                }
                .section-header p {
                   margin: 4px 0 0 0;
                   color: var(--color-text-muted);
                   font-size: 0.95rem;
                }

                /* Search Actions Container (Vertical Stack) */
                .search-actions-container {
                   display: flex;
                   flex-direction: column;
                   gap: 12px;
                   margin-bottom: 24px;
                }

                .create-btn-full {
                   width: 100%;
                   padding: 14px;
                   background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); /* Indigo Gradient matching ArticleList */
                   color: white;
                   border: none;
                   border-radius: 12px;
                   font-weight: 600;
                   font-size: 1rem;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   gap: 10px;
                   cursor: pointer;
                   box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
                   transition: transform 0.2s, box-shadow 0.2s;
                }
                .create-btn-full:active {
                   transform: scale(0.98);
                }

                .search-bar {
                   position: relative;
                   width: 100%;
                }
                .search-icon {
                   position: absolute;
                   left: 14px;
                   top: 50%;
                   transform: translateY(-50%);
                   color: #94a3b8;
                }
                .search-bar input {
                   width: 100%;
                   padding: 12px 12px 12px 42px;
                   border: 1px solid #e2e8f0;
                   border-radius: 12px;
                   font-size: 1rem;
                   transition: all 0.2s;
                   box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                   box-sizing: border-box; /* IMPORTANT */
                }
                .search-bar input:focus {
                   outline: none;
                   border-color: var(--color-primary);
                   box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }

                /* Grid Layout */
                .articles-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); /* Match ArticleList */
                    gap: 16px;
                }

                /* Card Styles */
                .article-card {
                    background: white;
                    border-radius: 16px;
                    border: 1px solid var(--color-border);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: all 0.2s;
                    position: relative;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                .article-card:hover {
                    box-shadow: var(--shadow-md);
                    transform: translateY(-2px);
                }
                .article-card.editing {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
                }
                
                /* Preview Image */
                .card-preview {
                    height: 165px; 
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    overflow: hidden;
                    position: relative;
                    border-bottom: 1px solid #f1f5f9;
                }
                .preview-img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    padding: 8px; /* Added padding like ArticleList */
                }
                .no-image {
                    color: #cbd5e1;
                }

                /* Corner Buttons */
                .corner-btn {
                    position: absolute;
                    top: 12px;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 0 !important;
                    outline: none !important;
                    cursor: pointer;
                    color: white !important;
                    transition: all 0.2s;
                    z-index: 100;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.15);
                    padding: 0;
                    margin: 0;
                }
                .edit-corner {
                    left: 12px;
                    background: var(--color-primary) !important;
                }
                .edit-corner:hover {
                    background: #1d4ed8 !important; /* Hardcoded dark blue */
                    transform: scale(1.1);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.2);
                }
                .delete-corner {
                    right: 12px;
                    background: #ef4444 !important;
                }
                .delete-corner:hover {
                    background: #dc2626 !important; /* Hardcoded dark red */
                    transform: scale(1.1);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.2);
                }

                /* Content */
                .article-content {
                    padding: 16px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .article-title {
                    font-size: 1.1rem; /* Matched ArticleList (was 1.15rem) */
                    font-weight: 700;
                    color: var(--color-text-main);
                    margin: 0 0 4px 0;
                    line-height: 1.4;
                    word-break: break-all;
                }
                .article-subtitle {
                    font-size: 0.9rem;
                    color: var(--color-text-muted);
                    margin-bottom: 12px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                /* Status Indicator */
                .status-indicator {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-text-muted);
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .article-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    font-size: 0.8rem; /* Matched ArticleList (was 0.85rem) */
                    margin-bottom: 8px;
                }
                .meta-price {
                    background: #ecfdf5;
                    color: #059669;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-weight: 600;
                }
                .meta-drawing {
                    background: #f1f5f9;
                    color: var(--color-text-muted);
                    padding: 4px 10px;
                    border-radius: 20px;
                }
                
                /* Links/Footer */
                .article-links {
                    display: flex;
                    gap: 8px;
                    margin-top: auto;
                    padding-top: 12px;
                    position: relative; /* Context for floating status button */
                }
                
                .status-cycle-btn {
                    position: absolute;
                    top: 250px; /* Position lower, after company name area */
                    right: 16px;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 !important; /* Force no padding */
                    border: 0;
                    outline: none;
                    cursor: pointer;
                    z-index: 10; /* Lower than modal overlay */
                    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .status-cycle-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 14px rgba(0,0,0,0.2);
                }

                .link-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 8px 4px; /* Matched ArticleList (was 10px) */
                    border: 1px solid var(--color-border);
                    background: white;
                    border-radius: 8px;
                    color: var(--color-primary);
                    font-size: 0.8rem; /* Matched ArticleList (was 0.85rem) */
                    cursor: pointer;
                    transition: all 0.2s;
                    min-width: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .link-btn:hover {
                    background: #eff6ff;
                    border-color: var(--color-primary);
                }

                /* Edit Form */
                .edit-form-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .edit-row {
                    display: flex;
                    gap: 10px;
                }
                .edit-input {
                    padding: 8px 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    width: 100%;
                    box-sizing: border-box; 
                }
                .edit-input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
                }

                /* Delete Confirm Overlay (Reused) */
                .delete-confirm-overlay {
                    position: fixed; inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 2000; backdrop-filter: blur(4px);
                    animation: fadeIn 0.2s ease-out;
                }
                .delete-confirm-dialog {
                    background: white; padding: 2rem;
                    border-radius: 16px; width: 90%; max-width: 400px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                    text-align: center;
                }
                .delete-actions {
                    display: flex; gap: 1rem; margin-top: 1.5rem;
                }
                .cancel-btn, .confirm-btn {
                    flex: 1; padding: 0.75rem; border-radius: 8px;
                    font-weight: 600; cursor: pointer; border: none;
                }
                .cancel-btn { background: #f1f5f9; color: #64748b; }
                .confirm-btn { background: #ef4444; color: white; }

                /* Work Steps Section */
                .work-steps-section {
                    margin-top: 12px;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 10px;
                }
                .work-steps-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    color: #475569;
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .work-steps-toggle:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }
                .work-steps-toggle svg:last-child {
                    margin-left: auto;
                }
                .work-steps-list {
                    margin-top: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .work-step-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 3px 8px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    font-size: 0.8rem;
                }
                .step-icon {
                    color: #6366f1;
                    flex-shrink: 0;
                }
                .step-name {
                    flex: 1;
                    color: #334155;
                }
                .step-minutes {
                    font-size: 0.75rem;
                    color: #64748b;
                    background: #e2e8f0;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .step-actions {
                    display: flex;
                    gap: 4px;
                    margin-left: auto;
                }
                .step-action-btn {
                    padding: 4px 6px;
                    min-width: 24px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                }
                .step-action-btn.edit {
                    background: #e0e7ff;
                    color: #4f46e5;
                }
                .step-action-btn.edit:hover { background: #c7d2fe; }
                .step-action-btn.delete {
                    background: #fee2e2;
                    color: #dc2626;
                }
                .step-action-btn.delete:hover { background: #fecaca; }
                .step-action-btn.save {
                    background: #d1fae5;
                    color: #059669;
                }
                .step-action-btn.save:hover { background: #a7f3d0; }
                .step-action-btn.cancel {
                    background: #f1f5f9;
                    color: #64748b;
                }
                .step-action-btn.cancel:hover { background: #e2e8f0; }
                .step-edit-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    width: 100%;
                }
                .step-edit-input {
                    flex: 1;
                    padding: 4px 8px;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                    font-size: 0.85rem;
                }
                .step-edit-input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }
                .step-time-input {
                    width: 50px;
                    padding: 3px 6px;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                    font-size: 0.85rem;
                    text-align: right;
                }
                .step-time-input:focus {
                     outline: none;
                     border-color: var(--color-primary);
                }
                .step-unit {
                    font-size: 0.8rem;
                    color: #64748b;
                    min-width: 20px;
                }
            `}</style>
    </div>
  );
};

export default OrderList;
