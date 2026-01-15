import { useState, useRef } from 'react';
import { useOrders } from '../context/OrderContext';
import { useUsers } from '../context/UserContext';
import { Download, Search, Trash2, AlertOctagon, Info } from 'lucide-react';
import { saveAs } from 'file-saver';
import OrderDetailsModal from './OrderDetailsModal';

const OrderList = () => {
  const { orders, removeOrder, isLoading } = useOrders();
  const { users } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const tableRef = useRef(null);




  // Filter logic
  const filteredOrders = orders.filter(order => {
    // Safety check for properties
    const safeId = order.id || '';
    const safeUser = order.user || '';
    return safeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      safeUser.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => {
    // Safe sort
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  // Handle Delete
  const handleDelete = async (id) => {
    if (window.confirm('Möchtest du diesen Auftrag wirklich löschen?')) {
      await removeOrder(id);
    }
  };

  // Helper: Format Date DD.MM.YY
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return ''; // Invalid date
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  const handleExport = () => {
    if (orders.length === 0) {
      alert("Keine Daten zum Exportieren");
      return;
    }

    let csvContent = "Auftrags-Nr.;Datum;Firma;Menge;Wert;Benutzer;Lieferdatum\n";

    filteredOrders.forEach(order => {
      const row = [
        order.id,
        formatDate(order.date),
        order.company || '',
        order.quantity || '',
        order.value.toFixed(2).replace('.', ','),
        order.user,
        formatDate(order.delivery_date)
      ].join(";");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "auftraege_export.csv");
  };

  const getUserColor = (userName) => {
    const user = users.find(u => u.name === userName);
    return user ? user.color : '#e2e8f0';
  };

  return (
    <div className="card">
      <div className="list-header">
        <h2>Auftragsliste ({filteredOrders.length})</h2>
        <div className="search-export-group">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={handleExport} className="export-btn">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>



      <div className="order-cards-list">
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <div key={order.id} className="order-mobile-card" onClick={() => setSelectedOrder(order)}>
              <div className="order-card-header">
                <span className="order-nr">#{order.id}</span>
                <span className="order-date">{formatDate(order.delivery_date || order.date)}</span>
              </div>
              <div className="order-card-body">
                <div className="order-company-name">{order.company}</div>
                <div className="order-stats-row">
                  <div className="stat-pill">
                    <span className="stat-label">Menge:</span>
                    <span className="stat-value">{order.quantity}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Wert:</span>
                    <span className="stat-value">{Math.round(order.value || 0).toLocaleString('de-DE')} €</span>
                  </div>
                </div>
              </div>
              <div className="order-card-footer">
                <button
                  className="card-action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(order.db_id);
                  }}
                >
                  <Trash2 size={16} /> Löschen
                </button>
                <div className="view-details-hint">Details anzeigen <Info size={14} /></div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <AlertOctagon size={48} className="text-muted" />
            <p>Noch keine Aufträge vorhanden.</p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      <style>{`
                .card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: var(--shadow-md);
                    padding: 1.5rem;
                    overflow: hidden;
                }
                .status-badge-sm {
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    white-space: nowrap;
                    font-weight: 600;
                }
                .status-erfasst { background: #e0f2fe; color: #0284c7; }
                .status-in-bearbeitung { background: #fef3c7; color: #d97706; }
                .status-beendet { background: #dcfce7; color: #16a34a; }

                .list-header {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .search-export-group {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .search-input-wrapper {
                    width: 100%;
                }
                .search-input {
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border: 1px solid var(--color-border);
                    border-radius: 10px;
                    font-size: 1rem;
                    width: 100%;
                    background: #f8fafc;
                }
                .export-btn {
                    width: 100%;
                    justify-content: center;
                    padding: 0.75rem;
                    background: #f1f5f9;
                    border: 1px solid var(--color-border);
                    border-radius: 10px;
                    font-weight: 600;
                }

                /* Order Card Layout */
                .order-cards-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .order-mobile-card {
                    background: white;
                    border: 1px solid var(--color-border);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                .order-card-header {
                    background: #f8fafc;
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--color-border);
                }
                .order-nr {
                    font-family: monospace;
                    font-weight: 700;
                    color: var(--color-primary);
                    font-size: 1rem;
                }
                .order-date {
                    font-size: 0.85rem;
                    color: var(--color-text-muted);
                }
                .order-card-body {
                    padding: 16px;
                }
                .order-company-name {
                    font-weight: 700;
                    font-size: 1.1rem;
                    margin-bottom: 12px;
                    color: var(--color-text-main);
                }
                .order-stats-row {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .stat-pill {
                    width: 100%;
                    background: #f1f5f9;
                    padding: 10px;
                    border-radius: 10px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }
                .stat-label {
                    font-size: 0.7rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .stat-value {
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: var(--color-text-main);
                }
                .order-card-footer {
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: white;
                    border-top: 1px dashed var(--color-border);
                }
                .card-action-btn {
                    border: none;
                    background: none;
                    font-weight: 600;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                }
                .card-action-btn.delete { color: #ef4444; }
                .view-details-hint {
                    font-size: 0.85rem;
                    color: var(--color-primary);
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-weight: 500;
                }
                .table-responsive {
                    overflow-x: auto;
                }
                .order-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.95rem;
                }
                .order-table th {
                    text-align: left;
                    padding: 1rem 0.5rem;
                    border-bottom: 2px solid var(--color-border);
                    color: var(--color-text-muted);
                    font-weight: 600;
                    white-space: nowrap;
                }
                .order-table td {
                    padding: 1rem 0.5rem;
                    border-bottom: 1px solid var(--color-border);
                    color: var(--color-text-main);
                }
                .text-right { text-align: right; }
                .font-mono { font-family: monospace; letter-spacing: -0.5px; }
                .font-bold { font-weight: 600; }
                
                .user-badge {
                    padding: 0.25rem 0.75rem;
                    border-radius: 999px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    white-space: nowrap;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem !important;
                    color: var(--color-text-muted);
                }
                .empty-state p { margin-top: 1rem; }

                .truncate-text {
                    display: inline-block;
                    max-width: 120px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    vertical-align: middle;
                }
                
                .actions-cell {
                    text-align: right;
                }

                .icon-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }

                .delete-btn {
                    color: #ef4444; /* Red-500 */
                }
                .delete-btn:hover {
                    background-color: #fee2e2;
                }
            `}</style>
    </div>
  );
};

export default OrderList;
