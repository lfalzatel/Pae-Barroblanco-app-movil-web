'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    User,
    Mail,
    Shield,
    Calendar,
    CheckCircle2,
    TrendingUp,
    Award,
    Clock,
    X,
    CalendarDays,
    Users,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

interface GroupDetail {
    grupo: string;
    grado: string;
    count: number;
    timestamp: string;
}

interface DayDetail {
    date: string;
    groups: GroupDetail[];
    total: number;
}

export default function ProfilePage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<DayDetail | null>(null);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());

    // Sync points update in real-time when custom event is dispatched
    useEffect(() => {
        const handlePuntos = (e: any) => {
            setUsuario((prev: any) => {
                if (!prev) return prev;
                if (typeof e.detail.total === 'number') {
                    return { ...prev, puntos_gestor_pae: e.detail.total };
                } else if (typeof e.detail.points === 'number') {
                    return { ...prev, puntos_gestor_pae: (prev.puntos_gestor_pae || 0) + e.detail.points };
                }
                return prev;
            });
        };
        window.addEventListener('puntosActualizados', handlePuntos);
        return () => window.removeEventListener('puntosActualizados', handlePuntos);
    }, []);

    // Cargar puntos de estrellas del mes seleccionado en el perfil
    useEffect(() => {
        const fetchMonthlyPoints = async () => {
            if (!usuario?.id) return;
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const startOfMonth = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
            const endOfMonth = new Date(Date.UTC(year, month + 1, 0)).toISOString().split('T')[0];

            try {
                const { data } = await supabase
                    .from('puntos_pae_historial')
                    .select('puntos')
                    .eq('usuario_id', usuario.id)
                    .gte('fecha', startOfMonth)
                    .lte('fecha', endOfMonth);

                if (data) {
                    const total = data.reduce((sum, p) => sum + (p.puntos || 0), 0);
                    setUsuario((prev: any) => prev ? { ...prev, puntos_gestor_pae: total } : prev);
                }
            } catch (err) {
                console.error('Error fetching monthly points:', err);
            }
        };

        fetchMonthlyPoints();
    }, [currentDate, usuario?.id]);

    useEffect(() => {
        const fetchProfileData = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/');
                return;
            }

            // Fetch profile from perfiles_publicos
            const { data: profile } = await supabase
                .from('perfiles_publicos')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                setUsuario(profile);
            } else {
                let userRole = session.user.user_metadata?.rol;
                const userEmail = session.user.email || '';

                if (!userRole) {
                    userRole = userEmail.endsWith('@barroblanco.edu.co') ? 'estudiante' : 'acudiente';
                    await supabase.auth.updateUser({
                        data: { rol: userRole }
                    });
                }

                setUsuario({
                    ...session.user,
                    email: userEmail,
                    nombre: session.user.user_metadata?.nombre || session.user.user_metadata?.full_name || 'Usuario',
                    rol: userRole,
                    foto: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
                });
            }

            // Fetch Stats & History
            try {
                const userRole = profile?.rol || session.user.user_metadata?.rol || 'acudiente';
                const isStudent = userRole === 'estudiante' || userRole === 'estudiante_pae';
                let historyData: any[] = [];

                if (isStudent) {
                    // 1. Get student record by email
                    const { data: studentData, error: studentError } = await supabase
                        .from('estudiantes')
                        .select('id, grupo, grado')
                        .eq('email', session.user.email)
                        .single();

                    if (!studentError && studentData) {
                        // 2. Get history where this student received PAE
                        const { data, error } = await supabase
                            .from('asistencia_pae')
                            .select('fecha, created_at, estado')
                            .eq('estudiante_id', studentData.id);

                        if (!error && data) {
                            // Inject student data so the rest of the UI doesn't break
                            historyData = data.map(d => ({
                                ...d,
                                estudiantes: { grupo: studentData.grupo, grado: studentData.grado }
                            }));
                        }
                    } else {
                        console.error('Student record not found for this email', session.user.email);
                    }
                } else {
                    // Admin or Docente - see their registered history
                    const { data, error } = await supabase
                        .from('asistencia_pae')
                        .select('fecha, created_at, estado, estudiantes!inner(grupo, grado)')
                        .eq('registrado_por', session.user.id);

                    if (!error && data) {
                        historyData = data;
                    }
                }

                if (historyData.length > 0) {
                    setHistory(historyData);

                    const uniqueDays = new Set(historyData.map(d => (d.fecha || '').slice(0, 10)));
                    const uniqueGroups = new Set();
                    let receivedCount = 0;

                    historyData.forEach(d => {
                        const est = d.estudiantes as any;
                        // Handle if it comes as an array (one-to-many inference) or object
                        const grupo = Array.isArray(est) ? est[0]?.grupo : est?.grupo;
                        if (grupo) uniqueGroups.add(grupo);

                        if (isStudent && d.estado === 'recibio') {
                            receivedCount++;
                        }
                    });

                    // Sort by date to find latest
                    const dates = historyData.map(d => (d.fecha || '').slice(0, 10)).sort();
                    const lastDate = dates.length > 0 ? dates[dates.length - 1] : 'N/A';
                }
            } catch (err) {
                console.error('Error fetching stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, [router]);

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-6">
                <Skeleton className="h-40 rounded-3xl w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-60 rounded-3xl" />
                    <Skeleton className="h-60 rounded-3xl" />
                </div>
            </div>
        );
    }

    const userRole = usuario?.rol || 'acudiente';
    const isStudent = userRole === 'estudiante' || userRole === 'estudiante_pae';

    const currentMonthHistory = history.filter(h => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        return (h.fecha || '').slice(0, 10).startsWith(`${year}-${month}`);
    });

    const uniqueDays = new Set(currentMonthHistory.map(d => (d.fecha || '').slice(0, 10)));
    const uniqueGroups = new Set();
    let receivedCount = 0;

    currentMonthHistory.forEach(d => {
        const est = d.estudiantes as any;
        const grupo = Array.isArray(est) ? est[0]?.grupo : est?.grupo;
        if (grupo) uniqueGroups.add(grupo);
        if (isStudent && d.estado === 'recibio') {
            receivedCount++;
        }
    });

    const dates = currentMonthHistory.map(d => (d.fecha || '').slice(0, 10)).sort();
    const lastDate = dates.length > 0 ? dates[dates.length - 1] : 'N/A';

    const displayStats = {
        totalRegistros: isStudent ? receivedCount : currentMonthHistory.length,
        diasActivos: uniqueDays.size,
        gruposAtendidos: uniqueGroups.size,
        ultimoRegistro: lastDate
    };

    const getDaysInMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        let startDayIndex = firstDay.getDay(); // 0 is Sunday
        startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1; // Make Monday 0

        const days = [];
        for (let i = 0; i < startDayIndex; i++) {
            days.push(null);
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent p-6 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header / Banner */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden transition-colors">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 dark:bg-blue-900/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-700 shadow-xl overflow-hidden bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            {usuario.foto ? (
                                <img
                                    src={usuario.foto}
                                    alt={usuario.nombre}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">{usuario.nombre.charAt(0)}</span>
                            )}
                        </div>

                        <div className="text-center md:text-left flex-1 space-y-2">
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white">{usuario.nombre}</h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-gray-600 dark:text-gray-300">
                                    <Mail className="w-4 h-4" />
                                    {usuario.email}
                                </div>
                                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    <Shield className="w-4 h-4" />
                                    {usuario.rol}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Calendar Section */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                                <CalendarDays className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {usuario?.rol === 'estudiante' || usuario?.rol === 'estudiante_pae' ? 'Tu Historial PAE' : 'Tu Actividad Reciente'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Resumen del mes
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700/70 p-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
                            <button 
                                onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}
                                className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-200"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-black min-w-[110px] text-center capitalize text-gray-800 dark:text-gray-100">
                                {currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                            </span>
                            <button 
                                onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}
                                className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-200"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-50/50 p-4 md:p-6 rounded-[2rem] border border-gray-100/50 shadow-inner dark:bg-gray-900/50 dark:border-gray-700/50">
                        <div className="grid grid-cols-7 gap-2 md:gap-3 mb-3">
                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                                <div key={day} className="text-center text-[10px] md:text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider py-1">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-2 md:gap-3">
                            {getDaysInMonth().map((d, i) => {
                                if (!d) return <div key={`empty-${i}`} className="aspect-square"></div>;

                                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                const todayStr = new Date().toISOString().split('T')[0];

                                // Find records for this date
                                const records = history.filter(h => (h.fecha || '').slice(0, 10) === dateStr);
                                const hasActivity = records.length > 0;
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                const isFuture = dateStr > todayStr;

                                return (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            if (hasActivity) {
                                                // Group counts with timestamps
                                                const groupsMap = new Map<string, GroupDetail>();
                                                records.forEach(r => {
                                                    const est = r.estudiantes as any;
                                                    const g = Array.isArray(est) ? est[0] : est;
                                                    const key = `${g?.grado || ''}-${g?.grupo || ''}`;

                                                    if (!groupsMap.has(key)) {
                                                        groupsMap.set(key, {
                                                            grado: g?.grado || 'S/N',
                                                            grupo: g?.grupo || 'S/N',
                                                            count: 0,
                                                            timestamp: r.created_at
                                                        });
                                                    }

                                                    const group = groupsMap.get(key)!;
                                                    group.count++;
                                                    // Keep earliest timestamp
                                                    if (new Date(r.created_at) < new Date(group.timestamp)) {
                                                        group.timestamp = r.created_at;
                                                    }
                                                });

                                                // Sort groups by timestamp
                                                const sortedGroups = Array.from(groupsMap.values())
                                                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                                                setSelectedDate({
                                                    date: d.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                                                    groups: sortedGroups,
                                                    total: records.length
                                                });
                                            }
                                        }}
                                        disabled={!hasActivity}
                                        className={`
                                            aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all duration-300
                                            ${isFuture
                                                ? 'opacity-20 bg-gray-100 dark:bg-gray-800 border-transparent text-gray-400 dark:text-gray-600 cursor-default'
                                                : hasActivity
                                                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-md shadow-cyan-100 dark:shadow-cyan-900/30 hover:scale-105 active:scale-95 cursor-pointer'
                                                    : isWeekend
                                                        ? 'bg-gray-100/70 dark:bg-gray-900/40 border-transparent text-gray-400 dark:text-gray-500'
                                                        : 'bg-white dark:bg-gray-700/60 border-gray-100 dark:border-gray-600 text-gray-400 dark:text-gray-400'
                                            }
                                        `}
                                    >
                                        <span className={`text-xs md:text-base font-black ${hasActivity ? 'text-white' : ''}`}>
                                            {d.getDate()}
                                        </span>
                                        {hasActivity && (
                                            <span className="text-[9px] md:text-[10px] font-black opacity-90 mt-0.5 leading-none">
                                                {records.length}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
                        <Award className="w-10 h-10 mb-3 opacity-90 drop-shadow-md" />
                        <span className="text-3xl font-black drop-shadow-sm">{usuario?.puntos_gestor_pae || 0}</span>
                        <span className="text-xs font-bold opacity-90 uppercase tracking-wide mt-1">Puntos Gestor PAE</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <span className="text-3xl font-black text-gray-900 dark:text-white">{displayStats.totalRegistros}</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">
                            {usuario?.rol === 'estudiante' || usuario?.rol === 'estudiante_pae' ? 'Días Recibidos' : 'Registros Totales'}
                        </span>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-3">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <span className="text-3xl font-black text-gray-900 dark:text-white">{displayStats.diasActivos}</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">Días Activos</span>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-3">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="text-3xl font-black text-gray-900 dark:text-white">{displayStats.gruposAtendidos}</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">
                            {usuario?.rol === 'estudiante' || usuario?.rol === 'estudiante_pae' ? 'Grupos' : 'Grupos Gestionados'}
                        </span>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-3">
                            <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-bold text-gray-900 dark:text-white mt-1">{displayStats.ultimoRegistro}</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-2">Última Actividad</span>
                    </div>
                </div>

                {/* Motivational / Extra Info Card */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white relative overflow-hidden dark:from-blue-800 dark:to-indigo-900">
                    <div className="relative z-10 max-w-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Award className="w-8 h-8 text-yellow-300" />
                            <h3 className="text-xl font-bold">¡Gracias por tu labor!</h3>
                        </div>
                        <p className="text-blue-100 leading-relaxed">
                            Tu compromiso con el Programa de Alimentación Escolar garantiza el bienestar de nuestros estudiantes.
                            Cada registro cuenta para mantener la transparencia y calidad del servicio en la Institución Educativa Barroblanco.
                        </p>
                    </div>
                    {/* Shapes */}
                    <div className="absolute right-0 bottom-0 opacity-10">
                        <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                            <circle cx="150" cy="150" r="100" fill="white" />
                        </svg>
                    </div>
                </div>

                {/* Detail Modal */}
                {selectedDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
                        <div
                            className="bg-white/90 backdrop-blur-xl rounded-3xl w-full max-w-md shadow-2xl border border-white/50 overflow-hidden animate-in zoom-in-95 duration-300"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-gray-100 bg-white/50 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Detalle del Día</p>
                                    <h3 className="text-xl font-black text-gray-900 capitalize">{selectedDate.date}</h3>
                                </div>
                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-gray-400" />
                                        Grupos Atendidos
                                    </h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {selectedDate.groups.map((g, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-xs">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-xs text-transform uppercase">
                                                        {g.grado}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-700 text-sm">Grupo {g.grupo}</span>
                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(g.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded-lg">
                                                    {g.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100 text-center">
                                    <p className="text-sm text-gray-500">
                                        Total procesado: <b className="text-gray-900">{selectedDate.total} estudiantes</b>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
