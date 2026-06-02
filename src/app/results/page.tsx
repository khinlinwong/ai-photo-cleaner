'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePhotoWorkspace, PhotoItem } from '@/context/PhotoWorkspaceContext';
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
  FolderOpen
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";
import VirtualPhotoGrid from '@/components/desktop/VirtualPhotoGrid';
import { buildManifestRows, buildManifestCsv, buildManifestJson } from '@/lib/export/exportManifest';
import { buildZipExportFilename, buildManifestExportFilename } from '@/lib/export/exportFilenames';
import { ResultsSummaryCards } from '@/components/results/ResultsSummaryCards';
import { ExportPanel } from '@/components/results/ExportPanel';
import { PhotoBucketSection } from '@/components/results/PhotoBucketSection';


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
    applyBattleDecision,
    closeBattle,
    projectName
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
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipExportWarning, setZipExportWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'keep' | 'cull' | 'similar' | 'battle-status'>('keep');
  const [exportOpen, setExportOpen] = useState(false);

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
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
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

  // 本地相似组弹窗控制机制，防止退出时陷入弹出循环
  const [dismissedGroups, setDismissedGroups] = useState<string[]>([]);

  // 全局轻量提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
  }, [activeBattle?.roundIndex, activeBattle?.groupId]);

  // A/B 对局弹窗的安全退出控制
  const handleCloseBattle = useCallback(() => {
    if (activeBattle) {
      setDismissedGroups((prev) => [...prev, activeBattle.groupId]);
    }
    closeBattle();
  }, [activeBattle, closeBattle]);

  // 当检测到当前组对比 PK 结束时，自动关闭当前对比，并流转到下一组或展示 Toast
  useEffect(() => {
    if (activeBattle) {
      const isBattleCompleted = activeBattle.nextIndex >= activeBattle.contenderIds.length;
      if (isBattleCompleted) {
        const remainingPendingCount = similarGroups.filter(
          g => g.id !== activeBattle.groupId && !g.battleCompleted
        ).length;
        if (remainingPendingCount === 0) {
          setToastMessage("A/B 对比已完成，结果已更新。");
          setTimeout(() => {
            setToastMessage(null);
          }, 3000);
        }
        closeBattle();
      }
    }
  }, [activeBattle, closeBattle, similarGroups]);

  // 自动弹出相似照片组 PK 流程（寻找首个 battleCompleted===false 且非忽略组）
  useEffect(() => {
    if (activeBattle) return;

    const nextPendingGroup = similarGroups.find(g => !g.battleCompleted);
    if (nextPendingGroup) {
      if (dismissedGroups.includes(nextPendingGroup.id)) {
        return;
      }
      startBattleForGroup(nextPendingGroup.id);
    }
  }, [similarGroups, activeBattle, dismissedGroups, startBattleForGroup]);

  // 键盘快捷键监听
  useEffect(() => {
    if (!activeBattle) return;

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
        handleCloseBattle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBattle, applyBattleDecision, handleCloseBattle]);


  // 鼠标滚轮缩放处理 (1x 到 4x)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>, side: 'left' | 'right') => {
    e.preventDefault();
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

  // 延时辅助函数
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // 纯客户端分批打包下载保留照片整理包 (JSZip)
  const downloadPhotosZip = async () => {
    // 增加 helper 判断，Native source 不允许 ZIP 导出
    const hasNative = photos.some(
      (p) => p.sourceType === 'native-folder-preview' || p.sourceType === 'native-folder-file'
    );
    if (hasNative) {
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
  const openDetail = (photo: PhotoItem) => {
    setSelectedPhoto(photo);
    setDialogOpen(true);
  };

  // 重新导入跳转到 /desktop
  const handleRestart = () => {
    resetWorkspace();
    router.push('/desktop');
  };

  // 获取问题标签（对应真实的 issue 类型）
  const renderIssueBadge = (photo: PhotoItem) => {
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
  };

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

  // 渲染单张照片卡片（高度固定为 280px，详情折叠使用悬浮框以免改变卡片高度）
  const renderPhotoCard = (photo: PhotoItem) => {
    const isSelected = selectedPhotoIds.includes(photo.id);

    return (
      <Card 
        className={cn(
          "w-full h-full overflow-visible rounded-lg border transition-all duration-200 relative shadow-sm hover:shadow-md flex flex-col justify-between",
          isSelected
            ? "border-emerald-500/80 bg-emerald-500/5 ring-1 ring-emerald-500/35"
            : getUserVisibleBucket(photo) === 'cull'
            ? "border-[#B96F68]/30 bg-[#B96F68]/5 hover:border-[#B96F68]/60 hover:bg-[#B96F68]/15" 
            : "border-white/5 bg-[var(--dt-card-bg)] hover:border-[#6F8FA8]/40 hover:bg-[#6F8FA8]/5"
        )}
      >
        {/* Image Section */}
        <div 
          className="relative h-[140px] w-full overflow-hidden bg-black/20 rounded-t-lg cursor-pointer select-none"
          onClick={() => toggleSelectPhoto(photo.id)}
        >
          <img
            src={photo.url}
            alt={photo.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-1.5 left-1.5 z-10 scale-90 origin-top-left">
            {renderIssueBadge(photo)}
          </div>
          {/* Checkbox Overlay */}
          <button
            type="button"
            className={cn(
              "absolute top-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border transition-all shadow-md focus:outline-none",
              isSelected
                ? "bg-emerald-500 border-emerald-400 text-white"
                : "bg-black/40 border-white/40 text-transparent hover:border-white hover:bg-black/60"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelectPhoto(photo.id);
            }}
          >
            {isSelected && <span className="text-[10px] font-bold">✓</span>}
          </button>
        </div>

        {/* Info details */}
        <CardContent className="p-2.5 flex-1 flex flex-col justify-between text-left relative">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-bold text-[var(--dt-text-primary)] truncate flex-1" title={photo.name}>{photo.name}</p>
              <span className="text-[8px] text-[var(--dt-text-soft)] shrink-0 font-mono">{photo.size}</span>
            </div>

            {/* 简单原因标签 */}
            <div className="flex items-center mt-0.5">
              <span className="text-[8.5px] text-[var(--dt-text-secondary)] font-medium bg-white/5 px-1.5 py-0.5 rounded border border-white/5 font-sans leading-none">
                {getReasonTags(photo)}
              </span>
            </div>
          </div>

          <div className="mt-1 relative">
            {/* 隐藏并折叠分值详情 */}
            <details className="text-[9px] text-[var(--dt-text-soft)] cursor-pointer mt-0.5 relative">
              <summary className="hover:text-[var(--dt-text-primary)] list-none flex items-center gap-1 select-none">
                <span className="text-[8px]">▶</span> 查看技术详情
              </summary>
              <div className="absolute bottom-[30px] left-0 right-0 bg-[#12161A]/95 border border-white/10 p-2.5 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-20 font-mono space-y-0.5 backdrop-blur-md">
                <p>综合质量: {photo.score} / 100</p>
                <p>对焦清晰: {photo.sharpnessScore} / 100</p>
                <p>曝光得分: {photo.exposureScore} / 100</p>
                <div className="pt-1.5 flex items-center justify-end border-t border-white/5 mt-1.5">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(photo);
                    }}
                    className="text-[8px] text-yellow-400 hover:underline flex items-center gap-0.5"
                  >
                    <Maximize2 className="h-2 w-2" /> 开启像素诊断仪
                  </button>
                </div>
              </div>
            </details>
          </div>

          {/* Row 4: Status Correction Buttons (Direct interaction) */}
          <div className="grid grid-cols-2 gap-1 mt-1.5 border-t border-white/5 pt-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              disabled={getUserVisibleBucket(photo) === 'keep'}
              className={cn(
                "h-5.5 px-0 text-[9px] flex items-center justify-center rounded transition-all font-semibold border-0",
                getUserVisibleBucket(photo) === 'keep'
                  ? "bg-[#6FA887]/20 text-[#6FA887]/60 cursor-not-allowed opacity-50" 
                  : "bg-white/5 hover:bg-[#6FA887]/20 hover:text-[#6FA887] text-[var(--dt-text-muted)]"
              )}
              onClick={() => updatePhotoStatus(photo.id, 'keep')}
            >
              标记为保留
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={getUserVisibleBucket(photo) === 'cull'}
              className={cn(
                "h-5.5 px-0 text-[9px] flex items-center justify-center rounded transition-all font-semibold border-0",
                getUserVisibleBucket(photo) === 'cull'
                  ? "bg-[#B96F68]/20 text-[#B96F68]/60 cursor-not-allowed opacity-50" 
                  : "bg-white/5 hover:bg-[#B96F68]/20 hover:text-[#B96F68] text-[var(--dt-text-muted)]"
              )}
              onClick={() => updatePhotoStatus(photo.id, 'delete')}
            >
              标记为淘汰候选
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

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
        minCardWidth={190}
        rowHeight={280}
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
          <DesktopSidebar activeId="review" onExportClick={() => setExportOpen(true)} />

          {/* Right Workstation Content */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <main className="flex-1 overflow-y-auto p-5 bg-[var(--dt-workspace-bg)] pb-24">
              
              {totalPhotos === 0 ? (
                <div className="max-w-xl mx-auto py-16 text-center select-none desktop-panel p-8">
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
                <div className="space-y-5">
                  
                  {/* 页面标题区 */}
                  <div className="flex items-center justify-between gap-4 border-b border-[var(--dt-border)] pb-3 select-none text-left">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold text-[var(--dt-text-primary)]">整理结果</h2>
                      <p className="text-[10.5px] text-[var(--dt-text-soft)] leading-relaxed">
                        这只调整整理结果，不会修改原图，原图在您的电脑上保持不变。
                      </p>
                    </div>
                    <button
                      onClick={handleRestart}
                      className="desktop-button-secondary text-[10px] py-1.5 h-8 flex items-center gap-1.5 font-bold shrink-0 border border-[var(--dt-border)]"
                    >
                      重新选择文件夹
                    </button>
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
                    onTabChange={setActiveTab}
                  />

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
                          {similarGroups.map((group, idx) => (
                            <div 
                              key={group.id} 
                              className={cn(
                                "p-3 rounded border flex items-center justify-between gap-3 transition-colors",
                                group.battleCompleted
                                  ? "bg-[#222832]/50 border-[var(--dt-border)]"
                                  : "bg-amber-500/5 border-amber-500/20"
                              )}
                            >
                              <div className="space-y-1">
                                <p className="text-[11px] font-bold text-[var(--dt-text-primary)]">相似组 #{idx + 1}</p>
                                <p className="text-[10px] text-[var(--dt-text-soft)]">
                                  包含 {group.photoIds.length} 张照片 • {group.battleCompleted ? "⚔️ 对决已完成" : "⏳ 待筛选对决"}
                                </p>
                              </div>
                              {!group.battleCompleted && (
                                <button
                                  onClick={() => startBattleForGroup(group.id)}
                                  className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold px-2.5 py-1 rounded text-[10px] transition-all flex items-center gap-1 shrink-0"
                                >
                                  <GitCompare className="h-2.5 w-2.5" /> 对决
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'battle-status' && (
                    <div className="space-y-4 text-left animate-fade-in-up select-none">
                      <div className="border-b border-[var(--dt-border)] pb-2">
                        <h3 className="text-xs font-bold text-[var(--dt-text-primary)]">⚔️ A/B 对局进度与指示</h3>
                      </div>
                      
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
                    </div>
                  )}

                </div>
              )}
            </main>
          </div>
        </div>

        {/* Status Bar */}
        <DesktopStatusBar statusText={statusText} />
      </div>

      {/* 导出弹出面板 (整合至 Workflow 导出入口，带 0.2s 缩放渐入动效) */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogContent 
            className="sm:max-w-xl w-[90vw] bg-[var(--dt-panel-bg)] border border-[var(--dt-border)] text-[var(--dt-text-primary)] p-0 rounded-md shadow-2xl overflow-hidden focus:outline-none transition-all duration-200 ease-out transform scale-98 opacity-0 scale-100 opacity-100 animate-fade-in-scale"
          >
            <div className="p-4">
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
                  if (group) startBattleForGroup(group.id);
                  setExportOpen(false);
                }}
                onRestart={() => {
                  handleRestart();
                  setExportOpen(false);
                }}
                hasNativeSource={photos.some(p => p.sourceType === 'native-folder-preview' || p.sourceType === 'native-folder-file')}
              />
            </div>
          </DialogContent>
        </Dialog>

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
                  <span className="truncate max-w-full sm:max-w-[70%] block text-left" title={selectedPhoto.name}>
                    像素分析诊断: {selectedPhoto.name}
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
                      alt={selectedPhoto.name}
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

      {/* Photo Battle Overlay (A/B Compare) */}
      {activeBattle && (() => {
        const leftId = activeBattle.currentCandidateId;
        const rightId = activeBattle.contenderIds[activeBattle.nextIndex];
        const leftPhoto = photos.find(p => p.id === leftId);
        const rightPhoto = photos.find(p => p.id === rightId);
        const isBattleCompleted = activeBattle.nextIndex >= activeBattle.contenderIds.length;
        const activeGroup = similarGroups.find(g => g.id === activeBattle.groupId);
        const groupPhotos = photos.filter(p => activeGroup?.photoIds.includes(p.id));

        if (isBattleCompleted) return null;

        return (
          <Dialog open={true} onOpenChange={handleCloseBattle}>
            <DialogContent 
              style={{
                background: 'linear-gradient(135deg, rgba(30, 35, 42, 0.98), rgba(40, 46, 54, 0.99))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 24px 50px rgba(0, 0, 0, 0.55)'
              }}
              className="sm:max-w-6xl w-[96vw] max-h-[85vh] flex flex-col text-[var(--dt-text-primary)] p-0 overflow-hidden rounded-xl border-white/5"
            >
              <DialogHeader className="p-3.5 border-b border-white/5 flex flex-row items-center justify-between space-y-0 shrink-0">
                <div className="flex flex-col text-left">
                  <DialogTitle className="text-xs font-bold text-[var(--dt-text-primary)] flex items-center gap-1.5">
                    <GitCompare className="h-4 w-4 text-yellow-400" />
                    选择更想保留的一张
                  </DialogTitle>
                  <span className="text-[9px] text-[var(--dt-text-soft)] mt-0.5">
                    这组照片较相似，请直接选择你想保留的结果。未选照片会标记为淘汰候选，原图保持不变。
                  </span>
                </div>
                <div className="bg-black/25 border border-white/5 rounded px-2.5 py-1 text-[10px] text-[var(--dt-text-primary)] font-mono font-bold">
                  当前组: {activeBattle.roundIndex} / {activeBattle.totalRounds}
                </div>
                <div className="flex items-center gap-2">
                  <span className="desktop-pill text-[9px] scale-90 border-white/5 bg-white/5">
                    Esc 关闭
                  </span>
                  <Button 
                    size="icon" 
                    className="h-7 w-7 text-[var(--dt-text-soft)] bg-transparent hover:bg-white/5 hover:text-[var(--dt-text-primary)] border-0"
                    onClick={handleCloseBattle}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between min-h-0 bg-[var(--dt-workspace-bg)]">
                
                {/* Zoom Instructions */}
                <div className="text-center text-[10px] text-[var(--dt-text-soft)] mb-2 select-none">
                  💡 提示：鼠标悬停在左/右图上滚动 **鼠标滚轮** 可进行 **1x - 4x** 独立缩放，按住 **鼠标左键拖动** 平移细节。
                </div>

                <div className="desktop-battle-stage">
                  {/* Left Photo (current best candidate) */}
                  {leftPhoto ? (
                    <div className="desktop-battle-photo-card">
                      <div 
                        className={cn(
                          "desktop-battle-photo-wrapper overflow-hidden relative",
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
                          alt={leftPhoto.name} 
                          style={{ 
                            transform: `translate(${leftX}px, ${leftY}px) scale(${leftScale})`,
                            transition: isLeftDragging ? 'none' : 'transform 0.1s ease-out'
                          }}
                          className="max-w-full max-h-full object-contain p-1 select-none pointer-events-none" 
                        />
                        <div className="absolute top-2 left-2 z-10">
                          <Badge className="bg-[#6FA887] text-white border-0 text-[9px] font-bold py-0.5 px-2 shadow-sm">
                            👑 当前优选 [ ← ] ({leftScale.toFixed(1)}x)
                          </Badge>
                        </div>
                      </div>
                      <div className="p-2.5 border-t border-white/5 shrink-0 flex flex-col gap-1 bg-black/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="max-w-[70%]">
                            <p className="text-xs font-bold text-[var(--dt-text-primary)] truncate" title={leftPhoto.name}>{leftPhoto.name}</p>
                            <p className="text-[9px] text-[var(--dt-text-soft)] mt-0.5">{leftPhoto.size} • {leftPhoto.resolution}</p>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            {leftPhoto.issue === 'good' ? '质量良好' : '相似推荐'}
                          </span>
                        </div>
                        
                        <details className="text-[9px] text-[var(--dt-text-soft)] cursor-pointer mt-1 text-left">
                          <summary className="hover:text-[var(--dt-text-primary)] list-none flex items-center gap-1 select-none">
                            <span>▶</span> 查看技术详情
                          </summary>
                          <div className="pl-2 pt-1 font-mono space-y-0.5 border-l border-white/5 mt-0.5">
                            <p>综合质量: {leftPhoto.score} / 100</p>
                            <p>清晰对焦: {leftPhoto.sharpnessScore} / 100</p>
                            <p>曝光亮度: {leftPhoto.exposureScore} / 100</p>
                          </div>
                        </details>
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
                          "desktop-battle-photo-wrapper overflow-hidden relative",
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
                          alt={rightPhoto.name} 
                          style={{ 
                            transform: `translate(${rightX}px, ${rightY}px) scale(${rightScale})`,
                            transition: isRightDragging ? 'none' : 'transform 0.1s ease-out'
                          }}
                          className="max-w-full max-h-full object-contain p-1 select-none pointer-events-none" 
                        />
                        <div className="absolute top-2 right-2 z-10">
                          <Badge className="bg-[#6F8FA8] text-white border-0 text-[9px] font-bold py-0.5 px-2 shadow-sm">
                            ⚔️ 挑战照片 [ → ] ({rightScale.toFixed(1)}x)
                          </Badge>
                        </div>
                      </div>
                      <div className="p-2.5 border-t border-white/5 shrink-0 flex flex-col gap-1 bg-black/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="max-w-[70%]">
                            <p className="text-xs font-bold text-[var(--dt-text-primary)] truncate" title={rightPhoto.name}>{rightPhoto.name}</p>
                            <p className="text-[9px] text-[var(--dt-text-soft)] mt-0.5">{rightPhoto.size} • {rightPhoto.resolution}</p>
                          </div>
                          <span className="text-[10px] text-yellow-400 font-semibold">
                            {rightPhoto.issue === 'good' ? '质量良好' : rightPhoto.issue === 'blurry' ? '画面模糊' : rightPhoto.issue === 'overexposed' ? '画面过曝' : rightPhoto.issue === 'underexposed' ? '画面欠曝' : '相似重复'}
                          </span>
                        </div>

                        <details className="text-[9px] text-[var(--dt-text-soft)] cursor-pointer mt-1 text-left">
                          <summary className="hover:text-[var(--dt-text-primary)] list-none flex items-center gap-1 select-none">
                            <span>▶</span> 查看技术详情
                          </summary>
                          <div className="pl-2 pt-1 font-mono space-y-0.5 border-l border-white/5 mt-0.5">
                            <p>综合质量: {rightPhoto.score} / 100</p>
                            <p>清晰对焦: {rightPhoto.sharpnessScore} / 100</p>
                            <p>曝光亮度: {rightPhoto.exposureScore} / 100</p>
                          </div>
                        </details>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-black/25 text-[var(--dt-text-soft)] rounded-lg">找不到右图</div>
                  )}
                </div>

                {/* Photo Battle Filmstrip */}
                <div className="mt-3 border-t border-white/5 pt-2 shrink-0">
                  <div className="flex items-center justify-between text-[9px] text-[var(--dt-text-soft)] mb-1 px-1">
                    <span>相似组胶片带 ({groupPhotos.length} 张)</span>
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">🟢 保留</span>
                      <span className="flex items-center gap-0.5">🔴 淘汰候选</span>
                    </span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto py-1 px-2 bg-black/35 rounded border border-white/5 scrollbar-thin">
                    {groupPhotos.map((photo) => {
                      const isLeft = photo.id === leftId;
                      const isRight = photo.id === rightId;
                      const isKeep = activeBattle.recommendedKeepIds.includes(photo.id);
                      const isReview = activeBattle.similarBackupIds.includes(photo.id);
                      const isDelete = activeBattle.cullCandidateIds.includes(photo.id);

                      return (
                        <div
                          key={photo.id}
                          className={cn(
                            "relative shrink-0 rounded overflow-hidden border transition-all duration-200",
                            isLeft 
                              ? "border-[#6FA887] ring-1 ring-[#6FA887]/30 scale-95"
                              : isRight
                              ? "border-yellow-500 ring-1 ring-yellow-500/30 scale-95"
                              : "border-white/10"
                          )}
                          style={{ width: '44px', height: '33px' }}
                        >
                          <img
                            src={photo.url}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                          />
                          {/* Status Dot */}
                          <div 
                            className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full" 
                            style={{ 
                              backgroundColor: (isKeep || isReview) ? '#6FA887' : isDelete ? '#B96F68' : '#7E8588' 
                            }} 
                          />
                          {isLeft && (
                            <div className="absolute bottom-0 inset-x-0 bg-[#6FA887] text-white text-[6px] font-bold text-center leading-none py-0.5">
                              左图
                            </div>
                          )}
                          {isRight && (
                            <div className="absolute bottom-0 inset-x-0 bg-yellow-500 text-black text-[6px] font-bold text-center leading-none py-0.5">
                              右图
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Battle Actions Bar */}
                <div className="mt-3.5 pt-2.5 border-t border-white/5 flex flex-col gap-2 shrink-0 animate-fade-in">
                  {/* Keyboard Shortcuts Hint Panel */}
                  <div className="hidden md:flex items-center justify-center gap-4 py-1.5 px-3 rounded-lg bg-black/20 border border-white/5 text-[10px] text-[var(--dt-text-soft)] select-none">
                    <span className="font-bold text-[var(--dt-text-secondary)]">{"\ud83d\udcbb \u5feb\u6377\u952e\u63d0\u793a\uff1a"}</span>
                    <span className="flex items-center gap-1"><kbd className="desktop-battle-kbd">{"\u2190"}</kbd> {"\u4fdd\u7559\u5de6\u56fe"}</span>
                    <span className="flex items-center gap-1"><kbd className="desktop-battle-kbd">{"\u2192"}</kbd> {"\u4fdd\u7559\u53f3\u56fe"}</span>
                    <span className="flex items-center gap-1"><kbd className="desktop-battle-kbd">B</kbd> {"\u4e24\u5f20\u90fd\u4fdd\u7559"}</span>
                    <span className="flex items-center gap-1"><kbd className="desktop-battle-kbd">C</kbd> {"\u4e24\u5f20\u90fd\u6807\u8bb0\u4e3a\u6dd8\u6c70\u5019\u9009"}</span>
                    <span className="flex items-center gap-1"><kbd className="desktop-battle-kbd">S</kbd> {"\u8df3\u8fc7"}</span>
                    <span className="flex items-center gap-1"><kbd className="desktop-battle-kbd">Esc</kbd> {"\u5173\u95ed / \u8fd4\u56de"}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    <button
                      className="bg-[#6FA887] hover:bg-[#6FA887]/90 text-white font-bold text-xs py-2 px-1.5 rounded border border-white/5 flex flex-col items-center justify-center gap-0.5"
                      onClick={() => applyBattleDecision('keep_left')}
                    >
                      <span>保留左图</span>
                      <kbd className="desktop-battle-kbd">←</kbd>
                    </button>
                    <button
                      className="bg-[#6FA887] hover:bg-[#6FA887]/90 text-white font-bold text-xs py-2 px-1.5 rounded border border-white/5 flex flex-col items-center justify-center gap-0.5"
                      onClick={() => applyBattleDecision('keep_right')}
                    >
                      <span>保留右图</span>
                      <kbd className="desktop-battle-kbd">→</kbd>
                    </button>
                    <button
                      className="bg-white/5 hover:bg-white/10 text-[var(--dt-text-primary)] font-bold text-xs py-2 px-1.5 rounded border border-white/5 flex flex-col items-center justify-center gap-0.5"
                      onClick={() => applyBattleDecision('keep_both')}
                    >
                      <span>两张都保留</span>
                      <kbd className="desktop-battle-kbd">B</kbd>
                    </button>
                    <button
                      className="border border-[#B96F68]/35 text-[#B96F68] hover:text-[#B96F68]/95 bg-[#B96F68]/10 hover:bg-[#B96F68]/15 font-bold text-xs py-2 px-1.5 rounded flex flex-col items-center justify-center gap-0.5"
                      onClick={() => applyBattleDecision('cull_both')}
                    >
                      <span>标记为淘汰候选</span>
                      <kbd className="desktop-battle-kbd">C</kbd>
                    </button>
                    
                    {/* 重置缩放按钮：仅在有任意一侧放大时亮起 */}
                    <button
                      disabled={leftScale === 1 && rightScale === 1}
                      className={cn(
                        "font-bold text-xs py-2 px-1.5 rounded border flex flex-col items-center justify-center gap-0.5 transition-all",
                        leftScale > 1 || rightScale > 1
                          ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                          : "border-white/5 bg-white/5 text-[var(--dt-text-faint)] opacity-40 cursor-not-allowed"
                      )}
                      onClick={handleResetZoom}
                    >
                      <span>重置缩放</span>
                      <span className="text-[7.5px] opacity-75 font-mono">Zoom:1x</span>
                    </button>

                    <button
                      className="border border-white/5 bg-white/5 hover:bg-white/10 text-[var(--dt-text-primary)] font-bold text-xs py-2 px-1.5 rounded flex flex-col items-center justify-center gap-0.5"
                      onClick={() => applyBattleDecision('skip')}
                    >
                      <span>跳过</span>
                      <kbd className="desktop-battle-kbd">S</kbd>
                    </button>
                  </div>
                  <p className="text-[9px] text-[var(--dt-text-soft)] text-center select-none leading-relaxed mt-1">
                    💡 提示：滚轮缩放，按住左键拖动查看细节。
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
