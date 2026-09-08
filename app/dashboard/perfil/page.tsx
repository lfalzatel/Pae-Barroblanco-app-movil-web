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
    Trophy,
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
import {
    hasLinkedBiometrics,
    registerBiometrics,
    clearBiometrics
} from '@/lib/webauthnService';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/components/ThemeProvider';
import confetti from 'canvas-confetti';
import PointsBurstAnimation from '@/components/PointsBurstAnimation';
import GamificationUnlockModal from '@/components/dashboard/GamificationUnlockModal';
import SoundSelectionModal, { SoundOption } from '@/components/dashboard/SoundSelectionModal';
import {
    getSoundPreference,
    setSoundPreference,
    getCategorySoundPref,
    setCategorySoundPref,
    playSynthesizedSound,
    playNavSound,
    speakVoiceConfirmation,
    SOUND_OPTIONS,
    ACTION_SOUND_OPTIONS,
    PARTICLE_SOUND_OPTIONS,
    SoundType
} from '@/lib/ui-sounds';
import { Sparkles, Music, Mic, Play, Eye } from 'lucide-react';

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

    // Inner Accordions State for Sonidos y Animaciones
    const [innerAccordions, setInnerAccordions] = useState<Record<string, boolean>>({
        accion: true,
        navegacion: true,
        animaciones: true,
    });

    const toggleInnerAccordion = (key: string) => {
        setInnerAccordions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Category Sounds State
    const [soundCategories, setSoundCategories] = useState({
        ingresos: 'arpegio',
        gastos: 'arpegio',
        ediciones: 'arpegio',
        eliminaciones: 'disolucion',
        navegacion: 'pop',
        particulas: 'cristalino_pentatonico',
    });

    useEffect(() => {
        setSoundCategories({
            ingresos: getCategorySoundPref('ingresos', 'arpegio'),
            gastos: getCategorySoundPref('gastos', 'arpegio'),
            ediciones: getCategorySoundPref('ediciones', 'arpegio'),
            eliminaciones: getCategorySoundPref('eliminaciones', 'disolucion'),
            navegacion: getSoundPreference(),
            particulas: getCategorySoundPref('particulas', 'cristalino_pentatonico'),
        });
    }, []);

    // Animation Toggles State & Gamification Test Modal
    const [isGamificationModalTestOpen, setIsGamificationModalTestOpen] = useState(false);
    const [animToggles, setAnimToggles] = useState({
        powerCard3D: true,
        celebracionConfeti: true,
        explosionParticulas: true, // PointsBurstAnimation
        modoHiperDopamina3D: false, // Celebración Hiper-Dopamina 3D (CookFlow)
        vozHabladaConfirmacion: true,
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pae_anim_toggles');
            if (saved) {
                try {
                    setAnimToggles(JSON.parse(saved));
                } catch (e) {}
            }
        }
    }, []);

    const toggleAnimSetting = (key: keyof typeof animToggles) => {
        setAnimToggles(prev => {
            let updated = { ...prev, [key]: !prev[key] };

            // Mutual Exclusivity: activating explosionParticulas turns off modoHiperDopamina3D and vice versa
            if (key === 'explosionParticulas' && updated.explosionParticulas) {
                updated.modoHiperDopamina3D = false;
            } else if (key === 'modoHiperDopamina3D' && updated.modoHiperDopamina3D) {
                updated.explosionParticulas = false;
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem('pae_anim_toggles', JSON.stringify(updated));
            }
            return updated;
        });
    };

    // Sound Selection Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        subtitle: string;
        options: SoundOption[];
        selectedId: string;
        categoryKey: string;
    }>({
        isOpen: false,
        title: '',
        subtitle: '',
        options: [],
        selectedId: '',
        categoryKey: '',
    });

    const openSoundModal = (
        title: string,
        subtitle: string,
        options: SoundOption[],
        categoryKey: keyof typeof soundCategories
    ) => {
        setModalConfig({
            isOpen: true,
            title,
            subtitle,
            options,
            selectedId: soundCategories[categoryKey],
            categoryKey,
        });
    };

    const handleSaveModalSound = (newSoundId: string) => {
        const key = modalConfig.categoryKey as keyof typeof soundCategories;
        setSoundCategories(prev => ({ ...prev, [key]: newSoundId }));
        if (key === 'navegacion') {
            setSoundPreference(newSoundId as SoundType);
            setSoundPref(newSoundId as SoundType);
        } else {
            setCategorySoundPref(key, newSoundId);
        }
        playSynthesizedSound(newSoundId);
    };

    // Test Preview Handlers & Particle Burst State
    const [pointsBurst, setPointsBurst] = useState<number | null>(null);

    const testConfettiPreview = () => {
        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
        });
    };

    const testParticlesPreview = () => {
        playSynthesizedSound(soundCategories.particulas);
        setPointsBurst(10);
    };

    const testVoicePreview = () => {
        speakVoiceConfirmation('Respuesta por voz al procesar comandos del Sistema PAE.');
    };

    // Push notification states
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [pushFeedback, setPushFeedback] = useState<string | null>(null);

    // Biometric state
    const [isBioLinked, setIsBioLinked] = useState(false);
    const [bioLoading, setBioLoading] = useState(false);

    useEffect(() => {
        setIsBioLinked(hasLinkedBiometrics());
    }, []);

    const handleLinkBiometrics = async () => {
        if (isBioLinked) {
            if (confirm('¿Deseas desvincular la biometría de este dispositivo?')) {
                clearBiometrics();
                setIsBioLinked(false);
                setPushFeedback('Biometría desvinculada correctamente de este dispositivo.');
            }
            return;
        }

        setBioLoading(true);
        const result = await registerBiometrics(
            usuario?.email || 'usuario@barroblanco.edu.co',
            usuario?.id || 'user_id'
        );
        setBioLoading(false);

        if (result.success) {
            setIsBioLinked(true);
            setPushFeedback(result.message);
        } else {
            setPushFeedback(result.message);
        }
    };

    // Accordion State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        cuenta: false,
        sonidos: false,
        gestion: false,
        notificaciones: false,
        recursos: false,
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

            if (!isCurrentlyOpen) {
                setTimeout(() => {
                    const el = document.getElementById(`section-${sectionKey}`);
                    if (el) {
                        const top = el.getBoundingClientRect().top + window.scrollY - 80;
                        window.scrollTo({ top, behavior: 'smooth' });
                    }
                }, 150);
            }

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

            const userPhoto = profile?.foto || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || session.user.user_metadata?.foto || null;

            if (profile) {
                setUsuario({
                    ...profile,
                    foto: userPhoto
                });
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
                    foto: userPhoto
                });
            }

            try {
                const rawRole = (profile?.rol || session.user.user_metadata?.rol || 'acudiente').toLowerCase();
                const isStudent = rawRole === 'estudiante' || rawRole === 'estudiante_pae';
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
            <div className="p-6 max-w-4xl mx-auto space-y-4">
                <Skeleton className="h-20 rounded-2xl w-full" />
                <div className="space-y-3">
                    <Skeleton className="h-16 rounded-2xl w-full" />
                    <Skeleton className="h-16 rounded-2xl w-full" />
                    <Skeleton className="h-16 rounded-2xl w-full" />
                </div>
            </div>
        );
    }

    // Role checks normalized for upper/lower case variations (e.g. 'admin', 'administrador', 'coordinador_pae')
    const userRoleLower = (usuario?.rol || 'acudiente').toLowerCase();
    const isStudent = userRoleLower === 'estudiante' || userRoleLower === 'estudiante_pae';
    const isAdminOrDocente = ['admin', 'administrador', 'coordinador', 'coordinador_pae', 'docente_pae', 'docente', 'secretaria_educacion'].includes(userRoleLower);

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
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent p-3 md:p-6">
            <div className="max-w-4xl mx-auto space-y-4">

                {/* Compact, Slim Header Banner */}
                <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-2xl p-4 md:p-5 text-white shadow-md flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 md:w-12 md:h-12 rounded-full border-2 border-white/40 shadow-md overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                            {usuario?.foto ? (
                                <img
                                    src={usuario.foto}
                                    alt={usuario.nombre}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <span className="text-lg md:text-xl font-black text-white">{usuario?.nombre?.charAt(0) || 'U'}</span>
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <h1 className="text-base md:text-xl font-black tracking-tight text-white truncate leading-tight">{usuario?.nombre || 'Usuario'}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-cyan-100 font-medium truncate">{usuario?.email}</span>
                                <span className="bg-white/20 text-white font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                    {usuario?.rol || 'Acudiente'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shrink-0">
                        <Award className="w-4 h-4 text-yellow-300 drop-shadow-xs" />
                        <span className="text-sm md:text-base font-black leading-none">{usuario?.puntos_gestor_pae || 0}</span>
                        <span className="text-[9px] font-bold text-cyan-100 uppercase tracking-wider hidden sm:inline">PTS</span>
                    </div>
                </div>

                {/* ACCORDION CONFIGURATION MENU */}
                <div className="space-y-2.5">

                    {/* 1. CUENTA Y PERFIL + ACTIVIDAD E HISTORIAL PAE */}
                    <div id="section-cuenta" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('cuenta')}
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">CUENTA Y PERFIL</h3>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-400">Información personal, estadísticas e historial PAE</p>
                                </div>
                            </div>
                            {openSections.cuenta ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>

                        {openSections.cuenta && (
                            <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-6 animate-in slide-in-from-top-2 duration-200">
                                {/* Informacion Personal */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre Completo</p>
                                        <p className="text-xs font-bold text-gray-800 dark:text-white mt-0.5">{usuario?.nombre || 'N/A'}</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Correo Institucional</p>
                                        <p className="text-xs font-bold text-gray-800 dark:text-white mt-0.5">{usuario?.email || 'N/A'}</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rol Asignado</p>
                                        <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 capitalize mt-0.5">{usuario?.rol || 'N/A'}</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sede Principal</p>
                                        <p className="text-xs font-bold text-gray-800 dark:text-white mt-0.5">{usuario?.sede || 'IE Barroblanco'}</p>
                                    </div>
                                </div>

                                {/* ACTIVIDAD E HISTORIAL PAE */}
                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                        <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">ACTIVIDAD E HISTORIAL PAE</h4>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                        <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-600 flex flex-col items-center text-center">
                                            <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xl font-black text-gray-900 dark:text-white">{displayStats.totalRegistros}</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Registros</span>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-600 flex flex-col items-center text-center">
                                            <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xl font-black text-gray-900 dark:text-white">{displayStats.diasActivos}</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Días Activos</span>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-600 flex flex-col items-center text-center">
                                            <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-1">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xl font-black text-gray-900 dark:text-white">{displayStats.gruposAtendidos}</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Grupos</span>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-600 flex flex-col items-center text-center">
                                            <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-1">
                                                <Clock className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-full">{displayStats.ultimoRegistro}</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Último</span>
                                        </div>
                                    </div>

                                    {/* Monthly Calendar */}
                                    <div className="bg-gray-50/50 dark:bg-gray-900/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                                                {isStudent ? 'Historial PAE' : 'Actividad Reciente'}
                                            </span>
                                            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-700 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600">
                                                <button
                                                    onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}
                                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors text-gray-700 dark:text-gray-200"
                                                >
                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="text-[11px] font-bold capitalize text-gray-800 dark:text-gray-100 min-w-[90px] text-center">
                                                    {currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                                                </span>
                                                <button
                                                    onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}
                                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors text-gray-700 dark:text-gray-200"
                                                >
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
                                            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                                                <div key={idx} className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-7 gap-1.5">
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
                                                            aspect-square rounded-xl flex flex-col items-center justify-center border transition-all text-xs font-bold
                                                            ${isFuture
                                                                ? 'opacity-20 bg-gray-100 dark:bg-gray-800 border-transparent text-gray-400'
                                                                : hasActivity
                                                                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-xs hover:scale-105 active:scale-95 cursor-pointer'
                                                                    : isWeekend
                                                                        ? 'bg-gray-100/70 dark:bg-gray-900/40 border-transparent text-gray-400'
                                                                        : 'bg-white dark:bg-gray-700/60 border-gray-100 dark:border-gray-600 text-gray-400'
                                                            }
                                                        `}
                                                    >
                                                        <span>{d.getDate()}</span>
                                                        {hasActivity && (
                                                            <span className="text-[8px] font-black opacity-90 leading-none mt-0.5">
                                                                {records.length}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. GESTIÓN Y ADMINISTRACIÓN DEL SISTEMA (Admins, Coordinadores, Docentes) */}
                    {isAdminOrDocente && (
                        <div id="section-gestion" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden transition-all">
                            <button
                                onClick={() => toggleSection('gestion')}
                                className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                        <Sliders className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">GESTIÓN Y ADMINISTRACIÓN DEL SISTEMA</h3>
                                        <p className="text-[11px] text-gray-400 dark:text-gray-400">Herramientas avanzadas, auditoría, mover masa y respaldos</p>
                                    </div>
                                </div>
                                {openSections.gestion ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </button>

                            {openSections.gestion && (
                                <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Acceso rápido a las funciones administrativas del sistema:</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        <button
                                            onClick={() => router.push('/dashboard/auditoria')}
                                            className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100/70 flex items-center justify-between text-left transition-all md:col-span-2"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">Auditoría del Sistema</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Registro de logs, eventos y cambios de seguridad</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-purple-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin?tab=move')}
                                            className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 hover:bg-blue-100/60 flex items-center justify-between text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300">
                                                    <ArrowRightLeft className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">Mover Masa</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Transferir estudiantes de grupo</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-blue-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin?tab=rename')}
                                            className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40 hover:bg-purple-100/60 flex items-center justify-between text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300">
                                                    <Edit3 className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">Renombrar Grupos</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Actualizar nombres institucionales</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-purple-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin?tab=sede')}
                                            className="p-3.5 rounded-xl bg-orange-50/60 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40 hover:bg-orange-100/60 flex items-center justify-between text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-800 dark:text-orange-300">
                                                    <MapPin className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">Cambiar Sede</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Asignar sede a cursos</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-orange-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin?tab=status')}
                                            className="p-3.5 rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 hover:bg-red-100/60 flex items-center justify-between text-left transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-300">
                                                    <ShieldAlert className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">Gestión de Estados</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Activo, retirado, graduado</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-red-500" />
                                        </button>

                                        <button
                                            onClick={() => router.push('/dashboard/admin?tab=backup')}
                                            className="p-3.5 rounded-xl bg-green-50/60 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40 hover:bg-green-100/60 flex items-center justify-between text-left transition-all md:col-span-2"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300">
                                                    <Database className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">Respaldos de Datos</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Exportar y asegurar la base de datos de asistencia</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-green-500" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. SONIDOS Y ANIMACIONES */}
                    <div id="section-sonidos" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('sonidos')}
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                    <Volume2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">SONIDOS Y ANIMACIONES</h3>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-400">Efectos sintetizados, navegación, partículas y asistente de voz</p>
                                </div>
                            </div>
                            {openSections.sonidos ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>

                        {openSections.sonidos && (
                            <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-4 animate-in slide-in-from-top-2 duration-200">

                                {/* BARRA DE VISTA PREVIA Y PRUEBAS EN VIVO */}
                                <div className="mt-4 p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                                            <Eye className="w-3.5 h-3.5 text-amber-500" /> Probador en Vivo de Animaciones y Voz
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={testConfettiPreview}
                                            className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-amber-100/50 dark:hover:bg-gray-600 border border-amber-200 dark:border-gray-600 text-[10px] font-black uppercase text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                                        >
                                            <span>🎉 Confeti</span>
                                        </button>
                                        <button
                                            id="btn-test-particles"
                                            type="button"
                                            onClick={testParticlesPreview}
                                            className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-amber-100/50 dark:hover:bg-gray-600 border border-amber-200 dark:border-gray-600 text-[10px] font-black uppercase text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                                        >
                                            <span>✨ Estrellas</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={testVoicePreview}
                                            className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-amber-100/50 dark:hover:bg-gray-600 border border-amber-200 dark:border-gray-600 text-[10px] font-black uppercase text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                                        >
                                            <span>🔊 Voz PAE</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => playSynthesizedSound(soundCategories.ingresos)}
                                            className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-amber-100/50 dark:hover:bg-gray-600 border border-amber-200 dark:border-gray-600 text-[10px] font-black uppercase text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                                        >
                                            <span>🎵 Tono Acción</span>
                                        </button>
                                    </div>
                                </div>

                                {/* ACORDEÓN INTERNO 1: SONIDOS POR ACCIÓN */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-700/30">
                                    <button
                                        type="button"
                                        onClick={() => toggleInnerAccordion('accion')}
                                        className="w-full p-3 bg-gray-100/80 dark:bg-gray-700/60 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 text-left"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                                <Music className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">SONIDOS POR ACCIÓN</h4>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase">Ingresos, Gastos, Ediciones y Eliminaciones</p>
                                            </div>
                                        </div>
                                        {innerAccordions.accion ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </button>

                                    {innerAccordions.accion && (
                                        <div className="divide-y divide-gray-200/60 dark:divide-gray-700/60">
                                            {/* Ingresos */}
                                            <div
                                                onClick={() => openSoundModal(
                                                    'SONIDO DE INGRESOS Y ABONOS',
                                                    'Efecto auditivo al registrar entradas',
                                                    ACTION_SOUND_OPTIONS,
                                                    'ingresos'
                                                )}
                                                className="p-3.5 flex items-center justify-between hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                            >
                                                <div>
                                                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">INGRESOS Y ABONOS</p>
                                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1 mt-0.5">
                                                        <span>🎵</span> <span>{ACTION_SOUND_OPTIONS.find(o => o.id === soundCategories.ingresos)?.label || 'Arpegio Sintetizado'}</span>
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>

                                            {/* Gastos */}
                                            <div
                                                onClick={() => openSoundModal(
                                                    'SONIDO DE GASTOS Y SALIDAS',
                                                    'Efecto auditivo al registrar salidas',
                                                    ACTION_SOUND_OPTIONS,
                                                    'gastos'
                                                )}
                                                className="p-3.5 flex items-center justify-between hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                            >
                                                <div>
                                                    <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">GASTOS</p>
                                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1 mt-0.5">
                                                        <span>🎵</span> <span>{ACTION_SOUND_OPTIONS.find(o => o.id === soundCategories.gastos)?.label || 'Arpegio Sintetizado'}</span>
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>

                                            {/* Ediciones */}
                                            <div
                                                onClick={() => openSoundModal(
                                                    'SONIDO DE EDICIONES',
                                                    'Efecto auditivo al actualizar un registro',
                                                    ACTION_SOUND_OPTIONS,
                                                    'ediciones'
                                                )}
                                                className="p-3.5 flex items-center justify-between hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                            >
                                                <div>
                                                    <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">EDICIONES</p>
                                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1 mt-0.5">
                                                        <span>🎵</span> <span>{ACTION_SOUND_OPTIONS.find(o => o.id === soundCategories.ediciones)?.label || 'Arpegio Sintetizado'}</span>
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>

                                            {/* Eliminaciones */}
                                            <div
                                                onClick={() => openSoundModal(
                                                    'SONIDO DE ELIMINACIONES',
                                                    'Efecto auditivo al remover o borrar un registro',
                                                    ACTION_SOUND_OPTIONS,
                                                    'eliminaciones'
                                                )}
                                                className="p-3.5 flex items-center justify-between hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                            >
                                                <div>
                                                    <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider">ELIMINACIONES</p>
                                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1 mt-0.5">
                                                        <span>🌌</span> <span>{ACTION_SOUND_OPTIONS.find(o => o.id === soundCategories.eliminaciones)?.label || 'Disolución Armónica'}</span>
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ACORDEÓN INTERNO 2: NAVEGACIÓN Y EFECTOS */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-700/30">
                                    <button
                                        type="button"
                                        onClick={() => toggleInnerAccordion('navegacion')}
                                        className="w-full p-3 bg-gray-100/80 dark:bg-gray-700/60 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 text-left"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
                                                <Volume2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">NAVEGACIÓN Y EFECTOS</h4>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase">Menú inferior y partículas voladoras</p>
                                            </div>
                                        </div>
                                        {innerAccordions.navegacion ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </button>

                                    {innerAccordions.navegacion && (
                                        <div className="divide-y divide-gray-200/60 dark:divide-gray-700/60">
                                            {/* Menú Inferior */}
                                            <div
                                                onClick={() => openSoundModal(
                                                    'SONIDO DE NAVEGACIÓN (PAE)',
                                                    'Micro-feedback al tocar el menú inferior y pestañas',
                                                    SOUND_OPTIONS.map(s => ({ ...s, description: s.description })),
                                                    'navegacion'
                                                )}
                                                className="p-3.5 flex items-center justify-between hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                            >
                                                <div>
                                                    <p className="text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">MENÚ INFERIOR & NAVEGACIÓN (PAE)</p>
                                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1 mt-0.5">
                                                        <span>🍿</span> <span>{SOUND_OPTIONS.find(o => o.id === soundCategories.navegacion)?.label || 'Pop / Burbuja (Estilo iOS)'}</span>
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>

                                            {/* Partículas Voladoras */}
                                            <div
                                                onClick={() => openSoundModal(
                                                    'SONIDO DE PARTÍCULAS VOLADORAS',
                                                    'Efecto auditivo durante la animación de partículas',
                                                    PARTICLE_SOUND_OPTIONS,
                                                    'particulas'
                                                )}
                                                className="p-3.5 flex items-center justify-between hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                            >
                                                <div>
                                                    <p className="text-xs font-black text-fuchsia-600 dark:text-fuchsia-400 uppercase tracking-wider">PARTÍCULAS VOLADORAS</p>
                                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1 mt-0.5">
                                                        <span>🔮</span> <span>{PARTICLE_SOUND_OPTIONS.find(o => o.id === soundCategories.particulas)?.label || 'Cristalino Pentatónico'}</span>
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ACORDEÓN INTERNO 3: ANIMACIONES VISUALES Y VOZ */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-700/30">
                                    <button
                                        type="button"
                                        onClick={() => toggleInnerAccordion('animaciones')}
                                        className="w-full p-3 bg-gray-100/80 dark:bg-gray-700/60 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 text-left"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                                                <Sparkles className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">ANIMACIONES VISUALES Y VOZ</h4>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase">Tarjeta 3D, confeti, explosiones y asistente</p>
                                            </div>
                                        </div>
                                        {innerAccordions.animaciones ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </button>

                                    {innerAccordions.animaciones && (
                                        <div className="p-3 space-y-2.5 bg-white dark:bg-gray-800">
                                            {/* Switch 1: Tarjeta 3D */}
                                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">TARJETA 3D CENTRAL (POWER CARD)</p>
                                                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase mt-0.5">Efecto 3D holográfico en la tarjeta principal</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAnimSetting('powerCard3D')}
                                                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                                                        animToggles.powerCard3D ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${animToggles.powerCard3D ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {/* Switch 2: Celebración y Confeti */}
                                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1">
                                                        <span>CELEBRACIÓN Y CONFETI</span> <span>🎉</span>
                                                    </p>
                                                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase mt-0.5">Lluvia de confeti al guardar registros</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAnimSetting('celebracionConfeti')}
                                                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                                                        animToggles.celebracionConfeti ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${animToggles.celebracionConfeti ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                            {/* Switch 3: Explosión de Partículas y Estrellas (PointsBurstAnimation) */}
                                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-black text-cyan-700 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                                                        <span>EXPLOSIÓN DE ESTRELLAS (PointsBurst)</span> <span>✨</span>
                                                    </p>
                                                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase mt-0.5">Trayectoria voladora hacia la cápsula de perfil / saldo (Mutuamente exclusivo)</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAnimSetting('explosionParticulas')}
                                                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                                                        animToggles.explosionParticulas ? 'bg-cyan-500' : 'bg-gray-300 dark:bg-gray-600'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${animToggles.explosionParticulas ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {/* Switch 4: Modo Hiper-Dopamina 3D (CookFlow / Temu) */}
                                            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 dark:from-amber-900/30 dark:via-yellow-900/30 dark:to-amber-900/30 border border-amber-300/50 dark:border-amber-700/50 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                                                        <span>CELEBRACIÓN HIPER-DOPAMINA 3D (COOKFLOW)</span> <span>🏆</span>
                                                    </p>
                                                    <p className="text-[10px] font-semibold text-amber-600/80 dark:text-amber-400/80 uppercase mt-0.5">Sunburst 360°, carta 3D flip y recompensas PAE (Mutuamente exclusivo)</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAnimSetting('modoHiperDopamina3D')}
                                                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                                                        animToggles.modoHiperDopamina3D ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${animToggles.modoHiperDopamina3D ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {/* Switch 5: Voz Hablada */}
                                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                                                        <span>VOZ HABLADA DE CONFIRMACIÓN</span> <span>🔊</span>
                                                    </p>
                                                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase mt-0.5">Respuesta por voz al procesar comandos</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAnimSetting('vozHabladaConfirmacion')}
                                                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                                                        animToggles.vozHabladaConfirmacion ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${animToggles.vozHabladaConfirmacion ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {/* Botón para Probar Animación 3D Hiper-Dopamina */}
                                            <div className="pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsGamificationModalTestOpen(true)}
                                                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
                                                >
                                                    <Trophy className="w-4 h-4 fill-slate-950" /> Probar Celebración Hiper-Dopamina 3D 🏆
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>

                    {/* 4. NOTIFICACIONES Y ALERTAS PUSH */}
                    <div id="section-notificaciones" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('notificaciones')}
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">NOTIFICACIONES Y ALERTAS PUSH</h3>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-400">Activar o desactivar notificaciones y probar alertas push</p>
                                </div>
                            </div>
                            {openSections.notificaciones ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>

                        {openSections.notificaciones && (
                            <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 leading-relaxed">
                                    Recibe alertas instantáneas de cambios en el horario del PAE y novedades institucionales directamente en tu dispositivo.
                                </p>

                                {pushFeedback && (
                                    <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-800 text-xs font-bold text-cyan-800 dark:text-cyan-200 flex items-center justify-between">
                                        <span>{pushFeedback}</span>
                                        <button onClick={() => setPushFeedback(null)} className="text-cyan-600 hover:opacity-80">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    <button
                                        onClick={handleTogglePush}
                                        disabled={pushLoading}
                                        className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                                            isSubscribed
                                                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-xs'
                                                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isSubscribed ? <Bell className="w-5 h-5 animate-pulse" /> : <BellOff className="w-5 h-5 text-gray-400" />}
                                            <div>
                                                <p className={`text-xs font-bold ${isSubscribed ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                    {isSubscribed ? 'Notificaciones Activadas' : 'Notificaciones Desactivadas'}
                                                </p>
                                                <p className={`text-[10px] ${isSubscribed ? 'text-emerald-100' : 'text-gray-400'}`}>
                                                    {pushLoading ? 'Procesando...' : (isSubscribed ? 'Recibiendo alertas push' : 'Toca para activar')}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-lg border ${isSubscribed ? 'bg-white/20 border-white/30 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600'}`}>
                                            {isSubscribed ? 'ACTIVAS' : 'ACTIVAR'}
                                        </span>
                                    </button>

                                    <button
                                        onClick={handleTestNotification}
                                        disabled={testLoading}
                                        className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100/70 flex items-center justify-between text-left transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300">
                                                <Send className={`w-4 h-4 ${testLoading ? 'animate-spin' : ''}`} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">Probar Notificación</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400">Emitir alerta de prueba en el dispositivo</p>
                                            </div>
                                        </div>
                                        <span className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg shadow-xs group-hover:scale-105 transition-transform">
                                            {testLoading ? 'PROBANDO...' : 'PROBAR'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. RECURSOS EXTERNOS Y HERRAMIENTAS */}
                    <div id="section-recursos" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('recursos')}
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">RECURSOS EXTERNOS Y HERRAMIENTAS</h3>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-400">Enlaces institucionales, PWA, biometría y compartir</p>
                                </div>
                            </div>
                            {openSections.recursos ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>

                        {openSections.recursos && (
                            <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Herramientas y accesos complementarios de la aplicación:</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    <button
                                        onClick={() => router.push('/dashboard/novedades')}
                                        className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 hover:bg-teal-100/70 flex items-center justify-between text-left transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-800 dark:text-teal-300">
                                                <Globe className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">Recursos Externos</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400">Novedades y planillas institucionales</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-teal-500" />
                                    </button>

                                    <button
                                        onClick={handleShareApp}
                                        className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100/70 flex items-center justify-between text-left transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-800 dark:text-emerald-300">
                                                <Share2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">Compartir Aplicación</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400">Enviar enlace a docentes o acudientes</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-emerald-500" />
                                    </button>

                                     <button
                                         onClick={handleLinkBiometrics}
                                         disabled={bioLoading}
                                         className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                                             isBioLinked
                                                 ? 'bg-purple-100/80 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700'
                                                 : 'bg-purple-50/70 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40 hover:bg-purple-100/70'
                                         }`}
                                     >
                                         <div className="flex items-center gap-3">
                                             <div className={`p-2 rounded-lg ${isBioLinked ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300'}`}>
                                                 <Fingerprint className="w-4 h-4" />
                                             </div>
                                             <div>
                                                 <p className="text-xs font-bold text-gray-900 dark:text-white">
                                                     {bioLoading ? 'Procesando...' : isBioLinked ? 'Biometría Vinculada (Activa)' : 'Vincular Biometría'}
                                                 </p>
                                                 <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                     {isBioLinked ? 'Toca para desvincular Huella o FaceID' : 'Configurar Huella o FaceID'}
                                                 </p>
                                             </div>
                                         </div>
                                         <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${isBioLinked ? 'bg-purple-600 text-white' : 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200'}`}>
                                             {isBioLinked ? 'ACTIVA' : 'VINCULAR'}
                                         </span>
                                     </button>

                                    <button
                                        onClick={() => alert('Si estás usando un navegador compatible, usa la opción "Agregar a la pantalla de inicio".')}
                                        className="p-3.5 rounded-xl bg-green-50/70 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 hover:bg-green-100/70 flex items-center justify-between text-left transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300">
                                                <Download className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">Instalar Aplicación (PWA)</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400">Instalar versión de acceso rápido</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-green-500" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 6. APARIENCIA Y TEMA */}
                    <div id="section-apariencia" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('apariencia')}
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                    <Palette className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">APARIENCIA Y TEMA</h3>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-400">Personaliza la interfaz visual de la aplicación</p>
                                </div>
                            </div>
                            {openSections.apariencia ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>

                        {openSections.apariencia && (
                            <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Elige el tema de pantalla preferido:</p>

                                <div className="grid grid-cols-3 gap-2.5">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                                            theme === 'light'
                                                ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                                                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <Sun className="w-5 h-5" />
                                        <span className="text-xs font-bold">Claro</span>
                                    </button>

                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                                            theme === 'dark'
                                                ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                                                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <Moon className="w-5 h-5" />
                                        <span className="text-xs font-bold">Oscuro</span>
                                    </button>

                                    <button
                                        onClick={() => setTheme('system')}
                                        className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                                            theme === 'system'
                                                ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                                                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <Monitor className="w-5 h-5" />
                                        <span className="text-xs font-bold">Sistema</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 7. DATOS Y SEGURIDAD */}
                    <div id="section-privacidad" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden transition-all">
                        <button
                            onClick={() => toggleSection('privacidad')}
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">DATOS Y SEGURIDAD</h3>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-400">Información del sistema y cierre de sesión</p>
                                </div>
                            </div>
                            {openSections.privacidad ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>

                        {openSections.privacidad && (
                            <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-1.5 mt-4 text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/40">
                                        <span className="font-bold">Versión del Sistema</span>
                                        <span>Sistema PAE v2.0 (PWA)</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/40">
                                        <span className="font-bold">Institución</span>
                                        <span>I.E. Barroblanco</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/40">
                                        <span className="font-bold">Motor de Datos</span>
                                        <span>Supabase PostgreSQL + Web Audio</span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full p-3.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                                    >
                                        <LogOut className="w-4 h-4" />
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
                            className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md shadow-2xl border border-white/50 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-300"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Detalle del Día</p>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white capitalize">{selectedDate.date}</h3>
                                </div>
                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            <div className="p-5 space-y-5">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-cyan-500" />
                                        Grupos Atendidos
                                    </h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {selectedDate.groups.map((g, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl shadow-xs">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-xs uppercase">
                                                        {g.grado}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-700 dark:text-gray-200 text-xs">Grupo {g.grupo}</span>
                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(g.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg shadow-xs">
                                                    {g.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Total procesado: <b className="text-gray-900 dark:text-white">{selectedDate.total} estudiantes</b>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Selección de Sonidos */}
                <SoundSelectionModal
                    isOpen={modalConfig.isOpen}
                    onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                    title={modalConfig.title}
                    subtitle={modalConfig.subtitle}
                    options={modalConfig.options}
                    selectedId={modalConfig.selectedId}
                    onSave={handleSaveModalSound}
                    onPreviewSound={playSynthesizedSound}
                />

                {/* Animación Real de Estrellas Voladoras en Prueba */}
                {pointsBurst !== null && (
                    <PointsBurstAnimation
                        points={pointsBurst}
                        targetSelector="[data-points-capsule]"
                        originSelector="#btn-test-particles"
                        onComplete={() => setPointsBurst(null)}
                    />
                )}

                {/* Modal de Recompensa Gamificada 3D (CookFlow / Temu) */}
                <GamificationUnlockModal
                    isOpen={isGamificationModalTestOpen}
                    onClose={() => setIsGamificationModalTestOpen(false)}
                    title="¡Asistencia Confirmada PAE!"
                    points={50}
                    rewardText="¡Excelente puntualidad en la entrega del refrigerio!"
                    badgeName="Estudiante Campeón PAE"
                />
            </div>
        </div>
    );
}
