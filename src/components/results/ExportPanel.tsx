import React from 'react';
import {
  ShieldCheck,
  Download,
  Trash2,
  AlertTriangle,
  GitCompare,
  RotateCcw
} from 'lucide-react';

export interface ExportPanelProps {
  totalPhotoCount: number;
  keepCount: number;
  keepSpaceMB: string;
  cullCount: number;
  spaceSavedMB: string;
  isZipping: boolean;
  zipExportWarning: string | null;
  pendingGroupsCount: number;
  similarGroupsCount: number;
  onExportKeepZip: () => void;
  onExportCullZip: () => void;
  onExportManifestCsv: () => void;
  onExportManifestJson: () => void;
  onContinueBattle: () => void;
  onRestart: () => void;
}

const LABELS = {
  secureExportTitle: "\u5b89\u5168\u5bfc\u51fa\u7ed3\u679c",
  exportWarningTip: "\ud83d\udca1 \u8fd8\u6709\u76f8\u4f3c\u7167\u7247\u9700\u8981 A/B \u5bf9\u6bd4\uff0c\u5efa\u8bae\u5b8c\u6210\u540e\u518d\u5bfc\u51fa\u3002",
  exportOkTip: "\ud83d\udfe2 \u6574\u7406\u5b8c\u6210\uff0c\u53ef\u4ee5\u5b89\u5168\u5bfc\u51fa\u3002",
  exportScopeTip: "\u5bfc\u51fa\u53ea\u4f1a\u590d\u5236\u6216\u6253\u5305\u6574\u7406\u7ed3\u679c\uff0c\u4e0d\u4f1a\u76f4\u63a5\u5904\u7406\u539f\u56fe\u3002",
  keepPhotosHeader: "\ud83d\udfe2 \u4fdd\u7559\u7167\u7247",
  keepPhotosDesc: "\u786e\u8ba4\u4fdd\u7559\u7684\u7167\u7247 (\u5171\u7ea6 ",
  zippingStatus: "\u6b63\u5728\u5bfc\u51fa\u4e2d...",
  exportKeepZipBtn: "\u5bfc\u51fa\u4fdd\u7559\u533a ZIP",
  zippingKeepDesc: "\u6b63\u5728\u751f\u6210 ZIP\uff0c\u8bf7\u7b49\u5f85\u5f53\u524d\u5bfc\u51fa\u5b8c\u6210\u3002",
  noKeepPhotosDesc: "\u6682\u65e0\u53ef\u5bfc\u51fa\u7684\u4fdd\u7559\u7167\u7247",
  cullPhotosHeader: "\ud83d\udd34 \u6dd8\u6c70\u5019\u9009\u7167\u7247",
  cullPhotosDesc: "\u6807\u8bb0\u4e3a\u6dd8\u6c70\u5019\u9009\u7684\u7167\u7247 (\u7ea6 ",
  cullPhotosDescEnd: ")\u3002\u6dd8\u6c70\u5019\u9009\u4ec5\u4ee3\u8868\u6574\u7406\u5efa\u8bae\uff0c\u539f\u56fe\u4fdd\u6301\u4e0d\u53d8\uff0c\u5bfc\u51fa\u540e\u7531\u4f60\u4eba\u5de5\u5904\u7406\u3002",
  exportCullZipBtn: "\u5bfc\u51fa\u6dd8\u6c70\u5019\u9009\u533a ZIP",
  noCullPhotosDesc: "\u6682\u65e0\u53ef\u5bfc\u51fa\u7684\u6dd8\u6c70\u5019\u9009\u7167\u7247",
  manifestHeader: "\ud83d\udcca \u6574\u7406\u6e05\u5355\u5bfc\u51fa",
  exportCsvBtn: "\u5bfc\u51fa\u6574\u7406\u6e05\u5355 CSV",
  exportJsonBtn: "\u5bfc\u51fa\u6574\u7406\u6e05\u5355 JSON",
  manifestDesc: "\u2139\ufe0f \u6e05\u5355\u53ea\u5305\u542b\u6574\u7406\u7ed3\u679c\u548c\u7167\u7247\u5143\u6570\u636e\uff0c\u4e0d\u5305\u542b\u539f\u56fe\u6587\u4ef6\u3002\u672c\u5730\u751f\u6210\uff0c\u4e0d\u4e0a\u4f20\u4e91\u7aef\u3002\u6dd8\u6c70\u5019\u9009\u4ec5\u4ee3\u8868\u6574\u7406\u5efa\u8bae\uff0c\u539f\u56fe\u4fdd\u6301\u4e0d\u53d8\u3002",
  zippingOverlayTip: "\u23f3 \u6b63\u5728\u751f\u6210\u5206\u6279 ZIP\uff0c\u8bf7\u9759\u5019\u4e0b\u8f7d\u5b8c\u6210\uff0c\u671f\u95f4\u8bf7\u52ff\u5237\u65b0\u9875\u9762\u3002",
  batchDownloadTip: "\u5206\u6279\u4e0b\u8f7d\uff1a\u6d4f\u89c8\u5668\u7531\u4e8e\u5bfc\u51fa\u673a\u5236\u9650\u5236\uff0c\u5927\u76f8\u518c\u5c06\u81ea\u52a8\u8fdb\u884c\u5206\u6279\u5bfc\u51fa\u3002\u4e3a\u4fdd\u8bc1\u6587\u4ef6\u5b8c\u6574\uff0c\u8bf7\u907f\u514d\u8fde\u7eed\u9ad8\u9891\u70b9\u51fb\u6216\u5728\u5bfc\u51fa\u8fc7\u7a0b\u4e2d\u5173\u95ed/\u5237\u65b0\u9875\u9762\u3002",
  limit200Tip: "\u5f53\u524d\u5bfc\u5165\u6570\u91cf\u8d85\u8fc7 200 \u5f20\uff0c\u8fd9\u5df2\u63a5\u8fd1\u6d4f\u89c8\u5668\u5bfc\u51fa\u5904\u7406\u80fd\u529b\u4e0a\u9650\uff0c\u5f3a\u70c8\u5efa\u8bae\u5206\u6279\u4e0b\u8f7d\u6216\u51cf\u5c15\u5355\u6b21\u5bfc\u5165\u4f53\u79ef\u3002",
  limit100Tip: "\u5f53\u524d\u7167\u7247\u591a\u4e8e 100 \u5f20\uff0c\u5206\u6279\u6253\u5305\u548c\u6392\u961f\u4e0b\u8f7d\u8017\u65f6\u53ef\u80fd\u4f1a\u6709\u6240\u5ef6\u957f\uff0c\u8bf7\u8010\u5fc3\u7b49\u5f85\u3002",
  securityPolicyHeader: "\ud83d\udd12 \u5b89\u5168\u7b56\u7565\u58f0\u660e",
  policyCopyTitle: "\u26a1 \u53ea\u590d\u5236\u4e0d\u4fee\u6539",
  policyCopyDesc: "\uff1a\u9ed8\u8ba4\u4ec5\u5728\u6d4f\u89c8\u5668\u4e2d\u6253\u5305\u4e0b\u8f7d\uff0c\u4e0d\u76f4\u63a5\u5728\u4f60\u7684\u78c1\u76d8\u4e0a\u7269\u7406\u6539\u52a8\u539f\u7247\u3002",
  policyCullTitle: "\ud83d\udcc1 \u6dd8\u6c70\u5019\u9009\u5b89\u5168",
  policyCullDesc: "\uff1a\u6dd8\u6c70\u5019\u9009\u4ec5\u4ee3\u8868\u6574\u7406\u5efa\u8bae\uff0c\u5728\u60a8\u786e\u8ba4\u524d\u7edd\u4e0d\u4f1a\u53d1\u751f\u4efb\u4f55\u7269\u7406\u78c1\u76d8\u6587\u4ef6\u53d8\u66f4\u3002",
  policyDesktopTitle: "\ud83d\udcbb \u672a\u6765\u684c\u9762\u652f\u6301",
  policyDesktopDesc: "\uff1a\u540e\u7eed\u684c\u9762\u7248\u5ba2\u6237\u7aef\u5c06\u652f\u6301\u201c\u76f4\u63a5\u590d\u5236\u5230\u6587\u4ef6\u5939\u201d\u548c\u201c\u7269\u7406\u79fb\u52a8\u201d\uff08\u7269\u7406\u526a\u5207\u5fc5\u6709\u4e8c\u6b21\u5f39\u6846\u786e\u8ba4\uff09\u3002",
  policyDisclaimer: "\ud83d\udca1 \u9010\u5f20\u6bd4\u8f83\u76f8\u4f3c\u7167\u7247\uff0c\u7531\u4f60\u51b3\u5b9a\u4fdd\u7559\u6216\u6807\u8bb0\u4e3a\u6dd8\u6c70\u5019\u9009\uff0c\u539f\u56fe\u4fdd\u6301\u4e0d\u53d8\u3002",
  noBattlePending: "\u5f53\u524d\u6ca1\u6709\u9700\u8981 A/B \u5bf9\u6bd4\u7684\u76f8\u4f3c\u7ec4\u3002",
  continueBattleBtn: "\u7ee7\u7eed A/B \u5bf9\u5c40",
  battleCompletedTip: "\u76f8\u4f3c\u7167\u7247\u5bf9\u5c40\u5df2\u5b8c\u6210\u3002",
  restartBtn: "\u91cd\u65b0\u5bfc\u5165",
  sheetUnit: "\u5f20",
  infoEmoji: "\u2139\ufe0f",
  warningEmoji: "\u26a0\ufe0f",
  bulbEmoji: "\ud83d\udca1",
  flashEmoji: "\u26a1",
  folderEmoji: "\ud83d\udcc1",
  desktopEmoji: "\ud83d\udcbb"
};

