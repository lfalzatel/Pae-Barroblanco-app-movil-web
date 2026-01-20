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
    X,
    Edit2,
    Trash2,
    MoreVertical
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
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    });

    // Data State
    const [availableGroups, setAvailableGroups] = useState<GlobalGroup[]>([]);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [assignments, setAssignments] = useState<Record<string, AssignedSlot[]>>({});

    // Selection State
    const [selectedGroup, setSelectedGroup] = useState<GlobalGroup | null>(null);

    // Edit Modal State
    const [editingSlot, setEditingSlot] = useState<string | null>(null);
    const [editNote, setEditNote] = useState('');

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

            const { data: estData, error: estError } = await supabase
                .from('estudiantes')
                .select('grupo')
                .neq('grupo', null);

            if (estError) throw estError;

            const uniqueGroups = Array.from(new Set(estData?.map(e => e.grupo) || []));
            const processed = processGroups(uniqueGroups);

            const { data: schedData } = await supabase
                .from('schedules')
                .select('items')
                .eq('date', selectedDate)
                .single();

            const currentAssignments: Record<string, AssignedSlot[]> = {};

            if (schedData?.items) {
                schedData.items.forEach((item: any) => {
                    const found = processed.find(g => g.label === item.group);
                    const start = item.time_start || (item.time ? item.time.split(' - ')[0] : null);

                    if (found && start && slots.includes(start)) {
                        if (!currentAssignments[start]) {
                            currentAssignments[start] = [];
                        }
                        currentAssignments[start].push({
                            group: found,
                            notes: item.notes
                        });
                    }
                });
            }

            setAssignments(currentAssignments);
            setAvailableGroups(processed);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
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

            // Allow multiple assignments, so we don't clear selectedGroup immediately?
            // User UX: probably want to place same group in multiple slots? 
            // Or place multiple groups in same slot?
            // Let's keep selectedGroup active for rapid assignment to other slots?
            // The prompt says "Assign multiple groups per time slot".
            // If I click a slot with a group selected, I add it.
            // If I want to add another, I select another group and click the slot again.
            setSelectedGroup(null);
            return;
        }

        // Case 2: Clicking an existing slot to edit -> Open Modal
        if (existing.length > 0) {
            setEditingSlot(time);
            // setEditNote is complicated now because we have multiple groups
            // We'll handle edit notes inside the modal for each item
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
        // If empty, close modal?
        // Check new length in next render or just check assignments[time] in Modal
    };

    const isAssigned = (group: GlobalGroup) => {
        return Object.values(assignments).some(slots => slots?.some(s => s.group.id === group.id));
    };

    const handleSave = async () => {
        // Validation: Check for unassigned groups
        const unassignedCount = availableGroups.filter(g => !isAssigned(g)).length;
        if (unassignedCount > 0) {
            const confirmSave = confirm(`Hay ${unassignedCount} grupos sin asignar. ¿Deseas guardar de todos modos?`);
            if (!confirmSave) return;
        }

        setSaving(true);
        // ... existing save logic
    };

    // ...

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
                            {timeSlots.length} Franjas • {new Date(selectedDate || new Date()).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving || !Object.keys(assignments).length}
                        className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-gray-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none text-sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>Guardar</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">

                {/* Left: Timeline (Swapped, now 5 cols) */}
                <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden order-2 lg:order-1 h-full">
                    <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Línea de Tiempo
                        </h3>
                        {selectedGroup && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full animate-pulse font-bold truncate max-w-[120px]">
                                Asignando: {selectedGroup.label}
                            </span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar relative bg-gray-50/30">
                        <div className="space-y-2 pb-20">
                            {timeSlots.map((time) => {
                                const slots = assignments[time] || [];
                                const isBreak = isBreakTime(time);

                                return (
                                    <button
                                        key={time}
                                        onClick={() => handleSlotClick(time)}
                                        className={`
                                        relative w-full flex items-start gap-3 p-2 rounded-xl border transition-all duration-200 text-left group
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
                                         w-14 py-1 rounded-lg text-center text-[10px] font-bold font-mono shrink-0
                                         ${slots.length > 0 ? 'bg-emerald-100 text-emerald-700' : isBreak ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}
                                     `}>
                                            {time.split(' ')[0]}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {slots.length > 0 ? (
                                                <div className="space-y-1">
                                                    {slots.map((slot, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-1 bg-gray-50 p-1 rounded border border-gray-100">
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-gray-800 text-[10px] truncate leading-tight">{slot.group.label}</p>
                                                                {slot.notes && <p className="text-[9px] text-gray-400 truncate italic">{slot.notes}</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-end">
                                                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                                            <Edit2 className="w-2.5 h-2.5" /> ({slots.length})
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between h-full">
                                                    <span className={`text-[10px] font-medium italic ${isBreak ? 'text-amber-600/70 font-bold uppercase' : 'text-gray-300'}`}>
                                                        {isBreak ? 'Descanso' : (selectedGroup ? 'Asignar aquí' : 'Disponible')}
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

                {/* Right: Tools & Groups (Swapped, now 7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-6 order-1 lg:order-2 h-full overflow-hidden">

                    {/* Calendar Panel */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 shrink-0 flex flex-col md:flex-row gap-6 items-start">
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-purple-500" />
                                Calendario
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                                Selecciona un día para gestionar. Los días con punto verde ya tienen horario.
                            </p>
                            <div className="flex justify-center md:justify-start">
                                <MiniCalendar
                                    selectedDate={selectedDate}
                                    onSelectDate={setSelectedDate}
                                    className="border-none shadow-none p-0 w-full"
                                />
                            </div>
                        </div>

                        <div className="flex-1 w-full flex flex-col h-full min-h-[200px]">
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                Grupos Disponibles
                            </h3>
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                                <div className="flex flex-wrap gap-2 content-start">
                                    {availableGroups.filter(g => !isAssigned(g)).length === 0 && (
                                        <div className="w-full py-10 text-center text-gray-400">
                                            <p className="text-sm font-medium">¡Todo asignado esta fecha!</p>
                                        </div>
                                    )}

                                    {availableGroups.map((group) => {
                                        if (isAssigned(group)) return null;
                                        const isSelected = selectedGroup?.id === group.id;
                                        return (
                                            <button
                                                key={group.id}
                                                onClick={() => setSelectedGroup(isSelected ? null : group)}
                                                className={`
                                                px-3 py-2 rounded-lg text-xs font-bold border transition-all duration-200 flex items-center justify-between gap-2 text-left
                                                ${isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}
                                            `}
                                            >
                                                <span>{group.label}</span>
                                                {group.isCombo && <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded-full">+Sordos</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Edit Modal */}
            {editingSlot && (assignments[editingSlot]?.length || 0) > 0 && (
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
        </div >
    );
}
