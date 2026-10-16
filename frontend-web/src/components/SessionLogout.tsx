"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";

export function SessionLogout() {
  const router = useRouter();
  const user = useUserStore(state => state.user);
  const logout = useUserStore(state => state.logout);

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={() => { logout(); router.push("/"); }}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 text-sm font-bold text-red-700 shadow-sm hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 dark:border-red-900/60 dark:bg-neutral-900 dark:text-red-300 dark:hover:bg-red-950/30"
      title="Cerrar sesión"
    >
      <LogOut size={17} aria-hidden="true" />
      <span className="hidden sm:inline">Cerrar sesión</span>
    </button>
  );
}
