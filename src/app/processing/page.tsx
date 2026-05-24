'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, Cpu, AlertCircle, ArrowRight, UploadCloud, FolderSync } from 'lucide-react';

export default function ProcessingPage() {
  const { 
    photos, 
    isAnalyzing, 
    analysisProgress, 
    analysisLogs, 
    startAnalysis,
    currentAnalysisIndex,
    currentAnalysisName
  } = usePhotoWorkspace();
  
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const hasStartedRef = useRef(false);

  // 1. 进入页面后：如果有照片，且尚未开始分析（进度为 0 且未在分析），则自动触发分析，并加入 Ref 拦截防止二次重复执行
  useEffect(() => {
    if (photos.length > 0 && !isAnalyzing && analysisProgress === 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startAnalysis();
    }
  }, [photos, isAnalyzing, analysisProgress, startAnalysis]);

  // 2. 自动跳转逻辑：当进度到达 100 且分析状态结束，1 秒后自动路由至结果页
  useEffect(() => {
    if (analysisProgress === 100 && !isAnalyzing) {
      const timer = setTimeout(() => {
        router.push('/results');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [analysisProgress, isAnalyzing, router]);

  // 日志滚动到最底部
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analysisLogs]);

  // 临时渲染用的照片预览（如果是空，展示 6 张默认图占位）
  const displayPhotos = photos.length > 0 ? photos.slice(0, 4) : [];

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-grid-pattern">
      <div className="bg-grid-glow" />
      <Header />

      <main className="flex-grow container mx-auto px-4 py-12 sm:px-6 lg:px-8 relative z-10 flex items-center justify-center">
        <div className="w-full max-w-3xl space-y-8">
          
          {/* 情况一：如果工作区照片为空，提示用户返回上传页或使用演示数据，防止页面卡死 */}
          {photos.length === 0 && !isAnalyzing && (
            <Card className="glassmorphism-premium p-8 rounded-3xl text-center relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
              
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-6">
                <AlertCircle className="h-6 w-6" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">未检测到已导入的照片</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                工作台当前是空的。请先前往上传页添加照片，或者直接加载系统预设的旅行测试包以体验 AI 本地分析功能。
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/upload" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto border-white/10 bg-slate-900/40 hover:bg-slate-900/80 text-white">
                    <UploadCloud className="mr-2 h-4 w-4" />
                    返回上传照片
                  </Button>
                </Link>
                <Button 
                  onClick={startAnalysis}
                  className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold border-0"
                >
                  <FolderSync className="mr-2 h-4 w-4" />
                  加载演示数据体验
                </Button>
              </div>
            </Card>
          )}

          {/* 情况二：有照片，正在分析或分析完成，显示分析进度 */}
          {photos.length > 0 && (
            <Card className="glassmorphism-premium p-8 rounded-3xl relative overflow-hidden">
              {/* Pulsing decorative background glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" />
              
              {/* Top Header */}
              <div className="text-center mb-8 relative z-10">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-4 animate-spin-slow">
                  <Cpu className="h-6 w-6" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {analysisProgress === 100 ? '分析已完成' : 'AI 智能分析中'}
                </h2>
                <p className="text-slate-400 text-sm mt-1 truncate max-w-full" title={currentAnalysisName}>
                  {analysisProgress === 100 
                    ? '像素诊断已全部完成，报表生成中，请稍候...' 
                    : `正在诊断：第 ${currentAnalysisIndex + 1} / ${photos.length} 张照片 — ${currentAnalysisName}`}
                </p>
              </div>

              {/* Simulated Photo Grid with Scan Line */}
              {displayPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 relative">
                  {displayPhotos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-slate-950 shadow-inner group">
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-full object-cover opacity-60 filter grayscale-[20%]"
                      />
                      
                      {/* Scanning laser line - only animation when isAnalyzing */}
                      {isAnalyzing && (
                        <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_12px_#8b5cf6] opacity-80 animate-scan-line" />
                      )}
                      
                      {/* Dark gradient mask */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                      
                      {/* Status badge */}
                      <div className="absolute bottom-2 left-2 text-[9px] text-slate-300 bg-slate-950/70 px-1.5 py-0.5 rounded font-mono truncate max-w-[90%]" title={photo.name}>
                        {photo.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress Area */}
              <div className="space-y-3 mb-8 relative z-10">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-indigo-300">诊断进度</span>
                  <span className="font-mono text-white font-bold">{analysisProgress}%</span>
                </div>
                <Progress value={analysisProgress} className="h-3 bg-slate-950 border border-white/5 rounded-full overflow-hidden" />
                <p className="text-[11px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1 select-none">
                  🔒 所有照片都在浏览器本地处理，绝不上传到任何服务器。
                </p>
              </div>

              {/* Diagnostic Logs (Terminal Style) */}
              <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 font-mono text-xs text-slate-300 relative z-10 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 mb-3 text-slate-500">
                  <Terminal className="h-4 w-4" />
                  <span>AI Photo Cleaner Diagnostics v2.0</span>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                  {analysisLogs.map((log, index) => (
                    <div key={index} className="flex gap-2 items-start animate-fade-in">
                      <span className="text-indigo-500 select-none">&gt;</span>
                      <span className="leading-relaxed">{log}</span>
                    </div>
                  ))}
                  {isAnalyzing && (
                    <div className="flex gap-2 items-center text-indigo-400/70 animate-pulse">
                      <span className="text-indigo-500 select-none">&gt;</span>
                      <span>正在进行下阶段筛查分析...</span>
                    </div>
                  )}
                  <div ref={consoleEndRef} />
                </div>
              </div>

              {/* 查看结果按钮：双重保障，如果自动路由未触发，用户可以直接点击跳转 */}
              {analysisProgress === 100 && !isAnalyzing && (
                <div className="mt-8 flex justify-center animate-fade-in relative z-10">
                  <Link href="/results">
                    <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-8 py-5 h-auto text-sm shadow-lg shadow-indigo-500/25 animate-pulse-slow flex items-center gap-2">
                      查看筛选结果
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}

            </Card>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
