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
    Clock,
    FileText,
    X,
} from 'lucide-react';

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
            const day = now.getDay();
            const target = new Date(now);

            // Smart business day: Fri/Sat -> Mon, others -> +1
            if (day === 5) target.setDate(target.getDate() + 3);
            else if (day === 6) target.setDate(target.getDate() + 2);
            else target.setDate(target.getDate() + 1);

            const dateStr = target.toISOString().split('T')[0];
            setTomorrowDateLabel(target.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }));

            const { data } = await supabase
                .from('schedules')
                .select('items')
                .eq('date', dateStr)
                .single();

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

        initSession();
        fetchTomorrowSchedule();

        // 2. Set up the listener for changes (sign in, sign out, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                setUsuario(null);
                router.push('/');
            } else if (session) {
                setUsuario({
                    ...session.user,
                    nombre: session.user.user_metadata?.nombre || session.user.user_metadata?.full_name || 'Usuario',
                    rol: session.user.user_metadata?.rol || 'docente',
                    foto: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
                });
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

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
                        <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white relative">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-white/20 p-2 rounded-xl">
                                    <Bell className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg">Aviso de Horario</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{tomorrowDateLabel}</p>
                                </div>
                            </div>
                            <button onClick={() => setNotifModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {tomorrowSchedule.length > 0 ? (
                                <div className="space-y-4">
                                    <p className="text-xs font-medium text-gray-500 leading-relaxed">
                                        Se ha publicado el <span className="font-bold text-gray-900">horario de mañana</span>. Aquí los grupos con novedades:
                                    </p>
                                    <div className="space-y-2">
                                        {tomorrowSchedule.map((item, idx) => (
                                            <div key={idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-start gap-4">
                                                <div className="bg-white px-2 py-1 rounded-lg border border-gray-200 text-[10px] font-black text-blue-600 shrink-0">
                                                    {item.time.split(' - ')[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-gray-900 text-sm mb-1">{item.group}</p>
                                                    {item.notes ? (
                                                        <div className="flex items-start gap-1.5 text-[10px] text-amber-600">
                                                            <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                                                            <span className="italic font-medium">{item.notes}</span>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-gray-400 italic">Ingreso normal</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <Clock className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">No hay avisos pendientes para mañana.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <button
                                onClick={() => setNotifModalOpen(false)}
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
