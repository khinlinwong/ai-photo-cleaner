import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';
import { FolderOpen, ArrowRight, ShieldCheck, Cpu, Trash2, Clock, ChevronRight } from 'lucide-react';

interface LocalProjectStartProps {
  onStatusChange?: (status: string) => void;
}

export const LocalProjectStart: React.FC<LocalProjectStartProps> = ({ onStatusChange }) => {
  const router = useRouter();
  const { uploadFiles, loadDemoPhotos } = usePhotoWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isStarting, setIsStarting] = useState<'none' | 'upload' | 'demo'>('none');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectFolderClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 过滤出图片
    const imgFiles = files.filter(file => file.type.startsWith('image/'));
    if (imgFiles.length === 0) {
      setErrorMessage('请选择至少一张图片。');
      return;
    }

    setErrorMessage(null);
    setIsStarting('upload');
    if (onStatusChange) {
      onStatusChange('正在准备本地项目');
    }

    try {
      uploadFiles(imgFiles);
    } catch (err) {
      console.error('File import error:', err);
      setErrorMessage('导入失败，请重新选择图片。');
      setIsStarting('none');
      if (onStatusChange) {
        onStatusChange('等待选择本地文件夹');
      }
    }
  };

  const handleLoadDemoClick = () => {
    setErrorMessage(null);
    setIsStarting('demo');
    if (onStatusChange) {
      onStatusChange('正在准备本地项目');
    }

    try {
      loadDemoPhotos();
      router.push('/processing');
    } catch (err) {
      console.error('Demo load error:', err);
      setErrorMessage('载入 Demo 失败，请重试。');
      setIsStarting('none');
      if (onStatusChange) {
        onStatusChange('等待选择本地文件夹');
      }
    }
  };

  const recentProjects = [
    { name: 'Queenstown Trip', path: '/Users/demo/Pictures/Queenstown', time: '2小时前' },
    { name: 'Family Album', path: '/Users/demo/Pictures/Family_2025', time: '昨天' },
    { name: 'Product Shoot', path: '/Users/demo/Pictures/Workspace_Shoot', time: '3天前' },
  ];

  const steps = [
    { num: '01', label: '选择文件夹' },
    { num: '02', label: '本地扫描' },
    { num: '03', label: '整理' },
    { num: '04', label: 'A/B 对比' },
    { num: '05', label: '安全导出' }
  ];

  return (
    <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full py-4 select-none">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*"
        className="hidden"
      />

      {/* Left/Right Two Columns Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 my-auto">
        {/* Left Column: Action area & basic intro */}
        <div className="md:col-span-7 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-[var(--dt-text-primary)] tracking-tight">
              开始整理本地照片
            </h1>
            <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed max-w-md">
              选择一个本地照片文件夹，AI Photo Cleaner 会先在本地完成基础分析。您的隐私安全受到完全保护。
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleSelectFolderClick}
                disabled={isStarting !== 'none'}
                className="desktop-button-primary space-x-2 text-xs py-3 px-5 shadow-sm shrink-0"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{isStarting === 'upload' ? '准备导入...' : '选择本地照片文件夹'}</span>
              </button>
              
              <button
                onClick={handleLoadDemoClick}
                disabled={isStarting !== 'none'}
                className="desktop-button-secondary space-x-2 text-xs py-3 px-5 shrink-0"
              >
                <span>{isStarting === 'demo' ? '正在载入 Demo...' : '载入 Demo 项目'}</span>
                {isStarting !== 'demo' && <ArrowRight className="w-4 h-4 text-[var(--dt-text-secondary)]" />}
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <p className="text-red-500 text-xs font-medium pt-1 animate-pulse">
                {errorMessage}
              </p>
            )}

            {/* Browser fallback comment */}
            <p className="text-[10px] text-[var(--dt-text-faint)] leading-relaxed">
              * 当前浏览器原型会选择本地图片文件；桌面版将支持完整文件夹授权。
            </p>
          </div>

          {/* Short privacy statement */}
          <div className="text-[10px] text-[var(--dt-text-secondary)] flex items-center space-x-1.5 opacity-80 pt-2 border-t border-[var(--dt-border)] max-w-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6FA887] shrink-0" />
            <span>默认在本地处理原图，联网 AI 默认关闭。</span>
          </div>
        </div>

        {/* Right Column: Recents & Details */}
        <div className="md:col-span-5 space-y-6">
          {/* Recent projects */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold text-[var(--dt-text-secondary)] uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>最近照片项目</span>
            </h3>
            <div className="space-y-2">
              {recentProjects.map((project, idx) => (
                <div 
                  key={idx} 
                  className="bg-[var(--dt-card-bg)] hover:bg-[var(--dt-card-hover-bg)] transition-colors p-3 rounded-lg flex items-center justify-between cursor-pointer border border-[var(--dt-border)]"
                  onClick={() => alert(`模拟载入项目: ${project.name}`)}
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-semibold text-[var(--dt-text-primary)] truncate">{project.name}</div>
                    <div className="text-[9px] text-[var(--dt-text-secondary)] truncate font-mono mt-0.5">
                      {project.path}
                    </div>
                  </div>
                  <div className="text-[9px] text-[var(--dt-text-muted)] shrink-0 font-mono">
                    {project.time}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security & Privacy card */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold text-[var(--dt-text-secondary)] uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--dt-text-secondary)]" />
              <span>安全与隐私保护</span>
            </h3>
            <div className="bg-[var(--dt-panel-bg)] p-3.5 space-y-3 rounded-lg text-xs border border-[var(--dt-border)]">
              <div className="flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-[#6FA887] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--dt-text-primary)] text-xs block">默认本地处理</span>
                  <span className="text-[var(--dt-text-secondary)] text-[10px] leading-relaxed block mt-0.5">
                    默认在本地处理原图，联网 AI 默认关闭。
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <Cpu className="w-4 h-4 text-[#6F8FA8] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--dt-text-primary)] text-xs block">联网 AI 默认关闭</span>
                  <span className="text-[var(--dt-text-secondary)] text-[10px] leading-relaxed block mt-0.5">
                    高级语义识别等联网功能默认关闭，仅在您手动授权后使用。
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <Trash2 className="w-4 h-4 text-[#B89A58] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--dt-text-primary)] text-xs block">淘汰候选不是删除原图</span>
                  <span className="text-[var(--dt-text-secondary)] text-[10px] leading-relaxed block mt-0.5">
                    淘汰候选不是删除原图，导出或移动前必须由用户确认。
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Workflow Preview */}
      <div className="border-t border-[var(--dt-border)] pt-4 mt-6">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {steps.map((step, idx) => (
            <React.Fragment key={idx}>
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded-full border border-[var(--dt-border)] bg-[var(--dt-button-secondary)] text-[var(--dt-text-primary)] font-mono text-[10px] flex items-center justify-center font-bold">
                  {step.num}
                </div>
                <span className="text-[10px] font-semibold text-[var(--dt-text-secondary)]">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-[var(--dt-text-muted)] opacity-60" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LocalProjectStart;
