import React from 'react';

interface DesktopTopBarProps {
  currentPhase?: string;
}

export const DesktopTopBar: React.FC<DesktopTopBarProps> = ({ currentPhase = 'Start' }) => {
  return (
    <div className="h-12 border-b border-[var(--dt-border-strong)] bg-[var(--dt-topbar-bg)] flex items-center justify-between px-6 select-none shrink-0">
      {/* App & State */}
      <div className="flex items-baseline space-x-3 w-1/3">
        <span className="text-xs font-bold text-[var(--dt-text-primary)] tracking-wider font-mono">
          AI Photo Cleaner
        </span>
        <span className="text-[9px] text-[var(--dt-text-secondary)] font-semibold hidden sm:inline tracking-wide">
          Local Photo Organize Workspace
        </span>
      </div>
      
      {/* Center Context */}
      <div className="text-xs font-bold text-[var(--dt-text-primary)] tracking-wider w-1/3 text-center">
        {currentPhase}
      </div>
      
      {/* Status Pills */}
      <div className="flex items-center space-x-2 w-1/3 justify-end">
        <span className="desktop-pill">
          本地扫描
        </span>
        <span className="desktop-pill">
          AI 辅助: 关闭
        </span>
        <span className="desktop-pill">
          原图默认不上传
        </span>
      </div>
    </div>
  );
};

export default DesktopTopBar;
