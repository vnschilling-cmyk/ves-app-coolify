import { createContext, useContext, useState, useEffect } from 'react';
import { saveOrder, getOrders, deleteOrder, updateOrder } from '../services/storage';
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
            status: o.status || 'Erfasst',
            original_pdf: o.original_pdf,
            expand: o.expand,
            collectionId: o.collectionId,
            collectionName: o.collectionName,
            article_id: o.article_id,
            time_logs: o.expand?.['time_entries(order_id)'] || [] // Mapped from expand
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

    // Load session from local storage on mount
    useEffect(() => {
        const savedSession = localStorage.getItem('ves_active_session');
        if (savedSession) {
            try {
                setActiveSession(JSON.parse(savedSession));
            } catch (e) {
                console.error("Failed to parse active session", e);
                localStorage.removeItem('ves_active_session');
            }
        }
    }, []);

    const startSession = async (orderId, stepId, stepName, category, type = 'Stoppuhr') => {
        try {
            // Find the order to get the correct DB ID
            const orderObj = orders.find(o => o.id === orderId);
            const dbId = orderObj ? orderObj.db_id : null;

            if (!dbId) {
                console.error("Order DB ID not found for", orderId);
                // Try to use orderId as DB ID if logic fails? 
                // Mostly unsafe, better to error or assume it might be DB ID.
            }

            const data = {
                order_id: dbId,
                // staff_id now correctly points to staff collection
                staff_id: pb.authStore.model?.id,
                // work_step_id might be a local fallback ID (like 'prep') - only use if it looks like a DB ID
                work_step_id: (stepId && stepId.length > 10) ? stepId : null,
                type: type, // 'Stoppuhr'
                status: 'In Bearbeitung',
                start_time: new Date().toISOString(),
            };

            // If stepId is not a valid DB ID (e.g. 'prep'), this might fail if relation is strict. 
            // Assuming for now WorkSessionModal passes the DB ID of the step.

            // For now, since WorkSteps might still be hardcoded in Modal, we might not have a real work_step_id relation 
            // unless we strictly load from DB. 
            // User: "Sind die Tabellen richtig?" implies they exist.
            // I will assume for this step that we try to save. 
            // Safety: If relation fails, we might need to handle it. 
            // But let's stay consistent with the "JSON to Collection" switch.

            console.log("Creating time_entry with data:", data);
            const record = await pb.collection('time_entries').create(data);
            console.log("Time entry created:", record);

            const session = {
                id: record.id,
                startTime: record.start_time,
                orderId,
                stepId,
                stepName,
                category,
                type
            };

            setActiveSession(session);
            localStorage.setItem('ves_active_session', JSON.stringify(session));

            // Update Order Status
            const order = orders.find(o => o.id === orderId);
            if (order && (order.status === 'open' || !order.status)) {
                await updateOrder(order.db_id, { status: 'in_progress' });
            }

            return true;
        } catch (e) {
            console.error("Start Session Error:", e);
            console.error("Error data:", e.data); // PocketBase includes validation errors here
            alert("Fehler beim Starten: " + (e.data ? JSON.stringify(e.data) : e.message));
            return false;
        }
    };

    const stopSession = async (resultData) => {
        if (!activeSession) return false;
        const { durationMinutes, quantity, notes } = resultData;

        try {
            await pb.collection('time_entries').update(activeSession.id, {
                end_time: new Date().toISOString(),
                duration_minutes: durationMinutes,
                quantity: quantity || null,
                notes: notes || '',
                status: 'Abgeschlossen'
            });

            // Update Order Status Logic
            const order = orders.find(o => o.id === activeSession.orderId);
            if (order) {
                let newStatus = order.status;
                // Category mapping needs to match Config
                if (activeSession.category === 'manufacturing' || activeSession.category === 'Fertigung') {
                    newStatus = 'done';
                } else if (activeSession.category === 'delivery' || activeSession.category === 'Lieferung') {
                    newStatus = 'delivered';
                } else if (newStatus === 'open') {
                    newStatus = 'in_progress';
                }

                if (newStatus !== order.status) {
                    await updateOrder(order.db_id, { status: newStatus });
                }
            }

            setActiveSession(null);
            localStorage.removeItem('ves_active_session');
            await fetchOrders(); // REFRESH UI
            return true;

        } catch (error) {
            console.error("Failed to stop session:", error);
            alert("Fehler beim Speichern: " + error.message);
            return false;
        }
    };

    // Helper for Fixed Time entries
    const commitSessionToOrder = async (orderId, logEntry) => {
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) throw new Error("Order not found");

            await pb.collection('time_entries').create({
                order_id: order.db_id,
                // staff_id now correctly points to staff collection
                staff_id: pb.authStore.model?.id,
                // work_step_id might be a local fallback ID - only use if it looks like a DB ID
                work_step_id: (logEntry.stepId && logEntry.stepId.length > 10) ? logEntry.stepId : null,
                type: 'Festwert',
                status: 'Abgeschlossen',
                start_time: logEntry.startTime,
                end_time: logEntry.endTime,
                duration_minutes: logEntry.durationMinutes,
                quantity: logEntry.quantity,
                notes: logEntry.notes
            });

            // Status logic
            let newStatus = order.status;
            if ((logEntry.category === 'manufacturing' || logEntry.category === 'Fertigung') && newStatus !== 'delivered') {
                newStatus = 'done';
            } else if (logEntry.category === 'delivery' || logEntry.category === 'Lieferung') {
                newStatus = 'delivered';
            } else if (newStatus === 'open') {
                newStatus = 'in_progress';
            }

            if (newStatus !== order.status) {
                await updateOrder(order.db_id, { status: newStatus });
            }

            await fetchOrders(); // REFRESH UI
            return true;
        } catch (e) {
            console.error(e);
            alert("Fehler bei Fixzeit: " + e.message);
            return false;
        }
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
                    status: newOrder.status || 'Erfasst',
                    original_pdf: newOrder.original_pdf,
                    expand: newOrder.expand,
                    collectionId: newOrder.collectionId,
                    collectionName: newOrder.collectionName,
                    article_id: newOrder.article_id
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
        console.log("OrderContext: removeOrder called for ID:", id);
        try {
            const success = await deleteOrder(id);
            console.log("OrderContext: deleteOrder result:", success);

            if (success) {
                // Optimistic Update
                setOrders(prev => {
                    const filtered = prev.filter(o => o.db_id !== id);
                    console.log("OrderContext: New orders count:", filtered.length);
                    return filtered;
                });

                // Force sync with server just in case
                setTimeout(() => {
                    console.log("OrderContext: Force fetching orders to sync");
                    fetchOrders();
                }, 500);

                return true;
            } else {
                console.error("OrderContext: deleteOrder returned false");
            }
        } catch (e) {
            console.error("Error removing order in Context:", e);
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
            startSession,
            stopSession,
            updateOrder,
            commitSessionToOrder
        }}>
            {children}
        </OrderContext.Provider>
    );
};

export const useOrders = () => {
    return useContext(OrderContext);
};
