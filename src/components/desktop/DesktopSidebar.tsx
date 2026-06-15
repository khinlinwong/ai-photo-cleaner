"use client";

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Search, 
  Eye, 
  GitCompare, 
  Download, 
  Settings 
} from 'lucide-react';
import { 
  APP_VERSION_LABEL, 
  APP_VERSION_SHORT_LABEL, 
  APP_RELEASE_BASELINE, 
  APP_IDENTITY_PATCH,
  APP_CURRENT_PACKAGE_ID
} from '@/lib/config/appVersion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QuickStartGuideDialog } from './QuickStartGuideDialog';

interface DesktopSidebarProps {
  activeId?: string;
  onExportClick?: (rect: DOMRect) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ activeId = 'start', onExportClick }) => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(false);

  const QUICKSTART_SEEN_KEY = `ai-photo-cleaner.quickstart.seen.${APP_CURRENT_PACKAGE_ID}`;

  useEffect(() => {
    if (activeId === 'start') {
      try {
        const seen = localStorage.getItem(QUICKSTART_SEEN_KEY);
        if (!seen) {
          setIsQuickStartOpen(true);
        }
      } catch (err) {
        console.error("Failed to read Quick Start seen status from localStorage:", err);
        // Fallback: Default to not showing to prevent potential render loops or blocking error states
      }
    }
  }, [activeId, QUICKSTART_SEEN_KEY]);

  const menuItems = [
    { id: 'start', step: '01', label: '开始', icon: Play },
    { id: 'scan', step: '02', label: '扫描', icon: Search },
    { id: 'review', step: '03', label: '整理', icon: Eye },
    { id: 'ab-compare', step: '04', label: 'A/B 对比', icon: GitCompare },
    { id: 'export', step: '05', label: '导出', icon: Download },
  ];

  return (
    <div className="w-40 bg-[var(--dt-sidebar-bg)] border-r border-[var(--dt-border)] flex flex-col justify-between py-6 px-4 shrink-0 select-none">
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
            const isClickableExport = item.id === 'export' && !!onExportClick;
            const isDisabled = !isActive && !isClickableExport;

            return (
              <button
                key={item.id}
                disabled={isDisabled}
                onClick={(e) => {
                  if (isClickableExport && onExportClick) {
                    e.preventDefault();
                    onExportClick(e.currentTarget.getBoundingClientRect());
                  }
                }}
                className={`w-full flex items-center space-x-3 px-2.5 py-2 rounded text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-[var(--dt-nav-active-bg)] text-[var(--dt-text-primary)] border-l-2 border-[var(--dt-accent)] cursor-default'
                    : isDisabled
                      ? 'text-[var(--dt-text-faint)] cursor-not-allowed opacity-50'
                      : 'text-[var(--dt-text-faint)] hover:text-[var(--dt-text-primary)] hover:bg-[var(--dt-nav-hover-bg)] cursor-pointer'
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
            className="w-full flex items-center space-x-3 px-2.5 py-2 rounded text-xs font-semibold text-[var(--dt-text-faint)] cursor-not-allowed"
          >
            <Settings className="w-3.5 h-3.5 stroke-[1.8]" />
            <span className="flex-1 text-left">设置</span>
          </button>
        </div>
        
        {/* Version & About Toggle Button */}
        <button
          onClick={() => setIsAboutOpen(true)}
          className="w-full text-center text-[9px] text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)] transition-colors font-mono cursor-pointer select-none"
        >
          {APP_VERSION_SHORT_LABEL}
        </button>
      </div>

      {/* About/Version Modal */}
      <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
        <DialogContent className="max-w-xs sm:max-w-md bg-[#181E24]/95 text-xs text-[var(--dt-text-secondary)] border border-white/10 rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] outline-none backdrop-blur-md">
          <DialogHeader className="border-b border-white/5 pb-2">
            <DialogTitle className="text-sm font-bold text-[var(--dt-text-primary)]">
              关于 AI Photo Cleaner
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 leading-relaxed">
            <div>
              <p className="font-bold text-[var(--dt-text-primary)] text-sm mb-0.5">AI Photo Cleaner</p>
              <p className="text-[var(--dt-text-muted)] font-mono">{APP_VERSION_LABEL}</p>
            </div>
            
            <div className="space-y-1 text-[11px] text-[var(--dt-text-secondary)] border-t border-white/5 pt-2 font-mono">
              <p><span className="text-[var(--dt-text-muted)]">Release baseline:</span> {APP_RELEASE_BASELINE}</p>
              <p><span className="text-[var(--dt-text-muted)]">Identity patch:</span> {APP_IDENTITY_PATCH}</p>
            </div>
            
            <div className="space-y-1">
              <p className="font-semibold text-[var(--dt-text-primary)]">本版本包含：</p>
              <ul className="list-disc list-inside pl-1 text-[var(--dt-text-secondary)] space-y-0.5">
                <li>本地照片分析</li>
                <li>selected-files / folder import 最多 200 张</li>
                <li>Results Keep / Cull 快捷过滤</li>
                <li>Similar Groups 状态过滤</li>
                <li>A/B 对比进度与质量参考</li>
                <li>CSV / JSON 保存</li>
                <li>Keep 文件夹导出</li>
              </ul>
            </div>
            
            <div className="space-y-1 border-t border-white/5 pt-2">
              <p className="font-semibold text-[var(--dt-text-primary)]">安全说明：</p>
              <ul className="list-disc list-inside pl-1 text-[var(--dt-text-secondary)] space-y-0.5">
                <li>照片只在本机处理</li>
                <li>不上传照片</li>
                <li>不移动原图</li>
                <li>不删除原图</li>
                <li>不修改原图</li>
              </ul>
            </div>
            
            <div className="border-t border-white/5 pt-2 text-[var(--dt-text-muted)]">
              <p>测试反馈请注明：</p>
              <p className="font-mono text-[var(--dt-text-primary)] mt-0.5">{APP_VERSION_LABEL}</p>
            </div>
          </div>
          <DialogFooter className="border-t border-white/5 pt-2 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAboutOpen(false);
                setTimeout(() => {
                  setIsQuickStartOpen(true);
                }, 150);
              }}
              className="text-xs px-3 h-7 bg-transparent border-white/10 hover:bg-white/5 hover:text-white mr-2"
            >
              查看快速引导
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsAboutOpen(false)}
              className="text-xs px-3 h-7 bg-transparent border-white/10 hover:bg-white/5 hover:text-white"
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickStartGuideDialog 
        open={isQuickStartOpen} 
        onOpenChange={setIsQuickStartOpen} 
        onComplete={() => {
          try {
            localStorage.setItem(QUICKSTART_SEEN_KEY, 'true');
          } catch (err) {
            console.error("Failed to write Quick Start seen status to localStorage:", err);
          }
        }}
      />
    </div>
  );
};

export default DesktopSidebar;
