import { useState, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useUsers } from '../context/UserContext';
import { PlusCircle } from 'lucide-react';

const OrderForm = () => {
    const { addOrder } = useOrders();
    const { users } = useUsers();
    const [formData, setFormData] = useState({
        id: '',
        value: '',
        date: new Date().toISOString().split('T')[0],
        user: '',
        company: '',
        quantity: '',
        delivery_date: ''
    });

    // Set default user when users load
    useEffect(() => {
        if (users.length > 0 && !formData.user) {
            setFormData(prev => ({ ...prev, user: users[0].name }));
        }
    }, [users]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.id || !formData.value || !formData.user) return;

        const success = await addOrder({
            id: formData.id,
            value: parseFloat(formData.value),
            date: formData.date,
            user: formData.user,
            company: formData.company,
            quantity: formData.quantity,
            delivery_date: formData.delivery_date
        });

        if (success) {
            setFormData({
                id: '',
                value: '',
                date: new Date().toISOString().split('T')[0],
                user: users[0]?.name || '',
                company: '',
                quantity: '',
                delivery_date: ''
            });
        }
    };

    return (
        <div className="card">
            <h2><PlusCircle size={20} style={{ display: 'inline', marginBottom: '-2px' }} /> Neuer Auftrag</h2>
            <form onSubmit={handleSubmit} className="order-form">
                <div className="form-group full-width">
                    <label>Firma</label>
                    <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Kundenname..."
                    />
                </div>

                <div className="form-group">
                    <label>Auftrags-Nr. *</label>
                    <input
                        type="text"
                        value={formData.id}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        placeholder="z.B. A-2025-001"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Menge</label>
                    <input
                        type="text"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="z.B. 10 Stk"
                    />
                </div>

                <div className="form-group">
                    <label>Wert (€) *</label>
                    <input
                        type="number"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        placeholder="0.00"
                        step="0.01"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Datum</label>
                    <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Lieferdatum</label>
                    <input
                        type="date"
                        value={formData.delivery_date}
                        onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                    />
                </div>

                <div className="form-group full-width">
                    <label>Benutzer *</label>
                    <select
                        value={formData.user}
                        onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                        required
                    >
                        {users.map(u => (
                            <option key={u.name} value={u.name}>{u.name}</option>
                        ))}
                    </select>
                </div>

                <button type="submit" className="submit-btn">Hinzufügen</button>
            </form>
            <style>{`
        .card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: var(--shadow-md);
          margin-bottom: 2rem;
        }
        .order-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        @media (min-width: 600px) {
          .order-form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            align-items: start;
          }
           .full-width {
            grid-column: 1 / -1;
          }
           .submit-btn {
             grid-column: 1 / -1;
             margin-top: 1rem;
           }
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-muted);
        }
        input, select {
          padding: 0.6rem;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          font-size: 1rem;
        }
        .submit-btn {
          height: 44px;
          background: var(--color-primary);
          color: white;
          border: none;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
        }
        .submit-btn:hover {
            background-color: #4338ca;
        }
      `}</style>
        </div>
    );
};

export default OrderForm;
