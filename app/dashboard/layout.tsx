'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import {
    Home,
    ClipboardList,
    Users,
    BarChart3,
    LogOut,
    Settings,
    ChevronUp,
    ChevronDown,
    User,
    Menu,
    Calendar,
    Bell,
    CheckCircle,
    Clock,
    FileText,
    Info,
    X,
    RefreshCcw,
    AlertCircle,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Download,
    School,
    Sun,
    Moon,
    Monitor,
    Fingerprint,
    AlertTriangle,
    Share2,
    Globe
} from 'lucide-react';
import { MiniCalendar } from '@/components/ui/MiniCalendar';
import { useTheme } from '@/components/ThemeProvider';
import { getAcademicBlock } from '@/lib/schedule-utils';
import GlobalNotificationsModal from '@/components/dashboard/GlobalNotificationsModal';
import { useSplash } from '@/components/SplashScreenProvider';

// Helper functions defined outside to avoid initialization errors
const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getNextBusinessDay = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 5) { d.setDate(d.getDate() + 3); }
    else if (day === 6) { d.setDate(d.getDate() + 2); }
    else if (day === 0) { d.setDate(d.getDate() + 1); }
    else { d.setDate(d.getDate() + 1); }
    return d;
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const { finishManualSplash, startManualSplash } = useSplash();
    const [usuario, setUsuario] = useState<any | null>(null);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

    const handleShareApp = async () => {
        const shareData = {
            title: 'Sistema PAE - IE Barroblanco',
            text: 'Conoce y utiliza el Sistema PAE de la IE Barroblanco',
            url: 'https://pae-barroblanco-app-movil-web.vercel.app/',
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                alert('Enlace copiado al portapapeles');
            }
        } catch (err) {
            console.error('Error al compartir:', err);
        }
    };

    // Notifications State
    const [notifModalOpen, setNotifModalOpen] = useState(false);
    const [activeNotifTab, setActiveNotifTab] = useState<'daily' | 'weekly'>('daily');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [searchResult, setSearchResult] = useState<any | null>(null);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [showSedeDropdown, setShowSedeDropdown] = useState(false);
    const [selectedSede, setSelectedSede] = useState('Principal');
    const [notifEvents, setNotifEvents] = useState<any[]>([]);
    const [isWeeklySearching, setIsWeeklySearching] = useState(false);
    const [weekStart, setWeekStart] = useState<Date>(new Date());
    const [dailySubTab, setDailySubTab] = useState<'today' | 'tomorrow'>(() => {
        const d = new Date();
        const hour = d.getHours();
        const day = d.getDay();
        if (day >= 5 && hour >= 18) return 'tomorrow';
        if (day === 6 || day === 0) return 'tomorrow';
        return hour >= 18 ? 'tomorrow' : 'today';
    });
    const [selectedDayInWeek, setSelectedDayInWeek] = useState(0);

    const [hasNotification, setHasNotification] = useState(false);
    const [groupExceptions, setGroupExceptions] = useState<{ notAttending: any[], otherNotes: any[] }>({ notAttending: [], otherNotes: [] });

    // Initial Date Logic for Notification Modal
    useEffect(() => {
        if (notifModalOpen) {
            // Reset search state when opening
            setSelectedDate('');
            setSearchResult(null);

            const now = new Date();
            const day = now.getDay();
            const hour = now.getHours();

            let newSelectedDay = 0;
            if (day >= 1 && day <= 4) {
                if (hour >= 18) newSelectedDay = day;
                else newSelectedDay = day - 1;
            } else if (day === 5) {
                if (hour >= 18) newSelectedDay = 0;
                else newSelectedDay = 4;
            } else {
                newSelectedDay = 0;
            }
            setSelectedDayInWeek(newSelectedDay);

            const d = new Date(now);
            if ((day === 5 && hour >= 18) || day === 6 || day === 0) {
                const daysToAdd = day === 5 ? 3 : (day === 6 ? 2 : 1);
                d.setDate(d.getDate() + daysToAdd);
            } else {
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                d.setDate(diff);
            }
            d.setHours(0, 0, 0, 0);
            setWeekStart(d);

            fetchNotifEvents(d);

            if (activeNotifTab === 'daily') {
                const targetD = dailySubTab === 'tomorrow' ? getNextBusinessDay(now) : now;
                fetchDailyExceptions(formatLocalDate(targetD));
            }
        }
    }, [notifModalOpen]);

    // Fetch Daily Exceptions when selection changes
    useEffect(() => {
        if (activeNotifTab === 'daily') {
            const now = new Date();
            let targetDateStr = '';
            
            if (selectedDate) {
                targetDateStr = selectedDate;
            } else {
                const targetD = dailySubTab === 'tomorrow' ? getNextBusinessDay(now) : now;
                targetDateStr = formatLocalDate(targetD);
            }
            
            fetchDailyExceptions(targetDateStr);
        }
    }, [dailySubTab, activeNotifTab, selectedSede, selectedDate]);

    const fetchDailyExceptions = async (dateStr: string) => {
        // dateStr is already YYYY-MM-DD from caller
        try {
            const { data } = await supabase
                .from('schedules')
                .select('items')
                .eq('date', dateStr)
                .maybeSingle();

            if (data?.items) {
                const rawItems = data.items;
                const relevant = rawItems.filter((i: any) => {
                    const isSedeMatch = selectedSede === 'Todas' || !i.sede || (i.sede && i.sede.includes(selectedSede));
                    const isTimeMatch = i.time === 'NO_ASISTE';
                    const hasNotes = !!i.notes;
                    return isSedeMatch && (isTimeMatch || hasNotes);
                });

                if (relevant.length === 0) {
                    setGroupExceptions({ notAttending: [], otherNotes: [] });
                    setHasNotification(false);
                    return;
                }

                const uniqueGroups = Array.from(new Set(relevant.map((i: any) => i.group)));
                const { data: countsData } = await supabase
                    .from('estudiantes')
                    .select('grupo')
                    .in('grupo', uniqueGroups);

                const countsMap: Record<string, number> = {};
                countsData?.forEach((s: any) => {
                    countsMap[s.grupo] = (countsMap[s.grupo] || 0) + 1;
                });

                const mapped = relevant.map((i: any) => ({
                    ...i,
                    studentCount: countsMap[i.group] || 0
                })).sort((a: any, b: any) => {
                    const getMins = (str: string) => {
                        const match = (str || '').match(/(\d{1,2})[:.](\d{2})\s*(am|pm|AM|PM)?/i);
                        if (!match) return 0;
                        let [_, h, m, mod] = match;
                        let hours = parseInt(h);
                        let mins = parseInt(m);
                        if (mod) {
                            mod = mod.toLowerCase();
                            if (mod === 'pm' && hours < 12) hours += 12;
                            if (mod === 'am' && hours === 12) hours = 0;
                        }
                        return hours * 60 + mins;
                    };
                    const timeA = getMins(a.notes);
                    const timeB = getMins(b.notes);
                    if (timeA !== timeB) return timeA - timeB;
                    return a.group.localeCompare(b.group);
                });

                const notAttending = mapped.filter((i: any) => i.time === 'NO_ASISTE');
                const otherNotes = mapped.filter((i: any) => i.time !== 'NO_ASISTE');

                setGroupExceptions({ notAttending, otherNotes });
                setHasNotification(notAttending.length > 0 || otherNotes.length > 0);
            } else {
                setGroupExceptions({ notAttending: [], otherNotes: [] });
                setHasNotification(false);
            }
        } catch (error) {
            console.error('Error fetching exceptions:', error);
            setGroupExceptions({ notAttending: [], otherNotes: [] });
            setHasNotification(false);
        }
    };

    const timeToMinutes = (timeStr: string) => {
        if (!timeStr) return 9999;
        const clean = timeStr.toLowerCase().trim();
        let modifier = clean.includes('pm') ? 'pm' : clean.includes('am') ? 'am' : clean.includes('m') ? 'pm' : '';
        let timePart = clean.replace(/[apm\s\.]/g, '');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (isNaN(hours)) return 9999;
        if (isNaN(minutes)) minutes = 0;
        if (modifier === 'pm' && hours < 12) hours += 12;
        if (modifier === 'am' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const fetchNotifEvents = async (startDate: Date) => {
        setIsWeeklySearching(true);
        try {
            const dates = [];
            for (let i = 0; i < 5; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                dates.push(formatLocalDate(d));
            }

            let query = supabase
                .from('novedades_institucionales')
                .select('*')
                .in('fecha', dates)
                .order('hora', { ascending: true });

            const { data, error } = await query;
            if (error) throw error;

            const sortedData = (data || []).sort((a: any, b: any) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
            setNotifEvents(sortedData);
        } catch (error) {
            console.error('Error fetching notifs:', error);
        } finally {
            setIsWeeklySearching(false);
        }
    };

    const changeNotifWeek = (offset: number) => {
        const newStart = new Date(weekStart);
        newStart.setDate(newStart.getDate() + (offset * 7));
        setWeekStart(newStart);
        fetchNotifEvents(newStart);
    };



    const getFilteredEvents = () => {
        if (activeNotifTab === 'weekly') {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + selectedDayInWeek);
            const targetDateStr = formatLocalDate(d);
            return notifEvents.filter(e => e.fecha === targetDateStr);
        }

        if (searchResult) return [searchResult];

        let targetDateStr = '';
    if (activeNotifTab === 'daily') {
        const d = new Date();
        if (dailySubTab === 'tomorrow') {
            const nextDay = getNextBusinessDay(d);
            targetDateStr = formatLocalDate(nextDay);
        } else {
            targetDateStr = formatLocalDate(d);
        }
    }

        if (selectedDate) return notifEvents.filter(e => e.fecha === selectedDate);
        return notifEvents.filter(e => e.fecha === targetDateStr);
    };

    const currentEvents = getFilteredEvents();

    const todayDateLabel = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const tomorrowDateLabel = getNextBusinessDay(new Date()).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const handleBiometricSetup = () => {
        alert('Configuración de biometría en desarrollo.');
    };



    const handleSearchByDate = (date: string) => {
        setSelectedDate(date);

        // Update weekStart to the week of the selected date so fetchNotifEvents gets the data
        const d = new Date(date + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const newWeekStart = new Date(d.setDate(diff));
        setWeekStart(newWeekStart);

        // Fetch events for the selected week to ensure data is available
        fetchNotifEvents(newWeekStart);

        // Fetch daily exceptions (notes/attendance) for that specific date
        // Pass the date string directly (YYYY-MM-DD)
        fetchDailyExceptions(date);

        setSearchResult(null);
    };

    // Efecto para detectar si venimos de un login de Google y mostrar el Splash
    useEffect(() => {
        const showGoogleSplash = localStorage.getItem('pae_show_google_splash');
        if (showGoogleSplash === 'true') {
            localStorage.removeItem('pae_show_google_splash');
            startManualSplash([
                'Autenticación de Google exitosa',
                'Sincronizando con Supabase...',
                '¡Bienvenido de nuevo!'
            ]);
        }
    }, [startManualSplash]);

    useEffect(() => {
        const checkUser = async () => {
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
                // Determine if we need to auto-assign the "acudiente" role for new external users
                let userRole = session.user.user_metadata?.rol;
                const userEmail = session.user.email || '';
                
                // If the user has no defined role and does not belong to the institution
                if (!userRole && !userEmail.endsWith('@barroblanco.edu.co')) {
                    userRole = 'acudiente';
                    
                    // Persist this default role back to Auth metadata so it survives re-logins
                    await supabase.auth.updateUser({
                        data: { rol: 'acudiente' }
                    });
                }

                setUsuario({
                    nombre: session.user.user_metadata?.nombre || 'Usuario',
                    email: userEmail,
                    rol: userRole || 'acudiente', // Keep fallback just in case
                    foto: session.user.user_metadata?.foto || null
                });
            }

            // Notificar al Splash que el Dashboard está listo
            finishManualSplash();
        };

        checkUser();

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                // El redireccionamiento ya se maneja en handleLogout coordinado con el Splash
                // Solo actuamos aquí si el evento viene de fuera (ej. otra pestaña)
                if (window.location.pathname.startsWith('/dashboard')) {
                    router.replace('/');
                }
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [router]);

    const handleLogout = async () => {
        try {
            // 1. Activar Splash inmediatamente
            startManualSplash([
                'Cerrando sesión...',
                'Limpiando datos localmente...',
                '¡Vuelve pronto!'
            ]);

            // 2. Pequeña espera para que el Splash se monte visualmente
            await new Promise(resolve => setTimeout(resolve, 100));

            // 3. Cerrar sesión en Supabase
            await supabase.auth.signOut();
            
            // 4. Limpiar almacenamiento
            localStorage.clear();
            sessionStorage.clear();
            
            // 5. Redirección suave vía router (mantiene el Splash vivo)
            router.replace('/');
        } catch (error) {
            console.error('Error signing out:', error);
            // Fallback en caso de error crítico
            window.location.href = '/';
        }
    };

    const navItems = [
        { href: '/dashboard', label: 'Inicio', icon: Home },
    ];

    if (['admin', 'coordinador_pae', 'docente', 'estudiante_pae'].includes(usuario?.rol)) {
        navItems.push({ href: '/dashboard/registro', label: 'Registrar', icon: ClipboardList });
        navItems.push({ href: '/dashboard/gestion', label: 'Gestión', icon: Users });
    }

    if (!['estudiante', 'acudiente'].includes(usuario?.rol)) {
        navItems.push({ href: '/dashboard/reportes', label: 'Reportes', icon: BarChart3 });
    }

    if (['admin', 'coordinador_pae'].includes(usuario?.rol)) {
        navItems.push({ href: '/dashboard/horario', label: 'Horario', icon: Calendar });
    }

    if (['admin', 'coordinador_pae', 'secretaria_educacion'].includes(usuario?.rol)) {
        navItems.push({ href: '/dashboard/novedades', label: 'Recursos Externos', icon: Globe });
    }

    const touchStartRef = useRef<{ x: number, y: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const currentNavIndex = navItems.findIndex(item => item.href === pathname);

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        const diffX = touchStartRef.current.x - touchEnd.x;
        const diffY = touchStartRef.current.y - touchEnd.y;
        touchStartRef.current = null;

        if (notifModalOpen) return;

        // Block gestures if any modal is open (common z-index or overlays)
        const isModalOpen = !!document.querySelector('.fixed.inset-0.z-\\[200\\]') ||
            !!document.querySelector('.fixed.inset-0.z-\\[9999\\]');
        if (isModalOpen) return;

        if (Math.abs(diffX) > 75 && Math.abs(diffX) > Math.abs(diffY) * 2) {
            if (currentNavIndex === -1) return;
            if (diffX > 0) {
                if (currentNavIndex < navItems.length - 1) {
                    router.replace(navItems[currentNavIndex + 1].href);
                }
            } else {
                if (currentNavIndex > 0) {
                    router.replace(navItems[currentNavIndex - 1].href);
                }
            }
        }
    };

// ... inside DashboardLayout function ...

    if (!usuario) {
        return null; // El Splash Screen global cubre la carga inicial
    }

    return (
        <div
            className="min-h-screen bg-gray-50 flex flex-col md:flex-row dark:bg-gray-900 transition-colors duration-300"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700 transition-colors">
                <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-start gap-3 bg-blue-50/50 dark:bg-gray-800">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 dark:text-white leading-tight">Sistema PAE</h1>
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Barroblanco</p>
                    </div>
                </div>

                <div className="px-4 py-2">
                    <button
                        onClick={() => {
                            setNotifModalOpen(true);
                            setHasNotification(false);
                        }}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:border-blue-200 transition-all group dark:bg-gray-700/50 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-500"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Bell className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:text-gray-300 dark:group-hover:text-blue-400" />
                                {hasNotification && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />}
                            </div>
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Notificaciones</span>
                        </div>
                        {hasNotification && <span className="bg-red-100 text-red-600 text-[8px] font-black px-1.5 py-0.5 rounded-full dark:bg-red-900/30 dark:text-red-400">NUEVO</span>}
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}

                    {usuario?.rol === 'admin' && (
                        <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                            <button
                                onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-colors ${isAdminMenuOpen
                                    ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Settings className="w-5 h-5" />
                                    <span>Administración</span>
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isAdminMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isAdminMenuOpen && (
                                <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <Link
                                        href="/dashboard/admin"
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-2 ${pathname === '/dashboard/admin'
                                            ? 'border-purple-500 bg-purple-50/50 text-purple-700 dark:bg-purple-900/10 dark:text-purple-300'
                                            : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/30'
                                            }`}
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                        Configuración
                                    </Link>
                                    <Link
                                        href="/dashboard/auditoria"
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-2 ${pathname === '/dashboard/auditoria'
                                            ? 'border-purple-500 bg-purple-50/50 text-purple-700 dark:bg-purple-900/10 dark:text-purple-300'
                                            : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/30'
                                            }`}
                                    >
                                        <FileText className="w-4 h-4" />
                                        Auditoría
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </nav>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm w-full hover:bg-gray-50 transition-colors text-left dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                        >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold overflow-hidden shadow-inner dark:bg-blue-900/30 dark:text-blue-400">
                                {usuario.foto ? (
                                    <img src={usuario.foto} alt={usuario.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <span className="text-[#00A3E0] font-bold text-xs">
                                        {usuario.nombre.charAt(0)}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-bold text-gray-900 truncate dark:text-white">{usuario.nombre}</span>
                                <span className="text-[10px] font-medium text-gray-500 uppercase dark:text-gray-400">{usuario.rol === 'coordinador_pae' ? 'Coordinador' : usuario.rol}</span>
                            </div>
                            <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isProfileMenuOpen && (
                            <div className="absolute bottom-full mb-2 left-0 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200 dark:bg-gray-800 dark:border-gray-700">
                                <Link
                                    href="/dashboard/perfil"
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:text-gray-200 dark:hover:bg-gray-700"
                                    onClick={() => setIsProfileMenuOpen(false)}
                                >
                                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    Mi Perfil
                                </Link>

                                <button
                                    onClick={() => {
                                        setIsProfileMenuOpen(false);
                                        handleShareApp();
                                    }}
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    Compartir Aplicación
                                </button>

                                <button
                                    onClick={() => {
                                        setIsProfileMenuOpen(false);
                                        handleBiometricSetup();
                                    }}
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <Fingerprint className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    Vincular Huella / FaceID
                                </button>

                                {!isStandalone && deferredPrompt && (
                                    <button
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            handleInstallClick();
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        <Download className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        Instalar Aplicación
                                    </button>
                                )}

                                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Tema</p>
                                    <div className="flex bg-gray-100/50 p-1 rounded-lg dark:bg-gray-700/50">
                                        <button
                                            onClick={() => { setTheme('light'); setIsProfileMenuOpen(false); }}
                                            className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'light' ? 'bg-white text-yellow-500 shadow-sm dark:bg-gray-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                            title="Modo Claro"
                                        >
                                            <Sun className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setTheme('dark'); setIsProfileMenuOpen(false); }}
                                            className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-gray-800 text-blue-400 shadow-sm dark:bg-gray-900' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                            title="Modo Oscuro"
                                        >
                                            <Moon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setTheme('system'); setIsProfileMenuOpen(false); }}
                                            className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'system' ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                            title="Sistema"
                                        >
                                            <Monitor className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors text-left border-t border-gray-50 dark:border-gray-700 dark:hover:bg-red-900/20 dark:text-red-400"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Cerrar Sesión
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 pb-20 md:pb-0 pt-16 md:pt-0" onClick={() => setIsProfileMenuOpen(false)}>
                <div key={pathname} className="w-full">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-2 left-0 right-0 mx-4 bg-white/10 dark:bg-black/30 backdrop-blur-3xl border border-white/30 dark:border-white/10 flex justify-around p-3 rounded-[2.5rem] z-[100] shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
                {navItems.filter(item => item.label !== 'Recursos Externos').map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    const isRegistrar = item.label === 'Registrar';
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group flex flex-col items-center justify-center flex-1 py-1 relative"
                        >
                            <div className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-2xl transition-all duration-300 ${
                                isActive
                                    ? 'bg-cyan-600 text-white scale-110 -translate-y-2 shadow-lg shadow-cyan-400/40 dark:shadow-cyan-900/50 delay-[150ms]'
                                    : 'text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-900/20 group-hover:scale-105'
                            }`}>
                                <div className={`relative ${isRegistrar && !isActive ? 'animate-pulse' : ''}`}>
                                    <Icon className={`w-5 h-5 ${isRegistrar && !isActive ? 'drop-shadow-[0_0_8px_rgba(8,145,178,0.5)]' : ''} ${isActive ? 'animate-[nav-split-icon_0.6s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`} />
                                    {isRegistrar && !isActive && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
                                    )}
                                </div>
                                <span className={`text-[10px] ${
                                    isActive ? 'font-black animate-[nav-split-label_0.6s_cubic-bezier(0.34,1.56,0.64,1)]' : 'font-medium'
                                }`}>
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Mobile Top Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#00A3E0] flex items-center justify-between px-4 z-[100] shadow-md">
                <h1 className="text-xl font-black text-white tracking-tight">Sistema PAE</h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setNotifModalOpen(true);
                            setHasNotification(false);
                        }}
                        className="relative p-2 bg-white/10 rounded-full border border-white/20"
                    >
                        <Bell className="w-6 h-6 text-white" />
                        {hasNotification && (
                            <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#00A3E0] animate-pulse" />
                        )}
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className="flex items-center bg-white/20 backdrop-blur-md rounded-full pl-1.5 pr-3.5 py-1.5 gap-2 border border-white/20"
                        >
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden border border-white/40 shadow-sm">
                                {usuario.foto ? (
                                    <img src={usuario.foto} alt={usuario.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <span className="text-[#00A3E0] font-bold text-xs">{usuario.nombre.charAt(0)}</span>
                                )}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[8px] font-extrabold text-blue-100 uppercase tracking-widest leading-none mb-0.5">
                                    {['admin', 'coordinador_pae', 'estudiante', 'estudiante_pae', 'acudiente', 'secretaria_educacion', 'operador'].includes(usuario.rol) ? (usuario.rol === 'coordinador_pae' ? 'Coordinador PAE' : usuario.rol.replace('_', ' ')) : 'Docente'}
                                </span>
                                <span className="text-white font-bold text-xs leading-none max-w-[80px] truncate">{usuario.nombre.split(' ')[0]}</span>
                            </div>
                            <ChevronDown className={`w-3 h-3 text-white ml-1 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isProfileMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-[99] bg-black/20 backdrop-blur-sm" onClick={() => setIsProfileMenuOpen(false)}></div>
                                <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[101] animate-in slide-in-from-top-2 fade-in duration-200">
                                    <Link
                                        href="/dashboard/perfil"
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors bg-gray-50/50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                        onClick={() => setIsProfileMenuOpen(false)}
                                    >
                                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        Mi Perfil
                                    </Link>

                                    {['admin', 'coordinador_pae'].includes(usuario.rol) && (
                                        <>
                                            <Link
                                                href="/dashboard/admin"
                                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors bg-purple-50/10 dark:bg-gray-800 dark:text-purple-400 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700"
                                                onClick={() => setIsProfileMenuOpen(false)}
                                            >
                                                <RefreshCcw className="w-4 h-4" />
                                                Configuración
                                            </Link>
                                            <Link
                                                href="/dashboard/auditoria"
                                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors bg-purple-50/10 dark:bg-gray-800 dark:text-purple-400 dark:hover:bg-gray-700"
                                                onClick={() => setIsProfileMenuOpen(false)}
                                            >
                                                <FileText className="w-4 h-4" />
                                                Auditoría
                                            </Link>
                                            <Link
                                                href="/dashboard/novedades"
                                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-cyan-600 hover:bg-cyan-50 transition-colors bg-cyan-50/10 dark:bg-gray-800 dark:text-cyan-400 dark:hover:bg-gray-700"
                                                onClick={() => setIsProfileMenuOpen(false)}
                                            >
                                                <Globe className="w-4 h-4" />
                                                Recursos Externos
                                            </Link>
                                        </>
                                    )}

                                    <button
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            handleShareApp();
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left bg-gray-50/50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700"
                                    >
                                        <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        Compartir Aplicación
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            handleBiometricSetup();
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left bg-gray-50/50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700"
                                    >
                                        <Fingerprint className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        Vincular Biometría
                                    </button>

                                    {!isStandalone && deferredPrompt && (
                                        <button
                                            onClick={() => {
                                                setIsProfileMenuOpen(false);
                                                handleInstallClick();
                                            }}
                                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left bg-gray-50/50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700"
                                        >
                                            <Download className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            Instalar App
                                        </button>
                                    )}

                                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 dark:bg-gray-800">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Tema</p>
                                        <div className="flex bg-gray-100/50 p-1 rounded-lg dark:bg-gray-700/50">
                                            <button
                                                onClick={() => { setTheme('light'); setIsProfileMenuOpen(false); }}
                                                className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'light' ? 'bg-white text-yellow-500 shadow-sm dark:bg-gray-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                                title="Modo Claro"
                                            >
                                                <Sun className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { setTheme('dark'); setIsProfileMenuOpen(false); }}
                                                className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-gray-800 text-blue-400 shadow-sm dark:bg-gray-900' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                                title="Modo Oscuro"
                                            >
                                                <Moon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { setTheme('system'); setIsProfileMenuOpen(false); }}
                                                className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'system' ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                                title="Sistema"
                                            >
                                                <Monitor className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 dark:bg-gray-800">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Cuenta</p>
                                        <p className="text-xs text-gray-600 truncate font-medium dark:text-gray-300">{usuario.nombre}</p>
                                        <p className="text-[10px] text-gray-400 truncate">{usuario.email}</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors text-left border-t border-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Cerrar Sesión
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Notification Modal */}
            {notifModalOpen && (
                (usuario?.rol === 'secretaria_educacion' || usuario?.rol === 'operador') ? (
                    <GlobalNotificationsModal
                        isOpen={notifModalOpen}
                        onClose={() => setNotifModalOpen(false)}
                        usuario={usuario}
                    />
                ) : (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setNotifModalOpen(false)}></div>
                        <div className="w-full md:w-[450px] max-h-[85vh] h-auto bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col">
                            {/* Header */}
                            <div className="p-5 bg-gradient-to-br from-cyan-600 to-cyan-700 relative shrink-0 rounded-t-[2.5rem]">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 text-white">
                                        <div className="bg-white/20 p-1.5 rounded-xl backdrop-blur-sm border border-white/10 shadow-inner">
                                            <Bell className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="text-base font-black leading-tight">Novedades</h3>
                                            <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                                                {activeNotifTab === 'weekly' 
                                                    ? 'CONSOLIDADO SEMANAL' 
                                                    : (selectedDate 
                                                        ? new Date(selectedDate + 'T12:00:00') 
                                                        : (dailySubTab === 'tomorrow' ? getNextBusinessDay(new Date()) : new Date())
                                                      ).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setNotifModalOpen(false)} className="p-3.5 -m-2 hover:bg-white/10 rounded-full transition-colors text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 mt-4">
                                    {activeNotifTab === 'daily' && (
                                        <button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="w-[40%] bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 px-3 flex items-center justify-center gap-2 font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm group shrink-0">
                                            <span className="truncate">{selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : 'Fecha'}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                    )}
                                    <div className={`relative group shrink-0 transition-all duration-300 ${activeNotifTab === 'daily' ? 'w-[60%]' : 'w-full'}`}>
                                        <button onClick={() => setShowSedeDropdown(!showSedeDropdown)} className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 px-3 flex items-center justify-between gap-2 font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm group">
                                            <span className="truncate">{selectedSede === 'Todas' ? 'Todas' : selectedSede.replace('Sede ', '')}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 text-white opacity-60 transition-transform ${showSedeDropdown ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showSedeDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-[60]" onClick={() => setShowSedeDropdown(false)}></div>
                                                <div className="absolute top-full right-0 mt-2 w-full min-w-[140px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden z-[70] animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                                                    <div className="p-1.5 space-y-1">
                                                        {['Todas', 'Principal', 'Primaria', 'Maria Inmaculada'].map((sede) => (
                                                            <button key={sede} onClick={() => { setSelectedSede(sede); setShowSedeDropdown(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${selectedSede === sede ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700'}`}>
                                                                {sede}
                                                                {selectedSede === sede && <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {isCalendarOpen && (
                                    <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col items-center bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl">
                                        <MiniCalendar
                                            selectedDate={selectedDate || formatLocalDate(new Date())}
                                            onSelectDate={(date) => { handleSearchByDate(date); setIsCalendarOpen(false); }}
                                            className="border-none p-0"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Tabs Selector */}
                            <div className="px-0 py-2 shrink-0">
                                <div className="flex mx-6 p-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-full border border-gray-200/50 shadow-inner relative">
                                    <button onClick={() => setActiveNotifTab('daily')} className={`flex-1 py-1 text-[10px] font-black uppercase tracking-[0.15em] rounded-full transition-all duration-300 relative z-10 ${activeNotifTab === 'daily' ? 'text-white' : 'text-gray-400'}`}>Diario</button>
                                    <button onClick={() => setActiveNotifTab('weekly')} className={`flex-1 py-1 text-[10px] font-black uppercase tracking-[0.15em] rounded-full transition-all duration-300 relative z-10 ${activeNotifTab === 'weekly' ? 'text-white' : 'text-gray-400'}`}>Semana</button>
                                    <div className={`absolute inset-y-1 transition-all duration-500 bg-cyan-600 rounded-full shadow-md ${activeNotifTab === 'daily' ? 'left-1 w-[48%]' : 'left-[51%] w-[48%]'}`} />
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto bg-gray-50/30 dark:bg-black/10 p-4 custom-scrollbar">
                                {activeNotifTab === 'daily' ? (
                                    <div className="space-y-6">
                                        {!selectedDate && (
                                            <div className="flex bg-gray-200/30 dark:bg-gray-800/50 p-1 rounded-2xl mb-4 shadow-inner border border-gray-100 dark:border-gray-700">
                                                <button onClick={() => { setDailySubTab('today'); setSelectedDate(''); setSearchResult(null); }} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dailySubTab === 'today' ? 'bg-white dark:bg-gray-700 text-cyan-600 shadow-sm' : 'text-gray-400'}`}>Hoy</button>
                                                <button onClick={() => { setDailySubTab('tomorrow'); setSelectedDate(''); setSearchResult(null); }} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dailySubTab === 'tomorrow' ? 'bg-white dark:bg-gray-700 text-cyan-600 shadow-sm' : 'text-gray-400'}`}>Próx. Día</button>
                                            </div>
                                        )}
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                {selectedDate 
                                                    ? `Resultados: ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}` 
                                                    : (dailySubTab === 'today' ? todayDateLabel : tomorrowDateLabel)}
                                            </div>


                                            {(groupExceptions.notAttending.length > 0 || groupExceptions.otherNotes.length > 0) && (
                                                <div className="space-y-3">
                                                    {groupExceptions.notAttending.map((item, idx) => (
                                                        <div key={idx} className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl p-4 flex items-start justify-between">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-red-900 dark:text-red-200 uppercase">{item.group}</span>
                                                                <span className="text-[9px] font-bold text-red-600 dark:text-red-400 italic">SIN SERVICIO PAE</span>
                                                            </div>
                                                            <div className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase">NO ASISTE</div>
                                                        </div>
                                                    ))}
                                                    {groupExceptions.otherNotes.map((item, idx) => (
                                                        <div key={idx} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase">{item.group}</span>
                                                                <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded-full">AVISO</span>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-amber-900 dark:text-amber-100 italic">"{item.notes}"</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                {currentEvents.length > 0 ? (
                                                    currentEvents.map((event, idx) => (
                                                        <div key={idx} className="p-4 rounded-2xl border border-cyan-100 dark:border-cyan-900/20 bg-cyan-50/50 dark:bg-cyan-900/10 flex items-start gap-3 shadow-sm">
                                                            <div className="bg-cyan-600 text-white px-2 py-1.5 rounded-xl text-[10px] font-black uppercase shrink-0 min-w-[3.5rem] text-center shadow-lg shadow-cyan-200/50">{event.hora || 'Día'}</div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-black text-xs text-cyan-950 dark:text-cyan-50 mb-1 uppercase leading-tight">{event.titulo}</p>
                                                                <div className="flex items-center gap-2 text-[9px] font-extrabold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                                                                    <Users className="w-3 h-3" />
                                                                    {event.grupo_afectado || 'General'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    (groupExceptions.notAttending.length === 0 && groupExceptions.otherNotes.length === 0) && (
                                                        <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                                                            <Calendar className="w-8 h-8 text-gray-400 mb-4" />
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No hay actividades</p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                ) : (
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-cyan-600 text-white shadow-lg z-10">
                                            <button onClick={() => changeNotifWeek(-1)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                                <ChevronLeftIcon className="w-4 h-4 text-white" />
                                            </button>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                                                {(() => {
                                                    const end = new Date(weekStart);
                                                    end.setDate(weekStart.getDate() + 4);
                                                    const startStr = weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase();
                                                    const endStr = end.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase();
                                                    return `${startStr} - ${endStr}`;
                                                })()}
                                            </span>
                                            <button onClick={() => changeNotifWeek(1)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                                <ChevronRightIcon className="w-4 h-4 text-white" />
                                            </button>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-2 flex items-center gap-1 border-b border-gray-100 dark:border-gray-800">
                                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day, dIdx) => (
                                                <button
                                                    key={dIdx}
                                                    onClick={() => setSelectedDayInWeek(dIdx)}
                                                    className={`flex-1 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${selectedDayInWeek === dIdx
                                                        ? 'bg-cyan-600 text-white shadow-md'
                                                        : 'text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>

                                        {isWeeklySearching ? (
                                            <div className="text-center py-20 flex-1 flex flex-col items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                                                <p className="text-[10px] font-black text-cyan-600/60 mt-4 uppercase tracking-[0.2em]">Consultando...</p>
                                            </div>
                                        ) : (
                                            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar bg-white dark:bg-gray-900">
                                                {currentEvents.length > 0 ? (
                                                    currentEvents.map((event, idx) => (
                                                        <div key={idx} className="p-3 rounded-2xl border border-cyan-100 dark:border-cyan-900/20 bg-cyan-50/50 dark:bg-cyan-900/10 flex items-start gap-3 shadow-sm animate-in slide-in-from-bottom-2 border-l-4 border-l-cyan-600">
                                                            <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1.5 rounded-xl text-[9px] font-black uppercase shrink-0 min-w-[3.5rem] text-center border border-gray-200 dark:border-gray-700">{event.hora || 'Día'}</div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-black text-xs text-gray-900 dark:text-white mb-0 uppercase leading-tight">{event.titulo}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <p className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide flex items-center gap-1">
                                                                        <Users className="w-3 h-3" />
                                                                        {event.grupo_afectado || 'General'}
                                                                    </p>
                                                                </div>
                                                                {event.descripcion && <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed font-medium">{event.descripcion}</p>}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                                                        <Calendar className="w-8 h-8 text-gray-400 mb-4" />
                                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sin registros</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="p-5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 shrink-0 rounded-b-[2.5rem]">
                                <button onClick={() => setNotifModalOpen(false)} className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-cyan-200 dark:shadow-none hover:bg-cyan-700 transition-all">
                                    Cerrar Novedades
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

            {/* Spacer for Mobile */}
            <div className="md:hidden h-16"></div>
        </div>
    );
}
