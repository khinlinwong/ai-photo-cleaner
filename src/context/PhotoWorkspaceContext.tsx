'use client';

import React, { createContext, useContext, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { analyzeImage, analyzeImageFromBlob } from '@/lib/imageAnalysis';
import { AnalysisMode, SimilarGroup, BattleDecision } from '@/lib/analysis/vision/types';
import { detectDuplicates, buildDuplicateSignals, DuplicateAnalysisResult, buildSimilarGroupsFromSignals, QASimilarGroupSignalForBattle, adaptSignalGroupsToLegacySimilarGroups } from '@/lib/analysis/local/duplicate';
import { USE_SIGNAL_GROUPS_FOR_BATTLE } from '@/lib/config/featureFlags';
import { NativeImagePreviewItem } from '@/lib/desktop/nativeImagePreviewScanner';
import { getEffectiveNativeBatchLimit } from '@/lib/desktop/nativeBatchLimit';

declare global {
  interface Window {
    __AI_PHOTO_CLEANER_QA__?: {
      oldSimilarGroupCount: number;
      newSimilarGroupCount: number;
      similarGroupCountMismatch: boolean;
      oldSimilarGroupedPhotoCount: number;
      newSimilarGroupedPhotoCount: number;
      similarGroupedPhotoCountMismatch: boolean;
      leaderMismatchCount: number;
      generatedAt: number;
      source: 'duplicateGroupQA';
    };
  }
}

export interface ActiveBattleState {
  groupId: string;
  photoIds: string[];
  contenderIds: string[];
  currentCandidateId: string;
  nextIndex: number;
  roundIndex: number;
  totalRounds: number;
  decisions: BattleDecision[];
  recommendedKeepIds: string[];
  similarBackupIds: string[];
  cullCandidateIds: string[];
  undecidedIds: string[];
}

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
  focusStatus?:
    | 'Excellent / Share-ready'
    | 'Acceptable / Casual use'
    | 'Soft Focus Detected'
    | 'Directional Blur Detected'
    | 'Motion Blur Detected'
    | 'Edge Smear Detected'
    | 'Insufficient Subject Sharpness'
    | 'Not recommended'
    | 'Excellent Focus'
    | 'Acceptable'
    | 'Slightly Soft'
    | 'Blurry';
  perceptualHash?: string;
  duplicateGroupId?: string | null;
  duplicateScore?: number;
  isDuplicateCandidate?: boolean;
  duplicateRecommendation?: 'keep' | 'review' | 'delete';
  exposureSeverity?: 'none' | 'minor' | 'moderate' | 'severe';
  technicalRiskFlags?: ('possible_blur' | 'possible_motion_blur' | 'exposure_risk' | 'low_information' | 'duplicate_candidate' | 'severe_quality_issue')[];
  confidence?: 'high' | 'medium' | 'low';
  suggestedStatus?: 'keep' | 'review' | 'delete';
  displayLabel?: '技术风险低' | '建议复核' | '淘汰候选';
  reasonLabel?: string;
  userDecision?: 'keep' | 'review' | 'delete';
  sourceId?: string;
  sourceType?: 'browser-file' | 'native-folder-preview' | 'native-folder-file';
  extension?: string;
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
    exposureScore: 98,
    perceptualHash: '8a8a8a8a8a8a8a8a',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
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
    exposureScore: 88,
    perceptualHash: '1b1b1b1b1b1b1b1b',
    exposureSeverity: 'none',
    technicalRiskFlags: ['possible_motion_blur', 'severe_quality_issue'],
    confidence: 'low',
    suggestedStatus: 'delete',
    displayLabel: '淘汰候选',
    reasonLabel: '检测到明显技术风险，建议淘汰候选'
  },
  {
    id: 'photo-3',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    name: 'Bali_Beach_Overexposed.jpg',
    size: '5.1 MB',
    status: 'review',
    issue: 'needs_review',
    score: 77,
    blurValue: 15,
    exposureValue: 35,
    resolution: '4032 × 3024',
    category: '海滩',
    sharpnessScore: 85,
    exposureScore: 72,
    perceptualHash: '2c2c2c2c2c2c2c2c',
    exposureSeverity: 'moderate',
    technicalRiskFlags: ['exposure_risk'],
    confidence: 'medium',
    suggestedStatus: 'review',
    displayLabel: '建议复核',
    reasonLabel: '可能存在曝光风险'
  },
  {
    id: 'photo-4',
    url: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=800&auto=format&fit=crop',
    name: 'Venice_Alley_Dark.jpg',
    size: '2.9 MB',
    status: 'review',
    issue: 'needs_review',
    score: 73,
    blurValue: 18,
    exposureValue: -40,
    resolution: '3024 × 4032',
    category: '人文',
    sharpnessScore: 82,
    exposureScore: 70,
    perceptualHash: '3d3d3d3d3d3d3d3d',
    exposureSeverity: 'moderate',
    technicalRiskFlags: ['exposure_risk'],
    confidence: 'medium',
    suggestedStatus: 'review',
    displayLabel: '建议复核',
    reasonLabel: '可能存在曝光风险'
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
    exposureScore: 98,
    perceptualHash: '4e4e4e4e4e4e4e4e',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
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
    exposureScore: 95,
    perceptualHash: 'e1e1e1e1e1e1e1e1',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-7',
    url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800&auto=format&fit=crop&burst=1',
    name: 'Eiffel_Tower_Portrait_Burst1.jpg',
    size: '3.4 MB',
    status: 'keep',
    issue: 'good',
    score: 85,
    blurValue: 20,
    exposureValue: 10,
    resolution: '3024 × 4032',
    category: '人像',
    sharpnessScore: 80,
    exposureScore: 95,
    perceptualHash: 'e1e1e1e1e1e1e1e3',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-8',
    url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800&auto=format&fit=crop&burst=2',
    name: 'Eiffel_Tower_Portrait_Burst2.jpg',
    size: '3.6 MB',
    status: 'keep',
    issue: 'good',
    score: 80,
    blurValue: 25,
    exposureValue: 10,
    resolution: '3024 × 4032',
    category: '人像',
    sharpnessScore: 75,
    exposureScore: 95,
    perceptualHash: 'e1e1e1e1e1e1ffff',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-9',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
    name: 'Kyoto_Bamboo_Forest_Burst1.jpg',
    size: '4.1 MB',
    status: 'keep',
    issue: 'good',
    score: 94,
    blurValue: 10,
    exposureValue: 5,
    resolution: '4032 × 3024',
    category: '风景',
    sharpnessScore: 90,
    exposureScore: 97,
    perceptualHash: '8a8a8a8a8a8a8a8b',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-10',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
    name: 'Kyoto_Bamboo_Forest_Burst2.jpg',
    size: '4.3 MB',
    status: 'keep',
    issue: 'good',
    score: 90,
    blurValue: 14,
    exposureValue: 5,
    resolution: '4032 × 3024',
    category: '风景',
    sharpnessScore: 88,
    exposureScore: 96,
    perceptualHash: '8a8a8a8a8a8a8a8c',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-11',
    url: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=800&auto=format&fit=crop',
    name: 'Venice_Alley_Burst1.jpg',
    size: '2.8 MB',
    status: 'review',
    issue: 'needs_review',
    score: 71,
    blurValue: 20,
    exposureValue: -42,
    resolution: '3024 × 4032',
    category: '人文',
    sharpnessScore: 80,
    exposureScore: 68,
    perceptualHash: '3d3d3d3d3d3d3d3e',
    exposureSeverity: 'moderate',
    technicalRiskFlags: ['exposure_risk'],
    confidence: 'medium',
    suggestedStatus: 'review',
    displayLabel: '建议复核',
    reasonLabel: '可能存在曝光风险'
  },
  {
    id: 'photo-12',
    url: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=800&auto=format&fit=crop',
    name: 'Venice_Alley_Burst2.jpg',
    size: '3.0 MB',
    status: 'review',
    issue: 'needs_review',
    score: 70,
    blurValue: 22,
    exposureValue: -45,
    resolution: '3024 × 4032',
    category: '人文',
    sharpnessScore: 78,
    exposureScore: 65,
    perceptualHash: '3d3d3d3d3d3d3d3f',
    exposureSeverity: 'moderate',
    technicalRiskFlags: ['exposure_risk'],
    confidence: 'medium',
    suggestedStatus: 'review',
    displayLabel: '建议复核',
    reasonLabel: '可能存在曝光风险'
  },
  {
    id: 'photo-13',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
    name: 'Mt_Fuji_Sunrise.jpg',
    size: '5.5 MB',
    status: 'keep',
    issue: 'good',
    score: 95,
    blurValue: 6,
    exposureValue: -1,
    resolution: '4800 × 3200',
    category: '雪山',
    sharpnessScore: 93,
    exposureScore: 96,
    perceptualHash: '5f5f5f5f5f5f5f5f',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-14',
    url: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=800&auto=format&fit=crop',
    name: 'Amsterdam_Canal_Morning.jpg',
    size: '4.8 MB',
    status: 'keep',
    issue: 'good',
    score: 91,
    blurValue: 10,
    exposureValue: 2,
    resolution: '3840 × 2160',
    category: '城市',
    sharpnessScore: 89,
    exposureScore: 93,
    perceptualHash: '6f6f6f6f6f6f6f6f',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-15',
    url: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=800&auto=format&fit=crop',
    name: 'London_Bridge_Sunset1.jpg',
    size: '3.9 MB',
    status: 'keep',
    issue: 'good',
    score: 93,
    blurValue: 8,
    exposureValue: 4,
    resolution: '3024 × 4032',
    category: '人文',
    sharpnessScore: 90,
    exposureScore: 95,
    perceptualHash: '7a7a7a7a7a7a7a7a',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-16',
    url: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=800&auto=format&fit=crop',
    name: 'London_Bridge_Sunset2.jpg',
    size: '3.7 MB',
    status: 'keep',
    issue: 'good',
    score: 88,
    blurValue: 12,
    exposureValue: 4,
    resolution: '3024 × 4032',
    category: '人文',
    sharpnessScore: 85,
    exposureScore: 95,
    perceptualHash: '7a7a7a7a7a7a7a7b',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-17',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
    name: 'Rome_Colosseum_Detail1.jpg',
    size: '5.0 MB',
    status: 'keep',
    issue: 'good',
    score: 92,
    blurValue: 9,
    exposureValue: 3,
    resolution: '4032 × 3024',
    category: '风景',
    sharpnessScore: 88,
    exposureScore: 94,
    perceptualHash: '8b8b8b8b8b8b8b8b',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-18',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
    name: 'Rome_Colosseum_Detail2.jpg',
    size: '4.9 MB',
    status: 'keep',
    issue: 'good',
    score: 87,
    blurValue: 13,
    exposureValue: 3,
    resolution: '4032 × 3024',
    category: '风景',
    sharpnessScore: 84,
    exposureScore: 94,
    perceptualHash: '8b8b8b8b8b8b8b8c',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-19',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    name: 'Sydney_Opera_Sunset1.jpg',
    size: '4.6 MB',
    status: 'keep',
    issue: 'good',
    score: 94,
    blurValue: 7,
    exposureValue: 2,
    resolution: '4032 × 3024',
    category: '海滩',
    sharpnessScore: 91,
    exposureScore: 96,
    perceptualHash: '9c9c9c9c9c9c9c9c',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  },
  {
    id: 'photo-20',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    name: 'Sydney_Opera_Sunset2.jpg',
    size: '4.4 MB',
    status: 'keep',
    issue: 'good',
    score: 89,
    blurValue: 11,
    exposureValue: 2,
    resolution: '4032 × 3024',
    category: '海滩',
    sharpnessScore: 86,
    exposureScore: 96,
    perceptualHash: '9c9c9c9c9c9c9c9d',
    exposureSeverity: 'none',
    technicalRiskFlags: [],
    confidence: 'high',
    suggestedStatus: 'keep',
    displayLabel: '技术风险低',
    reasonLabel: '未发现明显技术问题'
  }
];

