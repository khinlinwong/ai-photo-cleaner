import { PhotoItem } from '@/context/PhotoWorkspaceContext';
import { getUserVisibleBucket } from '@/lib/utils/photoLabelMapping';

export interface ManifestRow {
  originalName: string;
  visibleBucket: 'keep' | 'cullCandidate';
  fileSize: string;
  fileType: string;
  width: string;
  height: string;
  similarGroupId: string;
  exportedAt: string;
  qualityScore: string;
  sharpnessScore: string;
  exposureScore: string;
  reasonLabel: string;
  localTags: string;
  sourceMode: string;
}

function parseResolution(value: unknown): { width: string; height: string } {
  if (typeof value !== 'string') {
    return { width: '', height: '' };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { width: '', height: '' };
  }

  const match = trimmed.match(/(\d+)\s*[x\u00d7]\s*(\d+)/i);

  if (!match) {
    return { width: '', height: '' };
  }

  return {
    width: match[1] ?? '',
    height: match[2] ?? ''
  };
}

export function buildManifestRows(photos: PhotoItem[]): ManifestRow[] {
  const exportedAt = new Date().toISOString();
  
  return photos.map((photo, i) => {
    const isNative = photo.sourceType === 'native-folder-preview' || photo.sourceType === 'native-folder-file';
    const bucket = getUserVisibleBucket(photo);
    const visibleBucket = bucket === 'cull' ? 'cullCandidate' : 'keep';
    
    const res = parseResolution(photo.resolution);
    
    const fileSize = photo.file?.size ? String(photo.file.size) : (photo.size || '');
    const fileType = photo.file?.type || '';
    
    const localTags = photo.technicalRiskFlags ? photo.technicalRiskFlags.join(';') : '';
 
    let originalName = photo.file?.name || photo.name || '';
    if (isNative) {
      originalName = `Photo-${String(i + 1).padStart(3, '0')}`;
    }

    return {
      originalName,
      visibleBucket,
      fileSize,
      fileType,
      width: res.width,
      height: res.height,
      similarGroupId: photo.duplicateGroupId || '',
      exportedAt,
      qualityScore: photo.score !== undefined ? String(photo.score) : '',
      sharpnessScore: photo.sharpnessScore !== undefined ? String(photo.sharpnessScore) : '',
      exposureScore: photo.exposureScore !== undefined ? String(photo.exposureScore) : '',
      reasonLabel: photo.reasonLabel || '',
      localTags,
      sourceMode: isNative ? 'native-desktop-app' : 'local-browser-prototype'
    };
  });
}

export function buildManifestCsv(rows: ManifestRow[]): string {
  const headers = [
    'originalName',
    'visibleBucket',
    'fileSize',
    'fileType',
    'width',
    'height',
    'similarGroupId',
    'exportedAt',
    'qualityScore',
    'sharpnessScore',
    'exposureScore',
    'reasonLabel',
    'localTags',
    'sourceMode'
  ];
  
  const escapeCsvValue = (val: string): string => {
    const needsQuote = val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r');
    if (needsQuote) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvRows = [headers.join(',')];
  
  rows.forEach(row => {
    const line = [
      escapeCsvValue(row.originalName),
      escapeCsvValue(row.visibleBucket),
      escapeCsvValue(row.fileSize),
      escapeCsvValue(row.fileType),
      escapeCsvValue(row.width),
      escapeCsvValue(row.height),
      escapeCsvValue(row.similarGroupId),
      escapeCsvValue(row.exportedAt),
      escapeCsvValue(row.qualityScore),
      escapeCsvValue(row.sharpnessScore),
      escapeCsvValue(row.exposureScore),
      escapeCsvValue(row.reasonLabel),
      escapeCsvValue(row.localTags),
      escapeCsvValue(row.sourceMode)
    ];
    csvRows.push(line.join(','));
  });

  return '\ufeff' + csvRows.join('\r\n');
}

export function buildManifestJson(rows: ManifestRow[], projectName?: string): string {
  const isAnyNative = rows.some(row => row.sourceMode === 'native-desktop-app');
  const data = {
    metadata: {
      exportedAt: new Date().toISOString(),
      sourceMode: isAnyNative ? 'native-desktop-app' : 'local-browser-prototype',
      projectName: projectName || 'Untitled Project',
      totalCount: rows.length
    },
    rows
  };
  return JSON.stringify(data, null, 2);
}
