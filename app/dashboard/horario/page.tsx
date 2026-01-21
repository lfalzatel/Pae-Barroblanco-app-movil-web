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
    }, [role, selectedDate]);

    const checkAccess = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push('/');
            return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const userRole = user?.user_metadata?.rol;
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

            // 1. Fetch Students/Groups
            const { data: estData, error: estError } = await supabase
                .from('estudiantes')
                .select('grupo')
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

            // 2. Fetch Current Schedule
            const { data: schedData } = await supabase
                .from('schedules')
                .select('items')
                .eq('date', selectedDate)
                .single();

            const currentAssignments: Record<string, AssignedSlot[]> = {};

            const absent: AssignedSlot[] = [];

            if (schedData?.items) {
                const absent: AssignedSlot[] = [];

                schedData.items.forEach((item: any) => {
                    const found = processed.find(g => g.label === item.group);
                    if (!found) return;

                    if (item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE') {
                        absent.push({
                            group: found,
                            notes: item.notes
                        });
                        return;
                    }

                    const start = item.time_start || (item.time ? item.time.split(' - ')[0] : null);

                    if (start && slots.includes(start)) {
                        if (!currentAssignments[start]) {
                            currentAssignments[start] = [];
                        }
                        currentAssignments[start].push({
                            group: found,
                            notes: item.notes
                        });
                    }
                });
                setAbsentGroups(absent);
            } else {
                setAbsentGroups([]);
            }

            // 3. Fetch Previous Week Schedule (7 days ago) for conflict detection
            const [y, m, d] = selectedDate.split('-').map(Number);
            const prevDateObj = new Date(y, m - 1, d);
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

            setAssignments(currentAssignments);
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

    const saveEdit = (groupIndex: number, newNote: string) => {
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

    const moveAssignment = (groupIndex: number, newTime: string) => {
        if (!editingSlot || newTime === editingSlot) return;

        setAssignments(prev => {
            const currentSlotGroups = [...(prev[editingSlot] || [])];
            const groupToMove = currentSlotGroups[groupIndex];

            // Remove from old slot
            currentSlotGroups.splice(groupIndex, 1);

            // Add to new slot
            const targetSlotGroups = [...(prev[newTime] || [])];
            targetSlotGroups.push(groupToMove);

            const next = { ...prev };

            // Cleanup old slot
            if (currentSlotGroups.length === 0) {
                delete next[editingSlot];
            } else {
                next[editingSlot] = currentSlotGroups;
            }

            // Update new slot
            next[newTime] = targetSlotGroups;

            return next;
        });

        // Close modal as context changed
        setEditingSlot(null);
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
        <div className="p-2 lg:p-6 max-w-7xl mx-auto pb-0 h-screen flex flex-col overflow-hidden bg-gray-50/50">
            {/* Header Area */}
            <div className="flex flex-col gap-4 mb-4 px-2 shrink-0">
                {/* Title Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-white rounded-full text-gray-500 shadow-sm border border-transparent hover:border-gray-200 transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl lg:text-3xl font-black text-gray-900 tracking-tight">Tablero de Horarios</h1>
                            <button
                                onClick={() => setShowInstructions(true)}
                                className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-full transition-all hover:scale-110 ring-2 ring-blue-300 animate-pulse shadow-sm"
                                title="Ver Instrucciones"
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Toolbar Container */}
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-2 mt-2 relative z-20">

                    {/* Calendar Trigger */}
                    <div className="relative">
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className="flex items-center gap-3 hover:bg-gray-50 px-3 py-2 rounded-xl transition-all group"
                        >
                            <div className="bg-blue-50 p-2 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                                <CalendarIcon className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-0.5">Editando</p>
                                <p className="text-sm font-black text-gray-900 leading-none">
                                    {selectedDate ? formatDateLabel(selectedDate) : <span className="animate-pulse">Calculando...</span>}
                                </p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showCalendar ? 'rotate-180' : ''}`} />
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

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-gray-400 hidden lg:inline-block text-right leading-tight">
                            Recuerda guardar<br />tus cambios
                        </span>
                        <button
                            onClick={handleSave}
                            disabled={saving || !Object.keys(assignments).length}
                            className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>Guardar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content - 2 Columns mobile friendly */}
            <div className="grid grid-cols-12 gap-2 lg:gap-6 flex-1 overflow-hidden pb-4 px-1">

                {/* Left: Timeline (Col 8 - Wider for text) */}
                <div className="col-span-8 bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
                    <div className="p-2 lg:p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex flex-col justify-between items-start shrink-0 gap-1">
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

                    <div className="flex-1 overflow-y-auto p-1 lg:p-3 custom-scrollbar bg-gray-50/30">
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
                                                <div className="space-y-1">
                                                    {slots.map((slot, idx) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-gray-50 p-1.5 rounded border border-gray-100/50">
                                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                                <div className="flex flex-col gap-0.5 py-0.5">
                                                                    <p className="font-bold text-gray-900 text-xs flex items-center gap-2">
                                                                        <span>{slot.group.label}</span>
                                                                        {slot.group.studentCount !== undefined && (
                                                                            <span className="text-[10px] font-normal text-gray-500 whitespace-nowrap">
                                                                                ({slot.group.studentCount} est)
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    {slot.notes && (
                                                                        <div className="flex items-center gap-1 text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 font-medium w-fit max-w-full">
                                                                            <FileText className="w-2.5 h-2.5 shrink-0" />
                                                                            <span className="break-words line-clamp-2 sm:line-clamp-none">{slot.notes}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Weekly Conflict Warning */}
                                                                {prevWeekAssignments[time]?.includes(slot.group.label) && (
                                                                    <div className="flex items-center gap-1 mt-0.5 animate-pulse shrink-0">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                                        <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">
                                                                            Mismo horario semana pasada
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center h-full">
                                                    <span className={`text-[8px] lg:text-[10px] font-medium italic ${isBreak ? 'text-amber-600/70' : 'text-gray-300'}`}>
                                                        {isBreak ? 'Descanso' : (selectedGroup ? 'Asignar' : 'Libre')}
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

                {/* Right: Groups (Col 4 - Narrower, Single Column List) */}
                <div className="col-span-4 bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
                    <div className="p-2 lg:p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-900 flex items-center gap-1 text-xs lg:text-base">
                            <Users className="w-4 h-4 text-blue-600" />
                            Grupos
                        </h3>
                        <div className="text-[10px] text-gray-400 font-bold">
                            {availableGroups.filter(g => !isAssigned(g)).length} rest
                        </div>
                    </div>

                </div>
            </div>

            {/* Extraordinary News Section */}
            <div className="shrink-0 p-2 lg:p-4 border-t border-gray-100 bg-white">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Novedades (No Asisten)
                    </h4>
                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">
                        {absentGroups.length} grupos
                    </span>
                </div>

                {selectedGroup && !isAssigned(selectedGroup) && (
                    <button
                        onClick={handleSetAbsent}
                        className="w-full mb-3 flex items-center justify-center gap-2 p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl border border-red-200 border-dashed transition-all group scale-95"
                    >
                        <span className="text-[10px] font-black uppercase">Marcar {selectedGroup.label} como No Asiste</span>
                    </button>
                )}

                <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                    {absentGroups.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic text-center py-2">
                            Ninguna novedad registrada para hoy
                        </p>
                    ) : (
                        absentGroups.map((a, idx) => (
                            <div key={idx} className="bg-red-50/50 p-2 rounded-xl border border-red-100/50">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-black text-red-700">{a.group.label}</span>
                                    <button onClick={() => removeAbsent(idx)} className="text-red-400 hover:text-red-600">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={a.notes}
                                    onChange={(e) => updateAbsentNote(idx, e.target.value)}
                                    className="w-full bg-white/80 border-none text-[10px] p-1.5 rounded-lg focus:ring-1 focus:ring-red-200 text-gray-600 font-medium"
                                    placeholder="Motivo..."
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
            </div >



        {/* Edit Modal */ }
    {
        editingSlot && (assignments[editingSlot]?.length || 0) > 0 && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingSlot(null)}></div>
                <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{editingSlot}</p>
                            <h3 className="text-xl font-black text-gray-900">Gestionar Grupos</h3>
                            <p className="text-sm text-gray-500">
                                {assignments[editingSlot]?.length} grupos asignados
                            </p>
                        </div>
                        <button onClick={() => setEditingSlot(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {assignments[editingSlot]?.map((slot, index) => (
                            <div key={`${slot.group.id}-${index}`} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-gray-900 bg-white px-2 py-1 rounded-lg border border-gray-200">
                                        {slot.group.label}
                                    </span>
                                    <button
                                        onClick={() => deleteAssignment(editingSlot!, index)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Nota</label>
                                        <input
                                            type="text"
                                            value={slot.notes || ''}
                                            onChange={(e) => saveEdit(index, e.target.value)}
                                            placeholder="Agregar nota..."
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Cambiar Hora</label>
                                        <select
                                            value={editingSlot || ''}
                                            onChange={(e) => moveAssignment(index, e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                                        >
                                            {timeSlots.map(t => (
                                                <option key={t} value={t}>{t} {isBreakTime(t) ? '(Descanso)' : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                        <button
                            onClick={() => setEditingSlot(null)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    {/* Instructions Modal */ }
    {
        showInstructions && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInstructions(false)}></div>
                <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 p-6 overflow-hidden">
                    <div className="p-4 bg-blue-50 -mx-6 -mt-6 mb-6 flex items-center justify-between">
                        <h3 className="font-black text-blue-900 text-lg flex items-center gap-2">
                            <Info className="w-5 h-5" />
                            Instrucciones
                        </h3>
                        <button onClick={() => setShowInstructions(false)} className="p-1 hover:bg-blue-100 rounded-full text-blue-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="space-y-4 text-sm text-gray-600">
                        <div className="flex gap-3">
                            <div className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                            <p><span className="font-bold text-gray-900">Selecciona un Grupo:</span> Toca un grupo disponible de la lista derecha. Se pondrá azul.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                            <p><span className="font-bold text-gray-900">Asigna Hora:</span> Toca una franja horaria en la izquierda para asignar el grupo seleccionado.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                            <p><span className="font-bold text-gray-900">Editar/Desasignar:</span> Toca una franja ya ocupada para ver detalles, agregar notas o eliminar la asignación.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0">4</div>
                            <p><span className="font-bold text-gray-900">Guardar:</span> ¡No olvides tocar el botón "Guardar" en la parte superior para aplicar los cambios!</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowInstructions(false)}
                        className="w-full mt-6 py-3 bg-gray-900 text-white rounded-xl font-bold"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        )
    }

    {/* Premium Confirmation Modal */ }
    {
        showConfirmSave && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowConfirmSave(false)}></div>
                <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 p-8 text-center flex flex-col gap-6">
                    <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto ring-4 ring-orange-100 animate-bounce">
                        <Info className="w-10 h-10 text-orange-500" />
                    </div>

                    <div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">¿Guardar de todos modos?</h3>
                        <p className="text-gray-500 text-sm leading-relaxed px-2">
                            Detectamos que hay <span className="text-orange-600 font-bold">{unassignedCount} grupo(s)</span> sin horario asignado para esta fecha.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={executeSave}
                            className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-black shadow-xl shadow-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Sí, guardar de todos modos
                        </button>
                        <button
                            onClick={() => setShowConfirmSave(false)}
                            className="w-full py-4 bg-white hover:bg-gray-50 text-gray-400 rounded-2xl font-bold border border-gray-100 transition-all"
                        >
                            Seguir editando
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    {/* Premium Toast Notification */ }
    {
        notif && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div className={`
                        px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border-2
                        ${notif.type === 'success'
                        ? 'bg-emerald-500/90 text-white border-white/20'
                        : 'bg-red-500/90 text-white border-white/20'}
                    `}>
                    <div className="bg-white/20 p-2 rounded-xl">
                        {notif.type === 'success' ? <Save className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-sm tracking-tight">{notif.msg}</span>
                        <span className="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-0.5">Sistema PAE Barroblanco</span>
                    </div>
                    <button onClick={() => setNotif(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }
        </div >
    );
}
