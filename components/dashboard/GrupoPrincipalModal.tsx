'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useModalBack } from '@/hooks/useModalBack';
import { X, Users, ChevronDown, Sparkles } from 'lucide-react';

interface GrupoPrincipalModalProps {
  usuario: { id: string; nombre: string; grupo_principal?: string | null };
  onClose: () => void;
  onSaved: (grupo: string) => void;
}

interface GrupoOpcion {
  grupo: string;
  sede: string;
}

const SEDES = ['Principal', 'Primaria', 'Maria Inmaculada'];

export default function GrupoPrincipalModal({ usuario, onClose, onSaved }: GrupoPrincipalModalProps) {
  useModalBack(true, onClose, 'grupo-principal-modal');

  const [grupos, setGrupos] = useState<GrupoOpcion[]>([]);
  const [sugerencias, setSugerencias] = useState<{ grupo: string; dias: number }[]>([]);
  const [seleccionado, setSeleccionado] = useState(usuario.grupo_principal || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('estudiantes')
        .select('grupo, sede')
        .not('grupo', 'ilike', '%2025%');

      const mapa = new Map<string, string>();
      (data || []).forEach((e: any) => {
        if (e.grupo && !mapa.has(e.grupo)) mapa.set(e.grupo, e.sede || 'Principal');
      });
      setGrupos(
        Array.from(mapa.entries())
          .map(([grupo, sede]) => ({ grupo, sede }))
          .sort((a, b) => a.grupo.localeCompare(b.grupo, undefined, { numeric: true }))
      );

      const { data: sug } = await supabase.rpc('sugerir_grupo_principal', { p_usuario_id: usuario.id });
      setSugerencias(sug || []);
      if (!usuario.grupo_principal && sug && sug.length > 0) {
        setSeleccionado(sug[0].grupo);
      }
    };
    cargar();
  }, [usuario.id, usuario.grupo_principal]);

  const handleGuardar = async () => {
    if (!seleccionado || guardando) return;
    setGuardando(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('asignar_grupo_principal', {
      p_usuario_id: usuario.id,
      p_grupo: seleccionado
    });

    setGuardando(false);
    if (rpcError) {
      setError(rpcError.message.replace('PAE_BLOQUEO: ', ''));
      return;
    }
    onSaved(seleccionado);
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full max-h-[88vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 bg-gradient-to-br from-teal-600 to-teal-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl border border-white/10">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-xl tracking-tight leading-none">Grupo Principal</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mt-2 truncate max-w-[220px]">{usuario.nombre}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <p className="text-xs font-bold text-gray-500 leading-relaxed dark:text-gray-400">
            El estudiante PAE solo gana puntos y mantiene su racha registrando este grupo. Puede registrar otros grupos para cubrir a un compañero, pero sin puntos.
          </p>

          {sugerencias.length > 0 && (
            <div>
              <label className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <Sparkles className="w-3 h-3" /> Grupos que más ha registrado
              </label>
              <div className="flex flex-wrap gap-2">
                {sugerencias.map(s => (
                  <button
                    key={s.grupo}
                    onClick={() => setSeleccionado(s.grupo)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${seleccionado === s.grupo ? 'bg-teal-600 border-teal-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'}`}
                  >
                    {s.grupo} · {s.dias} {s.dias === 1 ? 'día' : 'días'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Grupo</label>
            <div className="relative">
              <select
                value={seleccionado}
                onChange={(e) => setSeleccionado(e.target.value)}
                className="w-full appearance-none px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Selecciona un grupo</option>
                {SEDES.map(sede => (
                  <optgroup key={sede} label={sede}>
                    {grupos.filter(g => g.sede === sede).map(g => (
                      <option key={g.grupo} value={g.grupo}>{g.grupo}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <ChevronDown className="h-4 w-4 text-teal-500" />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-gray-200 active:scale-95 dark:bg-gray-700 dark:text-gray-300"
            >
              Después
            </button>
            <button
              onClick={handleGuardar}
              disabled={!seleccionado || guardando}
              className="flex-1 py-3 bg-teal-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-teal-700 active:scale-95 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Asignar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
