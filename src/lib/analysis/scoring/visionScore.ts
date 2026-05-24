import { VisionAnalysisResult } from '../vision/types';

/**
 * 针对大模型返回结果的得分计算（保留结构）
 */
export function calculateVisionScore(result: VisionAnalysisResult): number {
  return result.aestheticScore;
}
