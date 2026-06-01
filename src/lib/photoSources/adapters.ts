import {
  BrowserFileSourceRecord,
  NativeFolderPreviewSourceRecord,
  ImagePreviewRecord,
  ImageSourceRecord,
} from './types';

/**
 * Creates a BrowserFileSourceRecord from File input.
 * Safe to construct, does not perform read operations.
 */
export function createBrowserFileSourceRecord(
  id: string,
  file: File,
  objectUrl: string
): BrowserFileSourceRecord {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return {
    sourceType: "browser-file",
    id,
    file,
    objectUrl,
    sizeBytes: file.size,
    mimeType: file.type,
    extension,
  };
}

/**
 * Creates a NativeFolderPreviewSourceRecord from opaque properties.
 * Safe to construct, no file reads.
 */
export function createNativePreviewSourceRecord(
  id: string,
  previewUrl: string,
  sizeBytes: number,
  extension: string
): NativeFolderPreviewSourceRecord {
  return {
    sourceType: "native-folder-preview",
    id,
    previewUrl,
    sizeBytes,
    extension: extension.toLowerCase(),
  };
}

/**
 * Formats a generic ImageSourceRecord to a standardized ImagePreviewRecord.
 * Safe to use for UI adapter binding, completely isolated.
 */
export function toImagePreviewRecord(
  record: ImageSourceRecord
): ImagePreviewRecord {
  if (record.sourceType === "browser-file") {
    return {
      id: `preview-${record.id}`,
      sourceId: record.id,
      src: record.objectUrl,
      sourceType: record.sourceType,
      sizeBytes: record.sizeBytes,
      extension: record.extension,
    };
  } else if (record.sourceType === "native-folder-preview") {
    return {
      id: `preview-${record.id}`,
      sourceId: record.id,
      src: record.previewUrl,
      sourceType: record.sourceType,
      sizeBytes: record.sizeBytes,
      extension: record.extension,
    };
  } else {
    return {
      id: `preview-${record.id}`,
      sourceId: record.id,
      src: record.previewUrl || '',
      sourceType: record.sourceType,
      sizeBytes: record.sizeBytes,
      extension: record.extension,
    };
  }
}
