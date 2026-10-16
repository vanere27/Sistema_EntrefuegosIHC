"use client";

import { useEffect, useId, useState } from "react";
import { Accessibility, RotateCcw, X } from "lucide-react";
import { useUserStore } from "@/store/userStore";
import { unlockNotificationAudio } from "@/components/NotificationSound";

type AccessibilityPreferences = {
  textScale: number;
  spacedText: boolean;
  highContrast: boolean;
  easyReading: boolean;
  visualAlerts: boolean;
  soundAlerts: boolean;
  reducedMotion: boolean;
};

const defaultPreferences: AccessibilityPreferences = {
  textScale: 100,
  spacedText: false,
  highContrast: false,
  easyReading: false,
  visualAlerts: true,
  soundAlerts: true,
  reducedMotion: false,
};

function PreferenceSwitch({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 border-b border-neutral-200 py-3 last:border-0 dark:border-neutral-700">
      <span>
        <span className="block text-sm font-bold text-neutral-900 dark:text-white">{label}</span>
        <span className="mt-0.5 block text-xs text-neutral-600 dark:text-neutral-300">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 cursor-pointer accent-orange-600 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
      />
    </label>
  );
}

export function AccessibilitySettings() {
  const userId = useUserStore(state => state.user?.id ?? null);
  const storageKey = `entre-fuegos:accessibility:${userId ?? "guest"}`;
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let next = defaultPreferences;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AccessibilityPreferences>;
        next = {
          textScale: [100, 110, 120, 130, 140, 150].includes(Number(parsed.textScale)) ? Number(parsed.textScale) : defaultPreferences.textScale,
          spacedText: typeof parsed.spacedText === "boolean" ? parsed.spacedText : defaultPreferences.spacedText,
          highContrast: typeof parsed.highContrast === "boolean" ? parsed.highContrast : defaultPreferences.highContrast,
          easyReading: typeof parsed.easyReading === "boolean" ? parsed.easyReading : defaultPreferences.easyReading,
          visualAlerts: typeof parsed.visualAlerts === "boolean" ? parsed.visualAlerts : defaultPreferences.visualAlerts,
          soundAlerts: typeof parsed.soundAlerts === "boolean" ? parsed.soundAlerts : defaultPreferences.soundAlerts,
          reducedMotion: typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : defaultPreferences.reducedMotion,
        };
      }
    } catch {
      next = defaultPreferences;
    }
    setPreferences(next);
    setLoadedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;

    const root = document.documentElement;
    root.style.fontSize = `${preferences.textScale}%`;
    root.classList.toggle("a11y-spaced-text", preferences.spacedText);
    root.classList.toggle("a11y-high-contrast", preferences.highContrast);
    root.classList.toggle("a11y-easy-reading", preferences.easyReading);
    root.classList.toggle("a11y-visual-alerts", preferences.visualAlerts);
    root.classList.toggle("a11y-sound-alerts", preferences.soundAlerts);
    root.classList.toggle("a11y-reduced-motion", preferences.reducedMotion);

    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      return;
    }
  }, [loadedKey, preferences, storageKey]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const updatePreference = <Key extends keyof AccessibilityPreferences>(key: Key, value: AccessibilityPreferences[Key]) => {
    setPreferences(current => ({ ...current, [key]: value }));
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        aria-controls="accessibility-panel"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-900 shadow-lg transition-colors hover:bg-neutral-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
      >
        <Accessibility size={18} aria-hidden="true" />
        <span>Accesibilidad</span>
      </button>

      {isOpen && (
        <section
          id="accessibility-panel"
          aria-labelledby="accessibility-title"
          className="fixed right-3 top-[4.5rem] z-[100] overflow-y-auto rounded-2xl border border-neutral-300 bg-white p-5 text-neutral-900 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          style={{ width: "min(24rem, calc(100vw - 1.5rem))", maxHeight: "calc(100dvh - 5.25rem)" }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="accessibility-title" className="text-lg font-black">Accesibilidad</h2>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">Preferencias guardadas para esta cuenta</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar accesibilidad"
              className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-orange-500 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <X size={18} />
            </button>
          </div>

          <div className="border-b border-neutral-200 pb-4 dark:border-neutral-700">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor={`${id}-text-scale`} className="text-sm font-bold">Tamaño de texto</label>
              <output htmlFor={`${id}-text-scale`} className="text-sm font-black tabular-nums">{preferences.textScale}%</output>
            </div>
            <input
              id={`${id}-text-scale`}
              type="range"
              min="100"
              max="150"
              step="10"
              value={preferences.textScale}
              onChange={event => updatePreference("textScale", Number(event.target.value))}
              aria-label="Tamaño general del texto"
              className="w-full cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-300"><span>Normal</span><span>Muy grande</span></div>
          </div>

          <div className="mt-1">
            <PreferenceSwitch id={`${id}-spacing`} label="Espaciado amplio" description="Separa letras y líneas para facilitar la lectura." checked={preferences.spacedText} onChange={checked => updatePreference("spacedText", checked)} />
            <PreferenceSwitch id={`${id}-contrast`} label="Alto contraste" description="Usa texto y fondos en blanco y negro." checked={preferences.highContrast} onChange={checked => updatePreference("highContrast", checked)} />
            <PreferenceSwitch id={`${id}-reading`} label="Lectura fácil" description="Usa una fuente clara y mayor separación entre líneas." checked={preferences.easyReading} onChange={checked => updatePreference("easyReading", checked)} />
            <PreferenceSwitch id={`${id}-visual-alerts`} label="Avisos visuales reforzados" description="Destaca con más intensidad las comandas nuevas." checked={preferences.visualAlerts} onChange={checked => updatePreference("visualAlerts", checked)} />
            <PreferenceSwitch id={`${id}-sound-alerts`} label="Sonido de avisos" description="Timbre breve cuando cocina marca un plato listo." checked={preferences.soundAlerts} onChange={checked => { updatePreference("soundAlerts", checked); if (checked) unlockNotificationAudio(); }} />
            <PreferenceSwitch id={`${id}-motion`} label="Reducir movimiento" description="Limita animaciones y transiciones de pantalla." checked={preferences.reducedMotion} onChange={checked => updatePreference("reducedMotion", checked)} />
          </div>

          <button
            type="button"
            onClick={() => setPreferences(defaultPreferences)}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm font-bold hover:bg-neutral-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-orange-500 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <RotateCcw size={16} aria-hidden="true" /> Restablecer preferencias
          </button>
        </section>
      )}
    </div>
  );
}
