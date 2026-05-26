import React from 'react';
import { 
  CheckCircle2, 
  Loader2, 
  XCircle, 
  ShieldCheck
} from 'lucide-react';

export interface PhotoItem {
  id: string;
  url: string;
  name: string;
  size: string;
  status: 'keep' | 'review' | 'delete';
  issue: 'good' | 'blurry' | 'overexposed' | 'underexposed' | 'needs_review';
  score: number;
  blurValue: number;
  exposureValue: number;
  resolution: string;
  category: string;
  displayLabel?: string;
  duplicateGroupId?: string | null;
}

interface LocalScanProgressProps {
  photos: PhotoItem[];
  isAnalyzing: boolean;
  analysisProgress: number;
  currentAnalysisIndex: number;
  currentAnalysisName: string;
  onCancel: () => void;
}

export const LocalScanProgress: React.FC<LocalScanProgressProps> = ({
  photos,
  isAnalyzing,
  analysisProgress,
  currentAnalysisIndex,
  currentAnalysisName,
  onCancel
}) => {
  // 动态判断子任务状态
  const getSubtaskStatus = (taskIndex: number) => {
    if (analysisProgress === 0) return 'pending';

    switch (taskIndex) {
      case 0:
        if (analysisProgress >= 15) return 'completed';
        return 'active';
      case 1:
        if (analysisProgress >= 75) return 'completed';
        if (analysisProgress >= 15) return 'active';
        return 'pending';
      case 2:
        if (analysisProgress >= 95) return 'completed';
        if (analysisProgress >= 75) return 'active';
        return 'pending';
      case 3:
        if (analysisProgress === 100 && !isAnalyzing) return 'completed';
        if (analysisProgress >= 95) return 'active';
        return 'pending';
      default:
        return 'pending';
    }
  };

  const tasks = [
    { label: '读取本地照片像素流', desc: 'Reading files', index: 0 },
    { label: '清晰度与对焦质量分析', desc: 'Checking focus & blur', index: 1 },
    { label: '曝光度与环境亮度检测', desc: 'Checking exposure levels', index: 2 },
    { label: '感知哈希提取与相似性分组', desc: 'Grouping similar photos', index: 3 }
  ];

  // 统计指标
  const processedCount = Math.min(
    analysisProgress === 100 && !isAnalyzing ? photos.length : currentAnalysisIndex + 1, 
    photos.length
  );
  
  const blurCount = photos.filter(p => 
    (p.blurValue > 50 || p.issue === 'blurry') && 
    (photos.indexOf(p) <= currentAnalysisIndex || (analysisProgress === 100 && !isAnalyzing))
  ).length;

  const exposureCount = photos.filter(p => 
    (Math.abs(p.exposureValue) > 30 || p.issue === 'needs_review' || p.issue === 'overexposed' || p.issue === 'underexposed') && 
    (photos.indexOf(p) <= currentAnalysisIndex || (analysisProgress === 100 && !isAnalyzing))
  ).length;

  const similarCount = photos.filter(p => 
    p.duplicateGroupId && 
    (photos.indexOf(p) <= currentAnalysisIndex || (analysisProgress === 100 && !isAnalyzing))
  ).length;

  const revealPhotos = photos.filter((p, index) => 
    index <= currentAnalysisIndex || (analysisProgress === 100 && !isAnalyzing)
  );

  return (
    <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full py-2 select-none">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-[var(--dt-border)] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[var(--dt-text-primary)]">
            {analysisProgress === 100 && !isAnalyzing ? '本地扫描分析已完成' : '正在本地扫描照片'}
          </h1>
          <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed max-w-md">
            {analysisProgress === 100 && !isAnalyzing
              ? '分析已完成，正在流转至整理工作区...'
              : `AI Photo Cleaner 正在分析清晰度、曝光和相似照片组。此阶段默认在本地处理原图。`}
          </p>
        </div>

        {analysisProgress < 100 && (
          <button
            onClick={onCancel}
            className="flex items-center space-x-1.5 text-xs text-[#B96F68] hover:text-white bg-[#B96F68]/15 hover:bg-[#B96F68] border border-[#B96F68]/20 px-3 py-1.5 rounded-lg transition-all"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>取消扫描</span>
          </button>
        )}
      </div>

      {/* Progress & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-6">
        {/* Left Column: Progress details */}
        <div className="md:col-span-7 space-y-5">
          {/* Progress bar */}
          <div className="bg-[var(--dt-panel-bg)] p-4 rounded-lg border border-[var(--dt-border)] space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[var(--dt-text-secondary)]">扫描总体进度</span>
              <span className="font-mono text-[var(--dt-text-primary)]">{analysisProgress}%</span>
            </div>
            
            {/* Dark Mode Slider Track */}
            <div className="h-3 w-full bg-[var(--dt-window-bg)] rounded-full p-[2px] border border-[var(--dt-border)] overflow-hidden">
              <div 
                className="h-full bg-[var(--dt-button-primary)] rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${analysisProgress}%` }}
              />
            </div>

            <div className="text-[10px] text-[var(--dt-text-secondary)] truncate font-mono">
              {analysisProgress === 100 && !isAnalyzing 
                ? '准备就绪' 
                : `正在读取: ${currentAnalysisName || '初始化通道...'}`}
            </div>
          </div>

          {/* Task Pipeline List */}
          <div className="space-y-2">
            {tasks.map((task) => {
              const status = getSubtaskStatus(task.index);
              return (
                <div 
                  key={task.index}
                  className="bg-[var(--dt-panel-bg)] p-3 rounded-lg border border-[var(--dt-border)] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-3">
                    {status === 'completed' && (
                      <CheckCircle2 className="w-4.5 h-4.5 text-[#6FA887] shrink-0" />
                    )}
                    {status === 'active' && (
                      <Loader2 className="w-4.5 h-4.5 text-[var(--dt-text-primary)] shrink-0 animate-spin" />
                    )}
                    {status === 'pending' && (
                      <div className="w-4.5 h-4.5 rounded-full border border-[var(--dt-border)] shrink-0 bg-[var(--dt-window-bg)]" />
                    )}
                    <div>
                      <span className={`font-semibold block ${
                        status === 'completed' 
                          ? 'text-[var(--dt-text-muted)] line-through' 
                          : status === 'active' 
                            ? 'text-[var(--dt-text-primary)]' 
                            : 'text-[var(--dt-text-faint)]'
                      }`}>
                        {task.label}
                      </span>
                      <span className="text-[9px] font-mono text-[var(--dt-text-faint)]">{task.desc}</span>
                    </div>
                  </div>

                  <div>
                    {status === 'completed' && (
                      <span className="text-[9px] font-mono text-[#6FA887] bg-[#6FA887]/15 px-2 py-0.5 rounded border border-[#6FA887]/25 font-bold">DONE</span>
                    )}
                    {status === 'active' && (
                      <span className="text-[9px] font-mono text-[var(--dt-text-primary)] bg-[var(--dt-nav-active-bg)] px-2 py-0.5 rounded animate-pulse border border-[var(--dt-border-strong)] font-bold">RUNNING</span>
                    )}
                    {status === 'pending' && (
                      <span className="text-[9px] font-mono text-[var(--dt-text-faint)] bg-[var(--dt-window-bg)] px-2 py-0.5 rounded border border-[var(--dt-border)]">QUEUED</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Statistics */}
        <div className="md:col-span-5 space-y-4">
          {/* Counters Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--dt-panel-bg)] p-3 rounded-lg border border-[var(--dt-border)] text-center">
              <span className="text-[9px] font-mono text-[var(--dt-text-secondary)] block uppercase">已分析照片</span>
              <span className="text-xl font-bold text-[var(--dt-text-primary)] font-mono block mt-1">
                {processedCount} / {photos.length}
              </span>
            </div>
            
            <div className="bg-[var(--dt-panel-bg)] p-3 rounded-lg border border-[var(--dt-border)] text-center">
              <span className="text-[9px] font-mono text-[var(--dt-text-secondary)] block uppercase">模糊候选</span>
              <span className="text-xl font-bold text-[#B96F68] font-mono block mt-1">
                {blurCount}
              </span>
            </div>

            <div className="bg-[var(--dt-panel-bg)] p-3 rounded-lg border border-[var(--dt-border)] text-center">
              <span className="text-[9px] font-mono text-[var(--dt-text-secondary)] block uppercase">曝光候选</span>
              <span className="text-xl font-bold text-[#B89A58] font-mono block mt-1">
                {exposureCount}
              </span>
            </div>

            <div className="bg-[var(--dt-panel-bg)] p-3 rounded-lg border border-[var(--dt-border)] text-center">
              <span className="text-[9px] font-mono text-[var(--dt-text-secondary)] block uppercase">相似重复</span>
              <span className="text-xl font-bold text-[#6F8FA8] font-mono block mt-1">
                {similarCount}
              </span>
            </div>
          </div>

          {/* Privacy Box */}
          <div className="bg-[var(--dt-panel-bg-solid)] p-3.5 rounded-lg border border-[var(--dt-border)] text-xs space-y-2">
            <div className="flex items-center space-x-2 text-[var(--dt-text-primary)] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#6FA887]" />
              <span>本阶段安全防护说明</span>
            </div>
            <ul className="space-y-1 text-[10px] text-[var(--dt-text-secondary)] list-disc pl-4 leading-relaxed">
              <li>默认在本地处理原图，联网 AI 默认关闭。</li>
              <li>原图在本地沙箱进行安全分析，不上传云端。</li>
              <li>本阶段不会主动上传任何本地原图或特征特征。</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Picture Pipeline Stream */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between border-b border-[var(--dt-border)] pb-1.5">
          <h3 className="text-[11px] font-bold text-[var(--dt-text-secondary)] uppercase tracking-wider">本地照片流</h3>
          <span className="text-[9px] text-[var(--dt-text-muted)] font-mono">
            已载入 {revealPhotos.length} / {photos.length} 张图片
          </span>
        </div>
        
        <div className="bg-[var(--dt-panel-bg)] rounded-lg p-3.5 min-h-[140px] max-h-[220px] overflow-y-auto border border-[var(--dt-border)]">
          {revealPhotos.length === 0 ? (
            <div className="h-[100px] flex items-center justify-center text-xs text-[var(--dt-text-muted)]">
              正在初始化本地照片通道...
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
              {revealPhotos.map((photo, index) => {
                const isCurrent = index === currentAnalysisIndex && analysisProgress < 100;
                
                let statusText = "已分析";
                let statusColor = "bg-[#6FA887]/15 text-[#6FA887] border-[#6FA887]/25";
                
                if (isCurrent) {
                  statusText = "分析中";
                  statusColor = "bg-[var(--dt-nav-active-bg)] text-[var(--dt-text-primary)] border-[var(--dt-border-strong)] animate-pulse font-bold";
                } else if (photo.status === 'delete') {
                  statusText = "淘汰候选";
                  statusColor = "bg-[#B96F68]/15 text-[#B96F68] border-[#B96F68]/25";
                }
                
                return (
                  <div 
                    key={photo.id} 
                    className={`relative aspect-square rounded-md overflow-hidden bg-black/20 border transition-all duration-200 shadow-sm ${
                      isCurrent ? 'border-[var(--dt-border-strong)] ring-1 ring-[var(--dt-border-strong)]' : 'border-[var(--dt-border)]'
                    }`}
                  >
                    <img 
                      src={photo.url} 
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-1">
                      <span className="text-[7.5px] text-[#EEF2F6] truncate max-w-full font-mono font-medium block" title={photo.name}>
                        {photo.name}
                      </span>
                      <span className={`text-[6.5px] px-1 py-0.2 rounded border font-bold origin-left scale-90 mt-0.5 inline-block text-center truncate ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocalScanProgress;
