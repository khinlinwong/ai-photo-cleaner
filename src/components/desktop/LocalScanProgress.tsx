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
  projectName?: string;
  onCancel: () => void;
  skippedCount?: number;
  failedCount?: number;
  hasNativeSource?: boolean;
  onViewResults?: () => void;
}

import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';

export const LocalScanProgress: React.FC<LocalScanProgressProps> = ({
  photos,
  isAnalyzing,
  analysisProgress,
  currentAnalysisIndex,
  currentAnalysisName,
  projectName,
  onCancel,
  skippedCount = 0,
  failedCount = 0,
  hasNativeSource = false,
  onViewResults
}) => {
  const { isNativeProcessingCancelled, cancelNativeProcessing } = usePhotoWorkspace();

  // Count successfully analyzed photos (where category is not default '待分类' and not '已跳过')
  const analyzedCount = photos.filter(p => p.category !== '待分类' && p.category !== '已跳过').length;
  // 动态判断子任务状态
  const getSubtaskStatus = (taskIndex: number) => {
    if (isNativeProcessingCancelled && !isAnalyzing) {
      if (taskIndex <= 1) return 'completed';
      return 'pending';
    }
    if (!isAnalyzing && analysisProgress === 0) return 'pending';

    const total = photos.length;

    switch (taskIndex) {
      case 0: // 读取本地照片 (Reading files)
        if (currentAnalysisIndex >= 0 || analysisProgress > 0) return 'completed';
        if (isAnalyzing) return 'active';
        return 'pending';

      case 1: // 分析清晰度与曝光 (Analyzing focus & exposure)
        if (isAnalyzing && currentAnalysisIndex >= 0 && currentAnalysisIndex < total - 1) return 'active';
        if (currentAnalysisIndex >= total - 1 || analysisProgress === 100) return 'completed';
        return 'pending';

      case 2: // 识别相似照片 (Identifying similar groups)
        if (analysisProgress === 100 && isAnalyzing) return 'active';
        if (analysisProgress === 100 && !isAnalyzing) return 'completed';
        return 'pending';

      case 3: // 准备整理结果 (Preparing results)
        if (analysisProgress === 100 && isAnalyzing) return 'active';
        if (analysisProgress === 100 && !isAnalyzing) return 'completed';
        return 'pending';

      case 4: // 进入整理结果页 (Entering results view)
        if (analysisProgress === 100 && !isAnalyzing) return 'completed';
        if (analysisProgress === 100) return 'active';
        return 'pending';

      default:
        return 'pending';
    }
  };

  const tasks = [
    { label: '读取本地照片', desc: 'Reading files', index: 0 },
    { label: '分析清晰度与曝光', desc: 'Analyzing focus & exposure', index: 1 },
    { label: '识别相似照片', desc: 'Identifying similar groups', index: 2 },
    { label: '准备整理结果', desc: 'Preparing results', index: 3 },
    { label: '进入整理结果页', desc: 'Entering results view', index: 4 }
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
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-[var(--dt-text-primary)]">
              {isNativeProcessingCancelled 
                ? '本地扫描已停止'
                : (analysisProgress === 100 && !isAnalyzing ? '本地分析已完成' : '正在本地分析照片')}
            </h1>
            {projectName && (
              <span className="text-[10px] text-[var(--dt-text-secondary)] font-mono bg-white/5 px-2 py-0.5 rounded border border-[var(--dt-border)] truncate max-w-[200px]" title={projectName}>
                项目: {projectName}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed max-w-md">
            {isNativeProcessingCancelled
              ? (analyzedCount > 0 
                  ? '已停止分析。已完成的结果已保留，原图保持不变。'
                  : '暂无可查看结果，请返回重新选择照片。')
              : (hasNativeSource
                  ? '本地处理 / 原图保持不变 / 不上传云端。整理结果可在后续手动调整。'
                  : '照片只在本机浏览器中处理，不会上传云端。原图保持不变，整理结果可在下一步手动调整。')}
          </p>
        </div>

        {/* Buttons during active analysis */}
        {analysisProgress < 100 && isAnalyzing && !isNativeProcessingCancelled && (
          <div className="flex items-center space-x-2.5">
            {hasNativeSource && (
              <button
                onClick={cancelNativeProcessing}
                className="flex items-center space-x-1.5 text-xs text-yellow-500 hover:text-white bg-yellow-500/15 hover:bg-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-lg transition-all"
              >
                <span>停止分析</span>
              </button>
            )}
            <button
              onClick={onCancel}
              className="flex items-center space-x-1.5 text-xs text-[#B96F68] hover:text-white bg-[#B96F68]/15 hover:bg-[#B96F68] border border-[#B96F68]/20 px-3 py-1.5 rounded-lg transition-all"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>取消扫描</span>
            </button>
          </div>
        )}

        {/* Buttons during Stopping transition (isNativeProcessingCancelled is true, but isAnalyzing is still true) */}
        {analysisProgress < 100 && isAnalyzing && isNativeProcessingCancelled && (
          <div className="flex items-center space-x-2.5">
            <button
              disabled
              className="flex items-center space-x-1.5 text-xs text-yellow-500/60 bg-yellow-500/5 border border-yellow-500/10 px-3 py-1.5 rounded-lg cursor-not-allowed"
            >
              <span>正在停止…</span>
            </button>
          </div>
        )}

        {/* Buttons after stopped/completed */}
        {((analysisProgress === 100 && !isAnalyzing) || (isNativeProcessingCancelled && !isAnalyzing)) && hasNativeSource && (
          <div className="flex items-center space-x-2.5">
            <button
              onClick={onCancel}
              className="flex items-center space-x-1.5 text-xs text-[var(--dt-text-secondary)] hover:text-white bg-white/5 hover:bg-white/10 border border-[var(--dt-border)] px-3.5 py-1.5 rounded-lg transition-all"
            >
              {analyzedCount > 0 ? '重新选择文件夹' : '返回开始页'}
            </button>
            {analyzedCount > 0 && (
              <button
                onClick={() => onViewResults?.()}
                className="flex items-center space-x-1.5 text-xs font-semibold text-white bg-[var(--dt-button-primary)] hover:bg-[var(--dt-button-primary-hover)] px-4 py-1.5 rounded-lg transition-all shadow-md"
              >
                查看整理结果
              </button>
            )}
          </div>
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
                ? '✅ 分析完成，正在进入结果页...' 
                : analysisProgress === 100 && isAnalyzing
                  ? '🔍 正在识别相似照片并整理结果...'
                  : currentAnalysisIndex >= 0
                    ? `⚙️ 正在分析第 ${currentAnalysisIndex + 1}/${photos.length} 张图片: ${currentAnalysisName || ''}`
                    : '⚡ 正在初始化本地扫描计算模块...'}
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

            {hasNativeSource && (
              <>
                <div className="bg-[var(--dt-panel-bg)] p-3 rounded-lg border border-[var(--dt-border)] text-center">
                  <span className="text-[9px] font-mono text-[var(--dt-text-secondary)] block uppercase">已跳过照片</span>
                  <span className="text-xl font-bold text-yellow-500/80 font-mono block mt-1">
                    {skippedCount}
                  </span>
                </div>

                <div className="bg-[var(--dt-panel-bg)] p-3 rounded-lg border border-[var(--dt-border)] text-center">
                  <span className="text-[9px] font-mono text-[var(--dt-text-secondary)] block uppercase">分析失败</span>
                  <span className="text-xl font-bold text-red-500/80 font-mono block mt-1">
                    {failedCount}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Privacy Box */}
          <div className="bg-[var(--dt-panel-bg-solid)] p-3.5 rounded-lg border border-[var(--dt-border)] text-xs space-y-2">
            <div className="flex items-center space-x-2 text-[var(--dt-text-primary)] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#6FA887]" />
              <span>本地数据安全说明</span>
            </div>
            <ul className="space-y-1 text-[10px] text-[var(--dt-text-secondary)] list-disc pl-4 leading-relaxed">
              <li>本地处理，不上传云端。</li>
              <li>原图保持不变，整理结果可在后续手动调整。</li>
              {hasNativeSource ? (
                <>
                  <li>本地分析已完成，原图保持不变。</li>
                  <li>部分照片可能因格式或读取原因未完成分析并跳过。</li>
                  <li>请点击“查看整理结果”手动查看。</li>
                </>
              ) : (
                <li>完成后会进入整理结果页，您可以继续标记保留或淘汰候选。</li>
              )}
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
        
        <div className="bg-[var(--dt-panel-bg)] rounded-lg p-3.5 h-[134px] overflow-hidden border border-[var(--dt-border)] relative flex items-center">
          {revealPhotos.length === 0 ? (
            <div className="h-[100px] w-full flex items-center justify-center text-xs text-[var(--dt-text-muted)]">
              正在初始化本地照片通道...
            </div>
          ) : (
            <div className="w-full overflow-hidden relative">
              <div 
                className="flex flex-row gap-2.5 transition-transform duration-300 ease-out w-max"
                style={{ transform: `translateX(-${Math.max(0, revealPhotos.length - 8) * 106}px)` }}
              >
                {revealPhotos.map((photo, index) => {
                  const isCurrent = index === currentAnalysisIndex && analysisProgress < 100;
                  const isExited = index < revealPhotos.length - 8;
                  
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
                      key={`${photo.id}-${isCurrent}`} 
                      className={`relative w-[96px] h-[96px] shrink-0 rounded-md overflow-hidden bg-black/20 border transition-all duration-300 shadow-sm animate-scan-card-pop ${
                        isCurrent ? 'border-[var(--dt-border-strong)] ring-1 ring-[var(--dt-border-strong)]' : 'border-[var(--dt-border)]'
                      } ${
                        isExited ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100'
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocalScanProgress;
