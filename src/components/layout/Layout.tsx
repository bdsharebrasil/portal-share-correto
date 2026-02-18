import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
interface LayoutProps {
  children: React.ReactNode;
}
export const Layout: React.FC<LayoutProps> = ({
  children
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} />

        {/* Canvas surface - elevated content container */}
        <main className="flex-1 ml-20 p-6 custom-scrollbar overflow-y-auto transition-all duration-300">
          <div className="min-h-full flex flex-col">
            {/* Content wrapped in elevated canvas surface - dark contrast */}
            <div className="flex-1 bg-gradient-to-br from-slate-800/80 via-slate-850/75 to-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 overflow-auto">
              <div className="overflow-y-auto custom-scrollbar">
                <div className="p-6">
                  {children}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>;
};
