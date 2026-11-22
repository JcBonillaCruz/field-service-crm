import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";
import ConfirmHost from "@/components/ConfirmHost";
import InstallPrompt from "@/components/InstallPrompt";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

// Plus Jakarta Sans guardada dentro del proyecto (src/app/fonts). Antes se descargaba de Google Fonts en cada
// deploy, y si Google fallaba o cambiaba algo, el build de Vercel se caía. Ahora no depende de internet.
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Sign in | BrightPro",
  description:
    "BrightPro: invoicing, van inventory and dispatch for field service companies.",
  manifest: "/manifest.json",
  
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BrightPro" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Paso 6.1: idioma de la persona (cookie / navegador). Los textos llegan a los componentes del navegador
  // por NextIntlClientProvider (hereda las traducciones del servidor).
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${jakarta.className} bg-white text-slate-900 antialiased`}>
        <NextIntlClientProvider>
          <SplashScreen />
          <ConfirmHost />
          <InstallPrompt />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
