'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useHaptics } from '@/hooks/useHaptics';
import {
    FileText,
    Calendar,
    LogOut,
    Building2,
    LayoutDashboard,
    Bell
} from 'lucide-react';
import ConsolidadoModal from './ConsolidadoModal';
import WeeklyScheduleModal from '../WeeklyScheduleModal';
import ScheduleModal from '../ScheduleModal';

// Using Props to reuse user data from parent page
interface SecretariaDashboardProps {
    usuario: {
        nombre: string;
        rol: string;
        email: string;
    };
}

export default function SecretariaDashboard({ usuario }: SecretariaDashboardProps) {
    const router = useRouter();
    const { triggerMedium } = useHaptics();

    // Modals
    const [consolidadoOpen, setConsolidadoOpen] = useState(false);
    const [scheduleOpen, setScheduleOpen] = useState(false); // Reuse existing for "Mañana" logic

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
            {/* Modals */}
            <ConsolidadoModal
                isOpen={consolidadoOpen}
                onClose={() => setConsolidadoOpen(false)}
            />
            <WeeklyScheduleModal
                isOpen={scheduleOpen}
                onClose={() => setScheduleOpen(false)}
            />

            {/* Header Rionegro */}
            <div className="mb-6 -mx-4 lg:mx-0">
                <div className="h-44 md:h-52 relative overflow-hidden lg:rounded-2xl shadow-xl shadow-blue-900/10 border-b-4 border-blue-600 bg-white dark:bg-gray-900">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 dark:opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #2563eb 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                    <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80">
                        <div className="flex items-end justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg dark:bg-blue-900/30 dark:text-blue-300">
                                        Municipio de Rionegro
                                    </span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-lg dark:bg-gray-800 dark:text-gray-400">
                                        {usuario.rol === 'secretaria_educacion' ? 'Secretaría de Educación' : 'Operador PAE'}
                                    </span>
                                </div>
                                <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-none tracking-tight mb-2">
                                    Sistema PAE <span className="text-blue-600">Rionegro</span>
                                </h1>
                                <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium max-w-xl">
                                    Plataforma de seguimiento y control de cobertura nutricional.
                                </p>
                            </div>

                            {/* Stats Pill (Mocked for Demo view) */}
                            <div className="hidden md:block text-right">
                                <div className="text-3xl font-black text-gray-900 dark:text-white">12,450</div>
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Beneficiarios Activos</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Reporte Semanal */}
                <button
                    onClick={() => { triggerMedium(); setConsolidadoOpen(true); }}
                    className="group relative bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-900 transition-all text-left overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <FileText className="w-32 h-32 text-blue-600" />
                    </div>

                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            <LayoutDashboard className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                            Cupos Semanales
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed">
                            Visualiza el consolidado de cupos asignados por institución. Descarga la planilla detallada por sede y tipo de complemento.
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-blue-600 font-bold text-sm">
                            Ver Reporte
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                    </div>
                </button>

                {/* Card 2: Cupos Mañana (Schedule) */}
                <button
                    onClick={() => { triggerMedium(); setScheduleOpen(true); }}
                    className="group relative bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-cyan-200 dark:hover:border-cyan-900 transition-all text-left overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Calendar className="w-32 h-32 text-cyan-600" />
                    </div>

                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl flex items-center justify-center mb-6 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                            <Calendar className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 group-hover:text-cyan-600 transition-colors">
                            Cupos para Mañana
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed">
                            Consulta la agenda diaria y la proyección de raciones actualizada con las novedades más recientes de cada sede.
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-cyan-600 font-bold text-sm">
                            Ver Agenda
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                    </div>
                </button>
            </div>

            {/* Roadmap / Updates Section for Operator too? */}
        </div>
    );
}
