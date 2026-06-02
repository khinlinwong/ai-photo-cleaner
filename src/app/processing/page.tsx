'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';
import DesktopTopBar from '@/components/desktop/DesktopTopBar';
import DesktopSidebar from '@/components/desktop/DesktopSidebar';
import DesktopStatusBar from '@/components/desktop/DesktopStatusBar';
import LocalScanProgress from '@/components/desktop/LocalScanProgress';
import { AlertCircle } from 'lucide-react';

export default function ProcessingPage() {
  const { 
    photos, 
    isAnalyzing, 
    analysisProgress, 
    startAnalysis,
    currentAnalysisIndex,
    currentAnalysisName,
    resetWorkspace,
    projectName,
    skippedCount,
    failedCount
  } = usePhotoWorkspace();
  
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const hasNativeSource = photos.some(p => p.sourceType === 'native-folder-preview' || p.sourceType === 'native-folder-file');

  // 1. 进入页面后：如果有照片，且尚未开始分析（进度为 0 且未在分析），则自动触发分析
  useEffect(() => {
    if (photos.length > 0 && !isAnalyzing && analysisProgress === 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startAnalysis();
    }
  }, [photos, isAnalyzing, analysisProgress, startAnalysis]);

  // 2. 自动跳转逻辑：当进度到达 100 且分析状态结束，1.5 秒后自动路由至结果页 (如果是 Native Processing，则先不自动跳转 /results)
  useEffect(() => {
    if (analysisProgress === 100 && !isAnalyzing && !hasNativeSource) {
      const timer = setTimeout(() => {
        router.push('/results');
      }, 1550);
      return () => clearTimeout(timer);
    }
  }, [analysisProgress, isAnalyzing, router, hasNativeSource]);

  // 取消扫描
  const handleCancelScan = () => {
    resetWorkspace();
    router.push('/desktop'); // 桌面版原型取消扫描后退回到 /desktop 桌面
  };

  // 状态栏动态联动
  let statusText = '正在读取本地照片...';
  let scanStatus = '进行中';
  let projectStatus = '已创建';
  let nextStep = '整理工作区';

  if (photos.length === 0) {
    statusText = '等待照片导入';
    scanStatus = '未开始';
    projectStatus = '未创建';
    nextStep = '无';
  } else if (analysisProgress === 100 && !isAnalyzing) {
    statusText = '本地扫描分析已完成';
    scanStatus = '已完成';
  } else if (analysisProgress > 0) {
    statusText = `本地扫描中 (${analysisProgress}%)`;
  }

  return (
    <div className="desktop-root">
      <div className="desktop-window">
        {/* Top Window Bar */}
        <DesktopTopBar currentPhase="Local Scan" />
        
        {/* Main Workspace Area (Sidebar + Workspace Panel) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Navigation */}
          <DesktopSidebar activeId="scan" />
          
          {/* Main Working Panel */}
          <main className="flex-1 flex flex-col bg-[var(--dt-workspace-bg)] overflow-y-auto p-8 relative">
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
            
            {/* Case A: No photos loaded */}
            {photos.length === 0 && !isAnalyzing ? (
              <div className="flex-1 flex flex-col justify-center items-center py-10 max-w-xl mx-auto text-center space-y-6 select-none">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B89A58]/10 border border-[#B89A58]/30 text-[#B89A58]">
                  <AlertCircle className="h-6 w-6" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-[var(--dt-text-primary)]">当前没有可处理的照片。</h2>
                  <p className="text-[var(--dt-text-secondary)] text-xs leading-relaxed max-w-sm">
                    请返回开始页重新选择本地照片。
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button 
                    onClick={() => router.push('/desktop')}
                    className="desktop-button-primary text-xs"
                  >
                    返回开始页
                  </button>
                </div>
              </div>
            ) : (
              /* Case B: Has photos, analyzing */
              <LocalScanProgress
                photos={photos}
                isAnalyzing={isAnalyzing}
                analysisProgress={analysisProgress}
                currentAnalysisIndex={currentAnalysisIndex}
                currentAnalysisName={currentAnalysisName}
                projectName={projectName}
                onCancel={handleCancelScan}
                skippedCount={skippedCount}
                failedCount={failedCount}
                hasNativeSource={hasNativeSource}
                onViewResults={() => router.push('/results')}
              />
            )}
          </main>
        </div>
        
        {/* Status Bar */}
        <DesktopStatusBar 
          statusText={statusText} 
          projectStatus={projectStatus}
          scanStatus={scanStatus}
          nextStep={nextStep}
        />
      </div>
    </div>
  );
}
