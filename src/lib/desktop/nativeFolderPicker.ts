import { isTauriRuntime } from './tauriEnvironment';

/**
 * Opens a native system directory selection dialog.
 * Safe to be called on Web (will log warning and return null) and
 * uses dynamic imports to ensure Next.js build is unaffected.
 */
export async function pickNativeImageFolder(): Promise<{ path: string } | null> {
  if (!isTauriRuntime()) {
    console.warn('[NativeBridge] native folder picker is only available in Tauri runtime.');
    return null;
  }

  try {
    // Dynamic import to prevent bundler errors in browser/SSR environments
    const { open } = await import('@tauri-apps/plugin-dialog');
    
    const selected = await open({
      directory: true,
      multiple: false,
    });

    if (typeof selected === 'string') {
      return { path: selected };
    }

    return null;
  } catch (err) {
    console.error('[NativeBridge] Error during directory selection:', err);
    return null;
  }
}
