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
    RefreshCcw,
    Check,
    X,
    AlertTriangle
} from 'lucide-react';
import { generateTimeSlots, processGroups, GlobalGroup } from '@/lib/schedule-utils';

interface AssignedSlot {
    time: string;
    groups: GlobalGroup[];
}

export default function HorarioPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [role, setRole] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Data State
    const [availableGroups, setAvailableGroups] = useState<GlobalGroup[]>([]);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [assignments, setAssignments] = useState<Record<string, GlobalGroup | null>>({}); // key: time, value: group

    // Selection State
    const [selectedGroup, setSelectedGroup] = useState<GlobalGroup | null>(null);

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
            // 1. Generate Slots
            const slots = generateTimeSlots(10); // 10 min interval
            setTimeSlots(slots);

            // 2. Fetch All Distinct Groups for Pool
            const { data: estData, error: estError } = await supabase
                .from('estudiantes')
                .select('grupo')
                .neq('grupo', null); // Filter nulls

            if (estError) throw estError;

            // Extract unique strings
            const uniqueGroups = Array.from(new Set(estData?.map(e => e.grupo) || []));
            const processed = processGroups(uniqueGroups);

            // 3. Fetch Existing Schedule
            const { data: schedData } = await supabase
                .from('schedules')
                .select('items')
                .eq('date', selectedDate)
                .single();

            const currentAssignments: Record<string, GlobalGroup | null> = {};

            // Fill assignments if exist
            if (schedData?.items) {
                schedData.items.forEach((item: any) => {
                    // Find valid group object
                    // Just matching label for now is simplistic but works if consistency is kept
                    const found = processed.find(g => g.label === item.group);
                    if (found && slots.includes(item.time_start)) { // assumes we save start time
                        currentAssignments[item.time_start] = found;
                    }
                    // Compatibility with old format (range string)
                    // If item.time is "07:10 AM - 07:20 AM"
                    else if (item.time) {
                        const start = item.time.split(' - ')[0];
                        if (slots.includes(start)) {
                            // Try to find group by label
                            const g = processed.find(pg => pg.label === item.group || pg.id === item.group);
                            if (g) currentAssignments[start] = g;
                        }
                    }
                });
            }

            setAssignments(currentAssignments);

            // Calculate remaining available groups
            // Actually we just filter them in render, but efficient to know
            setAvailableGroups(processed);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSlotClick = (time: string) => {
        const existing = assignments[time];

        // If we have a selected group to place
        if (selectedGroup) {
            if (existing) {
                // Replace? or Alert? Let's Swap/Replace
                setAssignments(prev => ({
                    ...prev,
                    [time]: selectedGroup
                }));
            } else {
                // Place
                setAssignments(prev => ({
                    ...prev,
                    [time]: selectedGroup
                }));
            }
            setSelectedGroup(null); // Deselect after placing
        }
        // If no group selected, but slot has one -> Remove it (or select it to move?)
        else if (existing) {
            setAssignments(prev => {
                const next = { ...prev };
                delete next[time];
                return next;
            });
            // Optional: Select it immediately to move it elsewhere
            setSelectedGroup(existing);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Convert assignments back to simple array
            const items = Object.entries(assignments).map(([time, group]) => {
                if (!group) return null;
                // Calculate end time (assuming 10 mins? or just interval)
                // For display purposes in future we use the slot logic
                // We'll save the "Range string" to be compatible with PDF generator

                // Re-calc end time manually for string
                // Parsing time again... simpler approach:
                // Find index in slots, take next one or add 10 mins.
                // But let's just save "HH:MM Start" to keep it clean, OR compatibility

                // COMPATIBILITY HACK:
                // user wants "start - end" string. 
                // We know interval is 10 mins.
                // This relies on `generateTimeSlots` logic implicitly.

                // Let's do a quick parser/adder
                const [timePart, ampm] = time.split(' ');
                let [h, m] = timePart.split(':').map(Number);
                if (ampm === 'PM' && h !== 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;

                const startDate = new Date();
                startDate.setHours(h, m, 0);

                const endDate = new Date(startDate.getTime() + 15 * 60000); // 15 mins eating time as per requirements!
                // Wait, flow says: entry 7:10, next entry 7:20.
                // Display for PDF? "7:10 AM - 7:25 AM"? 
                // Let's stick to "Entry Time" for clarity or "7:10 AM - 7:25 AM"

                const format = (d: Date) => {
                    let hh = d.getHours();
                    const mm = d.getMinutes();
                    const ap = hh >= 12 ? 'PM' : 'AM';
                    if (hh > 12) hh -= 12;
                    if (hh === 0) hh = 12;
                    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')} ${ap}`;
                };

                const timeStr = `${time} - ${format(endDate)}`;

                return {
                    time: timeStr,
                    time_start: time, // Keep raw start for restoring state
                    group: group.label,
                    notes: group.isCombo ? 'Grupo + Sordos' : 'Regular'
                };
            }).filter(Boolean);

            const { error } = await supabase
                .from('schedules')
                .upsert({
                    date: selectedDate,
                    items: items,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'date' });

            if (error) throw error;
            alert('Horario guardado correctamente');
        } catch (e) {
            console.error(e);
            alert('Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const isAssigned = (group: GlobalGroup) => {
        return Object.values(assignments).some(g => g?.id === group.id);
    };

    const getSlotStatusColor = (time: string) => {
        // Highlight breaks visually if we were showing them, but we skip them.
        // Maybe highlight "Peak Hours"?
        return "bg-white";
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ChevronLeft />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Tablero de Horarios</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                            {timeSlots.length} Franjas • Inicio 7:10 AM • Intervalos 10 min
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <CalendarIcon className="w-5 h-5 text-gray-400 ml-2" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent font-bold text-gray-700 focus:outline-none py-1"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">

                {/* Left: Group Pool */}
                <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            Grupos Disponibles
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Toca un grupo para seleccionarlo
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="flex flex-wrap gap-2 content-start">
                            {availableGroups.filter(g => !isAssigned(g)).length === 0 && (
                                <div className="w-full py-10 text-center text-gray-400">
                                    <Check className="w-12 h-12 mx-auto mb-2 text-emerald-200" />
                                    <p className="text-sm font-medium">¡Todos los grupos asignados!</p>
                                </div>
                            )}

                            {availableGroups.map((group) => {
                                if (isAssigned(group)) return null; // Hide assigned
                                const isSelected = selectedGroup?.id === group.id;
                                return (
                                    <button
                                        key={group.id}
                                        onClick={() => setSelectedGroup(isSelected ? null : group)}
                                        className={`
                                        px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200
                                        ${isSelected
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105 ring-2 ring-blue-200'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}
                                    `}
                                    >
                                        {group.label}
                                        {group.isCombo && <span className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full inline-block align-middle">SORDOS</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: Timeline */}
                <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Línea de Tiempo
                        </h3>
                        {selectedGroup && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full animate-pulse font-bold">
                                Seleccionando lugar para: {selectedGroup.label}
                            </span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
                        <div className="space-y-2 pb-20">
                            {timeSlots.map((time, idx) => {
                                const assigned = assignments[time];
                                const prevTime = idx > 0 ? timeSlots[idx - 1] : null;

                                // Detect gaps/breaks visually? 
                                // Logic: If delta > 10 mins, show separator
                                let showBreakSeparator = false;
                                if (prevTime) {
                                    // Simple string comparison or logic? 
                                    // Let's rely on the fact that `generateTimeSlots` skips break times.
                                    // If difference is large.
                                    // 7:10... 8:40. Next is 9:10.
                                    // "08:40 AM" vs "09:10 AM".
                                    const [h1, m1] = prevTime.split(/[: ]/);
                                    const [h2, m2] = time.split(/[: ]/); // very rough
                                    // Easier: Hardcode break display?
                                    if (time === "09:10 AM" || time === "09:10") showBreakSeparator = true;
                                }

                                return (
                                    <div key={time}>
                                        {showBreakSeparator && (
                                            <div className="flex items-center gap-4 py-2 opacity-50">
                                                <div className="h-px bg-gray-300 flex-1 border-dashed border-t" />
                                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Descanso (8:50 - 9:10)</span>
                                                <div className="h-px bg-gray-300 flex-1 border-dashed border-t" />
                                            </div>
                                        )}

                                        <button
                                            onClick={() => handleSlotClick(time)}
                                            className={`
                                            w-full flex items-center gap-4 p-3 rounded-2xl border transition-all duration-200 group relative
                                            ${assigned
                                                    ? 'bg-emerald-50 border-emerald-200 hover:bg-red-50 hover:border-red-200' // Hover red to indicate delete/remove
                                                    : 'bg-white border-gray-100 hover:border-blue-300 hover:bg-blue-50/50'}
                                            ${selectedGroup && !assigned ? 'ring-2 ring-blue-500/20 border-blue-500 bg-blue-50' : ''}
                                        `}
                                        >
                                            <div className="w-20 font-mono text-sm font-bold text-gray-500 flex-shrink-0 text-left">
                                                {time}
                                            </div>

                                            <div className="flex-1 flex items-center">
                                                {assigned ? (
                                                    <>
                                                        <span className="font-black text-gray-800 text-lg">{assigned.label}</span>
                                                        {assigned.isCombo && <span className="ml-3 text-[10px] font-bold bg-white border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md shadow-sm">INCLUYE SORDOS</span>}

                                                        {/* Hover Overlay for Remove */}
                                                        <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity">
                                                            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                                                                <X className="w-3 h-3" /> Quitar
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-gray-300 text-sm font-medium italic group-hover:text-blue-400 pointer-events-none">
                                                        {selectedGroup ? 'Toca aquí para asignar' : 'Disponible'}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Save Button */}
            <div className="fixed bottom-6 right-6 md:right-12 z-50">
                <button
                    onClick={handleSave}
                    disabled={saving || assignmentsLength(assignments) === 0}
                    className="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-bold shadow-2xl shadow-gray-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:transform-none"
                >
                    {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    <span>Guardar Horario ({assignmentsLength(assignments)})</span>
                </button>
            </div>
        </div>
    );
}

function assignmentsLength(obj: Record<string, any>) {
    return Object.values(obj).filter(Boolean).length;
}
