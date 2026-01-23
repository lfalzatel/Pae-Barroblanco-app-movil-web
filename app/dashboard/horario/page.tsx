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
    FileText
} from 'lucide-react';
import { generateTimeSlots, processGroups, GlobalGroup, isBreakTime } from '@/lib/schedule-utils';
import { MiniCalendar } from '@/components/ui/MiniCalendar';

interface AssignedSlot {
    group: GlobalGroup;
    notes?: string;
}

export default function HorarioPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [role, setRole] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

    // Initialize with "Smart Tomorrow" logic
    // If today is Friday/Saturday -> Default to Monday
    // Else -> Default to Tomorrow
    const getSmartDefaultDate = () => {
        const d = new Date();
        const day = d.getDay();
        if (day === 5) d.setDate(d.getDate() + 3); // Friday -> Monday
        else if (day === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
        else d.setDate(d.getDate() + 1); // Others -> Next Day
        return d;
    };

    const formatDateLabel = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
        const str = date.toLocaleDateString('es-CO', options);
        return str.charAt(0).toUpperCase() + str.slice(1).replace('.', '');
    };

    // State initialization (Default to Smart Tomorrow)
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        // Smart Default: Fri/Sat -> Mon, Else -> Tomorrow
        const d = new Date();
        const day = d.getDay();
        if (day === 5) d.setDate(d.getDate() + 3); // Fri -> Mon
        else if (day === 6) d.setDate(d.getDate() + 2); // Sat -> Mon
        else d.setDate(d.getDate() + 1); // Others -> Tomorrow

        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    });



    // Force refresh logic (kept from previous fix, good for data freshness)
    useEffect(() => {
        const handleFocus = () => {
            if (role) initData();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [role, selectedDate]);

    // Data State
    const [availableGroups, setAvailableGroups] = useState<GlobalGroup[]>([]);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [assignments, setAssignments] = useState<Record<string, AssignedSlot[]>>({});
    const [prevWeekAssignments, setPrevWeekAssignments] = useState<Record<string, string[]>>({});

    // Selection State
    const [selectedGroup, setSelectedGroup] = useState<GlobalGroup | null>(null);

    // Edit Modal State
    const [editingSlot, setEditingSlot] = useState<string | null>(null);
    const [editNote, setEditNote] = useState('');
    const [showCalendar, setShowCalendar] = useState(false);
    const [notif, setNotif] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [showConfirmSave, setShowConfirmSave] = useState(false);
    const [unassignedCount, setUnassignedCount] = useState(0);

    // Extraordinary News State
    const [absentGroups, setAbsentGroups] = useState<AssignedSlot[]>([]);
    const [weekData, setWeekData] = useState<any[]>([]);

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
        if (role) {
            initData();
        }
    }, [role, selectedDate, viewMode]);

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get('view') === 'weekly') {
            setViewMode('week');
        }
    }, []);

    const checkAccess = async () => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                console.error('Auth Error:', error);
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
        } catch (err) {
            router.push('/');
        }
    };

    const initData = async () => {
        setLoading(true);
        try {
            const slots = generateTimeSlots(10);
            setTimeSlots(slots);

            // 1. Fetch Students/Groups (Solo Activos)
            const { data: estData, error: estError } = await supabase
                .from('estudiantes')
                .select('grupo')
                .eq('estado', 'activo') // Change: Filtrar solo activos
                .neq('grupo', null);

            if (estError) throw estError;

            const counts: Record<string, number> = {};
            estData?.forEach(e => {
                if (e.grupo) counts[e.grupo] = (counts[e.grupo] || 0) + 1;
            });

            const uniqueGroups = Array.from(new Set(estData?.map(e => e.grupo) || []));
            const processed = processGroups(uniqueGroups).map(g => ({
                ...g,
                studentCount: counts[g.label] || 0
            }));

            // 2. Fetch Current Schedule (Day or Week)
            if (viewMode === 'day') {
                const { data: schedArray } = await supabase
                    .from('schedules')
                    .select('items')
                    .eq('date', selectedDate)
                    .limit(1);

                const schedData = schedArray?.[0];

                const currentAssignments: Record<string, AssignedSlot[]> = {};
                const absent: AssignedSlot[] = [];

                if (schedData?.items) {
                    schedData.items.forEach((item: any) => {
                        const found = processed.find(g => g.label === item.group);
                        if (!found) return;

                        if (item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE') {
                            absent.push({ group: found, notes: item.notes });
                            return;
                        }

                        const start = item.time_start || (item.time ? item.time.split(' - ')[0] : null);
                        if (start && slots.includes(start)) {
                            if (!currentAssignments[start]) currentAssignments[start] = [];
                            currentAssignments[start].push({ group: found, notes: item.notes });
                        }
                    });
                }
                setAssignments(currentAssignments);
                setAbsentGroups(absent);
            } else {
                // Fetch for the entire week (Mon-Fri) based on selectedDate
                const d = new Date(selectedDate + 'T12:00:00');
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(d.setDate(diff));

                const dates = [];
                for (let i = 0; i < 5; i++) {
                    const target = new Date(monday);
                    target.setDate(target.getDate() + i);
                    dates.push(target.toISOString().split('T')[0]);
                }

                const { data: weeklyScheds } = await supabase
                    .from('schedules')
                    .select('*')
                    .in('date', dates);

                const mappedWeek = dates.map(dateStr => {
                    const dayData = weeklyScheds?.find(s => s.date === dateStr);
                    return {
                        date: dateStr,
                        items: dayData?.items || []
                    };
                });
                setWeekData(mappedWeek);
            }

            // 3. Fetch Previous Week Schedule (7 days ago) for conflict detection (Always for selectedDate)
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
                    const start = item.time_start || (item.time ? item.time.split(' - ')[0] : null);
                    if (start) {
                        if (!prevAssignments[start]) prevAssignments[start] = [];
                        prevAssignments[start].push(item.group);
                    }
                });
            }

            setAvailableGroups(processed);
            setPrevWeekAssignments(prevAssignments);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSetAbsent = () => {
        if (!selectedGroup) return;

        // Prevent duplicates
        if (absentGroups.some(a => a.group.id === selectedGroup.id)) {
            alert('Este grupo ya está marcado como novedad.');
            return;
        }

        setAbsentGroups(prev => [...prev, { group: selectedGroup, notes: 'No asiste a clases / Novedad' }]);
        setSelectedGroup(null);
    };

    const updateAbsentNote = (index: number, note: string) => {
        setAbsentGroups(prev => {
            const next = [...prev];
            next[index] = { ...next[index], notes: note };
            return next;
        });
    };

    const removeAbsent = (index: number) => {
        setAbsentGroups(prev => {
            const next = [...prev];
            next.splice(index, 1);
            return next;
        });
    };

    const handleSlotClick = (time: string) => {
        const existing = assignments[time] || [];

        // Case 1: Placing a selected group
        if (selectedGroup) {
            // Prevent duplicates in same slot
            if (existing.some(slot => slot.group.id === selectedGroup.id)) {
                alert('Este grupo ya está asignado a esta franja.');
                return;
            }

            setAssignments(prev => ({
                ...prev,
                [time]: [...(prev[time] || []), { group: selectedGroup }]
            }));

            setSelectedGroup(null);
            return;
        }

        // Case 2: Clicking an existing slot to edit -> Open Modal
        if (existing.length > 0) {
            setEditingSlot(time);
        }
    };

    const handleSaveNote = (groupIndex: number, newNote: string) => {
        if (!editingSlot) return;
        setAssignments(prev => {
            const current = [...(prev[editingSlot] || [])];
            if (!current[groupIndex]) return prev;

            current[groupIndex] = { ...current[groupIndex], notes: newNote };

            return {
                ...prev,
                [editingSlot]: current
            };
        });
    };

    const isBreakTime = (time: string) => {
        const breakSlots = ["08:50 AM", "09:00 AM", "11:00 AM"];
        return breakSlots.includes(time);
    };

    const handleEditSlot = (time: string, groupLabel?: string, currentNote?: string) => {
        setEditingSlot(time);
        setEditNote(currentNote || '');
    };

    const handleRemoveAssignment = (time: string, groupLabel: string) => {
        setAssignments(prev => {
            const current = [...(prev[time] || [])];
            const filtered = current.filter(slot => slot.group.label !== groupLabel);

            const next = { ...prev };
            if (filtered.length === 0) {
                delete next[time];
            } else {
                next[time] = filtered;
            }
            return next;
        });
    };

    const deleteAssignment = (time: string, groupIndex: number) => {
        setAssignments(prev => {
            const current = [...(prev[time] || [])];
            current.splice(groupIndex, 1);

            const next = { ...prev };
            if (current.length === 0) {
                delete next[time];
            } else {
                next[time] = current;
            }
            return next;
        });
    };

    const isAssigned = (group: GlobalGroup) => {
        const inTimeline = Object.values(assignments).some(slots => slots?.some(s => s.group.id === group.id));
        const inAbsent = absentGroups.some(s => s.group.id === group.id);
        return inTimeline || inAbsent;
    };

    const handleSave = () => {
        // Validation: Check for unassigned groups
        const unassigned = availableGroups.filter(g => !isAssigned(g)).length;
        if (unassigned > 0) {
            setUnassignedCount(unassigned);
            setShowConfirmSave(true);
            return;
        }
        executeSave();
    };

    const executeSave = async () => {
        setShowConfirmSave(false);
        setSaving(true);
        try {
            // Transform assignments to storage format
            const itemsToSave: any[] = [];
            Object.entries(assignments).forEach(([time, slots]) => {
                slots.forEach(slot => {
                    itemsToSave.push({
                        time: time,
                        time_start: time,
                        group: slot.group.label,
                        notes: slot.notes || ''
                    });
                });
            });

            // Add absent groups
            absentGroups.forEach(slot => {
                itemsToSave.push({
                    time: 'NO_ASISTE',
                    time_start: 'NO_ASISTE',
                    group: slot.group.label,
                    notes: slot.notes || ''
                });
            });

            const { error } = await supabase
                .from('schedules')
                .upsert({
                    date: selectedDate,
                    items: itemsToSave,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'date' });

            if (error) throw error;

            setNotif({ type: 'success', msg: '¡Horario guardado con éxito!' });
        } catch (error) {
            console.error('Error saving schedule:', error);
            setNotif({ type: 'error', msg: 'Ocurrió un error al guardar.' });
        } finally {
            setSaving(false);
        }
    };

    const [showInstructions, setShowInstructions] = useState(false);

    return (
        <>
            <div className="p-2 lg:p-6 max-w-7xl mx-auto pb-0 h-screen flex flex-col overflow-hidden bg-gray-50/50">
                {/* Header Area */}
                <div className="flex flex-col gap-4 mb-4 px-2 shrink-0">
                    {/* Title Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/dashboard')} className="p-3 bg-white hover:bg-gray-50 rounded-full text-gray-400 shadow-sm border border-gray-100 transition-all">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl lg:text-3xl font-black text-gray-900 tracking-tight">Tablero de Horarios</h1>
                                <button
                                    onClick={() => setShowInstructions(true)}
                                    className="w-10 h-10 border-2 border-blue-200 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center hover:bg-blue-200 transition-all shadow-sm animate-pulse"
                                >
                                    <Info className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Toolbar Container */}
                    <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2 mt-1 relative z-20">

                        {/* ROW 1: Toggle & Actions */}
                        <div className="flex items-center justify-between gap-2">
                            {/* Left: View Toggle */}
                            <div className="bg-gray-100 p-1 rounded-xl flex items-center shrink-0">
                                <button
                                    onClick={() => setViewMode('day')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Día
                                </button>
                                <button
                                    onClick={() => setViewMode('week')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Semana
                                </button>
                            </div>

                            {/* Right: Actions (Save) */}
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-gray-300 hidden sm:inline-block text-right leading-tight max-w-[80px]">
                                    Cambios sin guardar
                                </span>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !Object.keys(assignments).length}
                                    className="bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg font-bold shadow-lg shadow-gray-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
                                >
                                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    <span className="text-xs tracking-wide">Guardar</span>
                                </button>
                            </div>
                        </div>

                        {/* ROW 2: Date Selector (Centered) OR Week Widget */}
                        <div className="w-full">
                            {/* Calendar Trigger - Show ONLY in Day Mode */}
                            {viewMode === 'day' && (
                                <div className="flex justify-center w-full">
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowCalendar(!showCalendar)}
                                            className="flex items-center gap-2 hover:bg-gray-50 px-4 py-1.5 rounded-xl transition-all group border border-transparent hover:border-gray-100"
                                        >
                                            <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors border border-blue-50">
                                                <CalendarIcon className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-[8px] text-gray-400 font-black uppercase tracking-[0.2em] leading-none mb-1">EDITANDO</p>
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-sm font-black text-[#0A0D14] leading-none">
                                                        {selectedDate ? formatDateLabel(selectedDate) : 'Cargando...'}
                                                    </p>
                                                    <ChevronDown className="w-3 h-3 text-gray-300" />
                                                </div>
                                            </div>
                                        </button>

                                        {/* Calendar Modal */}
                                        {showCalendar && (
                                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowCalendar(false)}>
                                                <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm animate-in zoom-in-95 duration-200">
                                                    <MiniCalendar
                                                        selectedDate={selectedDate}
                                                        onSelectDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
                                                        className="shadow-2xl border-2 border-white/20"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Week Widget - Show ONLY in Week Mode */}
                            {viewMode === 'week' && (
                                <div className="flex flex-col gap-3 max-w-3xl mx-auto">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <CalendarIcon className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs font-black text-gray-900 tracking-widest uppercase">CONSULTAR SEMANA</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Range Selector */}
                                        <div className="bg-white border border-gray-100 p-2 rounded-2xl flex items-center justify-between shadow-sm">
                                            <button
                                                onClick={() => {
                                                    const d = new Date(selectedDate);
                                                    d.setDate(d.getDate() - 7);
                                                    setSelectedDate(d.toISOString().split('T')[0]);
                                                }}
                                                className="p-2 hover:bg-gray-50 rounded-xl text-blue-600 transition-colors"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>

                                            <span className="text-xs font-black text-gray-900 uppercase tracking-widest">
                                                {(() => {
                                                    const d = new Date(selectedDate + 'T12:00:00');
                                                    const day = d.getDay();
                                                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                                    const start = new Date(d);
                                                    start.setDate(diff);
                                                    const end = new Date(start);
                                                    end.setDate(start.getDate() + 4); // Friday

                                                    const format = (date: Date) => date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase();
                                                    return `${format(start)} - ${format(end)}`;
                                                })()}
                                            </span>

                                            <button
                                                onClick={() => {
                                                    const d = new Date(selectedDate);
                                                    d.setDate(d.getDate() + 7);
                                                    setSelectedDate(d.toISOString().split('T')[0]);
                                                }}
                                                className="p-2 hover:bg-gray-50 rounded-xl text-blue-600 transition-colors"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Week Tabs (Lun-Vie) */}
                                        <div className="flex items-center gap-1 justify-between bg-white border border-gray-100 p-1.5 rounded-2xl shadow-sm">
                                            {(() => {
                                                const current = new Date(selectedDate ? selectedDate + 'T12:00:00' : new Date());
                                                const day = current.getDay();
                                                const startOfWeek = new Date(current);
                                                const dayOfWeek = startOfWeek.getDay();
                                                const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                                                startOfWeek.setDate(diff);

                                                const weekDays = [];
                                                for (let i = 0; i < 5; i++) { // Mon-Fri
                                                    const d = new Date(startOfWeek);
                                                    d.setDate(startOfWeek.getDate() + i);
                                                    weekDays.push(d);
                                                }

                                                return weekDays.map((dateObj, idx) => {
                                                    const dateStr = dateObj.toISOString().split('T')[0];
                                                    // In week view, we don't highlight specific day unless we want to indicate "today" or similar.
                                                    // But clicking them switches to day view.

                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                setSelectedDate(dateStr);
                                                                setViewMode('day');
                                                            }}
                                                            className="flex-1 py-2 rounded-xl text-center hover:bg-blue-50 transition-colors group"
                                                        >
                                                            <span className="text-[10px] font-black uppercase text-blue-600 group-hover:text-blue-700 block">
                                                                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dateObj.getDay()]}
                                                            </span>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content - 2 Columns mobile friendly */}
                {
                    viewMode === 'day' ? (
                        <div className="grid grid-cols-12 gap-2 lg:gap-6 flex-1 overflow-hidden pb-4 px-1 animate-in fade-in duration-300">
                            {/* Left: Timeline (Col 8 - Wider for text) */}
                            <div className="col-span-8 bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
                                <div className="p-2 lg:p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                                    <div className="flex justify-between items-center w-full">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-1 text-xs lg:text-base">
                                            <Clock className="w-4 h-4 text-orange-500" />
                                            <span className="hidden lg:inline">Línea de </span>Tiempo
                                        </h3>
                                        {selectedGroup && (
                                            <span className="text-[9px] lg:text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full animate-pulse font-bold truncate max-w-[80px] lg:max-w-[120px]">
                                                Asig: {selectedGroup.label}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-medium">
                                        Tip: Puedes asignar múltiples grupos en la misma hora
                                    </p>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 bg-[#F9FAFB] custom-scrollbar">
                                    <div className="space-y-1.5 lg:space-y-2 pb-20">
                                        {timeSlots.map((time) => {
                                            const slots = assignments[time] || [];
                                            const isBreak = isBreakTime(time);

                                            return (
                                                <button
                                                    key={time}
                                                    onClick={() => handleSlotClick(time)}
                                                    className={`
                                            relative w-full flex items-start gap-1 lg:gap-3 p-1.5 lg:p-2 rounded-lg lg:rounded-xl border transition-all duration-200 text-left group
                                            ${slots.length > 0
                                                            ? 'bg-white border-emerald-100 shadow-sm ring-1 ring-emerald-50'
                                                            : isBreak
                                                                ? 'bg-amber-50/50 border-amber-100'
                                                                : 'bg-white border-gray-100 hover:border-blue-300 hover:bg-blue-50/50'
                                                        }
                                            ${selectedGroup && slots.length === 0 ? 'ring-2 ring-blue-500/20 border-blue-500 bg-blue-50' : ''}
                                        `}
                                                >
                                                    <div className={`
                                             w-16 lg:w-20 py-1 rounded text-center text-[10px] lg:text-xs font-bold font-mono shrink-0 flex items-center justify-center
                                             ${slots.length > 0 ? 'bg-emerald-100 text-emerald-700' : isBreak ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}
                                         `}>
                                                        {time}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        {slots.length > 0 ? (
                                                            <div className="flex flex-col gap-1.5">
                                                                {slots.map((slot, idx) => (
                                                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-[6px] rounded-xl border border-gray-100 shadow-sm relative group/item">
                                                                        <div className="flex flex-col gap-0.5 min-w-0 w-full">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-black text-xs text-gray-900 leading-tight mb-1">{slot.group.label}</span>
                                                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md leading-none">({slot.group.studentCount || 0} est)</span>
                                                                            </div>
                                                                            {slot.notes && (
                                                                                <div className="inline-flex items-center gap-1 bg-[#FFFBEB] text-[#B45309] px-2 py-1 rounded-lg border border-amber-100 w-full max-w-full mt-1">
                                                                                    <FileText className="w-3 h-3 shrink-0" />
                                                                                    <span className="text-[10px] font-bold truncate">{slot.notes}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="h-4 lg:h-6 flex items-center">
                                                                <p className={`text-[10px] font-medium transition-colors ${selectedGroup ? 'text-blue-500 italic' : 'text-gray-300'}`}>
                                                                    {isBreak ? '☕ Espacio de descanso' : selectedGroup ? 'Toca para asignar grupo...' : 'Sin asignar'}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Sidebar (Col 4 - Groups & Absent) */}
                            <div className="col-span-4 flex flex-col gap-2 lg:gap-4 overflow-hidden h-full">
                                {/* Groups List - Allow shrinking but keep min height */}
                                <div className="shrink-1 flex-1 min-h-[150px] bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                                    {(() => {
                                        // Calculate filtered groups outside the render to use the count
                                        const filteredAvailableGroups = availableGroups.filter(group => {
                                            const isAssigned = Object.values(assignments).some(slots => slots.some(s => s.group.id === group.id));
                                            const isAbsent = absentGroups.some(a => a.group.id === group.id);
                                            return !isAssigned && !isAbsent;
                                        });

                                        return (
                                            <>
                                                <div className="flex flex-col gap-1 mb-2 px-1 pt-3">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="font-bold text-gray-900 flex items-center gap-1.5 text-[11px] uppercase tracking-tight">
                                                            <Users className="w-4 h-4 text-blue-600" />
                                                            Grupos
                                                        </h3>
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                                            {filteredAvailableGroups.length} <span className="text-[9px]">restantes</span>
                                                        </span>
                                                    </div>
                                                    <p className="text-[9px] text-gray-400 font-medium leading-none pl-0.5">
                                                        Selecciona para asignar
                                                    </p>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-2 lg:p-3 custom-scrollbar bg-gray-50/30 border-t border-gray-50">
                                                    <div className="grid grid-cols-1 gap-1.5 pb-2">
                                                        {filteredAvailableGroups.map((group) => {
                                                            const isSelected = selectedGroup?.id === group.id;
                                                            return (
                                                                <button
                                                                    key={group.id}
                                                                    onClick={() => setSelectedGroup(isSelected ? null : group)}
                                                                    className={`
                                                    flex flex-col p-3 rounded-xl border transition-all duration-200 text-left relative
                                                    ${isSelected
                                                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-[1.01] z-10'
                                                                            : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-md text-gray-900'
                                                                        }
                                                `}
                                                                >
                                                                    <span className={`text-xs font-black leading-none mb-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>{group.label}</span>
                                                                    <div className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold w-fit ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                                        {group.studentCount || 0} est
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Absent Groups Box - Fixed height or flex-none to ensure visibility */}
                                <div className="flex-none h-auto max-h-[40%] bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden shrink-0">
                                    <div className="p-4 bg-white border-b border-gray-100 flex flex-col gap-2 shrink-0">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-red-500 text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                                                    <Info className="w-4 h-4" />
                                                    NOVEDADES
                                                </h3>
                                                <div className="bg-red-50 px-2 py-0.5 rounded-full">
                                                    <span className="text-[10px] font-bold text-red-600">{absentGroups.length}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {selectedGroup && (
                                            <button
                                                onClick={handleSetAbsent}
                                                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 p-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm animate-in fade-in slide-in-from-top-2 whitespace-normal h-auto leading-tight text-center"
                                            >
                                                MARCAR {selectedGroup.label} COMO NO ASISTE
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 lg:p-4 custom-scrollbar">
                                        {absentGroups.length > 0 ? (
                                            <div className="space-y-2">
                                                {absentGroups.map((entry, idx) => (
                                                    <div key={idx} className="group relative flex items-start gap-3 bg-red-50/50 p-3 rounded-xl border border-red-100">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-red-700 text-[11px] mb-0.5">{entry.group.label}</p>
                                                            <p className="text-[10px] text-red-400 font-medium leading-tight">{entry.notes}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setAbsentGroups(prev => prev.filter(a => a.group.id !== entry.group.id))}
                                                            className="p-1 hover:bg-white rounded-lg text-red-500 transition-all shadow-sm border border-red-50"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                                <Info className="w-6 h-6 lg:w-8 lg:h-8 text-gray-200 mb-2" />
                                                <p className="text-[10px] lg:text-xs text-gray-400 font-medium leading-relaxed">
                                                    No hay grupos con novedades reportadas
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-hidden pb-4 px-1 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 h-full overflow-y-auto custom-scrollbar pb-20">
                                {weekData.map((day, idx) => (
                                    <div key={idx} className="flex flex-col gap-3 min-w-[200px]">
                                        <div className={`
                                        p-3 rounded-2xl text-center sticky top-0 z-10 transition-all
                                        ${new Date(day.date + 'T12:00:00').toDateString() === new Date().toDateString()
                                                ? 'bg-blue-600 shadow-md shadow-blue-200'
                                                : 'bg-transparent hover:bg-white/50'
                                            }
                                    `}>
                                            <p className={`
                                            text-sm font-black mb-0.5 capitalize
                                            ${new Date(day.date + 'T12:00:00').toDateString() === new Date().toDateString()
                                                    ? 'text-white'
                                                    : 'text-gray-400'
                                                }
                                        `}>
                                                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(day.date + 'T12:00:00').getDay()]}
                                            </p>
                                            {/* Remove separate numeric date if "Tab" style usually implies just the name, OR keep it subtle. 
                                            Given the user wants "Tabs" like the image which often just has "Lun", "Mar", but for a calendar we usually need the number. 
                                            I'll keep the number but style it to match.
                                        */}
                                            {/* OPTIONAL: If the user strictly wants JUST the day name like the image "Lun", "Mar", I might hide the number? 
                                            But for a schedule the specific date is important. I will keep it but integrated.
                                         */}
                                            {/* Actually the image description was "Lun Mar Mié...". Let's enable the date number but make it small/integrated, or hide it if it looks cluttered. 
                                             Let's keep it for now as it's a schedule app. 
                                         */}
                                            <p className={`
                                            text-[10px] font-bold leading-none
                                            ${new Date(day.date + 'T12:00:00').toDateString() === new Date().toDateString()
                                                    ? 'text-blue-100'
                                                    : 'text-gray-300'
                                                }
                                        `}>
                                                {new Date(day.date + 'T12:00:00').getDate()}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            {day.items.length > 0 ? (
                                                day.items.map((item: any, i: number) => (
                                                    <div key={i} className={`p-3 rounded-xl border text-[10px] shadow-sm bg-white ${item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE' ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-black text-gray-900 tracking-tight">{item.group}</span>
                                                            <span className={`px-1.5 py-0.5 rounded-md font-bold ${(item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE') ? 'bg-red-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                                                {(item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE') ? 'X' : (item.time?.split(' - ')[0] || item.time_start)}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-500 font-medium italic line-clamp-1">
                                                            {item.notes || 'Sin notas'}
                                                        </p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="h-32 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 text-gray-300 gap-2">
                                                    <Clock className="w-6 h-6 opacity-20" />
                                                    <span className="text-[10px] uppercase font-bold tracking-widest">Sin asignar</span>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setSelectedDate(day.date);
                                                    setViewMode('day');
                                                }}
                                                className="w-full py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors"
                                            >
                                                Gestionar Día
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }


                {/* Modals and Notifications */}
                {
                    editingSlot && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingSlot(null)}></div>
                            <div className="bg-white rounded-3xl w-full max-w-xl relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                                <div className="p-5 bg-white flex items-center justify-between border-b border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-50 p-2 rounded-xl">
                                            <Clock className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900 text-xl tracking-tight leading-none">Gestionar Grupos</h3>
                                            <p className="text-xs font-bold text-gray-400 mt-1">{assignments[editingSlot]?.length || 0} asignados en {editingSlot}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setEditingSlot(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                                <div className="p-5 space-y-3 bg-gray-50/50">
                                    <div className="space-y-3 max-h-[50vh] overflow-y-auto px-1 custom-scrollbar">
                                        {assignments[editingSlot]?.map((item, idx) => (
                                            <div key={idx} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm relative group flex gap-4 items-start">
                                                {/* Group Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-gray-900 text-lg">{item.group.label}</span>
                                                            <span className="px-2 py-0.5 bg-gray-100 rounded-md text-[10px] font-bold text-gray-500">{item.group.studentCount} est</span>
                                                        </div>
                                                        <button
                                                            onClick={() => deleteAssignment(editingSlot!, idx)}
                                                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">NOTA</label>
                                                            <input
                                                                type="text"
                                                                value={item.notes || ''}
                                                                onChange={(e) => handleSaveNote(idx, e.target.value)}
                                                                className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none bg-white font-medium text-gray-700 placeholder-gray-300"
                                                                placeholder="Sin notas..."
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">HORA</label>
                                                            <div className="relative">
                                                                <select
                                                                    className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                                                                    defaultValue={editingSlot}
                                                                    onChange={(e) => {
                                                                        const newTime = e.target.value;
                                                                        if (newTime === editingSlot) return;
                                                                        setAssignments(prev => {
                                                                            const next = { ...prev };
                                                                            const currentGroups = [...(next[editingSlot] || [])];
                                                                            const movingGroup = currentGroups.splice(idx, 1)[0];
                                                                            if (currentGroups.length === 0) delete next[editingSlot];
                                                                            else next[editingSlot] = currentGroups;
                                                                            if (!next[newTime]) next[newTime] = [];
                                                                            next[newTime].push(movingGroup);
                                                                            return next;
                                                                        });
                                                                        setEditingSlot(newTime);
                                                                    }}
                                                                >
                                                                    {timeSlots.map(t => (
                                                                        <option key={t} value={t}>{t}</option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-5 bg-white border-t border-gray-100 flex justify-end">
                                    <button
                                        onClick={() => setEditingSlot(null)}
                                        className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-black transition-all active:scale-[0.98] text-sm tracking-wide"
                                    >
                                        Listo, Guardar Cambios
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Save Confirmation Modal */}
                {
                    showConfirmSave && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmSave(false)}></div>
                            <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                                <div className="p-8 text-center">
                                    <div className="bg-amber-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                                        <Info className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 mb-2">Grupos sin Asignar</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed mb-8">
                                        Hay <span className="font-bold text-gray-900">{unassignedCount} grupos</span> que aún no tienen horario asignado. ¿Deseas guardar el horario de todas formas?
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={executeSave}
                                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-all active:scale-[0.98]"
                                        >
                                            Sí, Guardar como esté
                                        </button>
                                        <button
                                            onClick={() => setShowConfirmSave(false)}
                                            className="w-full py-4 bg-white text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all border border-gray-100"
                                        >
                                            No, seguir editando
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Instructions Drawer/Modal */}
                {
                    showInstructions && (
                        <div className="fixed inset-0 z-[120] flex items-end lg:items-center justify-center">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInstructions(false)}></div>
                            <div className="bg-white rounded-[32px] w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col">
                                <div className="p-6 bg-white flex items-center justify-between border-b border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 rounded-xl">
                                            <Info className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Instrucciones</h3>
                                    </div>
                                    <button onClick={() => setShowInstructions(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X className="w-6 h-6 text-blue-600" />
                                    </button>
                                </div>

                                <div className="p-8 space-y-8">
                                    <div className="space-y-6">
                                        <div className="flex gap-5">
                                            <div className="bg-blue-600 text-white w-9 h-9 rounded-full flex items-center justify-center font-black shrink-0 text-sm shadow-lg shadow-blue-200">1</div>
                                            <div className="pt-1">
                                                <h4 className="font-black text-gray-900 text-base mb-1 tracking-tight">Selecciona un Grupo:</h4>
                                                <p className="text-sm text-gray-500 font-medium leading-relaxed">Toca un grupo disponible de la lista derecha. Se pondrá azul.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-5">
                                            <div className="bg-blue-600 text-white w-9 h-9 rounded-full flex items-center justify-center font-black shrink-0 text-sm shadow-lg shadow-blue-200">2</div>
                                            <div className="pt-1">
                                                <h4 className="font-black text-gray-900 text-base mb-1 tracking-tight">Asigna Hora:</h4>
                                                <p className="text-sm text-gray-500 font-medium leading-relaxed">Toca una franja horaria en la izquierda para asignar el grupo seleccionado.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-5">
                                            <div className="bg-blue-600 text-white w-9 h-9 rounded-full flex items-center justify-center font-black shrink-0 text-sm shadow-lg shadow-blue-200">3</div>
                                            <div className="pt-1">
                                                <h4 className="font-black text-gray-900 text-base mb-1 tracking-tight">Editar/Desasignar:</h4>
                                                <p className="text-sm text-gray-500 font-medium leading-relaxed">Toca una franja ya ocupada para ver detalles, agregar notas o eliminar la asignación.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-5">
                                            <div className="bg-blue-600 text-white w-9 h-9 rounded-full flex items-center justify-center font-black shrink-0 text-sm shadow-lg shadow-blue-200">4</div>
                                            <div className="pt-1">
                                                <h4 className="font-black text-gray-900 text-base mb-1 tracking-tight">Guardar:</h4>
                                                <p className="text-sm text-gray-500 font-medium leading-relaxed">¡No olvides tocar el botón "Guardar" en la parte superior para aplicar los cambios!</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-8 pb-8 pt-2">
                                    <button
                                        onClick={() => setShowInstructions(false)}
                                        className="w-full py-4 bg-[#0A0D14] text-white rounded-[20px] font-black shadow-xl hover:bg-black transition-all active:scale-[0.98] tracking-wide"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Success/Error Notification Overlay */}
                {
                    notif && (
                        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
                            <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${notif.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-red-500/90 text-white border-red-400'}`}>
                                {notif.type === 'success' ? <Users className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                                <span className="font-bold text-sm">{notif.msg}</span>
                            </div>
                        </div>
                    )
                }

            </div >
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </>
    );
}


