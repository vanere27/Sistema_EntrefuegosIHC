import type { Metadata } from "next";
import { Inter } from "next/font/google";

// @ts-ignore: Next.js procesa el CSS en compilación, silenciamos el falso positivo de TypeScript
import "./globals.css";

import { Toaster } from "sonner";
// Importamos el proveedor creado en el Paso 3
import { ThemeProvider } from "@/components/ThemeProvider"; 
import { NotificationSoundUnlock } from "@/components/NotificationSound";
import { SessionPresence } from "@/components/SessionPresence";
import { OrderDraftPersistence } from "@/components/OrderDraftPersistence";
import { SystemUtilities } from "@/components/SystemUtilities";
import { GlobalNavigation } from "@/components/GlobalNavigation";
import { SessionLogout } from "@/components/SessionLogout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Entre Fuegos",
  description: "Sistema de pedidos para el restaurante Entre Fuegos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 transition-colors duration-300`} 
  suppressHydrationWarning>
        
        {/* Envolvemos a los hijos y al Toaster con el ThemeProvider */}
        <ThemeProvider>
          <NotificationSoundUnlock />
          <SessionPresence />
          <OrderDraftPersistence />
          <div role="toolbar" aria-label="Herramientas del sistema, accesibilidad y tema" className="sticky top-0 z-50 flex h-14 items-center justify-end gap-2 border-b border-neutral-200 bg-neutral-100/95 px-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
            <GlobalNavigation />
            <SystemUtilities />
            <SessionLogout />
          </div>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        
      </body>
    </html>
  );
}
