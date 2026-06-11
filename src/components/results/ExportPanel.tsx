import React from 'react';
import { Download, ShieldCheck, AlertTriangle } from 'lucide-react';

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
  hasNativeSource?: boolean;
  onExportKeepToFolder?: () => void;
  isFolderExporting?: boolean;
  folderExportStatus?: 'idle' | 'success' | 'failed';
  folderExportResultCount?: number;
  folderExportError?: string | null;
}

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
  onRestart,
  hasNativeSource = false,
  onExportKeepToFolder,
  isFolderExporting = false,
  folderExportStatus = 'idle',
  folderExportResultCount = 0,
  folderExportError = null
}: ExportPanelProps) {
  return (
    <div 
      data-unused-props={JSON.stringify({
        keepSpaceMB,
        cullCount,
        spaceSavedMB,
        pendingGroupsCount,
        similarGroupsCount,
        hasRestart: !!onRestart,
        hasContinue: !!onContinueBattle
      })}
      className="p-4 rounded-md bg-[var(--dt-panel-bg)] border border-[var(--dt-border)] space-y-3.5 select-none text-left"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--dt-border)] pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-[var(--dt-text-primary)] font-mono uppercase tracking-wider">
              导出整理结果
            </span>
          </div>
          <p className="text-[10.5px] text-[var(--dt-text-soft)]">
            本地处理已完成，原图文件不会被修改或上传云端。您可以导出清单或打包下载保留照片。
          </p>
        </div>
        {projectName && (
          <span className="text-[9px] text-[var(--dt-text-faint)] font-mono bg-black/20 px-2 py-0.5 rounded border border-[var(--dt-border)] self-start sm:self-center truncate max-w-[200px]" title={projectName}>
            项目: {projectName}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* ZIP / Folder Export Section */}
        <div className="flex-1 min-w-[280px]">
          {hasNativeSource ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={onExportKeepToFolder}
                  disabled={keepCount === 0 || isFolderExporting}
                  className="desktop-button-primary text-[10px] py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold shrink-0 min-w-[150px]"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isFolderExporting ? "正在导出照片..." : "导出保留照片到文件夹"}
                </button>
                <span className="text-[10px] text-emerald-400/90 bg-emerald-500/5 px-2.5 py-1 rounded border border-emerald-500/10 font-medium">
                  💡 桌面端将复制保留照片到您选择的文件夹，原图不会被修改。
                </span>
              </div>
              {keepCount === 0 && (
                <div className="text-[10px] text-amber-400/90 font-medium text-left">
                  ⚠️ 没有保留照片可导出。请在整理结果中标记保留照片。
                </div>
              )}
              {folderExportStatus === 'success' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded text-[10px] text-left font-medium animate-fade-in">
                  🎉 已成功导出 {folderExportResultCount} 张保留照片！
                </div>
              )}
              {folderExportStatus === 'failed' && (
                <div className="bg-[#B96F68]/15 border border-[#B96F68]/30 text-[#B96F68] p-2 rounded text-[10px] text-left font-medium animate-fade-in leading-relaxed">
                  ❌ 导出失败：{folderExportError || '无法写入目标位置，请重试。'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={onExportKeepZip}
                disabled={keepCount === 0 || isZipping}
                className="desktop-button-primary text-[10px] py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold shrink-0 min-w-[140px]"
              >
                <Download className="h-3.5 w-3.5" />
                {isZipping ? "正在生成 ZIP..." : "导出保留照片 ZIP"}
              </button>
              {keepCount === 0 && (
                <span className="text-[10.5px] text-[var(--dt-text-soft)]">
                  暂无可导出的保留照片
                </span>
              )}
            </div>
          )}
        </div>

        {/* Manifest Exports Section */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExportManifestCsv}
            disabled={totalPhotoCount === 0 || isZipping}
            className="desktop-button-secondary text-[10px] py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold border border-[var(--dt-border)]"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400/80" />
            导出整理清单 CSV
          </button>
          <button
            onClick={onExportManifestJson}
            disabled={totalPhotoCount === 0 || isZipping}
            className="desktop-button-secondary text-[10px] py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold border border-[var(--dt-border)]"
          >
            <Download className="h-3.5 w-3.5 text-blue-400/80" />
            导出整理清单 JSON
          </button>
        </div>
      </div>

      {/* ZIP Status and Warnings */}
      {(isZipping || zipExportWarning) && (
        <div className="space-y-2 pt-2 border-t border-[var(--dt-border)]">
          {isZipping && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2 rounded text-[10px] text-center animate-pulse font-semibold flex items-center justify-center gap-1.5">
              <span>⏳ 正在生成分批 ZIP，请静候下载完成，期间请勿刷新页面。</span>
            </div>
          )}
          {zipExportWarning && (
            <div className="border border-[#B96F68]/30 bg-[#B96F68]/10 text-[#B96F68] p-2 rounded text-[10px] leading-relaxed text-center flex items-center justify-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{zipExportWarning}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
