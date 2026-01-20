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
import { generateTimeSlots, processGroups, GlobalGroup } from '@/lib/schedule-utils';

interface AssignedSlot {
    group: GlobalGroup;
    notes?: string;
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
    const [assignments, setAssignments] = useState<Record<string, AssignedSlot | null>>({});

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

            const currentAssignments: Record<string, AssignedSlot | null> = {};

            if (schedData?.items) {
                schedData.items.forEach((item: any) => {
                    const found = processed.find(g => g.label === item.group);
                    const start = item.time_start || (item.time ? item.time.split(' - ')[0] : null);

                    if (found && start && slots.includes(start)) {
                        currentAssignments[start] = {
                            group: found,
                            notes: item.notes
                        };
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
        const existing = assignments[time];

        // Case 1: Placing a selected group
        if (selectedGroup) {
            setAssignments(prev => ({
                ...prev,
                [time]: { group: selectedGroup, notes: selectedGroup.isCombo ? 'Combo con Sordos' : 'Regular' }
            }));
            setSelectedGroup(null); // Deselect after placing
            return;
        }

        // Case 2: Clicking an existing slot to edit -> Open Modal
        if (existing) {
            setEditingSlot(time);
            setEditNote(existing.notes || '');
        }
    };

    const saveEdit = () => {
        if (!editingSlot) return;
        setAssignments(prev => {
            const current = prev[editingSlot];
            if (!current) return prev;
            return {
                ...prev,
                [editingSlot]: { ...current, notes: editNote }
            };
        });
        setEditingSlot(null);
    };

    const deleteAssignment = (time: string) => {
        setAssignments(prev => {
            const next = { ...prev };
            delete next[time];
            return next;
        });
        setEditingSlot(null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const items = Object.entries(assignments).map(([time, slot]) => {
                if (!slot) return null;

                const [timePart, ampm] = time.split(' ');
                let [h, m] = timePart.split(':').map(Number);
                if (ampm === 'PM' && h !== 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;

                const startDate = new Date();
                startDate.setHours(h, m, 0);

                const endDate = new Date(startDate.getTime() + 15 * 60000);

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
                    time_start: time,
                    group: slot.group.label,
                    notes: slot.notes || (slot.group.isCombo ? 'Combo' : '')
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
        return Object.values(assignments).some(slot => slot?.group.id === group.id);
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
                            {timeSlots.length} Franjas • 2 Columnas
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
                <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden order-2 lg:order-1">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            Grupos
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="flex flex-wrap gap-2 content-start">
                            {availableGroups.filter(g => !isAssigned(g)).length === 0 && (
                                <div className="w-full py-10 text-center text-gray-400">
                                    <p className="text-sm font-medium">¡Todo asignado!</p>
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
                                        w-full px-4 py-3 rounded-xl text-sm font-bold border transition-all duration-200 flex justify-between items-center
                                        ${isSelected
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}
                                    `}
                                    >
                                        <span>{group.label}</span>
                                        {group.isCombo && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">+Sordos</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: Timeline (2 Cols) */}
                <div className="lg:col-span-9 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden order-1 lg:order-2">
                    <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Línea de Tiempo
                        </h3>
                        {selectedGroup && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full animate-pulse font-bold">
                                Asignando: {selectedGroup.label}
                            </span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative bg-gray-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 pb-20">
                            {timeSlots.map((time) => {
                                const assignment = assignments[time];
                                // Check if this time slot represents a break point visually?
                                // 8:50 is break start. 8:40 is last slot.
                                // if time > "08:40 AM" && time < "11:00 AM". Simple index check might be better but grid flows well.

                                return (
                                    <button
                                        key={time}
                                        onClick={() => handleSlotClick(time)}
                                        className={`
                                        relative w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 text-left group
                                        ${assignment
                                                ? 'bg-white border-emerald-100 shadow-sm ring-1 ring-emerald-50 hover:shadow-md'
                                                : 'bg-white border-gray-100 hover:border-blue-300 hover:bg-blue-50/50'}
                                        ${selectedGroup && !assignment ? 'ring-2 ring-blue-500/20 border-blue-500 bg-blue-50' : ''}
                                    `}
                                    >
                                        <div className={`
                                         w-16 py-1 rounded-lg text-center text-xs font-bold font-mono
                                         ${assignment ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}
                                     `}>
                                            {time.split(' ')[0]}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {assignment ? (
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="font-black text-gray-800 text-sm truncate leading-tight">{assignment.group.label}</p>
                                                        {assignment.group.isCombo && <p className="text-[10px] text-emerald-600 font-bold">Incluye Sordos</p>}
                                                        {assignment.notes && <p className="text-[10px] text-gray-400 truncate italic">{assignment.notes}</p>}
                                                    </div>
                                                    <div className="p-1.5 rounded-full hover:bg-gray-100 text-gray-300 group-hover:text-blue-500 transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs font-medium italic">
                                                    {selectedGroup ? 'Asignar aquí' : 'Disponible'}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-6 right-6 md:right-12 z-50">
                <button
                    onClick={handleSave}
                    disabled={saving || !Object.keys(assignments).length}
                    className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-2xl font-bold shadow-2xl shadow-gray-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:transform-none"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    <span>Guardar</span>
                </button>
            </div>

            {/* Edit Modal */}
            {editingSlot && assignments[editingSlot] && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingSlot(null)}></div>
                    <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{editingSlot}</p>
                                <h3 className="text-xl font-black text-gray-900">{assignments[editingSlot]?.group.label}</h3>
                            </div>
                            <button onClick={() => setEditingSlot(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Notas / Observaciones</label>
                            <textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none text-sm font-medium"
                                rows={3}
                                placeholder="Ej: Menú especial, Salida anticipada..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => deleteAssignment(editingSlot)}
                                className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Quitar
                            </button>
                            <button
                                onClick={saveEdit}
                                className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                            >
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
