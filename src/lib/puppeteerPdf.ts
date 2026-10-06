import fs from "fs";

export function getBrowserExecutablePath(): string | undefined {
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

import path from "path";

export function inlineLocalImages(html: string): string {
  return html.replace(/src=["'](\/uploads\/[^"']+|\/[^"']+\.(?:png|jpg|jpeg|svg|webp))["']/gi, (match, srcPath) => {
    try {
      const cleanPath = srcPath.split("?")[0].replace(/^\//, "");
      const localPath = path.join(process.cwd(), "public", cleanPath);
      if (fs.existsSync(localPath)) {
        const ext = path.extname(cleanPath).replace(".", "").toLowerCase();
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
        const b64 = fs.readFileSync(localPath).toString("base64");
        return `src="data:${mime};base64,${b64}"`;
      }
    } catch {
      // ignore
    }
    return match;
  });
}

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const execPath = getBrowserExecutablePath();
  const processedHtml = inlineLocalImages(html);

  const browser = await (puppeteer as any).launch({
    headless: true,
    ...(execPath ? { executablePath: execPath } : {}),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(processedHtml, { waitUntil: "networkidle0", timeout: 15000 });
    const pdfUint8 = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close().catch(() => {});
  }
}
