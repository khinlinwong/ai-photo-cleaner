export type PhysicalOrgTargetBucket = "keep" | "cull-candidate";

export interface PhysicalOrgPlanItem {
  photoId: string;
  displayName: string;
  targetBucket: PhysicalOrgTargetBucket;
  targetRelativePath: string;
  status: "planned" | "skipped" | "failed";
  reason?: string;
}

export interface PhysicalOrgDryRunRequest {
  outputFolderToken: string;
  items: {
    photoId: string;
    displayName: string;
    targetBucket: PhysicalOrgTargetBucket;
  }[];
}

export interface PhysicalOrgDryRunResult {
  planId: string;
  outputDisplayLabel: string;
  totalItems: number;
  keepCount: number;
  cullCandidateCount: number;
  skippedCount: number;
  conflictCount: number;
  estimatedBytes?: number;
  canProceed: boolean;
  warnings: string[];
  items: PhysicalOrgPlanItem[];
}
