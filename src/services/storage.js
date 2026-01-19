import { pb } from '../lib/pocketbase';

// Orders
export const getOrders = async () => {
  try {
    // PocketBase returns a paginated list by default, using getFullList to get all
    const records = await pb.collection('orders').getFullList({
      sort: '-created', // created is the default timestamp field in PB
      expand: 'article_id,time_entries(order_id).work_step_id'
    });
    return records;
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};

export const saveOrder = async (order) => {
  try {
    // Check for duplicate order_id
    // PocketBase using getFirstListItem for single record fetch with filter
    try {
      const existing = await pb.collection('orders').getFirstListItem(`order_id="${order.id}"`);
      if (existing) {
        throw new Error('DUPLICATE_ORDER');
      }
    } catch (err) {
      if (err.status !== 404) throw err; // Ignore 404 (not found)
    }

    const data = {
      order_id: order.id,
      value: order.value,
      date: order.date,
      user_name: order.user,
      company: order.company,
      article_id: order.article_id,
      quantity: order.quantity,
      delivery_date: order.delivery_date,
      status: 'Erfasst' // Default status
    };

    const record = await pb.collection('orders').create(data, { requestKey: null });
    return record;
  } catch (error) {
    if (error.message === 'DUPLICATE_ORDER') throw error;
    console.error('Error saving order:', error);
    return null;
  }
};

export const saveOrders = async (orders, originalFile = null) => {
  if (!orders || orders.length === 0) return [];

  const results = [];
  const errors = [];

  for (const order of orders) {
    try {
      // Check for duplicate
      try {
        const existing = await pb.collection('orders').getFirstListItem(`order_id="${order.id}"`);
        if (existing) {
          console.warn(`Skipping duplicate order: ${order.id}`);
          continue;
        }
      } catch (e) {
        if (e.status !== 404) throw e;
      }

      const data = {
        order_id: order.id,
        value: order.value,
        date: order.date,
        user_name: order.user,
        company: order.company,
        contact_person: order.contact_person,
        article_id: order.article_id,
        quantity: order.quantity,
        delivery_date: order.delivery_date
      };

      let record;
      if (originalFile) {
        const formData = new FormData();
        Object.entries(data).forEach(([key, val]) => {
          if (val !== undefined && val !== null) formData.append(key, val);
        });
        formData.append('original_pdf', originalFile);
        record = await pb.collection('orders').create(formData, { requestKey: null });
      } else {
        record = await pb.collection('orders').create(data, { requestKey: null });
      }

      results.push(record);
    } catch (err) {
      console.error(`Failed to import order ${order.id}:`, err);
      // Log detailed error for debugging
      if (err.data) console.error("Error Details:", err.data);
      errors.push({ id: order.id, error: err });
    }
  }

  if (errors.length > 0) {
    console.warn("Some imports failed:", errors);
    if (results.length === 0 && orders.length > 0) throw new Error("Alle Importe sind fehlgeschlagen.");
  }

  return results;
};

export const deleteOrder = async (id) => {
  try {
    // 1. Delete all work logs for this order
    const logs = await pb.collection('work_logs').getFullList({
      filter: `order_id="${id}"`
    });

    if (logs.length > 0) {
      await Promise.all(logs.map(log => pb.collection('work_logs').delete(log.id)));
    }

    // 2. Delete the order
    await pb.collection('orders').delete(id);
    return true;
  } catch (error) {
    console.error('Error deleting order:', error);
    alert('Fehler beim Löschen des Auftrags: ' + error.message);
    return false;
  }
};

// Users
export const getUsers = async () => {
  try {
    const records = await pb.collection('staff').getFullList({
      sort: '+created',
    });
    // Synthetic "name" property for backward compatibility
    return records.map(r => ({
      ...r,
      name: `${r.firstname} ${r.lastname}`
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

export const saveUser = async (firstname, lastname, color = '#3b82f6', avatarId = 1) => {
  try {
    const data = {
      firstname,
      lastname,
      color,
      avatar_id: avatarId.toString()
    };
    const record = await pb.collection('staff').create(data);
    return { ...record, name: `${firstname} ${lastname}` };
  } catch (error) {
    console.error('Error adding user:', error);
    alert('Fehler beim Benutzer-Erstellen: ' + error.message);
    return null;
  }
};

export const deleteUser = async (user) => {
  // 1. Delete Orders of this user
  try {
    const orders = await pb.collection('orders').getFullList({
      filter: `user_name="${user.name}"`
    });
    // Delete all found
    await Promise.all(orders.map(o => pb.collection('orders').delete(o.id)));
  } catch (err) {
    console.error("Error cleaning up user orders", err);
    alert('Fehler beim Löschen der Aufträge: ' + err.message);
    return false;
  }

  // 2. Delete User
  try {
    await pb.collection('staff').delete(user.id);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Fehler beim Löschen des Benutzers: ' + error.message);
    return false;
  }
};

export const updateUserInfo = async (user, newFirstname, newLastname, newColor, newAvatarId) => {
  const updates = {};
  if (newFirstname) updates.firstname = newFirstname;
  if (newLastname) updates.lastname = newLastname;
  if (newColor) updates.color = newColor;
  if (newAvatarId !== undefined) updates.avatar_id = newAvatarId;

  try {
    await pb.collection('staff').update(user.id, updates);
  } catch (error) {
    alert('Fehler beim Aktualisieren: ' + error.message);
    return;
  }

  // 2. Update Orders if name changed
  const oldName = user.name;
  const newName = `${newFirstname} ${newLastname}`;

  if (newName && newName !== oldName) {
    try {
      const orders = await pb.collection('orders').getFullList({
        filter: `user_name="${oldName}"`
      });
      await Promise.all(orders.map(o => pb.collection('orders').update(o.id, { user_name: newName })));
    } catch (error) {
      alert('Fehler beim Auftrags-Update: ' + error.message);
    }
  }
};

// --- Time Tracking & Status ---

export const getOpenWorkLog = async (userName) => {
  try {
    // end_time is empty
    const record = await pb.collection('work_logs').getFirstListItem(`user_name="${userName}" && end_time=""`, {
      expand: 'order_id' // Assuming order_id is a relation now? Or sticking to string?
      // If order_id in work_logs is just the ORDER_ID string (e.g. 12345), we can't Expand.
      // The current code assumes relations: "orders(order_id...)" in supabase select.
      // For now, let's assume we store the "orders" RECORD ID in work_logs.order_id if we want relations.
      // BUT: migration is complex. Let's stick to storing what we stored before.
    });

    // Need to manual fetch order details if not a relation, or if it IS a relation and we Expanded.
    // Let's assume for this transition we need to fetch the order to get company/quantity stuff.
    // Wait: The original code used a Join.
    // In PB: If 'order_id' field in 'work_logs' is type Relation -> 'orders', we can expand.
    // I will assume we set it up as a Relation in PB schema.
    // If not, we fetch it manually.
    if (record.expand && record.expand.order_id) {
      const o = record.expand.order_id;
      record.orders = { order_id: o.order_id, company: o.company, quantity: o.quantity }; // mimic structure
    } else {
      // Fallback or if not relation
      // We probably stored the DB Identifier (UUID) in Supabase.
      // We will store DB ID in PB too.
      try {
        const o = await pb.collection('orders').getOne(record.order_id);
        record.orders = { order_id: o.order_id, company: o.company, quantity: o.quantity };
      } catch (e) { console.log("linked order not found"); }
    }
    return record;
  } catch (error) {
    if (error.status !== 404) console.error('Error fetching open work log:', error);
    return null;
  }
};

export const startWorkLog = async (orderId, userName, taskType = null, mode = 'Zeitaufnahme') => {
  try {
    const data = {
      order_id: orderId,
      user_name: userName,
      task_type: taskType,
      mode: mode,
      start_time: new Date().toISOString(),
      pause_time_minutes: 0,
      duration_minutes: 0
    };
    const record = await pb.collection('work_logs').create(data);

    // Status Update
    await updateOrderStatus(orderId, 'In Bearbeitung');

    return record;
  } catch (error) {
    console.error('Error starting work log:', error);
    return null;
  }
};

export const stopWorkLog = async (logId, quantity, durationMinutes = 0) => {
  try {
    const data = {
      end_time: new Date().toISOString(),
      quantity_produced: parseInt(quantity) || 0,
      duration_minutes: durationMinutes
    };
    const record = await pb.collection('work_logs').update(logId, data);
    return record;
  } catch (error) {
    console.error('Error stopping work log:', error);
    return null;
  }
};

export const getWorkLogs = async (orderDbId) => {
  try {
    const records = await pb.collection('work_logs').getFullList({
      filter: `order_id="${orderDbId}"`,
      sort: '-start_time'
    });
    return records;
  } catch (error) {
    console.error('Error fetching work logs:', error);
    return [];
  }
};

export const updateOrderStatus = async (orderDbId, status) => {
  try {
    await pb.collection('orders').update(orderDbId, { status });
    return true;
  } catch (error) {
    console.error('Error updating order status:', error);
    return false;
  }
};

// Generic update for any order fields
export const updateOrder = async (orderDbId, updates) => {
  try {
    const record = await pb.collection('orders').update(orderDbId, updates);
    return record;
  } catch (error) {
    console.error('Error updating order:', error);
    return null;
  }
};

export const updateWorkLog = async (logId, updates) => {
  try {
    const record = await pb.collection('time_entries').update(logId, updates);
    return record;
  } catch (error) {
    console.error('Error updating work log:', error);
    return null;
  }
};

export const createWorkLog = async (logData) => {
  try {
    const record = await pb.collection('time_entries').create(logData);
    return record;
  } catch (error) {
    console.error('Error creating work log:', error);
    return null;
  }
};

export const deleteWorkLog = async (logId) => {
  try {
    await pb.collection('time_entries').delete(logId);
    return true;
  } catch (error) {
    console.error('Error deleting work log:', error);
    return false;
  }
};

export const getAllWorkLogs = async () => {
  try {
    const records = await pb.collection('work_logs').getFullList();
    return records;
  } catch (error) {
    console.error('Error fetching all work logs:', error);
    return [];
  }
};

// --- Articles ---

export const getArticles = async () => {
  try {
    const records = await pb.collection('articles').getFullList({
      sort: 'article_id',
    });
    return records;
  } catch (error) {
    if (error.status !== 404) console.error('Error fetching articles:', error);
    return [];
  }
};

export const getArticleByArticleId = async (articleId) => {
  try {
    const record = await pb.collection('articles').getFirstListItem(`article_id="${articleId}"`);
    return record;
  } catch (error) {
    if (error.status !== 404) console.error('Error fetching article:', error);
    return null;
  }
};

export const createArticle = async (data) => {
  try {
    // requestKey: null disables auto-cancellation for this request
    const record = await pb.collection('articles').create(data, { requestKey: null });
    return record;
  } catch (error) {
    console.error('Error creating article:', error);

    // Improved error reporting
    let safeMessage = error.message || 'Unknown Error';
    if (error.data && Object.keys(error.data).length > 0) {
      // Safe stringify of error detail
      safeMessage += ' | Details: ' + JSON.stringify(error.data);
    } else if (error.originalError) {
      safeMessage += ' | Orig: ' + error.originalError.message;
    }

    alert('Fehler beim Erstellen des Artikels: ' + safeMessage);
    throw error;
  }
};

export const updateArticle = async (id, data) => {
  try {
    const record = await pb.collection('articles').update(id, data);
    return record;
  } catch (error) {
    console.error('Error updating article:', error);
    // Return explicit error info
    throw error;
  }
};

export const deleteArticle = async (id) => {
  try {
    await pb.collection('articles').delete(id);
    return true;
  } catch (error) {
    console.error('Error deleting article:', error);
    alert('Fehler beim Löschen des Artikels: ' + error.message);
    return false;
  }
};

// --- Settings (Global Config) ---

export const getAppSetting = async (key, defaultValue = null) => {
  try {
    // Attempt to find the setting by key
    const record = await pb.collection('settings').getFirstListItem(`key="${key}"`);
    return record.value ? JSON.parse(record.value) : defaultValue;
  } catch (error) {
    if (error.status !== 404) console.error(`Error fetching setting '${key}':`, error);
    return defaultValue;
  }
};

export const saveAppSetting = async (key, value) => {
  try {
    const jsonValue = JSON.stringify(value);

    // Check if exists
    try {
      const existing = await pb.collection('settings').getFirstListItem(`key="${key}"`);
      // Update
      await pb.collection('settings').update(existing.id, { value: jsonValue });
    } catch (err) {
      if (err.status === 404) {
        // Create
        await pb.collection('settings').create({ key, value: jsonValue });
      } else {
        throw err;
      }
    }
    return true;
  } catch (error) {
    console.error(`Error saving setting '${key}':`, error);
    alert('Fehler beim Speichern der Einstellung: ' + (error.message || 'Prüfen Sie, ob die Collection "settings" existiert.'));
    return false;
  }
};
