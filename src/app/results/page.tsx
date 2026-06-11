'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePhotoWorkspace, PhotoItem, ActiveBattleState } from '@/context/PhotoWorkspaceContext';
import { getUserVisibleBucket, getReasonTags } from '@/lib/utils/photoLabelMapping';
import DesktopTopBar from '@/components/desktop/DesktopTopBar';
import DesktopSidebar from '@/components/desktop/DesktopSidebar';
import DesktopStatusBar from '@/components/desktop/DesktopStatusBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  AlertTriangle,
  Sun,
  Sliders,
  FolderSync,
  GitCompare,
  X,
  Maximize2,
  FolderOpen,
  Search
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";
import VirtualPhotoGrid from '@/components/desktop/VirtualPhotoGrid';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { buildManifestRows, buildManifestCsv, buildManifestJson } from '@/lib/export/exportManifest';
import { buildZipExportFilename, buildManifestExportFilename } from '@/lib/export/exportFilenames';
import { ResultsSummaryCards } from '@/components/results/ResultsSummaryCards';
import { ExportPanel } from '@/components/results/ExportPanel';
import { PhotoBucketSection } from '@/components/results/PhotoBucketSection';
import { selectPhysicalOrgOutputFolder, createPhysicalOrgDryRun, executePhysicalOrgCopy, clearPhysicalOrgSession } from '@/lib/desktop/physicalOrgBridge';
import { PhysicalOrgDryRunResult, PhysicalOrgExecutionResult } from '@/lib/desktop/physicalOrgTypes';


