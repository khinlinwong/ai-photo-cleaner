import React from 'react';

interface DesktopStatusBarProps {
  statusText?: string;
  projectStatus?: string;
  scanStatus?: string;
  nextStep?: string;
}

export const DesktopStatusBar: React.FC<DesktopStatusBarProps> = ({ 
  statusText = '等待选择本地文件夹',
  projectStatus = '未创建',
  scanStatus = '未开始',
  nextStep
}) => {
  return (
    <div className="h-6 border-t border-[var(--dt-border-strong)] bg-[var(--dt-statusbar-bg)] flex items-center justify-between px-4 text-[10px] text-[var(--dt-text-muted)] select-none shrink-0 font-mono">
      <div className="flex items-center space-x-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B89A58] inline-block animate-pulse"></span>
        <span className="text-[var(--dt-text-secondary)]">当前状态: {statusText}</span>
      </div>
      <div className="flex items-center space-x-4">
        <span>项目状态: {projectStatus}</span>
        <span className="w-px h-3 bg-[var(--dt-border-strong)]"></span>
        <span>扫描状态: {scanStatus}</span>
        {nextStep && nextStep !== '无' && (
          <>
            <span className="w-px h-3 bg-[var(--dt-border-strong)]"></span>
            <span>下一步: {nextStep}</span>
          </>
        )}
        <span className="w-px h-3 bg-[var(--dt-border-strong)]"></span>
        <span>导出模式: 安全打包</span>
      </div>
    </div>
  );
};

export default DesktopStatusBar;
