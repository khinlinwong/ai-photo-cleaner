export interface LocalSharpnessMetrics {
  avgWeightedSobel: number;
  avgWeightedSobel2: number;
  totalWeight: number;
  edgePixelCount: number;
  weightedLapSum: number;
  weightedLapSqSum: number;
  rawLapSum: number;
  rawLapSqSum: number;
  totalInnerPixels: number;
  avgContrast: number;
  edgeDensity: number;
  decayRatio: number;
  maxAdjacentRatio: number;
  totalWeightCenter: number;
  weightedSobelCenterSum: number;
  totalWeightBorder: number;
  weightedSobelBorderSum: number;
}

/**
 * 计算本地清晰度、边缘细节、对比度、运动模糊方向等物理指标
 */
export function analyzeLocalSharpness(
  gray: Uint8ClampedArray, 
  canvasWidth: number, 
  canvasHeight: number
): LocalSharpnessMetrics {
  const totalPixels = canvasWidth * canvasHeight;

  // 1. 降噪预处理：均值滤波 grayBlur1
  const grayBlur1 = new Uint8ClampedArray(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    grayBlur1[i] = gray[i];
  }
  for (let y = 1; y < canvasHeight - 1; y++) {
    for (let x = 1; x < canvasWidth - 1; x++) {
      const idx = y * canvasWidth + x;
      const sum = 
        gray[idx - canvasWidth - 1] + gray[idx - canvasWidth] + gray[idx - canvasWidth + 1] +
        gray[idx - 1]               + gray[idx]               + gray[idx + 1] +
        gray[idx + canvasWidth - 1] + gray[idx + canvasWidth] + gray[idx + canvasWidth + 1];
      grayBlur1[idx] = sum / 9;
    }
  }

  // 2. 双重均值滤波：grayBlur2，用以衡量高频边缘锐度衰减比例
  const grayBlur2 = new Uint8ClampedArray(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    grayBlur2[i] = grayBlur1[i];
  }
  for (let y = 1; y < canvasHeight - 1; y++) {
    for (let x = 1; x < canvasWidth - 1; x++) {
      const idx = y * canvasWidth + x;
      const sum = 
        grayBlur1[idx - canvasWidth - 1] + grayBlur1[idx - canvasWidth] + grayBlur1[idx - canvasWidth + 1] +
        grayBlur1[idx - 1]               + grayBlur1[idx]               + grayBlur1[idx + 1] +
        grayBlur1[idx + canvasWidth - 1] + grayBlur1[idx + canvasWidth] + grayBlur1[idx + canvasWidth + 1];
      grayBlur2[idx] = sum / 9;
    }
  }

  // 3. 多维指标扫描
  let weightedSobelSum = 0;
  let weightedSobelSum2 = 0;
  let totalWeight = 0;

  let weightedLapSum = 0;
  let weightedLapSqSum = 0;
  let rawLapSum = 0;
  let rawLapSqSum = 0;

  let totalContrastSum = 0;
  let edgePixelCount = 0;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // 运动模糊方向直方图 (8 Bins)
  const angleBins = new Float32Array(8);
  let totalGradientMagForBins = 0;

  // 中心 vs 边缘对比扫描
  let weightedSobelCenterSum = 0;
  let totalWeightCenter = 0;
  let weightedSobelBorderSum = 0;
  let totalWeightBorder = 0;

  for (let y = 1; y < canvasHeight - 1; y++) {
    for (let x = 1; x < canvasWidth - 1; x++) {
      const idx = y * canvasWidth + x;

      // Center distance & weight
      const dx = (x - centerX) / centerX;
      const dy = (y - centerY) / centerY;
      const distSq = dx * dx + dy * dy;
      const centerWeight = Math.exp(-distSq * 1.5);

      // Sobel on grayBlur1
      const v00 = grayBlur1[idx - canvasWidth - 1];
      const v01 = grayBlur1[idx - canvasWidth];
      const v02 = grayBlur1[idx - canvasWidth + 1];
      const v10 = grayBlur1[idx - 1];
      const v12 = grayBlur1[idx + 1];
      const v20 = grayBlur1[idx + canvasWidth - 1];
      const v21 = grayBlur1[idx + canvasWidth];
      const v22 = grayBlur1[idx + canvasWidth + 1];

      const gx = -v00 + v02 - 2 * v10 + 2 * v12 - v20 + v22;
      const gy = -v00 - 2 * v01 - v02 + v20 + 2 * v21 + v22;
      const mag = Math.sqrt(gx * gx + gy * gy);

      // Sobel on grayBlur2
      const u00 = grayBlur2[idx - canvasWidth - 1];
      const u01 = grayBlur2[idx - canvasWidth];
      const u02 = grayBlur2[idx - canvasWidth + 1];
      const u10 = grayBlur2[idx - 1];
      const u12 = grayBlur2[idx + 1];
      const u20 = grayBlur2[idx + canvasWidth - 1];
      const u21 = grayBlur2[idx + canvasWidth];
      const u22 = grayBlur2[idx + canvasWidth + 1];

      const gx2 = -u00 + u02 - 2 * u10 + 2 * u12 - u20 + u22;
      const gy2 = -u00 - 2 * u01 - u02 + u20 + 2 * u21 + u22;
      const mag2 = Math.sqrt(gx2 * gx2 + gy2 * gy2);

      // Accumulate weighted sums
      weightedSobelSum += mag * centerWeight;
      weightedSobelSum2 += mag2 * centerWeight;
      totalWeight += centerWeight;

      // Group into center vs border
      if (centerWeight > 0.65) {
        weightedSobelCenterSum += mag;
        totalWeightCenter += 1;
      } else {
        weightedSobelBorderSum += mag;
        totalWeightBorder += 1;
      }

      if (mag > 20) {
        edgePixelCount++;
        const angle = Math.atan2(gy, gx);
        const positiveAngle = angle < 0 ? angle + Math.PI : angle;
        const binIndex = Math.min(7, Math.floor((positiveAngle / Math.PI) * 8));
        angleBins[binIndex] += mag;
        totalGradientMagForBins += mag;
      }

      // Laplacian
      const lap = v01 + v21 + v10 + v12 - 4 * grayBlur1[idx];
      weightedLapSum += lap * centerWeight;
      weightedLapSqSum += lap * lap * centerWeight;

      // Raw Laplacian
      const rawLap = gray[idx - canvasWidth] + gray[idx + canvasWidth] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx];
      rawLapSum += rawLap;
      rawLapSqSum += rawLap * rawLap;

      // Contrast
      const neighbors = [v00, v01, v02, v10, grayBlur1[idx], v12, v20, v21, v22];
      const minVal = Math.min(...neighbors);
      const maxVal = Math.max(...neighbors);
      totalContrastSum += (maxVal - minVal) * centerWeight;
    }
  }

  const avgWeightedSobel = totalWeight > 0 ? (weightedSobelSum / totalWeight) : 0;
  const avgWeightedSobel2 = totalWeight > 0 ? (weightedSobelSum2 / totalWeight) : 0;

  const totalInnerPixels = (canvasHeight - 2) * (canvasWidth - 2);

  const avgContrast = totalWeight > 0 ? (totalContrastSum / totalWeight) : 0;
  const edgeDensity = totalInnerPixels > 0 ? (edgePixelCount / totalInnerPixels) : 0;
  const decayRatio = avgWeightedSobel / (avgWeightedSobel2 + 0.001);

  // Motion blur ratio
  let maxAdjacentSum = 0;
  for (let i = 0; i < 8; i++) {
    const sum2 = angleBins[i] + angleBins[(i + 1) % 8];
    if (sum2 > maxAdjacentSum) {
      maxAdjacentSum = sum2;
    }
  }
  const maxAdjacentRatio = totalGradientMagForBins > 0 ? (maxAdjacentSum / totalGradientMagForBins) : 0;

  return {
    avgWeightedSobel,
    avgWeightedSobel2,
    totalWeight,
    edgePixelCount,
    weightedLapSum,
    weightedLapSqSum,
    rawLapSum,
    rawLapSqSum,
    totalInnerPixels,
    avgContrast,
    edgeDensity,
    decayRatio,
    maxAdjacentRatio,
    totalWeightCenter,
    weightedSobelCenterSum,
    totalWeightBorder,
    weightedSobelBorderSum
  };
}
