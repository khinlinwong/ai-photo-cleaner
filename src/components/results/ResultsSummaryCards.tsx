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
  totalPhotoCount?: number;
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
  hasNativeSource = false,
  totalPhotoCount
}: ResultsSummaryCardsProps) {
  const finalTotalCount = totalPhotoCount ?? (keepCount + cullCount);

  return (
    <div className="space-y-2.5 select-none text-left">
      {/* Total / Classified statistics line */}
      <div className="flex items-center justify-between text-[10px] text-[var(--dt-text-soft)] px-1 font-mono">
        <span>已分类整理：{keepCount + cullCount} 张照片 / 共导入 {finalTotalCount} 张</span>
        <span className="text-[var(--dt-text-faint)]">提示：所有调整仅代表整理建议，不会修改原图</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onTabChange('keep')}
          className={cn(
            "p-3 rounded border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between focus:outline-none active:scale-[0.98]",
            activeTab === 'keep'
              ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20 shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
              : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] hover:border-emerald-500/30"
          )}
        >
          <span className={cn(
            "text-[10px] font-bold transition-colors",
            activeTab === 'keep' ? "text-emerald-400" : "text-[var(--dt-text-soft)]"
          )}>🟢 保留照片</span>
          <span className="text-xs font-bold text-emerald-400 mt-1 font-mono">
            {keepCount} 张 <span className="text-[9px] text-[var(--dt-text-soft)] font-normal">({keepSpaceMB} MB)</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('cull')}
          className={cn(
            "p-3 rounded border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between focus:outline-none active:scale-[0.98]",
            activeTab === 'cull'
              ? "bg-[#B96F68]/10 border-[#B96F68] ring-2 ring-[#B96F68]/20 shadow-[0_2px_8px_rgba(185,111,104,0.15)]"
              : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] hover:border-[#B96F68]/30"
          )}
        >
          <span className={cn(
            "text-[10px] font-bold transition-colors",
            activeTab === 'cull' ? "text-[#D98F88]" : "text-[var(--dt-text-soft)]"
          )}>🔴 淘汰候选照片</span>
          <span className="text-xs font-bold text-[#B96F68] mt-1 font-mono">
            {cullCount} 张 <span className="text-[9px] text-[var(--dt-text-soft)] font-normal">({spaceSavedMB} MB)</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('similar')}
          className={cn(
            "p-3 rounded border text-left transition-all duration-150 flex flex-col justify-between focus:outline-none cursor-pointer active:scale-[0.98]",
            activeTab === 'similar'
              ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/20 shadow-[0_2px_8px_rgba(59,130,246,0.15)]"
              : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] hover:border-blue-500/30"
          )}
        >
          <span className={cn(
            "text-[10px] font-bold transition-colors",
            activeTab === 'similar' ? "text-blue-400" : "text-[var(--dt-text-soft)]"
          )}>📊 相似组</span>
          <span className="text-xs font-bold text-[var(--dt-text-primary)] mt-1 font-mono">
            {similarGroupCount} 组
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('battle-status')}
          className={cn(
            "p-3 rounded border text-left transition-all duration-150 flex flex-col justify-between focus:outline-none cursor-pointer active:scale-[0.98]",
            activeTab === 'battle-status'
              ? "bg-yellow-500/10 border-yellow-500 ring-2 ring-yellow-500/20 shadow-[0_2px_8px_rgba(234,179,8,0.15)]"
              : "bg-[var(--dt-card-bg)] border-[var(--dt-border)] hover:bg-[var(--dt-card-hover-bg)] hover:border-yellow-500/30"
          )}
        >
          <span className={cn(
            "text-[10px] font-bold transition-colors",
            activeTab === 'battle-status' ? "text-yellow-400" : "text-[var(--dt-text-soft)]"
          )}>⚔️ {hasNativeSource ? "A/B 对局 (本地)" : "A/B 对局"}</span>
          <span className="text-xs font-bold text-yellow-400 mt-1 font-mono">
            {completedBattleCount} / {totalBattleCount} 已完成
          </span>
        </button>
      </div>
    </div>
  );
}

