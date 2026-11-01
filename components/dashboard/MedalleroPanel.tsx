'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import MedallaModal, { MEDALLAS, nombreMes } from '@/components/dashboard/MedallaModal';

interface PodioRow {
  anio: number;
  mes: number;
  puesto: number;
  usuario_id: string;
  nombre: string | null;
  grupo: string | null;
  puntos: number;
  dias: number;
}

interface Medallas {
  usuario_id: string;
  nombre: string;
  grupo: string | null;
  oro: number;
  plata: number;
  bronce: number;
}

export default function MedalleroPanel() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [filas, setFilas] = useState<PodioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [miId, setMiId] = useState<string | null>(null);
  const [medallaAbierta, setMedallaAbierta] = useState<PodioRow | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMiId(data.user?.id || null));
  }, []);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('podio_mensual_pae')
        .select('anio, mes, puesto, usuario_id, nombre, grupo, puntos, dias')
        .eq('anio', anio)
        .order('mes', { ascending: false })
        .order('puesto', { ascending: true });
      setFilas((data as PodioRow[]) || []);
      setLoading(false);
    };
    cargar();
  }, [anio]);

  // Tabla del año: ordenada como medallero olímpico (oros, luego platas, luego bronces)
  const mapa = new Map<string, Medallas>();
  filas.forEach(f => {
    if (!mapa.has(f.usuario_id)) {
      mapa.set(f.usuario_id, { usuario_id: f.usuario_id, nombre: f.nombre || 'Estudiante PAE', grupo: f.grupo, oro: 0, plata: 0, bronce: 0 });
    }
    const m = mapa.get(f.usuario_id)!;
    if (f.puesto === 1) m.oro++;
    else if (f.puesto === 2) m.plata++;
    else m.bronce++;
  });
  const tabla = Array.from(mapa.values()).sort((a, b) =>
    b.oro - a.oro || b.plata - a.plata || b.bronce - a.bronce || a.nombre.localeCompare(b.nombre)
  );

  const meses = Array.from(new Set(filas.map(f => f.mes)));

  return (
    <div>
      <div className="flex justify-center mb-4">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-0.5 rounded-[2rem] flex items-center shadow-lg shadow-orange-100 border border-orange-500/30">
          <button onClick={() => setAnio(anio - 1)} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors active:scale-90">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 text-center min-w-[140px]">
            <div className="text-[10px] font-black text-orange-100 uppercase tracking-wider">Medallero</div>
            <div className="text-white font-bold text-sm">AÑO {anio}</div>
          </div>
          <button onClick={() => setAnio(anio + 1)} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors active:scale-90">
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-500 py-8">Cargando medallero...</p>
      ) : filas.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">Aún no hay meses cerrados en {anio}.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">Medallas del año</h4>
            <div className="space-y-2">
              {tabla.map(m => (
                <div key={m.usuario_id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-100 leading-tight truncate">{m.nombre}</span>
                    {m.grupo && <span className="text-[10px] text-gray-400 font-semibold">Grupo {m.grupo}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-sm font-black text-gray-700 dark:text-gray-200">
                    <span className={m.oro ? '' : 'opacity-30'}>🥇{m.oro}</span>
                    <span className={m.plata ? '' : 'opacity-30'}>🥈{m.plata}</span>
                    <span className={m.bronce ? '' : 'opacity-30'}>🥉{m.bronce}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">Podio por mes</h4>
            <div className="space-y-3">
              {meses.map(mes => (
                <div key={mes} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 p-3">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-2">{nombreMes(anio, mes)}</p>
                  <div className="space-y-1.5">
                    {filas.filter(f => f.mes === mes).map(f => {
                      const esMia = f.usuario_id === miId;
                      return (
                        <button
                          key={f.puesto}
                          type="button"
                          disabled={!esMia}
                          onClick={() => setMedallaAbierta(f)}
                          className={`w-full flex items-center gap-2 text-left rounded-lg ${esMia ? 'bg-white/70 dark:bg-gray-800/60 p-1.5 -mx-1.5 active:scale-[0.98] transition-transform' : 'cursor-default'}`}
                        >
                          <span className="text-xl leading-none">{MEDALLAS[f.puesto].emoji}</span>
                          <span className="flex-1 min-w-0 text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                            {f.nombre}
                            {f.grupo && <span className="text-[10px] text-gray-400 font-semibold"> · {f.grupo}</span>}
                          </span>
                          {esMia && <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">Ver mi medalla</span>}
                          <span className="flex items-center gap-1 text-amber-500 font-black text-xs shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />{f.puntos}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {medallaAbierta && (
        <MedallaModal medalla={medallaAbierta} onClose={() => setMedallaAbierta(null)} />
      )}
    </div>
  );
}
