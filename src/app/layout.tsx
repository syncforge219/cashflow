import type { Metadata } from "next";
import "../globals.css";
import UserProvider from "./component/context/user-context";
import ThemeInitializer from "@/components/ThemeInitializer";

export const metadata: Metadata = {
  title: "CashFlow Management | Modern CRM & Financial Intelligence",
  description: "Enterprise CashFlow & Lead Intelligence Management System",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
        <UserProvider>
          <ThemeInitializer />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
