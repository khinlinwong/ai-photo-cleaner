import { isTauriRuntime } from './tauriEnvironment';
import { PhysicalOrgDryRunRequest, PhysicalOrgDryRunResult, PhysicalOrgExecutionResult } from './physicalOrgTypes';

/**
 * Opens folder picker, saves path in Rust, returns desensitized token & display label.
 */
export async function selectPhysicalOrgOutputFolder(): Promise<[string, string] | null> {
  if (!isTauriRuntime()) {
    console.warn('[PhysicalOrgBridge] selectPhysicalOrgOutputFolder is only available in Tauri runtime.');
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<[string, string]>('select_physical_org_output_folder');
    return result;
  } catch {
    console.error('[PhysicalOrgBridge] Failed to select output folder.');
    return null;
  }
}

/**
 * Creates desensitized dry-run plan on Rust side.
 */
export async function createPhysicalOrgDryRun(
  request: PhysicalOrgDryRunRequest
): Promise<PhysicalOrgDryRunResult | null> {
  if (!isTauriRuntime()) {
    console.warn('[PhysicalOrgBridge] createPhysicalOrgDryRun is only available in Tauri runtime.');
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<PhysicalOrgDryRunResult>('create_physical_org_dry_run', {
      request,
    });
    return result;
  } catch {
    console.error('[PhysicalOrgBridge] Failed to generate dry-run plan.');
    return null;
  }
}

/**
 * Executes copy-only operation for a dry-run plan on Rust side.
 */
export async function executePhysicalOrgCopy(planId: string): Promise<PhysicalOrgExecutionResult | null> {
  if (!isTauriRuntime()) {
    console.warn('[PhysicalOrgBridge] executePhysicalOrgCopy is only available in Tauri runtime.');
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<PhysicalOrgExecutionResult>('execute_physical_org_copy', {
      planId,
    });
    return result;
  } catch {
    console.error('[PhysicalOrgBridge] Failed to execute physical organization copy.');
    return null;
  }
}

/**
 * Clears desensitized session mapping on Rust side.
 */
export async function clearPhysicalOrgSession(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<void>('clear_physical_org_session');
    return true;
  } catch {
    console.error('[PhysicalOrgBridge] Failed to clear physical org session.');
    return false;
  }
}

export interface KeepCopySummary {
  copiedCount: number;
  skippedCount: number;
  failedCount: number;
  targetFolderName: string;
  errors: string[];
}

/**
 * Copies keep-only photos to the selected target folder.
 */
export async function copyKeepPhotosToFolder(
  outputFolderToken: string,
  keepPhotoIds: string[]
): Promise<KeepCopySummary | null> {
  if (!isTauriRuntime()) {
    console.warn('[PhysicalOrgBridge] copyKeepPhotosToFolder is only available in Tauri runtime.');
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<KeepCopySummary>('copy_keep_photos_to_folder', {
      outputFolderToken,
      keepPhotoIds,
    });
    return result;
  } catch (err) {
    console.error('[PhysicalOrgBridge] Failed to execute copyKeepPhotosToFolder.', err);
    throw err;
  }
}

