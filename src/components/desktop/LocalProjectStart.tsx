import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePhotoWorkspace } from '@/context/PhotoWorkspaceContext';
import { FolderOpen, ArrowRight, ShieldCheck, Cpu, Trash2, Clock, ChevronRight } from 'lucide-react';
import {
  getRecentLocalProjects,
  saveRecentLocalProject,
  createProjectId,
  createFileFingerprints
} from '@/lib/projects/localProjectStorage';
import { LocalProjectSummary } from '@/lib/projects/types';

interface LocalProjectStartProps {
  onStatusChange?: (status: string) => void;
}

export const LocalProjectStart: React.FC<LocalProjectStartProps> = ({ onStatusChange }) => {
  const router = useRouter();
  const { uploadFiles, loadDemoPhotos } = usePhotoWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const relinkFileInputRef = useRef<HTMLInputElement>(null);

  const [isStarting, setIsStarting] = useState<'none' | 'upload' | 'demo'>('none');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 项目名称状态管理
  const [projectName, setProjectName] = useState('');
  const [defaultNamePlaceholder, setDefaultNamePlaceholder] = useState('');

  // 最近项目状态管理
  const [recentProjects, setRecentProjects] = useState<LocalProjectSummary[]>([]);
  const [selectedProjectForReassociate, setSelectedProjectForReassociate] = useState<LocalProjectSummary | null>(null);
  
  // 重新关联机制的状态
  const [relinkingProject, setRelinkingProject] = useState<LocalProjectSummary | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<{ project: LocalProjectSummary; files: File[] } | null>(null);

  // 默认项目名称生成器
  const getDefaultProjectName = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `本地照片项目 ${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    setDefaultNamePlaceholder(getDefaultProjectName());
    setRecentProjects(getRecentLocalProjects());
  }, []);

  const handleSelectFolderClick = () => {
    fileInputRef.current?.click();
  };

  const handleRelinkSelectClick = (project: LocalProjectSummary) => {
    setRelinkingProject(project);
    if (relinkFileInputRef.current) {
      relinkFileInputRef.current.value = '';
    }
    relinkFileInputRef.current?.click();

    // Listen to window focus to clear relinkingProject state if file selection is cancelled
    const handleWindowFocus = () => {
      window.removeEventListener('focus', handleWindowFocus);
      // Wait a short delay to allow onChange to fire first if files were chosen
      setTimeout(() => {
        setRelinkingProject(null);
      }, 500);
    };

    // Delay adding focus listener slightly to avoid triggering instantly on button click focus changes
    setTimeout(() => {
      window.addEventListener('focus', handleWindowFocus);
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
      uploadFiles(files);
    } catch (err) {
      console.error('Reassociation error:', err);
      setErrorMessage('关联项目失败，请重试。');
      setIsStarting('none');
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
      uploadFiles(imgFiles);
    } catch (err) {
      console.error('File import error:', err);
      setErrorMessage('导入失败，请重新选择图片。');
      setIsStarting('none');
      if (onStatusChange) {
        onStatusChange('等待选择本地文件夹');
      }
    }
  };

  const handleRelinkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    if (files.length === 0) {
      setRelinkingProject(null);
      return;
    }

    // 过滤图片文件
    const imgFiles = files.filter(file => file.type.startsWith('image/'));
    if (imgFiles.length === 0) {
      setErrorMessage('请选择至少一张图片。');
      setRelinkingProject(null);
      return;
    }

    setErrorMessage(null);

    if (!relinkingProject) {
      return;
    }

    try {
      if (imgFiles.length !== relinkingProject.photoCount) {
        setMismatchWarning({
          project: relinkingProject,
          files: imgFiles
        });
        setRelinkingProject(null);
        return;
      }

      proceedWithReassociation(relinkingProject, imgFiles);
      setRelinkingProject(null);
    } catch (err) {
      console.error('Relink file change error:', err);
      setErrorMessage('关联失败，请重新选择图片。');
      setRelinkingProject(null);
    }
  };

  const handleLoadDemoClick = () => {
    setErrorMessage(null);
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
        photoCount: 8,
        keepCount: 5,
        cullCount: 1,
        similarGroupCount: 1,
        battleCompleted: 0,
        battleTotal: 1,
        fileFingerprints: []
      };
      saveRecentLocalProject(summary);

      loadDemoPhotos();
      router.push('/processing');
    } catch (err) {
      console.error('Demo load error:', err);
      setErrorMessage('载入 Demo 失败，请重试。');
      setIsStarting('none');
      if (onStatusChange) {
        onStatusChange('等待选择本地文件夹');
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

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleSelectFolderClick}
                disabled={isStarting !== 'none'}
                className="desktop-button-primary space-x-2 text-xs py-3 px-5 shadow-sm shrink-0"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{isStarting === 'upload' ? '准备导入...' : '选择本地照片文件夹'}</span>
              </button>
              
              <button
                onClick={handleLoadDemoClick}
                disabled={isStarting !== 'none'}
                className="desktop-button-secondary space-x-2 text-xs py-3 px-5 shrink-0"
              >
                <span>{isStarting === 'demo' ? '正在载入 Demo...' : '载入 Demo 项目'}</span>
                {isStarting !== 'demo' && <ArrowRight className="w-4 h-4 text-[var(--dt-text-secondary)]" />}
              </button>
            </div>

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
            <h3 className="text-[11px] font-bold text-[var(--dt-text-secondary)] uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>最近照片项目</span>
            </h3>
            
            {recentProjects.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-lg p-6 text-center text-[10px] text-[var(--dt-text-faint)]">
                最近项目只记录项目名称、数量和整理进度摘要。原图保持在您的电脑中，不会被上传或改动。
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                {recentProjects.map((project) => (
                  <div 
                    key={project.projectId} 
                    className="bg-[var(--dt-card-bg)] hover:bg-[var(--dt-card-hover-bg)] transition-colors p-3 rounded-lg flex items-center justify-between cursor-pointer border border-[var(--dt-border)]"
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
                    <div className="text-[9px] text-[var(--dt-text-muted)] shrink-0 font-mono text-right">
                      {project.keepCount > 0 || project.cullCount > 0 ? (
                        <span className="text-[#6FA887]">已整理</span>
                      ) : (
                        <span className="text-yellow-500/80">未开始</span>
                      )}
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
    </div>
  );
};

export default LocalProjectStart;
