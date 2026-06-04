/**
 * 本地相似与重复照片检测算法 (dHash)
 */

export interface DuplicatePhotoInput {
  id: string;
  score: number;
  sharpnessScore: number;
  perceptualHash?: string;
  status: 'keep' | 'review' | 'delete';
  duplicateGroupId?: string | null;
  duplicateScore?: number;
  isDuplicateCandidate?: boolean;
  duplicateRecommendation?: 'keep' | 'review' | 'delete';
  technicalRiskFlags?: ('possible_blur' | 'possible_motion_blur' | 'exposure_risk' | 'low_information' | 'duplicate_candidate' | 'severe_quality_issue')[];
  confidence?: 'high' | 'medium' | 'low';
  suggestedStatus?: 'keep' | 'review' | 'delete';
  displayLabel?: '技术风险低' | '建议复核' | '淘汰候选';
  reasonLabel?: string;
  userDecision?: 'keep' | 'review' | 'delete';
  resolution?: string;
}

/**
 * 辅助方法：解析 "width × height" 格式的分辨率并计算宽高比
 */
function parseAspectRatio(resolution?: string): number | null {
  if (!resolution) return null;
  const match = resolution.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (match) {
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    if (width > 0 && height > 0) {
      return width / height;
    }
  }
  return null;
}

/**
 * 从 300px 灰度图像中下采样到 9x8 并计算 dHash (差异哈希)
 * 产生 64 位哈希（16 字符的 16 进制字符串）
 */
export function calculateDHashFromGray(gray: Uint8ClampedArray, width: number, height: number): string {
  // 下采样至 9 列 x 8 行的灰度数组
  const grid = new Float32Array(9 * 8);
  
  for (let r = 0; r < 8; r++) {
    const yStart = Math.floor((r * height) / 8);
    const yEnd = Math.max(yStart + 1, Math.floor(((r + 1) * height) / 8));
    
    for (let c = 0; c < 9; c++) {
      const xStart = Math.floor((c * width) / 9);
      const xEnd = Math.max(xStart + 1, Math.floor(((c + 1) * width) / 9));
      
      let sum = 0;
      let count = 0;
      for (let y = yStart; y < yEnd && y < height; y++) {
        for (let x = xStart; x < xEnd && x < width; x++) {
          sum += gray[y * width + x];
          count++;
        }
      }
      grid[r * 9 + c] = count > 0 ? sum / count : 0;
    }
  }
  
  // 计算水平相邻差值，生成 8 字节的哈希值
  let hashStr = '';
  for (let r = 0; r < 8; r++) {
    let byteVal = 0;
    for (let c = 0; c < 8; c++) {
      const left = grid[r * 9 + c];
      const right = grid[r * 9 + c + 1];
      if (left > right) {
        byteVal |= (1 << (7 - c));
      }
    }
    hashStr += byteVal.toString(16).padStart(2, '0');
  }
  
  return hashStr;
}

/**
 * 计算两个十六进制 dHash 字符串之间的汉明距离
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return 64; // 最大不匹配距离
  }
  
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const hex1 = parseInt(hash1[i], 16);
    const hex2 = parseInt(hash2[i], 16);
    if (isNaN(hex1) || isNaN(hex2)) {
      continue;
    }
    let xor = hex1 ^ hex2;
    // 统计 1 的个数
    while (xor > 0) {
      if (xor & 1) {
        distance++;
      }
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * 使用连通分量算法对照片列表进行相似图分组 (Hamming 距离 <= 10)
 * 并自动分配推荐保留/删除状态
 */
