'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import { X, Star, Share2 } from 'lucide-react';
import { playGamificationFanfare, speakVoiceConfirmation } from '@/lib/ui-sounds';

export interface MedallaData {
  anio: number;
  mes: number;
  puesto: number;
  nombre: string | null;
  grupo: string | null;
  puntos: number;
  dias: number;
}

export const MEDALLAS: Record<number, { nombre: string; emoji: string; gradiente: string; borde: string; texto: string; circulo: string; confeti: string[] }> = {
  1: { nombre: 'ORO', emoji: '🥇', gradiente: 'from-yellow-300 via-amber-400 to-yellow-600', borde: 'border-yellow-200', texto: 'text-amber-950', circulo: 'from-yellow-100 via-yellow-400 to-amber-600', confeti: ['#facc15', '#f59e0b', '#fde68a', '#ffffff'] },
  2: { nombre: 'PLATA', emoji: '🥈', gradiente: 'from-slate-200 via-gray-300 to-slate-500', borde: 'border-white', texto: 'text-slate-900', circulo: 'from-white via-slate-300 to-slate-500', confeti: ['#e2e8f0', '#94a3b8', '#cbd5e1', '#ffffff'] },
  3: { nombre: 'BRONCE', emoji: '🥉', gradiente: 'from-orange-300 via-orange-500 to-amber-800', borde: 'border-orange-200', texto: 'text-orange-950', circulo: 'from-orange-200 via-orange-500 to-amber-800', confeti: ['#fb923c', '#c2410c', '#fdba74', '#ffffff'] },
};

// Medalla dibujada con CSS: los emojis grandes se desplazan al capturar la imagen con html2canvas
function MedallaIcono({ puesto }: { puesto: number }) {
  const estilo = MEDALLAS[puesto];
  return (
    <div className="relative mx-auto w-28 h-32">
      <div className="absolute top-0 w-9 h-16 bg-blue-600 border-x-4 border-red-500" style={{ left: 22, transform: 'rotate(-18deg)' }} />
      <div className="absolute top-0 w-9 h-16 bg-blue-600 border-x-4 border-red-500" style={{ right: 22, transform: 'rotate(18deg)' }} />
      <div
        className={`absolute bottom-0 w-24 h-24 rounded-full bg-gradient-to-br ${estilo.circulo} border-4 border-white/80 shadow-xl flex items-center justify-center`}
        style={{ left: 8 }}
      >
        <div className="w-[72px] h-[72px] rounded-full border-2 border-white/60 flex items-center justify-center">
          <span className={`text-4xl font-black ${estilo.texto}`}>{puesto}</span>
        </div>
      </div>
    </div>
  );
}

// Los nombres importados traen " _ " en lugar del segundo nombre vacío
export const limpiarNombre = (nombre: string | null) => (nombre || '').replace(/ _ /g, ' ');

export const nombreMes = (anio: number, mes: number) =>
  new Date(anio, mes - 1, 1).toLocaleString('es-CO', { month: 'long' });

interface MedallaModalProps {
  medalla: MedallaData;
  onClose: () => void;
  compartible?: boolean;
  etiqueta?: string; // Ej: "Vista de prueba"
}

