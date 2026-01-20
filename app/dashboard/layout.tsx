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
    Calendar // Import Calendar icon
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
            } else {
                // If no session found initially, wait for onAuthStateChange or redirect
                // But strictly speaking, onAuthStateChange handles INITIAL_SESSION too.
                // We'll let the listener handle the strict redirect to avoid premature kicks.
            }
        };
        initSession();

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
                                <span className="text-[10px] font-medium text-gray-500 uppercase">{usuario.rol}</span>
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
                {/* Title on the left */}
                <h1 className="text-xl font-black text-white tracking-tight">
                    Sistema PAE
                </h1>

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
                                {usuario.rol === 'admin' ? 'Admin' : 'Docente'}
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

            {/* Spacer for Mobile Header */}
            <div className="md:hidden h-16"></div>
        </div>
    );
}
