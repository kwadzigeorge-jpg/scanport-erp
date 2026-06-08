import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../types';
import { login as apiLogin, getMe } from '../api/auth';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isSupervisor: boolean;
  isMaintenance: boolean;
  canManageIncidents: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    getMe()
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await apiLogin(email, password);
    localStorage.setItem('token', token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  const isAdmin        = user?.role === 'ADMIN';
  const isSupervisor   = user?.role === 'SUPERVISOR' || isAdmin;
  const isMaintenance  = user?.role === 'MAINTENANCE' || isAdmin;
  const canManageIncidents = isAdmin || isSupervisor || isMaintenance;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isSupervisor, isMaintenance, canManageIncidents }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
