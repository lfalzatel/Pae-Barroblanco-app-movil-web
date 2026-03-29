'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
    AlertTriangle,
    Megaphone,
    Calendar,
    Clock,
    Filter,
    ArrowRight,
    ExternalLink,
    Search,
    Plus,
    X,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Info,
    Users,
    Edit2,
    ArrowLeft,
    Save,
    Trash2,
    FileText,
    ChevronLeft,
    ChevronRight,
    CalendarDays
} from 'lucide-react';

const EXTERNAL_LINKS = [
    {
        id: 'cupos',
        title: 'Reporte de Cupos Semanales (SharePoint)',
        description: 'Planilla de SharePoint para proyección de la próxima semana.',
        url: 'https://educacionrionegro-my.sharepoint.com/:x:/g/personal/novedades_pae_ser_edu_co/IQAB7gXGuyndRY7qncxvuUV6AYTnvh2j5N9lfdwOuBcMjFI?e=uun6Te',
        icon: FileText,
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
    },
    {
        id: 'cupos_google',
        title: 'Reporte de Cupos (Google Sheets)',
        description: 'Copia en Google Sheets para mejor visualización y edición en móviles.',
        url: 'https://docs.google.com/spreadsheets/d/1NIp7IaTps7E-QqkBc5Yt0rx36HGc-k5d4EiKmtOLFeE/edit?usp=sharing',
        icon: FileText,
        color: 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
    },
    {
        id: 'novedades_forms',
        title: 'Novedades Fuera de Tiempo',
        description: 'Formulario oficial de Microsoft Forms para cambios urgentes.',
        url: 'https://forms.office.com/pages/responsepage.aspx?id=7WISMP1y5UaAjg2wvd_DsGreu5jW2TRJjxzq9SheHZNUOU1EMVdOU1NFSDc1SzdBRFI4S0JNOEZJMS4u&route=shorturl',
        icon: Megaphone,
        color: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
    },
    {
        id: 'docentes',
        title: 'Base de Datos Coordinadores 2025',
        description: 'Excel compartido con información de contacto institucional.',
        url: 'https://educacionrionegro-my.sharepoint.com/:x:/g/personal/novedades_pae_ser_edu_co/IQB4-c2wtpvuTo8_C0Hd9Ic3AdKFPHR8XoDV-SEwa-PLt6E?e=peHmn8',
        icon: Users,
        color: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800'
    },
    {
        id: 'pqrsfd',
        title: 'PQRSFD Operador Nutriceres',
        description: 'Canal oficial para solicitudes, quejas y reclamos al operador.',
        url: 'https://acortar.link/5GlxKV',
        icon: AlertTriangle,
        color: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
    }
];

