import React from 'react';

export interface PhotoBucketSectionProps {
  bucketType: 'keep' | 'cull';
  photosCount: number;
  spaceMB?: string;
  children: React.ReactNode;
}

const LABELS = {
  keepTitle: "\u4fdd\u7559\u7167\u7247",
  keepDescPrefix: "\u786e\u8ba4\u4fdd\u7559\u7684\u7167\u7247 (",
  keepDescSuffix: "\u5f20)",
  cullTitle: "\u6dd8\u6c70\u5019\u9009\u7167\u7247",
  cullSubBadge: "\u6dd8\u6c70\u5019\u9009\u4ec5\u4ee3\u8868\u6574\u7406\u5efa\u8bae\uff0c\u539f\u56fe\u4fdd\u6301\u4e0d\u53d8",
  cullDescPrefix: "\u6807\u8bb0\u4e3a\u6dd8\u6c70\u5019\u9009\u7684\u7167\u7247 (",
  cullDescMiddle: "\u5f20\uff0c\u5171\u7ea6 ",
  cullDescSuffix: " MB)",
  greenDot: "\ud83d\udfe2",
  redDot: "\ud83d\udd34"
};

export function PhotoBucketSection({
  bucketType,
  photosCount,
  spaceMB,
  children
}: PhotoBucketSectionProps) {
  if (bucketType === 'keep') {
    return (
      <div className="space-y-2 text-left">
        <div className="border-b border-white/5 pb-1 flex items-baseline justify-between">
          <h3 className="text-xs font-bold text-[var(--dt-text-primary)] flex items-center gap-1">
            <span className="text-emerald-400">{LABELS.greenDot}</span> {LABELS.keepTitle}
          </h3>
          <span className="text-[9px] text-[var(--dt-text-soft)]">
            {LABELS.keepDescPrefix}{photosCount}{LABELS.keepDescSuffix}
          </span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-left">
      <div className="border-b border-white/5 pb-1 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
        <div className="flex items-center gap-1">
          <h3 className="text-xs font-bold text-[var(--dt-text-primary)] flex items-center gap-1">
            <span className="text-red-400">{LABELS.redDot}</span> {LABELS.cullTitle}
          </h3>
          <span className="text-[9px] text-red-400/80 bg-red-500/5 px-2 py-0.5 rounded border border-red-500/10 scale-90">
            {LABELS.cullSubBadge}
          </span>
        </div>
        <span className="text-[9px] text-[var(--dt-text-soft)]">
          {LABELS.cullDescPrefix}{photosCount}{LABELS.cullDescMiddle}{spaceMB}{LABELS.cullDescSuffix}
        </span>
      </div>
      {children}
    </div>
  );
}