export const NATIVE_PROCESSING_MVP_LIMIT = getEffectiveNativeBatchLimit();

interface PhotoWorkspaceContextType {
  photos: PhotoItem[];
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisLogs: string[];
  currentAnalysisIndex: number;
  currentAnalysisName: string;
  analysisMode: AnalysisMode;
  projectName: string;
  setProjectName: (name: string) => void;
  setAnalysisMode: (mode: AnalysisMode) => void;
  uploadFiles: (files: File[], name?: string) => void;
  startAnalysis: () => void;
  togglePhotoStatus: (id: string) => void;
  updatePhotoStatus: (id: string, status: 'keep' | 'review' | 'delete') => void;
  updateMultiplePhotosStatus: (ids: string[], status: 'keep' | 'review' | 'delete') => void;
  deletePhoto: (id: string) => void;
  deleteSuggestedPhotos: () => void;
  resetWorkspace: () => void;
  loadDemoPhotos: () => void;
  startNativeFolderAnalysis: (previews: NativeImagePreviewItem[], name?: string, sourceMode?: 'folder' | 'selected-files') => void;
  nativeSourceMode: 'folder' | 'selected-files' | null;
  identifyNativeSimilarGroups: () => void;
  skippedCount: number;
  failedCount: number;
  isNativeProcessingCancelled: boolean;
  cancelNativeProcessing: () => void;
  resetNativeProcessingCancelState: () => void;
  // Checkpoint 6 Battle methods and state:
  similarGroups: SimilarGroup[];
  activeBattle: ActiveBattleState | null;
  startBattleForGroup: (groupId: string, options?: { allowNative?: boolean }) => void;
  applyBattleDecision: (decision: 'keep_left' | 'keep_right' | 'keep_both' | 'cull_both' | 'skip') => void;
  resetBattleForGroup: (groupId: string) => void;
  closeBattle: () => void;
  // =========================================================================
  // CRITICAL DEV-ONLY QA WARNING:
  // - This is a Dev-only QA field used strictly to compare legacy detectDuplicates
  //   output with buildDuplicateSignals in non-production environments.
  // - DO NOT under any circumstances use this field to drive UI, Results page,
  //   Photo Battle flow, ZIP export, or user-visible decisions.
  // =========================================================================
  duplicateSignalResult?: DuplicateAnalysisResult | null;
  // =========================================================================
  // CRITICAL DEV-ONLY QA WARNING:
  // - duplicateGroupQA is strictly a Dev-only QA field for regression testing.
  // - DO NOT under any circumstances use this field to drive UI, Results page,
  //   Photo Battle flow, ZIP export, or user-visible decisions.
  // =========================================================================
  duplicateGroupQA?: DuplicateGroupQA | null;
}

