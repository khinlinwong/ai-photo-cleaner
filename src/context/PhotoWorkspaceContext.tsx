'use client';

import React, { createContext, useContext, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { analyzeImage } from '@/lib/imageAnalysis';

export interface PhotoItem {
  id: string;
  url: string;
  name: string;
  size: string;
  status: 'keep' | 'review' | 'delete';
  issue: 'good' | 'blurry' | 'overexposed' | 'underexposed' | 'needs_review';
  score: number; // 0-100 qualityScore
  blurValue: number; // 0-100 (higher is blurrier)
  exposureValue: number; // -100 to +100 (negative is underexposed, positive is overexposed, 0 is perfect)
  resolution: string;
  category: string;
  file?: File; // 存放本地上传的原始 File 引用
  sharpnessScore: number; // 真实清晰度得分 (0-100)
  exposureScore: number; // 真实曝光得分 (0-100)
}

// 预设的高质量旅行 Mock 照片（对应新版的类型定义）
export const MOCK_TRAVEL_PHOTOS: PhotoItem[] = [
  {
    id: 'photo-1',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
    name: 'Kyoto_Bamboo_Forest.jpg',
    size: '4.2 MB',
    status: 'keep',
    issue: 'good',
    score: 96,
    blurValue: 8,
    exposureValue: 5,
    resolution: '4032 × 3024',
    category: '风景',
    sharpnessScore: 92,
    exposureScore: 98
  },
  {
    id: 'photo-2',
    url: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=800&auto=format&fit=crop',
    name: 'Shinjuku_Street_Night_Blur.jpg',
    size: '3.8 MB',
    status: 'delete',
    issue: 'blurry',
    score: 34,
    blurValue: 82,
    exposureValue: -12,
    resolution: '3840 × 2160',
    category: '城市',
    sharpnessScore: 18,
    exposureScore: 88
  },
  {
    id: 'photo-3',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    name: 'Bali_Beach_Overexposed.jpg',
    size: '5.1 MB',
    status: 'delete',
    issue: 'overexposed',
    score: 45,
    blurValue: 15,
    exposureValue: 88,
    resolution: '4032 × 3024',
    category: '海滩',
    sharpnessScore: 85,
    exposureScore: 12
  },
  {
    id: 'photo-4',
    url: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=800&auto=format&fit=crop',
    name: 'Venice_Alley_Dark.jpg',
    size: '2.9 MB',
    status: 'delete',
    issue: 'underexposed',
    score: 41,
    blurValue: 18,
    exposureValue: -79,
    resolution: '3024 × 4032',
    category: '人文',
    sharpnessScore: 82,
    exposureScore: 21
  },
  {
    id: 'photo-5',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
    name: 'Zermatt_Matterhorn_Peak.jpg',
    size: '6.4 MB',
    status: 'keep',
    issue: 'good',
    score: 98,
    blurValue: 4,
    exposureValue: -2,
    resolution: '4800 × 3200',
    category: '雪山',
    sharpnessScore: 96,
    exposureScore: 98
  },
  {
    id: 'photo-6',
    url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800&auto=format&fit=crop',
    name: 'Eiffel_Tower_Portrait.jpg',
    size: '3.5 MB',
    status: 'keep',
    issue: 'good',
    score: 92,
    blurValue: 12,
    exposureValue: 10,
    resolution: '3024 × 4032',
    category: '人像',
    sharpnessScore: 88,
    exposureScore: 95
  }
];

interface PhotoWorkspaceContextType {
  photos: PhotoItem[];
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisLogs: string[];
  currentAnalysisIndex: number;
  currentAnalysisName: string;
  uploadFiles: (files: File[]) => void;
  startAnalysis: () => void;
  togglePhotoStatus: (id: string) => void;
  updatePhotoStatus: (id: string, status: 'keep' | 'review' | 'delete') => void;
  updateMultiplePhotosStatus: (ids: string[], status: 'keep' | 'review' | 'delete') => void;
  deletePhoto: (id: string) => void;
  deleteSuggestedPhotos: () => void;
  resetWorkspace: () => void;
  loadDemoPhotos: () => void;
}

const PhotoWorkspaceContext = createContext<PhotoWorkspaceContextType | undefined>(undefined);

export const PhotoWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [currentAnalysisIndex, setCurrentAnalysisIndex] = useState(-1);
  const [currentAnalysisName, setCurrentAnalysisName] = useState('');
  const router = useRouter();

  // startAnalysis 运行中保护 Lock
  const isAnalyzingRef = useRef(false);

  // 辅助函数：安全释放 blob URL
  const revokeBlobUrl = (url: string) => {
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  };

  // 上传文件：保存本地 File 对象和预览 URL
  const uploadFiles = (files: File[]) => {
    // 释放旧的预览 URL 防止泄露
    photos.forEach(p => revokeBlobUrl(p.url));

    if (files.length > 0) {
      const uploadedItems: PhotoItem[] = files.map((file, index) => {
        return {
          id: `uploaded-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`,
          url: URL.createObjectURL(file),
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          status: 'keep', // 默认状态为保留
          issue: 'good',  // 默认问题良好
          score: 0,
          blurValue: 0,
          exposureValue: 0,
          resolution: '待分析',
          category: '待分类',
          file: file, // 保存 File 对象
          sharpnessScore: 0,
          exposureScore: 0
        };
      });
      setPhotos(uploadedItems);
    } else {
      // 演示包 fallback
      setPhotos(MOCK_TRAVEL_PHOTOS);
    }
    
    // 跳转到分析页面
    router.push('/processing');
  };

  // 开始 AI 真实图像分析流程
  const startAnalysis = async () => {
    if (isAnalyzingRef.current) {
      return;
    }
    isAnalyzingRef.current = true;

    let currentPhotos = [...photos];
    if (currentPhotos.length === 0) {
      // 兼容机制：如果为空，默认填充 6 张旅行照片
      currentPhotos = [...MOCK_TRAVEL_PHOTOS];
      setPhotos(currentPhotos);
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisLogs([]);
    setCurrentAnalysisIndex(0);
    setCurrentAnalysisName(currentPhotos[0]?.name || '');

    const updatedPhotos = [...currentPhotos];
    const total = updatedPhotos.length;

    setAnalysisLogs((prev) => [...prev, '⚡ 正在初始化浏览器端 Canvas 像素诊断仪...']);

    for (let i = 0; i < total; i++) {
      const photo = updatedPhotos[i];
      const percentEnd = Math.round(((i + 1) / total) * 100);
      
      setCurrentAnalysisIndex(i);
      setCurrentAnalysisName(photo.name);

      // 日志输出
      setAnalysisLogs((prev) => [
        ...prev,
        `⚙️ 正在读取并分析第 ${i + 1}/${total} 张图片: ${photo.name}...`
      ]);

      if (photo.file) {
        try {
          // 运行真实 Canvas 分析
          const res = await analyzeImage(photo.file);
          
          // 对接 UI 结构：
          // blurValue 在结果页代表模糊度（0-100，高代表越模糊），故用 100 - sharpnessScore 映射
          // exposureValue 在结果页为偏离值（-100到100，负代表欠曝，正代表过曝，0代表完美）
          const blurValue = 100 - res.sharpnessScore;
          const exposureValue = Math.round((res.averageBrightness - 127) * (100 / 127));

          let category = '标准曝光';
          if (res.averageBrightness > 170) {
            category = '高对比亮光';
          } else if (res.averageBrightness < 80) {
            category = '夜景/暗光';
          }

          updatedPhotos[i] = {
            ...photo,
            status: res.status,
            issue: res.issue,
            score: res.qualityScore,
            blurValue,
            exposureValue,
            resolution: `${res.width} × ${res.height}`,
            category,
            sharpnessScore: res.sharpnessScore,
            exposureScore: res.exposureScore
          };

          setAnalysisLogs((prev) => [
            ...prev,
            `  ✓ 综合得分: ${res.qualityScore} | 清晰度: ${res.sharpnessScore} | 亮度偏差: ${exposureValue > 0 ? '+' : ''}${exposureValue}`
          ]);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : '文件损坏或解析错误';
          setAnalysisLogs((prev) => [
            ...prev,
            `  ❌ 像素读取失败: ${errMsg}`
          ]);
        }
      } else {
        // 安全降级：对于 Demo 外链图片，使用预存的分析参数以防止 Canvas CORS 报错
        await new Promise((resolve) => setTimeout(resolve, 800)); // 模拟异步加载
        
        const demoMatch = MOCK_TRAVEL_PHOTOS.find((m) => m.name === photo.name) || MOCK_TRAVEL_PHOTOS[0];
        updatedPhotos[i] = {
          ...photo,
          status: demoMatch.status,
          issue: demoMatch.issue,
          score: demoMatch.score,
          blurValue: demoMatch.blurValue,
          exposureValue: demoMatch.exposureValue,
          resolution: demoMatch.resolution,
          category: demoMatch.category,
          sharpnessScore: demoMatch.sharpnessScore,
          exposureScore: demoMatch.exposureScore
        };

        setAnalysisLogs((prev) => [
          ...prev,
          `  ✓ 分析完毕: 得分 ${demoMatch.score} (已加载预置旅行报告)`
        ]);
      }

      setAnalysisProgress(percentEnd);
    }

    setAnalysisLogs((prev) => [...prev, '✅ 智能物理整理已完成，正在生成诊断报表...']);
    setPhotos(updatedPhotos);

    // 延时跳转，提供更好的交互感知
    setTimeout(() => {
      setIsAnalyzing(false);
      isAnalyzingRef.current = false;
      router.push('/results');
    }, 1200);
  };

  // 切换保留/删除状态
  const togglePhotoStatus = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          // 如果是 keep 标为 delete，如果是 delete 标为 keep，如果是 review 标为 keep
          const nextStatus: 'keep' | 'review' | 'delete' = p.status === 'keep' ? 'delete' : 'keep';
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );
  };

  // 单张照片状态手动订正
  const updatePhotoStatus = (id: string, status: 'keep' | 'review' | 'delete') => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
  };

  // 多张照片状态批量手动订正
  const updateMultiplePhotosStatus = (ids: string[], status: 'keep' | 'review' | 'delete') => {
    setPhotos((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, status } : p))
    );
  };

  // 删除单张照片
  const deletePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find(p => p.id === id);
      if (target) {
        revokeBlobUrl(target.url);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  // 批量删除建议删除的照片（只删除 status === 'delete'，保留 keep 和 review 状态）
  const deleteSuggestedPhotos = () => {
    setPhotos((prev) => {
      const targets = prev.filter(p => p.status === 'delete');
      targets.forEach(p => revokeBlobUrl(p.url));
      return prev.filter((p) => p.status !== 'delete');
    });
  };

  // 重置工作台
  const resetWorkspace = () => {
    photos.forEach(p => revokeBlobUrl(p.url));
    setPhotos([]);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
    setAnalysisProgress(0);
    setAnalysisLogs([]);
    setCurrentAnalysisIndex(-1);
    setCurrentAnalysisName('');
  };

  // 载入演示图片数据包
  const loadDemoPhotos = () => {
    photos.forEach(p => revokeBlobUrl(p.url));
    setPhotos(MOCK_TRAVEL_PHOTOS);
  };

  return (
    <PhotoWorkspaceContext.Provider
      value={{
        photos,
        isAnalyzing,
        analysisProgress,
        analysisLogs,
        currentAnalysisIndex,
        currentAnalysisName,
        uploadFiles,
        startAnalysis,
        togglePhotoStatus,
        updatePhotoStatus,
        updateMultiplePhotosStatus,
        deletePhoto,
        deleteSuggestedPhotos,
        resetWorkspace,
        loadDemoPhotos
      }}
    >
      {children}
    </PhotoWorkspaceContext.Provider>
  );
};

export const usePhotoWorkspace = () => {
  const context = useContext(PhotoWorkspaceContext);
  if (context === undefined) {
    throw new Error('usePhotoWorkspace must be used within a PhotoWorkspaceProvider');
  }
  return context;
};
