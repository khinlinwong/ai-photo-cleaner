export interface AnalyzedPhotoResult {
  width: number;
  height: number;
  averageBrightness: number;
  highlightRatio: number;
  shadowRatio: number;
  sharpnessScore: number;
  exposureScore: number;
  qualityScore: number;
  issue: 'good' | 'blurry' | 'overexposed' | 'underexposed' | 'needs_review';
  status: 'keep' | 'review' | 'delete';
}

/**
 * 辅助方法：将 File 对象异步载入为 HTMLImageElement
 */
const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法解析图片文件，请确保上传的是有效的图片。'));
    };
    img.src = url;
  });
};

/**
 * 在浏览器本地利用 Canvas 分析图片质量
 * @param file 待分析的图片文件
 */
export async function analyzeImage(file: File): Promise<AnalyzedPhotoResult> {
  const img = await loadImage(file);
  const naturalWidth = img.naturalWidth || 800;
  const naturalHeight = img.naturalHeight || 600;

  // 1. 防卡死等比缩放设计：最大分辨率限制在 300px 宽/高
  let canvasWidth = naturalWidth;
  let canvasHeight = naturalHeight;
  const maxDimension = 300;

  if (canvasWidth > maxDimension || canvasHeight > maxDimension) {
    if (canvasWidth > canvasHeight) {
      canvasHeight = Math.round((canvasHeight * maxDimension) / canvasWidth);
      canvasWidth = maxDimension;
    } else {
      canvasWidth = Math.round((canvasWidth * maxDimension) / canvasHeight);
      canvasHeight = maxDimension;
    }
  }

  // 2. 创建 Canvas 并读取像素
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法初始化 Canvas 二维渲染上下文。');
  }

  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const data = imageData.data;
  const totalPixels = canvasWidth * canvasHeight;

  // 3. 计算亮度与曝光分布 (灰度转换)
  let sumBrightness = 0;
  let highlightPixels = 0; // > 240
  let shadowPixels = 0;    // < 25
  const gray = new Uint8ClampedArray(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    
    // 亮度转换：brightness = 0.299 * R + 0.587 * G + 0.114 * B
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    sumBrightness += brightness;
    
    if (brightness > 240) {
      highlightPixels++;
    } else if (brightness < 25) {
      shadowPixels++;
    }
    
    gray[i] = brightness;
  }

  const averageBrightness = sumBrightness / totalPixels;
  const highlightRatio = highlightPixels / totalPixels;
  const shadowRatio = shadowPixels / totalPixels;

  // 4. 清晰度检测：基于 Sobel 算子 + Laplacian 方差 联合诊断
  let totalGradient = 0;
  let edgePixelCount = 0;

  // 4.1 Sobel 边缘强度检测
  for (let y = 1; y < canvasHeight - 1; y++) {
    for (let x = 1; x < canvasWidth - 1; x++) {
      const v00 = gray[(y - 1) * canvasWidth + (x - 1)];
      const v01 = gray[(y - 1) * canvasWidth + x];
      const v02 = gray[(y - 1) * canvasWidth + (x + 1)];
      
      const v10 = gray[y * canvasWidth + (x - 1)];
      const v12 = gray[y * canvasWidth + (x + 1)];
      
      const v20 = gray[(y + 1) * canvasWidth + (x - 1)];
      const v21 = gray[(y + 1) * canvasWidth + x];
      const v22 = gray[(y + 1) * canvasWidth + (x + 1)];
      
      const gx = -v00 + v02 - 2 * v10 + 2 * v12 - v20 + v22;
      const gy = -v00 - 2 * v01 - v02 + v20 + 2 * v21 + v22;
      
      const mag = Math.sqrt(gx * gx + gy * gy);
      totalGradient += mag;
      edgePixelCount++;
    }
  }

  const averageGradient = edgePixelCount > 0 ? (totalGradient / edgePixelCount) : 0;

  // 4.2 Laplacian 离散方差检测（清晰度测量的标准差模型）
  let laplacianSum = 0;
  const laplacianValues = new Float32Array(edgePixelCount);
  let idx = 0;

  for (let y = 1; y < canvasHeight - 1; y++) {
    for (let x = 1; x < canvasWidth - 1; x++) {
      const v11 = gray[y * canvasWidth + x];
      const v01 = gray[(y - 1) * canvasWidth + x];
      const v21 = gray[(y + 1) * canvasWidth + x];
      const v10 = gray[y * canvasWidth + (x - 1)];
      const v12 = gray[y * canvasWidth + (x + 1)];
      
      // 拉普拉斯边缘核 [0 1 0; 1 -4 1; 0 1 0]
      const lap = v01 + v21 + v10 + v12 - 4 * v11;
      laplacianSum += lap;
      laplacianValues[idx++] = lap;
    }
  }

  const laplacianMean = laplacianSum / edgePixelCount;
  let laplacianVarSum = 0;
  for (let i = 0; i < edgePixelCount; i++) {
    const diff = laplacianValues[i] - laplacianMean;
    laplacianVarSum += diff * diff;
  }
  const laplacianVariance = edgePixelCount > 0 ? (laplacianVarSum / edgePixelCount) : 0;

  // 4.3 联合清晰度评分与高分压缩逻辑 (降低满分触发，增加区分度)
  const sobelScoreRaw = Math.min(100, averageGradient * 3.8);
  const laplacianScoreRaw = Math.min(100, Math.sqrt(laplacianVariance) * 7.8);

  let sharpnessScore = Math.round(sobelScoreRaw * 0.4 + laplacianScoreRaw * 0.6);

  // 90分以上进行平滑压缩，限制全满分
  if (sharpnessScore > 90) {
    sharpnessScore = 90 + Math.round((sharpnessScore - 90) * 0.6);
  }

  // 5. 曝光评分计算 (以亮度偏移与极值像素比例扣分)
  const overexposurePenalty = highlightRatio > 0.05 ? (highlightRatio - 0.05) * 200 : 0;
  const underexposurePenalty = shadowRatio > 0.15 ? (shadowRatio - 0.15) * 150 : 0;
  const brightnessDeviationPenalty = Math.abs(averageBrightness - 127) * 0.4;
  
  let exposureScore = Math.round(
    Math.max(0, 100 - overexposurePenalty - underexposurePenalty - brightnessDeviationPenalty)
  );

  if (exposureScore > 90) {
    exposureScore = 90 + Math.round((exposureScore - 90) * 0.6);
  }

  // 6. 综合质量评分 (清晰度权重 60%，曝光评分权重 40%，并做大分压缩)
  let qualityScore = Math.round(sharpnessScore * 0.6 + exposureScore * 0.4);
  if (qualityScore > 90) {
    qualityScore = 90 + Math.round((qualityScore - 90) * 0.6);
  }

  // 7. 判断问题 (Issue)
  // sharpnessScore 很低 (<45)：blurry / delete
  // sharpnessScore 中等 (45-70)：needs_review / review
  // sharpnessScore 高 (>=70)：good / keep
  let issue: 'good' | 'blurry' | 'overexposed' | 'underexposed' | 'needs_review' = 'good';
  if (sharpnessScore < 45) {
    issue = 'blurry';
  } else if (highlightRatio > 0.15) {
    issue = 'overexposed';
  } else if (shadowRatio > 0.35) {
    issue = 'underexposed';
  } else if (sharpnessScore < 70 || highlightRatio > 0.08 || shadowRatio > 0.25 || exposureScore < 60) {
    issue = 'needs_review';
  }

  // 8. 分配建议状态 (Status)
  let status: 'keep' | 'review' | 'delete' = 'keep';
  if (issue === 'blurry' || issue === 'overexposed' || issue === 'underexposed') {
    status = 'delete';
  } else if (issue === 'needs_review') {
    status = 'review';
  }

  return {
    width: naturalWidth,
    height: naturalHeight,
    averageBrightness,
    highlightRatio,
    shadowRatio,
    sharpnessScore,
    exposureScore,
    qualityScore,
    issue,
    status
  };
}
