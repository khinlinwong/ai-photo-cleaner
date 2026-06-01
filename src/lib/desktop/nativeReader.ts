import { isTauriRuntime } from './tauriEnvironment';
import { NativeImagePreviewItem } from './nativeImagePreviewScanner';
import { analyzeImageFromBlob } from '../imageAnalysis';

/**
 * Invokes the Tauri custom Rust command 'read_native_preview_bytes' to read the
 * raw binary content of a file in the active folder via its opaque ID.
 * Safe to call on Web (returns null) and uses dynamic imports to protect Web build.
 */
export async function readNativePreviewBytes(id: string): Promise<Uint8Array | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<number[]>('read_native_preview_bytes', { id });
    if (bytes) {
      return new Uint8Array(bytes);
    }
    return null;
  } catch (err) {
    // Avoid console output of paths or files. Log abstract error.
    console.error('[NativeBridge] Failed to read native preview bytes:', err);
    return null;
  }
}

interface SampleValidationResult {
  analyzedCount: number;
  skippedUnsupportedCount: number;
  failedCount: number;
}

/**
 * Performs sequential (serial queue) validation of up to 5 preview items.
 * Skips HEIC/HEIF based on extensions, reads binary contents via opaque IDs,
 * converts to Blob, and runs quality diagnostics.
 * Safe to run, no leaks, no UI or state pollution.
 */
export async function analyzeNativePreviewSample(
  items: NativeImagePreviewItem[]
): Promise<SampleValidationResult> {
  const result: SampleValidationResult = {
    analyzedCount: 0,
    skippedUnsupportedCount: 0,
    failedCount: 0,
  };

  if (!isTauriRuntime() || !items || items.length === 0) {
    return result;
  }

  // Take at most 5 items for MVP verification
  const sampleItems = items.slice(0, 5);

  for (const item of sampleItems) {
    const ext = (item.extension || '').toLowerCase();

    // Skip HEIC/HEIF formats in this MVP
    if (ext === 'heic' || ext === 'heif') {
      result.skippedUnsupportedCount += 1;
      continue;
    }

    try {
      // 1. Read bytes sequentially (queue depth = 1)
      const bytes = await readNativePreviewBytes(item.id);
      if (!bytes) {
        result.failedCount += 1;
        continue;
      }

      // 2. Wrap bytes in Blob
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });

      // 3. Perform canvas analysis
      // Note: analyzeImageFromBlob handles ObjectURL creation and revocation internally
      const analysis = await analyzeImageFromBlob(blob);

      if (analysis && typeof analysis.qualityScore === 'number') {
        result.analyzedCount += 1;
      } else {
        result.failedCount += 1;
      }
    } catch {
      result.failedCount += 1;
    }
  }

  // Print abstract verification summary only. No filenames or paths.
  console.log('[NativeBridge] Native reader sample completed.', {
    analyzedCount: result.analyzedCount,
    skippedUnsupportedCount: result.skippedUnsupportedCount,
    failedCount: result.failedCount,
  });

  return result;
}
