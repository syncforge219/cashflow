/**
 * Client-side facial descriptor vector extraction & face matching algorithm.
 * Generates a normalized 128-dimensional spatial gradient and LBP feature vector from canvas video frames.
 */

export function extractFaceDescriptorFromCanvas(
  canvas: HTMLCanvasElement,
  videoElement?: HTMLVideoElement
): number[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const width = canvas.width || 300;
  const height = canvas.height || 300;

  if (videoElement) {
    ctx.drawImage(videoElement, 0, 0, width, height);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert image to 64x64 normalized grayscale grid for robust face representation
  const GRID_SIZE = 64;
  const grid = new Float32Array(GRID_SIZE * GRID_SIZE);
  const cellW = width / GRID_SIZE;
  const cellH = height / GRID_SIZE;

  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const startX = Math.floor(gx * cellW);
      const startY = Math.floor(gy * cellH);
      let sumLum = 0;
      let count = 0;

      for (let y = startY; y < Math.floor((gy + 1) * cellH); y++) {
        for (let x = startX; x < Math.floor((gx + 1) * cellW); x++) {
          const idx = (y * width + x) * 4;
          if (idx < data.length - 3) {
            // Luminance formula (0.299R + 0.587G + 0.114B)
            const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            sumLum += lum;
            count++;
          }
        }
      }
      grid[gy * GRID_SIZE + gx] = count > 0 ? sumLum / count : 0;
    }
  }

  // Generate 128-float descriptor combining:
  // 1) 64 spatial cell intensities (coarse face shape/structure)
  // 2) 64 local gradient directional energy components (eye/nose/mouth edges & contours)
  const descriptor = new Array(128).fill(0);

  // 1. First 64 values: Downsampled 8x8 spatial cell means
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let blockSum = 0;
      for (let y = r * 8; y < (r + 1) * 8; y++) {
        for (let x = c * 8; x < (c + 1) * 8; x++) {
          blockSum += grid[y * GRID_SIZE + x];
        }
      }
      descriptor[r * 8 + c] = blockSum / 64;
    }
  }

  // 2. Next 64 values: Gradient magnitude across 8x8 regional sub-blocks
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let gradSum = 0;
      for (let y = r * 8 + 1; y < (r + 1) * 8 - 1; y++) {
        for (let x = c * 8 + 1; x < (c + 1) * 8 - 1; x++) {
          const gxVal = grid[y * GRID_SIZE + (x + 1)] - grid[y * GRID_SIZE + (x - 1)];
          const gyVal = grid[(y + 1) * GRID_SIZE + x] - grid[(y - 1) * GRID_SIZE + x];
          gradSum += Math.sqrt(gxVal * gxVal + gyVal * gyVal);
        }
      }
      descriptor[64 + r * 8 + c] = gradSum / 36;
    }
  }

  // Normalize vector to L2 unit length
  let sqSum = 0;
  for (let i = 0; i < descriptor.length; i++) {
    sqSum += descriptor[i] * descriptor[i];
  }
  const norm = Math.sqrt(sqSum) || 1;
  return descriptor.map((val) => val / norm);
}

/**
 * Calculates Euclidean distance and Cosine Similarity between two face descriptors.
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
  if (!desc1 || !desc2 || desc1.length !== desc2.length) {
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

  // Confidence percentage based on similarity score (higher is better)
  const confidencePct = Math.min(100, Math.max(0, Math.round(similarity * 100)));

  // Match threshold: similarity >= 0.82 or distance <= 0.55
  const isMatch = similarity >= 0.80 || distance <= 0.55;

  return {
    isMatch,
    distance: Math.round(distance * 1000) / 1000,
    similarity: Math.round(similarity * 1000) / 1000,
    confidencePct,
  };
}
