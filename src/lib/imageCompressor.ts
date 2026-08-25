/**
 * Client-side Image Compression Helper
 * Resizes large image files on an HTML5 canvas and converts them to lightweight Base64 strings.
 * Prevents HTTP 413 Payload Too Large errors when saving logos & signatures to MongoDB.
 */
export function compressImageFile(
  file: File,
  maxDimension = 400,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file provided"));
      return;
    }

    // SVG files can be read as data URL directly without canvas rasterization
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        try {
          // Convert to WebP / JPEG for tiny Base64 payload (< 30KB per image)
          let compressedDataUrl = canvas.toDataURL("image/webp", quality);
          if (!compressedDataUrl || !compressedDataUrl.startsWith("data:image/webp")) {
            compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(compressedDataUrl);
        } catch {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => {
        // Fallback to raw data URL if image rendering fails
        resolve(event.target?.result as string);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