// 延时辅助函数
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 路径脱敏辅助函数
const sanitizePathString = (str: string): string => {
  if (!str) return '';
  const cleaned = str
    .replace(/[a-zA-Z]:\\[^:?*"<>|\r\n\t]+/g, '<路径>')
    .replace(/\/[^\s"']+\/[^\s"']+/g, '<路径>');

  if (cleaned.includes("该整理计划已执行或已失效") || cleaned.includes("整理计划已执行")) {
    return "整理计划已执行，请重新生成整理计划。";
  }
  if (cleaned.includes("输出位置已失效") || cleaned.includes("无效或已过期的输出文件夹标识") || cleaned.includes("输出位置不可用")) {
    return "输出位置不可用，请重新选择输出位置。";
  }
  return cleaned;
};

interface ResultsPhotoCardProps {
  photo: PhotoItem;
  index: number;
  isSelected: boolean;
  getPhotoDisplayName: (photo: PhotoItem) => string;
  renderIssueBadge: (photo: PhotoItem) => React.ReactNode;
  toggleSelectPhoto: (id: string) => void;
  updatePhotoStatus: (id: string, status: 'keep' | 'review' | 'delete') => void;
  openDetail: (photo: PhotoItem) => void;
  setPreviewPhoto: (photo: PhotoItem) => void;
  setPreviewScale: (scale: number) => void;
  setPreviewX: (x: number) => void;
  setPreviewY: (y: number) => void;
}

const ResultsPhotoCard: React.FC<ResultsPhotoCardProps> = ({
  photo,
  index,
  isSelected,
  getPhotoDisplayName,
  renderIssueBadge,
  toggleSelectPhoto,
  updatePhotoStatus,
  openDetail,
  setPreviewPhoto,
  setPreviewScale,
  setPreviewX,
  setPreviewY,
}) => {
  const [imageError, setImageError] = useState(false);
  const reasonTag = getReasonTags(photo);

  useEffect(() => {
    setImageError(false);
  }, [photo.id, photo.url]);

  return (
    <Card 
      style={{
        animationDelay: `${Math.min((index % 20) * 20, 120)}ms`
      }}
      className={cn(
        "w-full h-full overflow-visible rounded-lg border transition-all duration-200 relative shadow-sm hover:shadow-md flex flex-col justify-between animate-card-pop",
        isSelected
          ? "border-emerald-500/80 bg-emerald-500/5 ring-1 ring-emerald-500/35"
          : getUserVisibleBucket(photo) === 'cull'
          ? "border-[#B96F68]/20 bg-[#B96F68]/[0.02] hover:border-[#B96F68]/50 hover:bg-[#B96F68]/10" 
          : "border-emerald-500/15 bg-emerald-500/[0.02] hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]"
      )}
    >
      {/* Image Section */}
      <div 
        className="group relative h-[100px] w-full overflow-hidden bg-neutral-800/20 rounded-t-lg cursor-pointer select-none"
        onClick={() => {
          setPreviewPhoto(photo);
          setPreviewScale(1);
          setPreviewX(0);
          setPreviewY(0);
        }}
      >
        {imageError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 border border-white/5 text-[var(--dt-text-soft)] gap-1">
            <AlertTriangle className="h-5 w-5 text-amber-500/80" />
            <span className="text-[10px] font-medium">预览不可用</span>
          </div>
        ) : (
          <>
            <img
              src={photo.url}
              alt={getPhotoDisplayName(photo)}
              className="w-full h-full object-contain bg-neutral-800/50"
              onError={() => setImageError(true)}
            />
            {/* Light hover overlay with magnifier icon and "预览大图" */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none rounded-t-lg">
              <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded text-white text-[10px] backdrop-blur-sm">
                <Search className="h-3 w-3" />
                <span>预览大图</span>
              </div>
            </div>
          </>
        )}
        <div className="absolute top-1.5 left-1.5 z-10 scale-[0.8] origin-top-left">
          {renderIssueBadge(photo)}
        </div>
        {/* Checkbox Overlay */}
        <button
          type="button"
          className={cn(
            "absolute top-1.5 right-1.5 z-20 flex h-4 w-4 items-center justify-center rounded-full border transition-all shadow-md focus:outline-none",
            isSelected
              ? "bg-emerald-500 border-emerald-400 text-white"
              : "bg-black/40 border-white/40 text-transparent hover:border-white hover:bg-black/60"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelectPhoto(photo.id);
          }}
        >
          {isSelected && <span className="text-[8px] font-bold">✓</span>}
        </button>
      </div>

      {/* Info details */}
      <CardContent className="p-2 flex-1 flex flex-col justify-between text-left relative">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1 leading-tight">
            <p className="text-[10px] font-bold text-[var(--dt-text-primary)] truncate flex-grow" title={getPhotoDisplayName(photo)}>
              {getPhotoDisplayName(photo)}
            </p>
            <span className="text-[8px] text-[var(--dt-text-soft)] shrink-0 font-mono">{photo.size}</span>
          </div>

          {/* 简单原因标签 (隐藏用户选择) */}
          {reasonTag !== '用户选择' && (
            <div className="flex items-center mt-0.5">
              <span className="text-[8px] text-[var(--dt-text-secondary)] font-medium bg-white/5 px-1 py-0.5 rounded leading-none font-sans">
                {reasonTag}
              </span>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between gap-1.5 mt-1.5 border-t border-white/5 pt-1.5 shrink-0">
          <details className="text-[9px] text-[var(--dt-text-soft)] cursor-pointer mt-0 select-none shrink-0 relative">
            <summary className="hover:text-[var(--dt-text-primary)] list-none flex items-center gap-0.5 font-semibold">
              <span className="text-[7px]">▶</span> 详情
            </summary>
            <div className="absolute bottom-[24px] left-0 bg-[#12161A]/95 border border-white/10 p-2.5 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-20 font-mono space-y-0.5 backdrop-blur-md w-[150px] text-[8px] leading-tight">
              <p>综合质量: {photo.score} / 100</p>
              <p>清晰对焦: {photo.sharpnessScore} / 100</p>
              <p>曝光亮度: {photo.exposureScore} / 100</p>
              <div className="pt-1.5 flex items-center justify-end border-t border-white/5 mt-1.5">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(photo);
                  }}
                  className="text-[8px] text-yellow-400 hover:underline flex items-center gap-0.5"
                >
                  <Maximize2 className="h-2.5 w-2.5" /> 像素诊断仪
                </button>
              </div>
            </div>
          </details>

          {getUserVisibleBucket(photo) === 'keep' ? (
            <Button
              size="sm"
              variant="outline"
              className="h-5 px-1 text-[8.5px] flex items-center justify-center rounded transition-all font-semibold border-0 bg-white/5 hover:bg-[#B96F68]/20 hover:text-[#B96F68] text-[var(--dt-text-muted)] flex-1"
              onClick={() => updatePhotoStatus(photo.id, 'delete')}
            >
              标记为淘汰候选
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-5 px-1 text-[8.5px] flex items-center justify-center rounded transition-all font-semibold border-0 bg-white/5 hover:bg-[#6FA887]/20 hover:text-[#6FA887] text-[var(--dt-text-muted)] flex-1"
              onClick={() => updatePhotoStatus(photo.id, 'keep')}
            >
              标记为保留
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function ResultsPage() {
  const {
    photos,
    updatePhotoStatus: contextUpdatePhotoStatus,
    updateMultiplePhotosStatus: contextUpdateMultiplePhotosStatus,
    resetWorkspace: contextResetWorkspace,
    loadDemoPhotos: contextLoadDemoPhotos,
    similarGroups,
    activeBattle,
    startBattleForGroup,
    applyBattleDecision: contextApplyBattleDecision,
    closeBattle,
    projectName,
    isAnalyzing,
    analysisProgress,
    isNativeProcessingCancelled,
    skippedCount,
    failedCount,
    nativeSourceMode
  } = usePhotoWorkspace();

  interface UndoAction {
    actionLabel: string;
    affectedPhotos: Array<{
      photoId: string;
      previousStatus: 'keep' | 'review' | 'delete';
    }>;
    createdAt: number;
  }

  const router = useRouter();
  const hasNativeSource = photos.some(p => p.sourceType === 'native-folder-preview' || p.sourceType === 'native-folder-file');
  const getPhotoDisplayName = useCallback((photo: PhotoItem) => {
    if (!photo) return '';
    if (hasNativeSource) {
      const idx = photos.findIndex(p => p.id === photo.id);
      if (idx !== -1) {
        return `Photo-${String(idx + 1).padStart(3, '0')}`;
      }
    }
    return photo.name || '';
  }, [hasNativeSource, photos]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [filteredGroupId, setFilteredGroupId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipExportWarning, setZipExportWarning] = useState<string | null>(null);
  const [abGuidanceDismissed, setAbGuidanceDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.sessionStorage.getItem('ab_guidance_dismissed') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const dismissAbGuidance = useCallback(() => {
    setAbGuidanceDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('ab_guidance_dismissed', 'true');
      } catch {}
    }
  }, []);
  const [activeTab, setActiveTab] = useState<'keep' | 'cull' | 'similar' | 'battle-status'>('keep');
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewX, setPreviewX] = useState(0);
  const [previewY, setPreviewY] = useState(0);
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [previewDragStart, setPreviewDragStart] = useState({ x: 0, y: 0 });
  const [isAnimateIn, setIsAnimateIn] = useState(false);

  const closePreviewModal = useCallback(() => {
    setIsAnimateIn(false);
    setTimeout(() => {
      setPreviewPhoto(null);
    }, 400);
  }, []);

  const handlePreviewWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const scaleFactor = 0.15;
    const delta = e.deltaY < 0 ? scaleFactor : -scaleFactor;

    setPreviewScale(prev => {
      const next = Math.min(Math.max(prev + delta, 1), 5);
      if (next === 1) {
        setPreviewX(0);
        setPreviewY(0);
      } else {
        const ratio = next / prev;
        setPreviewX(prevX => (mx - cx) - (mx - cx - prevX) * ratio);
        setPreviewY(prevY => (my - cy) - (my - cy - prevY) * ratio);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (previewPhoto) {
      const timer = setTimeout(() => {
        setIsAnimateIn(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsAnimateIn(false);
    }
  }, [previewPhoto]);

  // 当 Tab 切换时，自动清除相似组过滤状态
  useEffect(() => {
    setFilteredGroupId(null);
  }, [activeTab]);
  const [exportOpen, setExportOpen] = useState(false);
  const [isFolderExporting, setIsFolderExporting] = useState(false);
  const [folderExportStatus, setFolderExportStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [folderExportResultCount, setFolderExportResultCount] = useState(0);
  const [folderExportError, setFolderExportError] = useState<string | null>(null);
  const [isExportClosing, setIsExportClosing] = useState(false);
  const [localActiveBattle, setLocalActiveBattle] = useState<ActiveBattleState | null>(null);
  const [isBattleClosing, setIsBattleClosing] = useState(false);

  const lastGroupIdRef = useRef<string | null>(null);
  const isTransitioningRef = useRef(false);

  // 导出面板锚定元素 rect
  const [exportAnchorRect, setExportAnchorRect] = useState<DOMRect | null>(null);

  // 本地物理整理组织状态
  const [physicalOrgDialogOpen, setPhysicalOrgDialogOpen] = useState(false);
  const [physicalOrgStep, setPhysicalOrgStep] = useState<1 | 2 | 3 | 4>(1);
  const [physicalOrgToken, setPhysicalOrgToken] = useState<string | null>(null);
  const [physicalOrgLabel, setPhysicalOrgLabel] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<PhysicalOrgDryRunResult | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [isExecutingCopy, setIsExecutingCopy] = useState(false);
  const [executionResult, setExecutionResult] = useState<PhysicalOrgExecutionResult | null>(null);
  const [hasExecutedCopy, setHasExecutedCopy] = useState(false);

  const handleClosePhysicalOrgDialog = useCallback(async () => {
    setPhysicalOrgDialogOpen(false);
    setTimeout(async () => {
      setPhysicalOrgStep(1);
      setPhysicalOrgToken(null);
      setPhysicalOrgLabel(null);
      setDryRunResult(null);
      setOrgError(null);
      setIsGeneratingPlan(false);
      setIsExecutingCopy(false);
      setExecutionResult(null);
      setHasExecutedCopy(false);
      await clearPhysicalOrgSession();
    }, 300);
  }, []);

  const handleSelectOutputFolder = async () => {
    setOrgError(null);
    try {
      const res = await selectPhysicalOrgOutputFolder();
      if (res) {
        setPhysicalOrgToken(res[0]);
        setPhysicalOrgLabel(res[1]);
      } else {
        setOrgError("输出位置不可用，请重新选择输出位置。");
      }
    } catch {
      setOrgError("输出位置不可用，请重新选择输出位置。");
    }
  };

  const handleGeneratePlan = async () => {
    if (!physicalOrgToken) return;
    setIsGeneratingPlan(true);
    setOrgError(null);
    setHasExecutedCopy(false);
    setExecutionResult(null);
    try {
      const requestItems = photos.map(photo => ({
        photoId: photo.id,
        displayName: getPhotoDisplayName(photo),
        targetBucket: (getUserVisibleBucket(photo) === 'keep' ? 'keep' : 'cull-candidate') as 'keep' | 'cull-candidate'
      }));

      const res = await createPhysicalOrgDryRun({
        outputFolderToken: physicalOrgToken,
        items: requestItems
      });

      if (res) {
        setDryRunResult(res);
        setPhysicalOrgStep(3);
      } else {
        setOrgError("生成整理计划失败，请重试。");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setOrgError(sanitizePathString(errMsg || "生成整理计划发生错误。"));
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleExecuteCopy = async () => {
    if (!dryRunResult?.planId) return;
    setIsExecutingCopy(true);
    setOrgError(null);
    try {
      const res = await executePhysicalOrgCopy(dryRunResult.planId);
      setHasExecutedCopy(true);
      if (res) {
        setExecutionResult(res);
        setPhysicalOrgStep(4);
      } else {
        setOrgError("执行物理复制失败，请检查输出文件夹权限或可用空间。");
      }
    } catch (err) {
      setHasExecutedCopy(true);
      const errMsg = err instanceof Error ? err.message : String(err);
      setOrgError(sanitizePathString(errMsg || "执行复制时发生错误。"));
    } finally {
      setIsExecutingCopy(false);
    }
  };

  // A/B 对局中胜出者保持在原位置的 UI 侧状态：'left' 或 'right'
  const [winnerSide, setWinnerSide] = useState<'left' | 'right'>('left');

  // 包装对局决策函数，实现 0 延迟即时决策切换
  const applyBattleDecision = useCallback((decision: 'keep_left' | 'keep_right' | 'keep_both' | 'cull_both' | 'skip') => {
    if (decision === 'keep_left' || decision === 'keep_right') {
      // 区分屏幕视觉上的 keep_left/keep_right，根据当前 winnerSide 映射到实际状态机的决策
      const targetDecision = winnerSide === 'left'
        ? (decision === 'keep_left' ? 'keep_left' : 'keep_right')
        : (decision === 'keep_left' ? 'keep_right' : 'keep_left');

      const nextSide = decision === 'keep_left' ? 'left' : 'right';
      setWinnerSide(nextSide);
      contextApplyBattleDecision(targetDecision);
    } else {
      contextApplyBattleDecision(decision);
    }
  }, [winnerSide, contextApplyBattleDecision]);

  // 对比对局组流转（进入下一组）的 winnerSide 重置，无延迟
  useEffect(() => {
    if (activeBattle?.groupId) {
      if (lastGroupIdRef.current && lastGroupIdRef.current !== activeBattle.groupId) {
        setWinnerSide('left');
      } else if (!lastGroupIdRef.current) {
        setWinnerSide('left');
      }
      lastGroupIdRef.current = activeBattle.groupId;
    } else {
      lastGroupIdRef.current = null;
    }
  }, [activeBattle?.groupId]);

  // 最近一次手动决策操作撤销状态
  const [lastDecisionAction, setLastDecisionAction] = useState<UndoAction | null>(null);

  // 本地包裹的用户单张照片决策订正
  const updatePhotoStatus = useCallback((id: string, status: 'keep' | 'review' | 'delete') => {
    const photo = photos.find(p => p.id === id);
    if (photo) {
      setLastDecisionAction({
        actionLabel: status === 'keep' ? '标记为保留' : '标记为淘汰候选',
        affectedPhotos: [{ photoId: id, previousStatus: photo.status }],
        createdAt: Date.now()
      });
    }
    contextUpdatePhotoStatus(id, status);
  }, [photos, contextUpdatePhotoStatus]);

  // 本地包裹的用户多张照片批量决策订正
  const updateMultiplePhotosStatus = useCallback((ids: string[], status: 'keep' | 'review' | 'delete') => {
    const affected = ids.map(id => {
      const photo = photos.find(p => p.id === id);
      return photo ? { photoId: id, previousStatus: photo.status } : null;
    }).filter((x): x is { photoId: string; previousStatus: 'keep' | 'review' | 'delete' } => x !== null);

    if (affected.length > 0) {
      setLastDecisionAction({
        actionLabel: status === 'keep' ? '批量标记为保留' : '批量标记为淘汰候选',
        affectedPhotos: affected,
        createdAt: Date.now()
      });
    }
    contextUpdateMultiplePhotosStatus(ids, status);
  }, [photos, contextUpdateMultiplePhotosStatus]);

  // 本地包裹的重置工作台与载入 Demo (清空撤销记录)
  const resetWorkspace = useCallback(() => {
    setLastDecisionAction(null);
    contextResetWorkspace();
  }, [contextResetWorkspace]);

  const loadDemoPhotos = useCallback(() => {
    setLastDecisionAction(null);
    contextLoadDemoPhotos();
  }, [contextLoadDemoPhotos]);

  // 批量手动决策选择状态
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);

  const toggleSelectPhoto = useCallback((id: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPhotoIds([]);
  }, []);

  const handleBatchKeep = useCallback(() => {
    if (selectedPhotoIds.length === 0) return;
    updateMultiplePhotosStatus(selectedPhotoIds, 'keep');
    clearSelection();
  }, [selectedPhotoIds, updateMultiplePhotosStatus, clearSelection]);

  const handleBatchCull = useCallback(() => {
    if (selectedPhotoIds.length === 0) return;
    updateMultiplePhotosStatus(selectedPhotoIds, 'delete');
    clearSelection();
  }, [selectedPhotoIds, updateMultiplePhotosStatus, clearSelection]);

  const undoLastDecisionAction = useCallback(() => {
    if (!lastDecisionAction) return;

    const keepIds: string[] = [];
    const reviewIds: string[] = [];
    const deleteIds: string[] = [];

    lastDecisionAction.affectedPhotos.forEach((item) => {
      if (item.previousStatus === 'keep') {
        keepIds.push(item.photoId);
      } else if (item.previousStatus === 'review') {
        reviewIds.push(item.photoId);
      } else if (item.previousStatus === 'delete') {
        deleteIds.push(item.photoId);
      }
    });

    if (keepIds.length > 0) {
      contextUpdateMultiplePhotosStatus(keepIds, 'keep');
    }
    if (reviewIds.length > 0) {
      contextUpdateMultiplePhotosStatus(reviewIds, 'review');
    }
    if (deleteIds.length > 0) {
      contextUpdateMultiplePhotosStatus(deleteIds, 'delete');
    }

    setLastDecisionAction(null);

    setToastMessage("已撤销最近一次整理调整。");
  }, [lastDecisionAction, contextUpdateMultiplePhotosStatus]);

  // 当照片集更新时，自动过滤掉已不存在的照片 ID，确保选择状态的安全与一致性
  useEffect(() => {
    setSelectedPhotoIds((prev) => {
      const validIds = prev.filter((id) => photos.some((p) => p.id === id));
      if (validIds.length !== prev.length) {
        return validIds;
      }
      return prev;
    });
  }, [photos]);


  // 全局轻量提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Toast 自动关闭效果，3秒内自动消失，组件卸载或消息变更时清理定时器防止内存泄漏
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // 左图的缩放与平移状态
  const [leftScale, setLeftScale] = useState(1);
  const [leftX, setLeftX] = useState(0);
  const [leftY, setLeftY] = useState(0);
  const [isLeftDragging, setIsLeftDragging] = useState(false);
  const [leftDragStart, setLeftDragStart] = useState({ x: 0, y: 0 });

  // 右图的缩放与平移状态
  const [rightScale, setRightScale] = useState(1);
  const [rightX, setRightX] = useState(0);
  const [rightY, setRightY] = useState(0);
  const [isRightDragging, setIsRightDragging] = useState(false);
  const [rightDragStart, setRightDragStart] = useState({ x: 0, y: 0 });

  // 当对比照片组切换或回合递进时，自动重置缩放比例，防跨幅拉伸
  useEffect(() => {
    handleResetZoom();
  }, [localActiveBattle?.roundIndex, localActiveBattle?.groupId]);

  // 同步本地 A/B 对局状态以管理淡出退出动效
  useEffect(() => {
    if (activeBattle) {
      setLocalActiveBattle(activeBattle);
      setIsBattleClosing(false);
    } else if (localActiveBattle && !isBattleClosing) {
      setIsBattleClosing(true);
      const timer = setTimeout(() => {
        setLocalActiveBattle(null);
        setIsBattleClosing(false);
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [activeBattle, localActiveBattle, isBattleClosing]);

  // A/B 对局弹窗的安全退出控制 (带有退出收缩动画)
  const handleCloseBattleWithAnimation = useCallback(() => {
    setIsBattleClosing(true);
    setTimeout(() => {
      closeBattle();
      setLocalActiveBattle(null);
      setIsBattleClosing(false);
    }, 280);
  }, [closeBattle]);

  // 导出面板关闭动画控制器
  const handleCloseExport = useCallback(() => {
    setIsExportClosing(true);
    setTimeout(() => {
      setExportOpen(false);
      setIsExportClosing(false);
      // 重置文件夹导出状态
      setFolderExportStatus('idle');
      setFolderExportResultCount(0);
      setFolderExportError(null);
    }, 220);
  }, []);

  // 全局 Escape 键监听，用于关闭导出弹出框和预览图模态框
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewPhoto) {
          e.preventDefault();
          closePreviewModal();
        } else if (exportOpen && !isExportClosing) {
          e.preventDefault();
          handleCloseExport();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [exportOpen, isExportClosing, handleCloseExport, previewPhoto, closePreviewModal]);

  // 当检测到当前组对比 PK 结束时，自动关闭当前对比，并流转到下一组或展示 Toast
  useEffect(() => {
    if (activeBattle && !isTransitioningRef.current) {
      const isBattleCompleted = activeBattle.nextIndex >= activeBattle.contenderIds.length;
      if (isBattleCompleted) {
        isTransitioningRef.current = true;
        setToastMessage("A/B 对局已完成，结果已更新。");
        handleCloseBattleWithAnimation();
        isTransitioningRef.current = false;
      }
    }
  }, [activeBattle, handleCloseBattleWithAnimation]);

  // A/B 自动进入策略：仅在 Native 正常分析完成并跳转到 Results 时，若 similarGroups.length > 0，自动打开第一组的 A/B 对局
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      let isAlreadyOpened = false;
      try {
        isAlreadyOpened = !!window.sessionStorage.getItem('ab_auto_opened');
      } catch (err) {
        console.warn('Failed to read sessionStorage:', err);
      }

      const analyzedCount = photos.filter(p => p.category !== '待分类' && p.category !== '已跳过').length;
      const validGroup = similarGroups.find(g => g && !g.battleCompleted && g.photoIds.length >= 2);

      if (
        hasNativeSource &&
        analyzedCount > 0 &&
        Array.isArray(similarGroups) &&
        similarGroups.length > 0 &&
        validGroup &&
        analysisProgress === 100 &&
        !isAnalyzing &&
        !isNativeProcessingCancelled &&
        !isAlreadyOpened
      ) {
        try {
          window.sessionStorage.setItem('ab_auto_opened', 'true');
        } catch (err) {
          console.warn('Failed to write sessionStorage:', err);
        }
        startBattleForGroup(validGroup.id, { allowNative: true });
      }
    } catch (e) {
      console.warn('Auto A/B error guarded:', e);
    }
  }, [
    hasNativeSource,
    photos,
    similarGroups,
    analysisProgress,
    isAnalyzing,
    isNativeProcessingCancelled,
    startBattleForGroup
  ]);

  // 键盘快捷键监听
  useEffect(() => {
    if (!activeBattle || isBattleClosing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      const key = e.key.toLowerCase();
      if (key === 'arrowleft') {
        e.preventDefault();
        applyBattleDecision('keep_left');
      } else if (key === 'arrowright') {
        e.preventDefault();
        applyBattleDecision('keep_right');
      } else if (key === 'b') {
        e.preventDefault();
        applyBattleDecision('keep_both');
      } else if (key === 'c') {
        e.preventDefault();
        applyBattleDecision('cull_both');
      } else if (key === 's') {
        e.preventDefault();
        applyBattleDecision('skip');
      } else if (key === 'escape') {
        e.preventDefault();
        handleCloseBattleWithAnimation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBattle, isBattleClosing, applyBattleDecision, handleCloseBattleWithAnimation]);


  // 鼠标滚轮缩放处理 (1x 到 4x)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>, side: 'left' | 'right') => {
    e.preventDefault();
    dismissAbGuidance();
    const scaleFactor = 0.15;
    const delta = e.deltaY < 0 ? scaleFactor : -scaleFactor;
    
    if (side === 'left') {
      setLeftScale(prev => {
        const next = Math.min(Math.max(prev + delta, 1), 4);
        if (next === 1) {
          setLeftX(0);
          setLeftY(0);
        }
        return next;
      });
    } else {
      setRightScale(prev => {
        const next = Math.min(Math.max(prev + delta, 1), 4);
        if (next === 1) {
          setRightX(0);
          setRightY(0);
        }
        return next;
      });
    }
  };

  // 鼠标拖拽平移相关处理
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, side: 'left' | 'right') => {
    dismissAbGuidance();
    const scale = side === 'left' ? leftScale : rightScale;
    if (e.button !== 0 || scale <= 1) return; // 只有左键且已放大才允许拖拽
    e.preventDefault();
    
    if (side === 'left') {
      setIsLeftDragging(true);
      setLeftDragStart({ x: e.clientX - leftX, y: e.clientY - leftY });
    } else {
      setIsRightDragging(true);
      setRightDragStart({ x: e.clientX - rightX, y: e.clientY - rightY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, side: 'left' | 'right') => {
    if (side === 'left') {
      if (!isLeftDragging) return;
      setLeftX(e.clientX - leftDragStart.x);
      setLeftY(e.clientY - leftDragStart.y);
    } else {
      if (!isRightDragging) return;
      setRightX(e.clientX - rightDragStart.x);
      setRightY(e.clientY - rightDragStart.y);
    }
  };

  const handleMouseUpOrLeave = (side: 'left' | 'right') => {
    if (side === 'left') {
      setIsLeftDragging(false);
    } else {
      setIsRightDragging(false);
    }
  };

  const handleResetZoom = () => {
    setLeftScale(1);
    setLeftX(0);
    setLeftY(0);
    setIsLeftDragging(false);

    setRightScale(1);
    setRightX(0);
    setRightY(0);
    setIsRightDragging(false);
  };

  // 双击图片重置当前侧缩放与平移状态
  const handleDoubleClick = (side: 'left' | 'right') => {
    dismissAbGuidance();
    if (side === 'left') {
      setLeftScale(1);
      setLeftX(0);
      setLeftY(0);
      setIsLeftDragging(false);
    } else {
      setRightScale(1);
      setRightX(0);
      setRightY(0);
      setIsRightDragging(false);
    }
  };

  // 局部常量定义
  const MAX_ZIP_BATCH_BYTES = 300 * 1024 * 1024;
  const MAX_ZIP_BATCH_PHOTOS = 30;
  const ZIP_BATCH_DOWNLOAD_DELAY_MS = 3000;
  const ZIP_OBJECT_URL_REVOKE_DELAY_MS = 120_000;

  // 局部类型定义
  type ZipBatch = {
    partIndex: number;
    photos: PhotoItem[];
    estimatedBytes: number;
    filename: string;
  };


  // 分批打包辅助函数
  function buildZipBatches(
    photosToZip: PhotoItem[],
    baseFilename: string
  ): ZipBatch[] {
    const batches: ZipBatch[] = [];
    let currentBatchPhotos: PhotoItem[] = [];
    let currentBytes = 0;
    let partIndex = 1;

    for (const photo of photosToZip) {
      const fileSize = photo.file?.size ?? 0;
      
      // 如果单张图就已经超过最大限制，且当前包中已有图，则先结算当前包，让该单张图单独成包
      if (fileSize >= MAX_ZIP_BATCH_BYTES && currentBatchPhotos.length > 0) {
        batches.push({
          partIndex,
          photos: currentBatchPhotos,
          estimatedBytes: currentBytes,
          filename: `${baseFilename}_part_${partIndex}.zip`
        });
        partIndex++;
        currentBatchPhotos = [];
        currentBytes = 0;
      }

      currentBatchPhotos.push(photo);
      currentBytes += fileSize;

      if (currentBytes >= MAX_ZIP_BATCH_BYTES || currentBatchPhotos.length >= MAX_ZIP_BATCH_PHOTOS) {
        batches.push({
          partIndex,
          photos: currentBatchPhotos,
          estimatedBytes: currentBytes,
          filename: `${baseFilename}_part_${partIndex}.zip`
        });
        partIndex++;
        currentBatchPhotos = [];
        currentBytes = 0;
      }
    }

    // 结算最后一包
    if (currentBatchPhotos.length > 0) {
      // 如果总共只有一包，文件名保持原名（不加 _part_ 编号）
      const isSingle = partIndex === 1;
      batches.push({
        partIndex,
        photos: currentBatchPhotos,
        estimatedBytes: currentBytes,
        filename: isSingle ? `${baseFilename}.zip` : `${baseFilename}_part_${partIndex}.zip`
      });
    }

    return batches;
  }

  const handleExportManifestCsv = () => {
    if (photos.length === 0) return;
    try {
      const rows = buildManifestRows(photos);
      const csvContent = buildManifestCsv(rows);
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildManifestExportFilename(projectName, 'csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
    } catch (err) {
      console.error('Failed to export CSV manifest:', err);
    }
  };

  const handleExportManifestJson = () => {
    if (photos.length === 0) return;
    try {
      const rows = buildManifestRows(photos);
      const jsonContent = buildManifestJson(rows, projectName);
      
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildManifestExportFilename(projectName, 'json');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
    } catch (err) {
      console.error('Failed to export JSON manifest:', err);
    }
  };

  const handleExportKeepToFolder = async () => {
    const keepPhotosList = photos.filter((p) => getUserVisibleBucket(p) === 'keep');
    if (keepPhotosList.length === 0) {
      setFolderExportError("没有保留照片可导出。");
      setFolderExportStatus('failed');
      return;
    }

    setIsFolderExporting(true);
    setFolderExportStatus('idle');
    setFolderExportError(null);

    try {
      // 1. 选择目标文件夹 (复用 selectPhysicalOrgOutputFolder)
      const res = await selectPhysicalOrgOutputFolder();
      if (!res) {
        // 用户取消或没有返回结果
        setIsFolderExporting(false);
        return;
      }

      const [outputFolderToken] = res;

      // 2. 收集 keep_photo_ids
      const keepPhotoIds = keepPhotosList.map(p => p.id);

      // 3. 调用 physicalOrgBridge 中的 copyKeepPhotosToFolder
      const { copyKeepPhotosToFolder } = await import('@/lib/desktop/physicalOrgBridge');
      const summary = await copyKeepPhotosToFolder(outputFolderToken, keepPhotoIds);

      if (summary) {
        if (summary.failedCount > 0 && summary.copiedCount === 0) {
          setFolderExportStatus('failed');
          setFolderExportError(summary.errors.join('; ') || "文件复制全部失败，请检查写入权限或目标路径可写性。");
          setToastMessage("导出失败。");
        } else if (summary.failedCount > 0) {
          setFolderExportStatus('success');
          setFolderExportResultCount(summary.copiedCount);
          setFolderExportError(`部分照片导出失败: ${summary.errors.join('; ')}`);
          setToastMessage(`导出完成，成功 ${summary.copiedCount} 张，失败 ${summary.failedCount} 张。`);
        } else {
          setFolderExportStatus('success');
          setFolderExportResultCount(summary.copiedCount);
          setToastMessage(`成功导出 ${summary.copiedCount} 张保留照片！`);
        }
      } else {
        setFolderExportStatus('failed');
        setFolderExportError("物理拷贝操作未返回结果，请检查本地环境。");
        setToastMessage("导出失败。");
      }
    } catch (err) {
      console.error('Failed to execute keep copy to folder:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setFolderExportStatus('failed');
      setFolderExportError(sanitizePathString(errMsg || "执行照片导出时发生异常。"));
      setToastMessage("导出发生错误。");
    } finally {
      setIsFolderExporting(false);
    }
  };

  // 纯客户端分批打包下载保留照片整理包 (JSZip)
  const downloadPhotosZip = async () => {
    // 增加 helper 判断，Native source 不允许 ZIP 导出
    if (hasNativeSource) {
      console.warn('ZIP export is disabled for local native sources.');
      return;
    }

    const targetPhotos = photos.filter((p) => getUserVisibleBucket(p) === 'keep');
    if (targetPhotos.length === 0) return;

    // 如果待导出照片中存在 file 缺失，也不能把 undefined file 传给 JSZip，更不能通过 fetch(photo.url) 去打包 Native preview/custom protocol URL
    const safeTargetPhotos = targetPhotos.filter((photo) => {
      const isNative = photo.sourceType === 'native-folder-preview' || photo.sourceType === 'native-folder-file';
      if (isNative) return false;
      const isNativeUrl = photo.url?.startsWith('preview:') || photo.url?.includes('preview.localhost');
      if (isNativeUrl) return false;
      return !!photo.file || !!photo.url;
    });

    if (safeTargetPhotos.length === 0) {
      console.warn('No valid web photos available to package into ZIP.');
      return;
    }

    setIsZipping(true);
    setZipExportWarning(null);
    try {
      const JSZip = (await import('jszip')).default;
      const baseFilename = buildZipExportFilename(projectName).replace(/\.zip$/, '');
      const batches = buildZipBatches(safeTargetPhotos, baseFilename);

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        const zip = new JSZip();

        // 串行添加当前批次的照片文件
        for (let i = 0; i < batch.photos.length; i++) {
          const photo = batch.photos[i];
          if (photo.file) {
            zip.file(photo.name, photo.file);
          } else if (photo.url) {
            // 确保不 fetch 任何 Native preview URL
            const isNativeUrl = photo.url.startsWith('preview:') || photo.url.includes('preview.localhost');
            if (isNativeUrl) {
              console.warn('Skipping fetch for native preview URL in ZIP batch:', photo.url);
              continue;
            }
            try {
              const res = await fetch(photo.url);
              if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
              const blob = await res.blob();
              zip.file(photo.name, blob);
            } catch (e) {
              console.error('Failed to fetch remote image for ZIP:', photo.url, e);
            }
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const downloadUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = batch.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 延迟释放 Object URL，给大文件下载写入磁盘留出充裕的传输时间
        setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
        }, ZIP_OBJECT_URL_REVOKE_DELAY_MS);

        // 如果还有下一个分包，则等待一定延迟，防止浏览器判定为并发下载劫持
        if (b < batches.length - 1) {
          await sleep(ZIP_BATCH_DOWNLOAD_DELAY_MS);
        }
      }
    } catch (err) {
      console.error('Failed to download ZIP pack:', err);
      setZipExportWarning(
        'ZIP 下载未完成。浏览器在处理超大相册时可能会中断下载。请尝试减少单次导出数量，或分批下载。'
      );
    } finally {
      setIsZipping(false);
    }
  };


  // 分类计算照片
  const totalPhotos = photos.length;
  const keepPhotos = photos.filter((p) => getUserVisibleBucket(p) === 'keep');
  const deletePhotos = photos.filter((p) => getUserVisibleBucket(p) === 'cull');

  const selectedKeepCount = selectedPhotoIds.filter(id => keepPhotos.some(p => p.id === id)).length;
  const selectedCullCount = selectedPhotoIds.filter(id => deletePhotos.some(p => p.id === id)).length;

  const selectAllInBucket = useCallback((bucket: 'keep' | 'cull') => {
    const targetPhotos = bucket === 'keep' ? keepPhotos : deletePhotos;
    const targetIds = targetPhotos.map(p => p.id);
    setSelectedPhotoIds(prev => {
      const otherBucketIds = prev.filter(id => !targetIds.includes(id));
      return [...otherBucketIds, ...targetIds];
    });
  }, [keepPhotos, deletePhotos]);

  const clearSelectionInBucket = useCallback((bucket: 'keep' | 'cull') => {
    const targetPhotos = bucket === 'keep' ? keepPhotos : deletePhotos;
    const targetIds = targetPhotos.map(p => p.id);
    setSelectedPhotoIds(prev => prev.filter(id => !targetIds.includes(id)));
  }, [keepPhotos, deletePhotos]);

  const pendingGroupsCount = similarGroups.filter(g => !g.battleCompleted).length;

  const spaceSavedMB = deletePhotos.reduce((acc, p) => {
    const val = parseFloat(p.size);
    return acc + (isNaN(val) ? 0 : val);
  }, 0).toFixed(1);

  const keepSpaceMB = keepPhotos.reduce((acc, p) => {
    const val = parseFloat(p.size);
    return acc + (isNaN(val) ? 0 : val);
  }, 0).toFixed(1);

  // 打开详情诊断弹窗 (非主决策，隐藏入 details折叠 后辅助查看)
  const openDetail = useCallback((photo: PhotoItem) => {
    setSelectedPhoto(photo);
    setDialogOpen(true);
  }, []);

  // 重新导入跳转到 /desktop
  const handleRestart = () => {
    resetWorkspace();
    router.push('/desktop');
  };

  // 获取问题标签（对应真实的 issue 类型）
  const renderIssueBadge = useCallback((photo: PhotoItem) => {
    switch (photo.issue) {
      case 'good':
        return (
          <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 gap-1 text-[10px] shadow-none">
            <CheckCircle className="h-3 w-3" />
            质量良好
          </Badge>
        );
      case 'blurry':
        return (
          <Badge className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 gap-1 text-[10px] shadow-none">
            <AlertTriangle className="h-3 w-3" />
            画面模糊
          </Badge>
        );
      case 'overexposed':
        return (
          <Badge className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 gap-1 text-[10px] shadow-none">
            <Sun className="h-3 w-3" />
            画面过曝
          </Badge>
        );
      case 'underexposed':
        return (
          <Badge className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 gap-1 text-[10px] shadow-none">
            <Sun className="h-3 w-3" />
            画面欠曝
          </Badge>
        );
      case 'needs_review':
        return (
          <Badge className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 gap-1 text-[10px] shadow-none">
            <AlertTriangle className="h-3 w-3" />
            待处理
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 gap-1 text-[10px] shadow-none">
            待诊断
          </Badge>
        );
    }
  }, []);

  // 获取质量得分颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // 状态栏动态联动
  let statusText = '整理扫描结果';
  if (photos.length === 0) {
    statusText = '等待照片导入';
  } else if (pendingGroupsCount > 0) {
    statusText = `有 ${pendingGroupsCount} 组相似照片待进行 A/B 裁决`;
  } else {
    statusText = `照片已分入保留区与淘汰候选区，安全导出就绪`;
  }

  // 渲染单张照片卡片（高度固定为 190px，详情折叠使用悬浮框以免改变卡片高度）
  const renderPhotoCard = useCallback((photo: PhotoItem, index: number) => {
    return (
      <ResultsPhotoCard
        photo={photo}
        index={index}
        isSelected={selectedPhotoIds.includes(photo.id)}
        getPhotoDisplayName={getPhotoDisplayName}
        renderIssueBadge={renderIssueBadge}
        toggleSelectPhoto={toggleSelectPhoto}
        updatePhotoStatus={updatePhotoStatus}
        openDetail={openDetail}
        setPreviewPhoto={setPreviewPhoto}
        setPreviewScale={setPreviewScale}
        setPreviewX={setPreviewX}
        setPreviewY={setPreviewY}
      />
    );
  }, [
    selectedPhotoIds,
    getPhotoDisplayName,
    renderIssueBadge,
    toggleSelectPhoto,
    updatePhotoStatus,
    openDetail,
    setPreviewPhoto,
    setPreviewScale,
    setPreviewX,
    setPreviewY,
  ]);

  // 渲染分区照片列表 (使用自研 VirtualPhotoGrid 以大幅优化渲染 DOM 节点数)
  const renderPartitionGrid = (items: PhotoItem[], partitionType: 'keep' | 'cull') => {
    if (items.length === 0) {
      return (
        <div className="text-center py-10 bg-black/10 rounded-lg border border-white/5">
          <FolderSync className="h-7 w-7 text-[var(--dt-text-soft)] mx-auto mb-2" />
          <p className="text-[var(--dt-text-soft)] text-xs">
            {partitionType === 'keep' ? '暂无保留照片' : '暂无淘汰候选照片'}
          </p>
        </div>
      );
    }

    const emptyState = (
      <div className="text-center py-10 bg-black/10 rounded-lg border border-white/5">
        <FolderSync className="h-7 w-7 text-[var(--dt-text-soft)] mx-auto mb-2" />
        <p className="text-[var(--dt-text-soft)] text-xs">
          {partitionType === 'keep' ? '暂无保留照片' : '暂无淘汰候选照片'}
        </p>
      </div>
    );

    return (
      <VirtualPhotoGrid<PhotoItem>
        items={items}
        getItemKey={(photo) => photo.id}
        renderItem={renderPhotoCard}
        minCardWidth={150}
        rowHeight={190}
        gap={12}
        overscanRows={3}
        emptyState={emptyState}
      />
    );
  };

  // 获取详情清晰度人话标签
  const getDetailClarityLabel = (photo: PhotoItem) => {
    if (photo.sharpnessScore >= 80) {
      return "\u753b\u9762\u7ec6\u8282\u6e05\u6670\uff0c\u7126\u70b9\u6e05\u6670"; // 画面细节清晰，焦点清晰
    }
    if (photo.sharpnessScore >= 50) {
      return "\u6e05\u6670\u5ea6\u5c1a\u53ef\uff0c\u5efa\u8bae\u4eba\u5de5\u786e\u8ba4"; // 清晰度尚可，建议人工确认
    }
    return "\u753b\u9762\u53ef\u80fd\u5b58\u5728\u6296\u52a8\u6216\u5bf9\u7126\u504f\u5dee\uff0c\u5efa\u8bae\u6dd8\u6c70\u5019\u9009"; // 画面可能存在抖动或对焦偏差，建议淘汰候选
  };

  // 获取详情曝光人话标签
  const getDetailExposureLabel = (photo: PhotoItem) => {
    if (photo.exposureValue > 25) {
      return "\u5c40\u90e8\u753b\u9762\u53ef\u80fd\u8fc7\u66b4\uff0c\u4eae\u90e8\u7ec6\u8282\u4e22\u5931"; // 局部画面可能过曝，亮部细节丢失
    }
    if (photo.exposureValue < -25) {
      return "\u753b\u9762\u663e\u8457\u504f\u6697\uff0c\u6697\u90e8\u7ec6\u8282\u4e0d\u8db3"; // 画面显著偏暗，暗部细节不足
    }
    return "\u66b4\u5149\u6307\u6807\u5747\u8861\uff0c\u4eae\u5ea6\u8212\u9002"; // 曝光指标均衡，亮度舒适
  };

  // 获取整理建议说明
  const getDetailSuggestionText = (photo: PhotoItem) => {
    const isCull = getUserVisibleBucket(photo) === 'cull';
    if (isCull) {
      return "\u6839\u636e AI \u7b5b\u9009\u6216\u5bf9\u5c40\u7ed3\u679c\uff0c\u5f53\u524d\u7167\u7247\u88ab\u5206\u5165\u3010\u6dd8\u6c70\u5019\u9009\u3011\u3002\u5efa\u8bae\u4eba\u5de5\u786e\u8ba4\u540e\u518d\u51b3\u5b9a\u662f\u5426\u5bfc\u51fa\u3002"; // 根据 AI 筛选或对局结果，当前照片被分入【淘汰候选】。建议人工确认后再决定是否导出。
    }
    return "\u5f53\u524d\u7167\u7247\u88ab\u5206\u5165\u3010\u4fdd\u7559\u3011\u3002\u5efa\u8bae\u968f\u4fdd\u7559\u7167\u7247\u4e00\u8d77\u5bfc\u51fa\u3002"; // 当前照片被分入【保留】。建议随保留照片一起导出。
  };

  return (
    <div className="desktop-root">
      {/* Toast 提示栏 */}
      {toastMessage && (
        <div className="fixed top-12 right-6 z-50 bg-[#12161A]/95 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2.5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-2 animate-fade-in backdrop-blur-md">
          <CheckCircle className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}
      <div className="desktop-window">
        {/* Top Window Bar */}
        <DesktopTopBar currentPhase="整理" />

        {/* Main Workspace Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Sidebar Navigation */}
          <DesktopSidebar 
            activeId={exportOpen ? "export" : "review"} 
            onExportClick={(rect) => {
              setExportAnchorRect(rect);
              if (exportOpen) {
                handleCloseExport();
              } else {
                setFolderExportStatus('idle');
                setFolderExportResultCount(0);
                setFolderExportError(null);
                setExportOpen(true);
              }
            }} 
          />

          {/* Right Workstation Content */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <main className="flex-1 flex flex-col overflow-hidden p-5 bg-[var(--dt-workspace-bg)]">
              
              {totalPhotos === 0 ? (
                <div className="max-w-xl mx-auto py-16 text-center select-none desktop-panel p-8 mt-10">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 mb-3">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  
                  <h2 className="text-sm font-bold text-[var(--dt-text-primary)] mb-1">未检测到已导入的照片</h2>
                  <p className="text-[var(--dt-text-soft)] text-xs max-w-xs mx-auto mb-5 leading-relaxed">
                    工作台当前为空。请先返回选择本地照片文件夹以开始分析，或载入预设演示项目。
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button 
                      onClick={handleRestart}
                      className="desktop-button-secondary text-xs h-8"
                    >
                      <FolderOpen className="mr-1.5 h-3.5 w-3.5 inline text-[var(--dt-text-soft)]" />
                      返回选择本地文件夹
                    </button>
                    <button 
                      onClick={loadDemoPhotos}
                      className="desktop-button-primary text-xs h-8"
                    >
                      <FolderSync className="mr-1.5 h-3.5 w-3.5 inline" />
                      载入 Demo 项目
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4 shrink-0 pb-3 border-b border-[var(--dt-border)]">
                    {/* 页面标题区 */}
                    <div className="flex items-center justify-between gap-4 pb-1 select-none text-left">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold text-[var(--dt-text-primary)]">整理结果</h2>
                      <p className="text-[10.5px] text-[var(--dt-text-soft)] leading-relaxed">
                        这只调整整理结果，不会修改原图，原图在您的电脑上保持不变。
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasNativeSource && (
                        nativeSourceMode === 'selected-files' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block cursor-not-allowed shrink-0">
                                <button
                                  disabled={true}
                                  className="desktop-button-primary text-[10px] py-1.5 h-8 opacity-40 pointer-events-none flex items-center gap-1.5 font-bold"
                                >
                                  本地整理输出
                                </button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent 
                              side="bottom"
                              className="max-w-[280px] bg-neutral-900 border border-white/10 text-[var(--dt-text-primary)] p-3 text-[11px] leading-relaxed shadow-lg rounded-md"
                            >
                              选择图片模式暂不支持本地整理输出。当前不会移动、删除或覆盖你的原图。你仍可查看整理结果；如需本地整理输出，请使用选择文件夹模式。
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <button
                            onClick={() => setPhysicalOrgDialogOpen(true)}
                            className="desktop-button-primary text-[10px] py-1.5 h-8 flex items-center gap-1.5 font-bold"
                          >
                            本地整理输出
                          </button>
                        )
                      )}
                      <button
                        onClick={handleRestart}
                        className="desktop-button-secondary text-[10px] py-1.5 h-8 flex items-center gap-1.5 font-bold shrink-0 border border-[var(--dt-border)]"
                      >
                        {nativeSourceMode === 'selected-files' ? "重新选择图片" : "重新选择文件夹"}
                      </button>
                    </div>
                  </div>

                  {/* 统计摘要区 */}
                  <ResultsSummaryCards
                    keepCount={keepPhotos.length}
                    keepSpaceMB={keepSpaceMB}
                    cullCount={deletePhotos.length}
                    spaceSavedMB={spaceSavedMB}
                    similarGroupCount={similarGroups.length}
                    completedBattleCount={similarGroups.filter(g => g.battleCompleted).length}
                    totalBattleCount={similarGroups.length}
                    activeTab={activeTab}
                    onTabChange={(tab) => {
                      if (tab === 'similar') {
                        setFilteredGroupId(null);
                      }
                      setActiveTab(tab);
                    }}
                    hasNativeSource={hasNativeSource}
                  />

                  {/* A/B 对局主视觉引导 / 无相似组提示区域 */}
                  {similarGroups.length > 0 ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none backdrop-blur-md transition-all duration-300">
                      <div className="flex items-center gap-2 flex-wrap text-left">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-[var(--dt-text-primary)] font-medium">
                          检测到本地存在 {similarGroups.length} 组相似照片 ({similarGroups.filter(g => !g.battleCompleted).length} 组待对比)。系统建议进行 A/B 挑选，以选择保留最佳照片。
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          onClick={() => {
                            const targetGroupId = filteredGroupId || (similarGroups.find(g => !g.battleCompleted) || similarGroups[0])?.id;
                            if (targetGroupId) {
                              startBattleForGroup(targetGroupId, { allowNative: true });
                            }
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-8 px-4 text-xs transition-all shadow-none border-0"
                        >
                          ⚔️ 开始 A/B 对比
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg flex items-start gap-3 text-xs select-none backdrop-blur-md transition-all duration-300">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-blue-400 mt-0.5" />
                      <div className="space-y-1 text-left">
                        <p className="font-bold text-[var(--dt-text-primary)]">相似检测完成</p>
                        <p className="text-[var(--dt-text-secondary)] leading-relaxed">
                          未发现足够相似的照片组，因此不会自动进入 A/B。你仍可查看整理结果。
                        </p>
                        {(skippedCount > 0 || failedCount > 0) && (
                          <p className="text-[10px] text-blue-300 mt-1 font-medium">
                            诊断信息: 本次扫描共跳过 {skippedCount} 张不支持或重复的图片文件，有 {failedCount} 张图片分析失败。
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 批量操作栏 */}
                  {selectedPhotoIds.length > 0 && (
                    <div className="p-3 bg-[var(--dt-card-bg)] border border-emerald-500/30 rounded-md flex flex-col md:flex-row items-center justify-between gap-3 text-xs select-none backdrop-blur-md transition-all duration-300">
                      <div className="flex items-center gap-2 flex-wrap text-left">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono text-[10px]">
                          {selectedPhotoIds.length}
                        </span>
                        <span className="text-[var(--dt-text-primary)] font-medium">
                          已选择 {selectedPhotoIds.length} 张 (保留中 {selectedKeepCount} 张，淘汰候选中 {selectedCullCount} 张)
                        </span>
                        <span className="text-[10px] text-[var(--dt-text-soft)] hidden lg:inline">|</span>
                        <span className="text-[10px] text-[var(--dt-text-soft)] hidden sm:inline">只调整整理结果，不会修改原图</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          onClick={handleBatchKeep}
                          className="bg-[#6FA887]/20 hover:bg-[#6FA887]/30 border border-[#6FA887]/40 text-[#6FA887] font-semibold h-7 px-3 text-[10px] transition-all hover:text-[#6FA887] shadow-none"
                        >
                          标记为保留
                        </Button>
                        <Button
                          onClick={handleBatchCull}
                          className="bg-[#B96F68]/20 hover:bg-[#B96F68]/30 border border-[#B96F68]/40 text-[#B96F68] font-semibold h-7 px-3 text-[10px] transition-all hover:text-[#B96F68] shadow-none"
                        >
                          标记为淘汰候选
                        </Button>
                        <Button
                          onClick={clearSelection}
                          variant="outline"
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-[var(--dt-text-primary)] hover:text-[var(--dt-text-primary)] h-7 px-3 text-[10px] transition-all shadow-none"
                        >
                          取消选择
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 撤销提示条 */}
                  {lastDecisionAction && (
                    <div className="p-3 bg-[var(--dt-card-bg)] border border-yellow-500/20 rounded-md flex flex-col md:flex-row items-center justify-between gap-3 text-xs select-none backdrop-blur-md transition-all duration-300">
                      <div className="flex items-center gap-2 flex-wrap text-left">
                        <span className="inline-flex h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                        <span className="text-[var(--dt-text-primary)] font-medium">
                          已调整 {lastDecisionAction.affectedPhotos.length} 张照片的整理结果。
                        </span>
                        <span className="text-[10px] text-[var(--dt-text-soft)] hidden sm:inline">|</span>
                        <span className="text-[10px] text-[var(--dt-text-soft)]">只调整整理结果，不会修改原图，原图保持不变</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          onClick={undoLastDecisionAction}
                          className="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-semibold h-7 px-3 text-[10px] transition-all hover:text-yellow-400 shadow-none"
                        >
                          撤销
                        </Button>
                        <Button
                          onClick={() => setLastDecisionAction(null)}
                          variant="ghost"
                          className="text-[var(--dt-text-soft)] hover:text-[var(--dt-text-primary)] hover:bg-white/5 h-7 w-7 p-0 rounded-full transition-all flex items-center justify-center border-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                  </div>

                  <div className="flex-grow overflow-y-auto pr-1 pt-2 pb-20 scrollbar-thin">
                    {/* Active Tab Area Rendering with 0.18s transition */}
                  {activeTab === 'keep' && (
                    <div className="animate-fade-in-up">
                      <PhotoBucketSection
                        bucketType="keep"
                        photosCount={keepPhotos.length}
                        onSelectAll={() => selectAllInBucket('keep')}
                        onClearSelection={() => clearSelectionInBucket('keep')}
                        isAllSelected={selectedKeepCount === keepPhotos.length && keepPhotos.length > 0}
                        hasSelected={selectedKeepCount > 0}
                      >
                        {renderPartitionGrid(keepPhotos, 'keep')}
                      </PhotoBucketSection>
                    </div>
                  )}

                  {activeTab === 'cull' && (
                    <div className="animate-fade-in-up">
                      <PhotoBucketSection
                        bucketType="cull"
                        photosCount={deletePhotos.length}
                        spaceMB={spaceSavedMB}
                        onSelectAll={() => selectAllInBucket('cull')}
                        onClearSelection={() => clearSelectionInBucket('cull')}
                        isAllSelected={selectedCullCount === deletePhotos.length && deletePhotos.length > 0}
                        hasSelected={selectedCullCount > 0}
                      >
                        {renderPartitionGrid(deletePhotos, 'cull')}
                      </PhotoBucketSection>
                    </div>
                  )}

                  {activeTab === 'similar' && (
                    <div className="space-y-3 text-left animate-fade-in-up select-none">
                      {filteredGroupId ? (() => {
                        const group = similarGroups.find(g => g.id === filteredGroupId);
                        const groupPhotos = group
                          ? group.photoIds
                              .map(id => photos.find(p => p.id === id))
                              .filter((p): p is PhotoItem => !!p)
                          : [];
                        const groupIdx = similarGroups.findIndex(g => g.id === filteredGroupId);

                        return (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-[var(--dt-border)] pb-2 select-none">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[var(--dt-text-primary)]">
                                  当前查看：相似组 #{groupIdx + 1} ({groupPhotos.length}张)
                                </span>
                                <span className="text-[10px] text-[var(--dt-text-soft)] bg-white/5 px-1.5 py-0.5 rounded">
                                  💡 点击上方“相似组”卡片返回全部组
                                </span>
                                {group && (
                                  <button
                                    onClick={() => startBattleForGroup(group.id, { allowNative: true })}
                                    className="desktop-button-primary text-[10px] py-1 h-7 px-3 font-bold flex items-center gap-1.5 ml-2"
                                  >
                                    <GitCompare className="h-3.5 w-3.5" />
                                    {group.battleCompleted ? "重新对比" : "开始 A/B 对比"}
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div>
                              {renderPartitionGrid(groupPhotos, 'keep')}
                            </div>
                          </div>
                        );
                      })() : (
                        <>
                          <div className="border-b border-[var(--dt-border)] pb-2 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-[var(--dt-text-primary)]">📊 相似照片组列表</h3>
                            <span className="text-[10px] text-[var(--dt-text-soft)] font-mono">共 {similarGroups.length} 组</span>
                          </div>
                          {similarGroups.length === 0 ? (
                            <div className="text-center py-10 bg-black/10 rounded border border-[var(--dt-border)] text-xs text-[var(--dt-text-soft)]">
                              未发现相似照片。
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {similarGroups.map((group, idx) => {
                                const groupPhotos = group.photoIds
                                  .map(id => photos.find(p => p.id === id))
                                  .filter((p): p is PhotoItem => !!p);
                                const displayedPhotos = groupPhotos.slice(0, 5);
                                const remainingCount = groupPhotos.length - 5;

                                return (
                                  <div 
                                    key={group.id} 
                                    onClick={() => {
                                      if (hasNativeSource) {
                                        setFilteredGroupId(group.id);
                                      } else {
                                        startBattleForGroup(group.id);
                                      }
                                    }}
                                    className={cn(
                                      "w-full text-left p-3 rounded border flex flex-col justify-between gap-3 transition-all duration-200 select-none outline-none cursor-pointer",
                                      group.battleCompleted
                                        ? "bg-[#222832]/50 border-[var(--dt-border)] hover:bg-[#2C3440]/60 hover:border-[var(--dt-border-strong)]"
                                        : "bg-amber-500/5 border-amber-500/20 hover:bg-[#2C3440]/60 hover:border-[var(--dt-border-strong)]",
                                      "active:scale-[0.99] active:translate-y-[0.5px]"
                                    )}
                                  >
                                    <div className="flex items-center justify-between w-full gap-3">
                                      <div className="space-y-1">
                                        <p className="text-[11px] font-bold text-[var(--dt-text-primary)]">相似组 #{idx + 1}</p>
                                        <p className="text-[10px] text-[var(--dt-text-soft)]">
                                          包含 {group.photoIds.length} 张照片 • {hasNativeSource ? "已识别" : (group.battleCompleted ? "⚔️ 对决已完成" : "⏳ 待筛选对决")}
                                        </p>
                                      </div>
                                      <div className="shrink-0 flex items-center gap-1.5">
                                        {hasNativeSource ? (
                                          <>
                                            <span className="text-[10px] text-[var(--dt-text-soft)] border border-[var(--dt-border)] bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                                              查看组内照片
                                            </span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                startBattleForGroup(group.id, { allowNative: true });
                                              }}
                                              className="text-[10px] text-amber-300 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded hover:bg-amber-500/20 transition-all font-bold"
                                            >
                                              重新对比
                                            </button>
                                          </>
                                        ) : group.battleCompleted ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startBattleForGroup(group.id);
                                            }}
                                            className="text-[10px] text-[var(--dt-text-soft)] border border-[var(--dt-border)] bg-white/5 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-white/10"
                                          >
                                            重新对决
                                          </button>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startBattleForGroup(group.id);
                                            }}
                                            className="text-[10px] text-amber-300 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-amber-500/20"
                                          >
                                            <GitCompare className="h-2.5 w-2.5" /> 开始对决
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Thumbnails Rail */}
                                    <div className="flex items-center gap-1.5 mt-1 w-full overflow-hidden">
                                      {displayedPhotos.map(photo => (
                                        <div 
                                          key={photo.id}
                                          className="w-12 h-12 border border-white/10 rounded bg-black/30 overflow-hidden flex items-center justify-center shrink-0"
                                        >
                                          <img 
                                            src={photo.url} 
                                            alt="" 
                                            className="w-full h-full object-cover pointer-events-none" 
                                          />
                                        </div>
                                      ))}
                                      {remainingCount > 0 && (
                                        <div 
                                          className="w-12 h-12 border border-white/10 rounded bg-black/60 flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                                        >
                                          +{remainingCount}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'battle-status' && (
                    <div className="space-y-4 text-left animate-fade-in-up select-none">
                      <div className="border-b border-[var(--dt-border)] pb-2">
                        <h3 className="text-xs font-bold text-[var(--dt-text-primary)]">⚔️ A/B 对局进度与指示</h3>
                      </div>
                      
                      {hasNativeSource ? (
                        similarGroups.length === 0 ? (
                          <div className="text-center py-10 bg-black/10 rounded border border-[var(--dt-border)] text-xs text-[var(--dt-text-soft)]">
                            未发现足够相似的照片组，因此不会自动进入 A/B。你仍可查看整理结果。
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Start A/B Button */}
                            <div className="flex items-center justify-between bg-black/10 border border-[var(--dt-border)] p-3 rounded">
                              <span className="text-[11px] text-[var(--dt-text-soft)]">
                                对局将连续在相似照片组间流转，系统会引导您挑选最想保留的照片。
                              </span>
                              {pendingGroupsCount > 0 && (
                                <button
                                  onClick={() => {
                                    const firstPending = similarGroups.find(g => !g.battleCompleted);
                                    if (firstPending) {
                                      startBattleForGroup(firstPending.id, { allowNative: true });
                                    }
                                  }}
                                  className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold px-3 py-1.5 rounded text-[10px] flex items-center gap-1.5 transition-all shrink-0"
                                >
                                  <GitCompare className="h-3 w-3" />
                                  开始本地 A/B 对局
                                </button>
                              )}
                            </div>

                            {/* Similar Groups list with buttons */}
                            <div className="space-y-2">
                              {similarGroups.map((group, idx) => {
                                return (
                                  <div 
                                    key={group.id}
                                    className="p-3 rounded border border-[var(--dt-border)] bg-[var(--dt-card-bg)] flex items-center justify-between text-xs"
                                  >
                                    <div className="space-y-0.5">
                                      <p className="font-bold text-[var(--dt-text-primary)]">相似组 #{idx + 1}</p>
                                      <p className="text-[10px] text-[var(--dt-text-soft)]">
                                        包含 {group.photoIds.length} 张照片 • {group.battleCompleted ? "已完成对比" : "待对决"}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => startBattleForGroup(group.id, { allowNative: true })}
                                      className="desktop-button-secondary text-[10px] py-1 px-3 font-bold border border-[var(--dt-border)]"
                                    >
                                      {group.battleCompleted ? "重新对比" : "开始对决"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )
                      ) : (
                        <div className={cn(
                          "p-3.5 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs",
                          pendingGroupsCount > 0 
                            ? "bg-amber-950/10 border-amber-500/20 text-amber-400/90"
                            : "bg-emerald-950/10 border-emerald-500/20 text-emerald-400/90"
                        )}>
                          <div className="space-y-1">
                            <p className="font-bold flex items-center gap-2">
                              {pendingGroupsCount > 0 ? (
                                <>
                                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                                  <span>有 {pendingGroupsCount} 组相似照片尚未完成对决</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                                  <span>所有相似照片对局均已完成</span>
                                </>
                              )}
                            </p>
                            <p className="text-[10px] text-[var(--dt-text-soft)]">
                              {pendingGroupsCount > 0 
                                ? "建议您先完成相似照片的 A/B 筛选对比，系统将自动推荐保留清晰度高、曝光好的照片，这有利于获取最佳的整理效果。"
                                : "您已完成全部对决。保留照片和淘汰候选照片目前处于最优状态，可直接查看结果或导出。"}
                            </p>
                          </div>
                          {pendingGroupsCount > 0 && (
                            <button
                              onClick={() => {
                                const group = similarGroups.find(g => !g.battleCompleted);
                                if (group) startBattleForGroup(group.id);
                              }}
                              className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold px-3 py-1.5 rounded text-[10px] flex items-center gap-1.5 transition-all self-start sm:self-center shrink-0"
                            >
                              <GitCompare className="h-3 w-3" />
                              开始/继续 A/B 对局
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  </div>
                </>
              )}
            </main>
          </div>
        </div>

        {/* Status Bar */}
        <DesktopStatusBar statusText={statusText} />
      </div>

      {/* 导出弹出面板 (整合至 Workflow 导出入口，带 0.25s/0.2s 缩放渐显/隐动效，定位在 sidebar 旁边) */}
      {(exportOpen || isExportClosing) && (
        <>
          {/* 点击外部遮罩 */}
          <div 
            className="fixed inset-0 z-40 bg-black/5 transition-opacity duration-200"
            onClick={handleCloseExport}
          />
          <div 
            style={exportAnchorRect ? {
              left: `${exportAnchorRect.right + 12}px`,
              top: `${Math.max(20, Math.min(typeof window !== 'undefined' ? window.innerHeight - 260 : 300, exportAnchorRect.top + (exportAnchorRect.height / 2) - 120))}px`
            } : undefined}
            className={cn(
              "fixed z-50 w-[420px] desktop-frosted-popover p-4 rounded overflow-hidden focus:outline-none",
              isExportClosing ? "animate-export-out" : "animate-export-in"
            )}
          >
            <ExportPanel
              totalPhotoCount={photos.length}
              keepCount={keepPhotos.length}
              keepSpaceMB={keepSpaceMB}
              cullCount={deletePhotos.length}
              spaceSavedMB={spaceSavedMB}
              isZipping={isZipping}
              zipExportWarning={zipExportWarning}
              pendingGroupsCount={pendingGroupsCount}
              similarGroupsCount={similarGroups.length}
              projectName={projectName}
              onExportKeepZip={downloadPhotosZip}
              onExportManifestCsv={handleExportManifestCsv}
              onExportManifestJson={handleExportManifestJson}
              onContinueBattle={() => {
                const group = similarGroups.find(g => !g.battleCompleted);
                if (group) startBattleForGroup(group.id, hasNativeSource ? { allowNative: true } : undefined);
                handleCloseExport();
              }}
              onRestart={() => {
                handleRestart();
                handleCloseExport();
              }}
              hasNativeSource={hasNativeSource}
              onExportKeepToFolder={handleExportKeepToFolder}
              isFolderExporting={isFolderExporting}
              folderExportStatus={folderExportStatus}
              folderExportResultCount={folderExportResultCount}
              folderExportError={folderExportError}
            />
          </div>
        </>
      )}

        {/* Photo Diagnostics Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent 
          style={{
            background: 'linear-gradient(135deg, rgba(30, 35, 42, 0.96), rgba(40, 46, 54, 0.98))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}
          className="sm:max-w-3xl w-[90vw] max-h-[85vh] flex flex-col text-[var(--dt-text-primary)] p-5 rounded-xl border-white/5"
        >
          {selectedPhoto && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="text-sm font-bold text-[var(--dt-text-primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <span className="truncate max-w-full sm:max-w-[70%] block text-left" title={getPhotoDisplayName(selectedPhoto)}>
                    像素分析诊断: {getPhotoDisplayName(selectedPhoto)}
                  </span>
                  <span className="shrink-0 text-left">
                    {renderIssueBadge(selectedPhoto)}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="overflow-y-auto pr-1 my-3 flex-grow max-h-[50vh] scrollbar-thin">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-1">
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-white/5 bg-black/25 flex items-center justify-center">
                    <img
                      src={selectedPhoto.url}
                      alt={getPhotoDisplayName(selectedPhoto)}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="space-y-3 flex flex-col justify-between text-left">
                    <div>
                      {/* Summary Section */}
                      <div className="bg-black/20 border border-white/5 rounded-lg p-3 mb-2.5">
                        <h4 className="text-[10px] font-bold text-yellow-400 mb-1.5 flex items-center gap-1.5">
                          <Sliders className="h-3.5 w-3.5" />
                          {"\u6574\u7406\u5efa\u8bae"}
                        </h4>
                        <p className="text-[11px] text-[var(--dt-text-secondary)] leading-relaxed">
                          {getDetailSuggestionText(selectedPhoto)}
                        </p>
                      </div>

                      {/* Observations Section */}
                      <div className="bg-black/10 border border-white/5 rounded-lg p-3 mb-2.5 space-y-2 text-[11px]">
                        <div>
                          <span className="text-[var(--dt-text-soft)] font-medium">{"\u6e05\u6670\u5ea6\u8bc4\u4f30\uff1a"}</span>
                          <span className="text-[var(--dt-text-primary)] font-semibold">{getDetailClarityLabel(selectedPhoto)}</span>
                        </div>
                        <div>
                          <span className="text-[var(--dt-text-soft)] font-medium">{"\u66b4\u5149\u4eae\u5ea6\u8bc4\u4f30\uff1a"}</span>
                          <span className="text-[var(--dt-text-primary)] font-semibold">{getDetailExposureLabel(selectedPhoto)}</span>
                        </div>
                        {selectedPhoto.duplicateGroupId && (
                          <div className="text-[var(--dt-text-secondary)] bg-white/5 p-2 rounded border border-white/5 text-[10px] mt-1">
                            {"\u2139\ufe0f \u8be5\u7167\u7247\u5c5e\u4e8e\u76f8\u4f3c\u7167\u7247\u7ec4\uff0c\u5efa\u8bae\u4eba\u5de5\u5bf9\u6bd4 A/B \u7b5b\u9009\u3002"}
                          </div>
                        )}
                      </div>

                      {/* Technical parameters (Collapsed) */}
                      <details className="text-[10px] text-[var(--dt-text-soft)] cursor-pointer mt-1 border border-white/5 rounded-lg p-2.5 bg-black/5">
                        <summary className="hover:text-[var(--dt-text-primary)] list-none flex items-center gap-1 select-none font-semibold text-[10.5px]">
                          <span>▶</span> {"\u67e5\u770b AI \u6280\u672f\u5206\u6570\u4e0e\u53c2\u6570"}
                        </summary>
                        <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10.5px]">
                              <span>{"\u7efc\u5408\u8d28\u91cf\u5f97\u5206"}</span>
                              <span className={cn("font-bold font-mono", getScoreColor(selectedPhoto.score))}>
                                {selectedPhoto.score} / 100
                              </span>
                            </div>
                            <Progress value={selectedPhoto.score} className="h-1 bg-white/5 rounded-full" />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10.5px]">
                              <span>{"\u5bf9\u7126\u6e05\u6670\u5ea6\u5f97\u5206"}</span>
                              <span className="font-bold font-mono">
                                {selectedPhoto.sharpnessScore} / 100
                              </span>
                            </div>
                            <Progress value={selectedPhoto.sharpnessScore} className="h-1 bg-white/5 rounded-full" />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10.5px]">
                              <span>{"\u66b4\u5149\u504f\u597d\u5f97\u5206"}</span>
                              <span className="font-bold font-mono">
                                {selectedPhoto.exposureScore} / 100
                              </span>
                            </div>
                            <Progress value={selectedPhoto.exposureScore} className="h-1 bg-white/5 rounded-full" />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10.5px]">
                              <span>{"\u66b4\u5149\u4eae\u5ea6\u504f\u5dee\u503c"}</span>
                              <span className="font-bold font-mono text-[var(--dt-text-primary)]">
                                {selectedPhoto.exposureValue > 0 ? `+${selectedPhoto.exposureValue}` : selectedPhoto.exposureValue}
                              </span>
                            </div>
                            <Progress value={Math.abs(selectedPhoto.exposureValue)} className="h-1 bg-white/5 rounded-full" />
                          </div>
                        </div>
                      </details>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-0.5 text-[10px] text-[var(--dt-text-soft)] font-mono">
                      <p>尺寸: {selectedPhoto.resolution}</p>
                      <p>大小: {selectedPhoto.size}</p>
                      <p>类型: {selectedPhoto.category}</p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-white/5 pt-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[10px] text-[var(--dt-text-soft)] text-left leading-normal max-w-full sm:max-w-[55%]">
                  {"\u26a0\ufe0f \u6dd8\u6c70\u5019\u9009\u4ec5\u4ee3\u8868\u6574\u7406\u5efa\u8bae\uff0c\u539f\u56fe\u4fdd\u6301\u4e0d\u53d8\uff0c\u4e0d\u4e0a\u4f20\u4e91\u7aef\uff0c\u4e0d\u4f1a\u7269\u7406\u4fee\u6539\u672c\u5730\u6587\u4ef6\u3002"}
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={() => setDialogOpen(false)}
                    className="desktop-button-secondary text-xs h-8 px-4 rounded"
                  >
                    {"关闭"}
                  </button>
                  
                  <button
                    disabled={getUserVisibleBucket(selectedPhoto) === 'keep'}
                    className={cn(
                      "font-bold text-xs h-8 rounded px-4 transition-all",
                      getUserVisibleBucket(selectedPhoto) === 'keep'
                        ? 'bg-[#6FA887]/20 text-[#6FA887]/60 cursor-not-allowed opacity-50 border-0'
                        : 'bg-[#6FA887] text-white hover:bg-[#6FA887]/90 border-0'
                    )}
                    onClick={() => {
                      updatePhotoStatus(selectedPhoto.id, 'keep');
                      setDialogOpen(false);
                    }}
                  >
                    标记为保留
                  </button>

                  <button
                    disabled={getUserVisibleBucket(selectedPhoto) === 'cull'}
                    className={cn(
                      "font-bold text-xs h-8 rounded px-4 transition-all",
                      getUserVisibleBucket(selectedPhoto) === 'cull'
                        ? 'bg-[#B96F68]/20 text-[#B96F68]/60 cursor-not-allowed opacity-50 border-0'
                        : 'bg-[#B96F68] text-white hover:bg-[#B96F68]/90 border-0'
                    )}
                    onClick={() => {
                      updatePhotoStatus(selectedPhoto.id, 'delete');
                      setDialogOpen(false);
                    }}
                  >
                    标记为淘汰候选
                  </button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Battle Overlay (A/B Compare) - 带有 0.3s 弹出和收紧退出过渡动画的自定义模态比对比对面板 */}
      {(localActiveBattle || isBattleClosing) && (() => {
        const battleObj = localActiveBattle || activeBattle;
        if (!battleObj) return null;

        const championId = battleObj.currentCandidateId;
        const isBattleCompleted = battleObj.nextIndex >= battleObj.contenderIds.length;
        const challengerId = isBattleCompleted 
          ? battleObj.contenderIds[battleObj.contenderIds.length - 1] 
          : battleObj.contenderIds[battleObj.nextIndex];
        const championPhoto = photos.find(p => p.id === championId);
        const challengerPhoto = photos.find(p => p.id === challengerId);

        const leftPhoto = winnerSide === 'left' ? championPhoto : challengerPhoto;
        const rightPhoto = winnerSide === 'left' ? challengerPhoto : championPhoto;
        const leftId = leftPhoto?.id;
        const rightId = rightPhoto?.id;

        return (
          <div className="fixed inset-0 z-40 bg-black/65 flex items-center justify-center p-4 select-none">
            <div 
              style={{
                background: 'linear-gradient(135deg, rgba(30, 35, 42, 0.98), rgba(40, 46, 54, 0.99))',
                border: '1px solid var(--dt-border-strong)',
              }}
              className={cn(
                "w-[98vw] h-[92vh] max-w-[1500px] flex flex-col text-[var(--dt-text-primary)] p-0 overflow-hidden rounded shadow-2xl relative",
                isBattleClosing ? "animate-battle-out" : "animate-battle-in"
              )}
            >
              <div className="p-3.5 border-b border-white/5 flex flex-row items-center justify-between space-y-0 shrink-0 relative">
                <div className="flex flex-col text-left">
                  <h3 className="text-xs font-bold text-[var(--dt-text-primary)] flex items-center gap-1.5">
                    <GitCompare className="h-4 w-4 text-yellow-400" />
                    {hasNativeSource ? `相似组 #${similarGroups.findIndex(g => g.id === battleObj.groupId) + 1} - 本地处理` : "选择更想保留的一张"}
                  </h3>
                </div>
                <div className="bg-black/25 border border-white/5 rounded px-2.5 py-1 text-[10px] text-[var(--dt-text-primary)] font-mono font-bold">
                  当前组: {battleObj.roundIndex} / {battleObj.totalRounds}
                </div>
                <div className="flex items-center gap-2">
                  <span className="desktop-pill text-[9px] scale-90 border-white/5 bg-white/5">
                    Esc 关闭
                  </span>
                  <Button 
                    size="icon" 
                    className="h-7 w-7 text-[var(--dt-text-soft)] bg-transparent hover:bg-white/5 hover:text-[var(--dt-text-primary)] border-0"
                    onClick={handleCloseBattleWithAnimation}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {/* Thin progress line at the bottom of the header */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
                  <div 
                    className="h-full bg-yellow-500/60 transition-all duration-300 ease-out"
                    style={{ width: `${(battleObj.roundIndex / battleObj.totalRounds) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex-1 p-4 flex flex-col justify-between min-h-0 bg-[var(--dt-workspace-bg)]">
                <div key={`${battleObj.groupId}-${leftId}-${rightId}`} className="desktop-battle-stage relative">
                  {/* Floating guide hint in the middle bottom */}
                  <div className={cn(
                    "absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-all duration-500",
                    abGuidanceDismissed ? "opacity-15 scale-95" : "opacity-85 scale-100"
                  )}>
                    <div className="bg-[#12151A]/90 border border-white/10 px-3 py-1.5 rounded-full text-[10px] text-[var(--dt-text-soft)] font-medium flex items-center gap-1.5 backdrop-blur-sm shadow-md">
                      <span>💡 滚轮缩放 · 拖拽平移 · 双击重置</span>
                    </div>
                  </div>

                  {/* Left Photo (current best candidate) */}
                  {leftPhoto ? (
                    <div className="desktop-battle-photo-card">
                      <div 
                        className={cn(
                          "desktop-battle-photo-wrapper overflow-hidden relative group",
                          leftScale > 1 ? (isLeftDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
                        )}
                        onWheel={(e) => handleWheel(e, 'left')}
                        onMouseDown={(e) => handleMouseDown(e, 'left')}
                        onMouseMove={(e) => handleMouseMove(e, 'left')}
                        onMouseUp={() => handleMouseUpOrLeave('left')}
                        onMouseLeave={() => handleMouseUpOrLeave('left')}
                        onDoubleClick={() => handleDoubleClick('left')}
                      >
                        <img 
                          src={leftPhoto.url} 
                          alt={getPhotoDisplayName(leftPhoto)} 
                          style={{ 
                            transform: `translate(${leftX}px, ${leftY}px) scale(${leftScale})`,
                            transition: isLeftDragging ? 'none' : 'transform 0.1s ease-out'
                          }}
                          className="max-w-full max-h-full object-contain p-1 select-none pointer-events-none" 
                        />
                        <div 
                          className={cn(
                            "absolute top-2 left-2 z-10 transition-opacity duration-200 pointer-events-none",
                            isLeftDragging ? "opacity-20" : "group-hover:opacity-20"
                          )}
                        >
                          <Badge className={cn(
                            "text-white border-0 text-[9px] font-bold py-0.5 px-2 shadow-sm",
                            winnerSide === 'left' ? "bg-[#6FA887]" : "bg-[#6F8FA8]"
                          )}>
                            {winnerSide === 'left' ? "👑 当前优选" : "⚔️ 挑战照片"} [ ← ] ({leftScale.toFixed(1)}x)
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-black/25 text-[var(--dt-text-soft)] rounded-lg">找不到左图</div>
                  )}

                  {/* VS 中间分隔 */}
                  <div className="flex flex-col items-center justify-center relative w-2 shrink-0">
                    <div className="absolute top-0 bottom-0 w-px bg-white/5" />
                    <div className="desktop-battle-vs-badge z-10">VS</div>
                  </div>

                  {/* Right Photo (challenger) */}
                  {rightPhoto ? (
                    <div className="desktop-battle-photo-card">
                      <div 
                        className={cn(
                          "desktop-battle-photo-wrapper overflow-hidden relative group",
                          rightScale > 1 ? (isRightDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
                        )}
                        onWheel={(e) => handleWheel(e, 'right')}
                        onMouseDown={(e) => handleMouseDown(e, 'right')}
                        onMouseMove={(e) => handleMouseMove(e, 'right')}
                        onMouseUp={() => handleMouseUpOrLeave('right')}
                        onMouseLeave={() => handleMouseUpOrLeave('right')}
                        onDoubleClick={() => handleDoubleClick('right')}
                      >
                        <img 
                          src={rightPhoto.url} 
                          alt={getPhotoDisplayName(rightPhoto)} 
                          style={{ 
                            transform: `translate(${rightX}px, ${rightY}px) scale(${rightScale})`,
                            transition: isRightDragging ? 'none' : 'transform 0.1s ease-out'
                          }}
                          className="max-w-full max-h-full object-contain p-1 select-none pointer-events-none" 
                        />
                        <div 
                          className={cn(
                            "absolute top-2 right-2 z-10 transition-opacity duration-200 pointer-events-none",
                            isRightDragging ? "opacity-20" : "group-hover:opacity-20"
                          )}
                        >
                          <Badge className={cn(
                            "text-white border-0 text-[9px] font-bold py-0.5 px-2 shadow-sm",
                            winnerSide === 'left' ? "bg-[#6F8FA8]" : "bg-[#6FA887]"
                          )}>
                            {winnerSide === 'left' ? "⚔️ 挑战照片" : "👑 当前优选"} [ → ] ({rightScale.toFixed(1)}x)
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-black/25 text-[var(--dt-text-soft)] rounded-lg">找不到右图</div>
                  )}
                </div>

                {/* A/B Decision Buttons Bar */}
                <div className="flex flex-row justify-center items-center gap-3 mt-3 shrink-0">
                  <button
                    onClick={() => applyBattleDecision('keep_left')}
                    className="desktop-button-secondary text-xs h-9 px-4 rounded font-bold border border-white/10 flex items-center gap-1.5"
                  >
                    <span>👈 保留左侧</span>
                    <span className="text-[10px] opacity-40 font-mono">[ ← ]</span>
                  </button>

                  <button
                    onClick={() => applyBattleDecision('keep_right')}
                    className="desktop-button-secondary text-xs h-9 px-4 rounded font-bold border border-white/10 flex items-center gap-1.5"
                  >
                    <span>保留右侧 👉</span>
                    <span className="text-[10px] opacity-40 font-mono">[ → ]</span>
                  </button>

                  <div className="w-px h-6 bg-white/10 mx-1" />

                  <button
                    onClick={() => applyBattleDecision('keep_both')}
                    className="desktop-button-secondary text-xs h-9 px-4 rounded font-bold border border-white/10 flex items-center gap-1.5"
                  >
                    <span>🙌 保留两张</span>
                    <span className="text-[10px] opacity-40 font-mono">[ B ]</span>
                  </button>

                  <button
                    onClick={() => applyBattleDecision('cull_both')}
                    className="desktop-button-secondary text-xs h-9 px-4 rounded font-bold border border-white/10 flex items-center gap-1.5 text-red-400 hover:text-red-300"
                  >
                    <span>🗑️ 淘汰两张</span>
                    <span className="text-[10px] opacity-40 font-mono">[ C ]</span>
                  </button>

                  <button
                    onClick={() => applyBattleDecision('skip')}
                    className="desktop-button-secondary text-xs h-9 px-4 rounded font-bold border border-white/10 flex items-center gap-1.5"
                  >
                    <span>⏭️ 跳过</span>
                    <span className="text-[10px] opacity-40 font-mono">[ S ]</span>
                  </button>
                </div>

                {/* Keyboard Shortcuts Hint Panel */}
                <div className="mt-2.5 py-1 px-4 bg-[#12151A]/60 border border-white/5 rounded flex items-center justify-center gap-4 text-[10px] text-[var(--dt-text-soft)] select-none shrink-0 mx-auto w-fit">
                  <span className="flex items-center gap-1.5">
                    <kbd className="desktop-battle-kbd px-1.5 py-0.5 rounded border bg-neutral-900 border-white/10 text-white font-mono text-[9px] shadow-sm">←</kbd>
                    <span className="text-white/30">/</span>
                    <kbd className="desktop-battle-kbd px-1.5 py-0.5 rounded border bg-neutral-900 border-white/10 text-white font-mono text-[9px] shadow-sm">→</kbd>
                    <span>选择左右</span>
                  </span>
                  <span className="w-px h-3 bg-white/5" />
                  <span className="flex items-center gap-1.5">
                    <kbd className="desktop-battle-kbd px-1.5 py-0.5 rounded border bg-neutral-900 border-white/10 text-white font-mono text-[9px] shadow-sm">B</kbd>
                    <span>保留两张</span>
                  </span>
                  <span className="w-px h-3 bg-white/5" />
                  <span className="flex items-center gap-1.5">
                    <kbd className="desktop-battle-kbd px-1.5 py-0.5 rounded border bg-neutral-900 border-white/10 text-white font-mono text-[9px] shadow-sm">C</kbd>
                    <span>淘汰两张</span>
                  </span>
                  <span className="w-px h-3 bg-white/5" />
                  <span className="flex items-center gap-1.5">
                    <kbd className="desktop-battle-kbd px-1.5 py-0.5 rounded border bg-neutral-900 border-white/10 text-white font-mono text-[9px] shadow-sm">S</kbd>
                    <span>跳过</span>
                  </span>
                  <span className="w-px h-3 bg-white/5" />
                  <span className="flex items-center gap-1.5">
                    <kbd className="desktop-battle-kbd px-1.5 py-0.5 rounded border bg-neutral-900 border-white/10 text-white font-mono text-[9px] shadow-sm">Esc</kbd>
                    <span>退出 / 关闭</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* 本地整理输出 Wizard Dialog */}
      <Dialog open={physicalOrgDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleClosePhysicalOrgDialog();
        }
      }}>
        <DialogContent 
          style={{
            background: 'linear-gradient(135deg, rgba(30, 35, 42, 0.96), rgba(40, 46, 54, 0.98))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}
          className="sm:max-w-xl w-[90vw] max-h-[85vh] flex flex-col text-[var(--dt-text-primary)] p-5 rounded-xl border-white/5"
        >
          <DialogHeader className="shrink-0 border-b border-white/5 pb-2">
            <DialogTitle className="text-sm font-bold text-[var(--dt-text-primary)] flex items-center justify-between">
              <span>本地整理输出 (MVP Plan)</span>
              <span className="text-[10px] text-[var(--dt-text-soft)] font-normal">步骤 {physicalOrgStep} / 4</span>
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto pr-1 my-4 flex-grow max-h-[55vh] scrollbar-thin text-xs space-y-3">
            {orgError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded text-[11px] leading-relaxed">
                ⚠️ 出错啦：{orgError}
              </div>
            )}

            {physicalOrgStep === 1 && (
              <div className="space-y-4 text-left">
                <p className="text-[var(--dt-text-secondary)] leading-relaxed">
                  第一步：请选择用于存放整理后照片的本地输出位置。原图文件夹绝对不会被修改、移动或删除。
                </p>
                <div className="bg-black/10 border border-white/5 p-3 rounded space-y-1.5 text-[11px] text-[var(--dt-text-soft)]">
                  <p>• 安全沙箱：输出文件夹不能与导入的源文件夹重叠。</p>
                  <p>• 原图只读：源相册原图保持只读状态，确保安全。</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectOutputFolder}
                    className="desktop-button-primary py-2 px-4 font-bold"
                  >
                    选择输出位置
                  </button>
                  {physicalOrgToken ? (
                    <span className="text-emerald-400 font-semibold">{physicalOrgLabel}</span>
                  ) : (
                    <span className="text-[var(--dt-text-soft)]">尚未选择输出位置</span>
                  )}
                </div>
                {physicalOrgToken && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setPhysicalOrgStep(2)}
                      className="desktop-button-primary py-2 px-4 font-bold"
                    >
                      下一步：生成整理计划
                    </button>
                  </div>
                )}
              </div>
            )}

            {physicalOrgStep === 2 && (
              <div className="space-y-4 text-left">
                <p className="text-[var(--dt-text-secondary)] leading-relaxed">
                  第二步：基于当前整理状态生成脱敏计划。我们将模拟分析每个文件在输出目录下的结构。
                </p>
                <div className="bg-black/10 border border-white/5 p-3 rounded space-y-1.5 text-[11px] text-[var(--dt-text-soft)]">
                  <p>• 保留照片 &rarr; 存入 Keep/ 子文件夹</p>
                  <p>• 淘汰候选照片 &rarr; 存入 Cull-Candidates/ 子文件夹</p>
                  <p>• 清单说明 &rarr; 生成 manifest.json 记录</p>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setPhysicalOrgStep(1)}
                    className="desktop-button-secondary py-2 px-4 border border-white/10"
                  >
                    上一步
                  </button>
                  <button
                    onClick={handleGeneratePlan}
                    disabled={isGeneratingPlan}
                    className="desktop-button-primary py-2 px-4 font-bold disabled:opacity-50"
                  >
                    {isGeneratingPlan ? "正在生成计划..." : "生成整理计划"}
                  </button>
                </div>
              </div>
            )}

            {physicalOrgStep === 3 && dryRunResult && (
              <div className="space-y-4 text-left">
                <p className="text-[var(--dt-text-secondary)] leading-relaxed">
                  第三步：预览整理计划。以下是模拟分析生成的报告指标。
                </p>
                
                <div className="grid grid-cols-2 gap-2 bg-black/15 border border-white/5 p-3 rounded text-[11px]">
                  <div>
                    <span className="text-[var(--dt-text-soft)]">计划处理数量：</span>
                    <span className="font-bold text-[var(--dt-text-primary)]">{dryRunResult.totalItems} 张</span>
                  </div>
                  <div>
                    <span className="text-[var(--dt-text-soft)]">是否可以继续：</span>
                    <span className={`font-bold ${dryRunResult.canProceed ? "text-emerald-400" : "text-red-400"}`}>
                      {dryRunResult.canProceed ? "是" : "否"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--dt-text-soft)]">保留照片数量：</span>
                    <span className="font-bold text-emerald-400">{dryRunResult.keepCount} 张</span>
                  </div>
                  <div>
                    <span className="text-[var(--dt-text-soft)]">淘汰候选照片：</span>
                    <span className="font-bold text-rose-400">{dryRunResult.cullCandidateCount} 张</span>
                  </div>
                  <div>
                    <span className="text-[var(--dt-text-soft)]">跳过照片数量：</span>
                    <span className="font-bold text-yellow-400">{dryRunResult.skippedCount} 张</span>
                  </div>
                  <div>
                    <span className="text-[var(--dt-text-soft)]">重名冲突数量：</span>
                    <span className={`font-bold ${dryRunResult.conflictCount > 0 ? "text-amber-400" : "text-[var(--dt-text-primary)]"}`}>
                      {dryRunResult.conflictCount} 个
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[var(--dt-text-soft)]">安全估算大小：</span>
                    <span className="font-bold text-[var(--dt-text-primary)]">
                      {((dryRunResult.estimatedBytes ?? 0) / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>

                {dryRunResult.warnings.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2.5 rounded text-[11px] leading-relaxed">
                    {dryRunResult.warnings.map((w, idx) => (
                      <p key={idx}>⚠️ {w}</p>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <h4 className="font-bold text-[var(--dt-text-primary)] text-[11px]">📋 整理计划条目预览 (仅显示前 6 条)：</h4>
                  <div className="border border-white/5 rounded divide-y divide-white/5 max-h-[160px] overflow-y-auto scrollbar-thin bg-black/10">
                    {dryRunResult.items.slice(0, 6).map((item) => (
                      <div key={item.photoId} className="p-2 flex items-center justify-between text-[10.5px]">
                        <span className="font-mono text-[var(--dt-text-primary)]">{item.displayName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          item.targetBucket === 'keep' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {item.targetBucket === 'keep' ? '保留照片' : '淘汰候选'}
                        </span>
                        <span className="text-[var(--dt-text-soft)] truncate max-w-[200px] font-mono" title={item.targetRelativePath}>
                          {item.targetRelativePath || "(跳过)"}
                        </span>
                      </div>
                    ))}
                    {dryRunResult.items.length > 6 && (
                      <div className="p-2 text-center text-[10px] text-[var(--dt-text-soft)]">
                        ... 以及另外 {dryRunResult.items.length - 6} 张照片的整理计划
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-[var(--dt-text-soft)] bg-white/5 p-2.5 rounded border border-white/5 space-y-1">
                  <p>💡 说明：原图保持不变。</p>
                  <p>只复制到新文件夹，不会移动或删除原图。</p>
                </div>

                {hasExecutedCopy && (
                  <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-2.5 rounded text-[11px] leading-relaxed">
                    此整理计划已完成。如需再次输出，请重新生成整理计划。
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setPhysicalOrgStep(2)}
                    disabled={isExecutingCopy}
                    className="desktop-button-secondary py-2 px-4 border border-white/10 disabled:opacity-50"
                  >
                    上一步
                  </button>
                  <button
                    onClick={handleExecuteCopy}
                    disabled={isExecutingCopy || hasExecutedCopy || !dryRunResult.canProceed}
                    className="desktop-button-primary py-2 px-4 font-bold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isExecutingCopy ? "正在复制到新文件夹…" : (hasExecutedCopy ? "复制完成" : "开始复制到新文件夹")}
                  </button>
                </div>
              </div>
            )}

            {physicalOrgStep === 4 && executionResult && (
              <div className="space-y-4 text-left animate-fade-in">
                {executionResult.failedCount > 0 ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-lg space-y-2">
                    <h4 className="font-bold text-sm">⚠️ 部分照片未复制，请查看整理报告。</h4>
                    <p className="text-[11px] leading-relaxed">
                      原图保持不变，只复制到新文件夹，不会移动或删除原图。
                    </p>
                    <p className="text-[11px] font-bold text-amber-300">
                      此整理计划已完成。如需再次输出，请重新生成整理计划。
                    </p>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg space-y-2">
                    <h4 className="font-bold text-sm">🎉 复制完成</h4>
                    <p className="text-[11px] leading-relaxed">
                      照片已成功组织并复制到新文件夹。原图保持不变，只复制到新文件夹，不会移动或删除原图。
                    </p>
                    <p className="text-[11px] font-bold text-emerald-300">
                      此整理计划已完成。如需再次输出，请重新生成整理计划。
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 bg-black/15 border border-white/5 p-3 rounded text-[11px]">
                  <div>
                    <span className="text-[var(--dt-text-soft)]">复制成功：</span>
                    <span className="font-bold text-emerald-400">{executionResult.copiedCount} 张</span>
                  </div>
                  <div>
                    <span className="text-[var(--dt-text-soft)]">跳过数量：</span>
                    <span className="font-bold text-yellow-400">{executionResult.skippedCount} 张</span>
                  </div>
                  <div>
                    <span className="text-[var(--dt-text-soft)]">失败数量：</span>
                    <span className="font-bold text-rose-400">{executionResult.failedCount} 张</span>
                  </div>
                </div>

                {executionResult.warnings.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2.5 rounded text-[11px] leading-relaxed">
                    {executionResult.warnings.map((w, idx) => (
                      <p key={idx}>⚠️ {w}</p>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <h4 className="font-bold text-[var(--dt-text-primary)] text-[11px]">📋 复制执行报告 (仅显示前 6 条)：</h4>
                  <div className="border border-white/5 rounded divide-y divide-white/5 max-h-[160px] overflow-y-auto scrollbar-thin bg-black/10">
                    {executionResult.reportItems.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-[10.5px]">
                        <span className="font-mono text-[var(--dt-text-primary)]">{item.displayName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          item.status === 'copied' 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : item.status === 'skipped' 
                            ? 'bg-yellow-500/10 text-yellow-400' 
                            : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {item.status === 'copied' ? '已复制' : item.status === 'skipped' ? '跳过' : '失败'}
                        </span>
                        <span className="text-[var(--dt-text-soft)] truncate max-w-[200px] font-mono" title={item.outputRelativePath}>
                          {item.outputRelativePath || "(无)"}
                        </span>
                      </div>
                    ))}
                    {executionResult.reportItems.length > 6 && (
                      <div className="p-2 text-center text-[10px] text-[var(--dt-text-soft)]">
                        ... 以及另外 {executionResult.reportItems.length - 6} 张照片的报告
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleClosePhysicalOrgDialog}
                    className="desktop-button-primary py-2 px-6 font-bold"
                  >
                    完成
                  </button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-white/5 pt-2 shrink-0 flex items-center justify-between">
            <span className="text-[9.5px] text-[var(--dt-text-soft)] text-left leading-normal">
              🛡️ AI Photo Cleaner 安全整理沙箱运行中
            </span>
            <button 
              onClick={handleClosePhysicalOrgDialog}
              className="desktop-button-secondary text-[11px] h-7 px-3 rounded border border-white/10"
            >
              关闭
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Zoom Preview Modal */}
      {(previewPhoto || isAnimateIn) && (
        <div 
          className={cn(
            "fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center p-4 pt-20 transition-all duration-400 ease-out select-none",
            isAnimateIn ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={closePreviewModal}
        >
          {/* Centered Modal Card Box with safety top spacing */}
          <div 
            className={cn(
              "w-[85vw] h-[78vh] max-w-7xl max-h-[78vh] bg-[#12161A]/95 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden relative transition-all duration-400 ease-out",
              isAnimateIn ? "scale-100" : "scale-95"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title bar with Close button on the right, filename and guide on the left */}
            <div 
              className="h-12 bg-black/40 border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-10"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--dt-text-primary)]">
                  {previewPhoto ? getPhotoDisplayName(previewPhoto) : ""}
                </span>
                <span className="text-[10px] text-[var(--dt-text-soft)] hidden sm:inline-block border-l border-white/10 pl-3">
                  滚轮缩放 ({previewScale.toFixed(1)}x) • 拖动平移 • 双击重置
                </span>
              </div>
              <div>
                <button 
                  onClick={closePreviewModal}
                  className="px-4 py-1.5 bg-[#B96F68] hover:bg-[#B96F68]/90 text-white text-xs font-bold rounded-md border border-red-500/10 shadow-lg flex items-center gap-1 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="关闭预览 (Esc / 点击外部)"
                >
                  <span>关闭预览</span>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Interactive Zoom/Pan area */}
            <div 
              className={cn(
                "flex-grow flex items-center justify-center overflow-hidden relative bg-black/20",
                previewScale > 1 ? (isPreviewDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
              )}
              onWheel={handlePreviewWheel}
              onMouseDown={(e) => {
                if (e.button !== 0 || previewScale <= 1) return;
                e.preventDefault();
                setIsPreviewDragging(true);
                setPreviewDragStart({ x: e.clientX - previewX, y: e.clientY - previewY });
              }}
              onMouseMove={(e) => {
                if (!isPreviewDragging) return;
                setPreviewX(e.clientX - previewDragStart.x);
                setPreviewY(e.clientY - previewDragStart.y);
              }}
              onMouseUp={() => setIsPreviewDragging(false)}
              onMouseLeave={() => setIsPreviewDragging(false)}
              onDoubleClick={() => {
                setPreviewScale(1);
                setPreviewX(0);
                setPreviewY(0);
                setIsPreviewDragging(false);
              }}
            >
              <img 
                src={previewPhoto?.url}
                alt={previewPhoto ? getPhotoDisplayName(previewPhoto) : ""}
                style={{
                  transform: `translate(${previewX}px, ${previewY}px) scale(${previewScale})`,
                  transition: isPreviewDragging ? 'none' : 'transform 0.1s ease-out',
                  maxHeight: '100%',
                  maxWidth: '100%',
                }}
                className="object-contain select-none pointer-events-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
