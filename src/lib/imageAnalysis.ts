import { analyzeLocalExposure } from './analysis/local/exposure';
import { analyzeLocalSharpness } from './analysis/local/sharpness';
import { calculateLocalScore } from './analysis/scoring/localScore';
import { AnalyzedPhotoResult } from './analysis/vision/types';

export type { AnalyzedPhotoResult };

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
 * 在浏览器本地利用 Canvas 分析图片质量 (免费本地引擎入口)
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

  // 3. 计算本地曝光指标并获取灰度图
  const exposureMetrics = analyzeLocalExposure(data, totalPixels);

  // 4. 计算本地清晰度指标
  const sharpnessMetrics = analyzeLocalSharpness(exposureMetrics.gray, canvasWidth, canvasHeight);

  // 5. 联合汇总，进行本地评分与定性诊断分类
  const result = calculateLocalScore(exposureMetrics, sharpnessMetrics, naturalWidth, naturalHeight);

  return result;
}
