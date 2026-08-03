"use client";

import React, { createContext, useContext } from "react";
import { useRecaptcha } from "@/lib/useRecaptcha";

interface RecaptchaContextType {
  executeRecaptcha: (action: string) => Promise<string | null>;
  isLoaded: boolean;
  siteKey: string;
}

const RecaptchaContext = createContext<RecaptchaContextType>({
  executeRecaptcha: async () => null,
  isLoaded: false,
  siteKey: "",
});

export const useRecaptchaContext = () => useContext(RecaptchaContext);

export default function RecaptchaProvider({ children }: { children: React.ReactNode }) {
  const recaptcha = useRecaptcha();

  return (
    <RecaptchaContext.Provider value={recaptcha}>
      {children}
    </RecaptchaContext.Provider>
  );
}
