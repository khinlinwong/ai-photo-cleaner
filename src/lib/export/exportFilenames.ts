/**
 * Filename helpers for exporting photos and manifests cleanly in Next.js/Browser environment.
 * These are pure functions and do not access window, document, localStorage, or React states.
 */

/**
 * Clean project names to be safe for filenames:
 * - trim, lowercase
 * - replace spaces/special chars with hyphens
 * - deduplicate hyphens and trim boundaries
 * - limit length to 48 characters
 * - fallback to 'local-project'
 */
export function sanitizeFilenamePart(input: string): string {
  if (!input) return 'local-project';
  
  let cleaned = input.trim().toLowerCase();
  
  // Replace spaces with hyphens
  cleaned = cleaned.replace(/\s+/g, '-');
  
  // Replace anything that is not a-z, 0-9, hyphen or underscore with hyphens
  cleaned = cleaned.replace(/[^a-z0-9\-_]/g, '-');
  
  // Deduplicate hyphens
  cleaned = cleaned.replace(/-+/g, '-');
  
  // Trim leading and trailing hyphens/underscores
  cleaned = cleaned.replace(/^[_\-]+|[_\-]+$/g, '');
  
  if (!cleaned) return 'local-project';
  
  // Limit to 48 chars
  return cleaned.substring(0, 48);
}

/**
 * Formats date into YYYYMMDD-HHmm format.
 */
export function buildExportTimestamp(date?: Date): string {
  const d = date || new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

/**
 * Returns ZIP export filename.
 */
export function buildZipExportFilename(projectName: string | undefined | null, date?: Date): string {
  const safeName = sanitizeFilenamePart(projectName || '');
  const ts = buildExportTimestamp(date);
  return `ai-photo-cleaner-${safeName}-${ts}.zip`;
}

/**
 * Returns manifest file export filename.
 */
export function buildManifestExportFilename(projectName: string | undefined | null, format: 'csv' | 'json', date?: Date): string {
  const safeName = sanitizeFilenamePart(projectName || '');
  const ts = buildExportTimestamp(date);
  return `ai-photo-cleaner-${safeName}-manifest-${ts}.${format}`;
}
