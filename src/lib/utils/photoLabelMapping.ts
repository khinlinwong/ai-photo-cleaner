import { getDecisionSuggestion, PhotoDecisionInput } from '@/lib/analysis/decision/photoDecision';

export type PhotoLabelInput = PhotoDecisionInput;

/**
 * 将内部底层照片状态转换为用户可见的分类状态（二值分类：'keep' 或 'cull'）
 */
export const getUserVisibleBucket = (photo: PhotoLabelInput): 'keep' | 'cull' => {
  const suggestion = getDecisionSuggestion(photo);
  if (suggestion.suggestedBucket === 'cullCandidate') {
    return 'cull';
  }
  return 'keep';
};

/**
 * 派生用于 UI 展示的照片归纳原因标签
 */
export const getReasonTags = (photo: PhotoLabelInput): string => {
  const suggestion = getDecisionSuggestion(photo);
  const primaryCode = suggestion.reasonCodes[0];
  switch (primaryCode) {
    case 'userSelected':
      return '用户选择';
    case 'userCulled':
    case 'initialCull':
      return '淘汰候选';
    case 'similarGroup':
      return '相似照片';
    case 'blurRisk':
      return '模糊候选';
    case 'exposureRisk':
      return '曝光异常';
    case 'initialKeep':
    default:
      return '初步保留';
  }
};
