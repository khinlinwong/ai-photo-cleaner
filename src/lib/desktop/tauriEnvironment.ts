/**
 * Safely checks if the current runtime is inside the Tauri desktop shell.
 * This is designed to be SSR-safe (runs on server side during build without crashing)
 * and client-safe (runs in standard web browsers without crashing).
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  // Tauri 2.0 injects __TAURI_INTERNALS__ on the window object
  return '__TAURI_INTERNALS__' in window;
}
