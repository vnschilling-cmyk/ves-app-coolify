import { createContext, useContext, useState, useEffect } from 'react';
import { saveOrder, getOrders, deleteOrder, startWorkLog, stopWorkLog, getOpenWorkLog, updateOrderStatus } from '../services/storage';
import { pb } from '../lib/pocketbase';

const OrderContext = createContext();

export const OrderProvider = ({ children }) => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [activeSession, setActiveSession] = useState(null);

    // Initial Fetch
    const fetchOrders = async () => {
        setIsLoading(true);
        const data = await getOrders();
        // Map DB columns to App Model if different
        const mapped = data.map(o => ({
            id: o.order_id, // This is the "Auftrags-Nr"
            db_id: o.id,    // This is the UUID for deletion/status
            value: o.value,
            date: o.date,
            user: o.user_name,
            company: o.company,
            quantity: o.quantity,
            delivery_date: o.delivery_date,
            status: o.status || 'Erfasst'
        }));
        setOrders(mapped);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchOrders();

        // PocketBase Realtime
        pb.collection('orders').subscribe('*', function (e) {
            console.log('Realtime update:', e.action, e.record);
            // We can optimize by appending/updating state directly, but fetching all is safer/easier for now
            fetchOrders();
        });

        return () => {
            pb.collection('orders').unsubscribe('*');
        };
    }, []);

    const checkActiveSession = async (userName) => {
        if (!userName) return;
        const session = await getOpenWorkLog(userName);
        setActiveSession(session);
    };

    const startSession = async (orderId, userName) => {
        const session = await startWorkLog(orderId, userName);
        if (session) {
            setActiveSession(session);
            // Optimistically update order status
            setOrders(prev => prev.map(o =>
                o.db_id === orderId ? { ...o, status: 'In Bearbeitung' } : o
            ));
            return true;
        }
        return false;
    };

    const stopSession = async (quantity, isFinished) => {
        if (!activeSession) return false;

        const result = await stopWorkLog(activeSession.id, quantity);
        if (result) {
            if (isFinished) {
                await updateOrderStatus(activeSession.order_id, 'Beendet');
                // Optimistic update
                setOrders(prev => prev.map(o =>
                    o.db_id === activeSession.order_id ? { ...o, status: 'Beendet' } : o
                ));
            }
            setActiveSession(null);
            return true;
        }
        return false;
    };

    const addOrder = async (orderData) => {
        try {
            const newOrder = await saveOrder(orderData);
            if (newOrder) {
                // Optimistic Update for instant UI feedback
                const mappedOrder = {
                    id: newOrder.order_id,
                    db_id: newOrder.id,
                    value: newOrder.value,
                    date: newOrder.date,
                    user: newOrder.user_name,
                    company: newOrder.company,
                    quantity: newOrder.quantity,
                    delivery_date: newOrder.delivery_date,
                    status: newOrder.status || 'Erfasst'
                };

                setOrders(prev => [mappedOrder, ...prev]);

                return true;
            }
        } catch (e) {
            if (e.message === 'DUPLICATE_ORDER') {
                alert('Diese Auftragsnummer existiert bereits!');
                return false;
            }
            console.error(e);
            return false;
        }
        return false;
    };

    const removeOrder = async (id) => {
        try {
            const success = await deleteOrder(id);
            if (success) {
                // Update local state immediately for instant feedback
                setOrders(prev => prev.filter(o => o.db_id !== id));
                return true;
            }
        } catch (e) {
            console.error("Error removing order:", e);
            return false;
        }
        return false;
    };

    return (
        <OrderContext.Provider value={{
            orders,
            addOrder,
            removeOrder,
            isLoading,
            fetchOrders,
            activeSession,
            checkActiveSession,
            startSession,
            stopSession
        }}>
            {children}
        </OrderContext.Provider>
    );
};

export const useOrders = () => {
    return useContext(OrderContext);
};
