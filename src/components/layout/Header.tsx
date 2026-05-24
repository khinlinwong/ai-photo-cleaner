'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';
import { Button } from '@/components/ui/button';
import { Sparkles, Image as ImageIcon, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { photos } = usePhotoWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { label: '产品首页', href: '/' },
    { label: '上传照片', href: '/upload' },
    { label: '效果展示', href: '/results' },
    { label: '价格方案', href: '/pricing' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_15px_rgba(139,92,246,0.5)] transition-all group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-sans text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            AI Photo<span className="text-indigo-400 font-extrabold ml-1">Cleaner</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-white relative py-1",
                pathname === item.href 
                  ? "text-white after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-gradient-to-r after:from-indigo-500 after:to-violet-500" 
                  : "text-slate-400"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Action Button & Status */}
        <div className="hidden md:flex items-center gap-4">
          {photos.length > 0 && (
            <Link href="/results">
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300 animate-pulse-slow">
                <ImageIcon className="h-3.5 w-3.5" />
                工作区 ({photos.length})
              </span>
            </Link>
          )}
          <Link href="/upload">
            <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/35">
              立即免费整理
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-3">
          {photos.length > 0 && (
            <Link href="/results">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                <span className="text-[10px] font-bold">{photos.length}</span>
              </span>
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-slate-950 px-4 py-4 space-y-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "block py-2 text-base font-medium rounded-md px-3 hover:bg-slate-900 transition-colors",
                pathname === item.href ? "text-indigo-400 bg-indigo-500/5" : "text-slate-300"
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
            <Link href="/upload" className="w-full" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 border-0">
                立即免费整理
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