export function detectDuplicates<T extends DuplicatePhotoInput>(photos: T[]): T[] {
  if (!Array.isArray(photos)) return [];
  // 只对存在有效 perceptualHash 的相片建立相似关系，并过滤 null/undefined
  const validPhotos = photos.filter(p => p && p.perceptualHash && typeof p.perceptualHash === 'string' && p.perceptualHash.length > 0);
  
  // 建立图的邻接表
  const adj: { [id: string]: string[] } = {};
  validPhotos.forEach(p => {
    adj[p.id] = [];
  });
  
  for (let i = 0; i < validPhotos.length; i++) {
    for (let j = i + 1; j < validPhotos.length; j++) {
      const p1 = validPhotos[i];
      const p2 = validPhotos[j];
      if (p1.perceptualHash && p2.perceptualHash) {
        const dist = calculateHammingDistance(p1.perceptualHash, p2.perceptualHash);
        // Hamming 距离 <= 15 判定为相似，且宽高比相对偏差不超过 5%
        if (dist <= 15) {
          let aspectMatch = true;
          const r1 = parseAspectRatio(p1.resolution);
          const r2 = parseAspectRatio(p2.resolution);
          if (r1 !== null && r2 !== null) {
            const diff = Math.abs(r1 - r2);
            if (diff > 0.08 * r1) {
              aspectMatch = false;
            }
          }
          if (aspectMatch) {
            adj[p1.id].push(p2.id);
            adj[p2.id].push(p1.id);
          }
        }
      }
    }
  }
  
  // 使用 BFS/DFS 搜索连通分量进行分组
  const visited = new Set<string>();
  const groups: string[][] = [];
  
  validPhotos.forEach(p => {
    if (!visited.has(p.id)) {
      const component: string[] = [];
      const queue = [p.id];
      visited.add(p.id);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);
        
        adj[current].forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
      
      // 只有包含 2 张及以上相片的集合才算相似分组
      if (component.length > 1) {
        groups.push(component);
      }
    }
  });
  
  // 用于记录每张相片的分组映射结果
  const photoGroupMap = new Map<string, { groupId: string; groupLeaderId: string }>();
  
  groups.forEach((group, index) => {
    const groupId = `group-${index + 1}`;
    
    // 在本组中挑选最优质的照片做组长 (Leader)
    // 比较规则：综合得分 score -> 清晰度 sharpnessScore -> 字典序 id
    let bestPhotoId = group[0];
    let maxScore = -1;
    let maxSharpness = -1;
    
    group.forEach(id => {
      const item = photos.find(p => p.id === id)!;
      const score = item.score ?? 0;
      const sharpness = item.sharpnessScore ?? 0;
      
      if (score > maxScore) {
        maxScore = score;
        maxSharpness = sharpness;
        bestPhotoId = id;
      } else if (score === maxScore) {
        if (sharpness > maxSharpness) {
          maxSharpness = sharpness;
          bestPhotoId = id;
        } else if (sharpness === maxSharpness) {
          if (id < bestPhotoId) {
            bestPhotoId = id;
          }
        }
      }
    });
    
    group.forEach(id => {
      photoGroupMap.set(id, {
        groupId,
        groupLeaderId: bestPhotoId
      });
    });
  });
  
  // 更新并返回带有相似指标的相片列表
  return photos.map(photo => {
    const groupInfo = photoGroupMap.get(photo.id);
    if (!groupInfo) {
      // 不在相似组中，重置相关相似属性
      return {
        ...photo,
        duplicateGroupId: null,
        duplicateScore: undefined,
        isDuplicateCandidate: false,
        duplicateRecommendation: undefined
      };
    }
    
    const isLeader = photo.id === groupInfo.groupLeaderId;
    
    // 计算与组长照片的相似度百分比
    let distance = 0;
    const leaderPhoto = photos.find(p => p.id === groupInfo.groupLeaderId);
    if (leaderPhoto && photo.perceptualHash && leaderPhoto.perceptualHash) {
      distance = calculateHammingDistance(photo.perceptualHash, leaderPhoto.perceptualHash);
    }
    
    const duplicateScore = Math.round((1 - distance / 64) * 100);
    
    let recommendation: 'keep' | 'review' | 'delete';
    
    if (isLeader) {
      recommendation = 'keep';
    } else {
      // 距离 <= 5 为高度相似照片，推荐删除以节约空间；距离 6-10 推荐复核
      if (distance <= 5) {
        recommendation = 'delete';
      } else {
        recommendation = 'review';
      }
    }
    
    // 保护与决策逻辑：
    // 1. 如果是非 Leader，属于相似组备选，technicalRiskFlags 里新增 'duplicate_candidate'
    const newFlags = [...(photo.technicalRiskFlags || [])];
    if (!isLeader && !newFlags.includes('duplicate_candidate')) {
      newFlags.push('duplicate_candidate');
    }

    // 2. 判定最终的 suggestedStatus / status
    //    - 优先采用用户做出的手动决策 (photo.userDecision)
    //    - 如果没有手动决策，则由算法推荐：
    //      - 如果照片本身有严重技术风险（原始状态为 delete，或含有 severe_quality_issue），保持 delete 状态
    //      - 其他相似备选照片（非 leader），最多建议复核（status = 'review'）
    //      - 相似组组长（leader），保持其原始质量诊断状态
    let finalStatus = photo.userDecision ?? photo.status;
    if (photo.userDecision === undefined) {
      if (!isLeader) {
        if (photo.status === 'delete' || newFlags.includes('severe_quality_issue')) {
          finalStatus = 'delete';
        } else {
          finalStatus = 'review';
        }
      } else {
        finalStatus = photo.status;
      }
    }

    // 3. 重新校准 displayLabel 和 reasonLabel
    let displayLabel: '技术风险低' | '建议复核' | '淘汰候选' = '技术风险低';
    if (finalStatus === 'delete') {
      displayLabel = '淘汰候选';
    } else if (finalStatus === 'review') {
      displayLabel = '建议复核';
    } else {
      displayLabel = '技术风险低';
    }

    let reasonLabel = photo.reasonLabel || '未发现明显技术问题';
    if (finalStatus === 'delete') {
      reasonLabel = '检测到明显技术风险，建议淘汰候选';
    } else if (!isLeader) {
      reasonLabel = '属于相似照片组，相似备选';
    } else {
      reasonLabel = '属于相似照片组，已自动推荐保留最佳照片';
    }

    return {
      ...photo,
      duplicateGroupId: groupInfo.groupId,
      duplicateScore,
      isDuplicateCandidate: !isLeader,
      duplicateRecommendation: recommendation,
      technicalRiskFlags: newFlags,
      status: finalStatus,
      suggestedStatus: finalStatus,
      displayLabel,
      reasonLabel
    };
  });
}

