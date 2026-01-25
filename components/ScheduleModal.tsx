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
    const [previewUrl, setPreviewUrl] = useState<URL | string | null>(null);

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

                // Helper: Sort events by time
                const timeToMinutes = (timeStr: string) => {
                    if (!timeStr) return 9999;
                    const clean = timeStr.toLowerCase().trim();
                    let modifier = clean.includes('pm') ? 'pm' : clean.includes('am') ? 'am' : clean.includes('m') ? 'pm' : '';
                    let timePart = clean.replace(/[apm\s\.]/g, ''); // Handled dots too
                    let [hours, minutes] = timePart.split(':').map(Number);

                    if (isNaN(hours)) return 9999;
                    if (isNaN(minutes)) minutes = 0;

                    if (modifier === 'pm' && hours < 12) hours += 12;
                    if (modifier === 'am' && hours === 12) hours = 0;

                    return hours * 60 + minutes;
                };

                // 3. Map everything together and sort by time
                const sortedItems = rawItems.map((i: any) => ({
                    time: i.time || i.time_start,
                    group: i.group,
                    notes: i.notes,
                    studentCount: countsMap[i.group] || 0,
                    sede: sedeMap[i.group] || 'Principal'
                })).sort((a: any, b: any) => timeToMinutes(a.time) - timeToMinutes(b.time));

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

        // Detect mobile (simple width check or user agent) - Mobile browsers don't support iframe PDF preview well
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024; // iPad/Tablets often struggle too with iframes, safer to download directly on smaller screens

        if (isMobile) {
            generateSchedulePDF(filteredSchedule, date, selectedSede, false);
        } else {
            const url = generateSchedulePDF(filteredSchedule, date, selectedSede, true);
            if (url) setPreviewUrl(url);
        }
    };

    const confirmDownload = () => {
        const filteredSchedule = schedule.filter(s => selectedSede === 'Todas' || s.sede === selectedSede);
        generateSchedulePDF(filteredSchedule, date, selectedSede, false); // False triggers save
        setPreviewUrl(null);
    };

    const closePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl as string);
            setPreviewUrl(null);
        }
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
                                <h3 className="font-black text-lg tracking-tight leading-none">
                                    Horario PAE del {date ? new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long' }).charAt(0).toUpperCase() + new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long' }).slice(1) : 'Mañana'}
                                </h3>
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
                                            {filtered.map((item, idx) => {
                                                const hasNotes = !!item.notes;

                                                if (hasNotes) {
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="bg-amber-50/40 border border-amber-100 rounded-[2rem] p-4 flex items-center gap-4 animate-in fade-in duration-300"
                                                        >
                                                            <div className="bg-white border border-amber-200 px-3 py-1.5 rounded-xl shadow-sm shrink-0 flex items-center gap-1.5">
                                                                <Clock className="w-3 h-3 text-amber-500" />
                                                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                                                    {item.time.split(' - ')[0]}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-lg text-gray-900 leading-none tracking-tight">
                                                                        {item.group.replace('-2026', '')}
                                                                    </span>
                                                                    {item.studentCount !== undefined && (
                                                                        <span className="text-[9px] font-black text-amber-700/60 bg-white border border-amber-100 px-1.5 py-0.5 rounded-md">
                                                                            {item.studentCount} Estudiantes
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] font-bold text-amber-600/80 mt-1 italic leading-tight">
                                                                    {item.notes}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-4 p-4 rounded-3xl bg-white border border-gray-100 hover:border-cyan-100 hover:shadow-xl hover:shadow-cyan-600/5 transition-all duration-300 group"
                                                    >
                                                        <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 transition-colors shrink-0 shadow-sm min-w-[85px]">
                                                            <Clock className="w-3.5 h-3.5 text-gray-400 group-hover:text-cyan-600" />
                                                            <span className="text-[10px] font-black text-gray-700 group-hover:text-cyan-900 leading-tight">
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
                                                                        {item.studentCount} Estudiantes
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

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
                                                                <div className="bg-white border border-red-200 px-3 py-1.5 rounded-xl shadow-sm shrink-0 flex items-center gap-1.5">
                                                                    <X className="w-3 h-3 text-red-500" />
                                                                    <span className="text-[10px] font-black text-red-700 uppercase tracking-wider">NO ASISTE</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-black text-lg text-red-900 leading-none">
                                                                            {item.group.replace('-2026', '')}
                                                                        </span>
                                                                        {item.studentCount !== undefined && (
                                                                            <span className="text-[9px] font-black text-red-700/60 bg-white border border-red-100 px-1.5 py-0.5 rounded-md">
                                                                                {item.studentCount} Estudiantes
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {item.notes && (
                                                                        <span className="text-[11px] font-bold text-red-600/70 mt-1 italic leading-tight">
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
            {/* PDF Preview Modal Overlay */}
            {previewUrl && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
                        {/* Preview Header */}
                        <div className="p-4 bg-gray-900 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/10 p-2 rounded-xl">
                                    <FileText className="w-5 h-5 text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">Vista Previa del Documento</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Verificar antes de descargar</p>
                                </div>
                            </div>
                            <button
                                onClick={closePreview}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* PDF Viewer - Iframe */}
                        <div className="flex-1 bg-gray-100 relative">
                            <iframe
                                src={previewUrl as string}
                                className="w-full h-full border-none"
                                title="PDF Preview"
                            />
                        </div>

                        {/* Preview Footer Actions */}
                        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
                            <button
                                onClick={closePreview}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDownload}
                                className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold text-sm hover:bg-cyan-700 shadow-lg shadow-cyan-200 transition-all flex items-center gap-2 active:scale-95"
                            >
                                <Download className="w-4 h-4" />
                                Descargar Archivo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
