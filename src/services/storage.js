import { supabase } from '../lib/supabase';

// Orders
export const getOrders = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false }); // Latest first

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
  return data;
};

export const saveOrder = async (order) => {
  // Check for duplicate order_id
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();

  if (existing) {
    throw new Error('DUPLICATE_ORDER');
  }

  // Map format to DB schema if needed, but we used matching names in SQL
  const { data, error } = await supabase
    .from('orders')
    .insert([{
      order_id: order.id,
      value: order.value,
      date: order.date,
      user_name: order.user,
      company: order.company,
      quantity: order.quantity,
      delivery_date: order.delivery_date
    }])
    .select();

  if (error) {
    console.error('Error saving order:', error);
    return null;
  }
  return data ? data[0] : null;
};

export const saveOrders = async (orders) => {
  if (!orders || orders.length === 0) return [];

  const mappedOrders = orders.map(order => ({
    order_id: order.id,
    value: order.value,
    date: order.date,
    user_name: order.user,
    company: order.company,
    quantity: order.quantity,
    delivery_date: order.delivery_date
  }));

  const { data, error } = await supabase
    .from('orders')
    .insert(mappedOrders)
    .select();

  if (error) {
    console.error('Error saving bulk orders:', error);
    // Might fail partially if one ID exists? Supabase prevents all if one fails usually.
    throw error;
  }
  return data;
};

export const deleteOrder = async (id) => {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting order:', error);
    return false;
  }
  return true;
};

// Users
export const getUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('name, color, avatar_id')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    // Return dummy data if error
    return [{ name: 'User A', color: '#3b82f6', avatar_id: 1 }, { name: 'User B', color: '#10b981', avatar_id: 2 }];
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data;
};

export const saveUser = async (name, color = '#3b82f6', avatarId = 1) => {
  const { data, error } = await supabase
    .from('users')
    .insert([{ name, color, avatar_id: avatarId }])
    .select();

  if (error) {
    if (error.code === '23505') return null; // Unique violation
    alert('Fehler beim Benutzer-Erstellen: ' + error.message);
    console.error('Error adding user:', error);
  }
  return data?.[0];
};

export const deleteUser = async (name) => {
  // 1. Delete Orders of this user
  const { error: orderError } = await supabase
    .from('orders')
    .delete()
    .eq('user_name', name);

  if (orderError) {
    alert('Fehler beim Löschen der Aufträge: ' + orderError.message);
    return false;
  }

  // 2. Delete User
  const { error: userError } = await supabase
    .from('users')
    .delete()
    .eq('name', name);

  if (userError) {
    alert('Fehler beim Löschen des Benutzers: ' + userError.message);
    return false;
  }
  return true;
};

export const updateUserInfo = async (oldName, newName, newColor, newAvatarId) => {
  const updates = {};
  if (newName) updates.name = newName;
  if (newColor) updates.color = newColor;
  if (newAvatarId !== undefined) updates.avatar_id = newAvatarId;

  // 1. Update User Table
  const { error: userError } = await supabase
    .from('users')
    .update(updates)
    .eq('name', oldName);

  if (userError) {
    alert('Fehler beim Aktualisieren: ' + userError.message);
    return;
  }

  // 2. Update Orders if name changed
  if (newName && newName !== oldName) {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ user_name: newName })
      .eq('user_name', oldName);

    if (orderError) {
      alert('Fehler beim Auftrags-Update: ' + orderError.message);
    }
  }
};

// --- Time Tracking & Status ---

export const getOpenWorkLog = async (userName) => {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*, orders(order_id, company, quantity)')
    .eq('user_name', userName)
    .is('end_time', null)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching open work log:', error);
  }
  return data;
};

export const startWorkLog = async (orderId, userName) => {
  const { data, error } = await supabase
    .from('work_logs')
    .insert([{
      order_id: orderId,
      user_name: userName,
      start_time: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('Error starting work log:', error);
    return null;
  }

  // Also update order status to 'In Bearbeitung'
  await updateOrderStatus(orderId, 'In Bearbeitung');

  return data;
};

export const stopWorkLog = async (logId, quantity) => {
  const { data, error } = await supabase
    .from('work_logs')
    .update({
      end_time: new Date().toISOString(),
      quantity_produced: parseInt(quantity) || 0
    })
    .eq('id', logId)
    .select()
    .single();

  if (error) {
    console.error('Error stopping work log:', error);
    return null;
  }
  return data;
};

export const getWorkLogs = async (orderDbId) => {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('order_id', orderDbId)
    .order('start_time', { ascending: false });

  if (error) {
    console.error('Error fetching work logs:', error);
    return [];
  }
  return data;
};

export const updateOrderStatus = async (orderDbId, status) => {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderDbId);

  if (error) {
    console.error('Error updating order status:', error);
    return false;
  }
  return true;
};

export const updateWorkLog = async (logId, updates) => {
  const { data, error } = await supabase
    .from('work_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();

  if (error) {
    console.error('Error updating work log:', error);
    return null;
  }
  return data;
};

export const createWorkLog = async (logData) => {
  const { data, error } = await supabase
    .from('work_logs')
    .insert([logData])
    .select()
    .single();

  if (error) {
    console.error('Error creating work log:', error);
    return null;
  }
  return data;
};

export const deleteWorkLog = async (logId) => {
  const { error } = await supabase
    .from('work_logs')
    .delete()
    .eq('id', logId);

  if (error) {
    console.error('Error deleting work log:', error);
    return false;
  }
  return true;
};

export const getAllWorkLogs = async () => {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*');

  if (error) {
    console.error('Error fetching all work logs:', error);
    return [];
  }
  return data;
};
