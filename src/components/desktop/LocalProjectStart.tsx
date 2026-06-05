import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';
import { FolderOpen, ArrowRight, ShieldCheck, Cpu, Trash2, Clock, ChevronRight, Image as ImageIcon } from 'lucide-react';
import {
  getRecentLocalProjects,
  saveRecentLocalProject,
  createProjectId,
  createFileFingerprints,
  removeLocalProjectSummary,
  clearRecentLocalProjects
} from '@/lib/projects/localProjectStorage';
import { LocalProjectSummary } from '@/lib/projects/types';
import { isTauriRuntime } from '@/lib/desktop/tauriEnvironment';
import { pickNativeImageFolder } from '@/lib/desktop/nativeFolderPicker';
import { scanNativeFolderMetadata, NativeFolderMetadataSummary } from '@/lib/desktop/nativeFolderScanner';
import { scanNativeFolderImageEntries } from '@/lib/desktop/nativeImageEntriesScanner';
import { scanNativeFolderImagePreviews, NativeImagePreviewItem } from '@/lib/desktop/nativeImagePreviewScanner';
import { scanNativeSelectedImageFiles } from '@/lib/desktop/nativeSelectedFilesScanner';
import { getEffectiveNativeBatchLimit } from '@/lib/desktop/nativeBatchLimit';

/**
 * Extract folder basename securely from path string, removing drive letter and full hierarchy.
 * Returns fallback if the path is a disk root (like C:\ or D:\) or contains only drive letter.
 */
const getFolderBasename = (path: string): string => {
  if (!path) return '已选择文件夹';
  const parts = path.split(/[/\\]/).filter(Boolean);
  const base = parts[parts.length - 1];
  
  if (!base) {
    return '本地文件夹';
  }
  
  // Check if it looks like a Windows drive letter (e.g., C: or D:)
  if (/^[a-zA-Z]:$/.test(base)) {
    return '本地文件夹';
  }
  
  return base;
};

