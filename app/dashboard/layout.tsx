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
    const [tomorrowSchedule, setTomorrowSchedule] = useState<any[]>([]);
    const [tomorrowDateLabel, setTomorrowDateLabel] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [searchResult, setSearchResult] = useState<any[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [tomorrowDateStr, setTomorrowDateStr] = useState('');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [activeNotifTab, setActiveNotifTab] = useState<'daily' | 'weekly'>('daily');
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const now = new Date();
        const bogotaNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));

        const day = bogotaNow.getDay();
        const hour = bogotaNow.getHours();

        const d = new Date(bogotaNow);
        if ((day === 5 && hour >= 20) || day === 6 || day === 0) {
            const daysToAdd = day === 5 ? 3 : (day === 6 ? 2 : 1);
            d.setDate(d.getDate() + daysToAdd);
        } else {
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            d.setDate(diff);
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
                const timeA = a.time || a.time_start || "";
                const timeB = b.time || b.time_start || "";
                return timeA.localeCompare(timeB);
            });
        }
        return [];
    };

    const fetchWeeklyNotifSchedule = async () => {
        setIsWeeklySearching(true);
        try {
            const dates = [];
            for (let i = 0; i < 5; i++) {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                dates.push(formatLocalDate(d));
            }

            // Fetch PAE schedules
            const { data: schedData } = await supabase
                .from('schedules')
                .select('*')
                .in('date', dates);

            // Fetch Institutional events
            const { data: instData } = await supabase
                .from('novedades_institucionales')
                .select('*')
                .in('fecha', dates)
                .order('hora', { ascending: true });

            const mapped = dates.map(dateStr => {
                const dayData = (schedData || []).find(d => d.date === dateStr);
                const dayInst = (instData || []).filter(e => e.fecha === dateStr);
                return {
                    date: dateStr,
                    label: new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }),
                    items: dayData?.items || [],
                    instEvents: dayInst
                };
            });

            setWeeklyNotifData(mapped);
        } catch (error) {
            console.error('Error fetching weekly notif schedule:', error);
        } finally {
            setIsWeeklySearching(true); // Small delay feel or keep it as false? It was false.
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
        const results = await fetchScheduleForDate(date);
        setSearchResult(results);
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

        const fetchTomorrowSchedule = async () => {
            const now = new Date();
            // Get current Bogota date
            const bogota = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));

            const target = new Date(bogota);
            const day = target.getDay();

            // Smart business day: Fri/Sat -> Mon, others -> +1
            if (day === 5) target.setDate(target.getDate() + 3);
            else if (day === 6) target.setDate(target.getDate() + 2);
            else target.setDate(target.getDate() + 1);

            // Format as YYYY-MM-DD using Bogota components
            const y = target.getFullYear();
            const m = (target.getMonth() + 1).toString().padStart(2, '0');
            const d = target.getDate().toString().padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            setTomorrowDateStr(dateStr);
            setTomorrowDateLabel(target.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }));

            const { data } = await supabase
                .from('schedules')
                .select('items')
                .eq('date', dateStr)
                .maybeSingle();

            if (data?.items) {
                // Sort by time before setting state
                const sorted = (data.items as any[]).sort((a, b) => {
                    const timeA = a.time || a.time_start || "";
                    const timeB = b.time || b.time_start || "";
                    return timeA.localeCompare(timeB);
                });
                setTomorrowSchedule(sorted);
                setHasNotification(true);
            }
        };

        const fetchInstChanges = () => {
            if (notifModalOpen && activeNotifTab === 'weekly') {
                fetchWeeklyNotifSchedule();
            }
        };

        initSession();
        fetchTomorrowSchedule();

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
                    fetchTomorrowSchedule();
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
                fetchTomorrowSchedule();
            } else if (event === 'SIGNED_OUT') {
                setUsuario(null);
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
                    <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-xl">
                                        <Bell className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg leading-tight">Novedades</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{activeNotifTab === 'daily' ? tomorrowDateLabel : 'Consolidado Semanal'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setNotifModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Sede Selector (Premium) */}
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <School className="w-4 h-4 text-white/70" />
                                </div>
                                <select
                                    value={selectedSede}
                                    onChange={(e) => setSelectedSede(e.target.value)}
                                    className="w-full appearance-none bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl py-2.5 pl-10 pr-8 font-bold text-xs uppercase tracking-tight shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                                >
                                    <option value="Principal" className="text-gray-900 font-bold">Sede Principal</option>
                                    <option value="Primaria" className="text-gray-900 font-bold">Sede Primaria</option>
                                    <option value="Maria Inmaculada" className="text-gray-900 font-bold">Sede M. Inmaculada</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-white/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:rotate-180 transition-transform" />
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100">
                            <button
                                onClick={() => setActiveNotifTab('daily')}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${activeNotifTab === 'daily' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-cyan-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                            >
                                Mañana
                            </button>
                            <button
                                onClick={() => setActiveNotifTab('weekly')}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${activeNotifTab === 'weekly' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-cyan-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                            >
                                Semana
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            {activeNotifTab === 'daily' ? (
                                <>
                                    {/* Enhanced Date Selector with Collapsible MiniCalendar */}
                                    <div className="mb-6 bg-gray-50/80 rounded-3xl border border-gray-200 overflow-hidden transition-all duration-300 shadow-sm">
                                        <button
                                            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                            className="w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="bg-cyan-100 p-2 rounded-xl group-hover:scale-110 transition-transform animate-pulse">
                                                    <Calendar className="w-5 h-5 text-cyan-600" />
                                                </div>
                                                <span className="text-[11px] font-black text-gray-900 uppercase tracking-[0.15em]">Consultar Fecha</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedDate && (
                                                    <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-100">
                                                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isCalendarOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>

                                        {isCalendarOpen && (
                                            <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                                <MiniCalendar
                                                    selectedDate={selectedDate || tomorrowDateStr}
                                                    onSelectDate={(date) => {
                                                        handleSearchByDate(date);
                                                        setIsCalendarOpen(false); // Auto-collapse on select
                                                    }}
                                                    mode="schedules"
                                                    className="!shadow-none !border-none !p-0 bg-transparent"
                                                />
                                                <div className="mt-4 pt-3 border-t border-gray-100">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDate('');
                                                            setSearchResult(null);
                                                            setIsCalendarOpen(false);
                                                        }}
                                                        className="w-full text-[10px] font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 px-3 py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <RefreshCcw className="w-3 h-3" />
                                                        Ver Mañana (Reset)
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="px-6 mb-6">
                                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
                                        {/* Week Selector - Dark Header Style */}
                                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-3 flex items-center justify-between">
                                            <button onClick={() => changeNotifWeek(-1)} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white">
                                                <ChevronLeftIcon className="w-4 h-4" />
                                            </button>
                                            <span className="text-[10px] font-black px-2 uppercase tracking-widest text-white text-center">
                                                {weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - {new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                            </span>
                                            <button onClick={() => changeNotifWeek(1)} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white">
                                                <ChevronRightIcon className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Day Tab Selector - Light Capsule Style */}
                                        <div className="p-4">
                                            <div className="flex p-1 bg-gray-50 rounded-full border border-gray-100 shadow-inner">
                                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day, dIdx) => (
                                                    <button
                                                        key={day}
                                                        onClick={() => setSelectedDayInWeek(dIdx)}
                                                        className={`flex-1 py-2 text-[10px] font-black rounded-full transition-all duration-300 ${selectedDayInWeek === dIdx
                                                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-100'
                                                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                                                    >
                                                        {day}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeNotifTab === 'daily' ? (
                                <>
                                    {!isSearching && (
                                        (() => {
                                            const filteredTomorrow = tomorrowSchedule.filter(i => {
                                                const groupSede = groupSedeMap[i.group] || 'Principal';
                                                return groupSede === selectedSede;
                                            });
                                            const filteredSearch = searchResult ? searchResult.filter(i => {
                                                const groupSede = groupSedeMap[i.group] || 'Principal';
                                                return groupSede === selectedSede;
                                            }) : null;

                                            return (filteredTomorrow.length > 0 || (filteredSearch && filteredSearch.length > 0));
                                        })()
                                    ) && (
                                            <div className="mb-6 bg-cyan-50/50 p-4 rounded-3xl border border-cyan-100 flex items-center gap-4 animate-in fade-in duration-500">
                                                <div className="bg-cyan-600 p-2 rounded-xl shadow-lg shadow-cyan-200">
                                                    <Calendar className="w-5 h-5 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-cyan-900">Horario Publicado</h4>
                                                    <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest">Revisa las novedades abajo</p>
                                                </div>
                                            </div>
                                        )}

                                    {isSearching ? (
                                        <div className="text-center py-10">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                            <p className="text-xs text-gray-500 mt-2 font-medium">Buscando novedades...</p>
                                        </div>
                                    ) : searchResult ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest pl-1">Resultados para {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                                            </div>
                                            {searchResult.filter((i: any) => {
                                                const groupSede = groupSedeMap[i.group] || 'Principal';
                                                return groupSede === selectedSede && (i.notes || i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE');
                                            }).length > 0 ? (
                                                searchResult.filter((i: any) => {
                                                    const groupSede = groupSedeMap[i.group] || 'Principal';
                                                    return groupSede === selectedSede && (i.notes || i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE');
                                                }).map((item: any, idx: number) => (
                                                    <div key={`search-${idx}`} className={`p-4 rounded-2xl border flex items-start gap-4 shadow-sm ${item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                                                        <div className={`${item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE' ? 'bg-red-600' : 'bg-white border border-amber-200 text-amber-600'} px-2 py-1 rounded-lg text-[10px] font-black ${item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE' ? 'text-white' : ''} shrink-0 uppercase`}>
                                                            {item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE' ? 'No Asiste' : (item.time?.split(' - ')[0] || item.time_start)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`font-bold text-sm mb-1 ${item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE' ? 'text-red-900' : 'text-gray-900'}`}>{item.group}</p>
                                                            {item.notes && (
                                                                <div className={`flex items-start gap-1.5 text-[10px] ${item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE' ? 'text-red-600' : 'text-amber-600'}`}>
                                                                    <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                                                                    <span className="italic font-bold">{item.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                                                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                                                    <p className="text-xs font-bold text-gray-500">Sin novedades</p>
                                                    <p className="text-[10px] text-gray-400 italic">No hay cambios registrados para esta fecha.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-4">Novedades de Mañana</p>
                                            {(() => {
                                                const filteredTomorrow = tomorrowSchedule.filter(i => {
                                                    const groupSede = groupSedeMap[i.group] || 'Principal';
                                                    return groupSede === selectedSede;
                                                });

                                                if (filteredTomorrow.length > 0) {
                                                    return (
                                                        <div className="space-y-4">
                                                            {filteredTomorrow.filter(i => i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE').length > 0 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-1 flex items-center gap-1">
                                                                        <X className="w-3 h-3" />
                                                                        Grupos que NO ASISTEN
                                                                    </p>
                                                                    {filteredTomorrow.filter(i => i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE').map((item, idx) => (
                                                                        <div key={`absent-${idx}`} className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-4 ring-1 ring-red-50/50 shadow-sm">
                                                                            <div className="bg-red-600 px-2 py-1 rounded-lg text-[10px] font-black text-white shrink-0 uppercase">
                                                                                No Asiste
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-bold text-red-900 text-sm mb-1">{item.group}</p>
                                                                                {item.notes && (
                                                                                    <div className="flex items-start gap-1.5 text-[10px] text-red-600">
                                                                                        <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                                                                                        <span className="italic font-bold">{item.notes}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                                                                    <Info className="w-4 h-4" />
                                                                    Otras Novedades
                                                                </p>
                                                                {filteredTomorrow.filter(i => i.notes && i.time !== 'NO_ASISTE' && i.time_start !== 'NO_ASISTE').length > 0 ? (
                                                                    filteredTomorrow.filter(i => i.notes && i.time !== 'NO_ASISTE' && i.time_start !== 'NO_ASISTE').map((item, idx) => (
                                                                        <div key={`note-${idx}`} className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-4 shadow-sm">
                                                                            <div className="bg-white px-2 py-1 rounded-lg border border-amber-200 text-[10px] font-black text-amber-600 shrink-0 uppercase">
                                                                                {item.time?.split(' - ')[0] || item.time_start}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-bold text-gray-900 text-sm mb-1">{item.group}</p>
                                                                                {item.notes && (
                                                                                    <div className="flex items-start gap-1.5 text-[10px] text-amber-600">
                                                                                        <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                                                                                        <span className="italic font-medium">{item.notes}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    (filteredTomorrow.filter(i => i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE').length === 0 && filteredTomorrow.filter(i => i.notes).length === 0) && (
                                                                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                                                                            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                                            <p className="text-xs font-bold text-gray-500">Sin cambios reportados</p>
                                                                            <p className="text-[10px] text-gray-400 italic">Todos los grupos ingresan en su horario normal.</p>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                                                            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                            <p className="text-xs font-bold text-gray-500">Sin programación</p>
                                                            <p className="text-[10px] text-gray-400 italic">No hay horario publicado para {selectedSede} mañana.</p>
                                                        </div>
                                                    );
                                                }
                                            })()}

                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-6">
                                    {isWeeklySearching ? (
                                        <div className="text-center py-20">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                            <p className="text-xs text-gray-500 mt-2 font-medium">Cargando consolidado semanal...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {(() => {
                                                const day = weeklyNotifData[selectedDayInWeek];
                                                if (!day) return null;
                                                const news = day.items.filter((i: any) => {
                                                    const groupSede = groupSedeMap[i.group] || 'Principal';
                                                    return groupSede === selectedSede && (i.notes || i.time === 'NO_ASISTE' || i.time_start === 'NO_ASISTE');
                                                });

                                                const instNews = (day.instEvents || []).map((e: any) => ({
                                                    ...e,
                                                    isInst: true
                                                }));

                                                const totalNews = [...news, ...instNews];

                                                if (totalNews.length === 0) {
                                                    return (
                                                        <div className="bg-gray-50 p-10 rounded-3xl border border-gray-100 text-center animate-in fade-in duration-300">
                                                            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                                                            <h4 className="font-black text-gray-900 mb-1">Sin Novedades</h4>
                                                            <p className="text-[10px] text-gray-400 italic">No hay cambios reportados para el {day.label.split(',')[0]}.</p>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="bg-cyan-50 p-1.5 rounded-lg">
                                                                <School className="w-4 h-4 text-cyan-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[8px] font-black text-cyan-600 uppercase tracking-widest leading-none mb-1">Novedades del día</p>
                                                                <p className="text-sm font-black text-gray-900 leading-none">
                                                                    {day.label.split(',')[0]}
                                                                    <span className="text-gray-300 ml-1.5 font-black">{day.label.split(',')[1]}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {totalNews.map((item: any, i: number) => {
                                                                if (item.isInst) {
                                                                    return (
                                                                        <div key={`inst-${i}`} className="p-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 flex items-start gap-3 shadow-sm">
                                                                            <div className="bg-cyan-600 text-white px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase shrink-0">
                                                                                Agenda
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                                    {item.prioridad === 'alta' && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                                                                                    <p className="font-black text-[11px] text-cyan-900 truncate">{item.titulo}</p>
                                                                                </div>
                                                                                <p className="text-[9px] font-bold text-cyan-600/80">{item.hora || 'Todo el día'} - {item.afectados || 'Institucional'}</p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                const isAbsent = item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE';
                                                                return (
                                                                    <div key={`pae-${i}`} className={`p-3 rounded-2xl border flex items-start gap-3 shadow-sm ${isAbsent ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                                                                        <div className={`${isAbsent ? 'bg-red-600 text-white' : 'bg-cyan-50 text-cyan-600 border border-cyan-100'} px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase shrink-0`}>
                                                                            {isAbsent ? 'No Asiste' : (item.time?.split(' - ')[0] || item.time_start)}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`font-black text-[11px] ${isAbsent ? 'text-red-900' : 'text-gray-900'}`}>{item.group}</p>
                                                                            {item.notes && <p className={`text-[9px] font-medium italic mt-0.5 line-clamp-1 ${isAbsent ? 'text-red-600' : 'text-gray-500'}`}>{item.notes}</p>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

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
            )
            }

            {/* Spacer for Mobile Header */}
            <div className="md:hidden h-16"></div>
        </div >
    );
}
