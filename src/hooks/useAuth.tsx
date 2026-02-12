import { useState, createContext, useContext, type ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// No-Auth Mode: Simplified AuthProvider
export function AuthProvider({ children }: { children: ReactNode }) {
  // Always return a guest user
  const [user] = useState<User | null>({
    id: 'guest-user',
    username: 'guest',
    token: 'no-token-needed',
    password_hash: '', // Adding missing required properties from User interface
    created_at: new Date().toISOString()
  });

  const [isLoading] = useState(false);

  const login = async () => {
    console.log('Login not required in no-auth mode');
    return true;
  };

  const logout = () => {
    // No-op
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
