import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
interface LayoutProps {
  children: React.ReactNode;
}
export const Layout: React.FC<LayoutProps> = ({
  children
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
    <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

    <div className="flex pt-16" style={{ marginLeft: '-52px', marginRight: '-52px' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Canvas surface - elevated content container */}
      <main className="flex-1 w-full md:ml-20 p-4 md:p-6 custom-scrollbar overflow-x-auto overflow-y-auto transition-all duration-300" style={{ paddingLeft: '0px', paddingRight: '0px' }}>
        <div className="min-h-full flex flex-col" style={{ paddingLeft: '0px', paddingRight: '0px', marginLeft: '-20px', marginRight: '-20px' }}>
          {/* Content wrapped in elevated canvas surface - dark contrast */}
      <div className="bg-gradient-to-br from-slate-800/80 via-slate-850/75 to-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 overflow-x-auto overflow-y-auto" style={{ marginLeft: '9px', marginRight: '9px' }}>
        <div className="p-4 md:p-8 min-w-full">
          {children}
        </div>
      </div>
        </div>
      </main>
    </div>
  </div>;
};
