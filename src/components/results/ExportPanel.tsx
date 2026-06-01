import React from 'react';
import {
  ShieldCheck,
  Download,
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
  projectName?: string;
  onExportKeepZip: () => void;
  onExportManifestCsv: () => void;
  onExportManifestJson: () => void;
  onContinueBattle: () => void;
  onRestart: () => void;
}

const LABELS = {
  secureExportTitle: "安全导出结果",
  exportWarningTip: "💡 还有相似照片需要 A/B 对决，建议完成后再导出。",
  exportOkTip: "🟢 整理完成，可以安全导出。",
  exportScopeTip: "所有操作均在本地进行，原图文件绝不会被修改或上传云端。导出时将生成新的压缩包或清单。",
  keepPhotosHeader: "🟢 保留照片",
  keepPhotosDesc: "安全打包所有标记为【保留】的照片（共约 ",
  zippingStatus: "正在导出中...",
  exportKeepZipBtn: "导出保留照片 ZIP",
  zippingKeepDesc: "正在生成 ZIP，请等待当前导出完成。",
  noKeepPhotosDesc: "暂无可导出的保留照片",
  cullPhotosHeader: "🔴 淘汰候选照片",
  cullPhotosDesc: "标记为淘汰候选的照片（约 ",
  cullPhotosDescEnd: "）。淘汰候选仅作为整理建议记录在清单中，原图在您的电脑上仍保持原样，绝不改动您的本地原图文件，也不会上传云端。",
  manifestHeader: "📊 整理清单导出",
  exportCsvBtn: "导出整理清单 CSV",
  exportJsonBtn: "导出整理清单 JSON",
  manifestDesc: "ℹ️ 整理清单为纯文本元数据（CSV/JSON 格式），只记录照片评分及整理结果，绝不包含也绝不上传任何原图照片，原图保持原样。",
  zippingOverlayTip: "⏳ 正在生成分批 ZIP，请静候下载完成，期间请勿刷新页面。",
  batchDownloadTip: "分批下载：浏览器由于导出机制限制，大相册将自动进行分批导出。为保证文件完整，请避免连续高频点击或在导出过程中关闭/刷新页面。",
  limit200Tip: "当前导入数量超过 200 张，这已接近浏览器导出处理能力上限，强烈建议分批下载或减小单次导入体积。",
  limit100Tip: "当前照片多于 100 张，分批打包和排队下载耗时可能会有所延长，请耐心等待。",
  securityPolicyHeader: "🔒 安全策略声明",
  policyCopyTitle: "⚡ 只打包不修改",
  policyCopyDesc: "：默认仅在浏览器中打包下载，不直接在您的磁盘上物理改动原片。",
  policyCullTitle: "📁 淘汰候选安全",
  policyCullDesc: "：淘汰候选仅代表整理建议，在您确认前绝不被直接物理修改，原件保持不变。",
  policyDesktopTitle: "💻 桌面版支持说明",
  policyDesktopDesc: "：后续桌面版客户端将支持“直接复制到文件夹”和“物理移动”，且都会提供二次弹窗确认。",
  policyDisclaimer: "💡 逐张比较相似照片，由你决定保留或标记为淘汰候选，原图保持不变。",
  noBattlePending: "当前没有需要 A/B 对比的相似组。",
  continueBattleBtn: "继续 A/B 对局",
  battleCompletedTip: "相似照片对局已完成。",
  restartBtn: "重新导入",
  sheetUnit: "张",
  infoEmoji: "ℹ️",
  warningEmoji: "⚠️",
  bulbEmoji: "💡",
  flashEmoji: "⚡",
  folderEmoji: "📁",
  desktopEmoji: "💻"
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
  projectName,
  onExportKeepZip,
  onExportManifestCsv,
  onExportManifestJson,
  onContinueBattle,
  onRestart
}: ExportPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Secure Export Console with Buckets */}
      <div className="lg:col-span-2 p-4 rounded-lg bg-[var(--dt-card-bg)] border border-white/5 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] text-[var(--dt-text-secondary)] font-bold uppercase tracking-wider">
                {LABELS.secureExportTitle}
              </span>
            </div>
            {projectName && (
              <span className="text-[10px] text-[var(--dt-text-muted)] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5 truncate max-w-[200px]" title={projectName}>
                项目: {projectName}
              </span>
            )}
          </div>
          <p className="text-[11.5px] leading-relaxed font-medium text-amber-400/90">
            {pendingGroupsCount > 0 
              ? LABELS.exportWarningTip 
              : LABELS.exportOkTip} 
            <span className="text-[var(--dt-text-soft)] font-normal ml-1">
              {LABELS.exportScopeTip}
            </span>
          </p>

          {/* Export Scope Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-black/20 p-2.5 rounded-lg border border-white/5 text-[10.5px]">
            <div className="flex flex-col">
              <span className="text-[var(--dt-text-muted)] font-medium">保留照片</span>
              <span className="text-emerald-400 font-bold font-mono mt-0.5">{keepCount} 张</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[var(--dt-text-muted)] font-medium">淘汰候选</span>
              <span className="text-red-400 font-bold font-mono mt-0.5">{cullCount} 张</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[var(--dt-text-muted)] font-medium">相似组数</span>
              <span className="text-blue-400 font-bold font-mono mt-0.5">{similarGroupsCount} 组</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[var(--dt-text-muted)] font-medium">AB 对决</span>
              <span className="text-[var(--dt-text-primary)] font-bold font-mono mt-0.5">
                {similarGroupsCount > 0 
                  ? `${similarGroupsCount - pendingGroupsCount} / ${similarGroupsCount} 组`
                  : '无需对决'}
              </span>
            </div>
          </div>
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
            <div className="mt-3 border-t border-white/5 pt-2">
              <p className="text-[9.5px] text-[var(--dt-text-muted)] leading-relaxed text-center">
                🔒 本地原图保持不变，无需进行打包导出
              </p>
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
