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



      <div className="table-responsive">
        <table className="order-table" ref={tableRef}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th> {/* Info Icon */}
              <th>Nr.</th>
              <th className="text-right">Menge</th>
              <th className="text-right">Wert</th>
              <th>Liefertermin</th>
              <th>Firma</th>
              <th style={{ width: '40px' }}></th> {/* Delete Action */}
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map(order => {
                const userColor = getUserColor(order.user);
                return (
                  <tr key={order.id}>
                    <td>
                      <button
                        className="icon-btn info-btn"
                        onClick={() => setSelectedOrder(order)}
                        title="Verlauf anzeigen"
                        style={{ color: '#3b82f6' }}
                      >
                        <Info size={18} />
                      </button>
                    </td>
                    <td className="font-mono">{order.id}</td>
                    <td className="text-right">{order.quantity}</td>
                    <td className="text-right">
                      {Math.round(order.value || 0).toLocaleString('de-DE')}
                    </td>
                    <td>{formatDate(order.delivery_date || order.date)}</td>
                    <td><span className="truncate-text">{order.company}</span></td>
                    <td className="actions-cell">
                      <button
                        className="icon-btn delete-btn"
                        onClick={() => handleDelete(order.db_id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="empty-state">
                  <AlertOctagon size={48} className="text-muted" />
                  <p>Noch keine Aufträge vorhanden.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .search-export-group {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                    flex-wrap: wrap;
                }
                .search-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .search-input {
                    padding: 0.5rem 1rem 0.5rem 2.5rem;
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    font-size: 0.9rem;
                    width: 200px;
                }
                .search-icon {
                    position: absolute;
                    left: 0.75rem;
                    color: var(--color-text-muted);
                }
                .export-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: white;
                    border: 1px solid var(--color-border);
                    border-radius: 6px;
                    font-size: 0.9rem;
                    cursor: pointer;
                    color: var(--color-text-main);
                    transition: background-color 0.2s;
                }
                .export-btn:hover {
                    background-color: var(--color-background-light);
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
