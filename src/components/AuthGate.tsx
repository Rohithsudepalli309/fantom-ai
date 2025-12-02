import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthPortal from '@/components/AuthPortal';

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-[#131316]">
        <div className="animate-pulse text-slate-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }
  if (!user) return <AuthPortal />;
  return <>{children}</>;
};

export default AuthGate;