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
  return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-x-hidden">

    <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

    <div className="flex flex-col md:flex-row pt-16 min-w-0">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Canvas surface - elevated content container */}
      <main className="flex-1 w-full md:pl-20 p-4 md:p-6 custom-scrollbar overflow-x-auto overflow-y-auto transition-all duration-300">
        <div className="min-h-full flex flex-col min-w-0">
          <div className="bg-gradient-to-br from-slate-800/80 via-slate-850/75 to-slate-900/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden w-full">
            <div className="min-w-0 w-full mx-[4px] px-4 py-[21px]">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>;
};
