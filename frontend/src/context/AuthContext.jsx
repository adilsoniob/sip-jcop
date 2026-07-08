import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('jcopsip_token');
      if (!token) {
        setUser(null);
        return null;
      }
      const res = await authApi.check();
      if (res.data.authenticated) {
        setUser(res.data.user);
        return res.data.user;
      }
      setUser(null);
      localStorage.removeItem('jcopsip_token');
      localStorage.removeItem('jcopsip_user');
      return null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    checkAuth().finally(() => setLoading(false));
  }, [checkAuth]);

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    const { token, user: userData } = res.data;
    localStorage.setItem('jcopsip_token', token);
    localStorage.setItem('jcopsip_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('jcopsip_token');
    localStorage.removeItem('jcopsip_user');
    setUser(null);
    authApi.logout().catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
