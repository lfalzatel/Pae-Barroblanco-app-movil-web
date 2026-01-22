import { useState, useEffect } from 'react';
import { X, Calendar, Download, Clock, Users, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { generateSchedulePDF } from '../lib/pdf-generator';
import { supabase } from '@/lib/supabase';
import { MiniCalendar } from './ui/MiniCalendar';

interface ScheduleItem {
    time: string;
    group: string;
    studentCount?: number;
    notes?: string;
}

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ScheduleModal({ isOpen, onClose }: ScheduleModalProps) {
    const [date, setDate] = useState<string>('');
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Smart Business Day logic:
            // Fri/Sat -> Mon
            // Others -> +1 Day
            const now = new Date();
            const day = now.getDay();

            const target = new Date(now);
            if (day === 5) target.setDate(target.getDate() + 3); // Fri -> Mon
            else if (day === 6) target.setDate(target.getDate() + 2); // Sat -> Mon
            else target.setDate(target.getDate() + 1); // Others -> Tomorrow

            const offset = target.getTimezoneOffset() * 60000;
            setDate(new Date(target.getTime() - offset).toISOString().split('T')[0]);
            setShowCalendar(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (date) {
            fetchSchedule(date);
        }
    }, [date]);

    const fetchSchedule = async (dateStr: string) => {
        setLoading(true);
        try {
            // 1. Fetch Schedule Items
            const { data, error } = await supabase
                .from('schedules')
                .select('items')
                .eq('date', dateStr)
                .single();

            if (data?.items) {
                const rawItems = data.items;
                const uniqueGroupsInSched = Array.from(new Set(rawItems.map((i: any) => i.group)));

                // 2. Fetch Student Counts for these specific groups
                const { data: countsData } = await supabase
                    .from('estudiantes')
                    .select('grupo')
                    .in('grupo', uniqueGroupsInSched);

                const countsMap: Record<string, number> = {};
                countsData?.forEach(s => {
                    countsMap[s.grupo] = (countsMap[s.grupo] || 0) + 1;
                });

                // 3. Map everything together and sort by time
                const sortedItems = rawItems.map((i: any) => ({
                    time: i.time || i.time_start,
                    group: i.group,
                    notes: i.notes,
                    studentCount: countsMap[i.group] || 0
                })).sort((a: any, b: any) => a.time.localeCompare(b.time));

                setSchedule(sortedItems);
            } else {
                setSchedule([]);
            }
        } catch (err) {
            console.error("Error fetching schedule", err);
            setSchedule([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        generateSchedulePDF(schedule, date);
    };

    if (!isOpen) return null;

    const formattedDate = date ? new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 overflow-hidden border border-white/20 ring-1 ring-black/5 flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-100/50 bg-gradient-to-r from-cyan-50 to-white shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-cyan-100 text-cyan-700 p-3 rounded-2xl shadow-sm ring-1 ring-cyan-500/10">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-900 leading-tight text-lg">Horario de mañana</h3>
                                <button
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className="text-xs font-bold text-cyan-600 mt-0.5 capitalize flex items-center gap-1 hover:text-cyan-800 transition-colors bg-cyan-50 px-2 py-1 rounded-lg"
                                >
                                    {formattedDate}
                                    {showCalendar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-black/5 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-900 hover:rotate-90"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Calendar Collapse */}
                    {showCalendar && (
                        <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200 flex justify-center">
                            <MiniCalendar
                                selectedDate={date}
                                onSelectDate={(d) => { setDate(d); setShowCalendar(false); }}
                                className="border border-cyan-100 shadow-lg"
                            />
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/30">
                    {loading ? (
                        <div className="py-20 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                        </div>
                    ) : schedule.length > 0 ? (
                        <>
                            <div className="space-y-3">
                                {schedule.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-100/50 transition-all duration-300 group"
                                    >
                                        <div className="flex flex-col items-center justify-center w-20 bg-gray-50 rounded-xl p-2 border border-gray-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 transition-colors shrink-0">
                                            <Clock className="w-4 h-4 text-gray-400 group-hover:text-cyan-600 mb-1" />
                                            <span className="text-[10px] font-black text-gray-700 group-hover:text-cyan-800 text-center leading-tight">
                                                {item.time.split(' - ')[0]}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-lg text-gray-900 whitespace-nowrap">{item.group}</span>
                                                {item.studentCount !== undefined && (
                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                                        {item.studentCount} est
                                                    </span>
                                                )}
                                            </div>

                                            {item.notes && (
                                                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 w-fit max-w-full overflow-hidden">
                                                    <FileText className="w-3 h-3 shrink-0" />
                                                    <span className="font-medium break-words line-clamp-2 sm:line-clamp-none">{item.notes}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Standard Footer Notes */}
                            <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest">NOTA: ESTAR ATENTOS A LAS NOVEDADES.</p>
                                    <p className="text-[11px] font-black text-cyan-700 uppercase">CONSEJO ACADÉMICO DE DOCENTES</p>
                                </div>

                                <p className="text-[10px] font-bold text-gray-600 uppercase leading-tight">
                                    RECORDEMOS QUE EL HORARIO DE BACHILLERATO DE 7 A.M A 1.00. PM
                                </p>

                                <div className="bg-cyan-50/50 p-3 rounded-2xl border border-cyan-100/50">
                                    <p className="text-[10px] font-black text-cyan-800 uppercase mb-2">RECUERDA</p>
                                    <ul className="space-y-1.5">
                                        <li className="flex items-center gap-2 text-[10px] font-bold text-gray-600 italic">
                                            <div className="w-1 h-1 bg-cyan-400 rounded-full" />
                                            Puntualidad
                                        </li>
                                        <li className="flex items-center gap-2 text-[10px] font-bold text-gray-600 italic">
                                            <div className="w-1 h-1 bg-cyan-400 rounded-full" />
                                            Uso adecuado del uniforme
                                        </li>
                                        <li className="flex items-center gap-2 text-[10px] font-bold text-gray-600 italic">
                                            <div className="w-1 h-1 bg-cyan-400 rounded-full" />
                                            Seguir las recomendaciones escritas en estas novedades
                                        </li>
                                    </ul>
                                </div>

                                <div className="pt-2 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                    <p>Equipo directivo</p>
                                    <p>I.E Barro Blanco</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10 opacity-60">
                            <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No hay horario programado para esta fecha.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex gap-3 shrink-0">
                    <button
                        onClick={handleDownload}
                        disabled={schedule.length === 0}
                        className="flex-1 py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold shadow-lg shadow-cyan-200 hover:shadow-xl hover:shadow-cyan-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        <Download className="w-5 h-5" />
                        Descargar PDF
                    </button>

                    <button
                        onClick={onClose}
                        className="px-6 py-3.5 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl font-bold transition-all duration-200"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
