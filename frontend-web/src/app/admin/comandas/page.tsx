"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { 
  Clock, CheckCircle2, Flame, User, Utensils, 
  DollarSign, LogOut, ShieldCheck, Activity, 
  History, LayoutDashboard, TrendingUp, Users, Target, Calendar, ArrowLeft, Printer,
  AlertTriangle, ChevronDown, Search, X, BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UserSessionStatus } from "@/components/UserSessionStatus";

// --- 1. COMPONENTE IHC: TARJETA DE ORDEN CON SEMÁFORO ---
function OrderCard({ c, handleIniciarCobro }: { c: any, handleIniciarCobro: (comanda: any) => void }) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const calculateTime = () => {
      const orderTime = new Date(c.createdAt).getTime();
      const differenceInMs = Date.now() - orderTime;
      setElapsedMinutes(Math.floor(differenceInMs / 60000));
    };
    calculateTime(); 
    const interval = setInterval(calculateTime, 60000); 
    return () => clearInterval(interval);
  }, [c.createdAt]);

  const total = c.items.reduce((acc: number, i: any) => acc + (i.product.price * i.quantity), 0);

  let statusClasses = "border-t-green-500 bg-green-50 dark:bg-green-950/20 shadow-green-900/10 dark:shadow-green-900/20";
  let iconColor = "text-green-600 dark:text-green-500";
  let TimeIcon = Clock;
  let pulse = "";

  if (elapsedMinutes >= 20) {
    statusClasses = "border-t-red-500 bg-red-50 dark:bg-red-950/30 shadow-red-900/10 dark:shadow-red-900/30";
    iconColor = "text-red-600 dark:text-red-500";
    TimeIcon = AlertTriangle;
    pulse = "animate-pulse"; 
  } else if (elapsedMinutes >= 10) {
    statusClasses = "border-t-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 shadow-yellow-900/10 dark:shadow-yellow-900/20";
    iconColor = "text-yellow-600 dark:text-yellow-500";
  }

  return (
    <div className={`border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-7 flex flex-col relative border-t-4 group transition-colors duration-500 ${statusClasses}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="bg-orange-600 text-white px-5 py-2 rounded-2xl text-2xl font-black italic shadow-lg shadow-orange-500/20">
          #{c.table.number}
        </div>
        <div className="text-right">
          <div className={`flex items-center justify-end gap-1 font-bold text-sm mb-1 ${iconColor} ${pulse}`} aria-label={`Tiempo de espera: ${elapsedMinutes} minutos`}>
            <TimeIcon size={14} />
            <span>{elapsedMinutes} min</span>
          </div>
          <p className="text-neutral-400 text-[10px] uppercase font-bold">{c.user.name}</p>
        </div>
      </div>
      <div className="mb-6 p-4 bg-white dark:bg-neutral-950/80 rounded-2xl border border-orange-500/10 flex justify-between items-center shadow-inner">
        <span className="text-neutral-600 uppercase text-[9px] font-bold">Cuenta</span>
        <span className="text-2xl font-mono text-orange-600 dark:text-orange-500 font-bold">${total.toLocaleString()}</span>
      </div>
      <div className="flex-1 space-y-4 mb-8 max-h-52 overflow-y-auto pr-2 custom-scrollbar">
        {c.items.map((item: any, idx: number) => (
          <div key={idx} className="border-b border-neutral-200 dark:border-neutral-800/40 pb-3 last:border-0">
            <p className="text-sm text-neutral-800 dark:text-neutral-300 font-medium">
              <span className="text-orange-600 dark:text-orange-500 font-bold mr-2">{item.quantity}x</span> {item.product.name}
            </p>
            {item.notes && (
              <p className="text-[10px] text-orange-600 dark:text-orange-400/70 italic mt-1 bg-orange-50 dark:bg-orange-500/5 p-1 px-2 rounded-lg leading-tight">
                "{item.notes}"
              </p>
            )}
          </div>
        ))}
      </div>
      <button 
        onClick={() => handleIniciarCobro(c)} 
        className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-[1.5rem] font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
      >
        <Printer size={16} /> REVISAR Y COBRAR
      </button>
    </div>
  );
}

// --- COMPONENTE IHC 2: ITEM DE FILA DE ESPERA CON CONTADOR ---
function WaitlistItem({ w, idx, mesasLibres, handleAsignarMesa }: any) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  useEffect(() => {
    const calculateTime = () => {
      const waitTime = new Date(w.createdAt).getTime();
      const differenceInMs = Date.now() - waitTime;
      setElapsedMinutes(Math.floor(differenceInMs / 60000));
    };
    calculateTime();
    const interval = setInterval(calculateTime, 60000);
    return () => clearInterval(interval);
  }, [w.createdAt]);

  let timeColor = "text-green-600 dark:text-green-500";
  if (elapsedMinutes >= 15) timeColor = "text-red-600 dark:text-red-500 animate-pulse";
  else if (elapsedMinutes >= 10) timeColor = "text-yellow-600 dark:text-yellow-500";

  return (
    <div className="bg-white dark:bg-neutral-900/30 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors">
      <div className="flex items-center gap-4">
        <div className="bg-neutral-100 dark:bg-neutral-950 p-4 rounded-2xl font-black text-2xl text-neutral-600 transition-colors">#{idx + 1}</div>
        <div>
          <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{w.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-orange-600 dark:text-orange-500 font-bold uppercase tracking-widest">{w.partySize} Personas</p>
            <span className={`flex items-center gap-1 text-xs font-bold ${timeColor}`} aria-label={`Esperando hace ${elapsedMinutes} minutos`}>
              <Clock size={12} /> {elapsedMinutes} min
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select 
          className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white p-3 rounded-xl outline-none text-sm cursor-pointer hover:border-orange-500 transition-colors"
          onChange={(e) => handleAsignarMesa(w, e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>Seleccionar Mesa Libre...</option>
          {mesasLibres.filter((m: any) => m.status === 'libre').map((m: any) => (
            <option key={m.id} value={m.id}>Mesa {m.number} (Soporta: {m.capacity})</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function AdminControlSection({
  title,
  summary,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-neutral-200 py-2 dark:border-neutral-800">
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-16 w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition-colors hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:hover:bg-neutral-900">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">{icon}</span>
          <span className="min-w-0">
            <span className="block font-black text-neutral-900 dark:text-white">{title}</span>
            <span className="mt-0.5 block truncate text-xs text-neutral-500">{summary}</span>
          </span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-neutral-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="px-4 pb-5 pt-3">{children}</div>}
    </section>
  );
}

// --- 2. COMPONENTE PRINCIPAL ---
type DashboardSummary = {
  total: number;
  serviceTotal: number;
  paymentCount: number;
  orderCount: number;
  byTable: { tableId: number; table: number; total: number; serviceTotal: number; payments: number }[];
  byWaiter: { userId: number; name: string; role: string; total: number; serviceTotal: number; payments: number }[];
  sessions: { id: number; userId: number; name: string; role: string; loginAt: string; logoutAt: string | null; durationMinutes: number; active: boolean }[];
};

export default function AdminComandasPage() {
  const [comandas, setComandas] = useState<any[]>([]); 
  const [historialHoy, setHistorialHoy] = useState<any[]>([]); 
  const [archivoFechas, setArchivoFechas] = useState<any[]>([]); 
  const [historialPasado, setHistorialPasado] = useState<any[]>([]); 
  const [busquedaCuenta, setBusquedaCuenta] = useState("");
  
  const [activeTab, setActiveTab] = useState<'vivas' | 'espera' | 'hoy' | 'dashboard' | 'archivo' | 'control'>('vivas');
  const [expandedControlSection, setExpandedControlSection] = useState<'users' | 'sessions' | 'tables' | 'processes' | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  const [ordenParaImprimir, setOrdenParaImprimir] = useState<any | null>(null);
  const [ordenParaCobrar, setOrdenParaCobrar] = useState<any | null>(null);
  const [itemsSeleccionadosPago, setItemsSeleccionadosPago] = useState<number[]>([]);
  const [incluirServicio, setIncluirServicio] = useState(false);
  const [procesandoPago, setProcesandoPago] = useState(false);

  // --- ESTADOS PARA FILA DE ESPERA (IHC) ---
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [mesasLibres, setMesasLibres] = useState<any[]>([]);
  const [sesionesActivas, setSesionesActivas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [mesaParaLiberar, setMesaParaLiberar] = useState<any | null>(null);
  const [sesionParaCerrar, setSesionParaCerrar] = useState<any | null>(null);
  const [procesandoControl, setProcesandoControl] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState({ name: '', pin: '', role: 'CAJERO' });
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [formWait, setFormWait] = useState({ name: '', partySize: 1, phone: '' });
  const [dashboardFrom, setDashboardFrom] = useState('');
  const [dashboardTo, setDashboardTo] = useState('');
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');

  const router = useRouter();
  const { user, logout } = useUserStore();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const localValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    setDashboardFrom(localValue(start));
    setDashboardTo(localValue(now));
  }, []);

  useEffect(() => {
    if (!user || !['ADMIN', 'CAJERO'].includes(user.role) || !user.sessionToken) {
      if (user && !user.sessionToken) logout();
      router.replace("/");
      return;
    }
    const fetchData = async () => {
      try {
        const [resVivas, resHoy, resFechas, resWait, resTables, resSessions] = await Promise.all([
          fetch(process.env.NEXT_PUBLIC_API_URL + "/api/orders/active", { headers: { Authorization: `Bearer ${user.sessionToken}` } }),
          fetch(process.env.NEXT_PUBLIC_API_URL + "/api/orders/history", { headers: { Authorization: `Bearer ${user.sessionToken}` } }),
          isAdmin ? fetch(process.env.NEXT_PUBLIC_API_URL + "/api/orders/archive-dates", { headers: { Authorization: `Bearer ${user.sessionToken}` } }) : Promise.resolve(null),
          fetch(process.env.NEXT_PUBLIC_API_URL + "/api/waitlist", { headers: { Authorization: `Bearer ${user.sessionToken}` } }),
          fetch(process.env.NEXT_PUBLIC_API_URL + "/api/tables"),
          isAdmin ? fetch(process.env.NEXT_PUBLIC_API_URL + "/api/admin/sessions", { headers: { Authorization: `Bearer ${user.sessionToken}` } }) : Promise.resolve(null)
        ]);
        if (resVivas.ok) setComandas(await resVivas.json());
        if (resHoy.ok) setHistorialHoy(await resHoy.json());
        if (resFechas?.ok) setArchivoFechas(await resFechas.json());
        if (resWait.ok) setWaitlist(await resWait.json());
        if (resTables.ok) setMesasLibres(await resTables.json());
        if (resSessions?.ok) setSesionesActivas(await resSessions.json());
        if (isAdmin) {
          const resUsers = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/admin/users", { headers: { Authorization: `Bearer ${user.sessionToken}` } });
          if (resUsers.ok) setUsuarios(await resUsers.json());
        }
      } catch (error) { console.log("Error de conexión"); }
    };
    fetchData();

    const socket = io(process.env.NEXT_PUBLIC_API_URL + "", { auth: { sessionToken: user.sessionToken } });
    
    socket.on("nueva_orden_creada", (nueva) => setComandas(p => [nueva, ...p]));
    
    socket.on("orden_finalizada_admin", async () => { 
       const resHoy = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/orders/history", { headers: { Authorization: `Bearer ${user.sessionToken}` } });
       if (resHoy.ok) setHistorialHoy(await resHoy.json());
    });

    socket.on("orden_actualizada_items", (actualizada) => {
      if (actualizada.status === 'COMPLETADA') {
        setComandas(current => current.filter(order => order.id !== actualizada.id));
        return;
      }
      const saldoPendiente = {
        ...actualizada,
        items: actualizada.items
          .filter((item: any) => item.quantity > item.paidQuantity)
          .map((item: any) => ({ ...item, quantity: item.quantity - item.paidQuantity }))
      };
      setComandas(current => current.map(order => order.id === actualizada.id ? saldoPendiente : order));
      setHistorialHoy(current => current.map(order => order.id === actualizada.id ? actualizada : order));
    });

    socket.on("orden_eliminada_por_vacia", (data) => {
      setComandas(prevComandas => prevComandas.filter(c => c.id !== data.id)); 
      toast.info(`Mesa ${data.tableId} cancelada (Sin productos)`);
    });

    socket.on("estado_mesa_actualizado", (data) => {
      setMesasLibres(prev => prev.map(m => m.id === data.id ? { ...m, status: data.status } : m));
    });

    const refreshSessions = async () => {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/admin/sessions", { headers: { Authorization: `Bearer ${user.sessionToken}` } });
      if (res.ok) setSesionesActivas(await res.json());
    };
    if (isAdmin) socket.on("admin:sessions-updated", refreshSessions);
    socket.on("orden_cancelada_admin", (data: { tableId: number; orderIds: number[] }) => {
      setComandas(prev => prev.filter(order => !data.orderIds.includes(order.id)));
      setMesasLibres(prev => prev.map(table => table.id === data.tableId ? { ...table, status: 'libre' } : table));
    });

    socket.on("waitlist_updated", (data) => {
      if (data.status === 'SEATED') {
        setWaitlist(p => p.filter(w => w.id !== data.id));
      } else if (data.status === 'WAITING') {
        setWaitlist(p => {
          const existe = p.find(w => w.id === data.id);
          return existe ? p : [...p, data];
        });
      }
    });

    return () => { socket.disconnect(); };
  }, [user, router]);

  const handleAgregarEspera = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.sessionToken}` },
        body: JSON.stringify(formWait)
      });
      if (res.ok) {
        const nuevo = await res.json();
        setWaitlist(p => [...p.filter(w => w.id !== nuevo.id), nuevo]);
        setFormWait({ name: '', partySize: 1, phone: '' });
        toast.success("Cliente en fila de espera");
      }
    } catch (error) { toast.error("Error al registrar cliente"); }
  };

  const handleAsignarMesa = async (clienteEspera: any, tableIdStr: string) => {
    if (!tableIdStr) return;
    const mesaSeleccionada = mesasLibres.find(m => m.id === Number(tableIdStr));
    
    if (mesaSeleccionada && mesaSeleccionada.capacity < clienteEspera.partySize) {
      toast.error(
        `Error: El grupo es de ${clienteEspera.partySize} personas, pero la Mesa ${mesaSeleccionada.number} soporta máximo ${mesaSeleccionada.capacity}.`, 
        { duration: 5000 }
      );
      return; 
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/waitlist/${clienteEspera.id}/seat`, { method: 'PATCH', headers: { Authorization: `Bearer ${user?.sessionToken}` } });
      if (res.ok) {
        setWaitlist(p => p.filter(w => w.id !== clienteEspera.id));
        toast.success(`${clienteEspera.name} asignado a Mesa ${mesaSeleccionada.number}`);
      }
    } catch (error) { toast.error("Error al asignar mesa"); }
  };

  const calcularStats = (lista: any[]) => {
    const orderPaidTotal = (order: any) => Array.isArray(order.payments) && order.payments.length > 0
      ? order.payments.reduce((sum: number, payment: any) => sum + payment.total, 0)
      : order.items.reduce((sum: number, item: any) => sum + item.product.price * item.quantity, 0);
    const total = lista.reduce((acc, order) => acc + orderPaidTotal(order), 0);
    const ventasPorMesa = lista.reduce((acc: any, o) => {
      const mesa = o.table.number;
      const totalO = orderPaidTotal(o);
      acc[mesa] = (acc[mesa] || 0) + totalO;
      return acc;
    }, {});
    return { total, cantidad: lista.length, ventasPorMesa, ticket: lista.length > 0 ? total / lista.length : 0 };
  };

  const statsHoy = useMemo(() => calcularStats(historialHoy), [historialHoy]);
  const statsPasado = useMemo(() => calcularStats(historialPasado), [historialPasado]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !user?.sessionToken || !dashboardFrom || !dashboardTo) return;
    const loadDashboard = async () => {
      setDashboardLoading(true);
      try {
        const params = new URLSearchParams({ from: new Date(dashboardFrom).toISOString(), to: new Date(dashboardTo).toISOString() });
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/summary?${params}`, { headers: { Authorization: `Bearer ${user.sessionToken}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo cargar el dashboard.');
        setDashboardSummary(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo cargar el dashboard.');
      } finally {
        setDashboardLoading(false);
      }
    };
    void loadDashboard();
  }, [activeTab, dashboardFrom, dashboardTo, user?.sessionToken]);

  const dashboardFilter = useMemo(() => {
    const query = dashboardSearch.trim().toLocaleLowerCase('es');
    if (!dashboardSummary || !query) {
      return dashboardSummary ? { ...dashboardSummary, filteredByTable: dashboardSummary.byTable, filteredByWaiter: dashboardSummary.byWaiter, filteredSessions: dashboardSummary.sessions } : null;
    }
    const tableQuery = query.replace(/^mesa\s*/, '');
    const filteredByTable = dashboardSummary.byTable.filter(row => String(row.table).includes(tableQuery));
    const filteredByWaiter = dashboardSummary.byWaiter.filter(row => row.name.toLocaleLowerCase('es').includes(query));
    const filteredSessions = dashboardSummary.sessions.filter(session => session.name.toLocaleLowerCase('es').includes(query));
    return { ...dashboardSummary, filteredByTable, filteredByWaiter, filteredSessions };
  }, [dashboardSearch, dashboardSummary]);

  const dashboardMatchesTable = Boolean(dashboardSearch.trim()) && (dashboardFilter?.filteredByTable.length ?? 0) > 0;
  const dashboardMatchesWaiter = Boolean(dashboardSearch.trim()) && !dashboardMatchesTable && (dashboardFilter?.filteredByWaiter.length ?? 0) > 0;
  const dashboardTotal = !dashboardFilter ? 0 : !dashboardSearch.trim() ? dashboardFilter.total : dashboardMatchesTable ? dashboardFilter.filteredByTable.reduce((sum, row) => sum + row.total, 0) : dashboardMatchesWaiter ? dashboardFilter.filteredByWaiter.reduce((sum, row) => sum + row.total, 0) : 0;
  const dashboardPayments = !dashboardFilter ? 0 : !dashboardSearch.trim() ? dashboardFilter.paymentCount : dashboardMatchesTable ? dashboardFilter.filteredByTable.reduce((sum, row) => sum + row.payments, 0) : dashboardMatchesWaiter ? dashboardFilter.filteredByWaiter.reduce((sum, row) => sum + row.payments, 0) : 0;
  const comandasFiltradas = useMemo(() => {
    const query = busquedaCuenta.trim().toLocaleLowerCase("es");
    if (!query) return comandas;
    return comandas.filter(order =>
      String(order.table.number).includes(query) || order.user.name.toLocaleLowerCase("es").includes(query)
    );
  }, [busquedaCuenta, comandas]);
  const lineasPagoSeleccionadas = (ordenParaCobrar?.items ?? []).filter((item: any) => itemsSeleccionadosPago.includes(item.id));
  const subtotalPago = lineasPagoSeleccionadas.reduce((total: number, item: any) => total + item.product.price * item.quantity, 0);
  const servicioPago = incluirServicio ? Math.round(subtotalPago * 0.1) : 0;

  const verDiaPasado = async (dateStr: string) => {
    const soloFecha = dateStr.split('T')[0];
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/history-by-date?date=${soloFecha}`, { headers: { Authorization: `Bearer ${user?.sessionToken}` } });
    if (res.ok) {
      setHistorialPasado(await res.json());
      setFechaSeleccionada(soloFecha);
    }
  };

  const handleIniciarCobro = (comanda: any) => {
    setOrdenParaCobrar(comanda);
    setItemsSeleccionadosPago(comanda.items.map((item: any) => item.id));
    setIncluirServicio(false);
  };

  const handleConfirmarPago = async () => {
    if (!ordenParaCobrar || !user?.sessionToken || itemsSeleccionadosPago.length === 0) return;
    setProcesandoPago(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${ordenParaCobrar.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.sessionToken}` },
        body: JSON.stringify({ itemIds: itemsSeleccionadosPago, includeService: incluirServicio })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el pago.');

      if (data.completed) {
        setComandas(current => current.filter(order => order.id !== ordenParaCobrar.id));
        toast.success(`Cuenta de Mesa ${ordenParaCobrar.table.number} pagada y finalizada.`);
      } else {
        const pendingItems = data.order.items
          .filter((item: any) => item.quantity > item.paidQuantity)
          .map((item: any) => ({ ...item, quantity: item.quantity - item.paidQuantity }));
        setComandas(current => current.map(order => order.id === data.order.id ? { ...data.order, items: pendingItems } : order));
        toast.success(`Pago registrado. Quedan ${pendingItems.length} productos por pagar en Mesa ${ordenParaCobrar.table.number}.`);
      }

      setOrdenParaCobrar(null);
      setItemsSeleccionadosPago([]);
      setOrdenParaImprimir({ ...data.order, items: data.payment.items, payment: data.payment });
      setTimeout(() => {
        window.print();
        setOrdenParaImprimir(null);
      }, 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
    } finally {
      setProcesandoPago(false);
    }
  };

  const handleRevocarSesion = async () => {
    if (!sesionParaCerrar || !user?.sessionToken) return;
    setProcesandoControl(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/sessions/${sesionParaCerrar.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.sessionToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cerrar la sesión.');
      setSesionesActivas(prev => prev.filter(session => session.id !== sesionParaCerrar.id));
      toast.success(`Sesión de ${sesionParaCerrar.name} cerrada.`);
      setSesionParaCerrar(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.');
    } finally {
      setProcesandoControl(false);
    }
  };

  const handleLiberarMesa = async () => {
    if (!mesaParaLiberar || !user?.sessionToken) return;
    setProcesandoControl(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tables/${mesaParaLiberar.id}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.sessionToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo liberar la mesa.');
      setMesasLibres(prev => prev.map(table => table.id === mesaParaLiberar.id ? { ...table, status: 'libre' } : table));
      setComandas(prev => prev.filter(order => !data.cancelledOrderIds.includes(order.id)));
      toast.success(`Mesa ${mesaParaLiberar.number} liberada. Las comandas activas quedaron canceladas y conservadas.`);
      setMesaParaLiberar(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo liberar la mesa.');
    } finally {
      setProcesandoControl(false);
    }
  };

  const handleCrearUsuario = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.sessionToken || !/^\d{4}$/.test(nuevoUsuario.pin)) {
      toast.error("El PIN debe tener exactamente cuatro dígitos.");
      return;
    }

    setCreandoUsuario(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.sessionToken}` },
        body: JSON.stringify(nuevoUsuario)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el usuario.');
      setUsuarios(current => [...current, data].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      setNuevoUsuario({ name: '', pin: '', role: 'CAJERO' });
      toast.success(`Cuenta ${data.role.toLowerCase()} creada para ${data.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      setCreandoUsuario(false);
    }
  };

  let totalConsumo = 0, baseImpoconsumo = 0, valorImpoconsumo = 0, propina = 0, totalConPropina = 0;
  if (ordenParaImprimir) {
    totalConsumo = ordenParaImprimir.payment?.subtotal ?? ordenParaImprimir.items.reduce((acc: number, i: any) => acc + (i.product.price * i.quantity), 0);
    baseImpoconsumo = totalConsumo / 1.08; 
    valorImpoconsumo = totalConsumo - baseImpoconsumo; 
    propina = ordenParaImprimir.payment?.serviceAmount ?? 0;
    totalConPropina = ordenParaImprimir.payment?.total ?? totalConsumo + propina;
  }

  const formatoMoneda = (num: number) => Math.round(num).toLocaleString('es-CO');

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white p-4 md:p-8 font-light selection:bg-orange-500/30 transition-colors duration-500">
      
      {/* HEADER */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 border-b border-neutral-200 dark:border-neutral-900 pb-8 gap-6 transition-colors">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-orange-100 dark:bg-orange-600/10 rounded-[2rem] border border-orange-200 dark:border-orange-600/20 transition-colors">
            <Flame className="text-orange-600 dark:text-orange-500" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">ENTRE <span className="text-orange-600 dark:text-orange-500">FUEGOS</span></h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 bg-white dark:bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-800 text-[9px] text-orange-600 dark:text-orange-500 font-bold uppercase tracking-widest shadow-sm dark:shadow-none transition-colors">
                <ShieldCheck size={10} /> {isAdmin ? 'Admin' : 'Cajero'}
              </span>
              <span className="text-neutral-500 text-xs italic">Sesión de <span className="text-neutral-900 dark:text-neutral-200 font-bold not-italic">{user?.name}</span><span className="mt-1 block not-italic"><UserSessionStatus /></span></span>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <div className="flex bg-white dark:bg-neutral-900/50 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 backdrop-blur-md w-full lg:w-auto overflow-x-auto shadow-sm dark:shadow-none transition-colors">
          {[
            { id: 'vivas', label: 'EN VIVO', icon: <LayoutDashboard size={14} /> },
            { id: 'espera', label: 'FILA ESPERA', icon: <Users size={14} /> },
            { id: 'hoy', label: 'VENTAS HOY', icon: <TrendingUp size={14} /> },
            { id: 'dashboard', label: 'DASHBOARD', icon: <BarChart3 size={14} /> },
            ...(isAdmin ? [
              { id: 'archivo', label: 'ARCHIVO', icon: <History size={14} /> },
              { id: 'control', label: 'CONTROL', icon: <ShieldCheck size={14} /> }
            ] : [])
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 lg:flex-none flex whitespace-nowrap items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-bold transition-all duration-500 ${activeTab === tab.id ? "bg-orange-600 text-white shadow-xl shadow-orange-500/20" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* TICKET INVISIBLE (SIN CAMBIOS) */}
      {ordenParaImprimir && (
        <div id="ticket-impresion" style={{ width: '76mm', padding: '0', background: 'white', color: 'black', fontFamily: 'monospace', fontSize: '11px', margin: '0', lineHeight: '1.2' }}>
           {/* ... Contenido del ticket de impresión se mantiene igual ... */}
           <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0' }}>ENTRE FUEGOS GOURMET</h2>
            <p style={{ margin: '0' }}>YULY VIVIANA LOPEZ</p>
            <p style={{ margin: '0' }}>Nit: 42150101-1</p>
            <p style={{ margin: '0' }}>CALLE 61A 24-07</p>
            <p style={{ margin: '0' }}>Telefono: 3205110144</p>
            <br />
            <p style={{ margin: '0' }}>NO VALIDO COMO FACTURA!</p>
            <p style={{ margin: '0' }}>MODO INFORMATIVO DE SU CONSUMO</p>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <p style={{ margin: '0' }}>Fecha de Venta: {new Date().toLocaleString('es-CO')}</p>
            <p style={{ margin: '0', fontSize: '9px' }}>RESPONSABLE IMPUESTO DE IVA / IMPOCONSUMO</p>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>Mesa : M{ordenParaImprimir.table.number}</h3>
            <p style={{ margin: '0', fontSize: '13px', fontWeight: 'bold' }}>Mesero: {ordenParaImprimir.user.name.toUpperCase()}</p>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '2px 0', marginBottom: '4px' }}>
              <span style={{ width: '55%' }}>| Descripcion</span>
              <span style={{ width: '20%', textAlign: 'center' }}>| Cant |</span>
              <span style={{ width: '25%', textAlign: 'right' }}>Valor |</span>
            </div>
            {ordenParaImprimir.items.map((item: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', marginBottom: '2px' }}>
                <span style={{ width: '55%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>|{item.product.name.toUpperCase()}</span>
                <span style={{ width: '20%', textAlign: 'center' }}>{item.quantity}</span>
                <span style={{ width: '25%', textAlign: 'right' }}>{formatoMoneda(item.quantity * item.product.price)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed black', marginTop: '4px' }}></div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>**TOTAL CONSUMO&gt;&gt;</span><span>${formatoMoneda(totalConsumo)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>**TOTAL DESCUENTO&gt;&gt;</span><span>$0</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>**SUB TOTAL&gt;&gt;</span><span>${formatoMoneda(totalConsumo)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>**IMPTOS I/O CONSUMO&gt;&gt;</span><span>${formatoMoneda(valorImpoconsumo)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '4px' }}><span>**TOTAL A PAGAR&gt;</span><span>${formatoMoneda(totalConPropina)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>**PAGA CON&gt;&gt;</span><span>${formatoMoneda(totalConPropina)}</span></div>
          </div>
          <div style={{ borderTop: '1px solid black', paddingTop: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
              <span>**TOTAL PAGADO&gt;&gt;</span>
              <span style={{ display: 'flex', alignItems: 'flex-end' }}>${formatoMoneda(totalConPropina)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '6px' }}>
              <span>SERVICIO VOLUNTARIO</span>
              <span>${formatoMoneda(propina)}</span>
            </div>
          </div>
        </div>
      )}

      {ordenParaCobrar && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
              <h2 id="checkout-title" className="text-xl font-black">Cobrar Mesa {ordenParaCobrar.table.number}</h2>
              <p className="mt-1 text-sm text-neutral-500">Mesero: {ordenParaCobrar.user.name}. Marca los productos que se pagarán ahora.</p>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {ordenParaCobrar.items.map((item: any) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-3 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60">
                  <input type="checkbox" checked={itemsSeleccionadosPago.includes(item.id)} onChange={event => setItemsSeleccionadosPago(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} className="mt-1 h-5 w-5 shrink-0 accent-orange-600" />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-3 text-sm font-bold"><span>{item.quantity}x {item.product.name}</span><span className="shrink-0 font-mono">${(item.quantity * item.product.price).toLocaleString()}</span></span>
                    {item.notes && <span className="mt-1 block text-xs italic text-neutral-500">{item.notes}</span>}
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-3 border-t border-neutral-200 p-5 dark:border-neutral-800">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-neutral-50 px-3 text-sm font-semibold dark:bg-neutral-800">
                <input type="checkbox" checked={incluirServicio} onChange={event => setIncluirServicio(event.target.checked)} className="h-5 w-5 accent-orange-600" />
                Incluir servicio voluntario del 10%
              </label>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Productos seleccionados</span><span>${subtotalPago.toLocaleString()}</span></div>
                {incluirServicio && <div className="flex justify-between text-neutral-500"><span>Servicio (10%)</span><span>${servicioPago.toLocaleString()}</span></div>}
                <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-black dark:border-neutral-700"><span>Total a pagar</span><span>${(subtotalPago + servicioPago).toLocaleString()}</span></div>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setOrdenParaCobrar(null)} disabled={procesandoPago} className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-bold dark:border-neutral-700">Cancelar</button>
                <button type="button" onClick={handleConfirmarPago} disabled={procesandoPago || itemsSeleccionadosPago.length === 0} className="min-h-11 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50">{procesandoPago ? "Registrando..." : "Confirmar pago e imprimir"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        
        {/* --- PESTAÑA: COMANDAS VIVAS --- */}
        {activeTab === 'vivas' && (
          <motion.div key="vivas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="col-span-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
                <Search size={18} className="shrink-0 text-neutral-500" />
                <input value={busquedaCuenta} onChange={event => setBusquedaCuenta(event.target.value)} aria-label="Buscar cuentas por mesa o mesero" placeholder="Buscar por mesa o mesero..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400" />
              </label>
              <span className="text-xs font-bold text-neutral-500">{comandasFiltradas.length} cuenta(s)</span>
            </div>
            {comandasFiltradas.map((c) => (
              <OrderCard key={c.id} c={c} handleIniciarCobro={handleIniciarCobro} />
            ))}
            {comandasFiltradas.length === 0 && <div className="col-span-full py-40 text-center text-neutral-400 dark:text-neutral-800">{comandas.length === 0 ? "Sin cuentas activas" : "No hay cuentas que coincidan con la búsqueda"}</div>}
          </motion.div>
        )}

        {/* --- PESTAÑA: FILA DE ESPERA (IHC) --- */}
        {activeTab === 'espera' && (
          <motion.div key="espera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Formulario de Registro */}
            <div className="bg-white dark:bg-neutral-900/40 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 h-fit shadow-sm dark:shadow-none transition-colors">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-neutral-900 dark:text-white"><Users className="text-orange-500"/> Nuevo Cliente</h2>
              <form onSubmit={handleAgregarEspera} className="space-y-4">
                <div>
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Nombre</label>
                  <input required value={formWait.name} onChange={e => setFormWait({...formWait, name: e.target.value})} className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3 rounded-xl mt-1 outline-none focus:border-orange-500 text-neutral-900 dark:text-white transition-colors" placeholder="Ej: Familia García" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-neutral-500 uppercase font-bold">Personas</label>
                    <input required type="number" min="1" value={formWait.partySize} onChange={e => setFormWait({...formWait, partySize: Number(e.target.value)})} className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3 rounded-xl mt-1 outline-none focus:border-orange-500 text-neutral-900 dark:text-white transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 uppercase font-bold">Teléfono</label>
                    <input value={formWait.phone} onChange={e => setFormWait({...formWait, phone: e.target.value})} className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3 rounded-xl mt-1 outline-none focus:border-orange-500 text-neutral-900 dark:text-white transition-colors" placeholder="Opcional" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl mt-4 hover:bg-orange-500 transition-all">AÑADIR A LA FILA</button>
              </form>
            </div>

            {/* Lista Interactiva CON CONTADOR */}
            <div className="lg:col-span-2 space-y-4">
              {waitlist.length === 0 ? (
                <div className="p-20 text-center text-neutral-500 dark:text-neutral-600 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-[2.5rem]">No hay clientes en fila de espera.</div>
              ) : (
                waitlist.map((w, idx) => (
                  <WaitlistItem 
                    key={w.id} 
                    w={w} 
                    idx={idx} 
                    mesasLibres={mesasLibres} 
                    handleAsignarMesa={handleAsignarMesa} 
                  />
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* --- PESTAÑA: VENTAS HOY --- */}
        {activeTab === 'hoy' && (
          <motion.div key="hoy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Venta Bruta Hoy", val: `$${statsHoy.total.toLocaleString()}`, icon: <TrendingUp className="text-orange-500" /> },
                { label: "Ticket Promedio", val: `$${statsHoy.ticket.toLocaleString(undefined, {maximumFractionDigits:0})}`, icon: <Target className="text-blue-500" /> },
                { label: "Servicios", val: statsHoy.cantidad, icon: <CheckCircle2 className="text-green-500" /> },
                { label: "Sincronización", val: "En Línea", icon: <Activity className="text-purple-500 animate-pulse" /> }
              ].map((kpi, i) => (
                <div key={i} className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-900 shadow-sm dark:shadow-xl relative overflow-hidden group transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">{kpi.icon}</div>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2 font-bold">{kpi.label}</p>
                  <h2 className="text-3xl font-mono font-bold text-neutral-900 dark:text-white">{kpi.val}</h2>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-neutral-900/30 rounded-[3rem] border border-neutral-200 dark:border-neutral-900 p-8 shadow-sm dark:shadow-2xl transition-colors">
              <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-neutral-500 mb-8 flex items-center gap-2"><LayoutDashboard size={16} className="text-orange-500" /> Rendimiento por Mesa</h3>
              <div className="space-y-6">
                {Object.keys(statsHoy.ventasPorMesa).map((mesa) => {
                  const porcentaje = (statsHoy.ventasPorMesa[mesa] / statsHoy.total) * 100;
                  return (
                    <div key={mesa} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold"><span className="text-neutral-500 dark:text-neutral-400">MESA {mesa}</span><span className="text-orange-600 dark:text-orange-500 font-mono">${statsHoy.ventasPorMesa[mesa].toLocaleString()}</span></div>
                      <div className="w-full bg-neutral-100 dark:bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-900">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${porcentaje}%` }} className="h-full bg-orange-500 dark:bg-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.4)]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* --- PESTAÑA: ARCHIVO HISTÓRICO --- */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="text-orange-500" /> Dashboard de ventas y personal</h2>
                  <p className="mt-1 text-sm text-neutral-500">Consulta ventas por mesa, mesero y periodo, además del tiempo conectado del personal.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-neutral-500">Desde<input type="datetime-local" value={dashboardFrom} onChange={event => setDashboardFrom(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" /></label>
                  <label className="text-xs font-bold text-neutral-500">Hasta<input type="datetime-local" value={dashboardTo} onChange={event => setDashboardTo(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" /></label>
                </div>
              </div>
              <label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 dark:border-neutral-700 dark:bg-neutral-950">
                <Search size={18} className="shrink-0 text-neutral-500" />
                <input value={dashboardSearch} onChange={event => setDashboardSearch(event.target.value)} aria-label="Filtrar dashboard por mesa o mesero" placeholder="Filtrar por número de mesa o nombre del mesero..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400" />
                {dashboardSearch && <button type="button" onClick={() => setDashboardSearch('')} className="text-xs font-bold text-orange-600 hover:text-orange-500">Limpiar</button>}
              </label>
            </section>
            {dashboardLoading && <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">Cargando resumen...</div>}
            {!dashboardLoading && dashboardFilter && <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-900/40 dark:bg-orange-950/20"><p className="text-xs font-bold uppercase text-orange-700 dark:text-orange-300">Ventas filtradas</p><p className="mt-2 text-2xl font-black">${dashboardTotal.toLocaleString()}</p></div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/40"><p className="text-xs font-bold uppercase text-neutral-500">Servicios</p><p className="mt-2 text-2xl font-black">${(dashboardSearch ? (dashboardMatchesTable ? dashboardFilter.filteredByTable.reduce((sum, row) => sum + row.serviceTotal, 0) : dashboardMatchesWaiter ? dashboardFilter.filteredByWaiter.reduce((sum, row) => sum + row.serviceTotal, 0) : 0) : dashboardFilter.serviceTotal).toLocaleString()}</p></div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/40"><p className="text-xs font-bold uppercase text-neutral-500">Pagos filtrados</p><p className="mt-2 text-2xl font-black">{dashboardPayments}</p></div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/40"><p className="text-xs font-bold uppercase text-neutral-500">Cuentas</p><p className="mt-2 text-2xl font-black">{dashboardSearch ? '—' : dashboardFilter.orderCount}</p></div>
              </div>
              {dashboardSearch && !dashboardMatchesTable && !dashboardMatchesWaiter && <p className="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-500 dark:border-neutral-800">No encontramos una mesa o mesero relacionado con “{dashboardSearch}”.</p>}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-3xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/40"><h3 className="mb-4 font-black">Ventas por mesa</h3>{dashboardFilter.filteredByTable.length === 0 ? <p className="text-sm text-neutral-500">No hay mesas relacionadas.</p> : <div className="space-y-3">{dashboardFilter.filteredByTable.map(row => <div key={row.tableId} className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950"><span className="font-bold">Mesa {row.table}<small className="ml-2 text-xs font-normal text-neutral-500">{row.payments} pago(s)</small></span><span className="font-mono font-bold text-orange-600">${row.total.toLocaleString()}</span></div>)}</div>}</section>
                <section className="rounded-3xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/40"><h3 className="mb-4 font-black">Ventas por mesero</h3>{dashboardFilter.filteredByWaiter.length === 0 ? <p className="text-sm text-neutral-500">No hay meseros relacionados.</p> : <div className="space-y-3">{dashboardFilter.filteredByWaiter.map(row => <div key={row.userId} className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950"><span><span className="block font-bold">{row.name}</span><small className="text-xs uppercase text-neutral-500">{row.role} · {row.payments} pago(s)</small></span><span className="font-mono font-bold text-orange-600">${row.total.toLocaleString()}</span></div>)}</div>}</section>
              </div>
              <section className="rounded-3xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/40"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-black">Horas de conexión del personal</h3><span className="text-xs text-neutral-500">{isAdmin ? 'Todos los perfiles operativos' : 'Tu actividad'}</span></div>{dashboardFilter.filteredSessions.length === 0 ? <p className="text-sm text-neutral-500">No hay conexiones relacionadas.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800"><tr><th className="py-3">Persona</th><th className="py-3">Inicio</th><th className="py-3">Fin</th><th className="py-3 text-right">Duración</th></tr></thead><tbody>{dashboardFilter.filteredSessions.map(session => <tr key={session.id} className="border-b border-neutral-100 dark:border-neutral-800/60"><td className="py-3 font-bold">{session.name}<span className="ml-2 text-xs font-normal uppercase text-neutral-500">{session.role}</span></td><td className="py-3 text-neutral-500">{new Date(session.loginAt).toLocaleString('es-CO')}</td><td className="py-3 text-neutral-500">{session.active ? 'Activa' : new Date(session.logoutAt as string).toLocaleString('es-CO')}</td><td className="py-3 text-right font-mono font-bold">{Math.floor(session.durationMinutes / 60)}h {session.durationMinutes % 60}m</td></tr>)}</tbody></table></div>}</section>
            </>}
          </motion.div>
        )}

        {activeTab === 'archivo' && isAdmin && (
          <motion.div key="archivo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {!fechaSeleccionada ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {archivoFechas.map((f, i) => (
                  <button 
                    key={i} 
                    onClick={() => verDiaPasado(f.date)}
                    className="bg-white dark:bg-neutral-900 p-6 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 hover:border-orange-500 dark:hover:border-orange-500 transition-all text-center group shadow-sm dark:shadow-none"
                  >
                    <Calendar className="mx-auto mb-3 text-neutral-500 dark:text-neutral-600 group-hover:text-orange-500 transition-colors" />
                    <span className="text-xs font-bold uppercase tracking-tighter text-neutral-800 dark:text-white">{new Date(f.date).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <button onClick={() => setFechaSeleccionada(null)} className="flex items-center gap-2 text-orange-600 dark:text-orange-500 text-[10px] font-bold uppercase tracking-widest hover:gap-4 transition-all">
                  <ArrowLeft size={16} /> Volver al archivo
                </button>

                <div className="bg-orange-50 dark:bg-orange-600/10 p-10 rounded-[3rem] border border-orange-200 dark:border-orange-600/20 shadow-lg dark:shadow-2xl transition-colors">
                  <h2 className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase tracking-widest mb-4">Dashboard del Día: <span className="text-neutral-900 dark:text-white">{fechaSeleccionada}</span></h2>
                  <div className="flex gap-16">
                    <div><p className="text-5xl font-mono font-bold text-neutral-900 dark:text-white">${statsPasado.total.toLocaleString()}</p><p className="text-[10px] text-neutral-500 uppercase font-bold mt-2">Venta Bruta</p></div>
                    <div><p className="text-5xl font-mono font-bold text-neutral-900 dark:text-white">{statsPasado.cantidad}</p><p className="text-[10px] text-neutral-500 uppercase font-bold mt-2">Mesas Atendidas</p></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {historialPasado.map(o => (
                     <div key={o.id} className="bg-white dark:bg-neutral-900/30 p-5 rounded-3xl border border-neutral-200 dark:border-neutral-800 flex justify-between items-center group shadow-sm dark:shadow-none transition-colors">
                        <div><p className="font-bold text-neutral-800 dark:text-neutral-200">MESA {o.table.number}</p><p className="text-[10px] text-neutral-500 dark:text-neutral-600 uppercase italic">{o.user.name}</p></div>
                        <p className="font-mono text-orange-600 dark:text-orange-500 font-bold">${o.items.reduce((a:number, i:any) => a+(i.product.price*i.quantity),0).toLocaleString()}</p>
                     </div>
                   ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'control' && isAdmin && (
          <motion.div key="control" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            <AdminControlSection title="Usuarios y perfiles" summary={`${usuarios.filter(account => account.role !== 'ADMIN').length} empleados operativos`} icon={<User size={20} />} expanded={expandedControlSection === 'users'} onToggle={() => setExpandedControlSection(current => current === 'users' ? null : 'users')}>
              <div className="space-y-4">
              <form onSubmit={handleCrearUsuario} className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  Nombre
                  <input required value={nuevoUsuario.name} onChange={event => setNuevoUsuario(current => ({ ...current, name: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-orange-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" placeholder="Nombre del empleado" />
                </label>
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  Perfil
                  <select value={nuevoUsuario.role} onChange={event => setNuevoUsuario(current => ({ ...current, role: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-orange-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                    <option value="CAJERO">Cajero</option>
                    <option value="COCINA">Cocina</option>
                    <option value="MESERO">Mesero</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  PIN de 4 dígitos
                  <input required type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} minLength={4} autoComplete="new-password" value={nuevoUsuario.pin} onChange={event => setNuevoUsuario(current => ({ ...current, pin: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="mt-1.5 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm tracking-widest text-neutral-900 outline-none focus:border-orange-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" placeholder="••••" />
                </label>
                <button type="submit" disabled={creandoUsuario} className="min-h-11 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50">{creandoUsuario ? "Creando..." : "Crear cuenta"}</button>
              </form>
              <div className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {usuarios.filter(account => account.role !== 'ADMIN').map(account => (
                  <div key={account.id} className="flex items-center justify-between py-3">
                    <span className="font-semibold">{account.name}</span>
                    <span className="text-xs font-bold uppercase text-neutral-500">{account.role}</span>
                  </div>
                ))}
                {usuarios.every(account => account.role === 'ADMIN') && <p className="py-4 text-sm text-neutral-500">Aún no hay cuentas operativas.</p>}
              </div>
              </div>
            </AdminControlSection>

            <AdminControlSection title="Sesiones de empleados" summary={`${sesionesActivas.length} perfiles con sesión activa`} icon={<Users size={20} />} expanded={expandedControlSection === 'sessions'} onToggle={() => setExpandedControlSection(current => current === 'sessions' ? null : 'sessions')}>
              {sesionesActivas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-800">No hay sesiones de empleados activas.</p>
              ) : (
                <div className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                  {sesionesActivas.map(session => (
                    <div key={session.id} className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${session.connected ? "bg-green-500" : "bg-neutral-400"}`} />
                        <div>
                          <p className="font-bold text-neutral-900 dark:text-white">{session.name} <span className="ml-2 text-xs font-semibold uppercase text-neutral-500">{session.role}</span></p>
                          <p className="mt-1 text-xs text-neutral-500">{session.connected ? "Conectado ahora" : "Sesión abierta, sin conexión"} · {session.sessionCount} dispositivo(s)</p>
                          <p className="mt-1 text-xs text-neutral-500">Inicio: {new Date(session.startedAt).toLocaleString("es-CO")}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setSesionParaCerrar(session)} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-red-300 px-3 text-sm font-bold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 sm:self-auto">
                        <LogOut size={16} /> Cerrar sesión
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </AdminControlSection>

            <AdminControlSection title="Mesas" summary={`${mesasLibres.filter(table => table.status.toLowerCase() !== 'libre').length} ocupadas · liberar cancela comandas sin borrarlas`} icon={<Utensils size={20} />} expanded={expandedControlSection === 'tables'} onToggle={() => setExpandedControlSection(current => current === 'tables' ? null : 'tables')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {mesasLibres.map(table => {
                  const tableOrders = comandas.filter(order => order.table.id === table.id);
                  const canRelease = table.status.toLowerCase() !== 'libre' || tableOrders.length > 0;
                  return (
                    <div key={table.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                      <div>
                        <p className="font-bold">Mesa {table.number}</p>
                        <p className="mt-1 text-xs text-neutral-500">{table.status} · {tableOrders.length} comanda(s) activa(s)</p>
                      </div>
                      <button type="button" disabled={!canRelease} onClick={() => setMesaParaLiberar(table)} className="min-h-10 shrink-0 rounded-lg border border-neutral-300 px-3 text-xs font-bold text-neutral-700 hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:text-orange-400">
                        Liberar mesa
                      </button>
                    </div>
                  );
                })}
              </div>
            </AdminControlSection>

            <AdminControlSection title="Procesos activos" summary={`${comandas.length} comandas por finalizar`} icon={<Activity size={20} />} expanded={expandedControlSection === 'processes'} onToggle={() => setExpandedControlSection(current => current === 'processes' ? null : 'processes')}>
              {comandas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-800">No hay procesos activos.</p>
              ) : (
                <div className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                  {comandas.map(order => {
                    const orderTotal = order.items.reduce((sum: number, item: any) => sum + item.product.price * item.quantity, 0);
                    return (
                      <div key={order.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-bold">Mesa {order.table.number} · {order.user.name}</p>
                          <p className="mt-1 text-xs text-neutral-500">{order.items.length} plato(s) · ${orderTotal.toLocaleString()}</p>
                        </div>
                        <button type="button" onClick={() => handleIniciarCobro(order)} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg bg-orange-600 px-3 text-xs font-black text-white hover:bg-orange-500 sm:self-auto">
                          <Printer size={15} /> Revisar pago
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminControlSection>
          </motion.div>
        )}
      </AnimatePresence>

      {sesionParaCerrar && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="revoke-session-title" className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <h2 id="revoke-session-title" className="text-lg font-black">¿Cerrar la sesión de {sesionParaCerrar.name}?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Se revocará el acceso en todos sus dispositivos y regresará a la pantalla del PIN.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setSesionParaCerrar(null)} disabled={procesandoControl} className="min-h-10 rounded-lg border border-neutral-300 px-4 text-sm font-bold dark:border-neutral-700">Cancelar</button>
              <button type="button" onClick={handleRevocarSesion} disabled={procesandoControl} className="min-h-10 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50">{procesandoControl ? "Cerrando..." : "Cerrar todas las sesiones"}</button>
            </div>
          </div>
        </div>
      )}

      {mesaParaLiberar && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="release-table-title" className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <h2 id="release-table-title" className="text-lg font-black">¿Liberar Mesa {mesaParaLiberar.number}?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Las comandas activas se marcarán como canceladas y dejarán de aparecer en cocina. Sus registros y platos se conservarán; no se marcarán como cobrados.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setMesaParaLiberar(null)} disabled={procesandoControl} className="min-h-10 rounded-lg border border-neutral-300 px-4 text-sm font-bold dark:border-neutral-700">Cancelar</button>
              <button type="button" onClick={handleLiberarMesa} disabled={procesandoControl} className="min-h-10 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50">{procesandoControl ? "Liberando..." : "Confirmar liberación"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
