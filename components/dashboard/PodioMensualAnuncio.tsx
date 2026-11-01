'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { X, Star, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { playGamificationFanfare, speakVoiceConfirmation } from '@/lib/ui-sounds';

interface PodioRow {
  anio: number;
  mes: number;
  puesto: number;
  usuario_id: string;
  nombre: string | null;
  grupo: string | null;
  puntos: number;
  dias: number;
  visto: boolean;
}

export const MEDALLAS: Record<number, { nombre: string; emoji: string; gradiente: string; borde: string; texto: string; confeti: string[] }> = {
  1: { nombre: 'ORO', emoji: '🥇', gradiente: 'from-yellow-300 via-amber-400 to-yellow-600', borde: 'border-yellow-200', texto: 'text-amber-950', confeti: ['#facc15', '#f59e0b', '#fde68a', '#ffffff'] },
  2: { nombre: 'PLATA', emoji: '🥈', gradiente: 'from-slate-200 via-gray-300 to-slate-500', borde: 'border-white', texto: 'text-slate-900', confeti: ['#e2e8f0', '#94a3b8', '#cbd5e1', '#ffffff'] },
  3: { nombre: 'BRONCE', emoji: '🥉', gradiente: 'from-orange-300 via-orange-500 to-amber-800', borde: 'border-orange-200', texto: 'text-orange-950', confeti: ['#fb923c', '#c2410c', '#fdba74', '#ffffff'] },
};

export const nombreMes = (anio: number, mes: number) =>
  new Date(anio, mes - 1, 1).toLocaleString('es-CO', { month: 'long' });

// Retraso para no tapar el splash inicial
const RETRASO_MS = 4000;

