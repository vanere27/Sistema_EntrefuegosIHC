"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  AlertTriangle, CircleHelp, History,
  Menu, Redo2, RotateCcw, Undo2, X
} from "lucide-react";
import { useOrderStore, type OrderItemInput } from "@/store/orderStore";
import { useUserStore } from "@/store/userStore";
import { AccessibilitySettings } from "@/components/AccessibilitySettings";
import { ThemeToggle } from "@/components/ThemeToggle";

type SystemError = { id: string; message: string; code: string; time: string };
type UtilityPanel = "tools" | "help" | "errors" | "restore" | "reset" | null;
type Snapshot = { id: number; items: OrderItemInput[]; createdAt: string };

export function SystemUtilities() {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const user = useUserStore(state => state.user);
  const undo = useOrderStore(state => state.undo);
  const redo = useOrderStore(state => state.redo);
  const canUndo = useOrderStore(state => state.undoStack.length > 0);
  const canRedo = useOrderStore(state => state.redoStack.length > 0);
  const restoreItems = useOrderStore(state => state.restoreItems);
  const [panel, setPanel] = useState<UtilityPanel>(null);
  const [online, setOnline] = useState(true);
  const [activeRequests, setActiveRequests] = useState(0);
  const [saveMode, setSaveMode] = useState<"local" | "cloud" | "offline" | null>(null);
  const [saveTime, setSaveTime] = useState<Date | null>(null);
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ mode: "local" | "cloud" | "offline"; savedAt: string }>).detail;
      setSaveMode(detail.mode);
      setSaveTime(new Date(detail.savedAt));
    };
    const addError = (message: string, code: string) => {
      setErrors(current => [...current, { id: `${Date.now()}-${Math.random()}`, message, code, time: new Date().toLocaleTimeString("es-CO") }].slice(-30));
    };
    const onWindowError = (event: ErrorEvent) => addError(event.message || "Error de interfaz", "APP");
    const onUnhandledRejection = (event: PromiseRejectionEvent) => addError(String(event.reason?.message ?? event.reason ?? "Error inesperado"), "PROMISE");

    const originalFetch = window.fetch;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const monitoredFetch: typeof window.fetch = async (input, init) => {
      const targetUrl = input instanceof Request ? input.url : String(input);
      const isApiRequest = Boolean(apiBase && targetUrl.startsWith(apiBase));
      if (!isApiRequest) return originalFetch(input, init);

      setActiveRequests(count => count + 1);
      try {
        const response = await originalFetch(input, init);
        if (!response.ok) {
          const body = await response.clone().json().catch(() => null);
          addError(body?.error || response.statusText || "El servidor rechazó la solicitud.", `HTTP ${response.status}`);
        }
        return response;
      } catch (error) {
        addError(error instanceof Error ? error.message : "No se pudo conectar con el servidor.", "RED");
        throw error;
      } finally {
        setActiveRequests(count => Math.max(0, count - 1));
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("system:draft-saved", onSaved);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.fetch = monitoredFetch;
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("system:draft-saved", onSaved);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      if (window.fetch === monitoredFetch) window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (!panel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [panel]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']"))) return;
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        router.back();
      } else if (event.altKey && event.key.toLowerCase() === "home") {
        event.preventDefault();
        router.push("/");
      } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      } else if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z")) {
        event.preventDefault();
        redo();
      } else if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setPanel("help");
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [router, undo, redo]);

  const loadSnapshots = async () => {
    if (!user?.sessionToken) {
      setSnapshots([]);
      return;
    }
    setLoadingSnapshots(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/drafts`, {
        headers: { Authorization: `Bearer ${user.sessionToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el historial.");
      setSnapshots(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el historial.");
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const openRestore = async () => {
    setPanel("restore");
    await loadSnapshots();
  };

  const restoreSnapshot = (snapshot: Snapshot) => {
    restoreItems(snapshot.items);
    setPanel(null);
    toast.success("Borrador restaurado en este dispositivo.");
  };

  const resetPersonalWorkspace = async () => {
    if (!user?.sessionToken || resetPhrase !== "RESTABLECER") return;
    setResetBusy(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/drafts`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.sessionToken}` }
      });
      if (!response.ok) throw new Error("No se pudo borrar el historial guardado.");

      localStorage.removeItem(`entre-fuegos:draft:${user.id}`);
      localStorage.removeItem(`entre-fuegos:accessibility:${user.id}`);
      localStorage.removeItem("theme");
      restoreItems([]);
      setTheme("dark");
      document.documentElement.style.fontSize = "100%";
      ["a11y-spaced-text", "a11y-high-contrast", "a11y-easy-reading", "a11y-visual-alerts", "a11y-sound-alerts", "a11y-reduced-motion"].forEach(className => document.documentElement.classList.remove(className));
      toast.success("Configuración personal restablecida.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo restablecer la configuración.");
    } finally {
      setResetBusy(false);
    }
  };

  const statusText = !online ? "Sin conexión" : activeRequests > 0 ? "Procesando" : saveMode === "offline" ? "Guardado local" : saveMode === "cloud" ? "Sincronizado" : "En línea";

  return (
    <div className="relative flex items-center gap-1">
      <button type="button" onClick={() => setPanel(current => current === "tools" ? null : "tools")} aria-label="Abrir herramientas del sistema" title="Herramientas del sistema" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 shadow-sm hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800">
        <Menu size={18} aria-hidden="true" /><span className="hidden md:inline">Sistema</span>
      </button>

      {panel && (
        <section className="fixed right-3 top-[4.5rem] z-[80] max-h-[calc(100dvh-5.25rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-neutral-300 bg-white p-5 text-neutral-900 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" aria-label="Herramientas del sistema">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-black">Sistema</h2><p className="mt-1 text-xs text-neutral-500">Estado: {statusText}{pathname ? ` · ${pathname}` : ""}</p></div>
            <button type="button" onClick={() => setPanel(null)} aria-label="Cerrar herramientas" className="rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"><X size={18} /></button>
          </div>

          {panel === "tools" && (
            <div className="space-y-4">
              <div className="space-y-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <p className="text-xs font-black uppercase tracking-wider text-neutral-500">Preferencias</p>
                <div className="flex flex-wrap gap-2">
                  <AccessibilitySettings />
                  <ThemeToggle />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={undo} disabled={!canUndo} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm font-bold disabled:opacity-40 dark:border-neutral-700"><Undo2 size={16} /> Deshacer</button>
                <button type="button" onClick={redo} disabled={!canRedo} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm font-bold disabled:opacity-40 dark:border-neutral-700"><Redo2 size={16} /> Rehacer</button>
                <button type="button" onClick={openRestore} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm font-bold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"><History size={16} /> Recuperar borrador</button>
                <button type="button" onClick={() => setPanel("help")} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm font-bold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"><CircleHelp size={16} /> Ayuda y atajos</button>
              </div>
              <button type="button" onClick={() => setPanel("errors")} className="flex min-h-11 w-full items-center justify-between rounded-lg border border-neutral-200 px-3 text-sm font-bold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"><span className="flex items-center gap-2"><AlertTriangle size={16} /> Registro de errores</span><span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">{errors.length}</span></button>
              {user?.sessionToken && <button type="button" onClick={() => { setResetPhrase(""); setPanel("reset"); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"><RotateCcw size={16} /> Restablecer configuración personal</button>}
              <p className="text-xs text-neutral-500">Último autoguardado: {saveTime ? saveTime.toLocaleTimeString("es-CO") : "pendiente"}</p>
            </div>
          )}

          {panel === "help" && (
            <div className="space-y-5 text-sm">
              <section><h3 className="mb-2 font-black">Atajos de teclado</h3><dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-neutral-600 dark:text-neutral-300"><dt>Volver</dt><dd><kbd>Alt</kbd> + <kbd>←</kbd></dd><dt>Inicio</dt><dd><kbd>Alt</kbd> + <kbd>Home</kbd></dd><dt>Deshacer</dt><dd><kbd>Ctrl</kbd> + <kbd>Z</kbd></dd><dt>Rehacer</dt><dd><kbd>Ctrl</kbd> + <kbd>Y</kbd></dd><dt>Abrir ayuda</dt><dd><kbd>?</kbd></dd></dl></section>
              <section><h3 className="mb-2 font-black">Preguntas frecuentes</h3><div className="space-y-3 text-neutral-600 dark:text-neutral-300"><p><strong>¿Se guarda el pedido si se cae internet?</strong><br />El borrador se guarda localmente y se sincroniza al volver la conexión.</p><p><strong>¿Puedo recuperar un borrador desde otro dispositivo?</strong><br />Sí, inicia sesión con la misma cuenta y abre “Recuperar borrador”.</p><p><strong>¿Deshacer revierte una comanda ya enviada?</strong><br />No. Deshacer/Rehacer solo actúa sobre el borrador pendiente de envío.</p></div></section>
              <p className="rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Ayuda de soporte: revisa el código y la hora en el registro de errores para identificar el fallo.</p>
            </div>
          )}

          {panel === "errors" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><p className="text-sm text-neutral-500">Errores recientes de red y aplicación</p><button type="button" onClick={() => setErrors([])} disabled={errors.length === 0} className="text-xs font-bold text-orange-600 disabled:opacity-40 dark:text-orange-400">Limpiar</button></div>
              {errors.length === 0 ? <p className="rounded-lg border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 dark:border-neutral-700">No hay errores registrados.</p> : <ul className="space-y-2">{[...errors].reverse().map(error => <li key={error.id} className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"><div className="flex justify-between gap-3"><span className="text-sm font-semibold">{error.message}</span><code className="shrink-0 text-xs font-bold text-red-700 dark:text-red-300">{error.code}</code></div><time className="mt-1 block text-xs text-neutral-500">{error.time}</time></li>)}</ul>}
            </div>
          )}

          {panel === "restore" && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">Versiones del borrador no enviado, disponibles en cualquier dispositivo de esta cuenta.</p>
              {loadingSnapshots ? <p className="py-5 text-sm">Buscando versiones...</p> : snapshots.length === 0 ? <p className="rounded-lg border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 dark:border-neutral-700">No hay versiones guardadas en la nube.</p> : snapshots.map(snapshot => <div key={snapshot.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"><span className="min-w-0"><span className="block text-sm font-bold">{snapshot.items.length} producto(s)</span><time className="mt-1 block text-xs text-neutral-500">{new Date(snapshot.createdAt).toLocaleString("es-CO")}</time></span><button type="button" onClick={() => restoreSnapshot(snapshot)} className="min-h-9 shrink-0 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white">Restaurar</button></div>)}
            </div>
          )}

          {panel === "reset" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"><h3 className="font-black">Consecuencias</h3><p className="mt-2">Se eliminarán los borradores no enviados de esta cuenta y sus preferencias de accesibilidad/tema. No se borran ventas, órdenes enviadas, pagos, productos, mesas ni usuarios.</p></div>
              <label className="block text-sm font-semibold">Escribe RESTABLECER para confirmar<input value={resetPhrase} onChange={event => setResetPhrase(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950" /></label>
              <button type="button" disabled={resetPhrase !== "RESTABLECER" || resetBusy} onClick={resetPersonalWorkspace} className="min-h-11 w-full rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-40">{resetBusy ? "Restableciendo..." : "Restablecer esta cuenta"}</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