/**
 * Format bytes to human readable sizes.
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = 1;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface LocalProjectStartProps {
  onStatusChange?: (status: string) => void;
}

export const LocalProjectStart: React.FC<LocalProjectStartProps> = ({ onStatusChange }) => {
  const router = useRouter();
  const { uploadFiles, loadDemoPhotos, startNativeFolderAnalysis } = usePhotoWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const relinkFileInputRef = useRef<HTMLInputElement>(null);
  const webImageInputRef = useRef<HTMLInputElement>(null);

  const [isStarting, setIsStarting] = useState<'none' | 'upload' | 'demo'>('none');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 项目名称状态管理
  const [projectName, setProjectName] = useState('');
  const [defaultNamePlaceholder, setDefaultNamePlaceholder] = useState('');

  // 最近项目状态管理
  const [recentProjects, setRecentProjects] = useState<LocalProjectSummary[]>([]);
  const [selectedProjectForReassociate, setSelectedProjectForReassociate] = useState<LocalProjectSummary | null>(null);
  
  // 最近项目管理状态
  const [projectToRemove, setProjectToRemove] = useState<LocalProjectSummary | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  
  // 重新关联机制的状态
  const [relinkingProject, setRelinkingProject] = useState<LocalProjectSummary | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<{ project: LocalProjectSummary; files: File[] } | null>(null);

  // 桌面端状态
  const [isTauri, setIsTauri] = useState(false);
  const [pickedFolder, setPickedFolder] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<NativeFolderMetadataSummary | null>(null);
  const [previews, setPreviews] = useState<NativeImagePreviewItem[]>([]);
  const [imageSelectionMessage, setImageSelectionMessage] = useState<string | null>(null);


  // 稳定性防护相关 Refs 与 timeouts
  const activeFocusListenerRef = useRef<(() => void) | null>(null);
  const focusSetupTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusClearTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // 默认项目名称生成器
  const getDefaultProjectName = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `本地照片项目 ${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    isMountedRef.current = true;
    setIsTauri(isTauriRuntime());
    setDefaultNamePlaceholder(getDefaultProjectName());
    setRecentProjects(getRecentLocalProjects());

    return () => {
      isMountedRef.current = false;
      
      // 组件卸载时清理全局监听，防止内存泄露与脏回调
      if (activeFocusListenerRef.current) {
        window.removeEventListener('focus', activeFocusListenerRef.current);
        activeFocusListenerRef.current = null;
      }
      
      // 清理未完成的定时器
      if (focusSetupTimeoutIdRef.current) {
        clearTimeout(focusSetupTimeoutIdRef.current);
      }
      if (focusClearTimeoutIdRef.current) {
        clearTimeout(focusClearTimeoutIdRef.current);
      }
    };
  }, []);

  const handleSelectFolderClick = () => {
    fileInputRef.current?.click();
  };

  const handleSelectFolderNativeClick = async () => {
    setErrorMessage(null);
    setPickedFolder(null);
    setScanSummary(null);
    setPreviews([]);
    setImageSelectionMessage(null);
    try {
      const res = await pickNativeImageFolder();
      if (res && res.path) {
        setPickedFolder(res.path);
        if (onStatusChange) {
          onStatusChange(`已选文件夹: ${getFolderBasename(res.path)}`);
        }

        setIsScanning(true);
        const meta = await scanNativeFolderMetadata(res.path);
        // Execute scanner command to verify desktop bridge functionality
        await scanNativeFolderImageEntries(res.path);
        
        // Fetch previews
        const previewResult = await scanNativeFolderImagePreviews(res.path);
        if (previewResult && previewResult.items) {
          setPreviews(previewResult.items);
          
          // Trigger background sample verification of native reader
          const { analyzeNativePreviewSample } = await import('@/lib/desktop/nativeReader');
          analyzeNativePreviewSample(previewResult.items).catch(() => {});
        }

        setIsScanning(false);

        if (meta) {
          setScanSummary(meta);

          if (onStatusChange) {
            onStatusChange(`已选文件夹: ${getFolderBasename(res.path)} | 发现图片 ${meta.imageFilesCount} 张`);
          }
        } else {
          setErrorMessage('当前文件夹暂时无法扫描，请重新选择。');
        }
      }
    } catch (err) {
      console.error('Failed to pick or scan native folder:', err);
      setIsScanning(false);
      setErrorMessage('当前文件夹暂时无法扫描，请重新选择。');
    }
  };

  const handleSelectImagesNativeClick = async () => {
    setErrorMessage(null);
    setPickedFolder(null);
    setScanSummary(null);
    setPreviews([]);
    setImageSelectionMessage(null);

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
          }
        ]
      });

      // 1. 用户取消 dialog
      if (!selected) {
        return;
      }

      const paths = Array.isArray(selected)
        ? selected
        : typeof selected === 'string'
          ? [selected]
          : [];

      if (paths.length > 0) {
        try {
          const scanResult = await scanNativeSelectedImageFiles(paths);
          
          if (scanResult) {
            if (scanResult.items && scanResult.items.length > 0) {
              const projName = projectName.trim() || defaultNamePlaceholder || getDefaultProjectName();
              startNativeFolderAnalysis(scanResult.items, projName, 'selected-files');
            } else {
              // 2. Rust 返回 0 个可用 preview
              setErrorMessage('未找到可用图片，请重新选择。');
            }
          } else {
            // 3. Rust command 失败 (返回 null)
            setErrorMessage('无法准备所选图片，请重新选择。');
          }
        } catch {
          // 3. Rust command 失败 (抛出异常)
          setErrorMessage('无法准备所选图片，请重新选择。');
        }
      }
    } catch {
      setErrorMessage('无法准备所选图片，请重新选择。');
    }
  };

  const handleRemoveProject = (projectId: string) => {
    removeLocalProjectSummary(projectId);
    if (isMountedRef.current) {
      setRecentProjects(getRecentLocalProjects());
      setProjectToRemove(null);
    }
  };

  const handleClearAllProjects = () => {
    clearRecentLocalProjects();
    if (isMountedRef.current) {
      setRecentProjects([]);
      setIsConfirmingClearAll(false);
    }
  };

  const handleRelinkSelectClick = (project: LocalProjectSummary) => {
    setRelinkingProject(project);
    setImageSelectionMessage(null);
    if (relinkFileInputRef.current) {
      relinkFileInputRef.current.value = '';
    }

    // 清理前一次残留的监听与定时器，保障时序唯一性
    if (activeFocusListenerRef.current) {
      window.removeEventListener('focus', activeFocusListenerRef.current);
      activeFocusListenerRef.current = null;
    }
    if (focusSetupTimeoutIdRef.current) {
      clearTimeout(focusSetupTimeoutIdRef.current);
    }
    if (focusClearTimeoutIdRef.current) {
      clearTimeout(focusClearTimeoutIdRef.current);
    }

    relinkFileInputRef.current?.click();

    // 监听 window focus 来检测系统文件对话框的取消行为
    const handleWindowFocus = () => {
      if (activeFocusListenerRef.current) {
        window.removeEventListener('focus', activeFocusListenerRef.current);
        activeFocusListenerRef.current = null;
      }

      if (focusClearTimeoutIdRef.current) {
        clearTimeout(focusClearTimeoutIdRef.current);
      }

      focusClearTimeoutIdRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setRelinkingProject(null);
        }
      }, 500);
    };

    activeFocusListenerRef.current = handleWindowFocus;

    // 延迟添加焦点监听，避免瞬间触发
    focusSetupTimeoutIdRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        window.addEventListener('focus', handleWindowFocus);
      }
    }, 150);
  };

  const proceedWithReassociation = (project: LocalProjectSummary, files: File[]) => {
    try {
      if (onStatusChange) {
        onStatusChange('正在准备本地项目');
      }
      setIsStarting('upload');
      
      const updatedSummary: LocalProjectSummary = {
        ...project,
        updatedAt: new Date().toLocaleString('zh-CN'),
        photoCount: files.length,
        fileFingerprints: createFileFingerprints(files)
      };
      
      saveRecentLocalProject(updatedSummary);
      uploadFiles(files, project.projectName);
    } catch (err) {
      console.error('Reassociation error:', err);
      if (isMountedRef.current) {
        setErrorMessage('关联项目失败，请重试。');
        setIsStarting('none');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    if (files.length === 0) return;

    // 过滤图片文件
    const imgFiles = files.filter(file => file.type.startsWith('image/'));
    if (imgFiles.length === 0) {
      setErrorMessage('请选择至少一张图片。');
      return;
    }

    setErrorMessage(null);
    setImageSelectionMessage(null);

    try {
      // 创建新项目流程
      setIsStarting('upload');
      if (onStatusChange) {
        onStatusChange('正在准备本地项目');
      }
      const projName = projectName.trim() || defaultNamePlaceholder || getDefaultProjectName();
      const summary: LocalProjectSummary = {
        projectId: createProjectId(),
        projectName: projName,
        createdAt: new Date().toLocaleString('zh-CN'),
        updatedAt: new Date().toLocaleString('zh-CN'),
        photoCount: imgFiles.length,
        keepCount: 0,
        cullCount: 0,
        similarGroupCount: 0,
        battleCompleted: 0,
        battleTotal: 0,
        fileFingerprints: createFileFingerprints(imgFiles)
      };
      saveRecentLocalProject(summary);
      uploadFiles(imgFiles, projName);
    } catch (err) {
      console.error('File import error:', err);
      if (isMountedRef.current) {
        setErrorMessage('导入失败，请重新选择图片。');
        setIsStarting('none');
        if (onStatusChange) {
          onStatusChange('等待选择本地文件夹');
        }
      }
    }
  };

  const handleWebImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    setErrorMessage(null);
    setPickedFolder(null);
    setScanSummary(null);
    setPreviews([]);
    setImageSelectionMessage(null);

    if (files.length === 0) return;

    // 过滤图片文件
    const imgFiles = files.filter(file => file.type.startsWith('image/'));
    if (imgFiles.length === 0) {
      setErrorMessage('请选择至少一张图片。');
      return;
    }

    const X = imgFiles.length;
    const Y = Math.min(X, 200);
    if (X > 200) {
      setImageSelectionMessage(`已选择超过 200 张图片。当前最多准备前 200 张。已准备 ${Y} 张可预览图片。当前最多分析 200 张。分析接入将在下一阶段完成。`);
    } else {
      setImageSelectionMessage(`已选择 ${X} 张图片。已准备 ${Y} 张可预览图片. 当前最多分析 200 张。分析接入将在下一阶段完成。`);
    }
  };

  const handleRelinkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    if (files.length === 0) {
      if (isMountedRef.current) {
        setRelinkingProject(null);
      }
      return;
    }

    // 过滤图片文件
    const imgFiles = files.filter(file => file.type.startsWith('image/'));
    if (imgFiles.length === 0) {
      if (isMountedRef.current) {
        setErrorMessage('请选择至少一张图片。');
        setRelinkingProject(null);
      }
      return;
    }

    setErrorMessage(null);

    if (!relinkingProject) {
      return;
    }

    try {
      if (imgFiles.length !== relinkingProject.photoCount) {
        if (isMountedRef.current) {
          setMismatchWarning({
            project: relinkingProject,
            files: imgFiles
          });
          setRelinkingProject(null);
        }
        return;
      }

      proceedWithReassociation(relinkingProject, imgFiles);
      if (isMountedRef.current) {
        setRelinkingProject(null);
      }
    } catch (err) {
      console.error('Relink file change error:', err);
      if (isMountedRef.current) {
        setErrorMessage('关联失败，请重新选择图片。');
        setRelinkingProject(null);
      }
    }
  };

  const handleLoadDemoClick = () => {
    setErrorMessage(null);
    setImageSelectionMessage(null);
    setIsStarting('demo');
    if (onStatusChange) {
      onStatusChange('正在准备本地项目');
    }

    try {
      // 创建 Demo 演示项目摘要并保存至 localStorage
      const projName = projectName.trim() || '演示旅行照片项目';
      const summary: LocalProjectSummary = {
        projectId: createProjectId(),
        projectName: projName,
        createdAt: new Date().toLocaleString('zh-CN'),
        updatedAt: new Date().toLocaleString('zh-CN'),
        photoCount: 20,
        keepCount: 18,
        cullCount: 2,
        similarGroupCount: 6,
        battleCompleted: 0,
        battleTotal: 6,
        fileFingerprints: []
      };
      saveRecentLocalProject(summary);

      loadDemoPhotos();
      router.push('/processing');
    } catch (err) {
      console.error('Demo load error:', err);
      if (isMountedRef.current) {
        setErrorMessage('载入 Demo 失败，请重试。');
        setIsStarting('none');
        if (onStatusChange) {
          onStatusChange('等待选择本地文件夹');
        }
      }
    }
  };

  const steps = [
    { num: '01', label: '选择文件夹' },
    { num: '02', label: '本地扫描' },
    { num: '03', label: '整理' },
    { num: '04', label: 'A/B 对比' },
    { num: '05', label: '安全导出' }
  ];

  return (
    <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full py-4 select-none">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*"
        className="hidden"
      />

      {/* Hidden File Input for Relinking */}
      <input
        type="file"
        ref={relinkFileInputRef}
        onChange={handleRelinkFileChange}
        multiple
        accept="image/*"
        className="hidden"
      />

      {/* Hidden File Input for Web Image Selection */}
      <input
        type="file"
        ref={webImageInputRef}
        onChange={handleWebImageChange}
        multiple
        accept="image/*"
        className="hidden"
      />

      {/* Left/Right Two Columns Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 my-auto">
        {/* Left Column: Action area & basic intro */}
        <div className="md:col-span-7 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-[var(--dt-text-primary)] tracking-tight">
              开始整理本地照片
            </h1>
            <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed max-w-md">
              创建一个本地整理项目。当前浏览器原型只保存项目摘要，不保存原图文件，也不会上传云端。
            </p>
          </div>

          {/* Project Name Input */}
          <div className="space-y-1.5 max-w-sm">
            <label className="text-[10px] font-bold text-[var(--dt-text-secondary)] uppercase tracking-wider font-mono block">
              项目名称
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={defaultNamePlaceholder}
              className="w-full bg-black/35 border border-white/10 rounded px-3 py-2 text-xs text-[var(--dt-text-primary)] focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
            />
          </div>

          {/* Action Cards Grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Card 1: 选择文件夹 */}
              {isTauri ? (
                <div
                  onClick={() => {
                    if (isStarting === 'none') {
                      handleSelectFolderNativeClick();
                    }
                  }}
                  className={`bg-[var(--dt-card-bg)] hover:bg-[var(--dt-card-hover-bg)] border border-[var(--dt-border)] hover:border-emerald-500/30 rounded-lg p-4 cursor-pointer transition-all flex flex-col justify-between min-h-[110px] group relative ${isStarting !== 'none' ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--dt-text-primary)]">
                      <FolderOpen className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
                      <span>选择文件夹</span>
                    </div>
                    <p className="text-[10px] text-[var(--dt-text-secondary)] leading-relaxed">
                      扫描整个文件夹内的照片进行整理
                    </p>
                  </div>
                  <div className="text-[9px] text-[var(--dt-text-faint)] font-mono mt-2">
                    自动检测子文件夹 | 限 {getEffectiveNativeBatchLimit()} 张
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (isStarting === 'none') {
                      handleSelectFolderClick();
                    }
                  }}
                  className={`bg-[var(--dt-card-bg)] hover:bg-[var(--dt-card-hover-bg)] border border-[var(--dt-border)] hover:border-emerald-500/30 rounded-lg p-4 cursor-pointer transition-all flex flex-col justify-between min-h-[110px] group relative ${isStarting !== 'none' ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--dt-text-primary)]">
                      <FolderOpen className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
                      <span>选择文件夹</span>
                    </div>
                    <p className="text-[10px] text-[var(--dt-text-secondary)] leading-relaxed">
                      选择本地照片文件夹，支持多选导入
                    </p>
                  </div>
                  <div className="text-[9px] text-[var(--dt-text-faint)] font-mono mt-2">
                    限 200 张
                  </div>
                </div>
              )}

              {/* Card 2: 选择图片 */}
              {isTauri ? (
                <div
                  onClick={() => {
                    if (isStarting === 'none') {
                      handleSelectImagesNativeClick();
                    }
                  }}
                  className={`bg-[var(--dt-card-bg)] hover:bg-[var(--dt-card-hover-bg)] border border-[var(--dt-border)] hover:border-sky-500/30 rounded-lg p-4 cursor-pointer transition-all flex flex-col justify-between min-h-[110px] group relative ${isStarting !== 'none' ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--dt-text-primary)]">
                      <ImageIcon className="w-4 h-4 text-sky-400 group-hover:text-sky-300" />
                      <span>选择图片</span>
                    </div>
                    <p className="text-[10px] text-[var(--dt-text-secondary)] leading-relaxed">
                      手动选择一批照片进行筛选
                    </p>
                  </div>
                  <div className="text-[9px] text-[var(--dt-text-faint)] font-mono mt-2">
                    当前最多分析 200 张
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (isStarting === 'none') {
                      webImageInputRef.current?.click();
                    }
                  }}
                  className={`bg-[var(--dt-card-bg)] hover:bg-[var(--dt-card-hover-bg)] border border-[var(--dt-border)] hover:border-sky-500/30 rounded-lg p-4 cursor-pointer transition-all flex flex-col justify-between min-h-[110px] group relative ${isStarting !== 'none' ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--dt-text-primary)]">
                      <ImageIcon className="w-4 h-4 text-sky-400 group-hover:text-sky-300" />
                      <span>选择图片</span>
                    </div>
                    <p className="text-[10px] text-[var(--dt-text-secondary)] leading-relaxed">
                      手动选择一批照片进行筛选
                    </p>
                  </div>
                  <div className="text-[9px] text-[var(--dt-text-faint)] font-mono mt-2">
                    当前最多分析 200 张
                  </div>
                </div>
              )}
            </div>

            {/* Load Demo */}
            <div className="pt-1">
              <button
                onClick={handleLoadDemoClick}
                disabled={isStarting !== 'none'}
                className="desktop-button-secondary space-x-2 text-xs py-2.5 px-4 shrink-0 rounded"
              >
                <span>{isStarting === 'demo' ? '正在载入 Demo...' : '载入 Demo 项目'}</span>
                {isStarting !== 'demo' && <ArrowRight className="w-4 h-4 text-[var(--dt-text-secondary)] inline-block align-middle ml-1" />}
              </button>
            </div>

            {/* Folder picked summary banner */}
            {pickedFolder && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-lg text-xs space-y-1.5 max-w-sm">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>已选择并授权本地文件夹</span>
                </div>
                <p className="text-[10.5px] text-[var(--dt-text-primary)] font-semibold truncate">
                  已选择文件夹：{getFolderBasename(pickedFolder)}
                </p>
                
                {isScanning && (
                  <div className="flex items-center gap-2 py-1 text-[10px] text-[var(--dt-text-secondary)] animate-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>正在扫描文件夹元数据...</span>
                  </div>
                )}

                {!isScanning && scanSummary && (
                  <div className="bg-black/20 p-2.5 rounded border border-emerald-500/10 space-y-2 text-[10.5px] font-mono text-[var(--dt-text-secondary)]">
                    <div className="space-y-1">
                      <div>发现图片：<span className="text-emerald-400 font-bold">{scanSummary.imageFilesCount} 张</span></div>
                      <div>文件总数：<span className="text-[var(--dt-text-primary)]">{scanSummary.totalFiles} 个</span></div>
                      <div>其他 / 不支持文件：<span>{scanSummary.unsupportedFilesCount} 个</span></div>
                      <div>图片总大小：<span className="text-[var(--dt-text-primary)] font-bold">{formatBytes(scanSummary.totalSizeBytes)}</span></div>
                      <div>支持格式：<span className="text-[var(--dt-text-soft)]">JPG / PNG / WEBP / HEIC / HEIF</span></div>
                    </div>
                  </div>
                )}

                {!isScanning && previews.length > 0 && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-emerald-500/10">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="font-bold text-[var(--dt-text-primary)]">本地预览</span>
                      <span className="text-[9px] text-[var(--dt-text-secondary)]">不上传云端 | 限 {getEffectiveNativeBatchLimit()} 张</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {previews.map((item, idx) => (
                        <div key={item.id} className="relative aspect-square rounded overflow-hidden bg-black/35 border border-white/5 group">
                          <img
                            src={item.previewUrl}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1 text-[8px] font-mono text-[var(--dt-text-primary)] leading-tight">
                            <div>{(item.sizeBytes / (1024 * 1024)).toFixed(1)}M</div>
                            <div className="uppercase text-[7px] text-[var(--dt-text-soft)]">{item.extension}</div>
                          </div>
                          <div className="absolute top-0.5 left-0.5 bg-black/65 px-1 rounded-[3px] text-[8px] font-mono text-[var(--dt-text-primary)] leading-none py-0.5">
                            {String(idx + 1).padStart(2, '0')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[9px] text-[var(--dt-text-secondary)] leading-normal">
                  完整路径仅在本次授权中临时使用，不会保存。
                </p>

                {!isScanning && previews.length > 0 && (
                  <div className="pt-2.5 border-t border-emerald-500/10">
                    <button
                      onClick={() => {
                        const projName = projectName.trim() || defaultNamePlaceholder || getDefaultProjectName();
                        startNativeFolderAnalysis(previews, projName);
                      }}
                      className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold py-2 px-4 rounded text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      开始本地分析
                    </button>
                  </div>
                )}

                <div className="text-[10px] text-[var(--dt-text-soft)] leading-normal pt-1.5 border-t border-emerald-500/10 space-y-1">
                  {!isScanning && previews.length > 0 ? (
                    <>
                      <p>💡 已可进行本地预览与小批量分析。</p>
                      <p>💡 当前最多分析 {getEffectiveNativeBatchLimit()} 张。</p>
                      <p>💡 原图保持不变，不上传云端。</p>
                      <p>💡 整理结果页接入将在下一步完成。</p>
                    </>
                  ) : (
                    <>
                      <p>💡 本轮仅扫描文件夹第一层元数据，暂未读取图片内容。</p>
                      <p>💡 暂未开始分析，后续会接入本地整理流程。</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Image picked summary banner */}
            {imageSelectionMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-lg text-xs space-y-1.5 max-w-sm">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>已选择图片导入</span>
                </div>
                
                <div className="bg-black/20 p-2.5 rounded border border-emerald-500/10 text-[10.5px] font-mono text-[var(--dt-text-secondary)] leading-relaxed">
                  {imageSelectionMessage}
                </div>

                <div className="text-[10px] text-[var(--dt-text-soft)] leading-normal pt-1.5 border-t border-emerald-500/10 space-y-1">
                  <p>💡 多选图片导入将在下一阶段接入分析流程。</p>
                  <p>💡 遵循极严的隐私边界保护，当前不会显示真实文件名或路径。</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <p className="text-red-500 text-xs font-medium pt-1 animate-pulse">
                {errorMessage}
              </p>
            )}

            {/* Browser fallback comment */}
            <p className="text-[10px] text-[var(--dt-text-faint)] leading-relaxed">
              * 当前浏览器原型会选择本地图片文件；桌面版将支持完整文件夹授权。
            </p>
          </div>

          {/* Short privacy statement */}
          <div className="text-[10px] text-[var(--dt-text-secondary)] flex items-center space-x-1.5 opacity-80 pt-2 border-t border-[var(--dt-border)] max-w-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6FA887] shrink-0" />
            <span>默认在本地处理原图，联网 AI 默认关闭。</span>
          </div>
        </div>

        {/* Right Column: Recents & Details */}
        <div className="md:col-span-5 space-y-6">
          {/* Recent projects */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-[var(--dt-text-secondary)] uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>最近照片项目</span>
              </h3>
              {recentProjects.length > 0 && (
                <button
                  onClick={() => setIsConfirmingClearAll(true)}
                  className="text-[9px] text-[var(--dt-text-muted)] hover:text-red-400 font-semibold transition-colors"
                >
                  清空摘要列表
                </button>
              )}
            </div>
            
            {recentProjects.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-lg p-6 text-center text-[10px] text-[var(--dt-text-faint)]">
                最近项目只记录项目名称、数量和整理进度摘要。原图保持在您的电脑中，不会被上传或改动。
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                {recentProjects.map((project) => (
                  <div 
                    key={project.projectId} 
                    className="bg-[var(--dt-card-bg)] hover:bg-[var(--dt-card-hover-bg)] transition-colors p-3 rounded-lg flex items-center justify-between cursor-pointer border border-[var(--dt-border)] group"
                    onClick={() => setSelectedProjectForReassociate(project)}
                  >
                    <div className="truncate pr-2 flex-1">
                      <div className="text-xs font-semibold text-[var(--dt-text-primary)] truncate">{project.projectName}</div>
                      <div className="text-[9px] text-[var(--dt-text-secondary)] truncate font-mono mt-1 flex items-center gap-2">
                        <span>共 {project.photoCount} 张</span>
                        <span>•</span>
                        <span>{project.createdAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-[9px] text-[var(--dt-text-muted)] font-mono text-right">
                        {project.keepCount > 0 || project.cullCount > 0 ? (
                          <span className="text-[#6FA887]">已整理</span>
                        ) : (
                          <span className="text-yellow-500/80">未开始</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToRemove(project);
                        }}
                        className="text-[9px] text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-medium px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20"
                        title="移除摘要"
                      >
                        移除摘要
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security & Privacy card */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold text-[var(--dt-text-secondary)] uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--dt-text-secondary)]" />
              <span>安全与隐私保护</span>
            </h3>
            <div className="bg-[var(--dt-panel-bg)] p-3.5 space-y-3 rounded-lg text-xs border border-[var(--dt-border)]">
              <div className="flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-[#6FA887] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--dt-text-primary)] text-xs block">默认本地处理</span>
                  <span className="text-[var(--dt-text-secondary)] text-[10px] leading-relaxed block mt-0.5">
                    默认在本地处理原图，联网 AI 默认关闭。
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <Cpu className="w-4 h-4 text-[#6F8FA8] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--dt-text-primary)] text-xs block">联网 AI 默认关闭</span>
                  <span className="text-[var(--dt-text-secondary)] text-[10px] leading-relaxed block mt-0.5">
                    高级语义识别等联网功能默认关闭，仅在您手动授权后使用。
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <Trash2 className="w-4 h-4 text-[#B89A58] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--dt-text-primary)] text-xs block">淘汰候选仅代表整理建议</span>
                  <span className="text-[var(--dt-text-secondary)] text-[10px] leading-relaxed block mt-0.5">
                    淘汰候选仅代表整理建议，原图保持不变，在您最终确认并导出时绝不被直接物理修改。
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Workflow Preview */}
      <div className="border-t border-[var(--dt-border)] pt-4 mt-6">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {steps.map((step, idx) => (
            <React.Fragment key={idx}>
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded-full border border-[var(--dt-border)] bg-[var(--dt-button-secondary)] text-[var(--dt-text-primary)] font-mono text-[10px] flex items-center justify-center font-bold">
                  {step.num}
                </div>
                <span className="text-[10px] font-semibold text-[var(--dt-text-secondary)]">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-[var(--dt-text-muted)] opacity-60" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Reassociation Modal */}
      {selectedProjectForReassociate && (
        <div className="fixed inset-0 bg-black/60 backdrop-filter backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f26] border border-white/10 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left text-[var(--dt-text-primary)]">
            <h3 className="text-sm font-bold text-[var(--dt-text-primary)] flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-yellow-400" />
              重新关联本地照片
            </h3>
            
            <div className="space-y-2">
              <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed">
                项目：<span className="font-semibold text-[var(--dt-text-primary)]">{selectedProjectForReassociate.projectName}</span>
              </p>
              
              {/* Detailed historical metadata grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--dt-text-secondary)] font-mono bg-black/15 p-2.5 rounded border border-white/5">
                <div>照片总数: <span className="text-[var(--dt-text-primary)] font-bold">{selectedProjectForReassociate.photoCount} 张</span></div>
                <div>相似组数: <span className="text-[var(--dt-text-primary)] font-bold">{selectedProjectForReassociate.similarGroupCount} 组</span></div>
                <div>建议保留: <span className="text-[#6FA887] font-bold">{selectedProjectForReassociate.keepCount} 张</span></div>
                <div>淘汰候选: <span className="text-[#B96F68] font-bold">{selectedProjectForReassociate.cullCount} 张</span></div>
                {selectedProjectForReassociate.battleTotal > 0 && (
                  <div className="col-span-2 mt-1 pt-1 border-t border-white/5">
                    AB 对决进度: <span className="text-[var(--dt-text-primary)] font-bold">{selectedProjectForReassociate.battleCompleted} / {selectedProjectForReassociate.battleTotal}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed">
              这是一个项目摘要。当前浏览器原型不会保存原图文件。若要继续整理该项目，请点击下方按钮重新选择同一批照片进行关联。
            </p>

            <div className="bg-black/25 border border-white/5 rounded-lg p-3 text-[10px] text-[var(--dt-text-soft)] space-y-1 leading-relaxed">
              <p className="font-semibold text-white/90">💡 安全声明：</p>
              <p>• 原图保持在您的本地电脑中，不会被上传或改动。</p>
              <p>• 淘汰候选仅代表整理建议，原图保持不变。</p>
              <p>• 最近项目摘要只存储在您的浏览器缓存中，不会上传云端。</p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedProjectForReassociate(null)}
                className="desktop-button-secondary text-xs py-2 px-4 rounded"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const projectToRelink = selectedProjectForReassociate;
                  setSelectedProjectForReassociate(null);
                  handleRelinkSelectClick(projectToRelink);
                }}
                className="desktop-button-primary text-xs py-2 px-4 rounded flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                重新选择照片继续
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mismatch Warning Modal */}
      {mismatchWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-filter backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f26] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left text-[var(--dt-text-primary)]">
            <h3 className="text-sm font-bold text-[var(--dt-text-primary)] flex items-center gap-2">
              <span className="text-yellow-500">⚠️</span>
              提示
            </h3>
            
            <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed">
              本次选择的照片数量与上次不同，仍可继续整理。
            </p>

            <div className="text-[10px] text-[var(--dt-text-faint)] font-mono bg-black/15 p-2 rounded space-y-1">
              <div>历史照片数量: {mismatchWarning.project.photoCount} 张</div>
              <div>本次选择数量: {mismatchWarning.files.length} 张</div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setMismatchWarning(null)}
                className="desktop-button-secondary text-xs py-2 px-4 rounded"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const { project, files } = mismatchWarning;
                  setMismatchWarning(null);
                  proceedWithReassociation(project, files);
                }}
                className="desktop-button-primary text-xs py-2 px-4 rounded font-semibold"
              >
                继续整理
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Project Removal Confirmation Modal */}
      {projectToRemove && (
        <div className="fixed inset-0 bg-black/60 backdrop-filter backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f26] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left text-[var(--dt-text-primary)]">
            <h3 className="text-sm font-bold text-[var(--dt-text-primary)] flex items-center gap-2">
              <span className="text-yellow-500">⚠️</span>
              确认移除摘要
            </h3>
            
            <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed">
              您确定要移除该项目的最近记录吗？
            </p>

            <div className="bg-black/25 border border-white/5 rounded-lg p-3 text-[10px] text-[var(--dt-text-soft)] space-y-1.5 leading-relaxed">
              <p>• 只会移除此项目的最近记录摘要。</p>
              <p>• <span className="font-semibold text-white">不会影响您的本地原图照片</span>，原图保持不变。</p>
              <p>• 之后您仍可以重新选择照片开始新整理。</p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setProjectToRemove(null)}
                className="desktop-button-secondary text-xs py-2 px-4 rounded"
              >
                取消
              </button>
              <button
                onClick={() => handleRemoveProject(projectToRemove.projectId)}
                className="desktop-button-primary text-xs py-2 px-4 rounded font-semibold bg-red-600 hover:bg-red-500 border-red-600"
              >
                确认移除摘要
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Projects Confirmation Modal */}
      {isConfirmingClearAll && (
        <div className="fixed inset-0 bg-black/60 backdrop-filter backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f26] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left text-[var(--dt-text-primary)]">
            <h3 className="text-sm font-bold text-[var(--dt-text-primary)] flex items-center gap-2">
              <span className="text-yellow-500">⚠️</span>
              确认清空摘要列表
            </h3>
            
            <p className="text-xs text-[var(--dt-text-secondary)] leading-relaxed">
              您确定要清空所有最近项目摘要列表吗？
            </p>

            <div className="bg-black/25 border border-white/5 rounded-lg p-3 text-[10px] text-[var(--dt-text-soft)] space-y-1.5 leading-relaxed">
              <p>• 只会清空当前浏览器中存储的本地摘要记录。</p>
              <p>• <span className="font-semibold text-white">绝对不会影响您的本地原图照片</span>，原图保持不变。</p>
              <p>• 绝对不改动您的本地原图文件。</p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmingClearAll(false)}
                className="desktop-button-secondary text-xs py-2 px-4 rounded"
              >
                取消
              </button>
              <button
                onClick={handleClearAllProjects}
                className="desktop-button-primary text-xs py-2 px-4 rounded font-semibold bg-red-600 hover:bg-red-500 border-red-600"
              >
                确认清空摘要列表
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocalProjectStart;
