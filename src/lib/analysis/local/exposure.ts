export interface LocalExposureMetrics {
  averageBrightness: number;
  highlightRatio: number;
  shadowRatio: number;
  gray: Uint8ClampedArray;
}

/**
 * 计算图片的亮度、高光占比、暗部占比，并返回对应的灰度图
 */
export function analyzeLocalExposure(data: Uint8ClampedArray, totalPixels: number): LocalExposureMetrics {
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

  return {
    averageBrightness,
    highlightRatio,
    shadowRatio,
    gray
  };
}
