"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { AlertTriangle, ChefHat, Undo2, Check, Clock, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UserSessionStatus } from "@/components/UserSessionStatus";

function formatElapsedTime(createdAt: string, now: number) {
  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return "--:--";

  const elapsedSeconds = Math.max(0, Math.floor((now - createdAtMs) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// --- COMPONENTE IHC: ITEM CON VALIDADOR DE PREVENCIÓN DE ERROR (UNDO) ---
function ItemCocina({ item, orderTable, orderId, onRemoveItem }: any) {
  const [status, setStatus] = useState(item.cookStatus ?? 'PENDIENTE');
  const [countdown, setCountdown] = useState(8);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const updateBackendStatus = async (newStatus: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/order-items/${item.id}/cook-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookStatus: newStatus })
      });
    } catch (e) { console.error("Error updating status"); }
  };

  const handleStartPreparation = () => {
    setStatus('PREPARANDO');
    updateBackendStatus('PREPARANDO');
  };

  const handleConfirmPrepared = () => {
    setShowConfirmation(false);
    setStatus('UNDO_PHASE');
    setCountdown(8);
    intervalRef.current = setInterval(() => setCountdown(seconds => seconds - 1), 1000);
    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      updateBackendStatus('LISTO');
      onRemoveItem(orderId, item.id);
      toast.success(`Mesero notificado: ${item.product.name} de Mesa ${orderTable} listo.`);
    }, 8000);
  };

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
    setStatus('PREPARANDO');
    toast.info("Acción deshecha. El plato sigue en preparación.");
  };

  const isPending = status === 'PENDIENTE';
  const isPreparing = status === 'PREPARANDO';
  return (
    <div className={`p-4 rounded-2xl border transition-all ${isPreparing ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-400 dark:border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none'}`}>
      <div className="flex justify-between items-start gap-4">
        <h4 className={`font-bold text-lg ${isPreparing ? 'text-yellow-600 dark:text-yellow-500' : 'text-neutral-800 dark:text-neutral-200'}`}>
          <span className="mr-2">{item.quantity}x</span> {item.product.name}
        </h4>
        {isPreparing && <div className="bg-yellow-500 text-white dark:text-neutral-950 p-1.5 rounded-lg"><ChefHat size={16} /></div>}
      </div>
      {item.notes && <p className={`text-sm mt-2 font-medium italic ${isPreparing ? 'text-yellow-600 dark:text-yellow-400/80' : 'text-orange-600 dark:text-orange-400/80'}`}>📍 Nota: "{item.notes}"</p>}
      {status === 'UNDO_PHASE' ? (
        <div className="mt-4 bg-red-50 dark:bg-red-500/20 border border-red-300 dark:border-red-500 p-3 rounded-xl flex justify-between items-center gap-3" role="status" aria-live="polite">
          <div className="text-red-700 dark:text-red-400 font-bold">
            <p className="text-sm">Preparado</p>
            <p className="text-xs">Confirmando en {countdown}s...</p>
          </div>
          <button onClick={handleUndo} className="bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-bold text-xs hover:bg-red-500 active:scale-95 shadow-lg">
            <Undo2 size={16} /> DESHACER
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3">
          {isPreparing && <span className="flex items-center gap-2 text-sm font-bold text-yellow-700 dark:text-yellow-400"><ChefHat size={17} /> EN PREPARACIÓN</span>}
          {isPending && <span className="text-xs font-bold uppercase text-neutral-500">Pendiente</span>}
          {isPending ? (
            <button onClick={handleStartPreparation} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2.5 text-xs font-black text-neutral-950 transition-colors hover:bg-yellow-400">
              <ChefHat size={16} /> INICIAR PREPARACIÓN
            </button>
          ) : isPreparing ? (
            <button onClick={() => setShowConfirmation(true)} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-green-500">
              <Check size={16} /> PREPARADO
            </button>
          ) : null}
        </div>
      )}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby={`confirm-prepared-${item.id}`} aria-describedby={`confirm-prepared-description-${item.id}`} className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"><AlertTriangle size={22} /></div>
            <h3 id={`confirm-prepared-${item.id}`} className="text-lg font-black text-neutral-900 dark:text-white">¿Marcar como preparado?</h3>
            <p id={`confirm-prepared-description-${item.id}`} className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{item.quantity}x {item.product.name} · Mesa {orderTable}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowConfirmation(false)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">Cancelar</button>
              <button onClick={handleConfirmPrepared} className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-500">Sí, preparado</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- VISTA PRINCIPAL KDS ---
export default function CocinaPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [highlightedOrders, setHighlightedOrders] = useState<Set<number>>(() => new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alertTimeoutsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const { user } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    const unlockKitchenSound = async () => {
      try {
        const audioContext = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = audioContext;
        await audioContext.resume();
        soundEnabledRef.current = true;
        setSoundEnabled(true);
        window.removeEventListener("pointerdown", unlockKitchenSound);
        window.removeEventListener("keydown", unlockKitchenSound);
      } catch {
        // El navegador permitirá activar el audio en la siguiente interacción.
      }
    };
    window.addEventListener("pointerdown", unlockKitchenSound);
    window.addEventListener("keydown", unlockKitchenSound);
    return () => {
      window.removeEventListener("pointerdown", unlockKitchenSound);
      window.removeEventListener("keydown", unlockKitchenSound);
    };
  }, []);

  useEffect(() => {
    if (!user || (user.role !== 'COCINA' && user.role !== 'ADMIN')) {
      router.push("/");
      return;
    }

    const fetchKitchenOrders = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kitchen/orders`);
        if (res.ok) setOrders(await res.json());
      } catch (e) { console.error(e); }
    };

    const playBell = () => {
      const audioContext = audioContextRef.current;
      if (!soundEnabledRef.current || !audioContext || audioContext.state !== "running") return;

      const startAt = audioContext.currentTime;
      [880, 1174].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const noteStart = startAt + index * 0.12;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.18 : 0.12, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.75);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + 0.76);
      });
    };

    const alertKitchenOrder = (order: { id?: number } | null) => {
      const orderId = order?.id;
      if (orderId === undefined) {
        playBell();
        return;
      }

      setHighlightedOrders(prev => new Set(prev).add(orderId));
      const previousTimeout = alertTimeoutsRef.current.get(orderId);
      if (previousTimeout) clearTimeout(previousTimeout);
      const timeout = setTimeout(() => {
        setHighlightedOrders(prev => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
        alertTimeoutsRef.current.delete(orderId);
      }, 8000);
      alertTimeoutsRef.current.set(orderId, timeout);
      playBell();
    };

    fetchKitchenOrders();
    const socket = io(process.env.NEXT_PUBLIC_API_URL + "");
    socket.on("nueva_orden_creada", (order: { id?: number } | null) => {
      fetchKitchenOrders();
      alertKitchenOrder(order);
    });
    socket.on("nuevos_items_en_comanda", alertKitchenOrder);
    socket.on("orden_actualizada_items", fetchKitchenOrders);
    socket.on("orden_eliminada_por_vacia", fetchKitchenOrders);
    socket.on("orden_cancelada_admin", fetchKitchenOrders);
    return () => { socket.disconnect(); };
  }, [user, router]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => () => {
    alertTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    audioContextRef.current?.close();
  }, []);

  const toggleSound = async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      return;
    }

    try {
      const audioContext = audioContextRef.current ?? new AudioContext();
      await audioContext.resume();
      audioContextRef.current = audioContext;
      soundEnabledRef.current = true;
      setSoundEnabled(true);

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startAt = audioContext.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.75);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.76);
    } catch {
      toast.error("No se pudo activar el timbre en este navegador.");
    }
  };

  const handleRemoveItemLocally = (orderId: number, itemId: number) => {
    setOrders(prevOrders => {
      return prevOrders.map(order => {
        if (order.id === orderId) {
          const remainingItems = order.items.filter((i: any) => i.id !== itemId);
          return { ...order, items: remainingItems };
        }
        return order;
      }).filter(order => order.items.length > 0); 
    });
  };

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white p-6 md:p-10 selection:bg-yellow-500/30 transition-colors duration-500">
      <header className="flex justify-between items-center mb-8 border-b border-neutral-200 dark:border-neutral-900 pb-6 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-yellow-100 dark:bg-yellow-500/10 rounded-3xl border border-yellow-200 dark:border-yellow-500/20"><ChefHat className="text-yellow-500" size={36} /></div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">KDS <span className="text-yellow-500">COCINA</span></h1>
            <p className="text-neutral-500 text-xs uppercase font-bold tracking-widest mt-1">Pantalla de Despacho en Vivo - {user?.name}</p>
            <div className="mt-1"><UserSessionStatus /></div>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={toggleSound} aria-label={soundEnabled ? "Desactivar timbre" : "Activar timbre"} title={soundEnabled ? "Desactivar timbre" : "Activar timbre"} className={`p-3 rounded-xl border transition-all ${soundEnabled ? "bg-yellow-100 dark:bg-yellow-500/15 border-yellow-300 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-400" : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"}`}>
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders.map((o) => {
            const elapsedMs = now - new Date(o.createdAt).getTime();
            const isOverdue = Number.isFinite(elapsedMs) && elapsedMs >= 15 * 60 * 1000;
            const isNewOrder = highlightedOrders.has(o.id);

            return (
            <motion.div key={o.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`bg-white dark:bg-neutral-900/40 border-t-4 border-t-yellow-500 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-6 shadow-xl dark:shadow-2xl transition-colors ${isNewOrder ? "kitchen-order-alert border-rose-400 ring-2 ring-rose-400/50" : ""}`}>
              <div className="flex justify-between items-center mb-6">
                <div className="bg-neutral-100 dark:bg-neutral-950 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 transition-colors">
                  <h2 className="text-xl font-black text-neutral-900 dark:text-white">Mesa {o.table.number}</h2>
                </div>
                <div className="text-right">
                  <div className={`mb-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black tabular-nums ${isOverdue ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"}`} aria-label={`Tiempo transcurrido: ${formatElapsedTime(o.createdAt, now)}`}>
                    <Clock size={14} /> {formatElapsedTime(o.createdAt, now)}
                  </div>
                  <p className="text-neutral-500 text-[10px] font-bold uppercase leading-tight">
                    Pedido por:<br/><span className="text-neutral-800 dark:text-neutral-300">{o.user.name}</span>
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {o.items.map((item: any) => (
                  <ItemCocina key={item.id} item={item} orderTable={o.table.number} orderId={o.id} onRemoveItem={handleRemoveItemLocally} />
                ))}
              </div>
            </motion.div>
            );
          })}
          {orders.length === 0 && (
            <div className="col-span-full py-32 text-center">
              <ChefHat size={64} className="mx-auto text-neutral-300 dark:text-neutral-800 mb-6" />
              <p className="text-neutral-500 dark:text-neutral-600 text-xl font-bold uppercase tracking-widest">Cocina libre. No hay pedidos pendientes.</p>
            </div>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
}
