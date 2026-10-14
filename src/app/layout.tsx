import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { cn } from "@/lib/utils";

// Las fuentes viven en el repositorio (entrega 8): con next/font/google cada
// build las descargaba de Google y un fallo de esa descarga rompio el
// despliegue de produccion del grupo 4. Son los mismos archivos que servia
// Google (subconjunto latino, ver fonts/README.md), con los mismos pesos y
// estilos. La familia toma el nombre de la constante (geist, oswald,
// jetBrainsMono): no se cambia con declarations, porque la variable CSS seguiria
// usando el nombre de la constante.
const geist = localFont({
  src: "./fonts/geist-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans",
});
// Oswald es variable, pero Google declaraba cada peso por separado sobre el
// mismo archivo: un peso intermedio (650) se resuelve en 700, no en 650.
const oswald = localFont({
  src: [
    { path: "./fonts/oswald-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/oswald-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/oswald-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-oswald",
});
const jetBrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "500",
  style: "normal",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Industrias Aceros Perú",
  description: "Sistema de Gestión Integral para Industrias Aceros Perú",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={cn(
        "font-sans",
        geist.variable,
        oswald.variable,
        jetBrainsMono.variable,
      )}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <NotificationProvider />
        {children}
      </body>
    </html>
  );
}
