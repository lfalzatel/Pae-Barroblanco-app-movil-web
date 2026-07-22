'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    X,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    FileText,
    Download,
    Info,
    CheckCircle,
    School
} from 'lucide-react';
import { generateWeeklySchedulePDF } from '../lib/pdf-generator';
import { useModalBack } from '@/hooks/useModalBack';
import html2canvas from 'html2canvas';

interface WeeklyScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WeeklyScheduleModal({ isOpen, onClose }: WeeklyScheduleModalProps) {
    const [loading, setLoading] = useState(false);
    const [weeklyData, setWeeklyData] = useState<any[]>([]);
    const [selectedDay, setSelectedDay] = useState(0);
    const [weekStart, setWeekStart] = useState<Date>(new Date());
    const [previewUrl, setPreviewUrl] = useState<URL | string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [jpgPreviewUrl, setJpgPreviewUrl] = useState<string | null>(null);

    useModalBack(isOpen, onClose, 'weekly-schedule-modal');

    // Smart Date Logic: Runs every time modal opens
    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const bogota = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
            const day = bogota.getDay(); // 0=Sun, 1=Mon... 6=Sat
            const hour = bogota.getHours();

            // Logic for Selected Day (Tab 0-4)
            let newSelectedDay = 0;

            if (day >= 1 && day <= 4) {
                // Mon-Thu: If > 6pm, show Next Day
                if (hour >= 18) {
                    newSelectedDay = day; // (day-1) + 1 = day. e.g. Mon(1) -> Tue(1 index)
                } else {
                    newSelectedDay = day - 1; // Current day index
                }
            } else if (day === 5) {
                // Fri: If > 6pm, show Mon (0) next week
                if (hour >= 18) {
                    newSelectedDay = 0;
                } else {
                    newSelectedDay = 4; // Fri index
                }
            } else {
                // Weekend -> Show Mon (0)
                newSelectedDay = 0;
            }
            setSelectedDay(newSelectedDay);

