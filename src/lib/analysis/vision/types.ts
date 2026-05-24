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
}
