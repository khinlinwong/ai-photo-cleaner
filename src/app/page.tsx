'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Trash2, 
  ArrowRight, 
  CheckCircle,
  Star,
  Layers
} from 'lucide-react';

export default function Home() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleMove(e.clientX, rect);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX, rect);
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-grid-pattern">
      {/* Background Decorative Mesh Glow */}
      <div className="bg-grid-glow" />
      
      <Header />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Announcement Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 mb-6 backdrop-blur-sm animate-pulse-slow">
              <Sparkles className="h-3.5 w-3.5" />
              <span>智能引擎已升级至 v2.0，检测速度提升 400%</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15] mb-6">
              AI 自动筛选旅行废片 <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-500 bg-clip-text text-transparent">
                让您的手机存储瞬间释放
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              出门旅行拍了上千张照片？AI Photo Cleaner 帮您在几秒钟内自动识别模糊、过曝、欠曝以及重复相似的照片，一键归档，拯救您的旅行回忆。
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/upload">
                <Button className="w-full sm:w-auto h-12 px-8 text-base bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:shadow-indigo-500/30 group">
                  立即开始免费分析
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-white/10 bg-slate-900/40 hover:bg-slate-900/80 text-white backdrop-blur-sm">
                  查看价格方案
                </Button>
              </Link>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto py-8 border-y border-white/5 bg-slate-900/20 backdrop-blur-sm rounded-2xl px-6">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-extrabold text-white">99.2%</p>
                <p className="text-xs text-slate-500 mt-1">模糊检测准确度</p>
              </div>
              <div className="text-center border-l border-white/5">
                <p className="text-2xl sm:text-3xl font-extrabold text-white">&lt; 10ms</p>
                <p className="text-xs text-slate-500 mt-1">单张照片分析速度</p>
              </div>
              <div className="text-center border-l border-white/5">
                <p className="text-2xl sm:text-3xl font-extrabold text-white">100%</p>
                <p className="text-xs text-slate-500 mt-1">本地隐私沙盒保护</p>
              </div>
              <div className="text-center border-l border-white/5">
                <p className="text-2xl sm:text-3xl font-extrabold text-white">1.2M+</p>
                <p className="text-xs text-slate-500 mt-1">已累计清理照片</p>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Slider Section (Before / After) */}
        <section className="py-12 bg-slate-950/40 border-y border-white/5">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">直观感受：AI 的像素级诊断</h2>
              <p className="text-sm text-slate-400 mt-2">左右滑动查看 AI 模糊检测与智能分析对比效果</p>
            </div>

            {/* Slider Container */}
            <div className="max-w-3xl mx-auto relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 aspect-[16/10] select-none">
              <div 
                className="w-full h-full relative cursor-ew-resize"
                onMouseMove={handleMouseMove}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onTouchMove={handleTouchMove}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
              >
                {/* Processed (Right / Background Image) */}
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop')" }}>
                  {/* Floating tags representing AI analysis */}
                  <div className="absolute bottom-6 right-6 bg-slate-950/80 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs text-emerald-400 font-semibold shadow-lg">
                    <CheckCircle className="h-4 w-4" />
                    建议保留 (质量评分: 96分 / 极度清晰)
                  </div>
                </div>

                {/* Original (Left / Clipped Image) */}
                <div 
                  className="absolute inset-0 bg-cover bg-center overflow-hidden border-r border-white"
                  style={{ 
                    backgroundImage: "url('https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop')",
                    filter: "blur(5px) contrast(90%) brightness(95%)",
                    width: `${sliderPosition}%` 
                  }}
                >
                  {/* Blurry label */}
                  <div className="absolute bottom-6 left-6 bg-slate-950/80 backdrop-blur-md border border-red-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs text-red-400 font-semibold shadow-lg whitespace-nowrap">
                    <Trash2 className="h-4 w-4" />
                    疑似废片 (检测到画面模糊)
                  </div>
                </div>

                {/* Slider Handle Button */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center pointer-events-none"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="h-10 w-10 rounded-full bg-white border-4 border-slate-950 flex items-center justify-center shadow-2xl text-slate-950 font-bold text-xs pointer-events-auto">
                    ↔
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Section */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">全方位的智能图像筛查</h2>
              <p className="text-slate-400 mt-4 text-base">
                不放过任何一个损坏视觉观感的细节，为您的图库做一次深度的 “AI 物理诊断”。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="glassmorphism rounded-2xl p-8 hover:border-indigo-500/30 transition-all duration-300 group hover:-translate-y-1">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">拉普拉斯模糊检测</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  通过高级边缘微分算法检测图像高频分量，精确计算图像的对比度和对焦度，轻松筛出失焦、手抖造成的模糊照片。
                </p>
              </div>

              {/* Feature 2 */}
              <div className="glassmorphism rounded-2xl p-8 hover:border-violet-500/30 transition-all duration-300 group hover:-translate-y-1">
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-6 group-hover:bg-violet-500/20 group-hover:scale-105 transition-all">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">智能直方图曝光诊断</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  分析画面像素的亮度分布曲线，对严重过曝（天空死白丢失细节）和过度欠曝（暗部死黑充斥噪点）的照片提出红色警告。
                </p>
              </div>

              {/* Feature 3 */}
              <div className="glassmorphism rounded-2xl p-8 hover:border-pink-500/30 transition-all duration-300 group hover:-translate-y-1">
                <div className="h-12 w-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-6 group-hover:bg-pink-500/20 group-hover:scale-105 transition-all">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">相似度感知哈希 (pHash)</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  连拍时不知如何取舍？AI 计算每张照片的波形特征，自动将极度相似的照片进行分组，并推荐光影与对焦最佳的一张保留。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security / Offline sandbox pledge */}
        <section className="py-16 bg-slate-900/30 border-y border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.05),transparent_40%)]" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10">
            <div className="glassmorphism-premium rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
              <div className="h-20 w-20 shrink-0 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                <ShieldCheck className="h-10 w-10" />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-white">绝对照片隐私安全承诺</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  我们深知照片隐私的重要性。AI Photo Cleaner 的核心计算完全在您的浏览器本地进行（使用 WebAssembly 驱动），**照片绝不会上传到任何云端服务器**。您甚至可以在拔掉网线的情况下使用我们的服务。
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
                    ✓ 本地沙箱隔离
                  </span>
                  <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
                    ✓ 支持离线处理
                  </span>
                  <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
                    ✓ 零数据传输
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-white">旅行达人的一致选择</h2>
              <p className="text-slate-400 mt-2 text-sm">聆听他们如何利用本工具重塑照片工作流</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="glassmorphism rounded-2xl p-6 relative">
                <div className="flex gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400" />)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  “作为一名摄影师，每次旅行回来都有几千张原片。这个工具瞬间帮我过滤掉了对焦失准和抖动的废片，原本需要整理一整天的工作，现在10分钟就解决啦！”
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-400">阿</div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">阿木</h4>
                    <p className="text-xs text-slate-500">风光摄影师 / 视觉中国签约作者</p>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="glassmorphism rounded-2xl p-6 relative">
                <div className="flex gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400" />)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  “每次去海滩度假都会拍很多海景，但因为阳光太强烈有很多过曝片。AI Photo Cleaner 太神奇了，过曝的照片全被它抓了出来，手机一下子腾出了20G空间！”
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-violet-500/20 flex items-center justify-center font-bold text-violet-400">Ch</div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Chloe Chen</h4>
                    <p className="text-xs text-slate-500">小红书旅行博主</p>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="glassmorphism rounded-2xl p-6 relative">
                <div className="flex gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400" />)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  “我非常在意隐私，很多同类产品强制把照片上传云端。这款工具支持离线本地分析，让人极为安心！直接给五星好评，SaaS 的 UI 设计也很高级现代。”
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-pink-500/20 flex items-center justify-center font-bold text-pink-400">Le</div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Leo Wang</h4>
                    <p className="text-xs text-slate-500">前沿软件工程师</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="pb-24 pt-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl">
            <div className="glassmorphism-premium rounded-3xl p-12 bg-gradient-to-b from-indigo-950/20 to-slate-950/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]" />
              
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                拯救手机存储，只留最完美的瞬间
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto mb-8 text-sm md:text-base leading-relaxed">
                无需注册，一键导入。享受快速、安全、精准的 AI 离线图像诊断。
              </p>
              <Link href="/upload">
                <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 font-bold border-0 shadow-lg shadow-white/10 transition-all px-8 py-6 h-auto text-base">
                  立即体验一键清理
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