            // Logic for Week Start Date
            const d = new Date(bogota);
            // If Fri > 18h or Weekend -> Jump to next Monday
            if ((day === 5 && hour >= 18) || day === 6 || day === 0) {
                const daysToAdd = day === 5 ? 3 : (day === 6 ? 2 : 1);
                d.setDate(d.getDate() + daysToAdd);
            } else {
                // Current Week Monday
                // If Mon-Thu > 18h, we stay in current week but show next day tab.
                // Correct logic to find Monday of CURRENT view:
                // Mon(1) -> -0 days
                // Tue(2) -> -1 days
                // ...
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                d.setDate(diff);
            }
            d.setHours(12, 0, 0, 0); // Normalize
            setWeekStart(d);
        }
    }, [isOpen]);

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
        let ignore = false;

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

                if (ignore) return;

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
                if (!ignore) {
                    setLoading(false);
                }
            }
        };

        if (isOpen) {
            fetchWeeklySchedule();
        }

        return () => {
            ignore = true;
        };
    }, [isOpen, weekStart]);

    const changeWeek = (offset: number) => {
        const newDate = new Date(weekStart);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setWeekStart(newDate);
    };

    const handleDownloadPDF = () => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

        if (isMobile) {
            generateWeeklySchedulePDF(weeklyData, weekStart, false);
        } else {
            const url = generateWeeklySchedulePDF(weeklyData, weekStart, true);
            if (url) setPreviewUrl(url);
        }
    };

    const handleJpgExport = async () => {
        const weekRange = `${weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

        let daysHtml = '';
        weeklyData.forEach(day => {
            daysHtml += `<div style="background:#f5f5f5;padding:6px;font-weight:bold;color:#164e63;font-size:12px;margin-top:10px;">${day.label.toUpperCase()}</div>`;
            
            if (day.instEvents && day.instEvents.length > 0) {
                let rows = '';
                day.instEvents.forEach((e: any) => {
                    const detalles = `${e.afectados || ''} ${e.descripcion ? `(${e.descripcion})` : ''}`.trim() || '-';
                    rows += `<tr>
                        <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;text-align:center;width:60px;">${e.hora || 'S/H'}</td>
                        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;font-weight:bold;text-align:center;">${e.titulo}</td>
                        <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;text-align:left;">${detalles}</td>
                    </tr>`;
                });
                daysHtml += `
                    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
                        <thead>
                            <tr style="background:#06b6d4;color:#fff;">
                                <th style="padding:4px 10px;border:1px solid #ddd;font-size:11px;">Hora</th>
                                <th style="padding:4px 10px;border:1px solid #ddd;font-size:11px;">Actividad</th>
                                <th style="padding:4px 10px;border:1px solid #ddd;font-size:11px;">Dirigido a / Detalles</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                `;
            } else {
                daysHtml += `<p style="font-size:11px;color:#666;font-style:italic;margin:6px 10px;">Sin actividades registradas para este día.</p>`;
            }
        });

        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px;background:#fff;padding:40px;font-family:helvetica,arial,sans-serif;color:#000;';
        el.innerHTML = `
            <div style="text-align:center;margin-bottom:20px;">
                <h1 style="font-size:20px;color:#164e63;margin:0 0 6px;">Institución Educativa Barroblanco</h1>
                <h2 style="font-size:14px;color:#475569;margin:0 0 4px;font-weight:600;">Consolidado Semanal - Agenda Institucional</h2>
                <p style="font-size:12px;color:#666;margin:0;">Semana: ${weekRange}</p>
            </div>
            ${daysHtml}
            <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:10px;">
                <p style="font-size:11px;font-weight:bold;margin:0 0 4px;">RECUERDA: Puntualidad y uso adecuado del uniforme.</p>
                <p style="font-size:11px;margin:0;">Equipo directivo - I.E Barro Blanco</p>
            </div>
        `;
        document.body.appendChild(el);

        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const canvas = await html2canvas(el, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                width: el.offsetWidth,
            });

            setJpgPreviewUrl(canvas.toDataURL('image/jpeg', 0.96));
            setShowExportMenu(false);
        } catch (error) {
            console.error('Error generating JPG:', error);
        } finally {
            document.body.removeChild(el);
        }
    };

    const handleJpgDownload = () => {
        if (!jpgPreviewUrl) return;
        const weekRange = `${weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}-${new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
        const link = document.createElement('a');
        link.href = jpgPreviewUrl;
        link.download = `Horario-Semanal-${weekRange.replace(/ /g, '')}.jpg`;
        link.click();
        setJpgPreviewUrl(null);
    };

    const handleJpgShare = async () => {
        if (!jpgPreviewUrl) return;
        try {
            const res = await fetch(jpgPreviewUrl);
            const blob = await res.blob();
            const weekRange = `${weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}-${new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
            const file = new File([blob], `Horario-Semanal-${weekRange.replace(/ /g, '')}.jpg`, { type: 'image/jpeg' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Horario Semanal - I.E. Barroblanco',
                    text: `Consolidado semanal de la agenda institucional`,
                    files: [file],
                });
            } else {
                handleJpgDownload();
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('Error al compartir JPG:', err);
                handleJpgDownload();
            }
        }
    };

    const confirmDownload = () => {
        generateWeeklySchedulePDF(weeklyData, weekStart, false);
        setPreviewUrl(null);
    };

    const closePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl as string);
            setPreviewUrl(null);
        }
    };

    if (!isOpen) return null;

    const currentDayData = weeklyData[selectedDay];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
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
                <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-white/5 shrink-0">
                    <div className="flex p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-full border border-gray-100 dark:border-white/5 shadow-sm">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day, idx) => (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(idx)}
                                className={`flex-1 py-2 text-[11px] font-black rounded-full transition-all duration-300 ${selectedDay === idx
                                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200 dark:shadow-none'
                                    : 'text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content - Focused on Institutional Agenda */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-white dark:bg-gray-900">
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
                                        <div className="bg-cyan-50 dark:bg-cyan-900/20 p-2 rounded-xl">
                                            <School className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest leading-none mb-1">Agenda del día</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white leading-none">
                                                {currentDayData.label.split(',')[0]}
                                                <span className="text-gray-300 dark:text-gray-600 ml-2 font-black">{currentDayData.label.split(',')[1]}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {currentDayData.instEvents?.length > 0 ? (
                                            currentDayData.instEvents.map((event: any, i: number) => (
                                                <div key={i} className="bg-cyan-50/50 dark:bg-cyan-900/10 p-4 rounded-2xl border border-cyan-100 dark:border-cyan-800/30 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                                    <div className="bg-cyan-600 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 min-w-[3.5rem] text-center">{event.hora || 'Todo el día'}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-sm text-cyan-900 dark:text-cyan-200 mb-0.5">{event.titulo}</p>
                                                        <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">{event.afectados}</p>
                                                        {event.descripcion && <p className="text-[10px] text-cyan-700/80 dark:text-cyan-300/70 mt-1 leading-relaxed">{event.descripcion}</p>}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                                                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-700">
                                                    <Info className="w-8 h-8 text-gray-200 dark:text-gray-600" />
                                                </div>
                                                <h4 className="font-black text-gray-400 dark:text-gray-500 text-lg">Sin novedades</h4>
                                                <p className="text-xs text-gray-300 dark:text-gray-600 font-medium mt-1 leading-relaxed">No hay actividades institucionales programadas para este día.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions - Compact */}
                <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                disabled={loading || weeklyData.length === 0}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                <span>Descargar</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showExportMenu && (
                                <>
                                    <div className="fixed inset-0 z-[80]" onClick={() => setShowExportMenu(false)}></div>
                                    <div className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-gray-700 rounded-2xl shadow-lg overflow-hidden z-[90] animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-600">
                                        <button
                                            onClick={() => { handleDownloadPDF(); setShowExportMenu(false); }}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-600 flex items-center gap-2"
                                        >
                                            <Download className="w-4 h-4 text-cyan-600" />
                                            Descargar en PDF
                                        </button>
                                        <button
                                            onClick={handleJpgExport}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2"
                                        >
                                            <FileText className="w-4 h-4 text-amber-600" />
                                            Descargar en JPG
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-2xl font-black text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-sm active:scale-95 min-h-[44px]"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
            {/* PDF Preview Modal Overlay */}
            {previewUrl && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
                        {/* Preview Header */}
                        <div className="p-4 bg-gray-900 dark:bg-black text-white flex items-center justify-between shrink-0">
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
                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 relative">
                            <iframe
                                src={previewUrl as string}
                                className="w-full h-full border-none"
                                title="PDF Preview"
                            />
                        </div>

                        {/* Preview Footer Actions */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={closePreview}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
            {/* JPG Preview Modal Overlay */}
            {jpgPreviewUrl && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-sm flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
                        {/* Preview Header */}
                        <div className="p-4 bg-gray-900 dark:bg-black text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/10 p-2 rounded-xl">
                                    <FileText className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">Vista Previa</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Horario en imagen JPG</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setJpgPreviewUrl(null)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Image Viewer */}
                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 relative overflow-hidden flex items-center justify-center p-4">
                            <div className="w-full h-full max-h-[50vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner bg-white dark:bg-gray-900 p-2 custom-scrollbar">
                                <img
                                    src={jpgPreviewUrl}
                                    alt="Vista previa horario JPG"
                                    className="w-full h-auto object-contain"
                                />
                            </div>
                        </div>

                        {/* Preview Footer Actions */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={handleJpgShare}
                                className="px-5 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 font-bold text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            >
                                Compartir
                            </button>
                            <button
                                onClick={handleJpgDownload}
                                className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all flex items-center gap-2 active:scale-95"
                            >
                                <Download className="w-4 h-4" />
                                Descargar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

