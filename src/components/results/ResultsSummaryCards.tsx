import React from 'react';
import { cn } from '@/lib/utils';

export interface ResultsSummaryCardsProps {
  keepCount: number;
  keepSpaceMB: string;
  cullCount: number;
  spaceSavedMB: string;
  similarGroupCount: number;
  completedBattleCount: number;
  totalBattleCount: number;
  activeTab: 'keep' | 'cull' | 'similar' | 'battle-status';
  onTabChange: (tab: 'keep' | 'cull' | 'similar' | 'battle-status') => void;
  hasNativeSource?: boolean;
}

export function ResultsSummaryCards({
  keepCount,
  keepSpaceMB,
  cullCount,
  spaceSavedMB,
  similarGroupCount,
  completedBattleCount,
  totalBattleCount,
  activeTab,
  onTabChange,
  hasNativeSource = false
}: ResultsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 select-none">
      <button
        onClick={() => onTabChange('keep')}
        className={cn(
          "p-3 rounded border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between focus:outline-none",
          activeTab === 'keep'
            ? "bg-[var(--dt-nav-active-bg)] border-[var(--dt-accent)]"
            : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)]"
        )}
      >
        <span className="text-[10px] text-[var(--dt-text-soft)] font-semibold">🟢 保留照片</span>
        <span className="text-xs font-bold text-emerald-400 mt-1 font-mono">
          {keepCount} 张 <span className="text-[9px] text-[var(--dt-text-soft)] font-normal">({keepSpaceMB} MB)</span>
        </span>
      </button>

      <button
        onClick={() => onTabChange('cull')}
        className={cn(
          "p-3 rounded border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between focus:outline-none",
          activeTab === 'cull'
            ? "bg-[var(--dt-nav-active-bg)] border-[#B96F68]/70"
            : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)]"
        )}
      >
        <span className="text-[10px] text-[var(--dt-text-soft)] font-semibold">🔴 淘汰候选照片</span>
        <span className="text-xs font-bold text-[#B96F68] mt-1 font-mono">
          {cullCount} 张 <span className="text-[9px] text-[var(--dt-text-soft)] font-normal">({spaceSavedMB} MB)</span>
        </span>
      </button>

      <button
        disabled={hasNativeSource}
        onClick={() => onTabChange('similar')}
        className={cn(
          "p-3 rounded border text-left transition-all duration-150 flex flex-col justify-between focus:outline-none",
          hasNativeSource
            ? "bg-[var(--dt-card-bg)] border-[var(--dt-border)] opacity-50 cursor-not-allowed"
            : activeTab === 'similar'
            ? "bg-[var(--dt-nav-active-bg)] border-[var(--dt-accent)] cursor-pointer"
            : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] cursor-pointer"
        )}
      >
        <span className="text-[10px] text-[var(--dt-text-soft)] font-semibold">
          📊 {hasNativeSource ? "相似组 (下一步接入)" : "相似组"}
        </span>
        <span className="text-xs font-bold text-[var(--dt-text-primary)] mt-1 font-mono">
          {hasNativeSource ? "-" : `${similarGroupCount} 组`}
        </span>
      </button>

      <button
        disabled={hasNativeSource}
        onClick={() => onTabChange('battle-status')}
        className={cn(
          "p-3 rounded border text-left transition-all duration-150 flex flex-col justify-between focus:outline-none",
          hasNativeSource
            ? "bg-[var(--dt-card-bg)] border-[var(--dt-border)] opacity-50 cursor-not-allowed"
            : activeTab === 'battle-status'
            ? "bg-[var(--dt-nav-active-bg)] border-yellow-500/70 cursor-pointer"
            : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] cursor-pointer"
        )}
      >
        <span className="text-[10px] text-[var(--dt-text-soft)] font-semibold">
          ⚔️ {hasNativeSource ? "A/B 对局 (下一步接入)" : "A/B 对局"}
        </span>
        <span className="text-xs font-bold text-yellow-400 mt-1 font-mono">
          {hasNativeSource ? "-" : `${completedBattleCount} / ${totalBattleCount} 已完成`}
        </span>
      </button>
    </div>
  );
}
