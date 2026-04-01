import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SplashScreenProvider } from "@/components/SplashScreenProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistema PAE - Barroblanco",
  description: "Sistema de Asistencia del Programa de Alimentación Escolar",
  manifest: "/manifest.json",
  icons: {
    apple: "/icon-512x512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PAE Barroblanco",
  },
};

export const viewport = {
  themeColor: "#4CAF50",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ThemeProvider>
          <SplashScreenProvider>
            {children}
          </SplashScreenProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
