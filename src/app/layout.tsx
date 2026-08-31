import type { Metadata } from "next";
import "../globals.css";
import UserProvider from "./component/context/user-context";
import { ThemeProvider } from "./component/context/theme-context";
import ThemeScript from "@/components/ThemeScript";
import ThemeInitializer from "@/components/ThemeInitializer";
import RecaptchaProvider from "@/components/RecaptchaProvider";

export const metadata: Metadata = {
  title: "Lead2Ledger Management | Modern CRM & Financial Intelligence",
  description: "Enterprise Lead2Ledger & Lead Intelligence Management System",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <ThemeProvider>
          <UserProvider>
            <RecaptchaProvider>
              <ThemeInitializer />
              {children}
            </RecaptchaProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
