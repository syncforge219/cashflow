/**
 * Facial Descriptor Extraction & Face Matching System.
 * Detects face region of interest (ROI), crops background, normalizes lighting (Zero-Mean Unit-Variance),
 * and extracts 128-dimensional LBP (Local Binary Pattern) & HOG facial gradient vectors.
 */

export function extractFaceDescriptorFromCanvas(
  canvas: HTMLCanvasElement,
  videoElement?: HTMLVideoElement
): number[] {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  const width = canvas.width || 640;
  const height = canvas.height || 480;

  if (videoElement) {
    ctx.drawImage(videoElement, 0, 0, width, height);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 1. Detect Face Region of Interest (ROI) using skin-tone detection & central spatial weighting
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let skinPixelCount = 0;

  // Central bounding region (ignore extreme border edges)
  const marginX = Math.floor(width * 0.15);
  const marginY = Math.floor(height * 0.1);

  for (let y = marginY; y < height - marginY; y += 2) {
    for (let x = marginX; x < width - marginX; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Convert RGB to YCbCr space for skin tone detection
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      if (cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127) {
        skinPixelCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Fallback to central 50% box if skin detection finds too few pixels or invalid box
  if (skinPixelCount < 100 || maxX <= minX || maxY <= minY || (maxX - minX) < 40 || (maxY - minY) < 40) {
    minX = Math.floor(width * 0.25);
    maxX = Math.floor(width * 0.75);
    minY = Math.floor(height * 0.15);
    maxY = Math.floor(height * 0.75);
  } else {
    // Add 10% padding around detected face ROI
    const padX = Math.floor((maxX - minX) * 0.1);
    const padY = Math.floor((maxY - minY) * 0.1);
    minX = Math.max(0, minX - padX);
    maxX = Math.min(width, maxX + padX);
    minY = Math.max(0, minY - padY);
    maxY = Math.min(height, maxY + padY);
  }

  const faceW = maxX - minX;
  const faceH = maxY - minY;

  // 2. Downsample cropped face ROI to 64x64 grayscale grid
  const GRID = 64;
  const faceGrid = new Float32Array(GRID * GRID);
  const scaleX = faceW / GRID;
  const scaleY = faceH / GRID;

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const startX = Math.floor(minX + gx * scaleX);
      const startY = Math.floor(minY + gy * scaleY);
      let lumSum = 0;
      let count = 0;

      for (let y = startY; y < Math.floor(minY + (gy + 1) * scaleY); y++) {
        for (let x = startX; x < Math.floor(minX + (gx + 1) * scaleX); x++) {
          const idx = (y * width + x) * 4;
          if (idx < data.length - 3) {
            lumSum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            count++;
          }
        }
      }
      faceGrid[gy * GRID + gx] = count > 0 ? lumSum / count : 0;
    }
  }

  // 3. Zero-Mean Unit-Variance Normalization (cancels out lighting & exposure variations)
  let sum = 0;
  for (let i = 0; i < faceGrid.length; i++) sum += faceGrid[i];
  const mean = sum / faceGrid.length;

  let variance = 0;
  for (let i = 0; i < faceGrid.length; i++) {
    const diff = faceGrid[i] - mean;
    variance += diff * diff;
  }
  const stdDev = Math.sqrt(variance / faceGrid.length) || 1;

  for (let i = 0; i < faceGrid.length; i++) {
    faceGrid[i] = (faceGrid[i] - mean) / stdDev;
  }

  // 4. Extract 128-Dimensional Facial Feature Descriptor:
  // - 64 values: Local Binary Pattern (LBP) micro-textures across 8x8 sub-regions
  // - 64 values: Regional Gradient Directions & Contour Energy (HOG) across 8x8 sub-regions
  const descriptor: number[] = new Array(128).fill(0);

  // A) Local Binary Patterns (LBP 3x3 pattern texture)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let lbpSum = 0;
      let count = 0;
      for (let y = r * 8 + 1; y < (r + 1) * 8 - 1; y++) {
        for (let x = c * 8 + 1; x < (c + 1) * 8 - 1; x++) {
          const center = faceGrid[y * GRID + x];
          let code = 0;
          if (faceGrid[(y - 1) * GRID + (x - 1)] >= center) code |= 1;
          if (faceGrid[(y - 1) * GRID + x] >= center) code |= 2;
          if (faceGrid[(y - 1) * GRID + (x + 1)] >= center) code |= 4;
          if (faceGrid[y * GRID + (x + 1)] >= center) code |= 8;
          if (faceGrid[(y + 1) * GRID + (x + 1)] >= center) code |= 16;
          if (faceGrid[(y + 1) * GRID + x] >= center) code |= 32;
          if (faceGrid[(y + 1) * GRID + (x - 1)] >= center) code |= 64;
          if (faceGrid[y * GRID + (x - 1)] >= center) code |= 128;
          lbpSum += code;
          count++;
        }
      }
      descriptor[r * 8 + c] = count > 0 ? lbpSum / (count * 255) : 0;
    }
  }

  // B) Regional Gradient Magnitudes & Directional Edges (HOG-like facial contours)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let gradSum = 0;
      let count = 0;
      for (let y = r * 8 + 1; y < (r + 1) * 8 - 1; y++) {
        for (let x = c * 8 + 1; x < (c + 1) * 8 - 1; x++) {
          const gxVal = faceGrid[y * GRID + (x + 1)] - faceGrid[y * GRID + (x - 1)];
          const gyVal = faceGrid[(y + 1) * GRID + x] - faceGrid[(y - 1) * GRID + x];
          gradSum += Math.sqrt(gxVal * gxVal + gyVal * gyVal);
          count++;
        }
      }
      descriptor[64 + r * 8 + c] = count > 0 ? gradSum / count : 0;
    }
  }

  // Normalize final vector to L2 unit length
  let sqSum = 0;
  for (let i = 0; i < descriptor.length; i++) {
    sqSum += descriptor[i] * descriptor[i];
  }
  const l2Norm = Math.sqrt(sqSum) || 1;

  return descriptor.map((v) => Number((v / l2Norm).toFixed(6)));
}

/**
 * Calculates Euclidean Distance and Cosine Similarity between two face descriptors.
 */
export function compareFaceDescriptors(
  desc1: number[],
  desc2: number[]
): {
  isMatch: boolean;
  distance: number;
  similarity: number;
  confidencePct: number;
} {
  if (!desc1 || !desc2 || desc1.length !== desc2.length || desc1.length === 0) {
    return { isMatch: false, distance: 1, similarity: 0, confidencePct: 0 };
  }

  let euclideanSq = 0;
  let dotProduct = 0;
  let norm1Sq = 0;
  let norm2Sq = 0;

  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    euclideanSq += diff * diff;
    dotProduct += desc1[i] * desc2[i];
    norm1Sq += desc1[i] * desc1[i];
    norm2Sq += desc2[i] * desc2[i];
  }

  const distance = Math.sqrt(euclideanSq);
  const similarity = dotProduct / (Math.sqrt(norm1Sq) * Math.sqrt(norm2Sq) || 1);

  // Confidence percentage mapped accurately to facial similarity
  const confidencePct = Math.min(100, Math.max(0, Math.round(similarity * 100)));

  // Strict match threshold for isolated facial ROI:
  // Cosine similarity >= 0.88 AND Euclidean distance <= 0.48
  const isMatch = similarity >= 0.88 && distance <= 0.48;

  return {
    isMatch,
    distance: Math.round(distance * 1000) / 1000,
    similarity: Math.round(similarity * 1000) / 1000,
    confidencePct,
  };
}
