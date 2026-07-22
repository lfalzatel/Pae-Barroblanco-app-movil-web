'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Trophy, Star, ChevronLeft, Medal } from 'lucide-react';

interface GrupoRanking { grupo: string; grado: string | null; total_puntos: number; }
interface GestorRanking { usuario_id: string; nombre: string; avatar_url: string | null; puntos: number; }

export default function RankingGestoresModal({ onClose }: { onClose: () => void }) {
    const [loading, setLoading] = useState(true);
    const [grupos, setGrupos] = useState<GrupoRanking[]>([]);
    const [grupoSeleccionado, setGrupoSeleccionado] = useState<string | null>(null);
    const [gestores, setGestores] = useState<GestorRanking[]>([]);
    const [loadingGestores, setLoadingGestores] = useState(false);

    useEffect(() => {
        const fetchRanking = async () => {
            const { data, error } = await supabase.rpc('ranking_grupos_pae');
            if (!error && data) setGrupos(data as GrupoRanking[]);
            setLoading(false);
        };
        fetchRanking();
    }, []);

    const abrirGrupo = async (grupo: string) => {
        setGrupoSeleccionado(grupo);
        setLoadingGestores(true);
        const { data, error } = await supabase.rpc('ranking_gestores_por_grupo', { p_grupo: grupo });
        if (!error && data) setGestores(data as GestorRanking[]);
        setLoadingGestores(false);
    };

    const medalColor = (i: number) =>
        i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : 'text-gray-300';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[85vh] flex flex-col">
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {grupoSeleccionado && (
                            <button onClick={() => setGrupoSeleccionado(null)} className="p-1 -ml-1">
                                <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                        )}
                        <Trophy className="w-6 h-6 text-white" />
                        <h3 className="text-lg font-black text-white leading-tight">
                            {grupoSeleccionado ? `Grupo ${grupoSeleccionado}` : 'Ranking Gestor PAE'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    {!grupoSeleccionado ? (
                        loading ? (
                            <p className="text-center text-sm text-gray-500 py-8">Cargando ranking...</p>
                        ) : grupos.length === 0 ? (
                            <p className="text-center text-sm text-gray-500 py-8">Aún no hay puntos registrados.</p>
                        ) : (
                            <div className="space-y-2">
                                {grupos.map((g, i) => (
                                    <button
                                        key={g.grupo}
                                        onClick={() => abrirGrupo(g.grupo)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Medal className={`w-5 h-5 ${medalColor(i)}`} />
                                            <span className="font-bold text-sm text-gray-800 dark:text-gray-100">
                                                Grupo {g.grupo}
                                            </span>
                                        </div>
                                        <span className="flex items-center gap-1 text-amber-500 font-black text-sm">
                                            <Star className="w-4 h-4" fill="currentColor" />
                                            {g.total_puntos}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )
                    ) : loadingGestores ? (
                        <p className="text-center text-sm text-gray-500 py-8">Cargando gestores...</p>
                    ) : (
                        <div className="space-y-2">
                            {gestores.map((u, i) => (
                                <div key={u.usuario_id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <Medal className={`w-5 h-5 ${medalColor(i)}`} />
                                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center overflow-hidden">
                                            {u.avatar_url ? (
                                                <img src={u.avatar_url} className="w-full h-full object-cover" alt={u.nombre} />
                                            ) : (
                                                <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">{u.nombre?.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{u.nombre}</span>
                                    </div>
                                    <span className="flex items-center gap-1 text-amber-500 font-black text-sm">
                                        <Star className="w-4 h-4" fill="currentColor" />
                                        {u.puntos}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
