'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Building2,
    RefreshCw,
    AlertCircle,
    ChevronDown,
    Coffee,
    Utensils,
    Package,
    TrendingUp,
} from 'lucide-react';

const SHEET_ID = '1NIp7IaTps7E-QqkBc5Yt0rx36HGc-k5d4EiKmtOLFeE';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const DIA_KEYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface School {
    nombre: string;
    riAm: number;
    riPm: number;
    cajm: number;
    cajt: number;
    almuerzo: number;
}

interface SheetMeta {
    name: string;
    month: number | null;
    day: number | null;
}

interface ApiResponse {
    sheets: SheetMeta[];
    currentSheet: string;
    schools: School[];
    totals: { riAm: number; riPm: number; cajm: number; cajt: number; almuerzo: number };
}

interface SecretariaDashboardProps {
    usuario: { nombre: string; rol: string; email: string };
}

export default function SecretariaDashboard({ usuario }: SecretariaDashboardProps) {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [selectedSchool, setSelectedSchool] = useState<string>('todos');
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [schoolDropOpen, setSchoolDropOpen] = useState(false);
    const [monthDropOpen, setMonthDropOpen] = useState(false);

    const fetchData = useCallback(async (sheetName?: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = `/api/sheets-data?sheetId=${SHEET_ID}${sheetName ? `&sheetName=${encodeURIComponent(sheetName)}` : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error((await res.json()).error || 'Error al leer datos');
            const json: ApiResponse = await res.json();
            setData(json);

            // Auto-select current month if not yet set
            if (selectedMonth === null && json.sheets.length > 0) {
                const curMonth = new Date().getMonth();
                const hasMonth = json.sheets.some(s => s.month === curMonth);
                setSelectedMonth(hasMonth ? curMonth : (json.sheets[0]?.month ?? null));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => { fetchData(); }, []);

    // When month or day selection changes, find and load matching sheet
    useEffect(() => {
        if (!data) return;
        const match = findMatchingSheet(data.sheets, selectedMonth, selectedDay);
        if (match && match !== data.currentSheet) {
            fetchData(match);
        }
    }, [selectedMonth, selectedDay]);

    function findMatchingSheet(sheets: SheetMeta[], month: number | null, day: number | null): string | null {
        if (month === null && day === null) return null;

        // Try exact match (month AND day)
        if (month !== null && day !== null) {
            const exact = sheets.find(s => s.month === month && s.day === day);
            if (exact) return exact.name;
        }

        // Match only by day (if no month filtering possible)
        if (day !== null && month === null) {
            const byDay = sheets.find(s => s.day === day);
            if (byDay) return byDay.name;
        }

        // Match only by month
        if (month !== null && day === null) {
            const byMonth = sheets.find(s => s.month === month);
            if (byMonth) return byMonth.name;
        }

        return null;
    }

    // Derive available months from sheet list
    const availableMonths = data
        ? [...new Set(data.sheets.map(s => s.month).filter((m): m is number => m !== null))].sort((a, b) => a - b)
        : [];

    // Derive available days for selected month
    const availableDaysForMonth = data && selectedMonth !== null
        ? new Set(data.sheets.filter(s => s.month === selectedMonth).map(s => s.day).filter((d): d is number => d !== null))
        : new Set<number>();

    // Client-side school filter
    const schools = data?.schools ?? [];
    const filteredSchools = selectedSchool === 'todos' ? schools : schools.filter(s => s.nombre === selectedSchool);

    const displayTotals = filteredSchools.reduce(
        (acc, s) => ({
            riAm: acc.riAm + s.riAm,
            riPm: acc.riPm + s.riPm,
            cajm: acc.cajm + s.cajm,
            cajt: acc.cajt + s.cajt,
            almuerzo: acc.almuerzo + s.almuerzo,
        }),
        { riAm: 0, riPm: 0, cajm: 0, cajt: 0, almuerzo: 0 }
    );

    const grandTotal = displayTotals.riAm + displayTotals.riPm + displayTotals.cajm + displayTotals.cajt + displayTotals.almuerzo;

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-28 md:pb-10" onClick={() => { setSchoolDropOpen(false); setMonthDropOpen(false); }}>

            {/* Header */}
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
                            Totales municipales · Todos los colegios
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

            {/* Error */}
            {error && (
                <div className="mb-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 flex items-center gap-3 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* ── TOTAL CARD ── */}
            <div className="mb-5 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 shadow-xl shadow-blue-900/20 text-white">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">Total complementos</p>
                        {loading
                            ? <div className="h-9 w-28 bg-white/20 rounded-xl animate-pulse mt-1" />
                            : <p className="text-4xl font-black tabular-nums">{grandTotal.toLocaleString('es-CO')}</p>
                        }
                    </div>
                    <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-7 h-7 text-white" />
                    </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                    {[
                        { label: 'RI/AM', value: displayTotals.riAm, icon: Coffee },
                        { label: 'RI/PM', value: displayTotals.riPm, icon: Coffee },
                        { label: 'CAJM', value: displayTotals.cajm, icon: Package },
                        { label: 'CAJT', value: displayTotals.cajt, icon: Package },
                        { label: 'Almuerzo', value: displayTotals.almuerzo, icon: Utensils },
                    ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="bg-white/15 backdrop-blur rounded-2xl p-3 text-center">
                            <Icon className="w-4 h-4 mx-auto mb-1 text-blue-200" />
                            <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wider leading-none mb-1">{label}</p>
                            {loading
                                ? <div className="h-5 w-10 bg-white/20 rounded-lg animate-pulse mx-auto" />
                                : <p className="text-lg font-black tabular-nums leading-none">{value.toLocaleString('es-CO')}</p>
                            }
                        </div>
                    ))}
                </div>

                {data?.currentSheet && (
                    <p className="mt-3 text-[10px] text-blue-300 font-medium text-right">
                        Hoja: {data.currentSheet}
                        {selectedSchool !== 'todos' && ` · ${selectedSchool}`}
                    </p>
                )}
            </div>

            {/* ── FILTERS ROW 1: Colegio + Mes ── */}
            <div className="flex gap-3 mb-3">
                {/* Colegio */}
                <div className="relative flex-1" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => { setSchoolDropOpen(p => !p); setMonthDropOpen(false); }}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="truncate">
                                {selectedSchool === 'todos' ? 'Todos los colegios' : selectedSchool}
                            </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${schoolDropOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {schoolDropOpen && (
                        <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-[150] overflow-hidden max-h-60 overflow-y-auto">
                            {[{ nombre: 'todos', label: 'Todos los colegios' }, ...schools.map(s => ({ nombre: s.nombre, label: s.nombre }))].map(opt => (
                                <button
                                    key={opt.nombre}
                                    onClick={() => { setSelectedSchool(opt.nombre); setSchoolDropOpen(false); }}
                                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${selectedSchool === opt.nombre ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mes */}
                <div className="relative flex-1" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => { setMonthDropOpen(p => !p); setSchoolDropOpen(false); }}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                        <span className="truncate">
                            {selectedMonth !== null ? MESES_NOMBRES[selectedMonth] : 'Todos los meses'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${monthDropOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {monthDropOpen && (
                        <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-[150] overflow-hidden">
                            <button
                                onClick={() => { setSelectedMonth(null); setSelectedDay(null); setMonthDropOpen(false); }}
                                className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${selectedMonth === null ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            >
                                Todos los meses
                            </button>
                            {availableMonths.length > 0
                                ? availableMonths.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => { setSelectedMonth(m); setSelectedDay(null); setMonthDropOpen(false); }}
                                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${selectedMonth === m ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    >
                                        {MESES_NOMBRES[m]}
                                    </button>
                                ))
                                : (
                                    <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">
                                        Sin datos de meses disponibles
                                    </p>
                                )
                            }
                        </div>
                    )}
                </div>
            </div>

            {/* ── FILTER ROW 2: Days ── */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setSelectedDay(null)}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${selectedDay === null ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'}`}
                >
                    Todos
                </button>
                {DIAS.map((label, idx) => {
                    const available = availableDaysForMonth.has(idx) || availableDaysForMonth.size === 0;
                    return (
                        <button
                            key={label}
                            onClick={() => setSelectedDay(selectedDay === idx ? null : idx)}
                            disabled={!available && availableDaysForMonth.size > 0}
                            className={`flex-1 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                                selectedDay === idx
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : available
                                    ? 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                                    : 'bg-gray-100 dark:bg-gray-900 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ── SCHOOL BREAKDOWN ── */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    ))}
                </div>
            ) : filteredSchools.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-600">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Sin datos para los filtros seleccionados</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredSchools.map(school => {
                        const total = school.riAm + school.riPm + school.cajm + school.cajt + school.almuerzo;
                        const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
                        return (
                            <div key={school.nombre} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">{school.nombre}</p>
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">{pct}% del total municipal</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{total.toLocaleString('es-CO')}</p>
                                        <p className="text-[10px] text-gray-400 font-medium">complementos</p>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-3 overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>

                                {/* Breakdown chips */}
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { label: 'RI/AM', value: school.riAm, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
                                        { label: 'RI/PM', value: school.riPm, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
                                        { label: 'CAJM', value: school.cajm, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                                        { label: 'CAJT', value: school.cajt, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
                                        { label: 'Alm', value: school.almuerzo, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
                                    ].map(({ label, value, color }) => (
                                        <span key={label} className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-black ${color}`}>
                                            {label}: <span className="tabular-nums">{value.toLocaleString('es-CO')}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
