"use client";

import React, { useState } from 'react';
import DesktopTopBar from './DesktopTopBar';
import DesktopSidebar from './DesktopSidebar';
import LocalProjectStart from './LocalProjectStart';
import DesktopStatusBar from './DesktopStatusBar';

export const DesktopShell: React.FC = () => {
  const [currentStatus, setCurrentStatus] = useState('等待选择本地文件夹');

  return (
    <div className="desktop-root">
      <div className="desktop-window">
        {/* Top Window Bar */}
        <DesktopTopBar />
        
        {/* Main Workspace Area (Sidebar + Workspace Panel) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Navigation */}
          <DesktopSidebar />
          
          {/* Main Working Panel */}
          <main className="flex-1 flex flex-col bg-[var(--dt-workspace-bg)] overflow-y-auto p-8 relative">
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
            <LocalProjectStart onStatusChange={setCurrentStatus} />
          </main>
        </div>
        
        {/* Status Bar */}
        <DesktopStatusBar statusText={currentStatus} />
      </div>
    </div>
  );
};

export default DesktopShell;
