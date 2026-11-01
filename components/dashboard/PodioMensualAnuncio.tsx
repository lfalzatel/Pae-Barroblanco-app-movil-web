'use client';

import { useEffect, useState } from 'react';
import { X, Star, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import MedallaModal, { MEDALLAS, nombreMes, limpiarNombre } from '@/components/dashboard/MedallaModal';

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

  useEffect(() => {
    if (modo !== 'anuncio') return;
    document.body.classList.add('gamification-modal-open', 'overflow-hidden');
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

  const mia = podio.find(r => r.usuario_id === usuario.id);
  if (modo === 'ganador' && mia) {
    return <MedallaModal medalla={mia} onClose={cerrar} />;
  }

  const { anio, mes } = podio[0];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300"
      onClick={cerrar}
    >
      <div className="relative w-full max-w-sm animate-in zoom-in-90 duration-500" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={cerrar}
          className="absolute -top-3 -right-3 z-10 text-amber-950 bg-yellow-400 hover:bg-yellow-300 p-2 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110 active:scale-95"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="rounded-[32px] p-6 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-500/30 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3 shadow-lg shadow-orange-500/30">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
              Ganadores de {nombreMes(anio, mes)}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Podio Gestor PAE {anio}</p>
          </div>

          <div className="space-y-2">
            {podio.map(r => (
              <div key={r.puesto} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50">
                <span className="text-3xl leading-none">{MEDALLAS[r.puesto].emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-gray-900 dark:text-white truncate">{limpiarNombre(r.nombre)}</p>
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
      </div>
    </div>
  );
}
