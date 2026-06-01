import { isTauriRuntime } from './tauriEnvironment';

export type NativeFolderMetadataSummary = {
  folderName: string;
  totalFiles: number;
  imageFilesCount: number;
  unsupportedFilesCount: number;
  totalSizeBytes: number;
};

interface RustFolderMetadataSummary {
  folder_name: string;
  total_files: number;
  image_files_count: number;
  unsupported_files_count: number;
  total_size_bytes: number;
}

/**
 * Invokes the Tauri custom Rust command 'scan_folder_metadata' to scan the
 * first level of files in the folder securely without reading their contents.
 * Safe to call on Web (returns null) and uses dynamic imports to protect Web build.
 */
export async function scanNativeFolderMetadata(
  folderPath: string
): Promise<NativeFolderMetadataSummary | null> {
  if (!isTauriRuntime()) {
    console.warn('[NativeBridge] scanNativeFolderMetadata is only available in Tauri runtime.');
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // Invoke the custom Rust command
    const summary = await invoke<RustFolderMetadataSummary>('scan_folder_metadata', {
      folderPath,
    });

    if (summary) {
      return {
        folderName: summary.folder_name,
        totalFiles: summary.total_files,
        imageFilesCount: summary.image_files_count,
        unsupportedFilesCount: summary.unsupported_files_count,
        totalSizeBytes: summary.total_size_bytes,
      };
    }

    return null;
  } catch (err) {
    console.error('[NativeBridge] Error scanning folder metadata:', err);
    return null;
  }
}
