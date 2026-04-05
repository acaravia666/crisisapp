import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { requestNotificationPermission, listenForegroundMessages } from '../lib/firebase';

interface User {
  id: string;
  name: string;
  email: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [isLoading, setIsLoading] = useState(true);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('jwt_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    setToken(null);
    setUser(null);
  };

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const storedToken = localStorage.getItem('jwt_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      const response = await apiClient.get('/users/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to validate token', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  // Register FCM token once user is authenticated
  useEffect(() => {
    if (!user) return;
    requestNotificationPermission().then((token) => {
      if (token) {
        apiClient.post('/users/me/fcm-token', { token }).catch(() => {});
      }
    });
    // Show foreground notifications as a browser notification
    const unsub = listenForegroundMessages((title, body) => {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg' });
      }
    });
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
