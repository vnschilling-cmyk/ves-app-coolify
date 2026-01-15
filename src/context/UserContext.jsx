import { createContext, useContext, useState, useEffect } from 'react';
import { getUsers, saveUser, updateUserInfo, deleteUser } from '../services/storage';
import { useOrders } from './OrderContext';
import { pb } from '../lib/pocketbase';

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

    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid);
    const [isAdmin, setIsAdmin] = useState(pb.authStore.isSuperuser);

    useEffect(() => {
        // Init auth state
        setIsAuthenticated(pb.authStore.isValid);
        setIsAdmin(pb.authStore.isSuperuser);

        // Sync currentUser with AuthStore model if logged in
        if (pb.authStore.isValid && pb.authStore.model) {
            const model = pb.authStore.model;
            // If it's a staff member (has name fields), set as currentUser
            // If admin, model might be different, but we mostly care about isAdmin flag
            if (model.collectionName === 'staff') {
                // Adapt model to our internal user structure if needed (e.g. synthetic name)
                const userObj = { ...model, name: `${model.firstname} ${model.lastname}` };
                setCurrentUser(userObj);
                localStorage.setItem('currentUser', JSON.stringify(userObj));
            }
        }

        // Listen for auth changes
        const unsub = pb.authStore.onChange((token, model) => {
            setIsAuthenticated(pb.authStore.isValid);
            setIsAdmin(pb.authStore.isSuperuser);

            if (model && model.collectionName === 'staff') {
                const userObj = { ...model, name: `${model.firstname} ${model.lastname}` };
                setCurrentUser(userObj);
                localStorage.setItem('currentUser', JSON.stringify(userObj));
            } else if (!model) {
                // Logout
                setCurrentUser(null);
                localStorage.removeItem('currentUser');
            }
        });

        // Data fetching
        fetchUsers();

        // Realtime Subscription
        // Only verify connection if we want realtime updates. 
        // Public List rule allows this even if not logged in (technically), 
        // but typically we only subscribe when looking at the dashboard.
        pb.collection('staff').subscribe('*', function (e) {
            fetchUsers();
        });

        return () => {
            unsub();
            pb.collection('staff').unsubscribe('*');
        };
    }, []);

    const login = async (identity, password) => {
        try {
            // First try as Staff
            try {
                await pb.collection('staff').authWithPassword(identity, password);
                return true;
            } catch (err) {
                // If failed, try as Admin
                await pb.admins.authWithPassword(identity, password);
                return true;
            }
        } catch (error) {
            console.error("Login failed:", error);
            return false;
        }
    };

    const logout = () => {
        pb.authStore.clear();
    };

    const addUser = async (firstname, lastname, color, avatarId = 1) => {
        if (!firstname.trim() || !lastname.trim()) return;
        await saveUser(firstname.trim(), lastname.trim(), color, avatarId);
        fetchUsers();
    };

    const removeUser = async (user) => {
        await deleteUser(user);
        fetchUsers();
        fetchOrders();
    };

    const updateUser = async (user, firstname, lastname, newColor, newAvatarId) => {
        if (!firstname.trim() || !lastname.trim()) return;
        await updateUserInfo(user, firstname.trim(), lastname.trim(), newColor, newAvatarId);
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
            renameUser,
            login,
            logout,
            isAuthenticated,
            isAdmin
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUsers = () => {
    return useContext(UserContext);
};
