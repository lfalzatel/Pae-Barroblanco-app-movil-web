import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Bell, School, Info, CheckCircle, Search, Filter, AlertTriangle, ArrowDown, ChevronLeft, ChevronRight, Clock, Megaphone, Users, Calendar, Utensils } from 'lucide-react';
// import { useModalBack } from '@/hooks/useModalBack';

interface GlobalNotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    usuario: any;
}

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function GlobalNotificationsModal({ isOpen, onClose, usuario }: GlobalNotificationsModalProps) {
    // useModalBack(isOpen, onClose, 'global-notif-modal');

    // Date State
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();

        // Rule: Friday (5) >= 6PM, or Saturday (6) or Sunday (0) -> Next Week Monday
        if ((day === 5 && hour >= 18) || day === 6 || day === 0) {
            const daysToAdd = day === 5 ? 3 : (day === 6 ? 2 : 1);
            now.setDate(now.getDate() + daysToAdd);
        }

        return formatLocalDate(now);
    });

    const [selectedDayOffset, setSelectedDayOffset] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const hour = d.getHours();

        // Rule: Friday (5) >= 6PM, or Saturday (6) or Sunday (0) -> Default to Monday (1)
        if ((day === 5 && hour >= 18) || day === 6 || day === 0) {
            return 1;
        }
        return day;
    });

    const [novedades, setNovedades] = useState<any[]>([]);
    const [projectionData, setProjectionData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial reset when opening
    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const day = now.getDay();
            const hour = now.getHours();

            let targetDate = new Date(now);
            let targetOffset = day;

            if ((day === 5 && hour >= 18) || day === 6 || day === 0) {
                const daysToAdd = day === 5 ? 3 : (day === 6 ? 2 : 1);
                targetDate.setDate(targetDate.getDate() + daysToAdd);
                targetOffset = 1;
            }

            setSelectedDate(formatLocalDate(targetDate));
            setSelectedDayOffset(targetOffset);
        }
    }, [isOpen]);

    // Data fetching when date changes
    useEffect(() => {
        if (isOpen && selectedDate) {
            fetchData();
        }
    }, [isOpen, selectedDate]);

    // Helper: Week Label
    const getWeekRangeLabel = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const mon = new Date(new Date(d).setDate(diff));
        const sun = new Date(new Date(mon).setDate(mon.getDate() + 6));
        const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        return `${mon.toLocaleDateString('es-CO', opts)} - ${sun.toLocaleDateString('es-CO', opts)}`.toUpperCase().replace(/\./g, '');
    };

    // Helper: Move Week
    const handleMoveWeek = (offset: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + (offset * 7));
        const newDate = formatLocalDate(d);
        setSelectedDate(newDate);
    };

    // Helper: Ration Logic (Copied from ReportesPage)
    const getRationDistribution = (item: any) => {
        const gradoNorm = (item.grado || '').toLowerCase().trim();
        const grupoNorm = (item.grupo || '').toLowerCase().trim();
        const sedeNorm = (item.sede || '').toLowerCase().trim();

        const isGradoPrimaria = ['1', '2', '3', '4', '5', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'aceleracion', 'brujula'].some(g => gradoNorm.includes(g) && !gradoNorm.includes('11') && !gradoNorm.includes('10'));
        const isSedePrimaria = sedeNorm.includes('primaria');
        const isSedeMariaInmaculada = sedeNorm.includes('maria') || sedeNorm.includes('inmaculada');
        const isPrimaria = isGradoPrimaria || isSedePrimaria || isSedeMariaInmaculada;
        const isSordos = gradoNorm.includes('sordos') || grupoNorm.includes('sordos') || grupoNorm.includes('1104');
        const isPreescolar = gradoNorm.includes('preescolar') || gradoNorm.includes('transicion') || gradoNorm === '0' || grupoNorm.includes('preescolar') || grupoNorm.includes('transicion');
        const recibeAlmuerzo = (isPrimaria || isSordos) && (!isPreescolar || isSedeMariaInmaculada);
        const isTarde = grupoNorm.includes('pm') || grupoNorm.includes('tarde');

        return {
            ri_am: !isTarde ? item.total_activos : 0,
            ri_pm: isTarde ? item.total_activos : 0,
            almuerzo: recibeAlmuerzo ? item.total_activos : 0
        };
    };

    const fetchData = async () => {
        try {
            setLoading(true);

            // Parallel Fetch: Projection Stats + Novedades
            const [statsRes, novedadesRes] = await Promise.all([
                supabase.rpc('get_daily_projection_stats', { p_date: selectedDate }),
                supabase
                    .from('novedades_cupos')
                    .select(`
                        *,
                        reportero:perfiles_publicos(nombre)
                    `)
                    .eq('fecha_novedad', selectedDate)
                    .order('created_at', { ascending: false })
            ]);

            if (statsRes.error) throw statsRes.error;
            if (novedadesRes.error) throw novedadesRes.error;

            setProjectionData(statsRes.data || []);
            setNovedades(novedadesRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculation Logic
    const calculateTotals = () => {
        const safeNum = (val: any) => Number(val) || 0;

        // 1. Base Totals (Active Students - Horario Absences)
        const rowsWithoutAbsence = (projectionData || []).filter(r => !r.novedad_horario);

        const baseCAJM = rowsWithoutAbsence.reduce((acc, curr) => {
            const dist = getRationDistribution(curr);
            return acc + safeNum(dist.ri_am) + safeNum(dist.ri_pm);
        }, 0);

        const baseLunch = rowsWithoutAbsence.reduce((acc, curr) => {
            const dist = getRationDistribution(curr);
            return acc + safeNum(dist.almuerzo);
        }, 0);

        // 2. Manual Adjustments (Novedades)
        const totalAdj = (novedades || []).reduce((acc, curr) => {
            const val = safeNum(curr.cupos_afectados);
            if (['reduccion_cupos', 'no_asiste_grupo'].includes(curr.tipo)) return acc - Math.abs(val);
            if (['aumento_cupos'].includes(curr.tipo)) return acc + Math.abs(val);
            return acc;
        }, 0);

        // 3. Final Calculation
        const finalCAJM = Math.max(0, baseCAJM + totalAdj);
        const finalLunch = baseLunch;
        const finalTotal = finalCAJM + finalLunch;

        return {
            baseEnrollment: (projectionData || []).reduce((acc, curr) => acc + (safeNum(curr.total_estudiantes) - safeNum(curr.total_inactivos)), 0),
            absenceHorario: (projectionData || []).filter(r => r.novedad_horario).reduce((acc, curr) => acc + safeNum(curr.total_activos), 0),
            totalAdj,
            finalTotal,
            finalCAJM,
            finalLunch,
            baseCAJM
        };
    };

    const stats = calculateTotals();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header - Rionegro Style */}
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-5 shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3 text-white">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                                <Bell className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-1">Novedades y Cupos</h3>
                                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">
                                    Control Diario
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-95"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Week Selector inside Header */}
                    <div className="mt-6 bg-white/10 rounded-xl p-1 flex items-center justify-between border border-white/10">
                        <button
                            onClick={() => handleMoveWeek(-1)}
                            className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-white font-bold text-xs uppercase tracking-widest">
                            {getWeekRangeLabel(selectedDate)}
                        </span>
                        <button
                            onClick={() => handleMoveWeek(1)}
                            className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Day Tabs */}
                <div className="bg-gray-50 dark:bg-gray-800 p-2 shrink-0 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between bg-white dark:bg-gray-700/50 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
                        {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'].map((day, index) => {
                            const offset = index + 1;
                            const isSelected = selectedDayOffset === offset;
                            return (
                                <button
                                    key={day}
                                    onClick={() => {
                                        const d = new Date(selectedDate + 'T12:00:00');
                                        const currentDay = d.getDay();
                                        const diffToMon = d.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
                                        const monDate = new Date(d);
                                        monDate.setDate(diffToMon);
                                        const targetDate = new Date(monDate);
                                        targetDate.setDate(monDate.getDate() + (offset - 1));

                                        setSelectedDate(formatLocalDate(targetDate));
                                        setSelectedDayOffset(offset);
                                    }}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${isSelected
                                        ? 'bg-cyan-600 text-white shadow-md'
                                        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-gray-400'
                                        }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 custom-scrollbar">

                    {/* PROJECTION SUMMARY CARD - REDESIGNED */}
                    {!loading && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 dark:bg-cyan-900/20 rounded-bl-[100%] -mr-10 -mt-10 z-0"></div>

                            <div className="flex justify-between items-center mb-4 relative z-10">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resumen de Proyección</h4>
                                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${stats.totalAdj < 0 ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-800'}`}>
                                    Ajuste: {stats.totalAdj > 0 ? '+' : ''}{stats.totalAdj}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                {/* CAJM */}
                                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-blue-100 dark:bg-blue-800/50 rounded-lg text-blue-600 dark:text-blue-400">
                                            <Utensils className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">CAJM</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
                                            {stats.finalCAJM}
                                        </span>
                                        <span className="text-[10px] font-medium text-blue-400">raciones</span>
                                    </div>
                                    <div className="mt-1 text-[9px] text-blue-400 dark:text-blue-500 font-medium truncate">
                                        Base: {stats.baseCAJM} {stats.totalAdj !== 0 ? `(${stats.totalAdj > 0 ? '+' : ''}${stats.totalAdj})` : ''}
                                    </div>
                                </div>

                                {/* ALMUERZOS */}
                                <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 border border-orange-100 dark:border-orange-800/30">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-orange-100 dark:bg-orange-800/50 rounded-lg text-orange-600 dark:text-orange-400">
                                            <Utensils className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">Almuerzos</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-orange-700 dark:text-orange-300">
                                            {stats.finalLunch}
                                        </span>
                                        <span className="text-[10px] font-medium text-orange-400">raciones</span>
                                    </div>
                                    <div className="mt-1 text-[9px] text-orange-400 dark:text-orange-500 font-medium truncate">
                                        Sin afectación
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Total A Preparar</span>
                                <span className="text-sm font-black text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg">
                                    {stats.finalTotal}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50 dark:border-gray-700/50">
                                <Utensils className="w-3 h-3 text-gray-400" />
                                <span className="text-[9px] font-bold text-gray-400">
                                    CAJM: {stats.finalCAJM} • ALM: {stats.finalLunch}
                                </span>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <span className="text-xs font-bold uppercase tracking-widest">Calculando diario...</span>
                        </div>
                    ) : novedades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center border-t border-dashed border-gray-100 dark:border-gray-700 pt-8">
                            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                <Info className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white text-xs mb-1">Sin Novedades Extra</h4>
                            <p className="text-[10px] text-gray-400 max-w-xs leading-relaxed">
                                No hay ajustes manuales para esta fecha.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {novedades.map((n) => {
                                const isReduction = n.tipo === 'reduccion_cupos' || n.tipo === 'no_asiste_grupo';
                                const displayValue = Math.abs(n.cupos_afectados);
                                const finalDisplay = isReduction ? -displayValue : displayValue;

                                return (
                                    <div key={n.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-2">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-black text-gray-900 dark:text-white text-xs uppercase tracking-tight">
                                                    {n.tipo.replace(/_/g, ' ')}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700/50 dark:text-gray-400 px-1 py-0.5 rounded">
                                                        {n.sede}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400">•</span>
                                                    <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400">
                                                        {n.grupo || 'Toda la sede'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={`px-2 py-0.5 rounded-lg text-xs font-black flex items-center gap-1 shadow-sm ${finalDisplay < 0
                                                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                                : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                                }`}>
                                                {finalDisplay > 0 ? '+' : ''}{finalDisplay}
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg border border-gray-100 dark:border-gray-700/50 italic">
                                            "{n.razon}"
                                        </p>

                                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-50 dark:border-gray-700">
                                            <span className={`text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded ${n.estado === 'pendiente' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                                                }`}>
                                                {n.estado}
                                            </span>
                                            <span className="text-[8px] text-gray-400 truncate max-w-[100px]">
                                                {n.reportero?.nombre || 'Admin'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors active:scale-[0.98]"
                    >
                        Cerrar Panel
                    </button>
                </div>
            </div>
        </div>
    );
}
