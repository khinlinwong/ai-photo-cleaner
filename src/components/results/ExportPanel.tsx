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
          <p className="text-[10.5px] text-[var(--dt-text-soft)] leading-relaxed">
            本地整理分析已完成。我们不会修改原图，原照片在您的电脑上保持不变。您可以将标记保留的照片复制出来，或保存当前的整理建议清单记录。
          </p>
        </div>
        {projectName && (
          <span className="text-[9px] text-[var(--dt-text-faint)] font-mono bg-black/20 px-2 py-0.5 rounded border border-[var(--dt-border)] self-start sm:self-center truncate max-w-[200px]" title={projectName}>
            项目: {projectName}
          </span>
        )}
      </div>

      {/* Grid summarizing export formats */}
      <div className="grid grid-cols-3 gap-2 bg-black/10 border border-[var(--dt-border)] p-2 rounded text-[9.5px] text-[var(--dt-text-soft)] leading-relaxed font-mono">
        <div>
          <span className="text-[var(--dt-text-primary)] font-bold block mb-0.5">📂 保留照片导出</span>
          仅复制标记为「保留」的照片副本，原位置原照片完全保持不变。
        </div>
        <div className="border-l border-white/5 pl-2">
          <span className="text-[var(--dt-text-primary)] font-bold block mb-0.5">📄 整理清单 CSV</span>
          保存为通用表格文件，记录照片状态与建议，方便 Excel 查看。
        </div>
        <div className="border-l border-white/5 pl-2">
          <span className="text-[var(--dt-text-primary)] font-bold block mb-0.5">💾 整理记录 JSON</span>
          保存为结构化技术数据，记录照片评分和分类，方便后续分析。
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* ZIP / Folder Export Section */}
        <div className="border-b border-white/5 pb-3">
          {hasNativeSource ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={onExportKeepToFolder}
                  disabled={keepCount === 0 || isFolderExporting}
                  className="desktop-button-primary text-[10px] py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold shrink-0 min-w-[150px] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isFolderExporting ? "正在复制照片..." : "复制保留照片到文件夹"}
                </button>
                <span className="text-[9.5px] text-emerald-400/90 bg-emerald-500/5 px-2.5 py-1 rounded border border-emerald-500/10 font-mono">
                  💡 复制保留照片：仅复制标记为「保留」的照片到选定文件夹，不移动、修改或删除原图。
                </span>
              </div>
              {keepCount === 0 && (
                <div className="text-[10px] text-amber-400/90 font-medium text-left">
                  ⚠️ 暂无可导出的保留照片。请先在工作区或对局中标记保留照片。
                </div>
              )}
              {folderExportStatus === 'success' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded text-[10px] text-left font-medium animate-fade-in leading-relaxed">
                  🎉 复制成功！已复制 {folderExportResultCount} 张保留照片。您可以去该目标文件夹查看，原始照片在原位置保持完好、不受影响。
                </div>
              )}
              {folderExportStatus === 'failed' && (
                <div className="bg-[#B96F68]/15 border border-[#B96F68]/30 text-[#B96F68] p-2 rounded text-[10px] text-left font-medium animate-fade-in leading-relaxed">
                  ❌ 复制失败：{folderExportError || '请确认目标文件夹具有可写权限，重新选择一个位置导出。'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={onExportKeepZip}
                  disabled={keepCount === 0 || isZipping}
                  className="desktop-button-primary text-[10px] py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold shrink-0 min-w-[140px] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isZipping ? "正在生成 ZIP..." : "导出保留照片 ZIP"}
                </button>
                <span className="text-[9.5px] text-[var(--dt-text-soft)] font-mono">
                  💡 导出 ZIP：打包下载所有已标记为「保留」的照片副本，原图位置和内容保持不变。
                </span>
              </div>
              {keepCount === 0 && (
                <div className="text-[10px] text-amber-400/90 font-medium text-left">
                  ⚠️ 暂无可导出的保留照片。请先在工作区或对局中标记保留照片。
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manifest Exports Section */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-[10px] text-[var(--dt-text-soft)] font-mono">
            <span>数据清单导出：</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1 items-start">
              <button
                onClick={onExportManifestCsv}
                disabled={totalPhotoCount === 0 || isZipping}
                className="desktop-button-secondary text-[10px] py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold border border-[var(--dt-border)] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400/80" />
                保存整理清单 CSV
              </button>
              <span className="text-[8.5px] text-[var(--dt-text-muted)] font-mono pl-1">适合 Excel 表格查看</span>
            </div>

            <div className="flex flex-col gap-1 items-start">
              <button
                onClick={onExportManifestJson}
                disabled={totalPhotoCount === 0 || isZipping}
                className="desktop-button-secondary text-[10px] py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold border border-[var(--dt-border)] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-blue-400/80" />
                保存整理数据 JSON
              </button>
              <span className="text-[8.5px] text-[var(--dt-text-muted)] font-mono pl-1">保存完整技术属性</span>
            </div>
          </div>
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
