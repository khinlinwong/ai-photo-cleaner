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
    sharpnessScore = Math.max(30, Math.min(48, rawSharpness));
  } else if (focusStatus === 'Not recommended') {
    sharpnessScore = Math.min(39, rawSharpness);
  } else if (focusStatus === 'Soft Focus Detected') {
    sharpnessScore = Math.max(40, Math.min(64, rawSharpness));
  } else if (focusStatus === 'Acceptable / Casual use') {
    sharpnessScore = Math.max(72, Math.min(88, rawSharpness));
  } else if (focusStatus === 'Excellent / Share-ready') {
    sharpnessScore = Math.max(88, Math.min(100, rawSharpness));
  }

  sharpnessScore = Math.round(sharpnessScore);

  // 6. 曝光评分 (分级判定与平滑化)
  let exposureSeverity: 'none' | 'minor' | 'moderate' | 'severe' = 'none';
  const devBrightness = Math.abs(averageBrightness - 127);
  
  if (highlightRatio > 0.22 || shadowRatio > 0.40 || devBrightness > 75) {
    exposureSeverity = 'severe';
  } else if (highlightRatio > 0.12 || shadowRatio > 0.25 || devBrightness > 45) {
    exposureSeverity = 'moderate';
  } else if (highlightRatio > 0.05 || shadowRatio > 0.15 || devBrightness > 20) {
    exposureSeverity = 'minor';
  }
  
  let exposureScore = 100;
  if (exposureSeverity === 'minor') {
    // 轻微偏差，小幅扣分，评分限制在 85 到 95 之间
    const p1 = (highlightRatio > 0.05 ? (highlightRatio - 0.05) * 50 : 0);
    const p2 = (shadowRatio > 0.15 ? (shadowRatio - 0.15) * 40 : 0);
    const p3 = devBrightness * 0.15;
    exposureScore = Math.round(100 - p1 - p2 - p3);
    exposureScore = Math.max(85, Math.min(95, exposureScore));
  } else if (exposureSeverity === 'moderate') {
    // 中度偏差，扣除 15 到 30 分，评分限制在 70 到 84 之间
    const p1 = (highlightRatio - 0.12) * 80;
    const p2 = (shadowRatio - 0.25) * 60;
    const p3 = (devBrightness - 45) * 0.3;
    exposureScore = Math.round(84 - p1 - p2 - p3);
    exposureScore = Math.max(70, Math.min(84, exposureScore));
  } else if (exposureSeverity === 'severe') {
    // 严重曝光偏差，进行大额扣分，评分限制在 10 到 69 之间
    const p1 = (highlightRatio - 0.22) * 150;
    const p2 = (shadowRatio - 0.40) * 120;
    const p3 = (devBrightness - 75) * 0.5;
    exposureScore = Math.round(60 - p1 - p2 - p3);
    exposureScore = Math.max(10, Math.min(69, exposureScore));
  } else {
    // 无曝光偏差，评分在 95 到 100 之间
    exposureScore = Math.round(100 - devBrightness * 0.15);
    exposureScore = Math.max(95, exposureScore);
  }

  // 7. 质量总分 (清晰度 60%, 曝光 40%)
  let qualityScore = Math.round(sharpnessScore * 0.6 + exposureScore * 0.4);

  const isSevereBlur = (
    focusStatus === 'Directional Blur Detected' ||
    focusStatus === 'Motion Blur Detected' ||
    focusStatus === 'Insufficient Subject Sharpness' ||
    focusStatus === 'Not recommended'
  );
  const isSevereExposure = (exposureSeverity === 'severe');

  // 对严重缺陷强制得分上限
  if (isSevereBlur) {
    qualityScore = Math.min(45, qualityScore);
  } else if (isSevereExposure) {
    qualityScore = Math.min(50, qualityScore);
  }

  // 压缩 90 分以上的分数
  if (qualityScore > 90) {
    qualityScore = 90 + Math.round((qualityScore - 90) * 0.6);
  }

  // 7.5 构建本地技术风险信号 (Local Risk Scan Flags)
  const technicalRiskFlags: ('possible_blur' | 'possible_motion_blur' | 'exposure_risk' | 'low_information' | 'duplicate_candidate' | 'severe_quality_issue')[] = [];

  if (focusStatus === 'Soft Focus Detected' || focusStatus === 'Edge Smear Detected') {
    technicalRiskFlags.push('possible_blur');
  }

  if (
    focusStatus === 'Directional Blur Detected' ||
    focusStatus === 'Motion Blur Detected' ||
    focusStatus === 'Insufficient Subject Sharpness'
  ) {
    technicalRiskFlags.push('possible_motion_blur');
  }

  if (exposureSeverity === 'minor' || exposureSeverity === 'moderate' || exposureSeverity === 'severe') {
    technicalRiskFlags.push('exposure_risk');
  }

  if (focusStatus === 'Not recommended') {
    technicalRiskFlags.push('low_information');
  }

  if (isSevereBlur || isSevereExposure || qualityScore < 50) {
    technicalRiskFlags.push('severe_quality_issue');
  }

  // 决定信心度 (Confidence)
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (technicalRiskFlags.length === 0) {
    confidence = 'high';
  } else if (technicalRiskFlags.length === 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // 8. 判定状态 status (与 suggestedStatus 同步)
  // Delete / 淘汰候选必须满足以下严重问题之一：
  // 1. 严重模糊 (isSevereBlur)
  // 2. 严重曝光损坏 (isSevereExposure)
  // 3. 极低质量得分 (qualityScore < 50)
  let status: 'keep' | 'review' | 'delete' = 'keep';
  if (isSevereBlur || isSevereExposure || qualityScore < 50) {
    status = 'delete';
  } else if (
    qualityScore < 75 ||
    focusStatus === 'Soft Focus Detected' ||
    focusStatus === 'Edge Smear Detected' ||
    exposureSeverity === 'moderate' ||
    technicalRiskFlags.length >= 2
  ) {
    status = 'review';
  } else {
    status = 'keep';
  }

  const suggestedStatus = status;

  // 决定展示标签与温和原因文案
  let displayLabel: '技术风险低' | '建议复核' | '淘汰候选' = '技术风险低';
  if (status === 'delete') {
    displayLabel = '淘汰候选';
  } else if (status === 'review') {
    displayLabel = '建议复核';
  } else {
    displayLabel = '技术风险低';
  }

  let reasonLabel = '未发现明显技术问题';
  if (status === 'delete') {
    reasonLabel = '检测到明显技术风险，建议淘汰候选';
  } else if (status === 'review') {
    if (focusStatus === 'Soft Focus Detected' || focusStatus === 'Edge Smear Detected') {
      reasonLabel = '可能存在轻微模糊';
    } else if (exposureSeverity === 'moderate' || exposureSeverity === 'minor') {
      reasonLabel = '可能存在曝光风险';
    } else if (technicalRiskFlags.length >= 2) {
      reasonLabel = '检测到多项轻微技术偏差，建议复核';
    } else {
      reasonLabel = '建议复核';
    }
  }

  // 9. 判定 Issue 级别 (对应 badge 渲染)
  let issue: 'good' | 'blurry' | 'overexposed' | 'underexposed' | 'needs_review' = 'good';
  if (isSevereBlur) {
    issue = 'blurry';
  } else if (isSevereExposure) {
    issue = (highlightRatio > shadowRatio) ? 'overexposed' : 'underexposed';
  } else if (status === 'review') {
    issue = 'needs_review';
  } else {
    issue = 'good';
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
    focusStatus,
    perceptualHash: sharpness.perceptualHash,
    exposureSeverity,
    technicalRiskFlags,
    confidence,
    suggestedStatus,
    displayLabel,
    reasonLabel
  };
}
