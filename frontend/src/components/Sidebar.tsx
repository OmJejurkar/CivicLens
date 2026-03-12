'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Video, Bot } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Meetings', href: '/meetings', icon: Video },
    { name: 'AI Assistant', href: '/assistant', icon: Bot },
  ];

  return (
    <div style={{
      width: 260,
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      background: 'rgba(10, 22, 40, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(212, 168, 67, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: 24 }}>🏛️</span>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#f0d078', lineHeight: 1.2 }}>
            CivicLens
          </h1>
          <p style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            AI Co-Pilot
          </p>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 12,
                color: isActive ? '#f0d078' : '#94a3b8',
                background: isActive ? 'rgba(212, 168, 67, 0.1)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 500,
                fontSize: 14,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = '#cbd5e1';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '20px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
          CivicLens AI v0.1.0
        </div>
      </div>
    </div>
  );
}
