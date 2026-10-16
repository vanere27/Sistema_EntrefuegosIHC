// src/app/mesas/[id]/page.tsx
"use client";
import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrderStore, type OrderItemInput } from "@/store/orderStore";
import { useUserStore } from "@/store/userStore"; 
import { 
  ShoppingCart, ArrowLeft, Send, UtensilsCrossed, MessageSquare, 
  Plus, X, Edit3, Trash2, CheckCircle, AlertTriangle, Info, Check, ChevronRight, SkipForward
} from "lucide-react";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { playWaiterReadyBell } from "@/components/NotificationSound";

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}

const ORDER_COURSES = [
  { id: "entradas", label: "Entradas", description: "Entradas, ensaladas y picadas" },
  { id: "fuertes", label: "Platos fuertes", description: "Carnes, pollo, pastas y platos principales" },
  { id: "bebidas", label: "Bebidas", description: "Bebidas, vinos y licores" },
  { id: "postres", label: "Postres", description: "Postres y opciones dulces" },
] as const;

type OrderCourseId = typeof ORDER_COURSES[number]["id"];

function getCourseForCategory(category: string): OrderCourseId {
  const normalized = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (["entrada", "ensalada", "picada", "aperitivo"].some(keyword => normalized.includes(keyword))) return "entradas";
  if (["bebida", "vino", "licor", "coctel", "cerveza"].some(keyword => normalized.includes(keyword))) return "bebidas";
  if (["postre", "dulce", "reposteria", "helado"].some(keyword => normalized.includes(keyword))) return "postres";
  return "fuertes";
}

const orderItemKey = (item: Pick<OrderItemInput, "productId" | "notes">) => `${item.productId}:${item.notes ?? ""}`;

