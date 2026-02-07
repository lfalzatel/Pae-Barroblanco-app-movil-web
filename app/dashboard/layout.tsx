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
    AlertTriangle
} from 'lucide-react';
import { MiniCalendar } from '@/components/ui/MiniCalendar';
import { useTheme } from '@/components/ThemeProvider';
import { getAcademicBlock } from '@/lib/schedule-utils';
import GlobalNotificationsModal from '@/components/dashboard/GlobalNotificationsModal';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [usuario, setUsuario] = useState<any | null>(null);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

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
        // Default to next day if it's after 6 PM (18:00)
        // If Friday after 6pm OR Saturday/Sunday -> Monday
        const d = new Date();
        const hour = d.getHours();
        const day = d.getDay();
        if (day >= 5 && hour >= 18) return 'tomorrow'; // Fri night -> Mon
        if (day === 6 || day === 0) return 'tomorrow'; // Weekend -> Mon
        return hour >= 18 ? 'tomorrow' : 'today';
    });
    const [selectedDayInWeek, setSelectedDayInWeek] = useState(0);

    const [hasNotification, setHasNotification] = useState(false); // Can be linked to real data later
    const [groupExceptions, setGroupExceptions] = useState<{ notAttending: any[], otherNotes: any[] }>({ notAttending: [], otherNotes: [] });

    // Initial Date Logic for Notification Modal
    // Initial Date Logic for Notification Modal (Matches WeeklyScheduleModal Logic)
    useEffect(() => {
        if (notifModalOpen) {
            const now = new Date();
            // Use local time, assumed to be relevant. 
            const day = now.getDay(); // 0=Sun, 1=Mon...
            const hour = now.getHours();

            // Logic for Selected Day Index (0-4 for Mon-Fri)
            let newSelectedDay = 0;
            if (day >= 1 && day <= 4) {
                // Mon-Thu: If > 6pm, show Next Day
                if (hour >= 18) newSelectedDay = day; // e.g. Mon(1) -> Tue(index 1) which is (day-1)+1
                else newSelectedDay = day - 1;       // e.g. Mon(1) -> Mon(index 0)
            } else if (day === 5) {
                // Fri: If > 6pm, show Mon (0) next week
                if (hour >= 18) newSelectedDay = 0;
                else newSelectedDay = 4; // Fri index
            } else {
                // Weekend -> Show Mon (0)
                newSelectedDay = 0;
            }
            setSelectedDayInWeek(newSelectedDay);

            // Logic for Week Start Date
            const d = new Date(now);
            // If Fri > 18h or Weekend -> Jump to next Monday
            if ((day === 5 && hour >= 18) || day === 6 || day === 0) {
                const daysToAdd = day === 5 ? 3 : (day === 6 ? 2 : 1);
                d.setDate(d.getDate() + daysToAdd);
            } else {
                // Current business week start (Monday)
                // If we are on Mon-Thu > 18h, we stay in current week mentally, just showing next day tab.
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                d.setDate(diff);
            }
            d.setHours(0, 0, 0, 0);
            setWeekStart(d);

            fetchNotifEvents(d);

            // Fetch Daily Exceptions if needed (Initial Load)
            if (activeNotifTab === 'daily') {
                const targetD = dailySubTab === 'tomorrow' ? getNextBusinessDay(now) : now;
                fetchDailyExceptions(targetD);
            }
        }
    }, [notifModalOpen]);

    // Fetch Daily Exceptions when tab changes
    useEffect(() => {
        if (activeNotifTab === 'daily') {
            const now = new Date();
            const targetD = dailySubTab === 'tomorrow' ? getNextBusinessDay(now) : now;
            fetchDailyExceptions(targetD);
        }
    }, [dailySubTab, activeNotifTab, selectedSede]);

    const fetchDailyExceptions = async (date: Date) => {
        // Use local date string to avoid timezone issues (UTC shift)
        const dateStr = date.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
        console.log('Fetching Daily Exceptions:', dateStr, 'Sede:', selectedSede);
        try {
            const { data } = await supabase
                .from('schedules')
                .select('items')
                .eq('date', dateStr)
                .maybeSingle();

            console.log('Raw Schedule Data:', data);
            if (data?.items) {
                const rawItems = data.items;
                console.log('Raw Items for Filtering:', rawItems);
                // Filter relevant items (NO_ASISTE or notes) AND Sede
                const relevant = rawItems.filter((i: any) => {
                    // Sede Check: Relaxed to include partial matches (e.g. "Sede Principal" includes "Principal")
                    const isSedeMatch = selectedSede === 'Todas' || !i.sede || (i.sede && i.sede.includes(selectedSede));

                    // Time/Note Check
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

                // Map and Sort
                const mapped = relevant.map((i: any) => ({
                    ...i,
                    studentCount: countsMap[i.group] || 0
                })).sort((a: any, b: any) => {
                    // Helper to extract time
                    const getMins = (str: string) => {
                        const match = (str || '').match(/(\d{1,2})[:.](\d{2})\s*(am|pm|AM|PM)?/i);
                        if (!match) return 0; // Default to start of day if no time found
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



    // Helper: Sort events by time
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
                dates.push(d.toISOString().split('T')[0]);
            }

            let query = supabase
                .from('novedades_institucionales')
                .select('*')
                .in('fecha', dates)
                .order('hora', { ascending: true });

            const { data, error } = await query;
            if (error) throw error;

            // Client-side sort to be safe with AM/PM formats
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


    // Helper: Logic for Business Days (Monday-Friday)
    // If today is Friday, next business day is Monday (+3)
    // If Saturday, next is Monday (+2)
    // If Sunday, next is Monday (+1)
    const getNextBusinessDay = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        if (day === 5) { d.setDate(d.getDate() + 3); }
        else if (day === 6) { d.setDate(d.getDate() + 2); }
        else if (day === 0) { d.setDate(d.getDate() + 1); }
        else { d.setDate(d.getDate() + 1); }
        return d;
    };

    // Filter events based on view
    const getFilteredEvents = () => {
        if (searchResult) return [searchResult]; // Mock search result?

        let targetDateStr = '';

        if (activeNotifTab === 'daily') {
            const d = new Date();
            if (dailySubTab === 'tomorrow') {
                const nextDay = getNextBusinessDay(d);
                targetDateStr = nextDay.toISOString().split('T')[0];
            } else {
                targetDateStr = d.toISOString().split('T')[0];
            }
        }
        else if (activeNotifTab === 'weekly') {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + selectedDayInWeek);
            targetDateStr = d.toISOString().split('T')[0];
        }

        if (selectedDate) return notifEvents.filter(e => e.fecha === selectedDate); // Cal override?

        return notifEvents.filter(e => e.fecha === targetDateStr);
    };

    const currentEvents = getFilteredEvents();

    // Date Labels
    const todayDateLabel = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const tomorrowDateLabel = getNextBusinessDay(new Date()).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check PWA install eligibility
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
        // Placeholder for biometric logic
        alert('Configuración de biometría en desarrollo.');
    };

    // Helper: Format Date
    const formatLocalDate = (date: Date) => {
        return date.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    };

    const handleSearchByDate = (date: string) => {
        setSelectedDate(date);
        setSearchResult({ date, items: [] }); // Simulate finding something or nothing
    };

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
                // Fallback if profile not found immediately
                setUsuario({
                    nombre: session.user.user_metadata?.nombre || 'Usuario',
                    email: session.user.email,
                    rol: session.user.user_metadata?.rol || 'acudiente',
                    foto: session.user.user_metadata?.foto || null
                });
            }
        };

        checkUser();

        // Listen for layout changes/auth state
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                router.push('/');
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [router]);

    // Mock data fetching for notification modal (Daily/Weekly)
    // In a real app, you'd fetch this from Supabase based on 'activeNotifTab' and dates.
    useEffect(() => {
        // Placeholder: Fetch logic for notifications would go here
    }, [activeNotifTab, selectedDate, weekStart, selectedSede]);


    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/';
        }
    };

    const navItems = [
        { href: '/dashboard', label: 'Inicio', icon: Home },
    ];

    // Registro & Gestión: Operativo en campo (No para Secretaria/Operador)
    if (['admin', 'coordinador_pae', 'docente'].includes(usuario?.rol)) {
        navItems.push({ href: '/dashboard/registro', label: 'Registrar', icon: ClipboardList });
        navItems.push({ href: '/dashboard/gestion', label: 'Gestión', icon: Users });
    }

    // Reportes: Visibilidad Global (Excluyendo Estudiantes/Acudientes/Secretaria/Operador internos si aplica)
    if (!['estudiante', 'acudiente'].includes(usuario?.rol)) {
        navItems.push({ href: '/dashboard/reportes', label: 'Reportes', icon: BarChart3 });
    }

    // Horario: Operativo (No para Secretaria/Operador)
    if (['admin', 'coordinador_pae'].includes(usuario?.rol)) {
        navItems.push({ href: '/dashboard/horario', label: 'Horario', icon: Calendar });
    }

    // Novedades: Visible para todos excepto docentes (que solo reportan asistencias)
    if (['admin', 'coordinador_pae', 'secretaria_educacion'].includes(usuario?.rol)) {
        navItems.push({ href: '/dashboard/novedades', label: 'Novedades', icon: AlertTriangle });
    }

    const touchStartRef = useRef<{ x: number, y: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    // Calculate current nav index
    const currentNavIndex = navItems.findIndex(item => item.href === pathname);

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };

        const diffX = touchStartRef.current.x - touchEnd.x;
        const diffY = touchStartRef.current.y - touchEnd.y;

        // Reset
        touchStartRef.current = null;

        // Don't swipe if Notification Modal is open
        if (notifModalOpen) return;

        // Thresholds: Min distance 75px, Horizontal dominant
        if (Math.abs(diffX) > 75 && Math.abs(diffX) > Math.abs(diffY) * 2) {
            if (currentNavIndex === -1) return;

            if (diffX > 0) {
                // Swipe Left -> Next Tab
                if (currentNavIndex < navItems.length - 1) {
                    router.replace(navItems[currentNavIndex + 1].href);
                }
            } else {
                // Swipe Right -> Prev Tab
                if (currentNavIndex > 0) {
                    router.replace(navItems[currentNavIndex - 1].href);
                }
            }
        }
    };

    if (!usuario) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
            </div>
        );
    }

    // Date labels
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Capitalize function
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

                {/* Notifications Desktop (Search/Global) */}
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

                    {/* Collapsible Admin Menu */}
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

                        {/* Dropdown Menu Desktop */}
                        {isProfileMenuOpen && (
                            <div className="absolute bottom-full mb-2 left-0 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 dark:bg-gray-800 dark:border-gray-700">
                                <Link
                                    href="/dashboard/perfil"
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:text-gray-200 dark:hover:bg-gray-700"
                                    onClick={() => setIsProfileMenuOpen(false)}
                                >
                                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    Mi Perfil
                                </Link>

                                {/* Biometric Option */}
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

                                {/* Install App Option */}
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
                                            onClick={() => setTheme('light')}
                                            className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'light' ? 'bg-white text-yellow-500 shadow-sm dark:bg-gray-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                            title="Modo Claro"
                                        >
                                            <Sun className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setTheme('dark')}
                                            className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-gray-800 text-blue-400 shadow-sm dark:bg-gray-900' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                            title="Modo Oscuro"
                                        >
                                            <Moon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setTheme('system')}
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
                {children}
            </main>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-[100] safe-area-bottom dark:bg-gray-800 dark:border-gray-700 transition-colors">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    const isRegistrar = item.label === 'Registrar';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors relative ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'
                                }`}
                        >
                            <div className={`relative ${isRegistrar ? 'animate-pulse' : ''}`}>
                                <Icon className={`w-6 h-6 mb-1 ${isActive ? 'fill-current' : ''} ${isRegistrar ? 'text-gray-500 drop-shadow-[0_0_8px_rgba(37,99,235,0.5)] dark:text-gray-400' : ''}`} />
                                {isRegistrar && <span className="absolute inset-0 bg-blue-400/30 rounded-full blur-md animate-ping opacity-20 pointer-events-none"></span>}
                            </div>
                            <span className={`text-[10px] font-medium ${isRegistrar ? 'font-black text-gray-500 dark:text-gray-300' : ''}`}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Mobile Top Header for User Profile */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#00A3E0] flex items-center justify-between px-4 z-50 shadow-md">
                <h1 className="text-xl font-black text-white tracking-tight">
                    Sistema PAE
                </h1>

                <div className="flex items-center gap-3">
                    {/* Bell Notification Mobile */}
                    <button
                        onClick={() => {
                            setNotifModalOpen(true);
                            setHasNotification(false);
                        }}
                        className="relative p-2 bg-white/10 rounded-full border border-white/20 active:scale-90 transition-transform"
                    >
                        <Bell className="w-6 h-6 text-white" />
                        {hasNotification && (
                            <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#00A3E0] animate-pulse" />
                        )}
                    </button>

                    <div className="relative">
                        {/* User Capsule Trigger */}
                        <button
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className="flex items-center bg-white/20 backdrop-blur-md rounded-full pl-1.5 pr-3.5 py-1.5 gap-2 border border-white/20 active:scale-95 transition-transform"
                        >
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden border border-white/40 shadow-sm">
                                {usuario.foto ? (
                                    <img src={usuario.foto} alt={usuario.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <span className="text-[#00A3E0] font-bold text-xs">
                                        {usuario.nombre.charAt(0)}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[8px] font-extrabold text-blue-100 uppercase tracking-widest leading-none mb-0.5">
                                    {usuario.rol === 'admin' ? 'Admin' :
                                        usuario.rol === 'coordinador_pae' ? 'Coordinador PAE' :
                                            usuario.rol === 'estudiante' ? 'Estudiante' :
                                                usuario.rol === 'acudiente' ? 'Acudiente' :
                                                    usuario.rol === 'secretaria_educacion' ? 'Secretaría' :
                                                        usuario.rol === 'operador' ? 'Operador' :
                                                            'Docente'}
                                </span>
                                <span className="text-white font-bold text-xs leading-none max-w-[80px] truncate">
                                    {usuario.nombre.split(' ')[0]}
                                </span>
                            </div>
                            <ChevronDown className={`w-3 h-3 text-white ml-1 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu Mobile */}
                        {isProfileMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setIsProfileMenuOpen(false)}></div>
                                <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <Link
                                        href="/dashboard/perfil"
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors bg-gray-50/50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                        onClick={() => setIsProfileMenuOpen(false)}
                                    >
                                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        Mi Perfil
                                    </Link>

                                    {/* Mobile Admin Links */}
                                    {usuario?.rol === 'admin' && (
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
                                        </>
                                    )}

                                    {/* Biometric Option Mobile */}
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

                                    {/* Install App Option Mobile */}
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
                                        <div className="flex bg-gray-100/50 p-1 rounded-lg mb-2 dark:bg-gray-700/50">
                                            <button
                                                onClick={() => setTheme('light')}
                                                className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'light' ? 'bg-white text-yellow-500 shadow-sm dark:bg-gray-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                            >
                                                <Sun className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setTheme('dark')}
                                                className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-gray-800 text-blue-400 shadow-sm dark:bg-gray-900' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                            >
                                                <Moon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setTheme('system')}
                                                className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === 'system' ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
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
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 text-white">
                                        <div className="bg-white/20 p-1.5 rounded-xl backdrop-blur-sm border border-white/10 shadow-inner">
                                            <Bell className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="text-base font-black leading-tight">Novedades</h3>
                                            <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                                                {activeNotifTab === 'weekly' ? 'CONSOLIDADO SEMANAL' : (dailySubTab === 'tomorrow' ? getNextBusinessDay(new Date()) : new Date()).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifModalOpen(false)}
                                        className="p-3.5 -m-2 hover:bg-white/10 rounded-full transition-colors text-white"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Control Row: Sede & Date */}
                                <div className="flex items-center gap-2 mt-4">
                                    {/* Date Capsule - Only in Daily View */}
                                    {activeNotifTab === 'daily' && (
                                        <button
                                            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                            className="w-[40%] bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 px-3 flex items-center justify-center gap-2 font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm group shrink-0"
                                        >
                                            <span className="truncate">{selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : 'Fecha'}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${isCalendarOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                                        </button>
                                    )}

                                    {/* Sede Selector Capsule */}
                                    <div className={`relative group shrink-0 transition-all duration-300 ${activeNotifTab === 'daily' ? 'w-[60%]' : 'w-full'}`}>
                                        <button
                                            onClick={() => setShowSedeDropdown(!showSedeDropdown)}
                                            className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 px-3 flex items-center justify-between gap-2 font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm group"
                                        >
                                            <span className="truncate">{selectedSede === 'Todas' ? 'Todas' : selectedSede.replace('Sede ', '')}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 text-white opacity-60 transition-transform ${showSedeDropdown ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                                        </button>

                                        {showSedeDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-[60]" onClick={() => setShowSedeDropdown(false)}></div>
                                                <div className="absolute top-full right-0 mt-2 w-full min-w-[140px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden z-[70] animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                                                    <div className="p-1.5 space-y-1">
                                                        {[
                                                            { id: 'Todas', label: 'Todas' },
                                                            { id: 'Principal', label: 'Principal' },
                                                            { id: 'Primaria', label: 'Primaria' },
                                                            { id: 'Maria Inmaculada', label: 'M. Inmaculada' }
                                                        ].map((sede) => (
                                                            <button
                                                                key={sede.id}
                                                                onClick={() => { setSelectedSede(sede.id); setShowSedeDropdown(false); }}
                                                                className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${selectedSede === sede.id
                                                                    ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                                                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                                                                    }`}
                                                            >
                                                                {sede.label}
                                                                {selectedSede === sede.id && <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Inner Calendar - Header Integrated */}
                                {isCalendarOpen && (
                                    <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col items-center bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl">
                                        <MiniCalendar
                                            selectedDate={selectedDate || formatLocalDate(new Date())}
                                            onSelectDate={(date) => {
                                                handleSearchByDate(date);
                                                setIsCalendarOpen(false);
                                            }}
                                            className="border-none p-0"
                                        />
                                        {selectedDate && (
                                            <button
                                                onClick={() => {
                                                    setSearchResult(null);
                                                    setSelectedDate('');
                                                    setIsCalendarOpen(false);
                                                }}
                                                className="w-full mt-3 text-[10px] font-bold text-cyan-600 bg-cyan-50 px-3 py-2 rounded-xl flex items-center justify-center gap-2"
                                            >
                                                <RefreshCcw className="w-3 h-3" />
                                                Limpiar Filtro
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Tabs Selector (Ultra Compact) - Hidden for Students/Parents */}
                            {!['estudiante', 'acudiente'].includes(usuario?.rol) && (
                                <div className="px-0 py-2 bg-transparent dark:bg-transparent shrink-0">
                                    <div className="flex mx-6 p-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-full border border-gray-200/50 dark:border-gray-700 shadow-inner relative">
                                        <button
                                            onClick={() => setActiveNotifTab('daily')}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.15em] rounded-full transition-all duration-300 relative z-10 ${activeNotifTab === 'daily' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            Diario
                                        </button>
                                        <button
                                            onClick={() => setActiveNotifTab('weekly')}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.15em] rounded-full transition-all duration-300 relative z-10 ${activeNotifTab === 'weekly' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            Semana
                                        </button>
                                        <div className={`absolute inset-y-1 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) bg-cyan-600 rounded-full shadow-md shadow-cyan-200/50 ${activeNotifTab === 'daily' ? 'left-1 w-[48%]' : 'left-[51%] w-[48%]'}`} />
                                    </div>
                                </div>
                            )}




                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] bg-gray-50/30 dark:bg-black/10 p-4">
                                {activeNotifTab === 'daily' ? (
                                    <div className="space-y-6">
                                        {/* Daily Sub-Tabs (Hoy / Mañana) */}
                                        {!searchResult && (
                                            <div className="flex bg-gray-200/30 dark:bg-gray-800/50 p-1 rounded-2xl mb-4 shadow-inner border border-gray-100 dark:border-gray-700">
                                                <button
                                                    onClick={() => setDailySubTab('today')}
                                                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${dailySubTab === 'today' ? 'bg-white dark:bg-gray-700 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                                >
                                                    Hoy
                                                </button>
                                                <button
                                                    onClick={() => setDailySubTab('tomorrow')}
                                                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${dailySubTab === 'tomorrow' ? 'bg-white dark:bg-gray-700 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                                >
                                                    Próx. Día
                                                </button>
                                            </div>
                                        )}

                                        {/* Daily Content */}
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                                    {searchResult ? `Resultados: ${formatLocalDate(new Date(searchResult.date))}` : (dailySubTab === 'today' ? todayDateLabel : tomorrowDateLabel)}
                                                </p>
                                            </div>

                                            {/* Group Exceptions: NO ASISTE (RED) */}
                                            {groupExceptions.notAttending.length > 0 && (
                                                <div className="space-y-2 mb-5 animate-in slide-in-from-left-2 duration-500">
                                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-1 flex items-center gap-1">
                                                        <X className="w-3 h-3" /> Grupos que NO ASISTEN
                                                    </p>
                                                    {groupExceptions.notAttending.map((item, idx) => (
                                                        <div key={idx} className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20 flex items-start gap-4 shadow-sm">
                                                            <div className="bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase shrink-0">
                                                                No Asiste
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-black text-red-900 dark:text-red-200 text-sm">{item.group}</p>
                                                                <p className="text-[10px] font-medium text-red-600 dark:text-red-400 italic mt-1">
                                                                    {item.notes || 'Reportado por Coordinación'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Group Exceptions: OTHER NOTES (AMBER) */}
                                            {groupExceptions.otherNotes.length > 0 && (
                                                <div className="space-y-2 mb-5 animate-in slide-in-from-right-2 duration-500">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                                                        <AlertCircle className="w-4 h-4" /> Otras Novedades
                                                    </p>
                                                    {groupExceptions.otherNotes.map((item, idx) => (
                                                        <div key={idx} className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex items-start gap-4 shadow-sm">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm leading-snug">
                                                                    <span className="font-black text-gray-900 dark:text-white mr-2 text-base">{item.group}</span>
                                                                    <span className="font-bold text-amber-700/90 dark:text-amber-400/80">{item.notes}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {currentEvents.length > 0 ? (
                                                currentEvents.map((event, idx) => (
                                                    <div key={idx} className="bg-[#FFFBEB] dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-4 rounded-2xl flex items-start gap-4 shadow-sm animate-in slide-in-from-bottom-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm leading-snug">
                                                                <span className="font-black text-gray-900 dark:text-white mr-2 text-base">{event.afectados}</span>
                                                                <span className="font-bold text-amber-900/90 dark:text-amber-100/90">{event.titulo}</span>
                                                            </p>
                                                            {event.descripcion && (
                                                                <p className="text-xs text-amber-800/70 dark:text-amber-200/70 mt-1 font-medium leading-relaxed">
                                                                    {event.descripcion}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 text-center shadow-sm">
                                                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                                        <School className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                                                    </div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white mb-1">Sin Novedades</h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">No hay reportes de coordinadores para esta fecha.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Weekly Selector (Compacted) */}
                                        <div className="-mx-4 mb-4">
                                            <div className="bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800 shadow-xl shadow-cyan-100/10 dark:shadow-none overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-2 flex items-center justify-between">
                                                    <button onClick={() => changeNotifWeek(-1)} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white">
                                                        <ChevronLeftIcon className="w-4 h-4" />
                                                    </button>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                                        {weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - {new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                    <button onClick={() => changeNotifWeek(1)} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white">
                                                        <ChevronRightIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="p-3">
                                                    <div className="flex p-1 bg-gray-50/80 dark:bg-gray-800/80 rounded-full border border-gray-100 dark:border-gray-700 shadow-inner">
                                                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day, dIdx) => (
                                                            <button
                                                                key={day}
                                                                onClick={() => setSelectedDayInWeek(dIdx)}
                                                                className={`flex-1 py-1.5 text-[10px] font-black rounded-full transition-all duration-500 ${selectedDayInWeek === dIdx ? 'bg-cyan-600 text-white shadow-lg scale-105' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                                            >
                                                                {day}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {isWeeklySearching ? (
                                            <div className="text-center py-20">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                                                <p className="text-xs text-gray-500 mt-2 font-medium">Cargando...</p>
                                            </div>
                                        ) : (
                                            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                                                {currentEvents.length > 0 ? (
                                                    currentEvents.map((event, idx) => (
                                                        <div key={idx} className="p-3 rounded-2xl border border-cyan-100 dark:border-cyan-900/20 bg-cyan-50/50 dark:bg-cyan-900/10 flex items-start gap-3 shadow-sm animate-in slide-in-from-bottom-2">
                                                            <div className="bg-cyan-600 text-white px-1.5 py-1 rounded-lg text-[9px] font-black uppercase shrink-0 min-w-[3rem] text-center">
                                                                {event.hora || 'Todo el día'}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-black text-xs text-cyan-900 dark:text-cyan-100 mb-0 uppercase leading-tight">
                                                                    {event.titulo}
                                                                </p>
                                                                <p className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                                                                    {event.afectados}
                                                                </p>
                                                                {event.descripcion && (
                                                                    <p className="text-[9px] text-cyan-700/80 dark:text-cyan-300/60 mt-0.5 leading-relaxed font-medium">
                                                                        {event.descripcion}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                                                        <Calendar className="w-12 h-12 text-gray-300 mb-2" />
                                                        <h4 className="font-bold text-gray-400">Agenda Libre</h4>
                                                        <p className="text-xs text-gray-400 max-w-[200px] mt-1">No hay eventos programados para este día.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}

                            {/* Footer Area with Entendido Button */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0">
                                <button
                                    onClick={() => setNotifModalOpen(false)}
                                    className="w-full py-4.5 bg-gray-900 dark:bg-cyan-600 text-white rounded-2xl font-black shadow-lg hover:bg-black dark:hover:bg-cyan-500 transition-all active:scale-[0.98] min-h-[56px] uppercase tracking-widest text-xs"
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    </div>
                )
            )}


            {/* Spacer for Mobile Header */}
            <div className="md:hidden h-16"></div>
        </div>
    );
}
