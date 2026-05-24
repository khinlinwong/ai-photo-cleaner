'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { usePhotoWorkspace, PhotoItem } from '@/context/PhotoWorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Trash2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Sun,
  Eye,
  Sliders,
  FolderSync,
  UploadCloud,
  Download,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";

export default function ResultsPage() {
  const {
    photos,
    togglePhotoStatus,
    updatePhotoStatus,
    updateMultiplePhotosStatus,
    deleteSuggestedPhotos,
    resetWorkspace,
    loadDemoPhotos
  } = usePhotoWorkspace();

  const router = useRouter();
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  // 切换选项卡时清空选中状态，防止隐藏的图片在批量操作中被误改
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  // 获取当前活跃 Tab 下的照片列表
  const getTabPhotos = () => {
    switch (activeTab) {
      case 'all': return photos;
      case 'keep': return photos.filter((p) => p.status === 'keep');
      case 'review': return photos.filter((p) => p.status === 'review');
      case 'delete': return photos.filter((p) => p.status === 'delete');
      default: return [];
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const currentTabPhotos = getTabPhotos();
    const currentTabIds = currentTabPhotos.map((p) => p.id);
    
    // 如果当前 Tab 的所有图片都已选中，则取消全选它们；否则全选当前 Tab
    const isAllSelected = currentTabIds.length > 0 && currentTabIds.every((id) => selectedIds.includes(id));
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentTabIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentTabIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBatchStatusChange = (status: 'keep' | 'review' | 'delete') => {
    if (selectedIds.length === 0) return;
    updateMultiplePhotosStatus(selectedIds, status);
    setSelectedIds([]);
  };

  // 纯客户端打包下载精选照片 (JSZip)
  const downloadKeepPhotosZip = async () => {
    const keepPhotos = photos.filter((p) => p.status === 'keep');
    if (keepPhotos.length === 0) return;
    setIsZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < keepPhotos.length; i++) {
        const photo = keepPhotos[i];
        if (photo.file) {
          zip.file(photo.name, photo.file);
        } else {
          // 演示图片没有本地 file 引用时，使用 fetch 进行跨域下载降级
          try {
            const res = await fetch(photo.url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const blob = await res.blob();
            zip.file(photo.name, blob);
          } catch (e) {
            console.error('Failed to fetch remote image for ZIP package:', photo.url, e);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `ai-photo-cleaner-keep-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to download ZIP pack:', err);
    } finally {
      setIsZipping(false);
    }
  };

  // 移除了空数据时自动分析的 useEffect，改为在空状态下由用户点击手动加载 Demo 数据，避免意外路由干扰

  // 计算看板指标
  const totalPhotos = photos.length;
  const keepPhotos = photos.filter((p) => p.status === 'keep');
  const reviewPhotos = photos.filter((p) => p.status === 'review');
  const deletePhotos = photos.filter((p) => p.status === 'delete');
  
  const spaceSavedMB = deletePhotos.reduce((acc, p) => {
    const val = parseFloat(p.size);
    return acc + (isNaN(val) ? 0 : val);
  }, 0).toFixed(1);

  const healthScore = totalPhotos > 0 
    ? Math.round((keepPhotos.length / totalPhotos) * 100) 
    : 0;

  // 打开照片详情诊断弹窗
  const openDetail = (photo: PhotoItem) => {
    setSelectedPhoto(photo);
    setDialogOpen(true);
  };

  // 重新上传
  const handleRestart = () => {
    resetWorkspace();
    router.push('/upload');
  };

  // 获取问题标签（对应真实的 issue 类型）
  const renderIssueBadge = (photo: PhotoItem) => {
    switch (photo.issue) {
      case 'good':
        return (
          <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 gap-1 text-[10px]">
            <CheckCircle className="h-3 w-3" />
            质量良好
          </Badge>
        );
      case 'blurry':
        return (
          <Badge className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 gap-1 text-[10px]">
            <AlertTriangle className="h-3 w-3" />
            画面模糊
          </Badge>
        );
      case 'overexposed':
        return (
          <Badge className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 gap-1 text-[10px]">
            <Sun className="h-3 w-3" />
            画面过曝
          </Badge>
        );
      case 'underexposed':
        return (
          <Badge className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 gap-1 text-[10px]">
            <Sun className="h-3 w-3" />
            画面欠曝
          </Badge>
        );
      case 'needs_review':
        return (
          <Badge className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 gap-1 text-[10px]">
            <AlertTriangle className="h-3 w-3" />
            需要复核
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 gap-1 text-[10px]">
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

  // 渲染照片卡片
  const renderPhotoGrid = (items: PhotoItem[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-20 bg-slate-900/10 rounded-3xl border border-white/5">
          <FolderSync className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">该分类下没有照片</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {items.map((photo) => (
          <Card 
            key={photo.id} 
            className={cn(
              "min-w-0 overflow-hidden rounded-2xl glassmorphism group transition-all duration-300 relative",
              photo.status === 'delete' 
                ? 'border-red-500/20 hover:border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.05)]' 
                : photo.status === 'review'
                ? 'border-yellow-500/20 hover:border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.05)]'
                : 'border-white/5 hover:border-indigo-500/20 hover:shadow-[0_0_25px_rgba(99,102,241,0.08)]'
            )}
          >
            {/* Image section */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
              <img
                src={photo.url}
                alt={photo.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Status Badge overlay */}
              <div className="absolute top-3 left-3 z-10">
                {renderIssueBadge(photo)}
              </div>

              {/* Checkbox overlay for multi-select (z-20 to be clickable above hover overlay) */}
              <div 
                className={cn(
                  "absolute top-3 right-3 z-20 h-5 w-5 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200",
                  selectedIds.includes(photo.id)
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950/80 border-white/20 opacity-0 group-hover:opacity-100 hover:border-white/40",
                  selectedIds.length > 0 ? "opacity-100" : ""
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSelect(photo.id);
                }}
              >
                {selectedIds.includes(photo.id) && (
                  <svg className="h-3 w-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

            </div>

            {/* Photo metadata and controls flattened for direct interaction */}
            <CardContent className="p-4 flex flex-col gap-3">
              {/* Row 1: Name & Score */}
              <div className="flex items-center justify-between gap-2">
                <div className="max-w-[70%]">
                  <p className="text-xs font-bold text-white truncate" title={photo.name}>{photo.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{photo.size} • {photo.resolution}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">质量得分</p>
                  <p className={`text-lg font-extrabold font-mono leading-none mt-0.5 ${getScoreColor(photo.score)}`}>
                    {photo.score}
                  </p>
                </div>
              </div>

              {/* Row 2: Status & Recommendation Reason */}
              <div className="flex items-center justify-between text-[10px] border-t border-white/5 pt-2 text-slate-300">
                <span className="flex items-center gap-1 font-semibold shrink-0">
                  {photo.status === 'keep' && <span className="text-emerald-400">🟢 建议保留</span>}
                  {photo.status === 'review' && <span className="text-yellow-400">🟡 需要复核</span>}
                  {photo.status === 'delete' && <span className="text-red-400">🔴 建议删除</span>}
                </span>
                <span className="text-slate-400 truncate max-w-[60%] select-none">
                  原因: {photo.issue === 'good' ? '画质良好' : photo.issue === 'blurry' ? '画面模糊' : photo.issue === 'overexposed' ? '画面过曝' : photo.issue === 'underexposed' ? '画面欠曝' : '需要复核'}
                </span>
              </div>

              {/* Row 3: Metrics & Diagnostics Button */}
              <div className="flex items-center justify-between gap-1 border-t border-white/5 pt-2">
                <div className="flex gap-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 border border-white/5 text-slate-400 font-mono">
                    对焦: {photo.sharpnessScore}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 border border-white/5 text-slate-400 font-mono">
                    曝光: {photo.exposureScore}
                  </span>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 px-2 text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md gap-0.5 font-medium"
                  onClick={() => openDetail(photo)}
                >
                  <Eye className="h-3 w-3" />
                  像素诊断
                </Button>
              </div>

              {/* Row 4: Status Correction Buttons (Substitute for hover mask, highly touch-friendly) */}
              <div className="grid grid-cols-3 gap-1 mt-1 border-t border-white/5 pt-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-7 px-0 text-[10px] flex items-center justify-center gap-1 rounded-md transition-all font-semibold",
                    photo.status === 'keep' 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                      : "border-white/5 bg-slate-950/40 hover:bg-white/5 text-slate-400 hover:text-white"
                  )}
                  onClick={() => updatePhotoStatus(photo.id, 'keep')}
                >
                  保留
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-7 px-0 text-[10px] flex items-center justify-center gap-1 rounded-md transition-all font-semibold",
                    photo.status === 'review' 
                      ? "bg-yellow-600 hover:bg-yellow-700 text-white border-0 shadow-[0_0_10px_rgba(234,179,8,0.2)]" 
                      : "border-white/5 bg-slate-950/40 hover:bg-white/5 text-slate-400 hover:text-white"
                  )}
                  onClick={() => updatePhotoStatus(photo.id, 'review')}
                >
                  复核
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-7 px-0 text-[10px] flex items-center justify-center gap-1 rounded-md transition-all font-semibold",
                    photo.status === 'delete' 
                      ? "bg-red-600 hover:bg-red-700 text-white border-0 shadow-[0_0_10px_rgba(239,68,68,0.2)]" 
                      : "border-white/5 bg-slate-950/40 hover:bg-white/5 text-slate-400 hover:text-white"
                  )}
                  onClick={() => updatePhotoStatus(photo.id, 'delete')}
                >
                  删除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-grid-pattern">
      <div className="bg-grid-glow" />
      <Header />

      <main className="flex-grow max-w-7xl mx-auto px-6 py-8 relative z-10 w-full">
        
        {totalPhotos === 0 ? (
          <div className="max-w-3xl mx-auto py-12">
            <Card className="glassmorphism-premium p-8 rounded-3xl text-center relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
              
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-6">
                <AlertTriangle className="h-6 w-6" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">未检测到已导入的照片</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                您的工作台当前是空的。请先前往上传页添加照片，或者直接加载系统预设的旅行测试包以体验 AI 本地分析功能。
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button 
                  onClick={handleRestart}
                  variant="outline" 
                  className="w-full sm:w-auto border-white/10 bg-slate-900/40 hover:bg-slate-900/80 text-white"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  前往上传照片
                </Button>
                <Button 
                  onClick={loadDemoPhotos}
                  className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold border-0"
                >
                  <FolderSync className="mr-2 h-4 w-4" />
                  查看演示数据
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <>
            {/* Results Dashboard Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              
              {/* Main Hero Stat */}
              <Card className="glassmorphism p-6 rounded-2xl md:col-span-2 flex flex-col justify-between bg-gradient-to-br from-indigo-950/15 via-slate-900/10 to-slate-950/10 border-indigo-500/10">
                <div>
                  <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    AI 整理报告已生成
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-2">一键优化图库内存</h2>
                  <p className="text-xs text-slate-400 mt-1">AI 帮您检测出了 {deletePhotos.length} 张低画质或异常曝光的相片。</p>
                </div>
                
                <div>
                  <div className="flex flex-wrap gap-3 mt-6">
                    {deletePhotos.length > 0 && (
                      <Button 
                        onClick={deleteSuggestedPhotos}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold text-xs py-5 px-5 shadow-lg shadow-red-500/25"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        一键删除所有废片 ({spaceSavedMB} MB)
                      </Button>
                    )}
                    
                    <Button
                      onClick={downloadKeepPhotosZip}
                      disabled={keepPhotos.length === 0 || isZipping}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs py-5 px-5 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      {isZipping 
                        ? '正在打包 ZIP...' 
                        : keepPhotos.length === 0 
                        ? '暂无保留照片可供下载' 
                        : `下载精选照片 ZIP (${keepPhotos.length} 张)`}
                    </Button>

                    <Button 
                      onClick={handleRestart}
                      variant="outline" 
                      className="border-white/10 hover:bg-white/5 text-xs text-slate-300 py-5"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      重新导入
                    </Button>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 mt-4 flex items-center gap-1 select-none">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    下载 ZIP 也在浏览器本地完成，照片不会上传到服务器。
                  </p>
                </div>
              </Card>

              {/* Stat Box 1 */}
              <Card className="glassmorphism p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">建议清退空间</p>
                  <p className="text-4xl font-extrabold text-red-400 font-mono mt-2">{spaceSavedMB} <span className="text-sm font-normal">MB</span></p>
                </div>
                <p className="text-[10px] text-slate-400">一键清空可为您拯救的相机/手机存储空间量</p>
              </Card>

              {/* Stat Box 2 */}
              <Card className="glassmorphism p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">相册健康率</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-4xl font-extrabold text-emerald-400 font-mono">{healthScore}%</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Progress value={healthScore} className="h-1.5 bg-slate-950 rounded-full" />
                  <p className="text-[9px] text-slate-500 flex justify-between">
                    <span>保留/复核: {keepPhotos.length + reviewPhotos.length}</span>
                    <span>建议删除: {deletePhotos.length}</span>
                  </p>
                </div>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                <TabsList className="bg-slate-900/60 border border-white/10 p-1 rounded-xl flex flex-wrap sm:flex-nowrap gap-1">
                  <TabsTrigger value="all" className="rounded-lg text-[11px] sm:text-xs font-semibold px-2 sm:px-4 py-2 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    全部 ({totalPhotos})
                  </TabsTrigger>
                  <TabsTrigger value="keep" className="rounded-lg text-[11px] sm:text-xs font-semibold px-2 sm:px-4 py-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
                    保留 ({keepPhotos.length})
                  </TabsTrigger>
                  <TabsTrigger value="review" className="rounded-lg text-[11px] sm:text-xs font-semibold px-2 sm:px-4 py-2 data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-400">
                    复核 ({reviewPhotos.length})
                  </TabsTrigger>
                  <TabsTrigger value="delete" className="rounded-lg text-[11px] sm:text-xs font-semibold px-2 sm:px-4 py-2 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
                    删除 ({deletePhotos.length})
                  </TabsTrigger>
                </TabsList>
                
                <p className="text-xs text-slate-500">
                  💡 技巧：点击卡片可开启「AI 智能像素诊断仪」，调整保留权重
                </p>
              </div>
 
              {/* Multi-select Control Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 border border-white/5 rounded-xl px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-xs text-slate-400">
                    已选择 <strong className="text-indigo-400 font-mono">{selectedIds.length}</strong> 张照片
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 hover:bg-white/5 text-xs h-8"
                      onClick={handleSelectAll}
                    >
                      {(() => {
                        const currentTabIds = getTabPhotos().map(p => p.id);
                        const isAllSelected = currentTabIds.length > 0 && currentTabIds.every(id => selectedIds.includes(id));
                        return isAllSelected ? "取消全选" : "全选当前分类";
                      })()}
                    </Button>
                    {selectedIds.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-white text-xs h-8 px-2"
                        onClick={handleClearSelection}
                      >
                        取消选择
                      </Button>
                    )}
                  </div>
                </div>
 
                {selectedIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t border-white/5 pt-3 sm:border-t-0 sm:pt-0">
                    <span className="text-xs text-slate-500">批量操作:</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-300 text-emerald-400 text-xs h-8"
                        onClick={() => handleBatchStatusChange('keep')}
                      >
                        批量保留
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-yellow-500/20 hover:bg-yellow-500/10 hover:text-yellow-300 text-yellow-400 text-xs h-8"
                        onClick={() => handleBatchStatusChange('review')}
                      >
                        批量复核
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/20 hover:bg-red-500/10 hover:text-red-300 text-red-400 text-xs h-8"
                        onClick={() => handleBatchStatusChange('delete')}
                      >
                        批量删除
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <TabsContent value="all" className="focus-visible:outline-none">
                {renderPhotoGrid(photos)}
              </TabsContent>
              
              <TabsContent value="keep" className="focus-visible:outline-none">
                {renderPhotoGrid(keepPhotos)}
              </TabsContent>

              <TabsContent value="review" className="focus-visible:outline-none">
                {renderPhotoGrid(reviewPhotos)}
              </TabsContent>
              
              <TabsContent value="delete" className="focus-visible:outline-none">
                {renderPhotoGrid(deletePhotos)}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Photo Diagnostics Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-4xl w-[90vw] max-h-[85vh] flex flex-col bg-slate-900 border border-white/10 text-white p-6 rounded-2xl">
            {selectedPhoto && (
              <>
                <DialogHeader className="shrink-0">
                  <DialogTitle className="text-base font-bold text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <span className="truncate max-w-full sm:max-w-[70%] block text-left" title={selectedPhoto.name}>
                      像素分析诊断: {selectedPhoto.name}
                    </span>
                    <span className="shrink-0 text-left">
                      {renderIssueBadge(selectedPhoto)}
                    </span>
                  </DialogTitle>
                </DialogHeader>
 
                {/* Scrollable diagnostic content wrapper */}
                <div className="overflow-y-auto pr-1.5 my-4 flex-grow max-h-[50vh] scrollbar-thin">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-1">
                    {/* Photo Preview Pane */}
                    <div className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center">
                      <img
                        src={selectedPhoto.url}
                        alt={selectedPhoto.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
 
                    {/* AI Diagnosis Diagnostics Pane */}
                    <div className="space-y-5 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                          <Sliders className="h-3.5 w-3.5" />
                          AI 深度评分参数
                        </h4>
                        
                        {/* Metric 1: Quality Score */}
                        <div className="space-y-1.5 mb-4">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">综合质量得分</span>
                            <span className={cn("font-bold font-mono", getScoreColor(selectedPhoto.score))}>
                              {selectedPhoto.score} / 100
                            </span>
                          </div>
                          <Progress value={selectedPhoto.score} className="h-2 bg-slate-950 rounded-full" />
                        </div>
 
                        {/* Metric 2: Sharpness Score */}
                        <div className="space-y-1.5 mb-4">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">图像对焦清晰度 (Sobel)</span>
                            <span className={cn("font-bold font-mono", selectedPhoto.sharpnessScore < 45 ? 'text-red-400' : 'text-emerald-400')}>
                              {selectedPhoto.sharpnessScore} / 100
                            </span>
                          </div>
                          <Progress 
                            value={selectedPhoto.sharpnessScore} 
                            className={`h-2 bg-slate-950 rounded-full ${
                              selectedPhoto.sharpnessScore < 45 ? 'bg-red-500/20' : ''
                            }`} 
                          />
                          {selectedPhoto.sharpnessScore < 45 && (
                            <p className="text-[10px] text-red-400">⚠️ 检测到高频边缘极少，推测属于手抖失焦或模糊图片。</p>
                          )}
                        </div>
 
                        {/* Metric 3: Exposure Score */}
                        <div className="space-y-1.5 mb-4">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">曝光偏好指数得分</span>
                            <span className={cn("font-bold font-mono", selectedPhoto.exposureScore < 60 ? 'text-red-400' : 'text-emerald-400')}>
                              {selectedPhoto.exposureScore} / 100
                            </span>
                          </div>
                          <Progress value={selectedPhoto.exposureScore} className="h-2 bg-slate-950 rounded-full" />
                        </div>
 
                        {/* Metric 4: Exposure deviation value */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">曝光亮度偏差值</span>
                            <span className="font-bold font-mono text-slate-200">
                              {selectedPhoto.exposureValue > 0 ? `+${selectedPhoto.exposureValue}` : selectedPhoto.exposureValue}
                            </span>
                          </div>
                          
                          {/* Custom exposure bar centered on 0 */}
                          <div className="relative h-2 bg-slate-950 rounded-full overflow-hidden">
                            {/* Anchor point 0 */}
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-600 z-10" />
                            {/* Dev / Deviation bar */}
                            <div 
                              className={`absolute top-0 bottom-0 ${
                                selectedPhoto.exposureValue > 0 ? 'bg-amber-500 left-1/2' : 'bg-blue-500'
                              }`}
                              style={{
                                left: selectedPhoto.exposureValue > 0 ? '50%' : `${50 + (selectedPhoto.exposureValue / 2)}%`,
                                width: `${Math.abs(selectedPhoto.exposureValue / 2)}%`
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-600">
                            <span>过暗 (-100)</span>
                            <span>完美 (0)</span>
                            <span>过亮 (+100)</span>
                          </div>
                        </div>
                      </div>
 
                      {/* Metadata specs */}
                      <div className="p-3 rounded-xl bg-slate-950 space-y-1 text-[11px] text-slate-400 font-mono">
                        <p>尺寸: {selectedPhoto.resolution}</p>
                        <p>大小: {selectedPhoto.size}</p>
                        <p>类型: {selectedPhoto.category}</p>
                      </div>
                    </div>
                  </div>
                </div>
 
                <DialogFooter className="border-t border-white/5 pt-4 shrink-0">
                  <Button 
                    variant="ghost" 
                    onClick={() => setDialogOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    取消
                  </Button>
                  
                  <Button
                    variant={selectedPhoto.status === 'keep' ? 'destructive' : 'default'}
                    className={
                      selectedPhoto.status === 'keep'
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }
                    onClick={() => {
                      togglePhotoStatus(selectedPhoto.id);
                      setDialogOpen(false);
                    }}
                  >
                    {selectedPhoto.status === 'keep' ? '标为建议删除' : '恢复为建议保留'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

      </main>

      <Footer />
    </div>
  );
}
