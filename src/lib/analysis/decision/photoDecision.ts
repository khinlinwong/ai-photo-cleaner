export type PhotoDecisionInput = {
  status?: string;
  suggestedStatus?: string;
  duplicateGroupId?: string | null;
  isDuplicate?: boolean;
  userDecision?: string | null;
  issue?: string;
  riskFlags?: {
    blur?: boolean;
    exposure?: boolean;
    similar?: boolean;
  };
  sharpness?: {
    isBlurry?: boolean;
  };
  exposure?: {
    isUnderexposed?: boolean;
    isOverexposed?: boolean;
  };
};

export type SuggestedBucket = "keep" | "cullCandidate" | "needsBattle";

export type DecisionReasonCode =
  | "userSelected"
  | "userCulled"
  | "similarGroup"
  | "blurRisk"
  | "exposureRisk"
  | "initialKeep"
  | "initialCull";

export type DecisionSuggestion = {
  suggestedBucket: SuggestedBucket;
  reasonCodes: DecisionReasonCode[];
  confidence?: "low" | "medium" | "high";
};

export const getDecisionSuggestion = (photo: PhotoDecisionInput): DecisionSuggestion => {
  // 0. userDecision 优先于 status 和 算法建议
  if (photo.userDecision) {
    const ud = photo.userDecision;
    if (ud === 'keep' || ud === 'keepLeft' || ud === 'keepRight' || ud === 'keepBoth' || ud === 'userKeep' || ud === 'selected') {
      return {
        suggestedBucket: 'keep',
        reasonCodes: ['userSelected'],
        confidence: 'high',
      };
    }
    if (ud === 'cull' || ud === 'cullCandidate' || ud === 'delete' || ud === 'cullBoth' || ud === 'userCulled') {
      return {
        suggestedBucket: 'cullCandidate',
        reasonCodes: ['userCulled'],
        confidence: 'high',
      };
    }
    if (ud === 'skip' || ud === 'skipped') {
      return {
        suggestedBucket: 'needsBattle',
        reasonCodes: ['similarGroup'],
        confidence: 'low',
      };
    }
  }

  // 1. 历史状态 status 优先
  if (photo.status === 'keep') {
    return {
      suggestedBucket: 'keep',
      reasonCodes: ['userSelected'],
      confidence: 'high',
    };
  }
  if (photo.status === 'delete' || photo.status === 'cull' || photo.status === 'cullCandidate') {
    return {
      suggestedBucket: 'cullCandidate',
      reasonCodes: ['userCulled'],
      confidence: 'high',
    };
  }

  // 2. 需要 PK
  if (photo.duplicateGroupId || photo.isDuplicate === true) {
    return {
      suggestedBucket: 'needsBattle',
      reasonCodes: ['similarGroup'],
      confidence: 'medium',
    };
  }

  // 3. 风险候选
  const isBlurry = photo.riskFlags?.blur === true || photo.sharpness?.isBlurry === true || photo.issue === 'blurry';
  if (isBlurry) {
    return {
      suggestedBucket: 'cullCandidate',
      reasonCodes: ['blurRisk'],
      confidence: 'medium',
    };
  }

  const isExposureIssue = photo.riskFlags?.exposure === true || 
    photo.exposure?.isUnderexposed === true || 
    photo.exposure?.isOverexposed === true || 
    photo.issue === 'overexposed' || 
    photo.issue === 'underexposed';
  if (isExposureIssue) {
    return {
      suggestedBucket: 'cullCandidate',
      reasonCodes: ['exposureRisk'],
      confidence: 'medium',
    };
  }

  // 4. 默认保留
  return {
    suggestedBucket: 'keep',
    reasonCodes: ['initialKeep'],
    confidence: 'high',
  };
};
