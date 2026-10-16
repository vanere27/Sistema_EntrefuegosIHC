"use client";

import { ArrowLeft, House } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function GlobalNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <nav aria-label="Navegación principal" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => router.back()}
        disabled={isHome}
        title="Volver a la página anterior"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 shadow-sm hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        <span className="hidden sm:inline">Volver</span>
      </button>
      <button
        type="button"
        onClick={() => router.push("/")}
        disabled={isHome}
        title="Ir a la página de inicio"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 shadow-sm hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
      >
        <House size={17} aria-hidden="true" />
        <span className="hidden sm:inline">Inicio</span>
      </button>
    </nav>
  );
}
