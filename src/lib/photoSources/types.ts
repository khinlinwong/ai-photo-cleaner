export type ImageSourceType =
  | "browser-file"
  | "native-folder-preview"
  | "native-folder-file";

export interface BrowserFileSourceRecord {
  sourceType: "browser-file";
  id: string;
  file: File; // Browser File object, memory only
  objectUrl: string; // Temporary object URL
  sizeBytes: number;
  mimeType?: string;
  extension?: string;
}

export interface NativeFolderPreviewSourceRecord {
  sourceType: "native-folder-preview";
  id: string; // Opaque preview ID
  previewUrl: string; // Safe preview URL scheme (e.g. preview://localhost/...)
  sizeBytes: number;
  extension: string;
}

export interface NativeFolderFileSourceRecord {
  sourceType: "native-folder-file";
  id: string; // Opaque ID
  previewUrl?: string; // Optional safe preview URL
  sizeBytes: number;
  extension: string;
  /**
   * internalName is for future internal mapping, not displayed, not stored,
   * not exported in manifest, not logged in console.
   */
  internalName?: string;
}

export type ImageSourceRecord =
  | BrowserFileSourceRecord
  | NativeFolderPreviewSourceRecord
  | NativeFolderFileSourceRecord;

export interface ImagePreviewRecord {
  id: string;
  sourceId: string;
  src: string; // Safe preview URL or ObjectURL
  sourceType: ImageSourceType;
  sizeBytes?: number;
  extension?: string;
}

export interface ImageAnalysisRecord {
  id: string;
  sourceId: string;
  sharpnessScore?: number;
  exposureScore?: number;
  score?: number;
  technicalRiskFlags?: string[];
  analyzedAt?: string;
}

export interface PhotoDecisionRecord {
  id: string;
  sourceId: string;
  status: "keep" | "cull"; // Binary classification only (No third category, review/undecided)
  updatedAt?: string;
}

export interface PhotoViewModel {
  id: string;
  sourceId: string;
  src: string; // Used for UI display
  sizeBytes?: number;
  extension?: string;
  status: "keep" | "cull";
  score?: number;
  technicalRiskFlags?: string[];
}
