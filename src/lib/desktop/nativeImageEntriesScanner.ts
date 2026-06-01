import { isTauriRuntime } from './tauriEnvironment';

export type NativeImageEntry = {
  id: string;
  basename: string;
  extension: string;
  sizeBytes: number;
};

export type NativeImageEntriesScanResult = {
  folderName: string;
  totalEntries: number;
  totalSizeBytes: number;
  entries: NativeImageEntry[];
};

interface RustNativeImageEntry {
  id: string;
  basename: string;
  extension: string;
  size_bytes: number;
}

interface RustNativeImageEntriesScanResult {
  folder_name: string;
  total_entries: number;
  total_size_bytes: number;
  entries: RustNativeImageEntry[];
}

/**
 * Invokes the Tauri custom Rust command 'scan_folder_image_entries' to scan the
 * first level of image files in the folder securely without reading their contents.
 * Safe to call on Web (returns null) and uses dynamic imports to protect Web build.
 */
export async function scanNativeFolderImageEntries(
  folderPath: string
): Promise<NativeImageEntriesScanResult | null> {
  if (!isTauriRuntime()) {
    console.warn('[NativeBridge] scanNativeFolderImageEntries is only available in Tauri runtime.');
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // Invoke the custom Rust command
    const result = await invoke<RustNativeImageEntriesScanResult>('scan_folder_image_entries', {
      folderPath,
    });

    if (result) {
      return {
        folderName: result.folder_name,
        totalEntries: result.total_entries,
        totalSizeBytes: result.total_size_bytes,
        entries: result.entries.map(entry => ({
          id: entry.id,
          basename: entry.basename,
          extension: entry.extension,
          sizeBytes: entry.size_bytes,
        })),
      };
    }

    return null;
  } catch (err) {
    console.error('[NativeBridge] Error scanning image entries:', err);
    return null;
  }
}
