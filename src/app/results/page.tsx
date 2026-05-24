'use client';

import React, { useState } from 'react';
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
  UploadCloud
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";

export default function ResultsPage() {
  const {
    photos,
    togglePhotoStatus,
    deleteSuggestedPhotos,
    resetWorkspace,
    loadDemoPhotos
  } = usePhotoWorkspace();

  const router = useRouter();
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

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
    if (score >= 50) return 'text-amber-400';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {items.map((photo) => (
          <Card 
            key={photo.id} 
            className={`glassmorphism rounded-2xl overflow-hidden group transition-all duration-300 relative ${
              photo.status === 'delete' 
                ? 'border-red-500/20 hover:border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.05)]' 
                : photo.status === 'review'
                ? 'border-yellow-500/20 hover:border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.05)]'
                : 'border-white/5 hover:border-indigo-500/20 hover:shadow-[0_0_25px_rgba(99,102,241,0.08)]'
            }`}
          >
            {/* Image section */}
            <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
              <img
                src={photo.url}
                alt={photo.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Status Badge overlay */}
              <div className="absolute top-3 left-3 z-10">
                {renderIssueBadge(photo)}
              </div>

              {/* Hover quick overlay actions */}
              <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <Button 
                  size="sm" 
                  variant="secondary"
                  className="rounded-lg h-9 text-xs flex items-center gap-1.5"
                  onClick={() => openDetail(photo)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  像素诊断
                </Button>
                
                <Button
                  size="sm"
                  variant={photo.status === 'keep' ? 'destructive' : 'default'}
                  className={`rounded-lg h-9 text-xs flex items-center gap-1.5 ${
                    photo.status === 'keep' 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  onClick={() => togglePhotoStatus(photo.id)}
                >
                  {photo.status === 'keep' ? <Trash2 className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  {photo.status === 'keep' ? '标为删除' : '恢复保留'}
                </Button>
              </div>
            </div>

            {/* Photo metadata */}
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="max-w-[70%]">
                  <p className="text-xs font-bold text-white truncate">{photo.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{photo.size} • {photo.resolution}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">质量得分</p>
                  <p className={`text-lg font-extrabold font-mono leading-none mt-0.5 ${getScoreColor(photo.score)}`}>
                    {photo.score}
                  </p>
                </div>
              </div>

              {/* 展现真实的清晰度得分和曝光得分 */}
              <div className="flex gap-2 mt-3 pt-2.5 border-t border-white/5">
                <span className="text-[9px] px-2 py-0.5 rounded bg-slate-950 border border-white/5 text-slate-400 font-mono">
                  对焦 (Sobel): {photo.sharpnessScore}
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-slate-950 border border-white/5 text-slate-400 font-mono">
                  曝光 (Luma): {photo.exposureScore}
                </span>
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

      <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        
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
                
                <div className="flex gap-3 mt-6">
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
                    onClick={handleRestart}
                    variant="outline" 
                    className="border-white/10 hover:bg-white/5 text-xs text-slate-300 py-5"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    重新导入
                  </Button>
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

            {/* Tab Controls and Photo Grid */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                <TabsList className="bg-slate-900/60 border border-white/10 p-1 rounded-xl">
                  <TabsTrigger value="all" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    全部照片 ({totalPhotos})
                  </TabsTrigger>
                  <TabsTrigger value="keep" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
                    建议保留 ({keepPhotos.length})
                  </TabsTrigger>
                  <TabsTrigger value="review" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-400">
                    需要复核 ({reviewPhotos.length})
                  </TabsTrigger>
                  <TabsTrigger value="delete" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
                    建议删除 ({deletePhotos.length})
                  </TabsTrigger>
                </TabsList>
                
                <p className="text-xs text-slate-500">
                  💡 技巧：点击卡片可开启「AI 智能像素诊断仪」，调整保留权重
                </p>
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
          <DialogContent className="sm:max-w-4xl w-[90vw] max-h-[85vh] overflow-y-auto bg-slate-900 border border-white/10 text-white p-6 rounded-2xl">
            {selectedPhoto && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-white flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="truncate">像素分析诊断: {selectedPhoto.name}</span>
                    {renderIssueBadge(selectedPhoto)}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
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

                <DialogFooter className="border-t border-white/5 pt-4 mt-2">
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
