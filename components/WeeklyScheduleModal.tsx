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
    Clock,
    Info,
    CheckCircle
} from 'lucide-react';
import { generateWeeklySchedulePDF } from '../lib/pdf-generator';

interface WeeklyScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WeeklyScheduleModal({ isOpen, onClose }: WeeklyScheduleModalProps) {
    const [loading, setLoading] = useState(false);
    const [weeklyData, setWeeklyData] = useState<any[]>([]);
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        return new Date(d.setDate(diff));
    });

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
                dates.push(d.toISOString().split('T')[0]);
            }

            // 1. Fetch PAE Schedules
            const { data: schedData } = await supabase
                .from('schedules')
                .select('*')
                .in('date', dates);

            // 2. Fetch Institutional Events
            const { data: eventData } = await supabase
                .from('novedades_institucionales')
                .select('*')
                .in('fecha', dates)
                .order('hora', { ascending: true });

            // Map data to ensure all 5 days are present
            const mapped = dates.map(dateStr => {
                const daySched = schedData?.find(d => d.date === dateStr);
                const dayEvents = eventData?.filter(e => e.fecha === dateStr) || [];
                return {
                    date: dateStr,
                    label: new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }),
                    items: daySched?.items || [],
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

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="bg-white rounded-[2rem] w-full max-w-4xl relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col h-[90vh]">
                {/* Header */}
                <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative shrink-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-2xl">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl tracking-tight">Horario de la Semana</h3>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 mt-1">Consolidado de Novedades</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/20">
                            <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-xs font-black px-4 uppercase tracking-widest min-w-[140px] text-center">
                                {weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - {new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                            </span>
                            <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gray-50/50">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-cyan-600/20 border-t-cyan-600 rounded-full animate-spin" />
                            <p className="font-bold text-gray-500 animate-pulse">Sincronizando agenda...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {weeklyData.map((day, idx) => (
                                <div key={idx} className="flex flex-col gap-3">
                                    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                                        <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">{day.label.split(' ')[0]}</p>
                                        <p className="text-lg font-black text-gray-900">{day.label.split(' ')[1]}</p>
                                    </div>

                                    <div className="flex-1 space-y-4">
                                        {/* PAE Items */}
                                        <div className="space-y-2">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-1">Restaurante PAE</p>
                                            {day.items.length > 0 ? (
                                                day.items.map((item: any, i: number) => {
                                                    const isAbsent = item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE';
                                                    return (
                                                        <div key={i} className={`p-3 rounded-xl border text-[10px] shadow-sm animate-in fade-in slide-in-from-bottom-1 ${isAbsent ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className={`font-black uppercase ${isAbsent ? 'text-red-700' : 'text-gray-900'}`}>{item.group}</span>
                                                                <span className={`px-1.5 py-0.5 rounded-md font-bold ${isAbsent ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {isAbsent ? 'X' : item.time}
                                                                </span>
                                                            </div>
                                                            <p className={`italic font-medium line-clamp-2 ${isAbsent ? 'text-red-600' : 'text-gray-400'}`}>
                                                                {item.notes || 'Normal'}
                                                            </p>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="p-3 rounded-xl border border-dashed border-gray-200 text-center text-gray-300 text-[9px] font-bold">Sin PAE</div>
                                            )}
                                        </div>

                                        {/* Institutional Agenda */}
                                        <div className="space-y-2">
                                            <p className="text-[8px] font-black text-cyan-600 uppercase tracking-widest pl-1 mb-1">Agenda Institucional</p>
                                            {day.instEvents?.length > 0 ? (
                                                day.instEvents.map((event: any, i: number) => (
                                                    <div key={i} className={`p-3 rounded-xl border text-[10px] shadow-sm bg-cyan-50/50 ${event.prioridad === 'alta' ? 'border-red-200 ring-1 ring-red-500/20' : 'border-cyan-100'}`}>
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${event.prioridad === 'alta' ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'}`} />
                                                            <span className="font-black text-cyan-800">{event.titulo}</span>
                                                        </div>
                                                        {event.hora && <p className="text-[9px] font-black text-cyan-600 mb-1">{event.hora}</p>}
                                                        {event.afectados && <p className="text-[9px] text-gray-400 font-bold truncate">{event.afectados}</p>}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-3 rounded-xl border border-dashed border-cyan-100 text-center text-cyan-200 text-[9px] font-bold">Sin eventos</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-white border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <Info className="w-4 h-4" />
                        <p>Los cambios en tiempo real se reflejan automáticamente.</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={loading || weeklyData.length === 0}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-cyan-600 text-white rounded-2xl font-black shadow-xl shadow-cyan-200 hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Download className="w-5 h-5" />
                            Descargar Horario Semanal (PDF)
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 md:flex-none px-6 py-4 bg-gray-100 text-gray-900 rounded-2xl font-black hover:bg-gray-200 transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
