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
          "p-3 rounded border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between focus:outline-none active:scale-[0.98]",
          activeTab === 'keep'
            ? "bg-emerald-500/5 border-emerald-500/80 ring-1 ring-emerald-500/20"
            : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] hover:border-emerald-500/30"
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
          "p-3 rounded border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between focus:outline-none active:scale-[0.98]",
          activeTab === 'cull'
            ? "bg-[#B96F68]/5 border-[#B96F68]/80 ring-1 ring-[#B96F68]/20"
            : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] hover:border-[#B96F68]/30"
        )}
      >
        <span className="text-[10px] text-[var(--dt-text-soft)] font-semibold">🔴 淘汰候选照片</span>
        <span className="text-xs font-bold text-[#B96F68] mt-1 font-mono">
          {cullCount} 张 <span className="text-[9px] text-[var(--dt-text-soft)] font-normal">({spaceSavedMB} MB)</span>
        </span>
      </button>

      <button
        onClick={() => onTabChange('similar')}
        className={cn(
          "p-3 rounded border text-left transition-all duration-150 flex flex-col justify-between focus:outline-none cursor-pointer active:scale-[0.98]",
          activeTab === 'similar'
            ? "bg-[var(--dt-accent)]/5 border-[var(--dt-accent)]/80 ring-1 ring-[var(--dt-accent)]/20"
            : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] hover:border-[var(--dt-accent)]/30"
        )}
      >
        <span className="text-[10px] text-[var(--dt-text-soft)] font-semibold">
          📊 相似组
        </span>
        <span className="text-xs font-bold text-[var(--dt-text-primary)] mt-1 font-mono">
          {similarGroupCount} 组
        </span>
      </button>

      <button
        onClick={() => onTabChange('battle-status')}
        className={cn(
          "p-3 rounded border text-left transition-all duration-150 flex flex-col justify-between focus:outline-none cursor-pointer active:scale-[0.98]",
          activeTab === 'battle-status'
            ? "bg-yellow-500/5 border-yellow-500/80 ring-1 ring-yellow-500/20"
            : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] hover:border-yellow-500/30"
        )}
      >
        <span className="text-[10px] text-[var(--dt-text-soft)] font-semibold">
          ⚔️ {hasNativeSource ? "A/B 对局 (本地)" : "A/B 对局"}
        </span>
        <span className="text-xs font-bold text-yellow-400 mt-1 font-mono">
          {completedBattleCount} / {totalBattleCount} 已完成
        </span>
      </button>
    </div>
  );
}

