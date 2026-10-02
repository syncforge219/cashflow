import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

export async function resolve(specifier, context, nextResolve) {
  let resolvedPath = null;

  if (specifier === "next/headers") {
    return nextResolve("next/headers.js", context);
  }
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }

  if (specifier.startsWith("@/")) {
    const subpath = specifier.slice(2);
    resolvedPath = path.resolve(process.cwd(), "src", subpath);
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    try {
      const parentDir = path.dirname(new URL(context.parentURL).pathname.replace(/^\/([a-zA-Z]:)/, "$1"));
      resolvedPath = path.resolve(parentDir, specifier);
    } catch (_) {}
  }

  if (resolvedPath) {
    const candidates = [
      resolvedPath,
      resolvedPath + ".ts",
      resolvedPath + ".js",
      resolvedPath + ".tsx",
      resolvedPath + ".json",
      path.join(resolvedPath, "index.ts"),
      path.join(resolvedPath, "index.js"),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
        return nextResolve(pathToFileURL(cand).href, context);
      }
    }
  }

  return nextResolve(specifier, context);
}