export type SimilarityMethod = "dHash" | "pHash" | "aHash" | "mixed";

export type DuplicateSignalInput = {
  id: string;
  perceptualHash?: string;
  sharpnessScore?: number;
  qualityScore?: number;
  resolution?: string;
};

export type SimilarityGroupSignal = {
  groupId: string;
  photoIds: string[];
  leaderId?: string;
  averageDistance?: number;
  minDistance?: number;
  maxDistance?: number;
  method: SimilarityMethod;
};

export type DuplicateAnalysisResult = {
  groups: SimilarityGroupSignal[];
  photoToGroup: Record<string, string>;
};

export function buildDuplicateSignals(
  photos: DuplicateSignalInput[]
): DuplicateAnalysisResult {
  if (!Array.isArray(photos)) return { groups: [], photoToGroup: {} };
  const validPhotos = photos.filter(p => p && p.perceptualHash && typeof p.perceptualHash === 'string' && p.perceptualHash.length > 0);
  
  // 建立图的邻接表
  const adj: { [id: string]: string[] } = {};
  validPhotos.forEach(p => {
    adj[p.id] = [];
  });
  
  for (let i = 0; i < validPhotos.length; i++) {
    for (let j = i + 1; j < validPhotos.length; j++) {
      const p1 = validPhotos[i];
      const p2 = validPhotos[j];
      if (p1.perceptualHash && p2.perceptualHash) {
        const dist = calculateHammingDistance(p1.perceptualHash, p2.perceptualHash);
        // Hamming 距离 <= 15 判定为相似，且宽高比相对偏差不超过 5%
        if (dist <= 15) {
          let aspectMatch = true;
          const r1 = parseAspectRatio(p1.resolution);
          const r2 = parseAspectRatio(p2.resolution);
          if (r1 !== null && r2 !== null) {
            const diff = Math.abs(r1 - r2);
            if (diff > 0.08 * r1) {
              aspectMatch = false;
            }
          }
          if (aspectMatch) {
            adj[p1.id].push(p2.id);
            adj[p2.id].push(p1.id);
          }
        }
      }
    }
  }
  
  // 使用 BFS/DFS 搜索连通分量进行分组
  const visited = new Set<string>();
  const groups: string[][] = [];
  
  validPhotos.forEach(p => {
    if (!visited.has(p.id)) {
      const component: string[] = [];
      const queue = [p.id];
      visited.add(p.id);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);
        
        adj[current].forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
      
      // 只有包含 2 张及以上相片的集合才算相似分组
      if (component.length > 1) {
        groups.push(component);
      }
    }
  });

  const groupSignals: SimilarityGroupSignal[] = [];
  const photoToGroup: Record<string, string> = {};

  groups.forEach((group, index) => {
    const groupId = `group-${index + 1}`;
    
    // 在本组中挑选最优质的照片做组长 (Leader)
    // 比较规则：综合得分 qualityScore -> 清晰度 sharpnessScore -> 字典序 id
    let bestPhotoId = group[0];
    let maxScore = -1;
    let maxSharpness = -1;
    
    group.forEach(id => {
      const item = photos.find(p => p.id === id)!;
      const score = item.qualityScore ?? 0;
      const sharpness = item.sharpnessScore ?? 0;
      
      if (score > maxScore) {
        maxScore = score;
        maxSharpness = sharpness;
        bestPhotoId = id;
      } else if (score === maxScore) {
        if (sharpness > maxSharpness) {
          maxSharpness = sharpness;
          bestPhotoId = id;
        } else if (sharpness === maxSharpness) {
          if (id < bestPhotoId) {
            bestPhotoId = id;
          }
        }
      }
    });

    // 计算哈希距离统计
    let totalDist = 0;
    let count = 0;
    let minDist = 64;
    let maxDist = 0;

    for (let i = 0; i < group.length; i++) {
      const p1 = photos.find(p => p.id === group[i])!;
      for (let j = i + 1; j < group.length; j++) {
        const p2 = photos.find(p => p.id === group[j])!;
        if (p1.perceptualHash && p2.perceptualHash) {
          const dist = calculateHammingDistance(p1.perceptualHash, p2.perceptualHash);
          totalDist += dist;
          count++;
          if (dist < minDist) minDist = dist;
          if (dist > maxDist) maxDist = dist;
        }
      }
    }

    groupSignals.push({
      groupId,
      photoIds: group,
      leaderId: bestPhotoId,
      averageDistance: count > 0 ? totalDist / count : 0,
      minDistance: count > 0 ? minDist : 0,
      maxDistance: count > 0 ? maxDist : 0,
      method: "dHash"
    });

    group.forEach(id => {
      photoToGroup[id] = groupId;
    });
  });

  return {
    groups: groupSignals,
    photoToGroup
  };
}

