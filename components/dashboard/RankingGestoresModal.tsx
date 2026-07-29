'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Trophy, Star, ChevronLeft, Medal, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface GrupoRanking { grupo: string; grado: string | null; total_puntos: number; }
interface GestorRanking { usuario_id: string; nombre: string; avatar_url: string | null; puntos: number; grupos?: string[]; }

export default function RankingGestoresModal({ onClose }: { onClose: () => void }) {
    const [loading, setLoading] = useState(true);
    const [tabPrincipal, setTabPrincipal] = useState<'grupos' | 'estrellas'>('grupos');
    const [grupos, setGrupos] = useState<GrupoRanking[]>([]);
    const [grupoSeleccionado, setGrupoSeleccionado] = useState<string | null>(null);
    const [gestores, setGestores] = useState<GestorRanking[]>([]);
    const [usuariosEstrellas, setUsuariosEstrellas] = useState<GestorRanking[]>([]);
    const [loadingGestores, setLoadingGestores] = useState(false);
    const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('mes');
    const [fechaRef, setFechaRef] = useState<Date>(new Date());
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const fetchRanking = async () => {
            setLoading(true);
            const { data: dataGrupos, error: errGrupos } = await supabase.rpc('ranking_grupos_pae', { 
                p_periodo: periodo, 
                p_fecha_ref: fechaRef.toISOString().split('T')[0] 
            });
            
            if (!errGrupos && dataGrupos) {
                const listaGrupos = dataGrupos as GrupoRanking[];
                setGrupos(listaGrupos);

                // Obtener desglose de todos los gestores para la pestaña de Estrellas PAE
                const fetchPromises = listaGrupos.map((g) => 
                    supabase.rpc('ranking_gestores_por_grupo', { 
                        p_grupo: g.grupo, 
                        p_periodo: periodo,
                        p_fecha_ref: fechaRef.toISOString().split('T')[0] 
                    })
                );
                
                const results = await Promise.all(fetchPromises);
                const userMap = new Map<string, GestorRanking & { grupos: string[] }>();

                results.forEach((res, idx) => {
                    const gName = listaGrupos[idx].grupo;
                    if (!res.error && res.data) {
                        (res.data as GestorRanking[]).forEach(u => {
                            if (!userMap.has(u.usuario_id)) {
                                userMap.set(u.usuario_id, { ...u, puntos: Number(u.puntos), grupos: [gName] });
                            } else {
                                const existing = userMap.get(u.usuario_id)!;
                                existing.puntos += Number(u.puntos);
                                if (!existing.grupos.includes(gName)) existing.grupos.push(gName);
                            }
                        });
                    }
                });

                const sortedUsers = Array.from(userMap.values()).sort((a, b) => b.puntos - a.puntos);
                setUsuariosEstrellas(sortedUsers);
            }
            setLoading(false);
        };
        fetchRanking();
    }, [periodo, fechaRef]);

    const abrirGrupo = async (grupo: string) => {
        setGrupoSeleccionado(grupo);
        setLoadingGestores(true);
        const { data, error } = await supabase.rpc('ranking_gestores_por_grupo', { 
            p_grupo: grupo, 
            p_periodo: periodo,
            p_fecha_ref: fechaRef.toISOString().split('T')[0] 
        });
        if (!error && data) setGestores(data as GestorRanking[]);
        setLoadingGestores(false);
    };

    const handleMoveWeek = (direction: number) => {
        const newDate = new Date(fechaRef);
        newDate.setDate(newDate.getDate() + (direction * 7));
        setFechaRef(newDate);
    };

    const handleMoveMonth = (direction: number) => {
        const newDate = new Date(fechaRef);
        newDate.setMonth(newDate.getMonth() + direction);
        setFechaRef(newDate);
    };

    const getSemanaLabel = (d: Date) => {
        const start = new Date(d);
        start.setDate(start.getDate() - start.getDay() + 1); // Lunes
        const end = new Date(start);
        end.setDate(end.getDate() + 4); // Viernes
        return `${start.getDate()} DE ${start.toLocaleString('es-CO', { month: 'short' }).toUpperCase()} - ${end.getDate()} DE ${end.toLocaleString('es-CO', { month: 'short' }).toUpperCase()}`;
    };

    const medalColor = (i: number) =>
        i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : 'text-gray-300';

    // Función Helper para construir hojas con membrete institucional formal
    const buildSheetWithHeader = (
        title: string,
        periodoLabel: string,
        convenciones: string,
        tableHeaders: string[],
        dataRows: any[][]
    ) => {
        const nowStr = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
        
        const aoa = [
            ['SISTEMA PAE — INSTITUCIÓN EDUCATIVA BARROBLANCO'],
            [title.toUpperCase()],
            [`Período del Reporte: ${periodoLabel.toUpperCase()}`, '', `Fecha de Generación: ${nowStr}`],
            [`Convenciones / Descripción: ${convenciones}`],
            [], // Fila de separación
            tableHeaders,
            ...dataRows
        ];

        return XLSX.utils.aoa_to_sheet(aoa);
    };

    const exportToExcel = async () => {
        setExporting(true);
        try {
            const formattedDate = new Date().toISOString().split('T')[0];
            const workbook = XLSX.utils.book_new();
            
            const periodoLabel = periodo === 'semana' 
                ? getSemanaLabel(fechaRef)
                : periodo === 'mes'
                ? `${fechaRef.toLocaleString('es-CO', { month: 'long' })} de ${fechaRef.getFullYear()}`
                : `Día ${fechaRef.toLocaleDateString('es-CO')}`;

            // 1. HOJA 1: RESUMEN POR GRUPOS
            const rowsGrupos = grupos.map((g, idx) => [
                idx + 1,
                g.grupo,
                g.total_puntos,
                periodo.toUpperCase()
            ]);
            const wsGrupos = buildSheetWithHeader(
                'Reporte Consolidado por Grupos — PAE',
                periodoLabel,
                'Total de estrellas/puntos acumulados por cada grupo atendido en el período.',
                ['Posición', 'Grupo', 'Total Estrellas / Puntos', 'Período'],
                rowsGrupos
            );
            wsGrupos['!cols'] = [{ wch: 10 }, { wch: 16 }, { wch: 25 }, { wch: 12 }];
            XLSX.utils.book_append_sheet(workbook, wsGrupos, 'Resumen por Grupos');

            // 2. HOJA 2: ESTRELLAS PAE POR USUARIO
            const rowsEstrellas = usuariosEstrellas.map((u, idx) => [
                idx + 1,
                u.nombre,
                (u.grupos || []).join(', '),
                u.puntos,
                periodo.toUpperCase()
            ]);
            const wsEstrellas = buildSheetWithHeader(
                'Reporte de Estrellas PAE por Gestor / Usuario',
                periodoLabel,
                'Ranking individual de gestores PAE según las estrellas (puntos) ganadas en el período.',
                ['Posición General', 'Nombre del Gestor', 'Grupos Atendidos', 'Total Estrellas PAE', 'Período'],
                rowsEstrellas
            );
            wsEstrellas['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 22 }, { wch: 22 }, { wch: 12 }];
            XLSX.utils.book_append_sheet(workbook, wsEstrellas, 'Estrellas PAE por Usuario');

            // 3. HOJA 3: MATRIZ DE ASISTENCIA MENSUAL POR FECHAS (CALENDARIO POR USUARIO)
            const year = fechaRef.getFullYear();
            const month = fechaRef.getMonth();
            const firstDayStr = new Date(year, month, 1).toISOString().split('T')[0];
            const lastDayStr = new Date(year, month + 1, 0).toISOString().split('T')[0];
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            const { data: historialData } = await supabase
                .from('puntos_pae_historial')
                .select(`
                    fecha,
                    usuario_id,
                    puntos,
                    grupo,
                    perfiles_publicos (nombre)
                `)
                .gte('fecha', firstDayStr)
                .lte('fecha', lastDayStr);

            const userActivityMap = new Map<string, {
                nombre: string,
                diasSet: Set<number>,
                totalRegistros: number
            }>();

            (historialData || []).forEach((h: any) => {
                const uId = h.usuario_id;
                const profileObj = Array.isArray(h.perfiles_publicos) ? h.perfiles_publicos[0] : h.perfiles_publicos;
                const uNombre = profileObj?.nombre || 'Gestor PAE';
                const dayNum = parseInt(h.fecha.split('-')[2], 10);

                if (!userActivityMap.has(uId)) {
                    userActivityMap.set(uId, {
                        nombre: uNombre,
                        diasSet: new Set(),
                        totalRegistros: 0
                    });
                }

                const userEntry = userActivityMap.get(uId)!;
                userEntry.diasSet.add(dayNum);
                userEntry.totalRegistros += (h.puntos || 1);
            });

            // Encabezados de columnas de días (01, 02, ..., 31)
            const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
                const d = (i + 1).toString().padStart(2, '0');
                return `${d}`;
            });

            const matrixHeaders = ['Nombre Gestor / Usuario', ...dayHeaders, 'Días Activos', 'Total Registros'];

            const matrixRows = Array.from(userActivityMap.values())
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map(u => {
                    const rowDays = Array.from({ length: daysInMonth }, (_, i) => {
                        const dayNum = i + 1;
                        return u.diasSet.has(dayNum) ? '✓' : '';
                    });
                    return [
                        u.nombre,
                        ...rowDays,
                        u.diasSet.size,
                        u.totalRegistros
                    ];
                });

            const wsMatriz = buildSheetWithHeader(
                'Matriz de Asistencia Mensual por Días — Gestores PAE',
                `${fechaRef.toLocaleString('es-CO', { month: 'long' })} de ${year}`,
                '✓ = Marca de asistencia registrada por el usuario en esa fecha. Celdas vacías indican días sin registro.',
                matrixHeaders,
                matrixRows
            );

            // Anchos de columnas para la matriz
            wsMatriz['!cols'] = [{ wch: 32 }, ...Array.from({ length: daysInMonth }, () => ({ wch: 5 })), { wch: 14 }, { wch: 16 }];
            XLSX.utils.book_append_sheet(workbook, wsMatriz, 'Matriz Asistencia Mensual');

            // Guardar archivo
            const filename = `Reporte_PAE_Consolidado_${fechaRef.toLocaleString('es-CO', { month: 'short' })}_${year}_${formattedDate}.xlsx`;
            XLSX.writeFile(workbook, filename);

        } catch (err) {
            console.error('Error al exportar ranking a Excel:', err);
            alert('Ocurrió un error al generar el reporte de Excel.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Encabezado */}
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-2">
                        {grupoSeleccionado && (
                            <button onClick={() => setGrupoSeleccionado(null)} className="p-1 -ml-1 hover:bg-white/10 rounded-full transition-colors">
                                <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                        )}
                        <Trophy className="w-6 h-6 text-white" />
                        <h3 className="text-lg font-black text-white leading-tight">
                            {grupoSeleccionado ? `Grupo ${grupoSeleccionado}` : 'Ranking Gestor PAE'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            type="button"
                            onClick={exportToExcel} 
                            disabled={exporting}
                            title="Descargar Reporte Excel Completo"
                            className="p-1.5 rounded-full hover:bg-white/25 text-white transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-90"
                        >
                            <Download className="w-4.5 h-4.5" />
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/25 text-white transition-all active:scale-90">
                            <X className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </div>

                {/* Selector de Pestañas Principales: Grupos | Estrellas PAE */}
                {!grupoSeleccionado && (
                    <div className="px-4 pt-3.5 pb-1 shrink-0 bg-white dark:bg-gray-800">
                        <div className="bg-amber-500/10 dark:bg-amber-500/20 p-1 rounded-2xl flex items-center shrink-0 relative w-full border border-amber-500/20">
                            <button
                                type="button"
                                onClick={() => setTabPrincipal('grupos')}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all relative z-10 ${
                                    tabPrincipal === 'grupos'
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20 active:scale-95'
                                        : 'text-amber-800 dark:text-amber-300 hover:text-amber-950 font-bold'
                                }`}
                            >
                                <Trophy className="w-4 h-4" />
                                Ranking Grupos
                            </button>
                            <button
                                type="button"
                                onClick={() => setTabPrincipal('estrellas')}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all relative z-10 ${
                                    tabPrincipal === 'estrellas'
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20 active:scale-95'
                                        : 'text-amber-800 dark:text-amber-300 hover:text-amber-950 font-bold'
                                }`}
                            >
                                <Star className="w-4 h-4 fill-current" />
                                Estrellas PAE
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-4 overflow-y-auto">
                    {/* Filtros de período */}
                    {!grupoSeleccionado && (
                        <div className="bg-gray-100/80 dark:bg-gray-700/50 p-1 rounded-2xl flex items-center shrink-0 relative w-full mb-4">
                            {(['hoy', 'semana', 'mes'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriodo(p)}
                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${periodo === p ? 'text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                >
                                    {p}
                                </button>
                            ))}
                            {/* Sliding Indicator */}
                            <div
                                className={`absolute inset-y-1 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl shadow-md shadow-orange-500/20 ${
                                    periodo === 'hoy' ? 'left-1 w-[calc(33.33%-4px)]' :
                                    periodo === 'semana' ? 'left-[calc(33.33%+1px)] w-[calc(33.33%-4px)]' :
                                    'left-[calc(66.66%+1px)] w-[calc(33.33%-5px)]'
                                }`}
                            />
                        </div>
                    )}

                    {/* Navegación por fechas */}
                    {!grupoSeleccionado && (periodo === 'semana' || periodo === 'mes') && (
                        <div className="flex justify-center mb-4 transition-all animate-in slide-in-from-top-2">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-0.5 rounded-[2rem] flex items-center shadow-lg shadow-orange-100 border border-orange-500/30">
                                <button
                                    onClick={() => periodo === 'semana' ? handleMoveWeek(-1) : handleMoveMonth(-1)}
                                    className="p-2 hover:bg-white/10 rounded-full text-white transition-colors active:scale-90"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="px-4 text-center min-w-[140px]">
                                    <div className="text-[10px] font-black text-orange-100 uppercase tracking-wider">
                                        Viendo {periodo}
                                    </div>
                                    <div className="text-white font-bold text-sm">
                                        {periodo === 'semana' 
                                            ? getSemanaLabel(fechaRef)
                                            : `${fechaRef.toLocaleString('es-CO', { month: 'long' }).toUpperCase()} DE ${fechaRef.getFullYear()}`
                                        }
                                    </div>
                                </div>
                                <button
                                    onClick={() => periodo === 'semana' ? handleMoveWeek(1) : handleMoveMonth(1)}
                                    className="p-2 hover:bg-white/10 rounded-full text-white transition-colors active:scale-90"
                                >
                                    <ChevronLeft className="w-5 h-5 rotate-180" />
                                </button>
                            </div>
                        </div>
                    )}

                    {!grupoSeleccionado ? (
                        tabPrincipal === 'grupos' ? (
                            loading ? (
                                <p className="text-center text-sm text-gray-500 py-8">Cargando ranking...</p>
                            ) : grupos.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 py-8">Aún no hay puntos registrados para este período.</p>
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
                                                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                                                {g.total_puntos}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )
                        ) : (
                            /* Pestaña Estrellas PAE */
                            loading ? (
                                <p className="text-center text-sm text-gray-500 py-8">Cargando usuarios con estrellas...</p>
                            ) : usuariosEstrellas.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 py-8">Aún no hay usuarios con estrellas en este período.</p>
                            ) : (
                                <div className="space-y-2">
                                    {usuariosEstrellas.map((u, i) => (
                                        <div key={u.usuario_id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Medal className={`w-5 h-5 shrink-0 ${medalColor(i)}`} />
                                                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                                                    {u.avatar_url ? (
                                                        <img src={u.avatar_url} className="w-full h-full object-cover" alt={u.nombre} />
                                                    ) : (
                                                        <span className="text-amber-700 dark:text-amber-400 font-bold text-xs">{u.nombre?.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col text-left">
                                                    <span className="font-bold text-sm text-gray-800 dark:text-gray-100 leading-tight">{u.nombre}</span>
                                                    {u.grupos && u.grupos.length > 0 && (
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-400 font-semibold">
                                                            {u.grupos.join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="flex items-center gap-1 text-amber-500 font-black text-sm shrink-0">
                                                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                                                {u.puntos}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )
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
                                        <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
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
