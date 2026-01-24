'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    Clock,
    Users,
    Save,
    Loader2,
    Edit2,
    Trash2,
    MoreVertical,
    Info,
    ChevronDown,
    ChevronRight,
    X,
    Plus,
    FileText,
    AlertTriangle,
    Coffee
} from 'lucide-react';
import { generateTimeSlots, processGroups, GlobalGroup, isBreakTime } from '@/lib/schedule-utils';
import { MiniCalendar } from '@/components/ui/MiniCalendar';

interface AssignedSlot {
    group: GlobalGroup & { sede?: string };
    notes?: string;
}

export default function HorarioPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [role, setRole] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
    const [selectedSede, setSelectedSede] = useState('Principal');

    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const now = new Date();
        const bogota = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));

        const d = new Date(bogota);
        const day = d.getDay();
        const hour = d.getHours();

        // Smart jump: Friday > 8pm or Fri/Sat/Sun -> +1 day or Monday
        // The user previously wanted "tomorrow" for daily, but "next week" for weekly.
        // For Horario Page (daily view focus):
        if (day === 5 && hour >= 20) d.setDate(d.getDate() + 3); // Fri night -> Mon
        else if (day === 5) d.setDate(d.getDate() + 1); // Fri day -> Sat (will be handled by day 6 logic anyway?)
        else if (day === 6) d.setDate(d.getDate() + 2); // Sat -> Mon
        else if (day === 0) d.setDate(d.getDate() + 1); // Sun -> Mon
        else d.setDate(d.getDate() + 1); // Mon-Thu -> Tomorrow

        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${dayStr}`;
    });

    const [availableGroups, setAvailableGroups] = useState<GlobalGroup[]>([]);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [assignments, setAssignments] = useState<Record<string, AssignedSlot[]>>({});
    const [prevWeekAssignments, setPrevWeekAssignments] = useState<Record<string, string[]>>({});
    const [selectedGroup, setSelectedGroup] = useState<GlobalGroup | null>(null);
    const [editingSlot, setEditingSlot] = useState<string | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [notif, setNotif] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [showConfirmSave, setShowConfirmSave] = useState(false);
    const [unassignedCount, setUnassignedCount] = useState(0);
    const [absentGroups, setAbsentGroups] = useState<AssignedSlot[]>([]);
    const [weekData, setWeekData] = useState<any[]>([]);
    const [instEvents, setInstEvents] = useState<any[]>([]);
    const [dailyInstEvents, setDailyInstEvents] = useState<any[]>([]);
    const [showInstructions, setShowInstructions] = useState(false);

    const [showEventModal, setShowEventModal] = useState(false);
    const [eventDate, setEventDate] = useState<string>('');
    const [editingEvent, setEditingEvent] = useState<any | null>(null);
    const [eventForm, setEventForm] = useState({
        titulo: '',
        hora: '',
        afectados: '',
        descripcion: '',
        prioridad: 'normal'
    });

    useEffect(() => {
        if (notif) {
            const timer = setTimeout(() => setNotif(null), 3500);
            return () => clearTimeout(timer);
        }
    }, [notif]);

    useEffect(() => {
        checkAccess();
    }, []);

    useEffect(() => {
        if (role) initData();
    }, [role, selectedDate, viewMode, selectedSede]);

    const checkAccess = async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            await supabase.auth.signOut();
            router.push('/');
            return;
        }
        const userRole = user.user_metadata?.rol;
        if (userRole !== 'admin' && userRole !== 'coordinador_pae') {
            router.push('/dashboard');
            return;
        }
        setRole(userRole);
    };

    const initData = async () => {
        setLoading(true);
        try {
            const slots = generateTimeSlots(10);
            setTimeSlots(slots);

            const { data: estData } = await supabase
                .from('estudiantes')
                .select('grupo, sede')
                .eq('estado', 'activo');

            const counts: Record<string, number> = {};
            const groupSedeMap: Record<string, string> = {};
            estData?.forEach(e => {
                if (e.grupo) {
                    counts[e.grupo] = (counts[e.grupo] || 0) + 1;
                    if (e.sede) groupSedeMap[e.grupo] = e.sede;
                }
            });

            const uniqueGroups = Array.from(new Set(estData?.map(e => e.grupo) || [])).filter(g => !g.includes('2025'));
            const processed: any[] = uniqueGroups.map(g => ({
                id: g,
                label: g.replace('-2026', ''),
                studentCount: counts[g] || 0,
                sede: groupSedeMap[g] || 'Principal',
                isCombo: false
            })).sort((a: any, b: any) => {
                return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
            });
            setAvailableGroups(processed);

            if (viewMode === 'day') {
                const { data: schedArray } = await supabase
                    .from('schedules')
                    .select('items')
                    .eq('date', selectedDate);

                const currentAssignments: Record<string, AssignedSlot[]> = {};
                const absent: AssignedSlot[] = [];

                if (schedArray?.[0]?.items) {
                    schedArray[0].items.forEach((item: any) => {
                        const found = processed.find(g => g.id === item.group);
                        if (!found) return;
                        if (item.time === 'NO_ASISTE') {
                            absent.push({ group: found, notes: item.notes });
                        } else {
                            if (!currentAssignments[item.time]) currentAssignments[item.time] = [];
                            currentAssignments[item.time].push({ group: found, notes: item.notes });
                        }
                    });
                }
                setAssignments(currentAssignments);
                setAbsentGroups(absent);

                // Fetch Daily Inst Events
                let dailyQuery = supabase
                    .from('novedades_institucionales')
                    .select('*')
                    .eq('fecha', selectedDate);

                if (selectedSede === 'Principal') {
                    // Include both 'Principal' and legacy records (null)
                    dailyQuery = dailyQuery.or('sede.eq."Principal",sede.is.null');
                } else if (selectedSede !== 'Todas') {
                    dailyQuery = dailyQuery.eq('sede', selectedSede);
                }

                const { data: dailyEvents } = await dailyQuery.order('hora', { ascending: true });
                setDailyInstEvents(dailyEvents || []);

                // Fetch Previous Week for Conflict Detection
                const [y, m, d_num] = selectedDate.split('-').map(Number);
                const prevDateObj = new Date(y, m - 1, d_num, 12, 0, 0); // Noon to avoid tz shifts
                prevDateObj.setDate(prevDateObj.getDate() - 7);
                const py = prevDateObj.getFullYear();
                const pm = (prevDateObj.getMonth() + 1).toString().padStart(2, '0');
                const pd = prevDateObj.getDate().toString().padStart(2, '0');
                const prevDateStr = `${py}-${pm}-${pd}`;

                const { data: prevSchedData } = await supabase
                    .from('schedules')
                    .select('items')
                    .eq('date', prevDateStr)
                    .maybeSingle();

                const prevAssignments: Record<string, string[]> = {};
                if (prevSchedData?.items) {
                    prevSchedData.items.forEach((item: any) => {
                        if (item.time && item.time !== 'NO_ASISTE') {
                            if (!prevAssignments[item.time]) prevAssignments[item.time] = [];
                            prevAssignments[item.time].push(item.group);
                        }
                    });
                }
                setPrevWeekAssignments(prevAssignments);

            } else {
                const d = new Date(selectedDate + 'T12:00:00');
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const dates = [];
                for (let i = 0; i < 5; i++) {
                    const target = new Date(d.setDate(diff + i));
                    dates.push(target.toISOString().split('T')[0]);
                }
                setWeekData(dates.map(date => ({ date })));

                let weekQuery = supabase
                    .from('novedades_institucionales')
                    .select('*')
                    .in('fecha', dates);

                if (selectedSede === 'Principal') {
                    // Include both 'Principal' and legacy records (null)
                    weekQuery = weekQuery.or('sede.eq."Principal",sede.is.null');
                } else if (selectedSede !== 'Todas') {
                    weekQuery = weekQuery.eq('sede', selectedSede);
                }

                const { data: events } = await weekQuery.order('hora', { ascending: true });
                setInstEvents(events || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSlotClick = (time: string) => {
        if (selectedGroup) {
            if ((assignments[time] || []).some(s => s.group.id === selectedGroup.id)) return;
            setAssignments(prev => ({
                ...prev,
                [time]: [...(prev[time] || []), { group: selectedGroup }]
            }));
            setSelectedGroup(null);
        } else if (assignments[time]?.length > 0) {
            setEditingSlot(time);
        }
    };

    const handleSetAbsent = () => {
        if (!selectedGroup) return;
        if (absentGroups.some(a => a.group.id === selectedGroup.id)) return;
        setAbsentGroups(prev => [...prev, { group: selectedGroup, notes: 'Reportado por Coordinación' }]);
        setSelectedGroup(null);
    };

    const handleSave = () => {
        const unassigned = availableGroups.filter(g => (selectedSede === 'Todas' || (g as any).sede === selectedSede) && !isAssigned(g)).length;
        if (unassigned > 0) {
            setUnassignedCount(unassigned);
            setShowConfirmSave(true);
        } else {
            executeSave();
        }
    };

    const executeSave = async () => {
        setSaving(true);
        try {
            const items: any[] = [];
            Object.entries(assignments).forEach(([time, slots]) => {
                slots.forEach(s => items.push({
                    time,
                    time_start: time,
                    group: s.group.id, // Using ID for persistence
                    notes: s.notes || ''
                }));
            });
            absentGroups.forEach(a => items.push({
                time: 'NO_ASISTE',
                time_start: 'NO_ASISTE',
                group: a.group.id, // Using ID for persistence
                notes: a.notes || ''
            }));

            await supabase.from('schedules').upsert({ date: selectedDate, items, updated_at: new Date().toISOString() }, { onConflict: 'date' });
            setNotif({ type: 'success', msg: 'Horario guardado' });
            setShowConfirmSave(false);
        } catch (e) {
            setNotif({ type: 'error', msg: 'Error al guardar' });
        } finally {
            setSaving(false);
        }
    };

    const handleAddEvent = (date?: string) => {
        setEditingEvent(null);
        setEventForm({ titulo: '', hora: '', afectados: '', descripcion: '', prioridad: 'normal' });
        setEventDate(date || selectedDate);
        setShowEventModal(true);
    };

    const handleEditEvent = (event: any) => {
        setEditingEvent(event);
        setEventDate(event.fecha);
        setEventForm({ titulo: event.titulo, hora: event.hora || '', afectados: event.afectados || '', descripcion: event.descripcion || '', prioridad: event.prioridad || 'normal' });
        setShowEventModal(true);
    };

    const handleSaveInstitutionalEvent = async () => {
        if (!eventForm.titulo) return;
        setSaving(true);
        const data = {
            ...eventForm,
            fecha: eventDate,
            sede: selectedSede === 'Todas' ? 'Principal' : selectedSede
        };
        const { error } = editingEvent ? await supabase.from('novedades_institucionales').update(data).eq('id', editingEvent.id) : await supabase.from('novedades_institucionales').insert([data]);
        if (!error) {
            setNotif({ type: 'success', msg: 'Evento actualizado' });
            setShowEventModal(false);
            initData();
        }
        setSaving(false);
    };

    const handleDeleteInstitutionalEvent = async (id: string) => {
        if (confirm('¿Eliminar actividad?')) {
            await supabase.from('novedades_institucionales').delete().eq('id', id);
            initData();
        }
    };

    const isAssigned = (g: GlobalGroup) => Object.values(assignments).some(slots => slots.some(s => s.group.id === g.id)) || absentGroups.some(a => a.group.id === g.id);

    const getWeekRange = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);

        const mon = new Date(d.setDate(diff));
        const fri = new Date(d.setDate(diff + 4));

        const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        return `${mon.toLocaleDateString('es-CO', opts)} - ${fri.toLocaleDateString('es-CO', opts)}`.toUpperCase().replace(/\./g, '');
    };

    const handleMoveWeek = (offset: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + (offset * 7));
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleJumpToDay = (dayIndex: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const target = new Date(d.setDate(diff + (dayIndex - 1)));
        setSelectedDate(target.toISOString().split('T')[0]);
        setViewMode('day');
    };

    const handleSelectDateInWeek = (dayIndex: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const target = new Date(d.setDate(diff + (dayIndex - 1)));
        const targetStr = target.toISOString().split('T')[0];
        setSelectedDate(targetStr);

        // Auto-scroll to the card
        setTimeout(() => {
            const el = document.getElementById(`day-card-${targetStr}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const formatDateLabel = (date: string) => {
        const [y, m, d] = date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
        const str = dateObj.toLocaleDateString('es-CO', options);
        return str.charAt(0).toUpperCase() + str.slice(1).replace('.', '')
    };

    return (
        <>
            <style jsx global>{`
                @keyframes pulse-dark {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(75, 85, 99, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(75, 85, 99, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(75, 85, 99, 0); }
                }
                @keyframes pulse-blue {
                    0% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
                    100% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
                }
                .pulse-dark-button {
                    animation: pulse-dark 2s infinite;
                }
                .pulse-blue-button {
                    animation: pulse-blue 2s infinite;
                }
            `}</style>

            <div className="p-1 lg:p-6 max-w-7xl mx-auto h-screen flex flex-col overflow-hidden bg-gray-50/50">

                {/* Fixed Title Header - Premium Modal Style Integration */}
                <div className="flex items-center justify-between px-4 mb-4 shrink-0 bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 rounded-[2rem] text-white shadow-lg shadow-cyan-100">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard')} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white shadow-sm border border-white/10 transition-all active:scale-95">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-xl lg:text-3xl font-black tracking-tight leading-none">Tablero de Horarios</h1>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mt-1">Gestión Institucional PAE</p>
                        </div>
                        <button
                            onClick={() => setShowInstructions(true)}
                            className="w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all pulse-dark-button shadow-sm outline-none border border-white/10"
                        >
                            <Info className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Fixed Header Toolbar */}
                <div className="flex flex-col gap-2 mb-2 px-1 shrink-0">
                    <div className="bg-white p-2 lg:p-3 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between gap-2 overflow-hidden">
                        <div className="flex items-center gap-1 lg:gap-2">
                            <div className="bg-gray-100/80 p-0.5 rounded-2xl flex items-center shrink-0 relative">
                                <button
                                    onClick={() => setViewMode('day')}
                                    className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all relative z-10 ${viewMode === 'day' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Día
                                </button>
                                <button
                                    onClick={() => setViewMode('week')}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all relative z-10 ${viewMode === 'week' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Semana
                                </button>
                                {/* Sliding Indicator */}
                                <div
                                    className={`absolute inset-y-0.5 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl shadow-md shadow-cyan-200/50 ${viewMode === 'day' ? 'left-0.5 w-[45%]' : 'left-[48%] w-[50%]'}`}
                                    style={{
                                        width: viewMode === 'day' ? 'calc(50% - 2px)' : 'calc(50% - 2px)',
                                        left: viewMode === 'day' ? '2px' : 'calc(50%)'
                                    }}
                                />
                            </div>

                            <div className="relative shrink-0">
                                <select
                                    value={selectedSede}
                                    onChange={e => setSelectedSede(e.target.value)}
                                    className="appearance-none bg-gradient-to-br from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 pl-2.5 pr-8 py-[7px] rounded-2xl text-[10px] font-black text-white border-none outline-none transition-all uppercase tracking-wider cursor-pointer w-[110px] lg:w-auto shadow-lg shadow-cyan-100"
                                >
                                    <option value="Todas" className="bg-white text-gray-900">Todas</option>
                                    <option value="Principal" className="bg-white text-gray-900">Principal</option>
                                    <option value="Primaria" className="bg-white text-gray-900">Primaria</option>
                                    <option value="Maria Inmaculada" className="bg-white text-gray-900">M. Inmaculada</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white opacity-80 pointer-events-none" />
                            </div>
                        </div>

                        {viewMode === 'day' && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-gradient-to-br from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white px-4 py-[7px] rounded-xl font-black text-[11px] flex items-center gap-2 shadow-lg shadow-cyan-200/50 transition-all active:scale-95 shrink-0"
                            >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Guardar
                            </button>
                        )}
                    </div>

                    <div className="flex justify-center -mt-1 relative group/calendar">
                        {viewMode === 'day' ? (
                            <button
                                onClick={() => setShowCalendar(true)}
                                className="flex items-center gap-3 bg-cyan-600 hover:bg-cyan-700/90 px-5 py-2.5 rounded-2xl border border-cyan-500/30 transition-all shadow-lg shadow-cyan-100 group/calendar active:scale-95 text-white"
                            >
                                <CalendarIcon className="w-4 h-4 opacity-80" />
                                <div className="text-left border-l border-white/20 pl-3">
                                    <p className="text-[8px] font-black text-cyan-50/60 uppercase tracking-[0.2em] leading-none mb-1">EDITANDO FECHA</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] font-black leading-none uppercase tracking-tight">{formatDateLabel(selectedDate)}</span>
                                        <ChevronDown className="w-4 h-4 text-white/50 group-hover/calendar:translate-y-0.5 transition-transform" />
                                    </div>
                                </div>
                            </button>
                        ) : (
                            <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-300">
                                {/* Agenda Header (Now on Top of Weekly Navigation) */}
                                <div className="flex justify-between items-center bg-white p-3 rounded-3xl border border-gray-100 shadow-sm">
                                    <div>
                                        <h2 className="text-lg font-black text-gray-900 tracking-tight">Agenda Institucional</h2>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Actividades Semanales</p>
                                    </div>
                                    <button
                                        onClick={() => handleAddEvent()}
                                        className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white px-4 py-2 rounded-xl font-black text-[10px] shadow-lg shadow-cyan-200/50 flex items-center gap-2 transition-all active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" />
                                        PROGRAMAR
                                    </button>
                                </div>

                                {/* Weekly Navigation Selectors */}
                                <div className="flex flex-row items-center justify-between gap-1 lg:gap-3 w-full px-2 lg:px-0">
                                    {/* Week Navigator */}
                                    <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 p-0.5 lg:p-1 rounded-[2rem] flex items-center shadow-lg shadow-cyan-100 border border-cyan-500/30 shrink-0">
                                        <button
                                            onClick={() => handleMoveWeek(-1)}
                                            className="p-1 lg:p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5 lg:w-4 h-4" />
                                        </button>
                                        <div className="px-1 lg:px-4 text-center min-w-[100px] lg:min-w-[170px]">
                                            <p className="text-[8px] lg:text-[10px] font-black text-white tracking-tighter lg:tracking-widest">{getWeekRange(selectedDate)}</p>
                                        </div>
                                        <button
                                            onClick={() => handleMoveWeek(1)}
                                            className="p-1 lg:p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                                        >
                                            <ChevronRight className="w-3.5 h-3.5 lg:w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Day Selector */}
                                    <div className="bg-white p-0.5 lg:p-1 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-0.5 lg:gap-1 tracking-tight shrink-0 overflow-x-auto no-scrollbar">
                                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((d, i) => {
                                            const dayIdx = i + 1;
                                            const dateObj = new Date(selectedDate + 'T12:00:00');
                                            const currentDayIdx = dateObj.getDay() || 7;
                                            const isActive = currentDayIdx === dayIdx;

                                            return (
                                                <button
                                                    key={d}
                                                    onClick={() => handleSelectDateInWeek(dayIdx)}
                                                    className={`
                                                        px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-2xl text-[8px] lg:text-[10px] font-black transition-all uppercase tracking-tighter
                                                        ${isActive
                                                            ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-200/50 scale-105 z-10'
                                                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}
                                                    `}
                                                >
                                                    {d}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                {viewMode === 'day' ? (
                    <div className="grid grid-cols-12 gap-2 flex-1 overflow-hidden pb-4 px-1 animate-in fade-in duration-300">
                        {/* Left: Timeline (Col 8) */}
                        <div className="col-span-8 bg-white rounded-[2rem] shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
                            <div className="p-3 lg:p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0 rounded-t-[2rem]">
                                <h3 className="font-black text-gray-900 flex items-center gap-2 text-[10px] lg:text-xs uppercase tracking-widest">
                                    <Clock className="w-4 h-4 text-cyan-600" />
                                    <span>Línea de Tiempo</span>
                                    {selectedGroup && (
                                        <div className="flex items-center gap-1.5 animate-pulse">
                                            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full" />
                                            <span className="text-[9px] font-black text-cyan-700 uppercase">Asignando: {selectedGroup.label}</span>
                                        </div>
                                    )}
                                </h3>
                                <p className="text-[8px] lg:text-[9px] text-gray-400 font-bold leading-tight text-right w-32 lg:w-48 whitespace-normal opacity-70">
                                    TIP: PUEDES ASIGNAR VARIOS GRUPOS A LA MISMA HORA
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 lg:p-4 bg-gray-50/30 custom-scrollbar">
                                <div className="space-y-1.5 lg:space-y-2 pb-20">
                                    {timeSlots.map(time => {
                                        const slots = (assignments[time] || []).filter(s => selectedSede === 'Todas' || (s.group as any).sede === selectedSede);
                                        const isBreak = isBreakTime(time);

                                        return (
                                            <button
                                                key={time}
                                                onClick={() => handleSlotClick(time)}
                                                className={`
                                                    relative w-full flex items-start gap-2 lg:gap-3 p-1.5 lg:p-2 rounded-xl lg:rounded-2xl border transition-all text-left group/item
                                                    ${slots.length > 0 ? 'bg-white border-blue-400 shadow-sm ring-1 ring-blue-50' : isBreak ? 'bg-amber-50/30 border-amber-200/50' : 'bg-white border-blue-50 shadow-sm'}
                                                    ${selectedGroup ? 'hover:border-blue-400 active:scale-[0.99]' : ''}
                                                `}
                                            >
                                                <div className={`
                                                    w-16 lg:w-20 py-1 rounded-lg text-center text-[10px] lg:text-xs font-black font-mono shrink-0
                                                    ${slots.length > 0 ? 'bg-blue-100/50 text-blue-600' : isBreak ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}
                                                `}>
                                                    {time}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    {slots.length > 0 ? (
                                                        <div className="flex flex-col gap-1.5">
                                                            {slots.map((s, idx) => (
                                                                <div key={idx} className="flex flex-col gap-1.5 p-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-black text-gray-900 text-[14px] lg:text-lg tracking-tight">{s.group.label.replace('-2026', '')}</span>
                                                                        <span className="text-[10px] font-black text-white bg-cyan-600/80 px-2 py-0.5 rounded-lg shadow-sm uppercase tracking-tighter">
                                                                            {s.group.studentCount} ESTUDIANTES
                                                                        </span>
                                                                    </div>

                                                                    {s.notes && (
                                                                        <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50/80 px-3 py-1.5 rounded-xl border border-amber-100 w-fit">
                                                                            <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                                            <span className="font-bold leading-tight">{s.notes}</span>
                                                                        </div>
                                                                    )}

                                                                    {(prevWeekAssignments[time]?.includes(s.group.label) || prevWeekAssignments[time]?.includes(s.group.id)) && (
                                                                        <div className="bg-red-50 border border-red-100 rounded-lg p-1.5 flex items-center gap-1.5 shadow-sm mt-1">
                                                                            <AlertTriangle className="w-3 h-3 text-red-500" />
                                                                            <span className="text-[9px] font-black text-red-600 leading-tight uppercase tracking-tight">Cruce: Mismo bloque la semana pasada</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 h-7 lg:h-8">
                                                            {isBreak && <Coffee className="w-3.5 h-3.5 text-orange-600" />}
                                                            <span className={`text-[10px] lg:text-[11px] font-bold lowercase tracking-tight ${isBreak ? 'text-blue-500 italic' : 'text-blue-400/60 italic'}`}>
                                                                {isBreak ? 'Espacio de descanso' : 'Toca para asignar grupo...'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Groups (60%) + Novedades (40%) */}
                        <div className="col-span-4 flex flex-col gap-1.5 h-full overflow-hidden">
                            {/* Groups Section (60%) */}
                            <div className="flex-[6] bg-white rounded-[2rem] shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                                <div className="p-3 border-b text-center shrink-0">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <Users className="w-4 h-4 text-cyan-600" />
                                        <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Grupos</h3>
                                        <span className="text-[10px] font-black text-cyan-200 ml-1">
                                            {availableGroups.filter(g => (selectedSede === 'Todas' || (g as any).sede === selectedSede) && !isAssigned(g)).length}
                                        </span>
                                    </div>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Selecciona para asignar</p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 lg:p-3 custom-scrollbar">
                                    <div className="flex flex-col gap-1.5">
                                        {availableGroups.filter(g => (selectedSede === 'Todas' || (g as any).sede === selectedSede) && !isAssigned(g)).map(g => (
                                            <button
                                                key={g.id}
                                                onClick={() => setSelectedGroup(selectedGroup?.id === g.id ? null : g)}
                                                className={`
                                                    p-2.5 lg:p-3 rounded-2xl border transition-all text-center relative
                                                    ${selectedGroup?.id === g.id ? 'bg-cyan-600 border-cyan-600 text-white shadow-lg shadow-cyan-100 scale-105 z-10' : 'bg-white border-gray-100 hover:border-cyan-200'}
                                                `}
                                            >
                                                <div className="font-black text-[10px] lg:text-xs truncate">{g.label}</div>
                                                <div className={`text-[8px] font-bold ${selectedGroup?.id === g.id ? 'text-cyan-100' : 'text-gray-400'}`}>{g.studentCount} est</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Novedades Section (40%) */}
                            <div className="flex-[4] p-3 lg:p-4 bg-white rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-2 overflow-hidden">
                                <div className="flex items-center gap-1.5 justify-center shrink-0">
                                    <Info className="w-4 h-4 text-red-500" />
                                    <h3 className="text-[10px] font-black text-red-500 uppercase">Novedades</h3>
                                </div>

                                {selectedGroup && (
                                    <button
                                        onClick={handleSetAbsent}
                                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl p-2.5 lg:p-3 font-black text-[9px] uppercase leading-tight border border-red-100 transition-all shadow-sm shrink-0"
                                    >
                                        MARCAR {selectedGroup.label} COMO NO ASISTE
                                    </button>
                                )}

                                <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                    {absentGroups.map((a, i) => (
                                        <div key={i} className="flex justify-between items-center bg-red-50/30 p-2 rounded-xl border border-red-100/50">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] font-black text-red-700">{a.group.label}</span>
                                                <span className="text-[8px] font-bold text-red-400 truncate">No asiste hoy</span>
                                            </div>
                                            <button
                                                onClick={() => setAbsentGroups(p => p.filter(g => g.group.id !== a.group.id))}
                                                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5 text-red-300" />
                                            </button>
                                        </div>
                                    ))}
                                    {absentGroups.length === 0 && (
                                        <div className="h-full flex items-center justify-center opacity-20 py-4">
                                            <AlertTriangle className="w-8 h-8 text-red-300" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden flex flex-col px-1 animate-in fade-in duration-300">
                        <div className="flex-1 overflow-y-auto px-2 pb-20 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-3">
                                {weekData.map((d, i) => {
                                    const events = instEvents.filter(e => e.fecha === d.date);
                                    const dateObj = new Date(d.date + 'T12:00:00');
                                    const isSelected = d.date === selectedDate;

                                    return (
                                        <div key={i} id={`day-card-${d.date}`} className="flex flex-col gap-3 scroll-mt-20">
                                            <div className={`py-2.5 px-4 rounded-full flex items-center justify-center gap-2 shadow-sm border transition-all ${isSelected ? 'bg-cyan-600 text-white border-cyan-500 shadow-cyan-100' : 'bg-white border-gray-100'}`}>
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-cyan-100' : 'text-cyan-600'}`}>
                                                    {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][dateObj.getDay()]}
                                                </span>
                                                <span className="text-base font-black tracking-tight">{dateObj.getDate()}</span>
                                            </div>

                                            <div className="space-y-2">
                                                {events.map((e, ei) => (
                                                    <div key={ei} className="p-4 rounded-[2rem] border border-cyan-50 bg-white shadow-sm relative group/card hover:border-cyan-200 transition-colors">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600 uppercase tracking-widest border border-cyan-100">
                                                                {e.hora || 'S/H'}
                                                            </span>
                                                            <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 transition-opacity">
                                                                <button onClick={() => handleEditEvent(e)} className="p-1 hover:bg-cyan-50 rounded-lg text-cyan-600">
                                                                    <Edit2 className="w-3 h-3" />
                                                                </button>
                                                                <button onClick={() => handleDeleteInstitutionalEvent(e.id)} className="p-1 hover:bg-red-50 rounded-lg text-red-600">
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <h4 className="text-[11px] font-black text-gray-900 leading-tight mb-1">{e.titulo}</h4>
                                                        {e.afectados && (
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <Users className="w-2.5 h-2.5 text-cyan-500" />
                                                                <span className="text-[9px] text-cyan-700 font-bold truncate tracking-tight">{e.afectados}</span>
                                                            </div>
                                                        )}
                                                        <p className="text-[9px] text-gray-400 font-bold line-clamp-2 italic leading-tight">{e.descripcion}</p>
                                                    </div>
                                                ))}

                                                <button
                                                    onClick={() => handleAddEvent(d.date)}
                                                    className="w-full aspect-[4/3] rounded-[2rem] border-2 border-dashed border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/30 flex flex-col items-center justify-center gap-2 transition-all group"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-cyan-100 transition-colors">
                                                        <Plus className="w-4 h-4 text-gray-400 group-hover:text-cyan-600" />
                                                    </div>
                                                    <span className="text-[9px] font-black text-gray-400 group-hover:text-cyan-600 uppercase tracking-widest">+ PROGRAMAR</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {editingSlot && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setEditingSlot(null)}></div>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xl relative p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
                        <div className="flex justify-between items-center"><h3 className="text-xl font-black">Gestionar Grupos ({editingSlot})</h3><button onClick={() => setEditingSlot(null)}><X /></button></div>
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 custom-scrollbar">
                            {assignments[editingSlot]?.map((s, i) => (
                                <div key={i} className="bg-gray-50 p-4 rounded-3xl flex flex-col gap-3 relative border border-gray-100 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 font-black">
                                            <span>{s.group.label}</span>
                                            <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded-full">{s.group.studentCount} est</span>
                                        </div>
                                        <button onClick={() => {
                                            setAssignments(prev => {
                                                const next = { ...prev };
                                                next[editingSlot].splice(i, 1);
                                                if (next[editingSlot].length === 0) delete next[editingSlot];
                                                return next;
                                            });
                                        }} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <input placeholder="Nota de ración o novedad..." value={s.notes || ''} onChange={e => {
                                        setAssignments(prev => {
                                            const next = { ...prev };
                                            next[editingSlot][i].notes = e.target.value;
                                            return next;
                                        });
                                    }} className="p-3 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none" />
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setEditingSlot(null)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Listos</button>
                    </div>
                </div>
            )}

            {showCalendar && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowCalendar(false)}></div>
                    <div className="relative animate-in zoom-in-95"><MiniCalendar selectedDate={selectedDate} onSelectDate={d => { setSelectedDate(d); setShowCalendar(false); }} className="shadow-2xl border-8 border-white rounded-[3rem]" /></div>
                </div>
            )}

            {showEventModal && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowEventModal(false)}></div>
                    <div className="bg-white rounded-[3rem] w-full max-w-lg relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="p-8 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black">{editingEvent ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                                    {eventDate ? formatDateLabel(eventDate) : 'Programación Escolar'}
                                </p>
                            </div>
                            <button onClick={() => setShowEventModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                            <CalendarIcon className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Título de la Actividad</label>
                                <input
                                    value={eventForm.titulo}
                                    onChange={e => setEventForm({ ...eventForm, titulo: e.target.value })}
                                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-900 focus:ring-2 focus:ring-cyan-500/20 focus:bg-white transition-all"
                                    placeholder="Ej: Izada de Bandera"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Hora (Opcional)</label>
                                    <input
                                        value={eventForm.hora}
                                        onChange={e => setEventForm({ ...eventForm, hora: e.target.value })}
                                        className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-900 focus:ring-2 focus:ring-cyan-500/20 focus:bg-white transition-all"
                                        placeholder="08:00 AM"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prioridad</label>
                                    <select
                                        value={eventForm.prioridad}
                                        onChange={e => setEventForm({ ...eventForm, prioridad: e.target.value })}
                                        className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-900 focus:ring-2 focus:ring-cyan-500/20 focus:bg-white transition-all appearance-none"
                                    >
                                        <option value="normal">Normal 😊</option>
                                        <option value="alta">Urgente ⚠️</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Participantes</label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        value={eventForm.afectados}
                                        onChange={e => setEventForm({ ...eventForm, afectados: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-900 focus:ring-2 focus:ring-cyan-500/20 focus:bg-white transition-all"
                                        placeholder="Ej: Grados 6° y 7°"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 pt-0 flex gap-4">
                            <button onClick={() => setShowEventModal(false)} className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-100 transition-all">
                                CANCELAR
                            </button>
                            <button onClick={handleSaveInstitutionalEvent} className="flex-[2] py-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-cyan-100 transition-all active:scale-[0.98]">
                                GUARDAR CAMBIOS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {notif && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[500] animate-in slide-in-from-top-4">
                    <div className={`px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 text-white font-black text-xs bg-gray-900 border border-white/20`}>
                        {notif.type === 'success' ? <Users size={18} className="text-emerald-400" /> : <AlertTriangle size={18} className="text-red-400" />}
                        {notif.msg.toUpperCase()}
                    </div>
                </div>
            )}

            {showConfirmSave && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowConfirmSave(false)}></div>
                    <div className="bg-white rounded-[3rem] p-10 max-w-sm relative text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500"><Info size={32} /></div>
                        <h3 className="text-xl font-black mb-2">Faltan Grupos</h3>
                        <p className="text-gray-400 text-sm mb-8">Hay {unassignedCount} grupos sin asignar. ¿Deseas guardar?</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={executeSave} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black">SÍ, GUARDAR</button>
                            <button onClick={() => setShowConfirmSave(false)} className="w-full py-4 bg-gray-50 rounded-2xl font-bold">CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}
            {showInstructions && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowInstructions(false)}></div>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-full">
                                    <Info className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Instrucciones</h3>
                            </div>
                            <button onClick={() => setShowInstructions(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                            {[
                                { n: 1, t: "Selecciona un Grupo:", d: "Toca un grupo disponible de la lista derecha. Se pondrá azul." },
                                { n: 2, t: "Asigna Hora:", d: "Toca una franja horaria en la izquierda para asignar el grupo seleccionado." },
                                { n: 3, t: "Editar/Desasignar:", d: "Toca una franja ya ocupada para ver detalles, agregar notas o eliminar la asignación." },
                                { n: 4, t: "Guardar:", d: "¡No olvides tocar el botón \"Guardar\" en la parte superior para aplicar los cambios!" }
                            ].map((step, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-lg shadow-blue-200">
                                        {step.n}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h4 className="font-black text-gray-900 text-sm">{step.t}</h4>
                                        <p className="text-[11px] font-bold text-gray-400 leading-relaxed">{step.d}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 pt-2">
                            <button
                                onClick={() => setShowInstructions(false)}
                                className="w-full py-5 bg-[#0a0a0b] hover:bg-black text-white rounded-2xl font-black text-sm tracking-widest transition-all shadow-xl active:scale-[0.98]"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
