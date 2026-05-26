'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';
import { Button } from '@/components/ui/button';
import { Sparkles, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { photos } = usePhotoWorkspace();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/40 bg-[#C8CDD6]/80 backdrop-blur-md select-none">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2F3A4A] shadow-md transition-all group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-sans text-lg font-bold tracking-tight text-[#1F2937]">
            AI Photo<span className="text-[#2F3A4A] font-extrabold ml-1">Cleaner</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/"
            className={cn(
              "text-xs font-bold transition-colors py-1 relative",
              pathname === '/' 
                ? "text-[#1F2937] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[#2F3A4A]" 
                : "text-[#5E6A7A] hover:text-[#1F2937]"
            )}
          >
            产品首页
          </Link>
          <Link
            href="/upload"
            className={cn(
              "text-xs font-bold transition-colors py-1 relative",
              pathname === '/upload' 
                ? "text-[#1F2937] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[#2F3A4A]" 
                : "text-[#5E6A7A] hover:text-[#1F2937]"
            )}
          >
            导入照片
          </Link>
          {photos.length > 0 && (
            <Link
              href="/results"
              className={cn(
                "text-xs font-bold transition-colors py-1 relative",
                pathname === '/results' 
                  ? "text-[#1F2937] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[#2F3A4A]" 
                  : "text-[#5E6A7A] hover:text-[#1F2937]"
              )}
            >
              结果工作区
            </Link>
          )}
          <Link
            href="/pricing"
            className={cn(
              "text-xs font-bold transition-colors py-1 relative",
              pathname === '/pricing' 
                ? "text-[#1F2937] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[#2F3A4A]" 
                : "text-[#5E6A7A] hover:text-[#1F2937]"
            )}
          >
            价格方案
          </Link>
        </nav>

        {/* Action Status */}
        <div className="flex items-center gap-3">
          <span 
            style={{ background: 'rgba(225, 232, 224, 0.75)' }}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[#5F8A72] text-[10px] font-semibold border border-[#5F8A72]/20 shadow-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#5F8A72] animate-pulse" />
            本地沙箱已启用
          </span>

          {photos.length > 0 ? (
            <Link href="/results">
              <Button className="bg-[#2F3A4A] hover:bg-[#1E2733] text-white text-xs font-bold px-4 h-9 rounded-xl transition-all shadow-sm flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                工作区 ({photos.length}张)
              </Button>
            </Link>
          ) : (
            <Link href="/upload">
              <Button className="bg-[#2F3A4A] hover:bg-[#1E2733] text-white text-xs font-bold px-4 h-9 rounded-xl transition-all shadow-sm">
                开始导入
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
