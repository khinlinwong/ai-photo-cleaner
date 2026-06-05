import { isTauriRuntime } from './tauriEnvironment';
import { getEffectiveNativeBatchLimit } from './nativeBatchLimit';

export type NativeImagePreviewItem = {
  id: string;
  previewUrl: string;
  extension: string;
  sizeBytes: number;
};

export type NativeImagePreviewScanResult = {
  totalPreviewItems: number;
  previewLimit: number;
  items: NativeImagePreviewItem[];
};

interface RustNativeImagePreviewItem {
  id: string;
  preview_url: string;
  extension: string;
  size_bytes: number;
}

interface RustNativeImagePreviewScanResult {
  total_preview_items: number;
  preview_limit: number;
  items: RustNativeImagePreviewItem[];
}

/**
 * Invokes the Tauri custom Rust command 'scan_selected_image_files' to process the
 * user-selected image paths and return secure desensitized preview items.
 * Safe to call on Web (returns null) and uses dynamic imports to protect Web build.
 */
export async function scanNativeSelectedImageFiles(
  filePaths: string[]
): Promise<NativeImagePreviewScanResult | null> {
  if (!isTauriRuntime()) {
    console.warn('[NativeBridge] scanNativeSelectedImageFiles is only available in Tauri runtime.');
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    const result = await invoke<RustNativeImagePreviewScanResult>('scan_selected_image_files', {
      filePaths,
      limit: getEffectiveNativeBatchLimit(),
    });

    if (result && result.items) {
      return {
        totalPreviewItems: result.total_preview_items,
        previewLimit: result.preview_limit,
        items: result.items.map(item => ({
          id: item.id,
          previewUrl: item.preview_url,
          extension: item.extension,
          sizeBytes: item.size_bytes,
        })),
      };
    }

    return null;
  } catch (err) {
    console.error('[NativeBridge] Error scanning selected image files:', err);
    return null;
  }
}
