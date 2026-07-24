"use client";

import { useEffect } from "react";
import { initBrandTheme } from "@/lib/theme";

export default function ThemeInitializer() {
  useEffect(() => {
    initBrandTheme();
  }, []);

  return null;
}
