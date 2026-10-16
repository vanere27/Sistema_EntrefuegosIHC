// src/app/mesas/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { User as UserIcon, Lock } from "lucide-react";
import { playWaiterReadyBell } from "@/components/NotificationSound";
import { UserSessionStatus } from "@/components/UserSessionStatus";

// Tipado basado en tu esquema Prisma
interface Table {
  id: number;
  number: number;
  capacity: number;
  status: string;
  activeOrder: { id: number; status: string; user: { id: number; name: string } } | null;
}

export default function MesasPage() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);

  const [mesas, setMesas] = useState<Table[]>([]);
  const [cargando, setCargando] = useState(true);

  // 1. Carga inicial y WebSockets
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    const fetchMesas = async () => {
      try {
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/tables");
        if (!res.ok) throw new Error("Error en red");
        const data = await res.json();
        setMesas(data);
        setCargando(false);
      } catch (error) {
        toast.error("Error al cargar el mapa de mesas");
        setCargando(false);
      }
    };
    
    fetchMesas();

    const socket = io(process.env.NEXT_PUBLIC_API_URL + "");
    
    socket.on("estado_mesa_actualizado", (data: { id: number, status: string }) => {
      setMesas((mesasActuales) => 
        mesasActuales.map((m) => m.id === data.id ? { ...m, status: data.status, activeOrder: data.status === 'libre' ? null : m.activeOrder } : m)
      );
    });

    socket.on("nueva_orden_creada", (order) => {
      setMesas(current => current.map(table => table.id === order.tableId
        ? { ...table, status: 'ocupada', activeOrder: { id: order.id, status: order.status, user: order.user } }
        : table));
    });

    socket.on("orden_actualizada_items", (order) => {
      setMesas(current => current.map(table => table.id === order.tableId
        ? { ...table, activeOrder: { id: order.id, status: order.status, user: order.user } }
        : table));
    });

    // --- ESCUCHADOR IHC: NOTIFICACIÓN DE COCINA (KDS) ---
    socket.on("item_cook_status_updated", (data) => {
      // Validamos que el plato esté LISTO y que el mesero actual sea el dueño de ese pedido
      if (data.cookStatus === 'LISTO' && data.order.userId === user?.id) {
        playWaiterReadyBell();
        toast.success(
          `¡ATENCIÓN! ${data.product.name} de la MESA ${data.order.table.number} está LISTO en cocina.`, 
          { duration: 8000 } 
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user, router]);

  // 2. FUNCIÓN ACTUALIZADA: Validación de seguridad y modo edición
  const handleMesaClick = async (mesa: Table) => {
    // Si la mesa está ocupada, verificamos quién la tiene
    if (mesa.status.toLowerCase() === "ocupada") {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/table/${mesa.id}`);
        const ordenActiva = await res.json();

        // VALIDACIÓN: Si hay una orden y el usuario logueado NO es el que la creó
        if (ordenActiva && ordenActiva.userId !== user?.id) {
          toast.error(`Mesa ${mesa.number} Bloqueada`, {
            description: `Esta mesa está siendo atendida por ${ordenActiva.user?.name || 'otro mesero'}.`,
            icon: <Lock size={16} />,
            style: { background: '#171717', color: '#f97316', border: '1px solid #f97316' }
          });
          return;
        }

        // Si es el mismo mesero, lo enviamos en modo EDICIÓN
        router.push(`/mesas/${mesa.id}?edit=true`);
      } catch (error) {
        toast.error("Error al verificar disponibilidad");
      }
      return;
    }

    // Si está libre, entra normal para una nueva orden
    router.push(`/mesas/${mesa.id}`);
  };

  return (
    // AQUÍ ESTÁ LA MAGIA 1: Fondo claro adaptativo en el contenedor principal
    <div className="min-h-[calc(100dvh-3.5rem)] bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white font-light p-6 transition-colors duration-500">
      
      {/* Barra superior de identidad */}
      <div className="flex justify-between items-center mb-10 border-b border-neutral-200 dark:border-neutral-800 pb-4 transition-colors">
        <div>
          <h1 className="text-3xl font-light text-neutral-800 dark:text-neutral-200 tracking-wide transition-colors">
            Salón <span className="text-orange-600 dark:text-orange-500 font-bold">Principal</span>
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm flex items-center gap-2 mt-1 transition-colors">
            <UserIcon size={14} className="text-orange-500" />
            Mesero: <span className="font-medium text-neutral-700 dark:text-neutral-300">{user?.name || "Desconocido"}</span>
          </p>
          <div className="ml-5 mt-1"><UserSessionStatus /></div>
        </div>
      </div>

      {/* Renderizado del Mapa de Mesas */}
      {cargando ? (
        <div className="flex justify-center items-center h-64 text-orange-500/50 animate-pulse text-xl">
          Cargando mapa de brasas...
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {mesas.map((mesa) => {
            const estaOcupada = mesa.status.toLowerCase() === "ocupada";
            return (
              <button
                key={mesa.id}
                onClick={() => handleMesaClick(mesa)}
                // MAGIA 3: Tarjetas de las mesas con colores claros y oscuros
                className={`
                  relative flex flex-col items-center justify-center p-8 rounded-[2.5rem] border transition-all duration-500 group
                  ${estaOcupada 
                     ? "bg-orange-50 dark:bg-neutral-900 border-orange-500/30 dark:border-orange-600/30 shadow-[0_0_20px_rgba(249,115,22,0.15)] dark:shadow-[0_0_30px_rgba(249,115,22,0.1)]" 
                     : "bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-green-500/20 hover:border-green-500 dark:hover:border-green-500 shadow-sm dark:shadow-none hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] dark:hover:shadow-[0_0_20px_rgba(34,197,94,0.1)]"
                  }
                `}
              >
                {/* Punto de estado */}
                <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${estaOcupada ? "bg-orange-500 shadow-[0_0_10px_#f97316]" : "bg-green-500 shadow-[0_0_10px_#22c55e]"}`}></div>
                
                <span className={`text-5xl font-light mb-2 transition-colors duration-300 ${estaOcupada ? "text-orange-600 dark:text-orange-500" : "text-neutral-700 dark:text-neutral-200 group-hover:text-green-600 dark:group-hover:text-green-400"}`}>
                  {mesa.number}
                </span>
                
                <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-500 font-bold transition-colors">
                  {estaOcupada ? "En Servicio" : "Disponible"}
                </span>
                {estaOcupada && mesa.activeOrder?.user?.name && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800 dark:bg-orange-500/10 dark:text-orange-300">
                    <UserIcon size={13} /> {mesa.activeOrder.user.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