export default function MedallaModal({ medalla, onClose, compartible = true, etiqueta }: MedallaModalProps) {
  const tarjetaRef = useRef<HTMLDivElement | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const estilo = MEDALLAS[medalla.puesto];
  const mesTexto = nombreMes(medalla.anio, medalla.mes);

  useEffect(() => {
    document.body.classList.add('gamification-modal-open', 'overflow-hidden');
    playGamificationFanfare();
    speakVoiceConfirmation(`¡Felicitaciones! Ocupaste el puesto ${estilo.nombre.toLowerCase()} en ${mesTexto}.`);

    const disparar = (origenX: number) => confetti({
      particleCount: 90,
      spread: 70,
      origin: { x: origenX, y: 0.7 },
      colors: estilo.confeti,
      zIndex: 10001
    });
    disparar(0.2);
    const t1 = setTimeout(() => disparar(0.8), 350);
    const t2 = setTimeout(() => disparar(0.5), 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      document.body.classList.remove('gamification-modal-open', 'overflow-hidden');
    };
  }, []);

  // Genera una imagen de la tarjeta y la comparte (WhatsApp, Instagram...) o la descarga
  const compartir = async () => {
    if (!tarjetaRef.current || compartiendo) return;
    setCompartiendo(true);
    try {
      const canvas = await html2canvas(tarjetaRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        // La copia que captura html2canvas reinicia las animaciones (medalla en escala 0): se desactivan
        onclone: (doc) => {
          const s = doc.createElement('style');
          s.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
          doc.head.appendChild(s);
        }
      });
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const archivo = new File([blob], `Medalla-PAE-${estilo.nombre}-${mesTexto}-${medalla.anio}.png`, { type: 'image/png' });
      const texto = `¡Gané la medalla de ${estilo.nombre} ${estilo.emoji} como Gestor PAE en ${mesTexto} ${medalla.anio}! I.E. Barroblanco`;

      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        await navigator.share({ title: 'Medalla Gestor PAE', text: texto, files: [archivo] });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = archivo.name;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('Error al compartir medalla:', err);
    } finally {
      setCompartiendo(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <style>{`
        @keyframes podioMedalla {
          0% { transform: scale(0) rotate(-180deg); }
          60% { transform: scale(1.2) rotate(15deg); }
          80% { transform: scale(0.95) rotate(-5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes podioBrillo {
          0%, 100% { box-shadow: 0 0 30px rgba(250, 204, 21, 0.35); }
          50% { box-shadow: 0 0 70px rgba(250, 204, 21, 0.75); }
        }
      `}</style>

      <div className="relative w-full max-w-sm animate-in zoom-in-90 duration-500" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 text-amber-950 bg-yellow-400 hover:bg-yellow-300 p-2 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110 active:scale-95"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          ref={tarjetaRef}
          className={`rounded-[32px] p-6 text-center bg-gradient-to-b ${estilo.gradiente} border-4 ${estilo.borde}`}
          style={{ animation: 'podioBrillo 2.4s ease-in-out infinite' }}
        >
          {etiqueta && (
            <span data-html2canvas-ignore className="inline-block mb-2 px-2 py-0.5 rounded-md bg-black/25 text-white text-[9px] font-black uppercase tracking-widest">
              {etiqueta}
            </span>
          )}
          <div className="mb-3" style={{ animation: 'podioMedalla 900ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both' }}>
            <MedallaIcono puesto={medalla.puesto} />
          </div>
          <p className={`text-[11px] font-black uppercase tracking-[0.25em] ${estilo.texto} opacity-80`}>
            Ocupaste el puesto
          </p>
          <h2 className={`text-4xl font-black tracking-tight ${estilo.texto} leading-none mt-1`}>
            {estilo.nombre}
          </h2>
          <p className={`text-sm font-black uppercase tracking-widest ${estilo.texto} mt-2`}>
            en {mesTexto} {medalla.anio}
          </p>

          {medalla.nombre && (
            <p className={`mt-4 text-base font-black uppercase ${estilo.texto} leading-tight`}>
              {limpiarNombre(medalla.nombre)}
              {medalla.grupo && <span className="block text-[11px] tracking-widest opacity-80">Grupo {medalla.grupo}</span>}
            </p>
          )}

          <div className="mt-4 bg-black/20 rounded-2xl p-4 flex items-center justify-around text-white">
            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1 text-2xl font-black">
                <Star className="w-5 h-5 fill-yellow-300 text-yellow-300" />{medalla.puntos}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Puntos</span>
            </div>
            <div className="h-10 w-px bg-white/30" />
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black">{medalla.dias}</span>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Días registrando</span>
            </div>
          </div>

          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${estilo.texto} opacity-70 mt-4`}>
            Gestor PAE · I.E. Barroblanco
          </p>

          <div data-html2canvas-ignore className="mt-5 flex gap-2">
            {compartible && (
              <button
                onClick={compartir}
                disabled={compartiendo}
                className="flex-1 py-3.5 bg-white/90 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
              >
                <Share2 className="w-4 h-4" /> {compartiendo ? 'Preparando...' : 'Compartir'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] active:scale-95 transition-transform"
            >
              ¡Gracias!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
