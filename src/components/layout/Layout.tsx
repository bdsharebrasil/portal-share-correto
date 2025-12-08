import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen aviation-gradient">
      <Header
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        onRightMenuClick={() => setRightSidebarOpen(!rightSidebarOpen)}
      />

      <div className="flex pt-16 h-screen">
        <Sidebar isOpen={sidebarOpen} />

        <main
          className={`flex-1 transition-all duration-300 ${
            sidebarOpen ? 'ml-64' : 'ml-0'
          } ${
            rightSidebarOpen ? 'mr-80' : 'mr-0'
          } p-6 custom-scrollbar overflow-y-auto`}
          style={{ height: 'calc(100vh - 4rem)' }}
        >
          <div className="min-h-full">
            {children}
          </div>
        </main>

        <RightSidebar isOpen={rightSidebarOpen} />
      </div>
    </div>
  );
};