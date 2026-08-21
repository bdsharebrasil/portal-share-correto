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
  return <div className="min-h-screen bg-gradient-subtle dark:bg-background overflow-x-hidden">

    <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

    <div className="flex flex-col md:flex-row pt-16 min-w-0">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 w-full md:ml-20 p-3 md:p-6 custom-scrollbar overflow-x-auto overflow-y-auto transition-all duration-300">
        <div className="min-h-full flex flex-col min-w-0 -mx-2">
          <div className="bg-card dark:bg-card rounded-2xl shadow-elevated border border-border overflow-hidden w-full min-h-[calc(100vh-8rem)] -mx-2 px-0">
            <div className="min-w-0 w-full px-4 py-5 md:p-6 -mx-7">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>;
};
