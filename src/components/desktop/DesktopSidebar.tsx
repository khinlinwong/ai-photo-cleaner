import React from 'react';
import { 
  Play, 
  Search, 
  Eye, 
  GitCompare, 
  Download, 
  Settings 
} from 'lucide-react';

interface DesktopSidebarProps {
  activeId?: string;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ activeId = 'start' }) => {
  const menuItems = [
    { id: 'start', step: '01', label: '开始', icon: Play },
    { id: 'scan', step: '02', label: '扫描', icon: Search },
    { id: 'review', step: '03', label: '整理', icon: Eye },
    { id: 'ab-compare', step: '04', label: 'A/B 对比', icon: GitCompare },
    { id: 'export', step: '05', label: '导出', icon: Download },
  ];

  return (
    <div className="w-48 bg-[var(--dt-sidebar-bg)] border-r border-[var(--dt-border)] flex flex-col justify-between py-6 px-4 shrink-0 select-none">
      <div className="space-y-4">
        {/* Sidebar Header */}
        <div className="px-2">
          <span className="text-[10px] font-bold text-[var(--dt-text-secondary)] uppercase tracking-wider font-mono">
            Workflow
          </span>
        </div>

        {/* Menu Items */}
        <div className="space-y-1.5">
          {menuItems.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                disabled={!isActive}
                className={`w-full flex items-center space-x-3 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[var(--dt-nav-active-bg)] text-[var(--dt-text-primary)] shadow-sm border border-[var(--dt-nav-active-border)] cursor-default'
                    : 'text-[var(--dt-text-faint)] cursor-not-allowed'
                }`}
              >
                <span className="text-[10px] font-mono opacity-50 shrink-0">{item.step}</span>
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Footer Section with Settings */}
      <div className="space-y-4">
        <div className="border-t border-[var(--dt-border)] pt-3">
          <button
            disabled
            className="w-full flex items-center space-x-3 px-2.5 py-2 rounded-lg text-xs font-semibold text-[var(--dt-text-faint)] cursor-not-allowed"
          >
            <Settings className="w-3.5 h-3.5 stroke-[1.8]" />
            <span className="flex-1 text-left">设置</span>
          </button>
        </div>
        <div className="text-[9px] text-[var(--dt-text-muted)] text-center font-mono select-none">
          v0.1.0-alpha
        </div>
      </div>
    </div>
  );
};

export default DesktopSidebar;
