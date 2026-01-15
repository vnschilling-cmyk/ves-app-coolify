import { createContext, useContext, useState, useEffect } from 'react';
import { getUsers, saveUser, updateUserInfo, deleteUser } from '../services/storage';
import { useOrders } from './OrderContext';
import { supabase } from '../lib/supabase';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });
    const { fetchOrders } = useOrders(); // To refresh orders if user renamed

    const fetchUsers = async () => {
        const data = await getUsers();
        setUsers(data);

        // Auto-select first user if none selected and users exist
        if (!currentUser && data.length > 0) {
            setCurrentUser(data[0]);
            localStorage.setItem('currentUser', JSON.stringify(data[0]));
        } else if (currentUser) {
            // Update current user object if it changed in DB
            const updated = data.find(u => u.name === currentUser.name);
            if (updated) {
                setCurrentUser(updated);
                localStorage.setItem('currentUser', JSON.stringify(updated));
            }
        }
    };

    const selectUser = (user) => {
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
    };

    useEffect(() => {
        fetchUsers();

        // Realtime Subscription
        const subscription = supabase
            .channel('public:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                fetchUsers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const addUser = async (name, color, avatarId = 1) => {
        if (!name.trim()) return;
        await saveUser(name.trim(), color, avatarId);
        fetchUsers();
    };

    const removeUser = async (name) => {
        await deleteUser(name); // Assuming deleteUser is imported or defined elsewhere
        fetchUsers();
        fetchOrders();
    };

    const updateUser = async (oldName, newName, newColor, newAvatarId) => {
        if (newName && !newName.trim()) return;
        await updateUserInfo(oldName, newName, newColor, newAvatarId);
        fetchUsers();
        fetchOrders();
    };

    // Deprecated alias for backward compatibility or simple rename
    const renameUser = (oldName, newName) => updateUser(oldName, newName, null, null);

    return (
        <UserContext.Provider value={{
            users,
            currentUser,
            selectUser,
            addUser,
            removeUser,
            updateUser,
            renameUser
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUsers = () => {
    return useContext(UserContext);
};
