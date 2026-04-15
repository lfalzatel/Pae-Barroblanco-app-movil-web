import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Download, Clock, Users, FileText, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { generateSchedulePDF } from '../lib/pdf-generator';
import { supabase } from '@/lib/supabase';
import { getAcademicBlock } from '@/lib/schedule-utils';
import { MiniCalendar } from './ui/MiniCalendar';
import { useModalBack } from '@/hooks/useModalBack';
import { AlertTriangle } from 'lucide-react';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface ScheduleItem {
    time: string;
    group: string;
    studentCount?: number;
    sede?: string;
    notes?: string;
    conflict?: {
        block: number;
        lastWeekTime: string;
    } | null;
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
    const [showSedeDropdown, setShowSedeDropdown] = useState(false);
    const [selectedSede, setSelectedSede] = useState('Principal');
    const [groupSedeMap, setGroupSedeMap] = useState<Record<string, string>>({});
    const [previewUrl, setPreviewUrl] = useState<URL | string | null>(null);
    const [jpgPreviewUrl, setJpgPreviewUrl] = useState<string | null>(null);
    const [excelBlob, setExcelBlob] = useState<Blob | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const scheduleContentRef = useRef<HTMLDivElement>(null);

    const getBlockTimeRange = (block: number) => {
        const ranges: Record<number, string> = {
            1: "07:00 - 07:55 AM",
            2: "07:55 - 08:50 AM",
            3: "09:10 - 10:05 AM",
            4: "10:05 - 11:00 AM",
            5: "11:10 - 12:05 PM",
            6: "12:05 - 01:00 PM"
        };
        return ranges[block] || "";
    };

    useModalBack(isOpen, onClose, 'schedule-modal');

    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const bogota = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));

            const day = bogota.getDay(); // 0-6
            const hour = bogota.getHours(); // 0-23

            const target = new Date(bogota);

            // Logic:
            // Fri >= 18 (6pm) or Sat or Sun -> Next Monday
            // Mon-Thu >= 18 (6pm) -> Tomorrow
            // Else -> Today

            if ((day === 5 && hour >= 18) || day === 6 || day === 0) {
                const daysToAdd = day === 5 ? 3 : day === 6 ? 2 : 1;
                target.setDate(target.getDate() + daysToAdd);
            } else if (hour >= 18) {
                target.setDate(target.getDate() + 1);
            }
            // Else keep Today

            const offset = target.getTimezoneOffset() * 60000;
            // Adjust back to local ISO string without timezone shift issues
            // (Using the simple date construction from bogota date object directly)
            // Ideally just use string formatting but keeping existing pattern style for minimal diff risk,
            // though `target` (bogota) is already shifted? No, `new Date(string)` keeps simple.

            // Simpler approach to get YYYY-MM-DD from the `target` object which represents the correct 'local' time
            const y = target.getFullYear();
            const m = (target.getMonth() + 1).toString().padStart(2, '0');
            const d = target.getDate().toString().padStart(2, '0');
            setDate(`${y}-${m}-${d}`);

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
                .maybeSingle();

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
                const items = rawItems.map((i: any) => ({
                    time: i.time || i.time_start,
                    group: i.group,
                    notes: i.notes,
                    studentCount: countsMap[i.group] || 0,
                    sede: sedeMap[i.group] || 'Principal',
                    conflict: null as any
                }));

                // 4. Fetch Last Week for Conflicts
                const lastWeekDate = new Date(dateStr);
                lastWeekDate.setDate(lastWeekDate.getDate() - 7);
                const lastWeekStr = lastWeekDate.toISOString().split('T')[0];

                const { data: lwData } = await supabase.from('schedules').select('items').eq('date', lastWeekStr).maybeSingle();
                if (lwData?.items) {
                    const lwItems = lwData.items as any[];
                    items.forEach((item: ScheduleItem) => {
                        const currentBlock = getAcademicBlock(item.time);
                        if (currentBlock) {
                            const conflict = lwItems.find(lw =>
                                lw.group === item.group &&
                                getAcademicBlock(lw.time_start || lw.time) === currentBlock
                            );
                            if (conflict) {
                                item.conflict = {
                                    block: currentBlock,
                                    lastWeekTime: conflict.time_start || conflict.time
                                };
                            }
                        }
                    });
                }

                setSchedule(items.sort((a: any, b: any) => timeToMinutes(a.time) - timeToMinutes(b.time)));
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
        // Siempre generar URL de previsualización (funciona en móvil y escritorio)
        const url = generateSchedulePDF(filteredSchedule, date, selectedSede, true);
        if (url) setPreviewUrl(url);
    };

    const confirmDownload = () => {
        const filteredSchedule = schedule.filter(s => selectedSede === 'Todas' || s.sede === selectedSede);
        generateSchedulePDF(filteredSchedule, date, selectedSede, false);
        setPreviewUrl(null);
    };

    const handlePdfShare = async () => {
        if (!previewUrl) return;
        try {
            const res = await fetch(previewUrl as string);
            const blob = await res.blob();
            const file = new File([blob], `Horario-PAE-${date}.pdf`, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Horario PAE - I.E. Barroblanco',
                    text: `Horario del restaurante escolar para el ${date}`,
                    files: [file],
                });
            } else {
                // Fallback: descargar directamente
                confirmDownload();
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') confirmDownload();
        }
    };

    const closePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl as string);
            setPreviewUrl(null);
        }
    };

    const handleExcelExport = () => {
        const filteredSchedule = schedule.filter(s => selectedSede === 'Todas' || s.sede === selectedSede);
        
        // Agrupar asistentes por hora
        const groupedByTime: Record<string, ScheduleItem[]> = {};
        filteredSchedule
            .filter(item => item.time !== 'NO_ASISTE')
            .forEach(item => {
                if (!groupedByTime[item.time]) groupedByTime[item.time] = [];
                groupedByTime[item.time].push(item);
            });

        // Ordenar cronológicamente
        const toMinutes = (t: string) => {
            const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return 0;
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const period = match[3].toUpperCase();
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return h * 60 + m;
        };
        const sortedTimes = Object.keys(groupedByTime).sort((a, b) =>
            toMinutes(a.split(' - ')[0]) - toMinutes(b.split(' - ')[0])
        );

        // Filas de la tabla agrupadas por hora
        // Fila de NO ASISTEN al final
        const excelData: any[] = sortedTimes.map(time => ({
            'Bloque / Hora': time.split(' - ')[0],
            'Grupos': groupedByTime[time].map(i => i.group.replace('-2026', '')).join(', '),
        }));

        // Fila de NO ASISTEN al final
        const noAsisten = filteredSchedule
            .filter(item => item.time === 'NO_ASISTE')
            .map(i => i.group.replace('-2026', ''));
        if (noAsisten.length > 0) {
            excelData.push({
                'Bloque / Hora': 'NO ASISTEN',
                'Grupos': noAsisten.join(', '),
            });
        }

        // Crear workbook y generar blob en lugar de descargar directamente
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Horario PAE');
        ws['!cols'] = [
            { wch: 25 },
            { wch: 60 },
        ];

        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        setExcelBlob(blob);
        setShowExportMenu(false);
    };

    const handleExcelDownload = () => {
        if (!excelBlob) return;
        const url = URL.createObjectURL(excelBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Horario-PAE-${date}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        setExcelBlob(null);
    };

    const handleExcelShare = async () => {
        if (!excelBlob) return;
        try {
            const file = new File([excelBlob], `Horario-PAE-${date}.xlsx`, {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Horario PAE - I.E. Barroblanco',
                    text: `Horario del restaurante escolar para el ${date}`,
                    files: [file],
                });
            } else {
                handleExcelDownload();
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') handleExcelDownload();
        }
    };

    const handleJpgExport = async () => {
        const filteredSchedule = schedule.filter(s => selectedSede === 'Todas' || s.sede === selectedSede);

        // Agrupar asistentes por hora (Lógica idéntica al PDF)
        const groupedByTime: Record<string, { groups: string[], notes: string[] }> = {};
        filteredSchedule
            .filter(item => item.time !== 'NO_ASISTE')
            .forEach(item => {
                const timeKey = item.time;
                if (!groupedByTime[timeKey]) {
                    groupedByTime[timeKey] = { groups: [], notes: [] };
                }
                const groupName = item.group.replace('-2026', '');
                groupedByTime[timeKey].groups.push(groupName);
                if (item.notes) {
                    const noteWithGroup = `${groupName}: ${item.notes}`;
                    if (!groupedByTime[timeKey].notes.includes(noteWithGroup)) {
                        groupedByTime[timeKey].notes.push(noteWithGroup);
                    }
                }
            });

        const toMinutes = (t: string) => {
            const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return 0;
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const period = match[3].toUpperCase();
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return h * 60 + m;
        };
        const sortedTimes = Object.keys(groupedByTime).sort((a, b) =>
            toMinutes(a.split(' - ')[0]) - toMinutes(b.split(' - ')[0])
        );

        const noAsisten = filteredSchedule
            .filter(item => item.time === 'NO_ASISTE')
            .map(i => i.group.replace('-2026', ''));

        const formattedDateFull = date
            ? new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            : '';

        // Construir filas HTML con colores explícitos
        const bodyRows = sortedTimes.map(time => {
            const data = groupedByTime[time];
            const grupos = data.groups.join(', ');
            return `<tr>
                <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-size:14px;color:#1e293b;">${time.split(' - ')[0]}</td>
                <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:16px;color:#0f172a;">${grupos}</td>
            </tr>`;
        }).join('');

        const noAsistenRow = noAsisten.length > 0
            ? `<tr style="background:#fee2e2;">
                <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:14px;color:#991b1b;">NO ASISTEN</td>
                <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:16px;color:#991b1b;">${noAsisten.join(', ')}</td>
            </tr>` : '';

        // Crear elemento HTML temporal fuera del viewport
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;left:-9999px;top:0;width:550px;background:#fff;padding:40px;font-family:helvetica,arial,sans-serif;color:#000;';
        el.innerHTML = `
            <div style="text-align:center;margin-bottom:20px;">
                <h1 style="font-size:18px;color:#164e63;margin:0 0 6px;">Institución Educativa Barroblanco</h1>
                <h2 style="font-size:14px;color:#475569;margin:0 0 4px;font-weight:600;">Horario de Restaurante Escolar${selectedSede !== 'Todas' ? ` - Sede ${selectedSede}` : ''}</h2>
                <p style="font-size:12px;color:#666;margin:0;">Fecha: ${formattedDateFull.charAt(0).toUpperCase() + formattedDateFull.slice(1)}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#06b6d4;color:#fff;">
                        <th style="padding:6px 10px;border:1px solid #ddd;font-size:14px;width:120px;">Bloque / Hora</th>
                        <th style="padding:6px 10px;border:1px solid #ddd;font-size:15px;">Grupos</th>
                    </tr>
                </thead>
                <tbody>${bodyRows}${noAsistenRow}</tbody>
            </table>
        `;
        document.body.appendChild(el);

        // Esperar a que el DOM renderice el elemento antes de capturar
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const canvas = await html2canvas(el, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                width: el.offsetWidth,
            });

            // Mostrar previsualización en lugar de descargar directamente
            setJpgPreviewUrl(canvas.toDataURL('image/jpeg', 0.96));
            setShowExportMenu(false);
        } catch (error) {
            console.error('Error generating JPG:', error);
        } finally {
            document.body.removeChild(el);
        }
    };

    const handleDownloadPdf = () => {
        handleDownload();
        setShowExportMenu(false);
    };

    const handleJpgDownload = () => {
        if (!jpgPreviewUrl) return;
        const link = document.createElement('a');
        link.href = jpgPreviewUrl;
        link.download = `Horario-PAE-${date}.jpg`;
        link.click();
        setJpgPreviewUrl(null);
    };

    const handleJpgShare = async () => {
        if (!jpgPreviewUrl) return;
        try {
            // Convertir dataURL a Blob para compartir
            const res = await fetch(jpgPreviewUrl);
            const blob = await res.blob();
            const file = new File([blob], `Horario-PAE-${date}.jpg`, { type: 'image/jpeg' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Horario PAE - I.E. Barroblanco',
                    text: `Horario del restaurante escolar para el ${date}`,
                    files: [file],
                });
            } else {
                // Fallback: descargar si el dispositivo no soporta compartir archivos
                handleJpgDownload();
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('Error al compartir JPG:', err);
                handleJpgDownload();
            }
        }
    };

    if (!isOpen) return null;

    const formattedDate = date ? new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 overflow-hidden flex flex-col max-h-[90vh]">

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
                            className="p-3.5 -m-2 hover:bg-white/10 rounded-full transition-all duration-200 text-white/70 hover:text-white"
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
                            <button
                                onClick={() => setShowSedeDropdown(!showSedeDropdown)}
                                className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 px-3 flex items-center justify-between gap-2 font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm group"
                            >
                                <span className="truncate">{selectedSede === 'Todas' ? 'Todas' : selectedSede}</span>
                                {showSedeDropdown ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:translate-y-0.5 transition-transform" />}
                            </button>

                            {showSedeDropdown && (
                                <>
                                    <div className="fixed inset-0 z-[60]" onClick={() => setShowSedeDropdown(false)}></div>
                                    <div className="absolute top-full right-0 mt-2 w-full min-w-[140px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden z-[70] animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                                        <div className="p-1.5 space-y-1">
                                            {[
                                                { id: 'Todas', label: 'Todas las sedes' },
                                                { id: 'Principal', label: 'Principal' },
                                                { id: 'Primaria', label: 'Primaria' },
                                                { id: 'Maria Inmaculada', label: 'M. Inmaculada' }
                                            ].map((sede) => (
                                                <button
                                                    key={sede.id}
                                                    onClick={() => { setSelectedSede(sede.id); setShowSedeDropdown(false); }}
                                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${selectedSede === sede.id
                                                        ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                                                        }`}
                                                >
                                                    {sede.label}
                                                    {selectedSede === sede.id && <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Calendar Collapse - Now inside the layout flow to avoid clipping */}
                {showCalendar && (
                    <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-4 animate-in slide-in-from-top-2 duration-300 relative z-[100]">
                        <MiniCalendar
                            selectedDate={date}
                            onSelectDate={(d: string) => { setDate(d); setShowCalendar(false); }}
                        />
                    </div>
                )}

                {/* Body */}
                <div ref={scheduleContentRef} className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/30 dark:bg-black/20">
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
                                            {(() => {
                                                // Separate items with notes from those without
                                                const itemsWithNotes = filtered.filter(item => !!item.notes);
                                                const itemsWithoutNotes = filtered.filter(item => !item.notes);

                                                // Group items without notes by time
                                                const groupedByTime: Record<string, ScheduleItem[]> = {};
                                                itemsWithoutNotes.forEach(item => {
                                                    if (!groupedByTime[item.time]) {
                                                        groupedByTime[item.time] = [];
                                                    }
                                                    groupedByTime[item.time].push(item);
                                                });

                                                // Render items with notes first
                                                const itemsWithNotesElements = itemsWithNotes.map((item, idx) => (
                                                    <div
                                                        key={`note-${idx}`}
                                                        className="bg-amber-50/40 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-[2rem] p-4 flex items-center gap-4 animate-in fade-in duration-300"
                                                    >
                                                        <div className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl shadow-sm shrink-0 flex items-center gap-1.5">
                                                            <Clock className="w-3 h-3 text-amber-500" />
                                                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                                                {item.time.split(' - ')[0]}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-lg text-gray-900 dark:text-white leading-none tracking-tight">
                                                                    {item.group.replace('-2026', '')}
                                                                </span>
                                                                {item.studentCount !== undefined && (
                                                                    <span className="text-[9px] font-black text-amber-700/60 dark:text-amber-400/80 bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900/30 px-1.5 py-0.5 rounded-md">
                                                                        {item.studentCount} Estudiantes
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] font-bold text-amber-600/80 dark:text-amber-400/70 mt-1 italic leading-tight">
                                                                {item.notes}
                                                            </span>

                                                            {/* CONFLICT WARNING */}
                                                            {item.conflict && (
                                                                <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-2.5 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                                                                            Bloque {item.conflict.block}: {getBlockTimeRange(item.conflict.block)}
                                                                        </span>
                                                                        <p className="text-[9px] font-bold text-amber-600/80 dark:text-amber-500/70 mt-0.5 leading-tight">
                                                                            Asignado hoy en el mismo bloque académico que la semana pasada. ({item.conflict.lastWeekTime})
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ));

                                                // Render grouped items by time
                                                const groupedElements = Object.entries(groupedByTime).map(([time, items], groupIdx) => (
                                                    <div
                                                        key={`time-group-${groupIdx}`}
                                                        className="flex items-center gap-4 p-4 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-cyan-100 dark:hover:border-cyan-900 hover:shadow-xl hover:shadow-cyan-600/5 transition-all duration-300 group"
                                                    >
                                                        <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-900/20 group-hover:border-cyan-100 dark:group-hover:border-cyan-800 transition-colors shrink-0 shadow-sm min-w-[85px]">
                                                            <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400" />
                                                            <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 group-hover:text-cyan-900 dark:group-hover:text-cyan-300 leading-tight">
                                                                {time.split(' - ')[0]}
                                                            </span>
                                                        </div>

                                                        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2 sm:gap-3">
                                                            {items.map((item, itemIdx) => (
                                                                <div key={itemIdx} className="flex items-center gap-1.5">
                                                                    <span className="font-black text-lg text-gray-900 dark:text-white whitespace-nowrap tracking-tight">
                                                                        {item.group.replace('-2026', '')}
                                                                    </span>
                                                                    {itemIdx < items.length - 1 && (
                                                                        <span className="text-gray-400 dark:text-gray-500 mx-0.5">•</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ));

                                                return (
                                                    <>
                                                        {itemsWithNotesElements}
                                                        {groupedElements}
                                                    </>
                                                );
                                            })()}

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
                                                                className="bg-red-50/40 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-[2rem] p-4 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300"
                                                            >
                                                                <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-xl shadow-sm shrink-0 flex items-center gap-1.5">
                                                                    <X className="w-3 h-3 text-red-500" />
                                                                    <span className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-wider">NO ASISTE</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-black text-lg text-red-900 dark:text-red-200 leading-none">
                                                                            {item.group.replace('-2026', '')}
                                                                        </span>
                                                                        {item.studentCount !== undefined && (
                                                                            <span className="text-[9px] font-black text-red-700/60 dark:text-red-300/60 bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/30 px-1.5 py-0.5 rounded-md">
                                                                                {item.studentCount} Estudiantes
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {item.notes && (
                                                                        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mt-1 italic leading-tight">
                                                                            {item.notes}
                                                                        </span>
                                                                    )}

                                                                    {/* CONFLICT WARNING */}
                                                                    {item.conflict && (
                                                                        <div className="mt-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-2.5 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                                                                                    Bloque {item.conflict.block}: {getBlockTimeRange(item.conflict.block)}
                                                                                </span>
                                                                                <p className="text-[9px] font-bold text-amber-600/80 dark:text-amber-500/70 mt-0.5 leading-tight">
                                                                                    Asignado hoy en el mismo bloque académico que la semana pasada. ({item.conflict.lastWeekTime})
                                                                                </p>
                                                                            </div>
                                                                        </div>
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
                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">NOTA: ESTAR ATENTOS A LAS NOVEDADES.</p>
                                    <p className="text-[11px] font-black text-cyan-700 dark:text-cyan-400 uppercase">CONSEJO ACADÉMICO DE DOCENTES</p>
                                </div>

                                <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase leading-tight">
                                    RECORDEMOS QUE EL HORARIO DE BACHILLERATO DE 7 A.M A 1.00. PM
                                </p>

                                <div className="bg-cyan-50/50 dark:bg-cyan-900/10 p-3 rounded-2xl border border-cyan-100/50 dark:border-cyan-800/30">
                                    <p className="text-[10px] font-black text-cyan-800 dark:text-cyan-300 uppercase mb-2">RECUERDA</p>
                                    <ul className="space-y-1.5">
                                        <li className="flex items-center gap-2 text-[10px] font-bold text-gray-600 dark:text-gray-400 italic">
                                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                            Puntualidad
                                        </li>
                                        <li className="flex items-center gap-2 text-[10px] font-bold text-gray-600 dark:text-gray-400 italic">
                                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                            Uso adecuado del uniforme
                                        </li>
                                        <li className="flex items-center gap-2 text-[10px] font-bold text-gray-600 dark:text-gray-400 italic">
                                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                            Seguir las recomendaciones escritas en estas novedades
                                        </li>
                                    </ul>
                                </div>

                                <div className="pt-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
                                    <p>Equipo directivo</p>
                                    <p>I.E Barro Blanco</p>
                                </div>

                                <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700 text-[9px] text-gray-400 dark:text-gray-500 text-center space-y-1">
                                    <p className="font-bold">www.barroblanco.edu.co | Correo Electrónico info@barroblanco.edu.co</p>
                                    <p>Sede principal. Km. 4 Vía al aeropuerto Barrio Barro Blanco, Rionegro, Ant.</p>
                                    <p>Tel. (604) 473 4386 Cel. 324 591 6685</p>
                                    <p>Sede María Inmaculada, Vereda Abreu Cel. 324 591 6687</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10 opacity-60">
                            <Calendar className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No hay horario programado para esta fecha.</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                disabled={schedule.length === 0}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Download className="w-5 h-5" />
                                <span>Descargar</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showExportMenu && (
                                <>
                                    <div className="fixed inset-0 z-[80]" onClick={() => setShowExportMenu(false)}></div>
                                    <div className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-gray-700 rounded-2xl shadow-lg overflow-hidden z-[90] animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-600">
                                        <button
                                            onClick={handleDownloadPdf}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-600 flex items-center gap-2"
                                        >
                                            <Download className="w-4 h-4 text-cyan-600" />
                                            Descargar como PDF
                                        </button>
                                        <button
                                            onClick={handleExcelExport}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-600 flex items-center gap-2"
                                        >
                                            <FileText className="w-4 h-4 text-green-600" />
                                            Descargar como Excel (.xlsx)
                                        </button>
                                        <button
                                            onClick={handleJpgExport}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2"
                                        >
                                            <FileText className="w-4 h-4 text-amber-600" />
                                            Descargar como Imagen JPG
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-2xl font-black text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-sm active:scale-95 min-h-[48px]"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
            {/* Excel Preview Modal */}
            {excelBlob && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setExcelBlob(null)}>
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-sm flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-4 bg-gray-900 dark:bg-black text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/10 p-2 rounded-xl">
                                    <FileText className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">Vista Previa</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Horario en Excel (.xlsx)</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setExcelBlob(null)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Placeholder visual */}
                        <div className="flex flex-col items-center justify-center gap-4 py-10 px-6 bg-gray-50 dark:bg-gray-800">
                            <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center">
                                <FileText className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-900 dark:text-white text-base">Excel listo</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Horario-PAE-{date}.xlsx</p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex gap-3 shrink-0">
                            <button
                                onClick={handleExcelShare}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95"
                            >
                                <Share2 className="w-4 h-4" />
                                Compartir
                            </button>
                            <button
                                onClick={handleExcelDownload}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-2xl font-black text-sm hover:bg-gray-800 transition-all active:scale-95"
                            >
                                <Download className="w-4 h-4" />
                                Descargar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* JPG Preview Modal Overlay */}
            {jpgPreviewUrl && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setJpgPreviewUrl(null)}>
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-sm flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
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

                        {/* Image Preview */}
                        <div className="bg-gray-100 dark:bg-gray-800 overflow-auto max-h-[55vh] flex items-start justify-center p-3">
                            <img
                                src={jpgPreviewUrl}
                                alt="Vista previa del horario"
                                className="w-full rounded-xl shadow-lg object-contain"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex gap-3 shrink-0">
                            <button
                                onClick={handleJpgShare}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95"
                            >
                                <Share2 className="w-4 h-4" />
                                Compartir
                            </button>
                            <button
                                onClick={handleJpgDownload}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-2xl font-black text-sm hover:bg-gray-800 transition-all active:scale-95"
                            >
                                <Download className="w-4 h-4" />
                                Descargar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PDF Preview Modal Overlay */}
            {previewUrl && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={closePreview}>
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden"
                        style={{ height: window.innerWidth >= 1024 ? '85vh' : 'auto' }}
                        onClick={(e) => e.stopPropagation()}>
                        {/* Preview Header */}
                        <div className="p-4 bg-gray-900 dark:bg-black text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/10 p-2 rounded-xl">
                                    <FileText className="w-5 h-5 text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">Vista Previa del PDF</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Selecciona una acción</p>
                                </div>
                            </div>
                            <button
                                onClick={closePreview}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* PDF Viewer - solo en escritorio */}
                        <div className="hidden md:flex flex-1 bg-gray-100 dark:bg-gray-800 relative">
                            <iframe
                                src={previewUrl as string}
                                className="w-full h-full border-none"
                                title="PDF Preview"
                            />
                        </div>

                        {/* Móvil: placeholder visual */}
                        <div className="flex md:hidden flex-col items-center justify-center gap-4 py-10 px-6 bg-gray-50 dark:bg-gray-800">
                            <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl flex items-center justify-center">
                                <FileText className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-900 dark:text-white text-base">PDF listo</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Horario-PAE-{date}.pdf</p>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex gap-3 shrink-0">
                            <button
                                onClick={closePreview}
                                className="px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePdfShare}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95"
                            >
                                <Share2 className="w-4 h-4" />
                                Compartir
                            </button>
                            <button
                                onClick={confirmDownload}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-2xl font-black text-sm hover:bg-gray-800 transition-all active:scale-95"
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