export default function NovedadesPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [novedades, setNovedades] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Filter States
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    });
    const [selectedDayOffset, setSelectedDayOffset] = useState(() => {
        const d = new Date();
        const day = d.getDay(); // 0=Sun, 1=Mon
        return day === 0 ? 1 : (day === 6 ? 5 : day); // Default to Mon if Sun, Fri if Sat
    });

    useEffect(() => {
        setMounted(true);
    }, []);
    const [usuario, setUsuario] = useState<any>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Helper: Week Label
    const getWeekRangeLabel = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const mon = new Date(new Date(d).setDate(diff));
        const sun = new Date(new Date(mon).setDate(mon.getDate() + 6));
        const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        return `${mon.toLocaleDateString('es-CO', opts)} - ${sun.toLocaleDateString('es-CO', opts)}`.toUpperCase().replace(/\./g, '');
    };

    // Helper: Move Week
    const handleMoveWeek = (offset: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + (offset * 7));
        const newDate = d.toISOString().split('T')[0];
        setSelectedDate(newDate);
    };

    // Form states
    const [formData, setFormData] = useState({
        fecha_novedad: new Date().toISOString().split('T')[0],
        tipo: 'reduccion_cupos',
        sede: 'Principal',
        grupo: '',
        cupos_afectados: 0,
        razon: ''
    });

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('perfiles_publicos')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setUsuario(profile);
            }
        };
        checkUser();
        fetchNovedades();

        // Realtime subscription
        const channel = supabase
            .channel('novedades_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'novedades_cupos' },
                () => fetchNovedades()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedDate]);

    const fetchNovedades = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('novedades_cupos')
                .select(`
                    *,
                    reportero:perfiles_publicos(nombre)
                `)
                .eq('fecha_novedad', selectedDate)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNovedades(data || []);
        } catch (error) {
            console.error('Error fetching novedades:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (novedad: any) => {
        setEditingId(novedad.id);
        const cuposVal = Math.abs(novedad.cupos_afectados);
        setFormData({
            fecha_novedad: novedad.fecha_novedad,
            tipo: novedad.tipo,
            sede: novedad.sede,
            grupo: novedad.grupo || '',
            cupos_afectados: cuposVal,
            razon: novedad.razon
        });
        setShowModal(true);
    };

    const handleNew = () => {
        setEditingId(null);
        setFormData({
            fecha_novedad: new Date().toISOString().split('T')[0],
            tipo: 'reduccion_cupos',
            sede: 'Principal',
            grupo: '',
            cupos_afectados: 0,
            razon: ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!usuario) return;
        setSaving(true);

        try {
            // Logic to calculate +/- based on type
            let finalCupos = Math.abs(formData.cupos_afectados);
            if (formData.tipo === 'reduccion_cupos' || formData.tipo === 'no_asiste_grupo') {
                finalCupos = -finalCupos;
            }

            const payload = {
                ...formData,
                cupos_afectados: finalCupos,
                reportado_por: usuario.id
            };

            let error;
            if (editingId) {
                // Update existing
                const { error: upError } = await supabase
                    .from('novedades_cupos')
                    .update(payload)
                    .eq('id', editingId);
                error = upError;
            } else {
                // Create new
                const { error: inError } = await supabase
                    .from('novedades_cupos')
                    .insert([payload]);
                error = inError;
            }

            if (error) throw error;

            setShowModal(false);
            fetchNovedades();
        } catch (error: any) {
            alert('Error al guardar novedad: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingId) return;
        if (confirm('¿Estás seguro de que quieres eliminar esta novedad?')) {
            setSaving(true);
            try {
                const { error } = await supabase.from('novedades_cupos').delete().eq('id', editingId);
                if (error) throw error;
                setShowModal(false);
                fetchNovedades();
            } catch (error: any) {
                alert('Error al eliminar: ' + error.message);
            } finally {
                setSaving(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 font-sans transition-colors">

            {/* Header Premium (Synced with Reportes/Gestion) */}
            <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 shadow-xl shadow-cyan-900/10 sticky top-16 md:top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:pt-6 md:pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="p-2 md:p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-lg border border-white/10"
                            >
                                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                            </Link>
                            <div className="relative">
                                <h1 className="text-lg md:text-2xl font-black text-white leading-none tracking-tight">Novedades y Cupos</h1>
                                <div className="flex items-center gap-2 mt-1 opacity-90">
                                    <p className="text-[9px] md:text-[11px] font-bold text-cyan-50 uppercase tracking-[0.2em]">
                                        IE Barroblanco • Sede Principal
                                    </p>
                                    <span className="w-1 h-1 rounded-full bg-cyan-200/50"></span>
                                    <p className="text-[9px] md:text-[10px] font-black text-cyan-100/60 uppercase tracking-widest">TIEMPO REAL</p>
                                </div>
                            </div>
                        </div>

                        {/* Add Button (Authorized ONLY) */}
                        {['admin', 'coordinador_pae', 'secretaria_educacion'].includes(usuario?.rol) && (
                            <button
                                onClick={handleNew}
                                className="bg-white text-cyan-700 px-4 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all text-xs md:text-sm hover:bg-cyan-50"
                            >
                                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="hidden md:inline">Reportar Novedad</span>
                                <span className="md:hidden">Reportar</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* Date Selectors (Week + Day) */}
                <div className="space-y-6">
                    {/* 1. Week Selector */}
                    <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-2xl p-1 shadow-lg shadow-cyan-900/10 flex items-center justify-between mx-auto max-w-md">
                        <button
                            onClick={() => handleMoveWeek(-1)}
                            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-all active:scale-95"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>

                        <div className="text-center px-4">
                            <h2 className="text-[10px] uppercase font-bold text-cyan-100/80 tracking-widest mb-0.5">Semana Actual</h2>
                            <p className="text-white font-black text-lg tracking-tight leading-none uppercase">
                                {getWeekRangeLabel(selectedDate)}
                            </p>
                        </div>

                        <button
                            onClick={() => handleMoveWeek(1)}
                            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-all active:scale-95"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>

                    {/* 2. Day Tabs */}
                    <div className="flex justify-center bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-md mx-auto overflow-x-auto">
                        {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'].map((day, index) => {
                            const offset = index + 1; // 1=Mon, 5=Fri
                            const isSelected = selectedDayOffset === offset;

                            return (
                                <button
                                    key={day}
                                    onClick={() => {
                                        // Calculate date for this day of current week
                                        const d = new Date(selectedDate + 'T12:00:00');
                                        const currentDay = d.getDay();
                                        const diffToMon = d.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
                                        const monDate = new Date(d);
                                        monDate.setDate(diffToMon);

                                        const targetDate = new Date(monDate);
                                        targetDate.setDate(monDate.getDate() + (offset - 1));

                                        const newDateStr = targetDate.toISOString().split('T')[0];
                                        setSelectedDate(newDateStr);
                                        setSelectedDayOffset(offset);
                                    }}
                                    className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-xs font-black transition-all relative overflow-hidden ${isSelected
                                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200 dark:shadow-none'
                                        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-cyan-600'
                                        }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Activity List (MOVED UP) */}
                <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                            <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                            Bitácora de Novedades
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
                            <p className="text-xs font-bold text-gray-400">Sincronizando bitácora...</p>
                        </div>
                    ) : novedades.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Info className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Sin novedades recientes</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">No hay cambios reportados para los próximos días.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {novedades.map((n) => {
                                // Logic to force correct visual representation
                                const isReduction = n.tipo === 'reduccion_cupos' || n.tipo === 'no_asiste_grupo';
                                const displayValue = Math.abs(n.cupos_afectados); // Always work with absolute for display
                                const finalDisplay = isReduction ? -displayValue : displayValue;

                                return (
                                    <div key={n.id} className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-cyan-100 dark:hover:border-cyan-900 transition-all duration-300">
                                        {/* Status Indicator Bar */}
                                        <div className={`absolute top-0 inset-x-0 h-1 rounded-t-2xl ${n.estado === 'pendiente' ? 'bg-amber-400' :
                                            n.estado === 'confirmado' ? 'bg-cyan-500' : 'bg-green-500'
                                            }`}></div>

                                        <div className="flex items-start justify-between mb-4 mt-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-xl ${isReduction ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                                    n.tipo === 'aumento_cupos' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                                                        'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400'
                                                    }`}>
                                                    <Megaphone className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${n.estado === 'pendiente' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                                            'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                            }`}>
                                                            {n.estado}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{n.sede}</p>
                                                </div>
                                            </div>

                                            {/* Edit Button (Admins OR Owner if pending) */}
                                            {n.estado === 'pendiente' && usuario && (
                                                usuario.id === n.reportado_por ||
                                                usuario.rol === 'admin'
                                            ) && (
                                                    <button
                                                        onClick={() => handleEdit(n)}
                                                        className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors dark:hover:bg-cyan-900/20 dark:hover:text-cyan-400"
                                                        title="Editar Novedad"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-black text-gray-900 dark:text-white capitalize text-lg leading-tight mb-1">
                                                    {n.tipo.replace(/_/g, ' ')}
                                                </h4>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5 line-clamp-1 font-medium">
                                                        <Users className="w-4 h-4" />
                                                        {n.grupo || 'Toda la sede'}
                                                    </span>
                                                    <span className={`font-black text-lg ${finalDisplay < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                        {finalDisplay > 0 ? '+' : ''}{finalDisplay}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800 relative">
                                                <Info className="w-4 h-4 text-gray-300 absolute top-2 right-2" />
                                                <p className="text-xs text-gray-600 dark:text-gray-300 italic pr-4">"{n.razon}"</p>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase pt-2 border-t border-gray-100 dark:border-gray-700">
                                                <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                                                    <Calendar className="w-3 h-3" />
                                                    <span className="capitalize">
                                                        {new Date(n.fecha_novedad + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <span className="truncate max-w-[100px]">{n.reportero?.nombre || 'Desconocido'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* External Resources HUB (MOVED DOWN) */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                            <ExternalLink className="w-5 h-5 text-gray-400" />
                            Recursos Externos
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {EXTERNAL_LINKS.map((link) => {
                            const Icon = link.icon;
                            return (
                                <a
                                    key={link.id}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`group p-4 rounded-2xl border transition-all hover:shadow-lg hover:-translate-y-1 ${link.color} bg-white dark:bg-gray-800`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2 bg-white/50 dark:bg-black/20 rounded-xl backdrop-blur-sm">
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                    <h3 className="font-black text-sm mb-1 line-clamp-1">{link.title}</h3>
                                    <p className="text-[10px] opacity-80 leading-tight line-clamp-2">{link.description}</p>
                                </a>
                            );
                        })}
                    </div>
                </section>

                {/* MODAL FORM WITH PORTAL */}
                {mounted && showModal && createPortal(
                    <div
                        className="fixed inset-0 flex items-center justify-center p-4"
                        style={{ zIndex: 9999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                        {/* Backdrop separate from content */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowModal(false)}></div>

                        {/* Modal Content */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] my-auto relative z-10">

                            {/* Header Colored with Watermark */}
                            <div className="p-6 border-b border-cyan-500/30 flex items-center justify-between shrink-0 bg-gradient-to-r from-cyan-600 to-cyan-700 relative overflow-hidden">
                                {/* Watermark Icon */}
                                <Megaphone className="absolute -right-6 -bottom-6 w-32 h-32 text-white/10 rotate-12 pointer-events-none" />

                                <div className="relative z-10">
                                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                                        {editingId ? <Edit2 className="w-6 h-6 text-cyan-100" /> : <Plus className="w-6 h-6 text-cyan-100" />}
                                        {editingId ? 'Editar Novedad' : 'Reportar Nueva Novedad'}
                                    </h3>
                                    <p className="text-[10px] font-bold text-cyan-100/80 uppercase tracking-widest mt-1 ml-8">
                                        {editingId ? 'Modificar Registro' : 'Nueva Notificación'}
                                    </p>
                                </div>

                                <button onClick={() => setShowModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Form with overflow-y-auto */}
                            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar">

                                {/* Row 1: Date (Full Width) */}
                                <div className="space-y-2">
                                    <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Para Cuándo Aplica</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                                        <input
                                            type="date"
                                            required
                                            value={formData.fecha_novedad}
                                            onChange={(e) => setFormData({ ...formData, fecha_novedad: e.target.value })}
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 shadow-inner dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </div>
                                </div>

                                {/* Row 2: Type & Sede (2 Cols Mobile) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tipo</label>
                                        <div className="relative">
                                            <select
                                                value={formData.tipo}
                                                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                                className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 appearance-none shadow-inner text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            >
                                                <option value="reduccion_cupos">🔴 Reducción</option>
                                                <option value="aumento_cupos">🟢 Aumento</option>
                                                <option value="no_asiste_grupo">🚫 No Asiste</option>
                                                <option value="cambio_horario">⏳ Horario</option>
                                                <option value="otro">❓ Otro</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sede</label>
                                        <select
                                            value={formData.sede}
                                            onChange={(e) => setFormData({ ...formData, sede: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 shadow-inner text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        >
                                            <option value="Principal">Principal</option>
                                            <option value="Maria Inmaculada">Inmaculada</option>
                                            <option value="Primaria">Primaria</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Row 3: Group & Quantity (2 Cols Mobile) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grupo</label>
                                        <input
                                            placeholder="Opcional"
                                            value={formData.grupo}
                                            onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cupos (+/-)</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            min="0"
                                            value={formData.cupos_afectados}
                                            onChange={(e) => setFormData({ ...formData, cupos_afectados: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Razón / Observaciones</label>
                                    <textarea
                                        required
                                        value={formData.razon}
                                        onChange={(e) => setFormData({ ...formData, razon: e.target.value })}
                                        placeholder="Describe el motivo del cambio..."
                                        rows={3}
                                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-inner resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
                                    />
                                </div>

                                <div className="p-4 md:p-6 pt-0 flex gap-3 shrink-0 border-t border-gray-100 dark:border-gray-700 mt-6 !px-0 !pb-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 md:px-5 py-3 md:py-4 bg-gray-50 text-gray-500 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-100 transition-all dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                                    >
                                        CANCELAR
                                    </button>

                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={handleDelete}
                                            className="p-3 md:p-4 bg-red-50 text-red-600 rounded-xl md:rounded-2xl hover:bg-red-100 transition-all border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                            title="Eliminar Novedad"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 py-3 md:py-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-cyan-100 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        {editingId ? 'GUARDAR' : 'CREAR'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}
            </main>
        </div>
    );
}
