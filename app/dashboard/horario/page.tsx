'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    Plus,
    Save,
    Trash2,
    Clock,
    Users,
    FileText,
    AlertCircle,
    CheckCircle,
    Loader2
} from 'lucide-react';

interface ScheduleItem {
    time: string;
    group: string;
    notes: string;
}

export default function HorarioPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [role, setRole] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [notif, setNotif] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Default items template
    const defaultItems: ScheduleItem[] = [
        { time: '08:30 - 09:00', group: 'Preescolar & 1°', notes: 'Desayuno' },
        { time: '09:00 - 09:30', group: '2° & 3°', notes: 'Desayuno' },
        { time: '09:30 - 10:00', group: '4° & 5°', notes: 'Desayuno' },
        { time: '10:00 - 10:30', group: 'Bachillerato (6°-8°)', notes: 'Refrigerio Reforzado' },
        { time: '10:30 - 11:00', group: 'Bachillerato (9°-11°)', notes: 'Refrigerio Reforzado' },
    ];

    useEffect(() => {
        checkAccess();
    }, []);

    useEffect(() => {
        if (role) {
            fetchSchedule();
        }
    }, [selectedDate, role]);

    const checkAccess = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push('/');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const userRole = user?.user_metadata?.rol;

        if (userRole !== 'admin' && userRole !== 'coordinador_pae') {
            router.push('/dashboard'); // Redirect unauthorized
            return;
        }

        setRole(userRole);
    };

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('schedules')
                .select('*')
                .eq('date', selectedDate)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
                throw error;
            }

            if (data) {
                setItems(data.items);
            } else {
                // Init with empty or default if it's a new day? 
                // Let's start clean or maybe with defaults if user wants
                setItems([]);
            }
        } catch (error: any) {
            console.error('Error fetching schedule:', error);
            setNotif({ type: 'error', msg: 'Error al cargar el horario.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setNotif(null);
        try {
            const { error } = await supabase
                .from('schedules')
                .upsert({
                    date: selectedDate,
                    items: items,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'date' });

            if (error) throw error;

            setNotif({ type: 'success', msg: 'Horario guardado correctamente.' });
        } catch (error: any) {
            console.error('Error saving schedule:', error);
            setNotif({ type: 'error', msg: 'Error al guardar el horario.' });
        } finally {
            setSaving(false);
        }
    };

    const addItem = () => {
        setItems([...items, { time: '', group: '', notes: '' }]);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItem = (index: number, field: keyof ScheduleItem, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const loadTemplate = () => {
        if (confirm('¿Cargar plantilla por defecto? Esto reemplazará los items actuales.')) {
            setItems(defaultItems);
        }
    };

    if (!role) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto pb-24 border-b-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-gray-900"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Gestión de Horarios</h1>
                        <p className="text-sm text-gray-500 font-medium">Configura los turnos del restaurante escolar</p>
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

            {/* Notification */}
            {notif && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 ${notif.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-red-50 border border-red-100 text-red-800'
                    }`}>
                    {notif.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-medium">{notif.msg}</span>
                </div>
            )}

            {/* Main Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden border border-gray-100">

                {/* Toolbar */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-gray-700 ml-2 uppercase text-xs tracking-wider">Turnos del día</h2>
                        <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{items.length} Items</span>
                    </div>
                    <button
                        onClick={loadTemplate}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Cargar Plantilla
                    </button>
                </div>

                {/* List */}
                <div className="p-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                            <p className="text-gray-400 font-medium mb-4">No hay turnos configurados para este día.</p>
                            <button
                                onClick={loadTemplate}
                                className="text-orange-500 font-bold hover:underline"
                            >
                                Usar plantilla
                            </button>
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-4 rounded-2xl border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-md transition-all group">

                                {/* Time Input */}
                                <div className="flex-1 w-full md:w-auto">
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Ej: 08:30 - 09:00"
                                            value={item.time}
                                            onChange={(e) => updateItem(index, 'time', e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm font-bold text-gray-700"
                                        />
                                    </div>
                                </div>

                                {/* Group Input */}
                                <div className="flex-[2] w-full md:w-auto">
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Grupo (Ej: Preescolar)"
                                            value={item.group}
                                            onChange={(e) => updateItem(index, 'group', e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm font-bold text-gray-900"
                                        />
                                    </div>
                                </div>

                                {/* Notes Input */}
                                <div className="flex-[2] w-full md:w-auto">
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Menú / Notas"
                                            value={item.notes}
                                            onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm text-gray-600"
                                        />
                                    </div>
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={() => removeItem(index)}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))
                    )}

                    {/* Add Button */}
                    <button
                        onClick={addItem}
                        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 font-bold hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Agregar Turno
                    </button>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-gray-200 hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}
