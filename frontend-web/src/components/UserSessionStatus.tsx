"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/store/userStore";

export function UserSessionStatus() {
  const user = useUserStore(state => state.user);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    setOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!user) return null;
  const minutes = user.startedAt ? Math.max(0, Math.floor((now - new Date(user.startedAt).getTime()) / 60000)) : null;
  const status = !online
    ? "Sin conexión"
    : minutes === null
      ? "En línea"
      : `En línea · ${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  return <span role="status" aria-live="polite" className={`text-xs font-bold ${online ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>{status}</span>;
}
