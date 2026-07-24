"use client";

/**
 * Extracts dominant vibrant color from image URL or base64 data string
 */
export function extractDominantColor(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    if (!imageSrc || typeof window === "undefined") {
      resolve("#4f46e5"); // Fallback indigo
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("#4f46e5");
          return;
        }

        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);

        const imgData = ctx.getImageData(0, 0, 64, 64);
        const data = imgData.data;

        let rSum = 0, gSum = 0, bSum = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Ignore transparent and nearly white/black pixels
          if (a > 128) {
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness > 35 && brightness < 235) {
              rSum += r;
              gSum += g;
              bSum += b;
              count++;
            }
          }
        }

        if (count === 0) {
          resolve("#4f46e5");
          return;
        }

        const avgR = Math.round(rSum / count);
        const avgG = Math.round(gSum / count);
        const avgB = Math.round(bSum / count);

        const hex = `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1)}`;
        resolve(hex);
      } catch (err) {
        console.warn("Could not extract canvas color:", err);
        resolve("#4f46e5");
      }
    };

    img.onerror = () => {
      resolve("#4f46e5");
    };
  });
}

/**
 * Applies dynamic brand theme color to CSS custom properties & localStorage
 */
export function applyBrandTheme(colorHex: string) {
  if (typeof window === "undefined" || !colorHex) return;

  try {
    localStorage.setItem("app_brand_theme_color", colorHex);
    document.documentElement.style.setProperty("--brand-primary", colorHex);
    document.documentElement.style.setProperty("--brand-primary-light", `${colorHex}15`);
    document.documentElement.style.setProperty("--brand-primary-border", `${colorHex}40`);
  } catch (e) {
    console.error("Failed to apply brand theme:", e);
  }
}

/**
 * Initializes brand theme from localStorage on page mount
 */
export function initBrandTheme() {
  if (typeof window === "undefined") return;
  const savedColor = localStorage.getItem("app_brand_theme_color");
  if (savedColor) {
    applyBrandTheme(savedColor);
  }
}
