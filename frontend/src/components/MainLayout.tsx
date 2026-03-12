'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from "./Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('token');
    }
    return null;
  });
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const authed = !!token;
      
      if (authed !== isAuthenticated) {
        setIsAuthenticated(authed);
      }
      
      // If not authed and not on login page (/), redirect to login
      if (!authed && pathname !== '/') {
        router.push('/');
      }
    };

    checkAuth();

    const handleStorageChange = () => {
      const token = localStorage.getItem('token');
      const authed = !!token;
      setIsAuthenticated(authed);
      if (!authed && pathname !== '/') {
        router.push('/');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-change', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleStorageChange);
    };
  }, [pathname, router]);

  if (isAuthenticated === null) {
    return <div style={{ background: '#0a1628', minHeight: '100vh' }} />;
  }

  // Dashboard layout for authenticated users
  if (isAuthenticated) {
    return (
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ marginLeft: 260, flex: 1, minHeight: '100vh', background: '#0a1628' }}>
          {children}
        </main>
      </div>
    );
  }

  // Pure children view for unauthenticated (basically the root login page)
  return <>{children}</>;
}
