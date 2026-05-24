'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UploadCloud, Image as ImageIcon, Trash2, ShieldCheck, Zap, AlertCircle } from 'lucide-react';

interface FileItem {
  file: File;
  previewUrl: string;
}

export default function UploadPage() {
  const { uploadFiles } = usePhotoWorkspace();
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 组件卸载时释放所有未处理的 previewUrl 内存
  const previewsRef = useRef<string[]>([]);
  previewsRef.current = selectedFiles.map(f => f.previewUrl);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, []);

  // 处理拖拽文件和点击选择文件的校验机制
  const processFiles = (files: FileList) => {
    setErrorMsg(null);
    const filesArray = Array.from(files);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    const unsupportedFiles = filesArray.filter(file => !allowedTypes.includes(file.type));
    if (unsupportedFiles.length > 0) {
      setErrorMsg(`不支持的文件格式。仅支持 JPG, PNG, WEBP 格式图片，已过滤 ${unsupportedFiles.length} 个文件。`);
    }

    const validFiles = filesArray.filter(file => allowedTypes.includes(file.type));
    const newItems = validFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));

    setSelectedFiles(prev => [...prev, ...newItems]);
  };

  // 处理拖拽事件
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  // 处理点击选择文件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  // 移除待上传照片
  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const target = prev[index];
      if (target) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // 全部清空
  const handleClearAll = () => {
    selectedFiles.forEach(item => {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    });
    setSelectedFiles([]);
    setErrorMsg(null);
  };

  // 触发 AI 分析
  const handleStartAnalysis = () => {
    if (selectedFiles.length > 0) {
      // 传入 File[]
      uploadFiles(selectedFiles.map(f => f.file));
    }
  };

  // 一键使用演示照片（单一入口流程：仅触发 uploadFiles([]) 并在 context 内部路由到 /processing，防止重复触发）
  const handleUseDemo = () => {
    uploadFiles([]);
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.file.size, 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-grid-pattern">
      <div className="bg-grid-glow" />
      <Header />

      <main className="flex-grow container mx-auto px-4 py-12 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">导入您的旅行照片</h1>
            <p className="text-slate-400 mt-2 text-sm sm:text-base">
              支持 JPG, PNG, WEBP 格式。AI 将在本地检测失焦、模糊、曝光异常的照片。
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Drag Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-3xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_30px_rgba(99,102,241,0.1)]' 
                    : 'border-white/10 bg-slate-900/20 hover:border-white/20 hover:bg-slate-900/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-inner">
                    <UploadCloud className="h-8 w-8 animate-pulse-slow" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-white">点击上传 或 拖拽文件到这里</p>
                    <p className="text-xs text-slate-500">仅支持 JPG, PNG, WEBP 格式 • 建议导入 10-100 张照片</p>
                  </div>
                </div>
              </div>

              {/* Permanent Upload Status & Preview Card */}
              <Card className="glassmorphism p-6 rounded-3xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-indigo-400" />
                      待处理照片 ({selectedFiles.length} 张 • 共 {totalSizeMB} MB)
                    </h3>
                    {selectedFiles.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleClearAll}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                      >
                        全部清空
                      </Button>
                    )}
                  </div>

                  {selectedFiles.length === 0 ? (
                    <div className="text-center py-10 border border-white/5 rounded-2xl bg-slate-950/20">
                      <p className="text-slate-500 text-xs">暂未导入任何照片，请通过上方区域进行选择或拖拽文件</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {selectedFiles.map((item, index) => {
                        return (
                          <div key={index} className="relative aspect-square group rounded-lg overflow-hidden border border-white/5 bg-slate-950">
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(index);
                              }}
                              className="absolute top-1.5 right-1.5 p-1 rounded-md bg-slate-950/80 text-red-400 hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 shadow-md"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-slate-950/60 p-1 text-[9px] text-slate-400 truncate text-center">
                              {(item.file.size / (1024 * 1024)).toFixed(1)}M
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 温和预警与提示区域 */}
                {(selectedFiles.length > 100 || totalSize > 300 * 1024 * 1024) && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-400 space-y-1">
                    {selectedFiles.length > 100 && (
                      <p className="flex items-center gap-1.5">
                        ⚠️ 大量照片 ({selectedFiles.length} 张) 可能需要较长分析时间，建议先测试 10-50 张以获得最佳体验。
                      </p>
                    )}
                    {totalSize > 300 * 1024 * 1024 && (
                      <p className="flex items-center gap-1.5">
                        ⚠️ 当前为浏览器本地诊断，照片总体积较大 ({totalSizeMB} MB)，大文件分析可能占用较多本地内存。
                      </p>
                    )}
                  </div>
                )}

                {/* 格式错误警告 */}
                {errorMsg && (
                  <div className="mt-4 p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-[11px] text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={handleStartAnalysis}
                    disabled={selectedFiles.length === 0}
                    className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-8 h-11 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-indigo-600 disabled:hover:to-violet-600"
                  >
                    {selectedFiles.length > 0 ? `开始分析 ${selectedFiles.length} 张照片` : '开始分析 (0 张)'}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Sidebar Guidelines */}
            <div className="space-y-6">
              {/* Demo Mode Card */}
              <Card className="glassmorphism-premium p-6 rounded-3xl border-indigo-500/20 bg-gradient-to-br from-indigo-950/10 to-slate-950/40 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl" />
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  快速上手 Demo
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  手头没有合适照片？点击下方按钮，一键加载精置的旅行好片与废片数据包，免去上传步骤，直达分析结果。
                </p>
                <Button 
                  onClick={handleUseDemo} 
                  className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold py-5"
                >
                  一键加载旅行演示包
                </Button>
              </Card>

              {/* Privacy Sandbox Card */}
              <Card className="glassmorphism p-6 rounded-3xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  本地沙箱保护
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <span className="text-xs text-slate-500 font-bold shrink-0">1.</span>
                    <p className="text-xs text-slate-400 leading-relaxed">您的照片只读入浏览器内存进行像素级分析，绝不产生网络上传流量。</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs text-slate-500 font-bold shrink-0">2.</span>
                    <p className="text-xs text-slate-400 leading-relaxed">关闭网页或重置工作台后，所有缓存的本地预览和数据将瞬间被彻底销毁。</p>
                  </div>
                </div>
              </Card>

              {/* Tip box */}
              <div className="flex gap-2 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-amber-300 text-xs leading-relaxed">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
                <span>建议：请确保浏览器标签页在分析过程中保持开启，以免计算任务被系统挂起。</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
