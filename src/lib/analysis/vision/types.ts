export type AnalysisMode = 'local' | 'vision-pro';

export interface VisionAnalysisResult {
  aestheticScore: number;
  subjectFocus: string;
  shakeDetected: boolean;
  aestheticDetails: string;
  portraitQuality: string;
  suggestions: string[];
}

export interface AnalyzedPhotoResult {
  width: number;
  height: number;
  averageBrightness: number;
  highlightRatio: number;
  shadowRatio: number;
  sharpnessScore: number;
  exposureScore: number;
  qualityScore: number;
  issue: 'good' | 'blurry' | 'overexposed' | 'underexposed' | 'needs_review';
  status: 'keep' | 'review' | 'delete';
  focusStatus:
    | 'Excellent / Share-ready'
    | 'Acceptable / Casual use'
    | 'Soft Focus Detected'
    | 'Directional Blur Detected'
    | 'Motion Blur Detected'
    | 'Edge Smear Detected'
    | 'Insufficient Subject Sharpness'
    | 'Not recommended';
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
}

export interface SimilarGroup {
  id: string;
  photoIds: string[];
  recommendedPhotoIds: string[];
  backupPhotoIds: string[];
  cullCandidateIds: string[];
  undecidedPhotoIds: string[];
  battleCompleted: boolean;
  battleUpdatedAt: number;
}

export interface BattlePair {
  groupId: string;
  leftPhotoId: string;
  rightPhotoId: string;
  roundIndex: number;
}

export interface BattleDecision {
  groupId: string;
  leftPhotoId: string;
  rightPhotoId: string;
  decision: 'keep_left' | 'keep_right' | 'keep_both' | 'cull_both' | 'skip';
  createdAt: number;
}

export interface BattleResult {
  groupId: string;
  recommendedKeepIds: string[];
  similarBackupIds: string[];
  cullCandidateIds: string[];
  undecidedIds: string[];
}
