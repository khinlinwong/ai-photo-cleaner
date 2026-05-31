import React from 'react';

export interface ResultsSummaryCardsProps {
  keepCount: number;
  keepSpaceMB: string;
  cullCount: number;
  spaceSavedMB: string;
  similarGroupCount: number;
  completedBattleCount: number;
  totalBattleCount: number;
}

const LABELS = {
  keepPhotos: "\u4fdd\u7559\u7167\u7247",
  cullCandidatePhotos: "\u6dd8\u6c70\u5019\u9009\u7167\u7247",
  similarGroups: "\u76f8\u4f3c\u7ec4",
  battleProgress: "A/B \u5bf9\u5c40",
  completed: "\u5df2\u5b8c\u6210",
  sheetUnit: "\u5f20",
  groupUnit: "\u7ec4"
};

export function ResultsSummaryCards({
  keepCount,
  keepSpaceMB,
  cullCount,
  spaceSavedMB,
  similarGroupCount,
  completedBattleCount,
  totalBattleCount
}: ResultsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 select-none">
      <div className="p-3 rounded-lg bg-[var(--dt-card-bg)] border border-white/5 flex flex-col justify-between">
        <span className="text-[10px] text-[var(--dt-text-soft)] font-medium">{LABELS.keepPhotos}</span>
        <span className="text-xs font-bold text-emerald-400 mt-1 font-mono">
          {keepCount} {LABELS.sheetUnit} <span className="text-[9px] text-[var(--dt-text-soft)] font-normal">({keepSpaceMB} MB)</span>
        </span>
      </div>
      <div className="p-3 rounded-lg bg-[var(--dt-card-bg)] border border-white/5 flex flex-col justify-between">
        <span className="text-[10px] text-[var(--dt-text-soft)] font-medium">{LABELS.cullCandidatePhotos}</span>
        <span className="text-xs font-bold text-[#B96F68] mt-1 font-mono">
          {cullCount} {LABELS.sheetUnit} <span className="text-[9px] text-[var(--dt-text-soft)] font-normal">({spaceSavedMB} MB)</span>
        </span>
      </div>
      <div className="p-3 rounded-lg bg-[var(--dt-card-bg)] border border-white/5 flex flex-col justify-between">
        <span className="text-[10px] text-[var(--dt-text-soft)] font-medium">{LABELS.similarGroups}</span>
        <span className="text-xs font-bold text-[var(--dt-text-primary)] mt-1 font-mono">
          {similarGroupCount} {LABELS.groupUnit}
        </span>
      </div>
      <div className="p-3 rounded-lg bg-[var(--dt-card-bg)] border border-white/5 flex flex-col justify-between">
        <span className="text-[10px] text-[var(--dt-text-soft)] font-medium">{LABELS.battleProgress}</span>
        <span className="text-xs font-bold text-yellow-400 mt-1 font-mono">
          {completedBattleCount} / {totalBattleCount} {LABELS.completed}
        </span>
      </div>
    </div>
  );
}
