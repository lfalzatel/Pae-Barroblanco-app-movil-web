'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Building2,
    RefreshCw,
    AlertCircle,
    ChevronDown,
    Coffee,
    Utensils,
    Package,
    TrendingUp,
    ChevronLeft,
} from 'lucide-react';

const SHEET_ID = '1NIp7IaTps7E-QqkBc5Yt0rx36HGc-k5d4EiKmtOLFeE';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];


interface GroupRow {
    nombre: string;
    riAm: number; riPm: number; cajm: number; cajt: number; almuerzo: number; total: number;
}

interface Sede {
    nombre: string;
    riAm: number; riPm: number; cajm: number; cajt: number; almuerzo: number; total: number;
    grupos: GroupRow[];
}

interface School {
    nombre: string;
    riAm: number; riPm: number; cajm: number; cajt: number; almuerzo: number; total: number;
    grupos: GroupRow[];
    sedes: Sede[];
}

interface SheetMeta { name: string; month: number | null; day: number | null; }

interface ApiResponse {
    sheets: SheetMeta[];
    currentSheet: string;
    schools: School[];
    totals: { riAm: number; riPm: number; cajm: number; cajt: number; almuerzo: number; total: number };
}

interface SecretariaDashboardProps {
    usuario: { nombre: string; rol: string; email: string };
}

// Columnas de complemento en orden
const COLS = [
    { key: 'riAm',    label: 'RI/AM',    color: 'text-amber-700  dark:text-amber-400'  },
    { key: 'riPm',    label: 'RI/PM',    color: 'text-orange-700 dark:text-orange-400' },
    { key: 'cajm',    label: 'CAJM',     color: 'text-blue-700   dark:text-blue-400'   },
    { key: 'cajt',    label: 'CAJT',     color: 'text-indigo-700 dark:text-indigo-400' },
    { key: 'almuerzo',label: 'Almuerzo', color: 'text-emerald-700 dark:text-emerald-400'},
] as const;

type ColKey = typeof COLS[number]['key'];

