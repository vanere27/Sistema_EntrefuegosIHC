// src/app/page.tsx
"use client";
import { useState, useEffect } from "react"; 
import { Delete, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore"; 

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useUserStore();
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const [chispas, setChispas] = useState<{top: string, left: string, duration: string}[]>([]);

  useEffect(() => {
    const nuevasChispas = [...Array(20)].map(() => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      duration: `${3 + Math.random() * 2}s`
    }));
    setChispas(nuevasChispas);
  }, []);

  const validarPin = async (pinAValidar: string) => {
    try {
      setCargando(true);
      const respuesta = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinAValidar })
      });
      const data = await respuesta.json();

      if (respuesta.ok) {
        toast.success(data.mensaje);
        login(data.usuario); 
        // --- LÓGICA DE REDIRECCIÓN POR ROL (IHC) ---
        if (data.usuario.role === 'ADMIN') {
          router.push('/admin/comandas');
        } else if (data.usuario.role === 'CAJERO') {
          router.push('/admin/comandas');
        } else if (data.usuario.role === 'COCINA') {
          router.push('/cocina'); 
        } else {
          router.push('/mesas'); 
        }               
      } else {
        toast.error(data.error);
        setPin("");       
      }
    } catch (error) {
      toast.error("Error de conexión");
      setPin("");
    } finally {
      setCargando(false);
    }
  };

  const handlePress = (num: string) => {
    if (pin.length < 4 && !cargando) {
      const nuevoPin = pin + num;
      setPin(nuevoPin);
      if (nuevoPin.length === 4) validarPin(nuevoPin);
    }
  };

  const handleDelete = () => { if (!cargando) setPin(pin.slice(0, -1)); };

  useEffect(() => {
    const handleKeyboardInput = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']"))) return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        handlePress(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        handleDelete();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (pin.length === 4 && !cargando) void validarPin(pin);
      } else if (event.key === "Escape" && !cargando) {
        setPin("");
      }
    };

    window.addEventListener("keydown", handleKeyboardInput);
    return () => window.removeEventListener("keydown", handleKeyboardInput);
  });

  return (
    // AQUÍ ESTÁ LA MAGIA 1: bg-neutral-50 para modo claro, dark:bg-neutral-950 para oscuro
    <div className="min-h-[calc(100dvh-3.5rem)] bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
             
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(249,115,22,0.15)_0%,_transparent_75%)] pointer-events-none" />
             
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center z-10 mb-12"
      >
        {/* MAGIA 2: Título adaptable */}
        <h1 className="text-5xl md:text-6xl font-extralight tracking-[0.2em] mb-2 text-neutral-800 dark:text-orange-100/90 transition-colors">
          ENTRE <span className="font-semibold text-orange-500">FUEGOS</span>
        </h1>
        <p className="text-neutral-500 tracking-[0.4em] text-xs uppercase font-light">
          Ingresa tu PIN de acceso
        </p>
      </motion.div>

      <div className="flex justify-center gap-10 mb-20 z-10 w-full">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ scale: pin.length > i ? 1.3 : 1 }}
            className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
              pin.length > i 
                ? 'bg-orange-500 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)]' 
                : 'bg-transparent border-neutral-300 dark:border-neutral-700'
            }`}
          />
        ))}
      </div>

      <div className="z-10 w-full max-w-[340px] md:max-w-[400px]">
        <div className="grid grid-cols-3 gap-y-8 gap-x-8 justify-items-center">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <motion.button
              key={num}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95, backgroundColor: "#f97316", color: "white", borderColor: "#f97316", boxShadow: "0 0 30px rgba(249,115,22,0.6)" }}
              onClick={() => handlePress(num.toString())}
              disabled={cargando}
              // MAGIA 3: Botones adaptables (blancos en modo claro, oscuros en modo dark)
              className="w-20 h-20 md:w-24 md:h-24 rounded-full border bg-white border-neutral-300 text-neutral-800 dark:bg-neutral-900/40 dark:border-neutral-800 dark:text-neutral-300 text-3xl md:text-4xl font-light flex items-center justify-center transition-all hover:border-orange-500/40 dark:hover:border-orange-500/40"
            >
              {num}
            </motion.button>
          ))}
                     
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleDelete}
            className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors"
          >
            <Delete size={36} strokeWidth={1} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, backgroundColor: "#f97316", color: "white", borderColor: "#f97316" }}
            onClick={() => handlePress("0")}
            className="w-20 h-20 md:w-24 md:h-24 rounded-full border bg-white border-neutral-300 text-neutral-800 dark:bg-neutral-900/40 dark:border-neutral-800 dark:text-neutral-300 text-3xl md:text-4xl font-light flex items-center justify-center transition-all hover:border-orange-500/40 dark:hover:border-orange-500/40"
          >
            0
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => pin.length === 4 && validarPin(pin)}
            disabled={pin.length !== 4 || cargando}
            className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center border transition-all ${
              pin.length === 4 
               ? "bg-orange-600 border-orange-500 text-white shadow-[0_0_30px_rgba(234,88,12,0.5)]" 
               // MAGIA 4: El botón de enter deshabilitado adaptable
               : "bg-neutral-200 border-neutral-300 text-neutral-400 dark:bg-neutral-900/40 dark:border-neutral-800 dark:text-neutral-800"
            }`}
          >
            <ArrowRight size={36} strokeWidth={1} />
          </motion.button>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none opacity-20">
        {chispas.map((chispa, i) => (
          <div 
            key={i}
            className="absolute w-1 h-1 bg-orange-500 rounded-full animate-pulse"
            style={{
              top: chispa.top,
              left: chispa.left,
              animationDuration: chispa.duration
            }}
          />
        ))}
      </div>
    </div>
  );
}