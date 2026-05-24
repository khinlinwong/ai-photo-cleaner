'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/10 bg-slate-950 py-12 relative overflow-hidden">
      {/* Background radial gradient decoration */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[150px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.4)]">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-sans text-lg font-bold tracking-tight text-white">
                AI Photo<span className="text-indigo-400">Cleaner</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              智能分析并一键清理您手机及相机中的旅行废片，识别模糊、过曝、欠曝图片，只留下最闪耀的珍贵回忆。
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">产品服务</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/" className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">
                  产品首页
                </Link>
              </li>
              <li>
                <Link href="/upload" className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">
                  上传整理
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">
                  价格方案
                </Link>
              </li>
            </ul>
          </div>

          {/* Security & Privacy */}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">隐私安全</h3>
            <ul className="space-y-2.5">
              <li className="text-sm text-slate-400">
                🔒 本地沙箱运行，绝不上传照片到云端服务器，保护您的隐私
              </li>
              <li className="text-sm text-slate-400">
                🛡️ 支持离线分析（Web Assembly 加速中）
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright section */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} AI Photo Cleaner. 保留所有权利。</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> for travelers worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
};
