"use client";

import { useEffect, useState, useCallback } from "react";

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

/**
 * Reusable React Hook to execute Google reCAPTCHA v3 on public form submissions.
 */
export function useRecaptcha() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey || siteKey.includes("YOUR_RECAPTCHA")) {
      return;
    }

    // Check if script is already present
    const scriptId = "google-recaptcha-v3-script";
    if (document.getElementById(scriptId)) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsLoaded(true);
    };
    script.onerror = () => {
      console.warn("Failed to load Google reCAPTCHA v3 script.");
    };

    document.head.appendChild(script);
  }, [siteKey]);

  const executeRecaptcha = useCallback(
    async (action: string): Promise<string | null> => {
      if (!siteKey || siteKey.includes("YOUR_RECAPTCHA")) {
        // Return null when siteKey is not configured (graceful dev mode fallback)
        return null;
      }

      if (typeof window === "undefined" || !window.grecaptcha) {
        console.warn("grecaptcha is not initialized yet on window object.");
        return null;
      }

      try {
        return await new Promise<string | null>((resolve) => {
          window.grecaptcha.ready(async () => {
            try {
              const token = await window.grecaptcha.execute(siteKey, { action });
              resolve(token);
            } catch (err) {
              console.error("Error executing grecaptcha.execute:", err);
              resolve(null);
            }
          });
        });
      } catch (err) {
        console.error("Failed to retrieve reCAPTCHA token:", err);
        return null;
      }
    },
    [siteKey]
  );

  return {
    executeRecaptcha,
    isLoaded,
    siteKey,
  };
}
