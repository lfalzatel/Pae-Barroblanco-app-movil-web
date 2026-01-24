import { useState, useEffect } from 'react';
import { X, Calendar, Download, Clock, Users, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { generateSchedulePDF } from '../lib/pdf-generator';
import { supabase } from '@/lib/supabase';
import { MiniCalendar } from './ui/MiniCalendar';

interface ScheduleItem {
    time: string;
    group: string;
    studentCount?: number;
    sede?: string;
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
    const [selectedSede, setSelectedSede] = useState('Principal');

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

                const { data: countsData } = await supabase
                    .from('estudiantes')
                    .select('grupo, sede')
                    .in('grupo', uniqueGroupsInSched);

                const countsMap: Record<string, number> = {};
                const sedeMap: Record<string, string> = {};

                countsData?.forEach(s => {
                    countsMap[s.grupo] = (countsMap[s.grupo] || 0) + 1;
                    if (s.sede) sedeMap[s.grupo] = s.sede;
                });

                // 3. Map everything together and sort by time
                const sortedItems = rawItems.map((i: any) => ({
                    time: i.time || i.time_start,
                    group: i.group,
                    notes: i.notes,
                    studentCount: countsMap[i.group] || 0,
                    sede: sedeMap[i.group] || 'Principal'
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
        const filteredSchedule = schedule.filter(s => selectedSede === 'Todas' || s.sede === selectedSede);
        generateSchedulePDF(filteredSchedule, date, selectedSede);
    };

    if (!isOpen) return null;

    const formattedDate = date ? new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="bg-white rounded-[2rem] w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header - Premium Cyan Style */}
                <div className="p-5 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative shrink-0">
                    {/* Row 1: Title & Close */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl shadow-sm ring-1 ring-white/10">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg tracking-tight leading-none">Horario de mañana</h3>
                                <p className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-80 mt-1">Programa Diario PAE</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-white/10 rounded-full transition-all duration-200 text-white/70 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Row 2: Controls (Date & Sede) - Capsule Style */}
                    <div className="flex gap-2">
                        {/* Date Selector */}
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 px-3 flex items-center justify-center gap-2 font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm group"
                        >
                            <span className="truncate">{formattedDate}</span>
                            {showCalendar ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:translate-y-0.5 transition-transform" />}
                        </button>

                        {/* Sede Selector */}
                        <div className="relative flex-1">
                            <select
                                value={selectedSede}
                                onChange={(e) => setSelectedSede(e.target.value)}
                                className="w-full appearance-none bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 pl-4 pr-10 font-bold transition-all text-[10px] uppercase tracking-widest cursor-pointer focus:outline-none"
                            >
                                <option value="Todas" className="text-gray-900">Todas las sedes</option>
                                <option value="Principal" className="text-gray-900">Sede Principal</option>
                                <option value="Primaria" className="text-gray-900">Sede Primaria</option>
                                <option value="Maria Inmaculada" className="text-gray-900">M. Inmaculada</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-white opacity-60 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    {/* Calendar Collapse */}
                    {showCalendar && (
                        <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200 flex justify-center bg-white p-3 rounded-2xl shadow-xl">
                            <MiniCalendar
                                selectedDate={date}
                                onSelectDate={(d) => { setDate(d); setShowCalendar(false); }}
                                className="border-none p-0"
                            />
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/30">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-600/20 border-t-cyan-600"></div>
                            <p className="font-bold text-xs text-gray-400 animate-pulse">Sincronizando horario...</p>
                        </div>
                    ) : schedule.length > 0 ? (
                        <>
                            <div className="space-y-4">
                                {/* Attending Groups */}
                                {(() => {
                                    const filtered = schedule.filter(s => (selectedSede === 'Todas' || s.sede === selectedSede) && s.time !== 'NO_ASISTE');
                                    const notAttending = schedule.filter(s => (selectedSede === 'Todas' || s.sede === selectedSede) && s.time === 'NO_ASISTE');

                                    return (
                                        <>
                                            {filtered.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-4 p-4 rounded-3xl bg-white border border-gray-100 hover:border-cyan-100 hover:shadow-xl hover:shadow-cyan-600/5 transition-all duration-300 group"
                                                >
                                                    <div className="flex flex-col items-center justify-center w-20 bg-gray-50 rounded-2xl p-2.5 border border-gray-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 transition-colors shrink-0 shadow-sm">
                                                        <Clock className="w-4 h-4 text-gray-400 group-hover:text-cyan-600 mb-1" />
                                                        <span className="text-[10px] font-black text-gray-700 group-hover:text-cyan-900 text-center leading-tight">
                                                            {item.time.split(' - ')[0]}
                                                        </span>
                                                    </div>

                                                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-xl text-gray-900 whitespace-nowrap tracking-tight">
                                                                {item.group.replace('-2026', '')}
                                                            </span>
                                                            {item.studentCount !== undefined && (
                                                                <span className="text-[10px] font-black text-white bg-cyan-600/80 px-2 py-0.5 rounded-lg shadow-sm">
                                                                    {item.studentCount} est
                                                                </span>
                                                            )}
                                                        </div>

                                                        {item.notes && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50/80 px-3 py-1.5 rounded-xl border border-amber-100 w-fit max-w-full overflow-hidden">
                                                                <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                                <span className="font-bold break-words leading-tight">{item.notes}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Not Attending Section */}
                                            {notAttending.length > 0 && (
                                                <div className="mt-8 space-y-3">
                                                    <div className="flex items-center gap-2 px-2">
                                                        <X className="w-4 h-4 text-red-500" />
                                                        <h4 className="text-[11px] font-black text-red-500 uppercase tracking-[0.15em]">Grupos que no asisten</h4>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {notAttending.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="bg-red-50/40 border border-red-100 rounded-[2rem] p-4 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300"
                                                            >
                                                                <div className="bg-red-600 px-3 py-1.5 rounded-xl shadow-md shrink-0">
                                                                    <span className="text-[10px] font-black text-white uppercase tracking-wider">NO ASISTE</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-lg text-red-900 leading-none">
                                                                        {item.group.replace('-2026', '')}
                                                                    </span>
                                                                    {item.notes && (
                                                                        <span className="text-[11px] font-bold text-red-600/70 mt-1 italic">
                                                                            {item.notes}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
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
                                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                            Puntualidad
                                        </li>
                                        <li className="flex items-center gap-2 text-[10px] font-bold text-gray-600 italic">
                                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                            Uso adecuado del uniforme
                                        </li>
                                        <li className="flex items-center gap-2 text-[10px] font-bold text-gray-600 italic">
                                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
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

                {/* Footer Actions */}
                <div className="p-4 md:p-6 bg-gray-50 border-t border-gray-100 shrink-0">
                    <div className="flex gap-3">
                        <button
                            onClick={handleDownload}
                            disabled={schedule.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Download className="w-5 h-5" />
                            <span>Descargar PDF</span>
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