export function ExportPanel({
  totalPhotoCount,
  keepCount,
  keepSpaceMB,
  cullCount,
  spaceSavedMB,
  isZipping,
  zipExportWarning,
  pendingGroupsCount,
  similarGroupsCount,
  onExportKeepZip,
  onExportCullZip,
  onExportManifestCsv,
  onExportManifestJson,
  onContinueBattle,
  onRestart
}: ExportPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Secure Export Console with Buckets */}
      <div className="lg:col-span-2 p-4 rounded-lg bg-[var(--dt-card-bg)] border border-white/5 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] text-[var(--dt-text-secondary)] font-bold uppercase tracking-wider">
              {LABELS.secureExportTitle}
            </span>
          </div>
          <p className="text-[11.5px] mt-1.5 leading-relaxed font-medium text-amber-400/90">
            {pendingGroupsCount > 0 
              ? LABELS.exportWarningTip 
              : LABELS.exportOkTip} 
            <span className="text-[var(--dt-text-soft)] font-normal ml-1">
              {LABELS.exportScopeTip}
            </span>
          </p>
        </div>

        {/* Two Buckets Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Bucket 1: Keep */}
          <div className="bg-black/15 p-3 rounded-lg border border-white/5 flex flex-col justify-between min-h-[110px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--dt-text-primary)] flex items-center gap-1">
                  {LABELS.keepPhotosHeader}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                  {keepCount} {LABELS.sheetUnit}
                </span>
              </div>
              <p className="text-[9.5px] text-[var(--dt-text-soft)] mt-1.5 leading-relaxed">
                {LABELS.keepPhotosDesc}{keepSpaceMB} MB)
              </p>
            </div>
            <div className="mt-3">
              <button
                onClick={onExportKeepZip}
                disabled={keepCount === 0 || isZipping}
                className="desktop-button-primary w-full text-[10px] py-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                {isZipping ? LABELS.zippingStatus : LABELS.exportKeepZipBtn}
              </button>
              {(keepCount === 0 || isZipping) && (
                <p className="text-[9px] text-[var(--dt-text-soft)] text-center mt-1.5 select-none leading-relaxed">
                  {isZipping ? LABELS.zippingKeepDesc : LABELS.noKeepPhotosDesc}
                </p>
              )}
              {keepCount > 0 && !isZipping && pendingGroupsCount > 0 && (
                <p className="text-[9px] text-amber-400/90 text-center mt-1.5 leading-relaxed select-none">
                  {LABELS.exportWarningTip}
                </p>
              )}
            </div>
          </div>

          {/* Bucket 2: Delete Cull */}
          <div className="bg-black/15 p-3 rounded-lg border border-white/5 flex flex-col justify-between min-h-[110px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--dt-text-primary)] flex items-center gap-1">
                  {LABELS.cullPhotosHeader}
                </span>
                <span className="text-[10px] font-mono text-red-400 font-bold bg-red-500/5 px-2 py-0.5 rounded border border-red-500/10">
                  {cullCount} {LABELS.sheetUnit}
                </span>
              </div>
              <p className="text-[9.5px] text-[var(--dt-text-soft)] mt-1.5 leading-relaxed">
                {LABELS.cullPhotosDesc}{spaceSavedMB} MB{LABELS.cullPhotosDescEnd}
              </p>
            </div>
            <div className="mt-3">
              <button
                onClick={onExportCullZip}
                disabled={cullCount === 0 || isZipping}
                className="desktop-button-secondary w-full text-[10px] py-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 border border-white/5 font-bold transition-all"
              >
                <Trash2 className="h-3.5 w-3.5 text-amber-500/80" />
                {isZipping ? LABELS.zippingStatus : LABELS.exportCullZipBtn}
              </button>
              {(cullCount === 0 || isZipping) && (
                <p className="text-[9px] text-[var(--dt-text-soft)] text-center mt-1.5 select-none leading-relaxed">
                  {isZipping ? LABELS.zippingKeepDesc : LABELS.noCullPhotosDesc}
                </p>
              )}
              {cullCount > 0 && !isZipping && pendingGroupsCount > 0 && (
                <p className="text-[9px] text-amber-400/90 text-center mt-1.5 leading-relaxed select-none">
                  {LABELS.exportWarningTip}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Manifest Export Panel */}
        <div className="mt-3 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--dt-text-primary)] flex items-center gap-1.5">
              {LABELS.manifestHeader}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={onExportManifestCsv}
              disabled={totalPhotoCount === 0 || isZipping}
              className="desktop-button-secondary w-full text-[10px] py-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold transition-all border border-white/5"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400/80" />
              {LABELS.exportCsvBtn}
            </button>
            <button
              onClick={onExportManifestJson}
              disabled={totalPhotoCount === 0 || isZipping}
              className="desktop-button-secondary w-full text-[10px] py-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold transition-all border border-white/5"
            >
              <Download className="h-3.5 w-3.5 text-blue-400/80" />
              {LABELS.exportJsonBtn}
            </button>
          </div>
          <p className="text-[9.5px] text-[var(--dt-text-soft)] mt-2 leading-relaxed select-none">
            {LABELS.manifestDesc}
          </p>
        </div>

        {/* ZIP Export Warnings and Tips */}
        <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
          {/* isZipping status indicator */}
          {isZipping && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2 rounded text-[10px] text-center animate-pulse font-semibold flex items-center justify-center gap-1.5 select-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              {LABELS.zippingOverlayTip}
            </div>
          )}

          {/* Export error warning */}
          {zipExportWarning && (
            <div className="border border-[#B96F68]/30 bg-[#B96F68]/10 text-[#B96F68] p-2.5 rounded text-[10px] leading-relaxed text-center flex items-center justify-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{zipExportWarning}</span>
            </div>
          )}

          <div className="flex flex-col gap-1 text-[9.5px] text-[var(--dt-text-soft)] bg-black/10 p-2.5 rounded border border-white/5 select-none">
            <div className="flex items-start gap-1 leading-normal">
              <span className="shrink-0 text-amber-400/80">{LABELS.infoEmoji}</span>
              <span>{LABELS.batchDownloadTip}</span>
            </div>

            {/* Photos limit warnings */}
            {totalPhotoCount > 200 ? (
              <div className="flex items-start gap-1 leading-normal mt-1 pt-1 border-t border-white/5 text-amber-400/90">
                <span className="shrink-0">{LABELS.warningEmoji}</span>
                <span>{LABELS.limit200Tip}</span>
              </div>
            ) : totalPhotoCount > 100 ? (
              <div className="flex items-start gap-1 leading-normal mt-1 pt-1 border-t border-white/5 text-amber-400/70">
                <span className="shrink-0">{LABELS.bulbEmoji}</span>
                <span>{LABELS.limit100Tip}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Right: Security Strategy Card */}
      <div className="p-4 rounded-lg bg-[var(--dt-card-bg)] border border-white/5 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--dt-text-primary)]">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>{LABELS.securityPolicyHeader}</span>
          </div>
          <div className="mt-2.5 space-y-2 text-[9.5px] text-[var(--dt-text-soft)] leading-relaxed font-mono">
            <p>
              {LABELS.flashEmoji} <strong className="text-[var(--dt-text-primary)]">{LABELS.policyCopyTitle}</strong>{LABELS.policyCopyDesc}
            </p>
            <p>
              {LABELS.folderEmoji} <strong className="text-[var(--dt-text-primary)]">{LABELS.policyCullTitle}</strong>{LABELS.policyCullDesc}
            </p>
            <p>
              {LABELS.desktopEmoji} <strong className="text-[var(--dt-text-primary)]">{LABELS.policyDesktopTitle}</strong>{LABELS.policyDesktopDesc}
            </p>
            <p className="text-[9px] text-[var(--dt-text-secondary)] border-t border-white/5 pt-2.5 select-none leading-relaxed">
              {LABELS.policyDisclaimer}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          {similarGroupsCount === 0 ? (
            <div className="text-[9.5px] text-[var(--dt-text-soft)] text-center select-none py-1 leading-relaxed">
              {LABELS.noBattlePending}
            </div>
          ) : pendingGroupsCount > 0 ? (
            <button
              onClick={onContinueBattle}
              className="w-full desktop-button-secondary text-[10px] py-1.5 border border-yellow-500/30 text-yellow-400 hover:text-yellow-300 flex items-center justify-center gap-1 font-bold"
            >
              <GitCompare className="h-3 w-3" />
              {LABELS.continueBattleBtn}
            </button>
          ) : (
            <div className="text-[9.5px] text-emerald-400/90 text-center select-none py-1 leading-relaxed">
              {LABELS.battleCompletedTip}
            </div>
          )}
          <button 
            onClick={onRestart}
            className="w-full desktop-button-secondary text-[10px] py-1.5 border border-white/5 flex items-center justify-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            {LABELS.restartBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
