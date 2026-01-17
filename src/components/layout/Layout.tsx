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
  return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex pt-16 h-screen">
        <Sidebar isOpen={sidebarOpen} />

        {/* Canvas surface - elevated content container */}
        <main className="flex-1 ml-20 p-6 custom-scrollbar overflow-y-auto transition-all duration-300" style={{
        height: 'calc(100vh - 4rem)'
      }}>
          <div className="min-h-full flex flex-col">
            {/* Content wrapped in elevated canvas surface - dark contrast */}
            <div className="flex-1 bg-gradient-to-br from-slate-800/80 via-slate-850/75 to-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar">
                <div className="p-8 py-[7px]">
                  {children}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>;
};