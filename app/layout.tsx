import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistema PAE - Barroblanco",
  description: "Sistema de Asistencia del Programa de Alimentación Escolar",
  manifest: "/manifest.json",
  icons: {
    apple: "/icon-512x512.png",
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
      <body className={inter.className}>{children}</body>
    </html>
  );
}
