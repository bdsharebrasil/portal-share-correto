import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useLembretesAlertas } from '@/hooks/useLembretesAlertas';
import CiclosVoo from '@/pages/CiclosVoo';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const isCiclosVoo = pathname === '/ciclo-voo';

  useLembretesAlertas();

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-subtle dark:bg-background">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex min-w-0 flex-col pt-16 md:flex-row">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex min-h-[calc(100vh-4rem)] w-full flex-1 min-w-0 flex-col overflow-x-hidden overflow-y-auto p-3 transition-all duration-300 md:ml-20 md:p-6">
          <div className="min-h-0 flex-1 min-w-0 w-full">
            <div className="min-h-[calc(100vh-8rem)] w-full overflow-visible rounded-2xl border border-border bg-card shadow-elevated">
              <div className="min-h-full w-full min-w-0 py-5 md:p-6">
                {isCiclosVoo ? <CiclosVoo /> : children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
