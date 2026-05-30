export interface LocalProjectSummary {
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  keepCount: number;
  cullCount: number;
  similarGroupCount: number;
  battleCompleted: number;
  battleTotal: number;
  fileFingerprints?: LocalProjectFileFingerprint[];
}

export interface LocalProjectFileFingerprint {
  name: string;
  size: number;
  lastModified: number;
  type?: string;
}