/**
 * QA-only compatibility shape.
 * This is only used to compare signal-derived groups with legacy similarGroups.
 * Do not use this type to drive UI, Photo Battle, ZIP export, or user-visible decisions.
 */
export interface QASimilarGroupSignalForBattle {
  id: string;
  photoIds: string[];
  recommendedPhotoIds: string[];
  backupPhotoIds: string[];
  cullCandidateIds: string[];
  undecidedPhotoIds: string[];
  battleCompleted: boolean;
}

/**
 * QA-only pure converter from DuplicateAnalysisResult to a battle-like group shape.
 * This does not drive the real Photo Battle flow.
 * The legacy detectDuplicates + initializeSimilarGroups path remains the source of truth.
 * This is a pure function that does not modify photos, status, displayLabel or reasonLabel,
 * and does not use Date.now(), Math.random(), console, DOM, or React/Context.
 */
export function buildSimilarGroupsFromSignals(
  duplicateResult: DuplicateAnalysisResult
): QASimilarGroupSignalForBattle[] {
  return duplicateResult.groups
    .filter(g => g.photoIds.length >= 2)
    .map(g => {
      const leaderId = g.leaderId || g.photoIds[0];
      return {
        id: g.groupId,
        photoIds: g.photoIds,
        recommendedPhotoIds: [leaderId],
        backupPhotoIds: g.photoIds.filter(id => id !== leaderId),
        cullCandidateIds: [],
        undecidedPhotoIds: g.photoIds,
        battleCompleted: false
      };
    });
}

export interface SimilarGroupCompatible {
  id: string;
  photoIds: string[];
  recommendedPhotoIds: string[];
  backupPhotoIds: string[];
  cullCandidateIds: string[];
  undecidedPhotoIds: string[];
  battleCompleted: boolean;
  battleUpdatedAt: number;
}

/**
 * Adapter function that maps QASimilarGroupSignalForBattle[] to the full SimilarGroupCompatible shape,
 * filling in the battleUpdatedAt field with a timestamp provided by the caller.
 * This is a pure function that does not use Date.now() internally.
 */
export function adaptSignalGroupsToLegacySimilarGroups(
  groups: QASimilarGroupSignalForBattle[],
  battleUpdatedAt: number
): SimilarGroupCompatible[] {
  return groups.map(group => ({
    id: group.id,
    photoIds: [...group.photoIds],
    recommendedPhotoIds: [...group.recommendedPhotoIds],
    backupPhotoIds: [...group.backupPhotoIds],
    cullCandidateIds: [...group.cullCandidateIds],
    undecidedPhotoIds: [...group.undecidedPhotoIds],
    battleCompleted: group.battleCompleted,
    battleUpdatedAt: battleUpdatedAt
  }));
}


