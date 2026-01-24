'use client';

import { useState, useEffect } from 'react';
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
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Download,
    School
} from 'lucide-react';
import { MiniCalendar } from '@/components/ui/MiniCalendar';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [usuario, setUsuario] = useState<any | null>(null);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    // Notification logic
    const [hasNotification, setHasNotification] = useState(false);
    const [notifModalOpen, setNotifModalOpen] = useState(false);
    const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
    const [todayInstEvents, setTodayInstEvents] = useState<any[]>([]);
    const [todayDateLabel, setTodayDateLabel] = useState('');
    const [todayDateStr, setTodayDateStr] = useState('');
    const [tomorrowSchedule, setTomorrowSchedule] = useState<any[]>([]);
    const [tomorrowInstEvents, setTomorrowInstEvents] = useState<any[]>([]);
    const [tomorrowDateLabel, setTomorrowDateLabel] = useState('');
    const [tomorrowDateStr, setTomorrowDateStr] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [searchResult, setSearchResult] = useState<any[] | null>(null);
    const [searchInstEvents, setSearchInstEvents] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [dailySubTab, setDailySubTab] = useState<'today' | 'tomorrow'>('today');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [activeNotifTab, setActiveNotifTab] = useState<'daily' | 'weekly'>('daily');
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const now = new Date();
        const bogotaNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));

        const day = bogotaNow.getDay();
        const hour = bogotaNow.getHours();

        const d = new Date(bogotaNow);
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);

        if ((day === 5 && hour >= 18) || day === 6 || day === 0) {
            d.setDate(d.getDate() + 7);
        }

        d.setHours(12, 0, 0, 0);
        return d;
    });

    const formatLocalDate = (date: Date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const timeToMinutes = (timeStr: string) => {
        if (!timeStr) return 9999; // Put items without time at the end
        const clean = timeStr.toLowerCase().trim();
        let modifier = clean.includes('pm') ? 'pm' : clean.includes('am') ? 'am' : clean.includes('m') ? 'pm' : '';
        let timePart = clean.replace(/[apm\s]/g, '');
        let [hours, minutes] = timePart.split(':').map(Number);

        if (isNaN(hours)) return 9999;
        if (isNaN(minutes)) minutes = 0;

        if (modifier === 'pm' && hours < 12) hours += 12;
        if (modifier === 'am' && hours === 12) hours = 0;

        return hours * 60 + minutes;
    };
    const [weeklyNotifData, setWeeklyNotifData] = useState<any[]>([]);
    const [isWeeklySearching, setIsWeeklySearching] = useState(false);
    const [selectedDayInWeek, setSelectedDayInWeek] = useState(0); // 0 = Mon, 4 = Fri
    const [selectedSede, setSelectedSede] = useState('Principal');
    const [groupSedeMap, setGroupSedeMap] = useState<Record<string, string>>({});

    const fetchScheduleForDate = async (dateStr: string) => {
        const { data } = await supabase
            .from('schedules')
            .select('items')
            .eq('date', dateStr)
            .maybeSingle();

        if (data?.items) {
            return (data.items as any[]).sort((a, b) => {
                const valA = timeToMinutes(a.time || a.time_start);
                const valB = timeToMinutes(b.time || b.time_start);
                return valA - valB;
            });
        }
        return [];
    };

    const fetchWeeklyNotifSchedule = async () => {
        setIsWeeklySearching(true);
        try {
            const dates = [];
            for (let i = 0; i < 5; i++) {
                const d = new Date(weekStart.getTime());
                d.setDate(weekStart.getDate() + i);
                dates.push(formatLocalDate(d));
            }



            // Fetch Institutional events
            const { data: instData } = await supabase
                .from('novedades_institucionales')
                .select('*')
                .in('fecha', dates)
                .order('hora', { ascending: true });

            const mapped = dates.map(dateStr => {
                const dayInst = (instData || []).filter(e => e.fecha === dateStr);
                const sortedInst = (dayInst || []).sort((a: any, b: any) =>
                    timeToMinutes(a.hora) - timeToMinutes(b.hora)
                );
                return {
                    date: dateStr,
                    label: new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }),
                    items: [], // Weekly strictly institutional
                    instEvents: sortedInst
                };
            });

            setWeeklyNotifData(mapped);
        } catch (error) {
            console.error('Error fetching weekly notif schedule:', error);
        } finally {
            setIsWeeklySearching(false);
        }
    };

    const changeNotifWeek = (offset: number) => {
        const newDate = new Date(weekStart);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setWeekStart(newDate);
    };

    // Fetch Sede Map
    useEffect(() => {
        const fetchSedeMap = async () => {
            const { data } = await supabase
                .from('estudiantes')
                .select('grupo, sede')
                .eq('estado', 'activo');

            const map: Record<string, string> = {};
            data?.forEach((e: any) => {
                if (e.grupo && e.sede) map[e.grupo] = e.sede;
            });
            setGroupSedeMap(map);
        };
        fetchSedeMap();
    }, []);

    useEffect(() => {
        if (notifModalOpen && activeNotifTab === 'weekly') {
            fetchWeeklyNotifSchedule();
        }
    }, [notifModalOpen, activeNotifTab, weekStart]);

    const handleSearchByDate = async (date: string) => {
        if (!date) return;
        setIsSearching(true);
        setSelectedDate(date);

        // Fetch PAE
        const results = await fetchScheduleForDate(date);
        setSearchResult(results);

        // Fetch Institutional
        const { data: instData } = await supabase
            .from('novedades_institucionales')
            .select('*')
            .eq('fecha', date)
            .order('hora', { ascending: true });

        setSearchInstEvents((instData || []).sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora)));
        setIsSearching(false);
    };

    useEffect(() => {
        // 1. Check initial session immediately to avoid flash of login screen if possible
        const initSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUsuario({
                    ...session.user,
                    nombre: session.user.user_metadata?.nombre || session.user.user_metadata?.full_name || 'Usuario',
                    rol: session.user.user_metadata?.rol || 'docente',
                    foto: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
                });
            }
        };

        const fetchDailySchedules = async () => {
            const now = new Date();
            const bogota = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));

            // 1. Today
            const todayStr = formatLocalDate(bogota);
            setTodayDateStr(todayStr);
            setTodayDateLabel('Hoy, ' + bogota.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }));

            // 2. Tomorrow (Next Business Day)
            const target = new Date(bogota);
            const day = target.getDay();
            if (day === 5) target.setDate(target.getDate() + 3);
            else if (day === 6) target.setDate(target.getDate() + 2);
            else target.setDate(target.getDate() + 1);

            const tomorrowStr = formatLocalDate(target);
            setTomorrowDateStr(tomorrowStr);
            setTomorrowDateLabel(target.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }));

            // Default Tab Logic
            // If it's Friday after 6 PM, or it's Saturday or Sunday, show "Tomorrow" (which will be Monday)
            const dayOfWeek = bogota.getDay();
            const currentHour = bogota.getHours();

            if (currentHour >= 18 || dayOfWeek === 6 || dayOfWeek === 0) {
                setDailySubTab('tomorrow');
            } else {
                setDailySubTab('today');
            }

            // Fetch Today
            const { data: tData } = await supabase.from('schedules').select('items').eq('date', todayStr).maybeSingle();
            if (tData?.items) {
                const sorted = (tData.items as any[]).sort((a, b) => timeToMinutes(a.time || a.time_start) - timeToMinutes(b.time || b.time_start));
                setTodaySchedule(sorted);
                if (sorted.length > 0) setHasNotification(true);
            }
            const { data: tInst } = await supabase.from('novedades_institucionales').select('*').eq('fecha', todayStr);
            setTodayInstEvents((tInst || []).sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora)));

            // Fetch Tomorrow
            const { data: mData } = await supabase.from('schedules').select('items').eq('date', tomorrowStr).maybeSingle();
            if (mData?.items) {
                const sorted = (mData.items as any[]).sort((a, b) => timeToMinutes(a.time || a.time_start) - timeToMinutes(b.time || b.time_start));
                setTomorrowSchedule(sorted);
                if (sorted.length > 0) setHasNotification(true);
            }
            const { data: mInst } = await supabase.from('novedades_institucionales').select('*').eq('fecha', tomorrowStr);
            setTomorrowInstEvents((mInst || []).sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora)));
        };

        const fetchInstChanges = () => {
            if (notifModalOpen) {
                if (activeNotifTab === 'weekly') {
                    fetchWeeklyNotifSchedule();
                } else if (selectedDate) {
                    handleSearchByDate(selectedDate);
                }
            }
        };

        initSession();
        fetchDailySchedules();

        // 2. Realtime listener for schedule changes
        const scheduleChannel = supabase
            .channel('schedule_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'schedules'
                },
                () => {
                    fetchDailySchedules();
                    fetchInstChanges();
                }
            )
            .subscribe();

        // 3. Realtime listener for institutional changes
        const instChannel = supabase
            .channel('inst_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'novedades_institucionales'
                },
                () => {
                    fetchInstChanges();
                }
            )
            .subscribe();

        // 4. Set up the listener for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                setUsuario({
                    ...session.user,
                    nombre: session.user.user_metadata?.nombre || session.user.user_metadata?.full_name || 'Usuario',
                    rol: session.user.user_metadata?.rol || 'docente',
                    foto: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
                });
                fetchDailySchedules();
            } else if (event === 'SIGNED_OUT') {
                setUsuario(null);
                setTodaySchedule([]);
                setTomorrowSchedule([]);
                setHasNotification(false);
            }
        });

        return () => {
            subscription.unsubscribe();
            supabase.removeChannel(scheduleChannel);
            supabase.removeChannel(instChannel);
        };
    }, [router, notifModalOpen, activeNotifTab]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const navItems = [
        { href: '/dashboard', label: 'Inicio', icon: Home },
        { href: '/dashboard/registro', label: 'Registrar', icon: ClipboardList },
        { href: '/dashboard/gestion', label: 'Gestión', icon: Users },
        { href: '/dashboard/reportes', label: 'Reportes', icon: BarChart3 },
    ];

    if (usuario?.rol === 'admin' || usuario?.rol === 'coordinador_pae') {
        navItems.push({ href: '/dashboard/horario', label: 'Horario', icon: Calendar });
    }

    if (usuario?.rol === 'admin') {
        navItems.push({ href: '/dashboard/admin', label: 'Admin', icon: Settings });
    }

    if (!usuario) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 bg-white border-r border-gray-200">
                <div className="p-6 border-b border-gray-100 flex items-center justify-start gap-3 bg-blue-50/50">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 leading-tight">Sistema PAE</h1>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Barroblanco</p>
                    </div>
                </div>

                {/* Notifications Desktop (Search/Global) */}
                <div className="px-4 py-2">
                    <button
                        onClick={() => {
                            setNotifModalOpen(true);
                            setHasNotification(false);
                        }}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:border-blue-200 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Bell className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                                {hasNotification && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />}
                            </div>
                            <span className="text-xs font-bold text-gray-600">Notificaciones</span>
                        </div>
                        {hasNotification && <span className="bg-red-100 text-red-600 text-[8px] font-black px-1.5 py-0.5 rounded-full">NUEVO</span>}
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
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm w-full hover:bg-gray-50 transition-colors text-left"
                        >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold overflow-hidden shadow-inner">
                                {usuario.foto ? (
                                    <img src={usuario.foto} alt={usuario.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    usuario.nombre.charAt(0)
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-bold text-gray-900 truncate">{usuario.nombre}</span>
                                <span className="text-[10px] font-medium text-gray-500 uppercase">{usuario.rol === 'coordinador_pae' ? 'Coordinador' : usuario.rol}</span>
                            </div>
                            <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu Desktop */}
                        {isProfileMenuOpen && (
                            <div className="absolute bottom-full mb-2 left-0 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
                                <Link
                                    href="/dashboard/perfil"
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    onClick={() => setIsProfileMenuOpen(false)}
                                >
                                    <User className="w-4 h-4 text-blue-600" />
                                    Mi Perfil
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors text-left border-t border-gray-50"
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
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-[100] safe-area-bottom">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center w-full py-1 rounded-lg transition-colors ${isActive ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className={`w-6 h-6 mb-1 ${isActive ? 'fill-current' : ''}`} />
                            <span className="text-[10px] font-medium">{item.label}</span>
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
                            className="flex items-center bg-white/20 backdrop-blur-md rounded-full pl-1 pr-3 py-1 gap-2 border border-white/20 active:scale-95 transition-transform"
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
                                    {usuario.rol === 'admin' ? 'Admin' : usuario.rol === 'coordinador_pae' ? 'Coordinador PAE' : 'Docente'}
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
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors bg-gray-50/50"
                                        onClick={() => setIsProfileMenuOpen(false)}
                                    >
                                        <User className="w-4 h-4 text-blue-600" />
                                        Mi Perfil
                                    </Link>
                                    <div className="px-4 py-2 border-t border-gray-100">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Cuenta</p>
                                        <p className="text-xs text-gray-600 truncate font-medium">{usuario.nombre}</p>
                                        <p className="text-[10px] text-gray-400 truncate">{usuario.email}</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors text-left border-t border-gray-100"
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
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setNotifModalOpen(false)}></div>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md relative z-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative shrink-0">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-1.5 rounded-xl">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base leading-tight">Novedades</h3>
                                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                                            {activeNotifTab === 'daily' ? (selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : (dailySubTab === 'today' ? todayDateLabel : tomorrowDateLabel)) : 'Consolidado Semanal'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setNotifModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Control Row: Sede & Date */}
                            <div className="flex gap-2">
                                {/* Date Selector Capsule */}
                                <button
                                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                    className="w-[40%] bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 px-3 flex items-center justify-center gap-2 font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm group shrink-0"
                                >
                                    <span className="truncate">{selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : 'Fecha'}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${isCalendarOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                                </button>

                                {/* Sede Selector Capsule */}
                                <div className="relative w-[60%] group shrink-0">
                                    <select
                                        value={selectedSede}
                                        onChange={(e) => setSelectedSede(e.target.value)}
                                        className="w-full appearance-none bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl py-2.5 pl-4 pr-10 font-bold text-[10px] uppercase tracking-widest cursor-pointer focus:outline-none transition-all"
                                    >
                                        <option value="Principal" className="text-gray-900">Sede Principal</option>
                                        <option value="Primaria" className="text-gray-900">Sede Primaria</option>
                                        <option value="Maria Inmaculada" className="text-gray-900">M. Inmaculada</option>
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-white opacity-60 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-hover:rotate-180 transition-transform" />
                                </div>
                            </div>

                            {/* Inner Calendar - Header Integrated */}
                            {isCalendarOpen && (
                                <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col items-center bg-white p-3 rounded-2xl shadow-xl">
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

                        {/* Tabs Selector (Ultra Compact) */}
                        <div className="px-0 py-2 bg-white border-b border-gray-100 shrink-0">
                            <div className="flex mx-6 p-1 bg-gray-100/50 rounded-full border border-gray-200/50 shadow-inner relative">
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

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] bg-gray-50/30 p-4">
                            {activeNotifTab === 'daily' ? (
                                <div className="space-y-6">
                                    {/* Daily Sub-Tabs (Hoy / Mañana) */}
                                    {!searchResult && (
                                        <div className="flex bg-gray-200/30 p-1 rounded-2xl mb-4 shadow-inner border border-gray-100">
                                            <button
                                                onClick={() => setDailySubTab('today')}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${dailySubTab === 'today' ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                Hoy
                                            </button>
                                            <button
                                                onClick={() => setDailySubTab('tomorrow')}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${dailySubTab === 'tomorrow' ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                Próx. Día
                                            </button>
                                        </div>
                                    )}
                                    {isSearching ? (
                                        <div className="text-center py-10">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                                            <p className="text-xs text-gray-500 mt-2 font-medium">Buscando...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {(() => {
                                                const currentSchedule = searchResult || (dailySubTab === 'today' ? todaySchedule : tomorrowSchedule);
                                                const filteredPAE = currentSchedule.filter(i => {
                                                    const groupSede = groupSedeMap[i.group] || 'Principal';
                                                    return groupSede === selectedSede && (i.notes || i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE');
                                                });

                                                const instEvents = (searchResult ? searchInstEvents : (dailySubTab === 'today' ? todayInstEvents : tomorrowInstEvents)).filter(e => {
                                                    const affected = e.afectados?.toLowerCase() || "";
                                                    return affected.includes('institucional') ||
                                                        affected.includes('plantel') ||
                                                        affected.includes('comunidad') ||
                                                        affected.includes('todos') ||
                                                        affected.includes(selectedSede.toLowerCase());
                                                });

                                                if (filteredPAE.length === 0 && instEvents.length === 0) {
                                                    return (
                                                        <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 text-center mx-2">
                                                            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                                                            <h4 className="text-gray-900 font-black text-sm mb-1">Sin Novedades</h4>
                                                            <p className="text-[10px] text-gray-400 italic">Todo transcurre con normalidad para {selectedSede}.</p>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="space-y-5">
                                                        {/* PAE Absences */}
                                                        {filteredPAE.filter(i => i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE').length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-1 flex items-center gap-1">
                                                                    <X className="w-3 h-3" /> Grupos que NO ASISTEN
                                                                </p>
                                                                {filteredPAE.filter(i => i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE').map((item, idx) => (
                                                                    <div key={`abs-${idx}`} className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-4 shadow-sm">
                                                                        <div className="bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase shrink-0">No Asiste</div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-black text-red-900 text-sm">{item.group}</p>
                                                                            {item.notes && <p className="text-[10px] font-medium text-red-600 italic mt-1">{item.notes}</p>}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* PAE Notes */}
                                                        {filteredPAE.filter(i => i.notes && i.time !== 'NO_ASISTE' && i.time_start !== 'NO_ASISTE').length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                                                                    <Info className="w-4 h-4" /> Otras Novedades
                                                                </p>
                                                                {filteredPAE.filter(i => i.notes && i.time !== 'NO_ASISTE' && i.time_start !== 'NO_ASISTE').map((item, idx) => (
                                                                    <div key={`note-${idx}`} className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-4 shadow-sm">
                                                                        <div className="bg-white border border-amber-200 text-amber-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase shrink-0">{item.time?.split(' - ')[0] || item.time_start}</div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-black text-gray-900 text-sm">{item.group}</p>
                                                                            <p className="text-[10px] font-medium text-amber-600 italic mt-1">{item.notes}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Institutional */}
                                                        {instEvents.length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest pl-1 flex items-center gap-1">
                                                                    <School className="w-3 h-3" /> Agenda Institucional
                                                                </p>
                                                                {instEvents.map((item, idx) => (
                                                                    <div key={`inst-${idx}`} className="bg-cyan-50/50 p-4 rounded-2xl border border-cyan-100 flex items-start gap-4 shadow-sm">
                                                                        <div className="bg-cyan-600 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase shrink-0">Agenda</div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-black text-sm text-cyan-900 mb-0.5">{item.titulo}</p>
                                                                            <p className="text-[10px] font-bold text-cyan-600">{item.hora || 'Todo el día'} - {item.afectados}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Weekly Selector (Compacted) */}
                                    <div className="-mx-4 mb-4">
                                        <div className="bg-white border-y border-gray-100 shadow-xl shadow-cyan-100/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                                                <div className="flex p-1 bg-gray-50/80 rounded-full border border-gray-100 shadow-inner">
                                                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day, dIdx) => (
                                                        <button
                                                            key={day}
                                                            onClick={() => setSelectedDayInWeek(dIdx)}
                                                            className={`flex-1 py-2 text-[10px] font-black rounded-full transition-all duration-500 ${selectedDayInWeek === dIdx ? 'bg-cyan-600 text-white shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}
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
                                        <div className="space-y-5 px-1 animate-in fade-in duration-300">
                                            {(() => {
                                                const dayData = weeklyNotifData[selectedDayInWeek];
                                                if (!dayData) return null;

                                                const inst = (dayData.instEvents || []);

                                                if (inst.length === 0) {
                                                    return (
                                                        <div className="bg-gray-50 p-10 rounded-3xl border border-gray-100 text-center mx-2">
                                                            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                                                            <h4 className="font-black text-gray-900 mb-1">Día sin Agenda</h4>
                                                            <p className="text-[10px] text-gray-400 italic">No hay eventos institucionales programados para este día.</p>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="space-y-4">
                                                        {/* Institutional */}
                                                        {inst.map((item: any, i: number) => (
                                                            <div key={`inst-w-${i}`} className="p-4 rounded-2xl border border-cyan-100 bg-cyan-50/50 flex items-start gap-4 shadow-sm">
                                                                <div className="bg-cyan-600 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase shrink-0">Agenda</div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-sm text-cyan-900 mb-0.5">{item.titulo}</p>
                                                                    <p className="text-[10px] font-bold text-cyan-600">{item.hora || 'Todo el día'} - {item.afectados}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0">
                            <button
                                onClick={() => {
                                    setNotifModalOpen(false);
                                    setSearchResult(null);
                                    setSelectedDate('');
                                }}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-all active:scale-[0.98]"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Spacer for Mobile Header */}
            <div className="md:hidden h-16"></div>
        </div>
    );
}