export interface DuplicateGroupQA {
  oldSimilarGroupsForQA: SimilarGroup[];
  newSimilarGroupsForQA: QASimilarGroupSignalForBattle[];
  comparison: DuplicateSignalComparison;
}

type DuplicateSignalComparison = {
  oldGroupCount: number;
  newGroupCount: number;
  oldGroupedPhotoCount: number;
  newGroupedPhotoCount: number;
  oldLeaderIds: string[];
  newLeaderIds: string[];
  leaderMismatchCount: number;

  // 相似组 QA 扩展字段
  oldSimilarGroupCount: number;
  newSimilarGroupCount: number;
  oldSimilarGroupedPhotoCount: number;
  newSimilarGroupedPhotoCount: number;
  similarGroupCountMismatch: boolean;
  similarGroupedPhotoCountMismatch: boolean;
};

const compareOldAndNewDuplicates = (
  oldPhotos: PhotoItem[],
  newResult: DuplicateAnalysisResult,
  oldSimilarGroups: SimilarGroup[],
  newSimilarGroups: QASimilarGroupSignalForBattle[]
): DuplicateSignalComparison => {
  const oldGroupedPhotos = oldPhotos.filter(p => !!p.duplicateGroupId);
  const oldGroupIds = Array.from(new Set(oldGroupedPhotos.map(p => p.duplicateGroupId)));
  const oldLeaderIds = Array.from(new Set(oldPhotos.filter(p => p.duplicateRecommendation === 'keep').map(p => p.id)));

  const newGroupedPhotoCount = Object.keys(newResult.photoToGroup).length;
  const newGroupCount = newResult.groups.length;
  const newLeaderIds = newResult.groups.map(g => g.leaderId).filter(Boolean) as string[];

  let leaderMismatchCount = 0;
  newResult.groups.forEach(g => {
    const oldGroupPhotos = oldPhotos.filter(p => g.photoIds.includes(p.id));
    const oldLeader = oldGroupPhotos.find(p => p.duplicateRecommendation === 'keep');
    if (oldLeader && oldLeader.id !== g.leaderId) {
      leaderMismatchCount++;
    }
  });

  const oldSimilarGroupCount = oldSimilarGroups.length;
  const newSimilarGroupCount = newSimilarGroups.length;
  const oldSimilarGroupedPhotoCount = oldSimilarGroups.reduce((acc, g) => acc + g.photoIds.length, 0);
  const newSimilarGroupedPhotoCount = newSimilarGroups.reduce((acc, g) => acc + g.photoIds.length, 0);

  return {
    oldGroupCount: oldGroupIds.length,
    newGroupCount,
    oldGroupedPhotoCount: oldGroupedPhotos.length,
    newGroupedPhotoCount,
    oldLeaderIds,
    newLeaderIds,
    leaderMismatchCount,
    oldSimilarGroupCount,
    newSimilarGroupCount,
    oldSimilarGroupedPhotoCount,
    newSimilarGroupedPhotoCount,
    similarGroupCountMismatch: oldSimilarGroupCount !== newSimilarGroupCount,
    similarGroupedPhotoCountMismatch: oldSimilarGroupedPhotoCount !== newSimilarGroupedPhotoCount
  };
};

const PhotoWorkspaceContext = createContext<PhotoWorkspaceContextType | undefined>(undefined);

