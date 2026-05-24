import { AnalyzedPhotoResult } from '../vision/types';
import { LocalExposureMetrics } from '../local/exposure';
import { LocalSharpnessMetrics } from '../local/sharpness';

/**
 * 联合曝光与清晰度物理指标，校准本地清晰度得分与定性诊断分类
 */
export function calculateLocalScore(
  exposure: LocalExposureMetrics,
  sharpness: LocalSharpnessMetrics,
  width: number,
  height: number
): AnalyzedPhotoResult {
  const { averageBrightness, highlightRatio, shadowRatio } = exposure;
  const {
    avgWeightedSobel,
    decayRatio,
    avgContrast,
    edgeDensity,
    edgePixelCount,
    totalInnerPixels,
    maxAdjacentRatio,
    weightedSobelCenterSum,
    totalWeightCenter,
    weightedSobelBorderSum,
    totalWeightBorder
  } = sharpness;

  // 1. 计算均值拉普拉斯标准差
  const totalWeight = sharpness.totalWeight;
  const meanLap = totalWeight > 0 ? (sharpness.weightedLapSum / totalWeight) : 0;
  const varLap = totalWeight > 0 ? ((sharpness.weightedLapSqSum / totalWeight) - (meanLap * meanLap)) : 0;
  const stdLap = Math.sqrt(Math.max(0, varLap));

  // 2. 原始 Laplacian (用来衡量噪点大小)
  const meanRawLap = totalInnerPixels > 0 ? (sharpness.rawLapSum / totalInnerPixels) : 0;
  const varRawLap = totalInnerPixels > 0 ? ((sharpness.rawLapSqSum / totalInnerPixels) - (meanRawLap * meanRawLap)) : 0;
  const stdLapRaw = Math.sqrt(Math.max(0, varRawLap));
  const noiseRatio = stdLapRaw / (stdLap + 0.01);

  // 3. 指标分值映射
  // Sobel
  let sScore = 0;
  if (avgWeightedSobel < 3.0) {
    sScore = (avgWeightedSobel / 3.0) * 25;
  } else if (avgWeightedSobel < 12.0) {
    sScore = 25 + ((avgWeightedSobel - 3.0) / 9.0) * 50;
  } else if (avgWeightedSobel < 25.0) {
    sScore = 75 + ((avgWeightedSobel - 12.0) / 13.0) * 20;
  } else {
    sScore = 95 + Math.min(5, ((avgWeightedSobel - 25.0) / 25.0) * 5);
  }

  // Laplacian
  let lScore = 0;
  if (stdLap < 2.0) {
    lScore = (stdLap / 2.0) * 25;
  } else if (stdLap < 8.0) {
    lScore = 25 + ((stdLap - 2.0) / 6.0) * 50;
  } else if (stdLap < 18.0) {
    lScore = 75 + ((stdLap - 8.0) / 10.0) * 20;
  } else {
    lScore = 95 + Math.min(5, ((stdLap - 18.0) / 18.0) * 5);
  }

  // Decay
  let decayScore = 0;
  if (decayRatio < 1.3) {
    decayScore = Math.max(0, ((decayRatio - 1.0) / 0.3) * 30);
  } else if (decayRatio < 1.75) {
    decayScore = 30 + ((decayRatio - 1.3) / 0.45) * 45;
  } else if (decayRatio < 2.2) {
    decayScore = 75 + ((decayRatio - 1.75) / 0.45) * 20;
  } else {
    decayScore = 95 + Math.min(5, ((decayRatio - 2.2) / 1.0) * 5);
  }

  // Contrast & Density
  let contrastScore = Math.min(100, (avgContrast / 22) * 100);
  if (contrastScore < 30) {
    contrastScore = (contrastScore / 30) * 35;
  } else if (contrastScore < 75) {
    contrastScore = 35 + ((contrastScore - 30) / 45) * 40;
  }
  const densityScore = Math.min(100, (edgeDensity / 0.10) * 100);

  // 基础清晰度融合
  let rawSharpness = sScore * 0.25 + lScore * 0.25 + decayScore * 0.25 + contrastScore * 0.15 + densityScore * 0.10;

  // 噪点抑制
  if (noiseRatio > 2.2) {
    const penalty = Math.min(45, (noiseRatio - 2.2) * 18);
    rawSharpness = Math.max(10, rawSharpness - penalty);
  }

  // 4. 定性对焦状态判断 (Focus Diagnostic States)
  let focusStatus: 
    | 'Excellent / Share-ready' 
    | 'Acceptable / Casual use' 
    | 'Soft Focus Detected'
    | 'Directional Blur Detected' 
    | 'Motion Blur Detected' 
    | 'Edge Smear Detected' 
    | 'Insufficient Subject Sharpness'
    | 'Not recommended' = 'Acceptable / Casual use';

  // A. 方向性拖尾与运动手抖
  if (edgePixelCount > totalInnerPixels * 0.02) {
    if (maxAdjacentRatio > 0.78) {
      focusStatus = 'Directional Blur Detected';
    } else if (maxAdjacentRatio > 0.62) {
      focusStatus = 'Motion Blur Detected';
    }
  }

  // B. 主体对焦不足 (中心像素 vs 边缘像素)
  if (focusStatus === 'Acceptable / Casual use') {
    const avgSobelCenter = weightedSobelCenterSum / (totalWeightCenter + 0.001);
    const avgSobelBorder = weightedSobelBorderSum / (totalWeightBorder + 0.001);

    if (avgSobelCenter < 4.5 && avgSobelBorder > 8.0) {
      focusStatus = 'Insufficient Subject Sharpness';
    } else if (rawSharpness > 45 && avgSobelCenter < 3.5) {
      focusStatus = 'Insufficient Subject Sharpness';
    }
  }

  // C. 边缘涂抹检测
  if (focusStatus === 'Acceptable / Casual use') {
    if (avgContrast < 5.0 && avgWeightedSobel > 2.0) {
      focusStatus = 'Edge Smear Detected';
    } else if (decayRatio < 1.25 && avgWeightedSobel > 3.0 && edgeDensity > 0.03) {
      focusStatus = 'Edge Smear Detected';
    }
  }

  // D. 基础清晰度判定 fallback
  if (focusStatus === 'Acceptable / Casual use') {
    if (rawSharpness < 40) {
      focusStatus = 'Not recommended';
    } else if (rawSharpness < 60) {
      focusStatus = 'Soft Focus Detected';
    } else if (rawSharpness >= 85) {
      focusStatus = 'Excellent / Share-ready';
    }
  }

  // 5. 强行根据定性分析限制得分，确保文字解释与分数一致
  let sharpnessScore = rawSharpness;
  if (focusStatus === 'Directional Blur Detected') {
    sharpnessScore = Math.min(25, rawSharpness);
  } else if (focusStatus === 'Motion Blur Detected') {
    sharpnessScore = Math.min(30, rawSharpness);
  } else if (focusStatus === 'Insufficient Subject Sharpness') {
    sharpnessScore = Math.min(35, rawSharpness);
  } else if (focusStatus === 'Edge Smear Detected') {
    sharpnessScore = Math.min(48, rawSharpness);
  } else if (focusStatus === 'Not recommended') {
    sharpnessScore = Math.min(39, rawSharpness);
  } else if (focusStatus === 'Soft Focus Detected') {
    sharpnessScore = Math.max(40, Math.min(59, rawSharpness));
  } else if (focusStatus === 'Acceptable / Casual use') {
    sharpnessScore = Math.max(60, Math.min(84, rawSharpness));
  } else if (focusStatus === 'Excellent / Share-ready') {
    sharpnessScore = Math.max(85, Math.min(100, rawSharpness));
  }

  sharpnessScore = Math.round(sharpnessScore);

  // 6. 曝光评分
  const overexposurePenalty = highlightRatio > 0.05 ? (highlightRatio - 0.05) * 200 : 0;
  const underexposurePenalty = shadowRatio > 0.15 ? (shadowRatio - 0.15) * 150 : 0;
  const brightnessDeviationPenalty = Math.abs(averageBrightness - 127) * 0.4;
  
  let exposureScore = Math.round(
    Math.max(0, 100 - overexposurePenalty - underexposurePenalty - brightnessDeviationPenalty)
  );

  if (exposureScore > 90) {
    exposureScore = 90 + Math.round((exposureScore - 90) * 0.6);
  }

  // 7. 质量总分 (清晰度 60%, 曝光 40%)
  let qualityScore = Math.round(sharpnessScore * 0.6 + exposureScore * 0.4);
  if (qualityScore > 90) {
    qualityScore = 90 + Math.round((qualityScore - 90) * 0.6);
  }

  // 8. 判定 Issue 与建议状态
  let issue: 'good' | 'blurry' | 'overexposed' | 'underexposed' | 'needs_review' = 'good';
  if (
    focusStatus === 'Not recommended' ||
    focusStatus === 'Directional Blur Detected' ||
    focusStatus === 'Motion Blur Detected' ||
    focusStatus === 'Insufficient Subject Sharpness'
  ) {
    issue = 'blurry';
  } else if (highlightRatio > 0.15) {
    issue = 'overexposed';
  } else if (shadowRatio > 0.35) {
    issue = 'underexposed';
  } else if (
    focusStatus === 'Soft Focus Detected' ||
    focusStatus === 'Edge Smear Detected' ||
    focusStatus === 'Acceptable / Casual use' ||
    highlightRatio > 0.08 ||
    shadowRatio > 0.25 ||
    exposureScore < 60
  ) {
    issue = 'needs_review';
  }

  let status: 'keep' | 'review' | 'delete' = 'keep';
  if (issue === 'blurry' || issue === 'overexposed' || issue === 'underexposed') {
    status = 'delete';
  } else if (issue === 'needs_review') {
    status = 'review';
  }

  return {
    width,
    height,
    averageBrightness,
    highlightRatio,
    shadowRatio,
    sharpnessScore,
    exposureScore,
    qualityScore,
    issue,
    status,
    focusStatus
  };
}
