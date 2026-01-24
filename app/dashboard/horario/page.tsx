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
        const d = new Date();
        const day = d.getDay();
        if (day === 5) d.setDate(d.getDate() + 3);
        else if (day === 6) d.setDate(d.getDate() + 2);
        else d.setDate(d.getDate() + 1);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
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
    }, [role, selectedDate, viewMode]);

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
                label: g,
                studentCount: counts[g] || 0,
                sede: groupSedeMap[g] || 'Principal',
                isCombo: false
            }));
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
                        const found = processed.find(g => g.label === item.group);
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
                const { data: dailyEvents } = await supabase
                    .from('novedades_institucionales')
                    .select('*')
                    .eq('fecha', selectedDate)
                    .order('hora', { ascending: true });
                setDailyInstEvents(dailyEvents || []);

                // Fetch Previous Week for Conflict Detection
                const [y, m, d_num] = selectedDate.split('-').map(Number);
                const prevDateObj = new Date(y, m - 1, d_num);
                prevDateObj.setDate(prevDateObj.getDate() - 7);
                const prevDateStr = prevDateObj.toISOString().split('T')[0];

                const { data: prevSchedData } = await supabase
                    .from('schedules')
                    .select('items')
                    .eq('date', prevDateStr)
                    .single();

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

                const { data: events } = await supabase
                    .from('novedades_institucionales')
                    .select('*')
                    .in('fecha', dates)
                    .order('hora', { ascending: true });
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
                slots.forEach(s => items.push({ time, time_start: time, group: s.group.label, notes: s.notes || '' }));
            });
            absentGroups.forEach(a => items.push({ time: 'NO_ASISTE', time_start: 'NO_ASISTE', group: a.group.label, notes: a.notes || '' }));

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
        if (date) setSelectedDate(date);
        setShowEventModal(true);
    };

    const handleEditEvent = (event: any) => {
        setEditingEvent(event);
        setEventForm({ titulo: event.titulo, hora: event.hora || '', afectados: event.afectados || '', descripcion: event.descripcion || '', prioridad: event.prioridad || 'normal' });
        setShowEventModal(true);
    };

    const handleSaveInstitutionalEvent = async () => {
        if (!eventForm.titulo) return;
        setSaving(true);
        const data = { ...eventForm, fecha: editingEvent?.fecha || selectedDate };
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

    const isAssigned = (g: GlobalGroup) => Object.values(assignments).some(slots => slots.some(s => s.group.label === g.label)) || absentGroups.some(a => a.group.label === g.label);

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
                .pulse-dark-button {
                    animation: pulse-dark 2s infinite;
                }
            `}</style>

            <div className="p-1 lg:p-6 max-w-7xl mx-auto h-screen flex flex-col overflow-hidden bg-gray-50/50">

                {/* Fixed Title Header (Restored) */}
                <div className="flex items-center justify-between px-4 mb-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard')} className="p-3 bg-white hover:bg-gray-50 rounded-full text-gray-400 shadow-sm border border-gray-100 transition-all active:scale-95">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl lg:text-3xl font-black text-gray-900 tracking-tight">Tablero de Horarios</h1>
                        <button
                            onClick={() => setShowInstructions(true)}
                            className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-100 transition-all pulse-dark-button shadow-sm outline-none border-none"
                        >
                            <Info className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Fixed Header Toolbar */}
                <div className="flex flex-col gap-2 mb-2 px-1 shrink-0">
                    <div className="bg-white p-2 lg:p-3 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between gap-2 overflow-hidden">
                        <div className="flex items-center gap-1 lg:gap-2">
                            <div className="bg-gray-100/80 p-1 rounded-2xl flex items-center shrink-0">
                                <button
                                    onClick={() => setViewMode('day')}
                                    className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                                >
                                    Día
                                </button>
                                <button
                                    onClick={() => setViewMode('week')}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                                >
                                    Semana
                                </button>
                            </div>

                            <div className="relative shrink-0">
                                <select
                                    value={selectedSede}
                                    onChange={e => setSelectedSede(e.target.value)}
                                    className="appearance-none bg-blue-50/50 pl-3 pr-8 py-2 rounded-full text-[11px] font-bold text-blue-700 border border-blue-100/50 outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="Principal">Principal</option>
                                    <option value="Primaria">Primaria</option>
                                    <option value="Maria Inmaculada">M. Inmaculada</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 pointer-events-none" />
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-gray-700 hover:bg-black text-white px-4 py-2 rounded-xl font-black text-[11px] flex items-center gap-2 shadow-lg shadow-gray-200 transition-all shrink-0"
                        >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Guardar
                        </button>
                    </div>

                    <div className="flex justify-center -mt-1 scale-95 lg:scale-100">
                        <button
                            onClick={() => setShowCalendar(true)}
                            className="flex items-center gap-2 bg-white/50 hover:bg-white px-4 py-2 rounded-2xl border border-transparent hover:border-gray-100 transition-all group"
                        >
                            <div className="bg-blue-100 p-1.5 rounded-xl text-blue-600">
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">EDITANDO</p>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-black text-gray-900 leading-none">{formatDateLabel(selectedDate)}</span>
                                    <ChevronDown className="w-3 h-3 text-gray-300" />
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {viewMode === 'day' ? (
                    <div className="grid grid-cols-12 gap-2 flex-1 overflow-hidden pb-4 px-1 animate-in fade-in duration-300">
                        {/* Left: Timeline (Col 8) */}
                        <div className="col-span-8 bg-white rounded-[2rem] shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
                            <div className="p-3 lg:p-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-xs lg:text-base">
                                    <Clock className="w-4 h-4 text-orange-500" />
                                    <span>Tiempo</span>
                                    {selectedGroup && (
                                        <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                            Asig: {selectedGroup.label}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-[8px] lg:text-[9px] text-gray-400 font-bold leading-tight text-right w-32 lg:w-48 whitespace-normal opacity-70">
                                    Tip: Puedes asignar múltiples grupos en la misma hora
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
                                                                        <span className="font-black text-gray-900 text-[11px]">{s.group.label}</span>
                                                                        <span className="text-[10px] text-gray-400 font-bold">({s.group.studentCount} est)</span>
                                                                    </div>

                                                                    {s.notes && (
                                                                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-1.5 flex items-center gap-1.5 shadow-sm">
                                                                            <FileText className="w-3 h-3 text-amber-500" />
                                                                            <span className="text-[9px] font-bold text-amber-700 leading-tight">{s.notes}</span>
                                                                        </div>
                                                                    )}

                                                                    {prevWeekAssignments[time]?.includes(s.group.label) && (
                                                                        <div className="bg-red-50 border border-red-100 rounded-lg p-1.5 flex items-center gap-1.5 shadow-sm">
                                                                            <AlertTriangle className="w-3 h-3 text-red-500" />
                                                                            <span className="text-[9px] font-black text-red-600 leading-tight">Ya fue asignado aquí la semana pasada</span>
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
                                        <Users className="w-4 h-4 text-blue-600" />
                                        <h3 className="text-[10px] font-black text-gray-900 uppercase">Grupos</h3>
                                        <span className="text-[10px] font-black text-gray-300 ml-1">
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
                                                    ${selectedGroup?.id === g.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105 z-10' : 'bg-white border-gray-100 hover:border-blue-200'}
                                                `}
                                            >
                                                <div className="font-black text-[10px] lg:text-xs truncate">{g.label}</div>
                                                <div className={`text-[8px] font-bold ${selectedGroup?.id === g.id ? 'text-blue-200' : 'text-gray-400'}`}>{g.studentCount} est</div>
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
                        <div className="flex justify-between items-center mb-3 px-4 bg-white p-3 rounded-3xl border border-gray-100 shadow-sm">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 tracking-tight">Agenda Institucional</h2>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Actividades Semanales</p>
                            </div>
                            <button
                                onClick={() => handleAddEvent()}
                                className="bg-cyan-600 text-white px-4 py-2 rounded-xl font-black text-[10px] shadow-lg flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                PROGRAMAR
                            </button>
                        </div>

                        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                            <div className="flex gap-3 h-full min-w-max px-2">
                                {weekData.map((d, i) => {
                                    const events = instEvents.filter(e => e.fecha === d.date);
                                    const dateObj = new Date(d.date + 'T12:00:00');
                                    const isToday = dateObj.toDateString() === new Date().toDateString();

                                    return (
                                        <div key={i} className="w-64 flex flex-col gap-3">
                                            <div className={`p-4 rounded-[2rem] text-center shadow-sm border transition-all ${isToday ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-white border-gray-100'}`}>
                                                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isToday ? 'text-white/70' : 'text-cyan-600'}`}>
                                                    {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][dateObj.getDay()]}
                                                </p>
                                                <p className="text-xl font-black">{dateObj.getDate()}</p>
                                            </div>

                                            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pb-10">
                                                {events.map((e, ei) => (
                                                    <div key={ei} className="p-4 rounded-[2rem] border border-gray-100 bg-white shadow-sm relative group/card">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 uppercase tracking-widest">
                                                                {e.hora || 'S/H'}
                                                            </span>
                                                            <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                                <button onClick={() => handleEditEvent(e)}><Edit2 className="w-3 h-3 text-gray-300" /></button>
                                                                <button onClick={() => handleDeleteInstitutionalEvent(e.id)}><Trash2 className="w-3 h-3 text-gray-300" /></button>
                                                            </div>
                                                        </div>
                                                        <h4 className="font-black text-gray-900 text-xs mb-1 leading-tight">{e.titulo}</h4>
                                                        {e.afectados && <p className="text-[8px] font-bold text-gray-400 truncate uppercase">{e.afectados}</p>}
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => handleAddEvent(d.date)}
                                                    className="w-full h-24 border-2 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center text-gray-300 hover:border-cyan-200 hover:text-cyan-600 transition-all font-black text-[9px] uppercase"
                                                >
                                                    <Plus className="w-6 h-6 mb-1" />
                                                    Programar
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
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowEventModal(false)}></div>
                    <div className="bg-white rounded-[3rem] w-full max-w-lg relative overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className="p-8 bg-cyan-600 text-white flex justify-between items-center"><h3 className="text-xl font-black">Actividad Institucional</h3><button onClick={() => setShowEventModal(false)}><X /></button></div>
                        <div className="p-8 space-y-4">
                            <input value={eventForm.titulo} onChange={e => setEventForm({ ...eventForm, titulo: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-sm" placeholder="Título" />
                            <div className="grid grid-cols-2 gap-4">
                                <input value={eventForm.hora} onChange={e => setEventForm({ ...eventForm, hora: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-sm" placeholder="Hora" />
                                <select value={eventForm.prioridad} onChange={e => setEventForm({ ...eventForm, prioridad: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-sm"><option value="normal">Normal</option><option value="alta">Urgente</option></select>
                            </div>
                            <input value={eventForm.afectados} onChange={e => setEventForm({ ...eventForm, afectados: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-sm" placeholder="Afectados" />
                        </div>
                        <div className="p-8 pt-0 flex gap-4"><button onClick={() => setShowEventModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl text-[10px] font-black">CANCELAR</button><button onClick={handleSaveInstitutionalEvent} className="flex-1 py-4 bg-cyan-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-cyan-100">GUARDAR</button></div>
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
