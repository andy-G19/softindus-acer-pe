import type { Metadata } from "next";
import "./globals.css";
import { Geist, JetBrains_Mono, Oswald } from "next/font/google";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Industrias Aceros Perú",
  description: "Sistema de Gestión Integral para Industrias Aceros Perú",
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
