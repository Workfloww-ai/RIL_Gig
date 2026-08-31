'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, History, LogOut, Menu, X } from 'lucide-react';
import { getCurrentUser } from '@/lib/api';

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [userName, setUserName] = useState('Finance Team');

  useEffect(() => {
    setIsClient(true);
    const token = localStorage.getItem('finance_token');
    if (!token) {
      router.push('/login');
    } else {
      getCurrentUser()
        .then(res => {
          const name = `${res.data.first_name || ''} ${res.data.last_name || ''}`.trim();
          if (name) setUserName(name);
        })
        .catch(err => console.error("Failed to fetch user", err));
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('finance_token');
    router.push('/login');
  };

  const navLinks = [
    { name: 'Dashboard', href: '/finance', icon: LayoutDashboard },
    { name: 'Payment History', href: '/finance/history', icon: History },
  ];

  if (!isClient) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-sand">
      {/* Sidebar - Desktop */}
      <aside className="hidden w-64 flex-col bg-moss text-white md:flex">
        <div className="flex h-16 items-center justify-center gap-2 border-b border-green-800">
          <img src="/images/logo.jpeg" alt="SahYogi Logo" className="h-8 w-8 object-contain rounded-md bg-white" />
          <h1 className="text-xl font-bold tracking-wider">SAHYOGI</h1>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${isActive ? 'bg-green-700 text-white' : 'text-green-100 hover:bg-green-800'
                  }`}
              >
                <Icon className="h-5 w-5" />
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-green-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg bg-clay px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-cream px-4 shadow-sm md:px-6">
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate p-2 focus:outline-none"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <div className="ml-3 flex items-center gap-2 md:hidden">
              <img src="/images/logo.jpeg" alt="SahYogi Logo" className="h-7 w-7 object-contain rounded-md" />
              <h1 className="text-lg font-bold text-moss">SahYogi</h1>
            </div>
          </div>

          <div className="hidden md:flex items-center">
            <h2 className="text-lg font-semibold text-slate capitalize">
              {pathname === '/finance' ? 'Dashboard' : pathname.split('/').pop()?.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-moss flex items-center justify-center text-white font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-sm font-medium text-slate md:block">{userName}</span>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}></div>
            <aside className="relative flex w-64 flex-col bg-moss text-white shadow-xl">
              <div className="flex h-16 items-center justify-between px-4 border-b border-green-800">
                <div className="flex items-center gap-2">
                  <img src="/images/logo.jpeg" alt="SahYogi Logo" className="h-8 w-8 object-contain rounded-md bg-white" />
                  <h1 className="text-xl font-bold">SahYogi</h1>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="h-6 w-6" />
                </button>
              </div>
              <nav className="flex-1 space-y-2 p-4">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${isActive ? 'bg-green-700 text-white' : 'text-green-100 hover:bg-green-800'
                        }`}
                    >
                      <Icon className="h-5 w-5" />
                      {link.name}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-green-800">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg bg-clay px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-sand p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
