import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useLembretesAlertas } from '@/hooks/useLembretesAlertas';
interface LayoutProps {
  children: React.ReactNode;
}
export const Layout: React.FC<LayoutProps> = ({
  children
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useLembretesAlertas();
  return <div className="min-h-screen bg-noite-100 dark:bg-background overflow-x-hidden">

    <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

    <div className="flex flex-col md:flex-row pt-16 min-w-0">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Canvas surface - elevated content container */}
      <main className="flex-1 w-full md:ml-20 p-4 md:p-6 custom-scrollbar overflow-x-auto overflow-y-auto transition-all duration-300">
        <div className="min-h-full flex flex-col min-w-0">
          <div className="bg-white dark:bg-card rounded-2xl shadow-elevated border border-noite-200 dark:border-border/50 overflow-hidden w-full min-h-[calc(100vh-8rem)]">
            <div className="min-w-0 w-full px-4 py-5 md:p-6">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>;
};