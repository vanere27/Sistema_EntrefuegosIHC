"use client";

import { useEffect, useState } from "react";
import { useOrderStore, type OrderItemInput } from "@/store/orderStore";
import { useUserStore } from "@/store/userStore";

function announceSaved(mode: "local" | "cloud" | "offline") {
  window.dispatchEvent(new CustomEvent("system:draft-saved", { detail: { mode, savedAt: new Date().toISOString() } }));
}

export function OrderDraftPersistence() {
  const user = useUserStore(state => state.user);
  const userId = user?.id ?? null;
  const sessionToken = user?.sessionToken ?? null;
  const items = useOrderStore(state => state.items);
  const restoreItems = useOrderStore(state => state.restoreItems);
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!userId || !sessionToken) {
      return;
    }

    let cancelled = false;
    const storageKey = `entre-fuegos:draft:${userId}`;

    const restoreDraft = async () => {
      let localDraft: { items?: OrderItemInput[]; savedAt?: string } | null = null;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) localDraft = JSON.parse(raw);
      } catch {
        localStorage.removeItem(storageKey);
      }

      if (localDraft && Array.isArray(localDraft.items)) {
        restoreItems(localDraft.items);
        announceSaved("local");
      } else {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/drafts`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
          });
          if (response.ok) {
            const snapshots = await response.json();
            if (snapshots[0] && Array.isArray(snapshots[0].items)) {
              restoreItems(snapshots[0].items);
              localStorage.setItem(storageKey, JSON.stringify({ items: snapshots[0].items, savedAt: snapshots[0].createdAt }));
              announceSaved("cloud");
            }
          }
        } catch {
          announceSaved("offline");
        }
      }

      if (!cancelled) setLoadedUserId(userId);
    };

    void restoreDraft();
    return () => { cancelled = true; };
  }, [userId, sessionToken, restoreItems]);

  useEffect(() => {
    if (!userId || !sessionToken || loadedUserId !== userId) return;

    const storageKey = `entre-fuegos:draft:${userId}`;
    const savedAt = new Date().toISOString();
    const snapshot = { items, savedAt };
    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      announceSaved("local");
    } catch {
      window.dispatchEvent(new CustomEvent("system:draft-saved", { detail: { mode: "offline", savedAt } }));
    }

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/drafts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ items })
        });
        announceSaved(response.ok ? "cloud" : "local");
      } catch {
        announceSaved("offline");
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [items, userId, sessionToken, loadedUserId]);

  return null;
}