export default function TomaPedidosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: mesaId } = use(params); 
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get('edit') === 'true';

  const { items, addItem, removeItem, removeItems, clearOrder } = useOrderStore();
  const user = useUserStore((state) => state.user); 

  const [productos, setProductos] = useState<Product[]>([]);
  const [cargando, setCargando] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState<string>("Todos");
  const [etapaActivaIndex, setEtapaActivaIndex] = useState(0);
  const [etapaMasLejana, setEtapaMasLejana] = useState(0);
  const [confirmarEnvioEtapa, setConfirmarEnvioEtapa] = useState(false);
  const [enviandoEtapa, setEnviandoEtapa] = useState(false);

  // Estados para productos nuevos
  const [productoParaNota, setProductoParaNota] = useState<Product | null>(null);
  const [notaTemporal, setNotaTemporal] = useState("");

  // --- ESTADOS PARA GESTIÓN DE ORDEN EXISTENTE ---
  const [ordenIdExistente, setOrdenIdExistente] = useState<number | null>(null);
  const [itemsYaPedidos, setItemsYaPedidos] = useState<any[]>([]);

  // --- NUEVO ESTADO: CONTROL DE VISTA MÓVIL ---
  const [verComandaMovil, setVerComandaMovil] = useState(false);

  // Estados para Modales
  const [itemParaEliminar, setItemParaEliminar] = useState<any>(null);
  const [itemParaEditarNota, setItemParaEditarNota] = useState<any>(null);
  const [notaEditadaTemporal, setNotaEditadaTemporal] = useState("");

  // 1. EFECTO: CARGAR DATOS INICIALES
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resMenu = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/products");
        const menuData = await resMenu.json();
        setProductos(menuData);

        if (isEdit) {
          const resOrden = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/table/${mesaId}`);
          const ordenData = await resOrden.json();
          if (ordenData) {
            setOrdenIdExistente(ordenData.id);
            setItemsYaPedidos(ordenData.items);
          }
        }
        setCargando(false);
      } catch (error) {
        toast.error("Error al cargar datos del sistema.");
        setCargando(false);
      }
    };
    fetchData();
  }, [mesaId, isEdit]);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  // --- 2. NUEVO EFECTO IHC: ESCUCHADOR DE COCINA EN TIEMPO REAL ---
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL + "");
    socket.on("item_cook_status_updated", (data) => {
      if (data.cookStatus === 'LISTO' && data.order.userId === user?.id) {
        playWaiterReadyBell();
        toast.success(
          `¡ATENCIÓN! ${data.product.name} de la MESA ${data.order.table.number} está LISTO en cocina.`, 
          { duration: 8000 } 
        );
      }
    });
    socket.on("orden_cancelada_admin", (data: { tableId: number }) => {
      if (String(data.tableId) !== mesaId) return;
      clearOrder();
      toast.error(`La Mesa ${mesaId} fue liberada por administración.`);
      router.replace("/mesas");
    });
    return () => {
      socket.disconnect();
    };
  }, [user]);

  // --- ACCIONES BACKEND ---
  const ejecutarEliminacion = async () => {
    if (!itemParaEliminar) return;
    try {
      const toastId = toast.loading("Eliminando...");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/order-items/${itemParaEliminar.id}`, { method: 'DELETE' });
      
      if (res.ok) {
        const data = await res.json();
        if (data.mesaLiberada) {
          toast.success("Mesa vaciada y liberada", { id: toastId });
          setItemParaEliminar(null);
          clearOrder();
          router.push("/mesas"); 
        } else {
          setItemsYaPedidos(prev => prev.filter(i => i.id !== itemParaEliminar.id));
          toast.success("Producto eliminado", { id: toastId });
          setItemParaEliminar(null);
        }
      } else {
        toast.error("Error al intentar eliminar", { id: toastId });
      }
    } catch (error) { 
      toast.error("Error de red al eliminar"); 
    }
  };

  const guardarNotaEditada = async () => {
    if (!itemParaEditarNota) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/order-items/${itemParaEditarNota.id}/notes`, {
        method: 'PATCH',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notaEditadaTemporal })
      });
      if (res.ok) {
        setItemsYaPedidos(prev => prev.map(i => i.id === itemParaEditarNota.id ? { ...i, notes: notaEditadaTemporal } : i));
        toast.success("Nota actualizada");
        setItemParaEditarNota(null);
      }
    } catch (error) { toast.error("Error al actualizar la nota."); }
  };

  // --- ACCIONES FRONTEND ---
  const prepararProducto = (prod: Product) => {
    setProductoParaNota(prod);
    setNotaTemporal(""); 
  };

  const confirmarProductoConNota = () => {
    if (productoParaNota) {
      addItem({ productId: productoParaNota.id, name: productoParaNota.name, price: productoParaNota.price, notes: notaTemporal });
      setProductoParaNota(null);
      setNotaTemporal("");
    }
  };

  const etapaActual = ORDER_COURSES[etapaActivaIndex];
  const productosDeEtapa = productos.filter(product => getCourseForCategory(product.category) === etapaActual.id);
  const categoriasDeEtapa = Array.from(new Set(productosDeEtapa.map(product => product.category))).sort((a, b) => a.localeCompare(b, "es"));
  const productosFiltrados = categoriaActiva === "Todos"
    ? productosDeEtapa
    : productosDeEtapa.filter(product => product.category === categoriaActiva);
  const categoriasParaMostrar = categoriaActiva === "Todos" ? categoriasDeEtapa : [categoriaActiva];
  const itemsEtapa = items.filter(item => {
    const product = productos.find(candidate => candidate.id === item.productId);
    return product && getCourseForCategory(product.category) === etapaActual.id;
  });
  const totalEtapa = itemsEtapa.reduce((total, item) => total + item.price * item.quantity, 0);

  const avanzarEtapa = (itemsPendientes: OrderItemInput[] = items) => {
    const siguienteIndex = etapaActivaIndex + 1;
    if (siguienteIndex < ORDER_COURSES.length) {
      setEtapaActivaIndex(siguienteIndex);
      setEtapaMasLejana(actual => Math.max(actual, siguienteIndex));
      setCategoriaActiva("Todos");
      return;
    }

    if (itemsPendientes.length > 0) {
      const etapaPendienteIndex = ORDER_COURSES.findIndex(course =>
        itemsPendientes.some(item => {
          const product = productos.find(candidate => candidate.id === item.productId);
          return product && getCourseForCategory(product.category) === course.id;
        })
      );
      if (etapaPendienteIndex >= 0) {
        setEtapaActivaIndex(etapaPendienteIndex);
        setCategoriaActiva("Todos");
        toast.info("Aún hay productos sin enviar. Continuemos con esa categoría.");
        return;
      }
    }

    if (ordenIdExistente !== null || isEdit) {
      toast.success("Pedido completo enviado a cocina.");
    } else {
      clearOrder();
      toast.info("No se enviaron productos a cocina.");
    }
    router.push("/mesas");
  };

  const handleEnviarEtapa = async () => {
    if (itemsEtapa.length === 0) return;
    if (!user || !Number.isInteger(user.id)) {
      toast.error("La sesión del mesero no está disponible. Inicia sesión nuevamente.");
      router.replace("/");
      return;
    }
    if (isEdit && ordenIdExistente === null) return toast.error("Espera a que cargue la comanda actual.");

    setEnviandoEtapa(true);
    try {
      const orderAlreadyCreated = ordenIdExistente !== null;
      const toastId = toast.loading(`Enviando ${etapaActual.label.toLowerCase()} a cocina...`);
      const url = orderAlreadyCreated
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/orders/${ordenIdExistente}/add-items`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/orders`;
      const respuesta = await fetch(url, {
        method: orderAlreadyCreated ? 'PATCH' : 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: parseInt(mesaId), userId: user?.id, items: itemsEtapa })
      });

      if (!respuesta.ok) {
        const errorData = await respuesta.json().catch(() => null);
        const errorMessage = typeof errorData?.error === "string" ? errorData.error : "No se pudo enviar esta etapa a cocina.";
        toast.error(`${errorMessage} (HTTP ${respuesta.status}).`, { id: toastId });
        return;
      }

      const responseData = await respuesta.json();
      const savedOrder = responseData.orden ?? responseData;
      if (savedOrder.id) setOrdenIdExistente(savedOrder.id);
      if (savedOrder.items) setItemsYaPedidos(savedOrder.items);

      const sentKeys = new Set(itemsEtapa.map(orderItemKey));
      const remainingItems = items.filter(item => !sentKeys.has(orderItemKey(item)));
      removeItems(itemsEtapa);
      setConfirmarEnvioEtapa(false);
      toast.success(`${etapaActual.label} enviadas a cocina.`, { id: toastId });

      if (etapaActivaIndex === ORDER_COURSES.length - 1 && remainingItems.length === 0) {
        toast.success("Pedido completo enviado a cocina.");
        router.push("/mesas");
      } else {
        avanzarEtapa(remainingItems);
      }
    } catch (error) {
      toast.error("Error de conexión al enviar a cocina.");
    } finally {
      setEnviandoEtapa(false);
    }
  };

  const saltarEtapa = () => avanzarEtapa(items);

  return (
    // AQUÍ INICIA LA MAGIA DE COLORES: bg-neutral-50 para claro, dark:bg-neutral-950 para oscuro
    <div className="h-[calc(100dvh-3.5rem)] bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white font-light flex flex-col md:flex-row overflow-hidden relative transition-colors duration-300">
      
      {/* --- MENÚ POR TIEMPOS --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden md:border-r border-neutral-200 dark:border-neutral-900">
        <div className="flex-shrink-0 p-5 pb-2 md:p-6 md:pb-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => { clearOrder(); router.push("/mesas"); }} aria-label="Volver a mesas" className="rounded-full border border-neutral-200 bg-white p-3 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                <ArrowLeft size={22} className="text-orange-500" />
              </button>
              <div>
                <h1 className="text-2xl font-light md:text-3xl">Mesa <span className="font-bold text-orange-500">{mesaId}</span></h1>
                <p className="mt-1 text-xs font-bold uppercase text-neutral-500">Pedido por tiempos</p>
              </div>
            </div>
            {(isEdit || ordenIdExistente !== null) && (
              <div className="hidden items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 md:flex">
                <CheckCircle size={13} /> Comanda iniciada
              </div>
            )}
          </div>

          <nav aria-label="Tiempos de la comanda" className="mb-5 flex gap-2 overflow-x-auto pb-2">
            {ORDER_COURSES.map((course, index) => {
              const isActive = etapaActivaIndex === index;
              const isComplete = index < etapaMasLejana;
              return (
                <button
                  key={course.id}
                  type="button"
                  disabled={index > etapaMasLejana}
                  onClick={() => { setEtapaActivaIndex(index); setCategoriaActiva("Todos"); }}
                  aria-current={isActive ? "step" : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isActive ? "border-orange-600 bg-orange-600 text-white" : isComplete ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400" : "border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"}`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs">{isComplete ? <Check size={13} /> : index + 1}</span>
                  {course.label}
                </button>
              );
            })}
          </nav>

          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{etapaActual.label}</h2>
              <p className="text-sm text-neutral-500">{etapaActual.description}</p>
            </div>
            {itemsEtapa.length > 0 && <span className="shrink-0 text-sm font-bold text-orange-600 dark:text-orange-400">{itemsEtapa.reduce((count, item) => count + item.quantity, 0)} por enviar</span>}
          </div>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
            {["Todos", ...categoriasDeEtapa].map(category => (
              <button
                key={category}
                type="button"
                onClick={() => setCategoriaActiva(category)}
                className={`min-h-9 shrink-0 rounded-full border px-4 text-xs font-bold transition-colors ${categoriaActiva === category ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950" : "border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pt-0 pb-24 custom-scrollbar md:p-6 md:pt-0">
          {cargando ? (
            <div className="flex h-full flex-col items-center justify-center font-mono uppercase tracking-widest text-orange-500/50">Cargando menú...</div>
          ) : productosFiltrados.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
              <UtensilsCrossed size={34} className="mb-3 text-neutral-400" />
              <p className="font-bold">No hay productos en {etapaActual.label.toLowerCase()}.</p>
              <p className="mt-1 text-sm text-neutral-500">Puedes saltar esta etapa y continuar con la siguiente.</p>
            </div>
          ) : (
            <div className="space-y-7">
              {categoriasParaMostrar.map(category => (
                <section key={category} aria-labelledby={`category-${category}`}>
                  {categoriaActiva === "Todos" && <h3 id={`category-${category}`} className="mb-3 text-sm font-black uppercase text-neutral-500">{category}</h3>}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {productosFiltrados.filter(product => product.category === category).map(product => (
                      <article key={product.id} className="flex min-h-40 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">{product.category}</p>
                          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{product.name}</h3>
                          <p className="mt-2 font-mono text-sm text-neutral-500">${product.price.toLocaleString()}</p>
                        </div>
                        <button type="button" onClick={() => prepararProducto(product)} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-orange-500">
                          <Plus size={16} /> Agregar
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <button onClick={() => setVerComandaMovil(true)} aria-label="Abrir comanda" className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.4)] transition-transform active:scale-90 md:hidden">
        <ShoppingCart size={24} />
        {items.length > 0 && <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-orange-600 bg-white text-xs font-bold text-orange-600">{items.reduce((count, item) => count + item.quantity, 0)}</span>}
      </button>

      {/* --- BORRADOR DE LA COMANDA --- */}
      <div className={`fixed inset-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-neutral-950 md:static md:z-20 md:w-[420px] md:border-l md:border-neutral-200 md:bg-white/50 dark:md:border-neutral-900 dark:md:bg-neutral-900/50 ${verComandaMovil ? "translate-y-0" : "translate-y-full md:translate-y-0"}`}>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-neutral-200 bg-white/95 p-5 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 md:p-6">
          <h2 className="flex items-center gap-3 text-xl font-light text-neutral-900 dark:text-white"><ShoppingCart size={21} className="text-orange-500" /> Comanda Actual</h2>
          <button onClick={() => setVerComandaMovil(false)} aria-label="Cerrar comanda" className="rounded-full bg-neutral-100 p-2 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 md:hidden"><X size={20} /></button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5 pb-32 custom-scrollbar md:p-6 md:pb-6">
          {(isEdit || ordenIdExistente !== null) && itemsYaPedidos.length > 0 && (
            <section>
              <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500"><CheckCircle size={13} className="text-green-500" /> Ya enviado a cocina</p>
              <div className="space-y-2">
                {itemsYaPedidos.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{item.quantity}x {item.product.name}</p>
                      {item.notes && <p className="mt-1 flex items-center gap-1 text-[11px] italic text-orange-600 dark:text-orange-400"><MessageSquare size={10} />{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setItemParaEditarNota(item); setNotaEditadaTemporal(item.notes || ""); }} aria-label={`Editar nota de ${item.product.name}`} className="rounded-full border border-neutral-200 bg-white p-2 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"><Edit3 size={14} /></button>
                      <button onClick={() => setItemParaEliminar(item)} aria-label={`Eliminar ${item.product.name}`} className="rounded-full border border-neutral-200 bg-white p-2 text-neutral-600 hover:text-red-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            {items.length > 0 && <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">Borrador por enviar</p>}
            {items.length === 0 && ordenIdExistente === null && !isEdit && <div className="flex flex-col items-center justify-center py-12 text-neutral-400"><UtensilsCrossed size={40} className="mb-3" /><p className="text-sm italic">Selecciona productos de {etapaActual.label.toLowerCase()}</p></div>}
            <div className="space-y-3">
              {items.map(item => (
                <div key={`${item.productId}-${item.notes}`} className="rounded-xl border border-orange-500/30 bg-white p-4 dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{item.name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400">{ORDER_COURSES.find(course => course.id === getCourseForCategory(productos.find(product => product.id === item.productId)?.category ?? ""))?.label}</p>
                      {item.notes && <p className="mt-1 flex items-center gap-1 text-[11px] italic text-neutral-500"><MessageSquare size={10} />{item.notes}</p>}
                    </div>
                    <p className="text-xs font-mono text-neutral-500">${(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <button onClick={() => removeItem(item.productId, item.notes)} aria-label={`Quitar una unidad de ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">-</button>
                    <span className="w-4 text-center font-mono text-sm">{item.quantity}</span>
                    <button onClick={() => addItem({ ...item })} aria-label={`Agregar una unidad de ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-white">+</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex-shrink-0 border-t border-neutral-200 bg-white/95 p-5 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/95 md:p-6">
          <div className="mb-4 flex items-end justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Total de {etapaActual.label.toLowerCase()}</span>
            <span className="font-mono text-2xl font-light text-orange-600 dark:text-orange-500">${totalEtapa.toLocaleString()}</span>
          </div>
          <button
            type="button"
            disabled={enviandoEtapa || (isEdit && ordenIdExistente === null)}
            onClick={() => itemsEtapa.length > 0 ? setConfirmarEnvioEtapa(true) : saltarEtapa()}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-orange-600 px-4 text-sm font-black uppercase text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-500 disabled:cursor-wait disabled:opacity-50"
          >
            {itemsEtapa.length > 0 ? <><Send size={18} /> Enviar {etapaActual.label} a cocina <ChevronRight size={18} /></> : <><SkipForward size={18} /> Saltar {etapaActual.label} <ChevronRight size={18} /></>}
          </button>
        </div>
      </div>

      {confirmarEnvioEtapa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirmar-etapa-title" className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <h2 id="confirmar-etapa-title" className="text-xl font-black text-neutral-900 dark:text-white">¿Enviar {etapaActual.label.toLowerCase()} a cocina?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Se enviarán ahora y comenzarán a prepararse mientras completas las siguientes etapas.</p>
            <div className="my-5 space-y-2">
              {itemsEtapa.map(item => <div key={orderItemKey(item)} className="flex justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800"><span>{item.quantity}x {item.name}</span><span className="shrink-0 font-mono">${(item.quantity * item.price).toLocaleString()}</span></div>)}
            </div>
            <p className="mb-5 flex justify-between border-t border-neutral-200 pt-3 font-bold dark:border-neutral-700"><span>Total</span><span>${totalEtapa.toLocaleString()}</span></p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmarEnvioEtapa(false)} disabled={enviandoEtapa} className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">Seguir eligiendo</button>
              <button type="button" onClick={handleEnviarEtapa} disabled={enviandoEtapa} className="min-h-11 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50">{enviandoEtapa ? "Enviando..." : "Confirmar y enviar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1: NOTAS PARA PRODUCTOS NUEVOS --- */}
      {productoParaNota && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/90 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-md rounded-[3rem] p-8 shadow-2xl">
            <h2 className="text-xs text-neutral-500 uppercase tracking-widest mb-2">Instrucciones</h2>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-500 mb-6">{productoParaNota.name}</p>
            <textarea autoFocus value={notaTemporal} onChange={(e) => setNotaTemporal(e.target.value)} placeholder="Ej: Término medio, sin cebolla..." className="w-full h-32 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 text-neutral-900 dark:text-white focus:border-orange-500 outline-none resize-none mb-8 text-sm placeholder:text-neutral-400" />
            <div className="flex gap-4">
              <button onClick={() => setProductoParaNota(null)} className="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">Cancelar</button>
              <button onClick={confirmarProductoConNota} className="flex-1 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-colors">Añadir</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDITAR NOTA EXISTENTE --- */}
      {itemParaEditarNota && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/90 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-md rounded-[3rem] p-8 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Info size={14} className="text-orange-500" />
              <h2 className="text-xs text-neutral-500 uppercase tracking-widest">Actualizar Nota</h2>
            </div>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-500 mb-6">{itemParaEditarNota.product.name}</p>
            <textarea autoFocus value={notaEditadaTemporal} onChange={(e) => setNotaEditadaTemporal(e.target.value)} className="w-full h-32 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 text-neutral-900 dark:text-white focus:border-orange-500 outline-none resize-none mb-8 text-sm" />
            <div className="flex gap-4">
              <button onClick={() => setItemParaEditarNota(null)} className="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">Descartar</button>
              <button onClick={guardarNotaEditada} className="flex-1 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: CONFIRMACIÓN ELIMINACIÓN --- */}
      {itemParaEliminar && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 dark:bg-black/95 backdrop-blur-md">
          <div className="bg-white dark:bg-neutral-900 border border-red-500/20 w-full max-w-[360px] rounded-[3rem] p-10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 dark:border-red-500/20">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">¿Eliminar Plato?</h2>
            <p className="text-neutral-500 text-sm mb-10 italic">
              Vas a remover <span className="text-neutral-800 dark:text-neutral-200 font-bold">"{itemParaEliminar.product.name}"</span> de la cuenta.
            </p>
            <div className="flex flex-col gap-4">
              <button onClick={ejecutarEliminacion} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-colors">Confirmar</button>
              <button onClick={() => setItemParaEliminar(null)} className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-2xl text-xs font-bold uppercase tracking-widest transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}