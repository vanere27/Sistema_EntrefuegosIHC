"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useUserStore } from "@/store/userStore";

export function SessionPresence() {
  const user = useUserStore(state => state.user);
  const sessionToken = useUserStore(state => state.user?.sessionToken);
  const logout = useUserStore(state => state.logout);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (!sessionToken) {
      logout();
      toast.error("La sesión expiró. Inicia sesión nuevamente.");
      router.replace("/");
      return;
    }

    const socket = io(process.env.NEXT_PUBLIC_API_URL + "", { auth: { sessionToken } });
    socket.on("session:revoked", () => {
      logout();
      toast.error("Tu sesión fue cerrada por administración.");
      router.replace("/");
    });

    return () => { socket.disconnect(); };
  }, [user, sessionToken, logout, router]);

  return null;
}