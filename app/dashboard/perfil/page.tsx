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
    Clock
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ProfilePage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
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

            // Fetch Stats
            try {
                const { data, error } = await supabase
                    .from('asistencia_pae')
                    .select('fecha, estudiantes(grupo)')
                    .eq('registrado_por', user.id);

                if (!error && data) {
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

            </div>
        </div>
    );
}
