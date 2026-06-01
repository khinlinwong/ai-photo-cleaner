import { analyzeLocalExposure } from './analysis/local/exposure';
import { analyzeLocalSharpness } from './analysis/local/sharpness';
import { calculateLocalScore } from './analysis/scoring/localScore';
import { AnalyzedPhotoResult } from './analysis/vision/types';

export type { AnalyzedPhotoResult };

/**
 * 辅助方法：将 URL 异步载入为 HTMLImageElement，支持配置是否自动在载入后销毁该 URL。
 */
export function loadImageFromUrl(
  url: string,
  options?: { autoRevoke?: boolean }
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (options?.autoRevoke) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      resolve(img);
    };
    img.onerror = () => {
      if (options?.autoRevoke) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      reject(new Error('无法解析图片文件，请确保上传的是有效的图片。'));
    };
    img.src = url;
  });
}

/**
 * 提取自原逻辑的 Canvas 核心诊断计算方法。
 * 保持原有等比例缩放限制在最大 300px，并且原有计算分值逻辑与返回结构不变。
 * @param img 载入完毕的 HTMLImageElement
 */
export function analyzeImageElement(img: HTMLImageElement): Promise<AnalyzedPhotoResult> {
  return new Promise((resolve, reject) => {
    try {
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

      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 从给定的 ObjectURL 异步读取并分析图片质量。
 * 默认不释放 url，以便于 UI 常驻预览。若 options.autoRevoke = true，则在读取结束后释放它。
 */
export async function analyzeImageFromObjectUrl(
  url: string,
  options?: { autoRevoke?: boolean }
): Promise<AnalyzedPhotoResult> {
  try {
    const img = await loadImageFromUrl(url, options);
    return await analyzeImageElement(img);
  } catch (err) {
    // 确保在发生加载/解析异常时，如果设置了 autoRevoke，仍旧释放 url，避免资源泄露
    if (options?.autoRevoke) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

/**
 * 从给定的 Blob 异步读取并分析图片质量。自动创建和释放临时 ObjectURL。
 */
export async function analyzeImageFromBlob(blob: Blob): Promise<AnalyzedPhotoResult> {
  const url = URL.createObjectURL(blob);
  return analyzeImageFromObjectUrl(url, { autoRevoke: true });
}

/**
 * 在浏览器本地利用 Canvas 分析图片质量 (免费本地引擎入口，Web 强兼容)
 * @param file 待分析的图片文件
 */
export async function analyzeImage(file: File): Promise<AnalyzedPhotoResult> {
  return analyzeImageFromBlob(file);
}