export default function SecretariaDashboard({ usuario }: SecretariaDashboardProps) {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [schoolDropOpen, setSchoolDropOpen] = useState(false);

    const fetchData = useCallback(async (sheetName?: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = `/api/sheets-data?sheetId=${SHEET_ID}${sheetName ? `&sheetName=${encodeURIComponent(sheetName)}` : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error((await res.json()).error || 'Error al leer datos');
            const json: ApiResponse = await res.json();
            setData(json);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (!data) return;
        const match = selectedDay !== null
            ? (data.sheets.find(s => s.day === selectedDay)?.name ?? null)
            : null;
        if (match && match !== data.currentSheet) fetchData(match);
    }, [selectedDay]);

    const availableDays = data
        ? new Set(data.sheets.map(s => s.day).filter((d): d is number => d !== null))
        : new Set<number>();

    const schools = data?.schools ?? [];

    // The selected school object (for detail view)
    const activeSchool = selectedSchool ? schools.find(s => s.nombre === selectedSchool) ?? null : null;

    // Totals to show in the card
    const cardTotals = activeSchool
        ? { riAm: activeSchool.riAm, riPm: activeSchool.riPm, cajm: activeSchool.cajm, cajt: activeSchool.cajt, almuerzo: activeSchool.almuerzo, total: activeSchool.total }
        : (data?.totals ?? { riAm: 0, riPm: 0, cajm: 0, cajt: 0, almuerzo: 0, total: 0 });

    // Which columns have at least one non-zero value in the groups (for the table)
    const visibleCols: ColKey[] = activeSchool
        ? COLS.filter(c =>
            (activeSchool.sedes ?? []).some(sede => sede.grupos.some(g => g[c.key] > 0))
          ).map(c => c.key)
        : [];

    const closeDropdowns = () => { setSchoolDropOpen(false); };

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-28 md:pb-10" onClick={closeDropdowns}>

            {/* ── HEADER ── */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg dark:bg-blue-900/30 dark:text-blue-300">
                        Municipio de Rionegro
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-lg dark:bg-gray-800 dark:text-gray-400">
                        {usuario.rol === 'secretaria_educacion' ? 'Secretaría de Educación' : 'Operador PAE'}
                    </span>
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tight">
                            Complementos <span className="text-blue-600">PAE</span>
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                            {activeSchool ? activeSchool.nombre : 'Todos los colegios · Rionegro'}
                        </p>
                    </div>
                    <button
                        onClick={e => { e.stopPropagation(); fetchData(data?.currentSheet); }}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* ── ERROR ── */}
            {error && (
                <div className="mb-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 flex items-center gap-3 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* ── TOTAL CARD ── */}
            <div className="mb-5 rounded-3xl bg-gradient-to-br from-cyan-600 to-cyan-700 p-5 shadow-xl shadow-cyan-900/20 text-white">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-cyan-200 text-xs font-bold uppercase tracking-widest">
                            {activeSchool ? 'Total institución' : 'Total municipal'}
                        </p>
                        {loading
                            ? <div className="h-9 w-28 bg-white/20 rounded-xl animate-pulse mt-1" />
                            : <p className="text-4xl font-black tabular-nums">{cardTotals.total.toLocaleString('es-CO')}</p>
                        }
                    </div>
                    <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-7 h-7 text-white" />
                    </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[
                        { label: 'RI/AM',    value: cardTotals.riAm,    Icon: Coffee   },
                        { label: 'RI/PM',    value: cardTotals.riPm,    Icon: Coffee   },
                        { label: 'CAJM',     value: cardTotals.cajm,    Icon: Package  },
                        { label: 'CAJT',     value: cardTotals.cajt,    Icon: Package  },
                        { label: 'Almuerzo', value: cardTotals.almuerzo, Icon: Utensils },
                    ].map(({ label, value, Icon }) => (
                        <div key={label} className="bg-white/15 backdrop-blur rounded-2xl p-3 text-center">
                            <Icon className="w-4 h-4 mx-auto mb-1 text-cyan-200" />
                            <p className="text-[10px] font-bold text-cyan-200 uppercase tracking-wider leading-none mb-1">{label}</p>
                            {loading
                                ? <div className="h-5 w-10 bg-white/20 rounded-lg animate-pulse mx-auto" />
                                : <p className="text-lg font-black tabular-nums leading-none">{value.toLocaleString('es-CO')}</p>
                            }
                        </div>
                    ))}
                </div>

                {data?.currentSheet && (
                    <p className="mt-3 text-[10px] text-cyan-300 font-medium text-right">
                        Hoja: {data.currentSheet}
                    </p>
                )}
            </div>

            {/* ── FILTRO: Colegio ── */}
            <div className="relative mb-3" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => setSchoolDropOpen(p => !p)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm font-bold text-gray-700 dark:text-gray-200 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 text-cyan-500 shrink-0" />
                        <span className="truncate text-xs uppercase tracking-wider">
                            {selectedSchool ?? 'Todos los colegios'}
                        </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-300 ${schoolDropOpen ? 'rotate-180' : ''}`} />
                </button>

                {schoolDropOpen && (
                    <>
                        <div className="fixed inset-0 z-[140]" onClick={() => setSchoolDropOpen(false)} />
                        <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl z-[150] overflow-hidden max-h-72 overflow-y-auto animate-in zoom-in-95 duration-200">
                            <div className="p-1.5 space-y-0.5">
                                <button
                                    onClick={() => { setSelectedSchool(null); setSchoolDropOpen(false); }}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between ${selectedSchool === null ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                >
                                    Todos los colegios
                                    {selectedSchool === null && <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full shrink-0" />}
                                </button>
                                {schools.map(s => (
                                    <button
                                        key={s.nombre}
                                        onClick={() => { setSelectedSchool(s.nombre); setSchoolDropOpen(false); }}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between gap-2 ${selectedSchool === s.nombre ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                    >
                                        <span className="truncate">{s.nombre}</span>
                                        {selectedSchool === s.nombre && <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── FILTRO: Días (cápsula estilo campana) ── */}
            <div className="mb-6">
                <div className="flex p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-full border border-gray-200/50 dark:border-gray-700/50 shadow-inner">
                    <button
                        onClick={() => setSelectedDay(null)}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-full transition-all duration-300 ${selectedDay === null ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        Todos
                    </button>
                    {DIAS.map((label, idx) => {
                        const available = availableDays.size === 0 || availableDays.has(idx);
                        return (
                            <button
                                key={label}
                                onClick={() => setSelectedDay(selectedDay === idx ? null : idx)}
                                disabled={!available && availableDays.size > 0}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-full transition-all duration-300 ${
                                    selectedDay === idx
                                        ? 'bg-cyan-600 text-white shadow-md'
                                        : available
                                        ? 'text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                        : 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── CONTENT ── */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
                </div>
            ) : activeSchool ? (
                /* ── DETAIL VIEW: groups table ── */
                <div>
                    <button
                        onClick={() => setSelectedSchool(null)}
                        className="flex items-center gap-1.5 text-sm font-bold text-cyan-600 dark:text-cyan-400 mb-4 hover:underline"
                    >
                        <ChevronLeft className="w-4 h-4" /> Todos los colegios
                    </button>

                    {activeSchool.grupos.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">No hay grupos con datos para esta institución</p>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                            <th className="text-left px-4 py-3 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grupo</th>
                                            {visibleCols.map(key => {
                                                const col = COLS.find(c => c.key === key)!;
                                                return (
                                                    <th key={key} className={`text-right px-4 py-3 text-xs font-black uppercase tracking-wider ${col.color}`}>
                                                        {col.label}
                                                    </th>
                                                );
                                            })}
                                            <th className="text-right px-4 py-3 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(activeSchool.sedes ?? []).map((sede, sedeIdx) => {
                                            const multiSede = activeSchool.sedes.length > 1;
                                            return (
                                                <React.Fragment key={sedeIdx}>
                                                    {/* Encabezado de sede — solo cuando hay más de una */}
                                                    {multiSede && (
                                                        <tr className="bg-slate-100 dark:bg-slate-800/60">
                                                            <td colSpan={visibleCols.length + 2}
                                                                className="px-4 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                                {sede.nombre || 'SEDE PRINCIPAL'}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {/* Filas de grupos */}
                                                    {sede.grupos.map((grupo, i) => (
                                                        <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                            <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200 text-xs">{grupo.nombre}</td>
                                                            {visibleCols.map(key => (
                                                                <td key={key} className="px-4 py-3 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300 text-xs">
                                                                    {grupo[key] > 0 ? grupo[key].toLocaleString('es-CO') : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                                </td>
                                                            ))}
                                                            <td className="px-4 py-3 text-right tabular-nums font-black text-gray-900 dark:text-white text-xs">
                                                                {grupo.total.toLocaleString('es-CO')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Sub-total por sede */}
                                                    {multiSede && (
                                                        <tr className="bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700">
                                                            <td className="px-4 py-2.5 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                                                Subtotal {sede.nombre || 'Sede'}
                                                            </td>
                                                            {visibleCols.map(key => (
                                                                <td key={key} className="px-4 py-2.5 text-right tabular-nums text-[10px] font-black text-slate-600 dark:text-slate-300">
                                                                    {sede[key] > 0 ? sede[key].toLocaleString('es-CO') : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                                </td>
                                                            ))}
                                                            <td className="px-4 py-2.5 text-right tabular-nums text-[10px] font-black text-slate-600 dark:text-slate-300">
                                                                {sede.total.toLocaleString('es-CO')}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-100 dark:border-blue-900">
                                            <td className="px-4 py-3 text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider">Total</td>
                                            {visibleCols.map(key => (
                                                <td key={key} className="px-4 py-3 text-right tabular-nums text-xs font-black text-blue-700 dark:text-blue-300">
                                                    {activeSchool[key].toLocaleString('es-CO')}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-right tabular-nums text-xs font-black text-blue-700 dark:text-blue-300">
                                                {activeSchool.total.toLocaleString('es-CO')}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* ── LIST VIEW: school cards ── */
                schools.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 dark:text-gray-600">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Sin datos para los filtros seleccionados</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {schools.map(school => {
                            const grandTotal = data?.totals.total ?? 1;
                            const pct = grandTotal > 0 ? Math.round((school.total / grandTotal) * 100) : 0;
                            return (
                                <button
                                    key={school.nombre}
                                    onClick={() => setSelectedSchool(school.nombre)}
                                    className="w-full text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all active:scale-[0.99]"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{school.nombre}</p>
                                        <div className="shrink-0 text-right">
                                            <p className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums leading-none">{school.total.toLocaleString('es-CO')}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">{pct}% del total</p>
                                        </div>
                                    </div>

                                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-3 overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {COLS.filter(c => school[c.key] > 0).map(c => (
                                            <span key={c.key} className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-gray-100 dark:bg-gray-700 text-[10px] font-black text-gray-600 dark:text-gray-300">
                                                {c.label}: <span className="tabular-nums">{school[c.key].toLocaleString('es-CO')}</span>
                                            </span>
                                        ))}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}