export const PhotoWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [currentAnalysisIndex, setCurrentAnalysisIndex] = useState(-1);
  const [currentAnalysisName, setCurrentAnalysisName] = useState('');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('local');
  const [projectName, setProjectName] = useState<string>('');
  const [skippedCount, setSkippedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [nativeSourceMode, setNativeSourceMode] = useState<'folder' | 'selected-files' | null>(null);
  const router = useRouter();

  const [isNativeProcessingCancelled, setIsNativeProcessingCancelled] = useState(false);
  const isCancelledRef = useRef(false);
  const activeRunIdRef = useRef<string | null>(null);

  const cancelNativeProcessing = () => {
    setIsNativeProcessingCancelled(true);
    isCancelledRef.current = true;
    activeRunIdRef.current = null; // Invalidate the current active run
    setAnalysisLogs((prev) => [...prev, '🛑 收到停止指令，正在停止分析队列...']);
  };

  const resetNativeProcessingCancelState = () => {
    setIsNativeProcessingCancelled(false);
    isCancelledRef.current = false;
  };

  // Development-only guard.
  // Signal-derived groups must not drive production or user-facing flows.
  // Keep USE_SIGNAL_GROUPS_FOR_BATTLE=false until QA proves parity with legacy similarGroups.
  const canUseSignalGroupsForBattle =
    process.env.NODE_ENV === 'development' &&
    (USE_SIGNAL_GROUPS_FOR_BATTLE as boolean) === true;

  // Checkpoint 6 Battle states
  const [similarGroups, setSimilarGroups] = useState<SimilarGroup[]>([]);
  const [activeBattle, setActiveBattle] = useState<ActiveBattleState | null>(null);

  // =========================================================================
  // CRITICAL DEV-ONLY QA WARNING:
  // - This is a Dev-only QA field used strictly to compare legacy detectDuplicates
  //   output with buildDuplicateSignals in non-production environments.
  // - DO NOT under any circumstances use this field to drive UI, Results page,
  //   Photo Battle flow, ZIP export, or user-visible decisions.
  // =========================================================================
  const [duplicateSignalResult, setDuplicateSignalResult] = useState<DuplicateAnalysisResult | null>(null);

  // =========================================================================
  // CRITICAL DEV-ONLY QA WARNING:
  // - duplicateGroupQA is strictly a Dev-only QA state for regression testing.
  // - DO NOT under any circumstances use this field to drive UI, Results page,
  //   Photo Battle flow, ZIP export, or user-visible decisions.
  // =========================================================================
  const [duplicateGroupQA, setDuplicateGroupQA] = useState<DuplicateGroupQA | null>(null);

  // 双路运行 QA 比较辅助
  const runDuplicateQA = (processedPhotos: PhotoItem[], oldSimilarGroupsOverride?: SimilarGroup[]) => {
    try {
      if (!Array.isArray(processedPhotos)) return;
      const safePhotos = processedPhotos.filter(Boolean);
      const signalInputs = safePhotos.map(photo => ({
        id: photo.id,
        perceptualHash: photo.perceptualHash,
        sharpnessScore: photo.sharpnessScore,
        qualityScore: photo.score,
        resolution: photo.resolution
      }));

      const newResult = buildDuplicateSignals(signalInputs);
      setDuplicateSignalResult(newResult);

      // 1. 同步还原旧版的分组数据，用于只读对比，无需依赖或重写 initializeSimilarGroups
      const groupsMap: { [groupId: string]: string[] } = {};
      safePhotos.forEach((photo) => {
        if (photo && photo.duplicateGroupId) {
          if (!groupsMap[photo.duplicateGroupId]) {
            groupsMap[photo.duplicateGroupId] = [];
          }
          groupsMap[photo.duplicateGroupId].push(photo.id);
        }
      });
      const oldSimilarGroupsMock: SimilarGroup[] = Object.entries(groupsMap).map(([groupId, photoIds]) => {
        const groupPhotos = safePhotos.filter(p => p && photoIds.includes(p.id));
        const recommendedLeader = groupPhotos.find(p => p.duplicateRecommendation === 'keep') || groupPhotos[0];
        const leaderId = recommendedLeader ? recommendedLeader.id : photoIds[0];
        return {
          id: groupId,
          photoIds,
          recommendedPhotoIds: [leaderId],
          backupPhotoIds: photoIds.filter(id => id !== leaderId),
          cullCandidateIds: [],
          undecidedPhotoIds: photoIds,
          battleCompleted: false,
          battleUpdatedAt: 0
        };
      });

      // =========================================================================
      // QA-ONLY COMPATIBILITY SHAPE & LOCAL QA DATA WARNING:
      // - newSimilarGroupsForQA is strictly a local variable for regression testing.
      // - DO NOT write this to similarGroups state, activeBattle, or return it to UI.
      // - It must never drive or influence the real user workflows or ZIP export.
      // =========================================================================
      const newSimilarGroupsForQA = buildSimilarGroupsFromSignals(newResult);

      const comparison = compareOldAndNewDuplicates(
        processedPhotos,
        newResult,
        oldSimilarGroupsOverride || oldSimilarGroupsMock,
        newSimilarGroupsForQA
      );

      setDuplicateGroupQA({
        oldSimilarGroupsForQA: oldSimilarGroupsOverride || oldSimilarGroupsMock,
        newSimilarGroupsForQA,
        comparison
      });

      if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
        window.__AI_PHOTO_CLEANER_QA__ = {
          oldSimilarGroupCount: comparison.oldSimilarGroupCount,
          newSimilarGroupCount: comparison.newSimilarGroupCount,
          similarGroupCountMismatch: comparison.similarGroupCountMismatch,
          oldSimilarGroupedPhotoCount: comparison.oldSimilarGroupedPhotoCount,
          newSimilarGroupedPhotoCount: comparison.newSimilarGroupedPhotoCount,
          similarGroupedPhotoCountMismatch: comparison.similarGroupedPhotoCountMismatch,
          leaderMismatchCount: comparison.leaderMismatchCount,
          generatedAt: Date.now(),
          source: 'duplicateGroupQA'
        };
      }

      if (process.env.NODE_ENV === 'development') {
        console.debug('[Duplicate SimilarGroups QA]', {
          oldSimilarGroupCount: comparison.oldSimilarGroupCount,
          newSimilarGroupCount: comparison.newSimilarGroupCount,
          oldSimilarGroupedPhotoCount: comparison.oldSimilarGroupedPhotoCount,
          newSimilarGroupedPhotoCount: comparison.newSimilarGroupedPhotoCount,
          leaderMismatchCount: comparison.leaderMismatchCount,
          similarGroupCountMismatch: comparison.similarGroupCountMismatch,
          similarGroupedPhotoCountMismatch: comparison.similarGroupedPhotoCountMismatch
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Duplicate Signal QA Error]', err);
      }
    }
  };

  // startAnalysis 运行中保护 Lock
  const isAnalyzingRef = useRef(false);

  // 初始化相似照片分组列表的辅助方法
  const initializeSimilarGroups = (photosList: PhotoItem[]) => {
    if (!Array.isArray(photosList)) return;
    const safePhotosList = photosList.filter(Boolean);
    if (canUseSignalGroupsForBattle) {
      // 灰度分支：使用客观相似检测信号生成的 newSimilarGroupsForQA 覆盖 similarGroups 状态，驱动 PK
      const signalInputs = safePhotosList.map(photo => ({
        id: photo.id,
        perceptualHash: photo.perceptualHash,
        sharpnessScore: photo.sharpnessScore,
        qualityScore: photo.score,
        resolution: photo.resolution
      }));
      const newResult = buildDuplicateSignals(signalInputs);
      const signalGroups = buildSimilarGroupsFromSignals(newResult);
      setSimilarGroups(adaptSignalGroupsToLegacySimilarGroups(signalGroups, Date.now()));
    } else {
      // 稳定分支：继续使用 legacy 相似组逻辑来初始化和驱动
      const groupsMap: { [groupId: string]: string[] } = {};
      safePhotosList.forEach((photo) => {
        if (photo.duplicateGroupId) {
          if (!groupsMap[photo.duplicateGroupId]) {
            groupsMap[photo.duplicateGroupId] = [];
          }
          groupsMap[photo.duplicateGroupId].push(photo.id);
        }
      });

      const newGroups: SimilarGroup[] = Object.entries(groupsMap).map(([groupId, photoIds]) => {
        const groupPhotos = safePhotosList.filter(p => p && photoIds.includes(p.id));
        const recommendedLeader = groupPhotos.find(p => p.duplicateRecommendation === 'keep') || groupPhotos[0];
        const leaderId = recommendedLeader ? recommendedLeader.id : photoIds[0];

        return {
          id: groupId,
          photoIds,
          recommendedPhotoIds: [leaderId],
          backupPhotoIds: photoIds.filter(id => id !== leaderId),
          cullCandidateIds: [],
          undecidedPhotoIds: photoIds,
          battleCompleted: false,
          battleUpdatedAt: Date.now()
        };
      });

      setSimilarGroups(newGroups);
    }
  };

  const startBattleForGroup = (groupId: string, options?: { allowNative?: boolean }) => {
    const hasNative = photos.some(p => p.sourceType === 'native-folder-preview' || p.sourceType === 'native-folder-file');
    if (hasNative && !options?.allowNative) {
      console.warn('Battle is disabled for local native sources unless explicitly allowed.');
      return;
    }

    const group = similarGroups.find(g => g.id === groupId);
    if (!group) return;

    const groupPhotos = photos.filter(p => group.photoIds.includes(p.id));
    if (groupPhotos.length <= 1) return;

    const sortedPhotos = [...groupPhotos].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.sharpnessScore !== a.sharpnessScore) return b.sharpnessScore - a.sharpnessScore;
      return a.id.localeCompare(b.id);
    });

    const initialCandidateId = sortedPhotos[0].id;
    const contenderIds = sortedPhotos.slice(1).map(p => p.id);

    setActiveBattle({
      groupId,
      photoIds: group.photoIds,
      contenderIds,
      currentCandidateId: initialCandidateId,
      nextIndex: 0,
      roundIndex: 1,
      totalRounds: contenderIds.length,
      decisions: [],
      recommendedKeepIds: [],
      similarBackupIds: [],
      cullCandidateIds: [],
      undecidedIds: [...group.photoIds]
    });
  };

  const applyBattleDecision = (decisionType: 'keep_left' | 'keep_right' | 'keep_both' | 'cull_both' | 'skip') => {
    if (!activeBattle) return;

    const leftId = activeBattle.currentCandidateId;
    const rightId = activeBattle.contenderIds[activeBattle.nextIndex];

    const decision: BattleDecision = {
      groupId: activeBattle.groupId,
      leftPhotoId: leftId,
      rightPhotoId: rightId,
      decision: decisionType,
      createdAt: Date.now()
    };

    let nextCandidateId = activeBattle.currentCandidateId;
    let nextIndex = activeBattle.nextIndex;
    let roundIndex = activeBattle.roundIndex;

    let newRecommended = [...activeBattle.recommendedKeepIds];
    let newBackup = [...activeBattle.similarBackupIds];
    let newCull = [...activeBattle.cullCandidateIds];
    const newUndecided = activeBattle.undecidedIds.filter(id => id !== leftId && id !== rightId);

    if (decisionType === 'keep_left') {
      if (!newRecommended.includes(leftId)) {
        newRecommended.push(leftId);
      }
      newRecommended = newRecommended.filter(id => id !== rightId);
      newBackup = newBackup.filter(id => id !== leftId && id !== rightId);
      newCull = newCull.filter(id => id !== leftId);
      if (!newCull.includes(rightId)) {
        newCull.push(rightId);
      }
      nextIndex += 1;
      roundIndex += 1;
    } else if (decisionType === 'keep_right') {
      if (!newRecommended.includes(rightId)) {
        newRecommended.push(rightId);
      }
      newRecommended = newRecommended.filter(id => id !== leftId);
      newBackup = newBackup.filter(id => id !== leftId && id !== rightId);
      newCull = newCull.filter(id => id !== rightId);
      if (!newCull.includes(leftId)) {
        newCull.push(leftId);
      }
      nextCandidateId = rightId;
      nextIndex += 1;
      roundIndex += 1;
    } else if (decisionType === 'keep_both') {
      if (!newRecommended.includes(leftId)) newRecommended.push(leftId);
      if (!newRecommended.includes(rightId)) newRecommended.push(rightId);
      newBackup = newBackup.filter(id => id !== leftId && id !== rightId);
      newCull = newCull.filter(id => id !== leftId && id !== rightId);
      nextIndex += 1;
      roundIndex += 1;
    } else if (decisionType === 'cull_both') {
      newRecommended = newRecommended.filter(id => id !== leftId && id !== rightId);
      newBackup = newBackup.filter(id => id !== leftId && id !== rightId);
      if (!newCull.includes(leftId)) newCull.push(leftId);
      if (!newCull.includes(rightId)) newCull.push(rightId);
      if (nextIndex + 1 < activeBattle.contenderIds.length) {
        nextCandidateId = activeBattle.contenderIds[nextIndex + 1];
        nextIndex += 2;
      } else {
        nextIndex += 1;
      }
      roundIndex += 1;
    } else if (decisionType === 'skip') {
      if (!newUndecided.includes(leftId)) newUndecided.push(leftId);
      if (!newUndecided.includes(rightId)) newUndecided.push(rightId);
      nextIndex += 1;
      roundIndex += 1;
    }

    const isCompleted = nextIndex >= activeBattle.contenderIds.length;

    if (isCompleted) {
      if (nextCandidateId && !newCull.includes(nextCandidateId) && !newBackup.includes(nextCandidateId) && !newRecommended.includes(nextCandidateId)) {
        newRecommended.push(nextCandidateId);
      }

      const finalState = {
        ...activeBattle,
        currentCandidateId: nextCandidateId,
        nextIndex,
        roundIndex: activeBattle.totalRounds,
        recommendedKeepIds: newRecommended,
        similarBackupIds: newBackup,
        cullCandidateIds: newCull,
        undecidedIds: newUndecided.filter(id => !newRecommended.includes(id) && !newBackup.includes(id) && !newCull.includes(id)),
        decisions: [...activeBattle.decisions, decision]
      };

      completeBattleForGroupInternal(activeBattle.groupId, finalState);

      const updatedSimilarGroups = similarGroups.map(g => {
        if (g.id === activeBattle.groupId) {
          return {
            ...g,
            recommendedPhotoIds: newRecommended,
            backupPhotoIds: newBackup,
            cullCandidateIds: newCull,
            undecidedPhotoIds: finalState.undecidedIds,
            battleCompleted: true,
            battleUpdatedAt: Date.now()
          };
        }
        return g;
      });

      const nextPendingGroup = updatedSimilarGroups.find(g => !g.battleCompleted);

      if (nextPendingGroup) {
        const groupPhotos = photos.filter(p => nextPendingGroup.photoIds.includes(p.id));
        if (groupPhotos.length > 1) {
          const sortedPhotos = [...groupPhotos].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.sharpnessScore !== a.sharpnessScore) return b.sharpnessScore - a.sharpnessScore;
            return a.id.localeCompare(b.id);
          });

          const initialCandidateId = sortedPhotos[0].id;
          const contenderIds = sortedPhotos.slice(1).map(p => p.id);

          setActiveBattle({
            groupId: nextPendingGroup.id,
            photoIds: nextPendingGroup.photoIds,
            contenderIds,
            currentCandidateId: initialCandidateId,
            nextIndex: 0,
            roundIndex: 1,
            totalRounds: contenderIds.length,
            decisions: [],
            recommendedKeepIds: [],
            similarBackupIds: [],
            cullCandidateIds: [],
            undecidedIds: [...nextPendingGroup.photoIds]
          });
          return;
        }
      }

      setActiveBattle(finalState);
    } else {
      setActiveBattle({
        ...activeBattle,
        currentCandidateId: nextCandidateId,
        nextIndex,
        roundIndex: Math.min(activeBattle.totalRounds, roundIndex),
        recommendedKeepIds: newRecommended,
        similarBackupIds: newBackup,
        cullCandidateIds: newCull,
        undecidedIds: newUndecided,
        decisions: [...activeBattle.decisions, decision]
      });
    }
  };

  const completeBattleForGroupInternal = (groupId: string, finalState: ActiveBattleState) => {
    setSimilarGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          recommendedPhotoIds: finalState.recommendedKeepIds,
          backupPhotoIds: finalState.similarBackupIds,
          cullCandidateIds: finalState.cullCandidateIds,
          undecidedPhotoIds: finalState.undecidedIds,
          battleCompleted: true,
          battleUpdatedAt: Date.now()
        };
      }
      return g;
    }));

    setPhotos(prev => prev.map(photo => {
      if (photo.duplicateGroupId === groupId) {
        let nextStatus = photo.status;
        let reasonLabel = photo.reasonLabel || '未发现明显技术问题';
        let displayLabel = photo.displayLabel || '技术风险低';

        if (finalState.recommendedKeepIds.includes(photo.id)) {
          nextStatus = 'keep';
          reasonLabel = '属于相似照片组，已通过对比筛选建议保留';
          displayLabel = '技术风险低';
        } else if (finalState.similarBackupIds.includes(photo.id)) {
          nextStatus = 'review';
          reasonLabel = '属于相似照片组，对比筛选备选';
          displayLabel = '建议复核';
        } else if (finalState.cullCandidateIds.includes(photo.id)) {
          nextStatus = 'delete';
          reasonLabel = '属于相似照片组，已在对比筛选中淘汰';
          displayLabel = '淘汰候选';
        }

        return {
          ...photo,
          status: nextStatus,
          suggestedStatus: nextStatus,
          reasonLabel,
          displayLabel
        };
      }
      return photo;
    }));
  };

  const resetBattleForGroup = (groupId: string) => {
    setSimilarGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const groupPhotos = photos.filter(p => g.photoIds.includes(p.id));
        const sorted = [...groupPhotos].sort((a, b) => b.score - a.score || b.sharpnessScore - a.sharpnessScore || a.id.localeCompare(b.id));
        const leaderId = sorted[0]?.id || g.photoIds[0];

        return {
          ...g,
          recommendedPhotoIds: [leaderId],
          backupPhotoIds: g.photoIds.filter(id => id !== leaderId),
          cullCandidateIds: [],
          undecidedPhotoIds: g.photoIds,
          battleCompleted: false,
          battleUpdatedAt: Date.now()
        };
      }
      return g;
    }));

    setPhotos(prev => {
      const processed = detectDuplicates(prev);
      runDuplicateQA(processed);
      return processed;
    });
  };

  const closeBattle = () => {
    setActiveBattle(null);
  };

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
  const uploadFiles = (files: File[], name?: string) => {
    // 释放旧的预览 URL 防止泄露
    photos.forEach(p => revokeBlobUrl(p.url));

    // 设置项目名称
    setProjectName(name || '');

    // 重置所有分析和 Battle 相关状态
    setNativeSourceMode(null);
    setAnalysisProgress(0);
    setAnalysisLogs([]);
    setCurrentAnalysisIndex(-1);
    setCurrentAnalysisName('');
    setSimilarGroups([]);
    setActiveBattle(null);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;

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

  // 新增 Native Processing 独立入口
  const startNativeFolderAnalysis = (
    previews: NativeImagePreviewItem[],
    name?: string,
    sourceMode: 'folder' | 'selected-files' = 'folder'
  ) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('ab_auto_opened');
    }
    // 释放旧的预览 URL 防止泄露
    photos.forEach(p => revokeBlobUrl(p.url));

    // 设置项目名称
    setProjectName(name || '');

    // 重置所有分析和 Battle 相关状态
    setNativeSourceMode(sourceMode);
    resetNativeProcessingCancelState();
    setAnalysisProgress(0);
    setAnalysisLogs([]);
    setCurrentAnalysisIndex(-1);
    setCurrentAnalysisName('');
    setSimilarGroups([]);
    setActiveBattle(null);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
    setSkippedCount(0);
    setFailedCount(0);

    // 最多取 previews.slice(0, NATIVE_PROCESSING_MVP_LIMIT)
    const activePreviews = previews.slice(0, NATIVE_PROCESSING_MVP_LIMIT);

    if (activePreviews.length > 0) {
      const nativeItems: PhotoItem[] = activePreviews.map((item, index) => {
        return {
          id: item.id,
          url: item.previewUrl,
          name: `Photo-${String(index + 1).padStart(3, '0')}`,
          size: `${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
          status: 'keep', // 默认状态为保留
          issue: 'good',  // 默认问题良好
          score: 0,
          blurValue: 0,
          exposureValue: 0,
          resolution: '待分析',
          category: '待分类',
          file: undefined, // 必须为 undefined
          sharpnessScore: 0,
          exposureScore: 0,
          sourceId: item.id,
          sourceType: 'native-folder-preview',
          extension: item.extension
        };
      });
      setPhotos(nativeItems);
    }

    // 跳转到分析页面
    router.push('/processing');
  };

  // 开始 AI 真实图像分析流程
  const startAnalysis = async () => {
    if (isAnalyzingRef.current) {
      return;
    }
    resetNativeProcessingCancelState();
    isAnalyzingRef.current = true;

    // Generate unique session ID for this analysis run
    const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    activeRunIdRef.current = runId;

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
    setSkippedCount(0);
    setFailedCount(0);

    const updatedPhotos = [...currentPhotos];
    const total = updatedPhotos.length;

    try {
      setAnalysisLogs((prev) => [...prev, '⚡ 正在初始化本地扫描计算模块...']);

      for (let i = 0; i < total; i++) {
        if (isCancelledRef.current || activeRunIdRef.current !== runId) {
          if (isCancelledRef.current) {
            setAnalysisLogs((prev) => [...prev, '🛑 停止分析：后续图片分析已被用户中止。']);
          }
          for (let j = i; j < total; j++) {
            updatedPhotos[j] = {
              ...updatedPhotos[j],
              status: 'keep',
              resolution: '未分析',
              category: '已跳过',
              reasonLabel: '分析已被中止，未进行质量检测'
            };
          }
          break;
        }
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
            
            // Guard check after await
            if (activeRunIdRef.current !== runId) return;
            if (isCancelledRef.current) {
              for (let j = i; j < total; j++) {
                updatedPhotos[j] = {
                  ...updatedPhotos[j],
                  status: 'keep',
                  resolution: '未分析',
                  category: '已跳过',
                  reasonLabel: '分析已被中止，未进行质量检测'
                };
              }
              break;
            }

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
              exposureScore: res.exposureScore,
              focusStatus: res.focusStatus,
              perceptualHash: res.perceptualHash,
              exposureSeverity: res.exposureSeverity,
              technicalRiskFlags: res.technicalRiskFlags,
              confidence: res.confidence,
              suggestedStatus: res.suggestedStatus,
              displayLabel: res.displayLabel,
              reasonLabel: res.reasonLabel
            };

            setAnalysisLogs((prev) => [
              ...prev,
              `  ✓ 综合得分: ${res.qualityScore} | 清晰度: ${res.sharpnessScore} | 亮度偏差: ${exposureValue > 0 ? '+' : ''}${exposureValue}`
            ]);
          } catch (err: unknown) {
            if (activeRunIdRef.current !== runId) return;
            const errMsg = err instanceof Error ? err.message : '文件损坏或解析错误';
            setAnalysisLogs((prev) => [
              ...prev,
              `  ❌ 像素读取失败: ${errMsg}`
            ]);
          }
        } else if (photo.sourceType === 'native-folder-preview') {
          const ext = (photo.extension || '').toLowerCase();
          
          // HEIC / HEIF 跳过策略
          if (ext === 'heic' || ext === 'heif') {
            setAnalysisLogs((prev) => [
              ...prev,
              `  ⚠️ 跳过不支持的格式 (HEIC/HEIF): ${photo.name}`
            ]);
            setSkippedCount((prev) => prev + 1);
            
            updatedPhotos[i] = {
              ...photo,
              status: 'keep',
              issue: 'good',
              score: 0,
              resolution: '格式不支持',
              category: '已跳过',
              reasonLabel: '文件格式不支持 (HEIC/HEIF)，已跳过处理'
            };
          } else {
            try {
              // 串行读取二进制字节流
              const { readNativePreviewBytes } = await import('@/lib/desktop/nativeReader');
              
              // Guard check after dynamic import await
              if (activeRunIdRef.current !== runId) return;
              if (isCancelledRef.current) {
                for (let j = i; j < total; j++) {
                  updatedPhotos[j] = {
                    ...updatedPhotos[j],
                    status: 'keep',
                    resolution: '未分析',
                    category: '已跳过',
                    reasonLabel: '分析已被中止，未进行质量检测'
                  };
                }
                break;
              }

              const bytes = await readNativePreviewBytes(photo.id);
              
              // Guard check after reading bytes await
              if (activeRunIdRef.current !== runId) return;
              if (isCancelledRef.current) {
                for (let j = i; j < total; j++) {
                  updatedPhotos[j] = {
                    ...updatedPhotos[j],
                    status: 'keep',
                    resolution: '未分析',
                    category: '已跳过',
                    reasonLabel: '分析已被中止，未进行质量检测'
                  };
                }
                break;
              }

              if (!bytes) {
                throw new Error('安全拒绝：文件大小超过 15MB 限制或读取失败。');
              }
              
              // bytes -> Blob
              const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
              
              // analyzeImageFromBlob
              const res = await analyzeImageFromBlob(blob);
              
              // Guard check after analyzing blob await
              if (activeRunIdRef.current !== runId) return;
              if (isCancelledRef.current) {
                for (let j = i; j < total; j++) {
                  updatedPhotos[j] = {
                    ...updatedPhotos[j],
                    status: 'keep',
                    resolution: '未分析',
                    category: '已跳过',
                    reasonLabel: '分析已被中止，未进行质量检测'
                  };
                }
                break;
              }

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
                exposureScore: res.exposureScore,
                focusStatus: res.focusStatus,
                perceptualHash: res.perceptualHash,
                exposureSeverity: res.exposureSeverity,
                technicalRiskFlags: res.technicalRiskFlags,
                confidence: res.confidence,
                suggestedStatus: res.suggestedStatus,
                displayLabel: res.displayLabel,
                reasonLabel: res.reasonLabel
              };

              setAnalysisLogs((prev) => [
                ...prev,
                `  ✓ 综合得分: ${res.qualityScore} | 清晰度: ${res.sharpnessScore} | 亮度偏差: ${exposureValue > 0 ? '+' : ''}${exposureValue}`
              ]);
            } catch (err: unknown) {
              if (activeRunIdRef.current !== runId) return;
              const errMsg = err instanceof Error ? err.message : '读取失败';
              setAnalysisLogs((prev) => [
                ...prev,
                `  ❌ 像素读取失败: ${errMsg}`
              ]);
              setFailedCount((prev) => prev + 1);
              
              // 失败时安全跳过，状态保持默认 keep
              updatedPhotos[i] = {
                ...photo,
                status: 'keep',
                issue: 'needs_review',
                score: 0,
                resolution: '读取失败',
                category: '已跳过',
                reasonLabel: `本地读取或分析失败: ${errMsg}`
              };
            }
          }
        } else {
          // 安全降级：对于 Demo 外链图片，使用预存的分析参数以防止 Canvas CORS 报错
          await new Promise((resolve) => setTimeout(resolve, 800)); // 模拟异步加载
          
          // Guard check after timeout await
          if (activeRunIdRef.current !== runId) return;
          if (isCancelledRef.current) {
            for (let j = i; j < total; j++) {
              updatedPhotos[j] = {
                ...updatedPhotos[j],
                status: 'keep',
                resolution: '未分析',
                category: '已跳过',
                reasonLabel: '分析已被中止，未进行质量检测'
              };
            }
            break;
          }

          const demoMatch = MOCK_TRAVEL_PHOTOS.find((m) => m.name === photo.name) || MOCK_TRAVEL_PHOTOS[0];
          
          let focusStatus:
            | 'Excellent / Share-ready'
            | 'Acceptable / Casual use'
            | 'Soft Focus Detected'
            | 'Directional Blur Detected'
            | 'Motion Blur Detected'
            | 'Edge Smear Detected'
            | 'Insufficient Subject Sharpness'
            | 'Not recommended' = 'Acceptable / Casual use';

          if (demoMatch.sharpnessScore >= 85) {
            focusStatus = 'Excellent / Share-ready';
          } else if (demoMatch.sharpnessScore >= 60) {
            focusStatus = 'Acceptable / Casual use';
          } else if (demoMatch.sharpnessScore >= 40) {
            focusStatus = 'Soft Focus Detected';
          } else {
            focusStatus = demoMatch.name.includes('Blur') ? 'Motion Blur Detected' : 'Not recommended';
          }

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
            exposureScore: demoMatch.exposureScore,
            focusStatus,
            perceptualHash: demoMatch.perceptualHash,
            exposureSeverity: demoMatch.exposureSeverity,
            technicalRiskFlags: demoMatch.technicalRiskFlags,
            confidence: demoMatch.confidence,
            suggestedStatus: demoMatch.suggestedStatus,
            displayLabel: demoMatch.displayLabel,
            reasonLabel: demoMatch.reasonLabel
          };

          setAnalysisLogs((prev) => [
            ...prev,
            `  ✓ 分析完毕: 得分 ${demoMatch.score} (已加载预置旅行报告)`
          ]);
        }

        setAnalysisProgress(percentEnd);
      }

      // Final guard checks before writing states
      if (activeRunIdRef.current !== runId) {
        return;
      }

      setAnalysisLogs((prev) => [
        ...prev,
        isCancelledRef.current ? '🛑 本地扫描分析已停止！' : '✅ 本地扫描分析已完成！'
      ]);
      const finalPhotos = detectDuplicates(updatedPhotos);
      setPhotos(finalPhotos);
      runDuplicateQA(finalPhotos);
      initializeSimilarGroups(finalPhotos);

      // 延时跳转，提供更好的交互感知
      if (!isCancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        // Guard check inside timeout
        if (activeRunIdRef.current !== runId || isCancelledRef.current) {
          return;
        }
        router.push('/results');
      }
    } finally {
      // 统一在 finally 里重置分析状态，且支持并行会话防护
      if (activeRunIdRef.current === runId) {
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
        activeRunIdRef.current = null;
      } else if (activeRunIdRef.current === null) {
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
      }
    }
  };

  // 切换保留/删除状态
  const togglePhotoStatus = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          // 如果是 keep 标为 delete，如果是 delete 标为 keep，如果是 review 标为 keep
          const nextStatus: 'keep' | 'review' | 'delete' = p.status === 'keep' ? 'delete' : 'keep';
          return { ...p, status: nextStatus, userDecision: nextStatus };
        }
        return p;
      })
    );
  };

  // 单张照片状态手动订正
  const updatePhotoStatus = (id: string, status: 'keep' | 'review' | 'delete') => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, userDecision: status } : p))
    );
  };

  // 多张照片状态批量手动订正
  const updateMultiplePhotosStatus = (ids: string[], status: 'keep' | 'review' | 'delete') => {
    setPhotos((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, status, userDecision: status } : p))
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
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('ab_auto_opened');
    }
    isCancelledRef.current = true;
    activeRunIdRef.current = null;
    
    photos.forEach(p => revokeBlobUrl(p.url));
    setPhotos([]);
    setSimilarGroups([]);
    setActiveBattle(null);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
    setAnalysisProgress(0);
    setAnalysisLogs([]);
    setCurrentAnalysisIndex(-1);
    setCurrentAnalysisName('');
    setProjectName('');
    setSkippedCount(0);
    setFailedCount(0);
    setNativeSourceMode(null);
  };

  // 载入演示图片数据包
  const loadDemoPhotos = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('ab_auto_opened');
    }
    photos.forEach(p => revokeBlobUrl(p.url));

    // 重置所有分析和 Battle 相关状态
    setNativeSourceMode(null);
    setAnalysisProgress(0);
    setAnalysisLogs([]);
    setCurrentAnalysisIndex(-1);
    setCurrentAnalysisName('');
    setSimilarGroups([]);
    setActiveBattle(null);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
    setProjectName('演示旅行照片项目');
    setSkippedCount(0);
    setFailedCount(0);

    const processed = detectDuplicates(MOCK_TRAVEL_PHOTOS);
    setPhotos(processed);
    runDuplicateQA(processed);
    initializeSimilarGroups(processed);
  };

  const identifyNativeSimilarGroups = () => {
    const originalPhotosMap = new Map(photos.map(p => [p.id, {
      status: p.status,
      suggestedStatus: p.suggestedStatus,
      displayLabel: p.displayLabel,
      reasonLabel: p.reasonLabel
    }]));

    const processed = detectDuplicates(photos);

    const nativeProcessed = processed.map(p => {
      const orig = originalPhotosMap.get(p.id);
      if (orig) {
        return {
          ...p,
          status: orig.status,
          suggestedStatus: orig.suggestedStatus,
          displayLabel: orig.displayLabel,
          reasonLabel: orig.reasonLabel
        };
      }
      return p;
    });

    setPhotos(nativeProcessed);
    initializeSimilarGroups(nativeProcessed);
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
        analysisMode,
        projectName,
        setProjectName,
        setAnalysisMode,
        uploadFiles,
        startAnalysis,
        togglePhotoStatus,
        updatePhotoStatus,
        updateMultiplePhotosStatus,
        deletePhoto,
        deleteSuggestedPhotos,
        resetWorkspace,
        loadDemoPhotos,
        startNativeFolderAnalysis,
        nativeSourceMode,
        identifyNativeSimilarGroups,
        skippedCount,
        failedCount,
        isNativeProcessingCancelled,
        cancelNativeProcessing,
        resetNativeProcessingCancelState,
        similarGroups,
        activeBattle,
        startBattleForGroup,
        applyBattleDecision,
        resetBattleForGroup,
        closeBattle,
        duplicateSignalResult,
        // =========================================================================
        // CRITICAL DEV-ONLY QA WARNING:
        // - duplicateGroupQA is strictly a Dev-only QA field for regression testing.
        // - DO NOT under any circumstances use this field to drive UI, Results page,
        //   Photo Battle flow, ZIP export, or user-visible decisions.
        // =========================================================================
        duplicateGroupQA
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
