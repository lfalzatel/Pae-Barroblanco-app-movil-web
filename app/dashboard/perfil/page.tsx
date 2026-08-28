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
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Volume2,
    Palette,
    Lock,
    LogOut,
    ArrowRightLeft,
    Edit3,
    MapPin,
    ShieldAlert,
    Database,
    Check,
    Sun,
    Moon,
    Monitor,
    Sliders,
    FileText,
    Bell,
    BellOff,
    Globe,
    Share2,
    Fingerprint,
    Download,
    Send
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/components/ThemeProvider';
import {
    getSoundPreference,
    setSoundPreference,
    playNavSound,
    SOUND_OPTIONS,
    SoundType
} from '@/lib/ui-sounds';

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
    const { theme, setTheme } = useTheme();

    const [usuario, setUsuario] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<DayDetail | null>(null);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [soundPref, setSoundPref] = useState<SoundType>('pop');

    // Push notification states
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [pushFeedback, setPushFeedback] = useState<string | null>(null);

    // Accordion State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        cuenta: false,
        sonidos: false,
        notificaciones: true, // Open by default for requested notifications section
        recursos: false,
        actividad: false,
        gestion: false,
        apariencia: false,
        privacidad: false,
    });

    const toggleSection = (sectionKey: string) => {
        setOpenSections(prev => {
            const isCurrentlyOpen = prev[sectionKey];
            const nextState: Record<string, boolean> = {};
            Object.keys(prev).forEach(k => {
                nextState[k] = k === sectionKey ? !isCurrentlyOpen : false;
            });
            return nextState;
        });
    };

    // Load Sound Preference
    useEffect(() => {
        setSoundPref(getSoundPreference());
    }, []);

    // Check Push Notification status
    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
                reg.pushManager.getSubscription().then(sub => {
                    setIsSubscribed(!!sub);
                });
            }).catch(() => {});
        }
    }, []);

    const handleSoundSelect = (newSound: SoundType) => {
        setSoundPref(newSound);
        setSoundPreference(newSound);
        playNavSound(newSound);
    };

    const handleTogglePush = async () => {
        setPushLoading(true);
        setPushFeedback(null);
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                setPushFeedback('Las notificaciones push no son soportadas en este navegador.');
                return;
            }

            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();

            if (sub) {
                await sub.unsubscribe();
                setIsSubscribed(false);
                setPushFeedback('Notificaciones desactivadas correctamente.');
            } else {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                    setIsSubscribed(true);
                    setPushFeedback('¡Notificaciones activadas con éxito!');
                } else {
                    setPushFeedback('Permiso de notificaciones denegado en el navegador.');
                }
            }
        } catch (err: any) {
            console.error(err);
            setPushFeedback('Error al ajustar notificaciones.');
        } finally {
            setPushLoading(false);
        }
    };

    const handleTestNotification = async () => {
        setTestLoading(true);
        setPushFeedback(null);
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('🔔 Sistema PAE - Prueba de Alerta', {
                    body: '¡Excelente! Las notificaciones del Sistema PAE están funcionando correctamente.',
                    icon: '/icon-192x192.png'
                });
                setPushFeedback('Notificación de prueba enviada al dispositivo.');
            } else {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                    new Notification('🔔 Sistema PAE - Prueba de Alerta', {
                        body: '¡Excelente! Las notificaciones del Sistema PAE están funcionando correctamente.',
                        icon: '/icon-192x192.png'
                    });
                    setPushFeedback('Notificación de prueba enviada.');
                } else {
                    setPushFeedback('Activa las notificaciones primero para probar alertas.');
                }
            }
        } catch (err) {
            console.error(err);
            setPushFeedback('No se pudo emitir la notificación de prueba.');
        } finally {
            setTestLoading(false);
        }
    };

    const handleShareApp = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Sistema PAE - IE Barroblanco',
                text: 'Accede a la plataforma de asistencia y gestión PAE:',
                url: window.location.origin
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(window.location.origin);
            alert('¡Enlace de la aplicación copiado al portapapeles!');
        }
    };

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

            try {
                const userRole = profile?.rol || session.user.user_metadata?.rol || 'acudiente';
                const isStudent = userRole === 'estudiante' || userRole === 'estudiante_pae';
                let historyData: any[] = [];

                if (isStudent) {
                    const { data: studentData, error: studentError } = await supabase
                        .from('estudiantes')
                        .select('id, grupo, grado')
                        .eq('email', session.user.email)
                        .single();

                    if (!studentError && studentData) {
                        const { data, error } = await supabase
                            .from('asistencia_pae')
                            .select('fecha, created_at, estado')
                            .eq('estudiante_id', studentData.id);

                        if (!error && data) {
                            historyData = data.map(d => ({
                                ...d,
                                estudiantes: { grupo: studentData.grupo, grado: studentData.grado }
                            }));
                        }
                    }
                } else {
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
                }
            } catch (err) {
                console.error('Error fetching stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-6">
                <Skeleton className="h-40 rounded-3xl w-full" />
                <div className="space-y-4">
                    <Skeleton className="h-20 rounded-2xl w-full" />
                    <Skeleton className="h-20 rounded-2xl w-full" />
                    <Skeleton className="h-20 rounded-2xl w-full" />
                </div>
            </div>
        );
    }

    const userRole = usuario?.rol || 'acudiente';
    const isStudent = userRole === 'estudiante' || userRole === 'estudiante_pae';
    const isAdminOrDocente = userRole === 'administrador' || userRole === 'coordinador' || userRole === 'docente_pae';

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

        let startDayIndex = firstDay.getDay();
        startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1;

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
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header Banner - Centro de Control */}
                <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-cyan-900/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white/30 shadow-2xl overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                            {usuario?.foto ? (
                                <img
                                    src={usuario.foto}
                                    alt={usuario.nombre}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <span className="text-3xl md:text-4xl font-black text-white">{usuario?.nombre?.charAt(0) || 'U'}</span>
                            )}
                        </div>

                        <div className="text-center md:text-left flex-1 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-80">CENTRO DE CONTROL Y CONFIGURACIÓN</p>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{usuario?.nombre || 'Usuario'}</h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs">
                                <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-white/90 backdrop-blur-md">
                                    <Mail className="w-3.5 h-3.5" />
                                    {usuario?.email}
                                </div>
                                <div className="flex items-center gap-1.5 bg-white text-cyan-800 font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                    <Shield className="w-3.5 h-3.5 text-cyan-600" />
                                    {usuario?.rol || 'Acudiente'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/15 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex flex-col items-center justify-center shrink-0 min-w-[120px]">
                            <Award className="w-8 h-8 text-yellow-300 drop-shadow-md mb-1 animate-pulse" />
                            <span className="text-2xl font-black">{usuario?.puntos_gestor_pae || 0}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">PUNTOS PAE</span>
                        </div>
                    </div>
                </div>

                {/* ACCORDION CONFIGURATION MENU */}
                <div className="space-y-3">

                    {/* 1. CUENTA Y PERFIL */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('cuenta')}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">CUENTA Y PERFIL</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-400">Información personal y rol institucional</p>
                                </div>
                            </div>
                            {openSections.cuenta ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        {openSections.cuenta && (
                            <div className="p-6 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest">Nombre Completo</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-white mt-1">{usuario?.nombre || 'N/A'}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest">Correo Institucional</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-white mt-1">{usuario?.email || 'N/A'}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest">Rol Asignado</p>
                                        <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 capitalize mt-1">{usuario?.rol || 'N/A'}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest">Sede Principal</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-white mt-1">{usuario?.sede || 'IE Barroblanco'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. NOTIFICACIONES Y ALERTAS PUSH */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('notificaciones')}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">NOTIFICACIONES Y ALERTAS PUSH</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-400">Activar o desactivar notificaciones y probar alertas push</p>
                                </div>
                            </div>
                            {openSections.notificaciones ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        {openSections.notificaciones && (
                            <div className="p-6 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 leading-relaxed">
                                    Recibe alertas instantáneas de cambios en el horario del PAE y novedades institucionales directamente en tu dispositivo.
                                </p>

                                {pushFeedback && (
                                    <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-800 text-xs font-bold text-cyan-800 dark:text-cyan-200 flex items-center justify-between">
                                        <span>{pushFeedback}</span>
                                        <button onClick={() => setPushFeedback(null)} className="text-cyan-600 dark:text-cyan-400 hover:opacity-80">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        onClick={handleTogglePush}
                                        disabled={pushLoading}
                                        className={`p-4 rounded-2xl border flex items-center justify-between text-left transition-all ${
                                            isSubscribed
                                                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-md'
                                                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isSubscribed ? <Bell className="w-6 h-6 animate-pulse" /> : <BellOff className="w-6 h-6 text-gray-400" />}
                                            <div>
                                                <p className={`text-sm font-bold ${isSubscribed ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                    {isSubscribed ? 'Notificaciones Activadas' : 'Notificaciones Desactivadas'}
                                                </p>
                                                <p className={`text-[11px] ${isSubscribed ? 'text-emerald-100' : 'text-gray-400'}`}>
                                                    {pushLoading ? 'Procesando...' : (isSubscribed ? 'Recibiendo alertas push' : 'Toca para activar')}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-black rounded-xl border ${isSubscribed ? 'bg-white/20 border-white/30 text-white' : 'bg-gray-200 dark:bg-gray-600 border-transparent text-gray-600 dark:text-gray-300'}`}>
                                            {isSubscribed ? 'ACTIVAS' : 'ACTIVAR'}
                                        </span>
                                    </button>

                                    <button
                                        onClick={handleTestNotification}
                                        disabled={testLoading}
                                        className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100/70 flex items-center justify-between text-left transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300">
                                                <Send className={`w-5 h-5 ${testLoading ? 'animate-spin' : ''}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">Probar Notificación</p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Emitir alerta de prueba en el dispositivo</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-blue-600 text-white text-xs font-black rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                                            {testLoading ? 'PROBANDO...' : 'PROBAR'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. SONIDOS DE INTERFAZ */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('sonidos')}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                    <Volume2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">SONIDOS DE INTERFAZ</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-400">Personaliza la retroalimentación auditiva del menú inferior</p>
                                </div>
                            </div>
                            {openSections.sonidos ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        {openSections.sonidos && (
                            <div className="p-6 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 leading-relaxed">
                                    Selecciona el efecto sintetizado por código (0 descargas de red) que sonará al cambiar entre las pestañas del menú inferior:
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {SOUND_OPTIONS.map((snd) => {
                                        const isSelected = soundPref === snd.id;
                                        return (
                                            <button
                                                key={snd.id}
                                                onClick={() => handleSoundSelect(snd.id)}
                                                className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                                                    isSelected
                                                        ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white border-cyan-500 shadow-md shadow-cyan-200/50 scale-[1.02]'
                                                        : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 hover:border-cyan-400 text-gray-800 dark:text-gray-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{snd.icon}</span>
                                                    <div>
                                                        <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                            {snd.label}
                                                        </p>
                                                        <p className={`text-[11px] ${isSelected ? 'text-cyan-100' : 'text-gray-400'}`}>
                                                            {snd.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="w-5 h-5 text-white shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <button
                                        onClick={() => playNavSound(soundPref)}
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"
                                    >
                                        <Volume2 className="w-4 h-4" />
                                        PROBAR SONIDO SELECCIONADO
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. RECURSOS EXTERNOS Y HERRAMIENTAS */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('recursos')}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">RECURSOS EXTERNOS Y HERRAMIENTAS</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-400">Enlaces institucionales, PWA, biometría y compartir</p>
                                </div>
                            </div>
                            {openSections.recursos ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        {openSections.recursos && (
                            <div className="p-6 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Herramientas y accesos complementarios de la aplicación:</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => router.push('/dashboard/novedades')}
                                        className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 hover:bg-teal-100/70 flex items-center justify-between text-left transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-800 dark:text-teal-300">
                                                <Globe className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">Recursos Externos</p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Novedades y planillas institucionales</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-teal-500" />
                                    </button>

                                    <button
                                        onClick={handleShareApp}
                                        className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100/70 flex items-center justify-between text-left transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-800 dark:text-emerald-300">
                                                <Share2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">Compartir Aplicación</p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Enviar enlace a docentes o acudientes</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-emerald-500" />
                                    </button>

                                    <button
                                        onClick={() => alert('Biometría vinculada correctamente al dispositivo.')}
                                        className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100/70 flex items-center justify-between text-left transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300">
                                                <Fingerprint className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">Vincular Biometría</p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Configurar Huella o FaceID</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-purple-500" />
                                    </button>

                                    <button
                                        onClick={() => alert('Si estás usando un navegador compatible, usa la opción "Agregar a la pantalla de inicio".')}
                                        className="p-4 rounded-2xl bg-green-50/70 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 hover:bg-green-100/70 flex items-center justify-between text-left transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300">
                                                <Download className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">Instalar Aplicación (PWA)</p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Instalar versión de acceso rápido</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-green-500" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. ACTIVIDAD E HISTORIAL PAE */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('actividad')}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    <CalendarDays className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">ACTIVIDAD E HISTORIAL PAE</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-400">Calendario mensual y resumen de registros</p>
                                </div>
                            </div>
                            {openSections.actividad ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        {openSections.actividad && (
                            <div className="p-6 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-6 animate-in slide-in-from-top-2 duration-200">
                                <div className="mt-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                                {isStudent ? 'Tu Historial PAE' : 'Tu Actividad Reciente'}
                                            </h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Resumen mensual interactivo</p>
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

                                                const records = history.filter(h => (h.fecha || '').slice(0, 10) === dateStr);
                                                const hasActivity = records.length > 0;
                                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                                const isFuture = dateStr > todayStr;

                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => {
                                                            if (hasActivity) {
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
                                                                    if (new Date(r.created_at) < new Date(group.timestamp)) {
                                                                        group.timestamp = r.created_at;
                                                                    }
                                                                });

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

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs flex flex-col items-center text-center">
                                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-2">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-2xl font-black text-gray-900 dark:text-white">{displayStats.totalRegistros}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Registros</span>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs flex flex-col items-center text-center">
                                        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-2">
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <span className="text-2xl font-black text-gray-900 dark:text-white">{displayStats.diasActivos}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Días Activos</span>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs flex flex-col items-center text-center">
                                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-2">
                                            <TrendingUp className="w-4 h-4" />
                                        </div>
                                        <span className="text-2xl font-black text-gray-900 dark:text-white">{displayStats.gruposAtendidos}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Grupos</span>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs flex flex-col items-center text-center">
                                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-2">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-full">{displayStats.ultimoRegistro}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Último</span>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden dark:from-blue-800 dark:to-indigo-900">
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Award className="w-6 h-6 text-yellow-300" />
                                            <h4 className="text-base font-bold">¡Gracias por tu labor!</h4>
                                        </div>
                                        <p className="text-xs text-blue-100 leading-relaxed">
                                            Tu compromiso con el Programa de Alimentación Escolar garantiza la calidad y transparencia en la I.E. Barroblanco.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 6. GESTIÓN Y ADMINISTRACIÓN DEL SISTEMA (Admins & Coordinadores) */}
                    {isAdminOrDocente && (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                            <button
                                onClick={() => toggleSection('gestion')}
                                className="w-full p-5 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                        <Sliders className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">GESTIÓN Y ADMINISTRACIÓN DEL SISTEMA</h3>
                                        <p className="text-xs text-gray-400 dark:text-gray-400">Herramientas avanzadas, auditoría, mover masa y respaldos</p>
                                    </div>
                                </div>
                                {openSections.gestion ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </button>

                            {openSections.gestion && (
                                <div className="p-6 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Acceso rápido a las funciones administrativas del sistema:</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <button
                                            onClick={() => router.push('/dashboard/auditoria')}
                                            className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100/70 flex items-center justify-between text-left transition-all md:col-span-2"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Auditoría del Sistema</p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Registro de logs, eventos y cambios de seguridad</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-purple-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin')}
                                            className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 hover:bg-blue-100/60 flex items-center justify-between text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300">
                                                    <ArrowRightLeft className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Mover Masa</p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Transferir estudiantes de grupo</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-blue-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin')}
                                            className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40 hover:bg-purple-100/60 flex items-center justify-between text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300">
                                                    <Edit3 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Renombrar Grupos</p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Actualizar nombres institucionales</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-purple-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin')}
                                            className="p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40 hover:bg-orange-100/60 flex items-center justify-between text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-800 dark:text-orange-300">
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Cambiar Sede</p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Asignar sede a cursos</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-orange-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin')}
                                            className="p-4 rounded-2xl bg-red-50/60 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 hover:bg-red-100/60 flex items-center justify-between text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-300">
                                                    <ShieldAlert className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Gestión de Estados</p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Activo, retirado, graduado</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-red-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin')}
                                            className="p-4 rounded-2xl bg-green-50/60 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40 hover:bg-green-100/60 flex items-center justify-between text-left transition-all md:col-span-2"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300">
                                                    <Database className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Respaldos de Datos</p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Exportar y asegurar la base de datos de asistencia</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-green-500" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 7. APARIENCIA Y TEMA */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('apariencia')}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                    <Palette className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">APARIENCIA Y TEMA</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-400">Personaliza la interfaz visual de la aplicación</p>
                                </div>
                            </div>
                            {openSections.apariencia ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        {openSections.apariencia && (
                            <div className="p-6 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Elige el tema de pantalla preferido:</p>

                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                                            theme === 'light'
                                                ? 'bg-cyan-600 text-white border-cyan-500 shadow-md'
                                                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <Sun className="w-6 h-6" />
                                        <span className="text-xs font-bold">Claro</span>
                                    </button>

                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                                            theme === 'dark'
                                                ? 'bg-cyan-600 text-white border-cyan-500 shadow-md'
                                                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <Moon className="w-6 h-6" />
                                        <span className="text-xs font-bold">Oscuro</span>
                                    </button>

                                    <button
                                        onClick={() => setTheme('system')}
                                        className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                                            theme === 'system'
                                                ? 'bg-cyan-600 text-white border-cyan-500 shadow-md'
                                                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <Monitor className="w-6 h-6" />
                                        <span className="text-xs font-bold">Sistema</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 8. DATOS Y SEGURIDAD */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('privacidad')}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">DATOS Y SEGURIDAD</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-400">Información del sistema y cierre de sesión</p>
                                </div>
                            </div>
                            {openSections.privacidad ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        {openSections.privacidad && (
                            <div className="p-6 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/40">
                                        <span className="font-bold">Versión del Sistema</span>
                                        <span>Sistema PAE v2.0 (PWA)</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/40">
                                        <span className="font-bold">Institución</span>
                                        <span>I.E. Barroblanco</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/40">
                                        <span className="font-bold">Motor de Datos</span>
                                        <span>Supabase PostgreSQL + Web Audio</span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full p-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-rose-200 dark:shadow-none transition-all active:scale-95"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        CERRAR SESIÓN
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Detail Modal */}
                {selectedDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
                        <div
                            className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-3xl w-full max-w-md shadow-2xl border border-white/50 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-300"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Detalle del Día</p>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white capitalize">{selectedDate.date}</h3>
                                </div>
                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-cyan-500" />
                                        Grupos Atendidos
                                    </h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {selectedDate.groups.map((g, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl shadow-xs">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-xs uppercase">
                                                        {g.grado}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">Grupo {g.grupo}</span>
                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(g.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="bg-cyan-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs">
                                                    {g.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Total procesado: <b className="text-gray-900 dark:text-white">{selectedDate.total} estudiantes</b>
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
