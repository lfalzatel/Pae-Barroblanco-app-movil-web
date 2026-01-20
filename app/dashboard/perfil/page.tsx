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
    Users
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
    const [stats, setStats] = useState({
        totalRegistros: 0,
        diasActivos: 0,
        gruposAtendidos: 0,
        ultimoRegistro: 'N/A'
    });

    useEffect(() => {
        const fetchProfileData = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/');
                return;
            }

            const user = {
                ...session.user,
                nombre: session.user.user_metadata?.nombre || session.user.user_metadata?.full_name || 'Usuario',
                rol: session.user.user_metadata?.rol || 'docente',
                foto: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
            };

            setUsuario(user);

            // Fetch Stats & History
            try {
                const { data, error } = await supabase
                    .from('asistencia_pae')
                    .select('fecha, created_at, estudiantes(grupo, grado)')
                    .eq('registrado_por', user.id);

                if (!error && data) {
                    setHistory(data);

                    const uniqueDays = new Set(data.map(d => d.fecha));
                    const uniqueGroups = new Set();
                    data.forEach(d => {
                        const est = d.estudiantes as any;
                        // Handle if it comes as an array (one-to-many inference) or object
                        const grupo = Array.isArray(est) ? est[0]?.grupo : est?.grupo;
                        if (grupo) uniqueGroups.add(grupo);
                    });

                    // Sort by date to find latest
                    const dates = data.map(d => d.fecha).sort();
                    const lastDate = dates.length > 0 ? dates[dates.length - 1] : 'N/A';

                    setStats({
                        totalRegistros: data.length,
                        diasActivos: uniqueDays.size,
                        gruposAtendidos: uniqueGroups.size,
                        ultimoRegistro: lastDate
                    });
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

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header / Banner */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-blue-100 flex items-center justify-center">
                            {usuario.foto ? (
                                <img
                                    src={usuario.foto}
                                    alt={usuario.nombre}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <span className="text-4xl font-bold text-blue-600">{usuario.nombre.charAt(0)}</span>
                            )}
                        </div>

                        <div className="text-center md:text-left flex-1 space-y-2">
                            <h1 className="text-3xl font-black text-gray-900">{usuario.nombre}</h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full">
                                    <Mail className="w-4 h-4" />
                                    {usuario.email}
                                </div>
                                <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    <Shield className="w-4 h-4" />
                                    {usuario.rol}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center hover:border-blue-200 transition-colors">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <span className="text-3xl font-black text-gray-900">{stats.totalRegistros}</span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Registros Totales</span>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center hover:border-blue-200 transition-colors">
                        <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-3">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <span className="text-3xl font-black text-gray-900">{stats.diasActivos}</span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Días Activos</span>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center hover:border-blue-200 transition-colors">
                        <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="text-3xl font-black text-gray-900">{stats.gruposAtendidos}</span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Grupos Gestionados</span>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center hover:border-blue-200 transition-colors">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                            <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-bold text-gray-900 mt-1">{stats.ultimoRegistro}</span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-2">Última Actividad</span>
                    </div>
                </div>

                {/* Calendar Section */}
                <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Tu Actividad Reciente</h2>
                            <p className="text-sm text-gray-500">Últimos 35 días de gestión</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2 md:gap-4 mb-2">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                            <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2 md:gap-4">
                        {Array.from({ length: 35 }).map((_, i) => {
                            const d = (() => {
                                const today = new Date();
                                const currentDay = today.getDay(); // 0-6
                                const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
                                const startOfWeek = new Date(today);
                                startOfWeek.setDate(today.getDate() - daysSinceMonday);
                                const startDate = new Date(startOfWeek);
                                startDate.setDate(startOfWeek.getDate() - 28); // Go back 4 weeks
                                const date = new Date(startDate);
                                date.setDate(startDate.getDate() + i);
                                return date;
                            })();

                            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            const todayStr = new Date().toISOString().split('T')[0];

                            // Find records for this date
                            const records = history.filter(h => h.fecha === dateStr);
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
                                                const key = `${g.grado}-${g.grupo}`;

                                                if (!groupsMap.has(key)) {
                                                    groupsMap.set(key, {
                                                        grado: g.grado,
                                                        grupo: g.grupo,
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
                                        aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all duration-200
                                        ${isFuture
                                            ? 'opacity-25 bg-gray-50 border-transparent text-gray-300 cursor-default'
                                            : hasActivity
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 hover:scale-110 cursor-pointer'
                                                : isWeekend
                                                    ? 'bg-gray-50 border-transparent text-gray-300'
                                                    : 'bg-white border-gray-100 text-gray-300'
                                        }
                                    `}
                                >
                                    <span className={`text-sm md:text-lg font-bold ${hasActivity ? 'text-white' : ''}`}>
                                        {d.getDate()}
                                    </span>
                                    {hasActivity && (
                                        <span className="text-[10px] md:text-xs font-medium opacity-80 mt-1">
                                            {records.length}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Motivational / Extra Info Card */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white relative overflow-hidden">
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
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
