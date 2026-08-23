import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const UserContext = createContext({
  user: null,
  setUser: () => {},
  isProfileEditing: false,
  setIsProfileEditing: () => {},
  refreshUser: async () => null,
});

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const UserProvider = ({ children }) => {
  const [user, setUserState] = useState(readStoredUser);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const setUser = useCallback((next) => {
    setUserState(next);
    if (next) {
      localStorage.setItem('user', JSON.stringify(next));
    } else {
      localStorage.removeItem('user');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE_URL) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
    return null;
  }, [API_BASE_URL, setUser]);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      refreshUser();
    }
  }, [refreshUser]);

  useEffect(() => {
    const role = user?.role;
    if (role === 'user' || role === 'matchmaker') {
      document.documentElement.setAttribute('data-role', role);
    } else {
      document.documentElement.removeAttribute('data-role');
    }
  }, [user?.role]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isProfileEditing,
      setIsProfileEditing,
      refreshUser,
    }),
    [user, setUser, isProfileEditing, refreshUser]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => useContext(UserContext);

export default UserContext;
