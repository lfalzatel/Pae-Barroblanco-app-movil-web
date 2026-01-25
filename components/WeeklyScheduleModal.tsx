'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    X,
    Calendar,
    ChevronLeft,
    ChevronRight,
    FileText,
    Download,
    Info,
    CheckCircle,
    School
} from 'lucide-react';
import { generateWeeklySchedulePDF } from '../lib/pdf-generator';

interface WeeklyScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WeeklyScheduleModal({ isOpen, onClose }: WeeklyScheduleModalProps) {
    const [loading, setLoading] = useState(false);
    const [weeklyData, setWeeklyData] = useState<any[]>([]);
    const [selectedDay, setSelectedDay] = useState(0); // 0 = Lun, 4 = Vie
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const now = new Date();
        const bogotaNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));

        const day = bogotaNow.getDay();
        const hour = bogotaNow.getHours();

        const d = new Date(bogotaNow);
        // Smart jump: Friday > 8pm or Sat/Sun -> Jump to next Monday
        if ((day === 5 && hour >= 20) || day === 6 || day === 0) {
            const daysToAdd = day === 5 ? 3 : (day === 6 ? 2 : 1);
            d.setDate(d.getDate() + daysToAdd);
        } else {
            // Normal: Go to current Monday
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            d.setDate(diff);
        }
        d.setHours(12, 0, 0, 0); // Normalize to NOON
        return d;
    });

    // Helper: Format date as YYYY-MM-DD using LOCAL components (no UTC shift)
    const formatLocalDate = (date: Date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Helper: Sort events by time
    const timeToMinutes = (timeStr: string) => {
        if (!timeStr) return 9999;
        const clean = timeStr.toLowerCase().trim();
        let modifier = clean.includes('pm') ? 'pm' : clean.includes('am') ? 'am' : clean.includes('m') ? 'pm' : '';
        let timePart = clean.replace(/[apm\s\.]/g, '');
        let [hours, minutes] = timePart.split(':').map(Number);

        if (isNaN(hours)) return 9999;
        if (isNaN(minutes)) minutes = 0;

        if (modifier === 'pm' && hours < 12) hours += 12;
        if (modifier === 'am' && hours === 12) hours = 0;

        return hours * 60 + minutes;
    };

    useEffect(() => {
        if (isOpen) {
            fetchWeeklySchedule();
        }
    }, [isOpen, weekStart]);

    const fetchWeeklySchedule = async () => {
        setLoading(true);
        try {
            const dates = [];
            for (let i = 0; i < 5; i++) {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                dates.push(formatLocalDate(d));
            }

            // Fetch Institutional Events
            const { data: eventData } = await supabase
                .from('novedades_institucionales')
                .select('*')
                .in('fecha', dates)
                .order('hora', { ascending: true });

            // Map data and sort by time
            const mapped = dates.map(dateStr => {
                const dayEvents = (eventData?.filter(e => e.fecha === dateStr) || [])
                    .sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
                return {
                    date: dateStr,
                    label: new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }),
                    instEvents: dayEvents
                };
            });

            setWeeklyData(mapped);
        } catch (error) {
            console.error('Error fetching weekly schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const changeWeek = (offset: number) => {
        const newDate = new Date(weekStart);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setWeekStart(newDate);
    };

    const handleDownloadPDF = () => {
        generateWeeklySchedulePDF(weeklyData, weekStart);
    };

    if (!isOpen) return null;

    const currentDayData = weeklyData[selectedDay];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="bg-white rounded-[2rem] w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header - More Compact */}
                <div className="p-4 md:p-5 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg tracking-tight leading-none">Horario Institucional</h3>
                                <p className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-80 mt-1">Consolidado Semanal</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between bg-white/10 p-1.5 rounded-2xl border border-white/10">
                        <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] font-black px-2 uppercase tracking-widest text-center">
                            {weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - {new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </span>
                        <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Day Tab Selector - Custom Capsule Style */}
                <div className="p-4 bg-white border-b border-gray-100 shrink-0">
                    <div className="flex p-1.5 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day, idx) => (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(idx)}
                                className={`flex-1 py-2 text-[11px] font-black rounded-full transition-all duration-300 ${selectedDay === idx
                                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content - Focused on Institutional Agenda */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-white">
                    {loading ? (
                        <div className="h-40 flex flex-col items-center justify-center gap-4">
                            <div className="w-8 h-8 border-4 border-cyan-600/20 border-t-cyan-600 rounded-full animate-spin" />
                            <p className="font-bold text-xs text-gray-400 animate-pulse">Sincronizando agenda...</p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                            {currentDayData && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="bg-cyan-50 p-2 rounded-xl">
                                            <School className="w-5 h-5 text-cyan-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest leading-none mb-1">Agenda del día</p>
                                            <p className="text-xl font-black text-gray-900 leading-none">
                                                {currentDayData.label.split(',')[0]}
                                                <span className="text-gray-300 ml-2 font-black">{currentDayData.label.split(',')[1]}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {currentDayData.instEvents?.length > 0 ? (
                                            currentDayData.instEvents.map((event: any, i: number) => (
                                                <div key={i} className={`p-4 rounded-3xl border shadow-sm animate-in fade-in slide-in-from-bottom-2 bg-gradient-to-br from-white to-gray-50/30 ${event.prioridad === 'alta' ? 'border-red-100 ring-1 ring-red-500/10' : 'border-gray-100'}`}>
                                                    <div className="flex items-start justify-between gap-4 mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${event.prioridad === 'alta' ? 'bg-red-500 animate-pulse shadow-sm shadow-red-200' : 'bg-cyan-500 shadow-sm shadow-cyan-200'}`} />
                                                            <span className="font-black text-gray-900 tracking-tight">{event.titulo}</span>
                                                        </div>
                                                        {event.hora && (
                                                            <div className="bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-1.5">
                                                                <FileText className="w-3 h-3 text-gray-400" />
                                                                <span className="text-[9px] font-black text-gray-500 uppercase">{event.hora}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {event.afectados && (
                                                        <div className="pl-4 border-l-2 border-gray-100">
                                                            <p className="text-[10px] text-gray-500 font-bold leading-relaxed">{event.afectados}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                                                    <Info className="w-8 h-8 text-gray-200" />
                                                </div>
                                                <h4 className="font-black text-gray-400 text-lg">Sin novedades</h4>
                                                <p className="text-xs text-gray-300 font-medium mt-1 leading-relaxed">No hay actividades institucionales programadas para este día.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions - Compact */}
                <div className="p-4 md:p-6 bg-gray-50 border-t border-gray-100 shrink-0">
                    <div className="flex gap-3">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={loading || weeklyData.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span>PDF Semanal</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

