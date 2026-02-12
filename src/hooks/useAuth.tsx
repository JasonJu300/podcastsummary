import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Simplified useAuth for No-Auth Mode
  export function useAuth() {
    // Always return a guest user
    const [user] = useState<User | null>({
      id: 'guest-user', // Changed userId to id to match User type
      username: 'guest',
      token: 'no-token-needed'
    });

    const [isLoading] = useState(false);

    const login = async () => {
      // No-op in no-auth mode
      console.log('Login not required in no-auth mode');
      return true; // Added return true to match original login signature
    };

    const logout = () => {
      // No-op
    };

    return {
      user,
      isLoading,
      login,
      logout
    };
  }

  export function AuthProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