export default function PodioMensualAnuncio({ usuario }: { usuario: { id: string; rol?: string } }) {
  const [podio, setPodio] = useState<PodioRow[]>([]);
  const [modo, setModo] = useState<'ganador' | 'anuncio' | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cargar = async () => {
      await supabase.rpc('cerrar_meses_pae');

      const { data, error } = await supabase
        .from('podio_mensual_pae')
        .select('*')
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })
        .order('puesto', { ascending: true })
        .limit(3);

      if (error || !data || data.length === 0) return;

      // Solo se anuncia el mes inmediatamente anterior
      const ahora = new Date();
      const anterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      const ultimo = data[0];
      if (ultimo.anio !== anterior.getFullYear() || ultimo.mes !== anterior.getMonth() + 1) return;

      const filas = (data as PodioRow[]).filter(r => r.anio === ultimo.anio && r.mes === ultimo.mes);
      const mia = filas.find(r => r.usuario_id === usuario.id);
      const claveAnuncio = `pae_podio_anuncio_${ultimo.anio}_${ultimo.mes}`;

      let siguiente: 'ganador' | 'anuncio' | null = null;
      if (mia && !mia.visto) {
        siguiente = 'ganador';
      } else if (!mia && usuario.rol === 'estudiante_pae') {
        try {
          if (!localStorage.getItem(claveAnuncio)) siguiente = 'anuncio';
        } catch (e) {}
      }

      if (siguiente) {
        setPodio(filas);
        timer = setTimeout(() => setModo(siguiente), RETRASO_MS);
      }
    };

    cargar();
    return () => { if (timer) clearTimeout(timer); };
  }, [usuario.id, usuario.rol]);

  const mia = podio.find(r => r.usuario_id === usuario.id);

  useEffect(() => {
    if (!modo) return;
    document.body.classList.add('gamification-modal-open', 'overflow-hidden');

    if (modo === 'ganador' && mia) {
      const medalla = MEDALLAS[mia.puesto];
      playGamificationFanfare();
      speakVoiceConfirmation(`¡Felicitaciones! Ocupaste el puesto ${medalla.nombre.toLowerCase()} en ${nombreMes(mia.anio, mia.mes)}.`);
      const disparar = (origenX: number) => confetti({
        particleCount: 90,
        spread: 70,
        origin: { x: origenX, y: 0.7 },
        colors: medalla.confeti
      });
      disparar(0.2);
      setTimeout(() => disparar(0.8), 350);
      setTimeout(() => disparar(0.5), 800);
    }

    return () => {
      document.body.classList.remove('gamification-modal-open', 'overflow-hidden');
    };
  }, [modo]);

  const cerrar = async () => {
    const actual = modo;
    setModo(null);
    if (podio.length === 0) return;
    const { anio, mes } = podio[0];
    if (actual === 'ganador') {
      await supabase.rpc('marcar_podio_visto', { p_anio: anio, p_mes: mes });
    } else {
      try { localStorage.setItem(`pae_podio_anuncio_${anio}_${mes}`, '1'); } catch (e) {}
    }
  };

  if (!modo || podio.length === 0) return null;

  const { anio, mes } = podio[0];
  const mesTexto = nombreMes(anio, mes);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300"
      onClick={cerrar}
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

      <div
        className="relative w-full max-w-sm animate-in zoom-in-90 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={cerrar}
          className="absolute -top-3 -right-3 z-10 text-amber-950 bg-yellow-400 hover:bg-yellow-300 p-2 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110 active:scale-95"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {modo === 'ganador' && mia ? (
          <div className={`rounded-[32px] p-6 text-center bg-gradient-to-b ${MEDALLAS[mia.puesto].gradiente} border-4 ${MEDALLAS[mia.puesto].borde}`} style={{ animation: 'podioBrillo 2.4s ease-in-out infinite' }}>
            <div className="text-8xl leading-none mb-3" style={{ animation: 'podioMedalla 900ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both' }}>
              {MEDALLAS[mia.puesto].emoji}
            </div>
            <p className={`text-[11px] font-black uppercase tracking-[0.25em] ${MEDALLAS[mia.puesto].texto} opacity-80`}>
              Ocupaste el puesto
            </p>
            <h2 className={`text-4xl font-black tracking-tight ${MEDALLAS[mia.puesto].texto} leading-none mt-1`}>
              {MEDALLAS[mia.puesto].nombre}
            </h2>
            <p className={`text-sm font-black uppercase tracking-widest ${MEDALLAS[mia.puesto].texto} mt-2`}>
              en {mesTexto} {anio}
            </p>

            <div className="mt-5 bg-black/20 rounded-2xl p-4 flex items-center justify-around text-white">
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-2xl font-black">
                  <Star className="w-5 h-5 fill-yellow-300 text-yellow-300" />{mia.puntos}
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Puntos</span>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black">{mia.dias}</span>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Días registrando</span>
              </div>
            </div>

            <p className={`text-xs font-bold ${MEDALLAS[mia.puesto].texto} mt-4 leading-relaxed`}>
              Gracias por llevar la asistencia de tu grupo{mia.grupo ? ` ${mia.grupo}` : ''} todos los días.
            </p>

            <button
              onClick={cerrar}
              className="mt-5 w-full py-3.5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] active:scale-95 transition-transform"
            >
              ¡Gracias!
            </button>
          </div>
        ) : (
          <div className="rounded-[32px] p-6 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-500/30 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3 shadow-lg shadow-orange-500/30">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                Ganadores de {mesTexto}
              </h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Podio Gestor PAE {anio}</p>
            </div>

            <div className="space-y-2">
              {podio.map(r => (
                <div key={r.puesto} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-3xl leading-none">{MEDALLAS[r.puesto].emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-gray-900 dark:text-white truncate">{r.nombre}</p>
                    {r.grupo && <p className="text-[10px] font-bold text-gray-400">Grupo {r.grupo}</p>}
                  </div>
                  <span className="flex items-center gap-1 text-amber-500 font-black text-sm shrink-0">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-500" />{r.puntos}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 text-center mt-5">
              Registra tu grupo todos los días y el próximo podio puede ser tuyo.
            </p>

            <button
              onClick={cerrar}
              className="mt-4 w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] active:scale-95 transition-transform"
            >
              ¡Vamos por el próximo!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
