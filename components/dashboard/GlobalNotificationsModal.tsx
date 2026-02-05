import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Bell, School, Info, CheckCircle, Search, Filter, AlertTriangle, ArrowDown } from 'lucide-react';
import { useModalBack } from '@/hooks/useModalBack';

interface GlobalNotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    usuario: any;
}

export default function GlobalNotificationsModal({ isOpen, onClose, usuario }: GlobalNotificationsModalProps) {
    useModalBack(isOpen, onClose, 'global-notif-modal');
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const [novedades, setNovedades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchNovedades();
        }
    }, [isOpen]);

    const fetchNovedades = async () => {
        try {
            setLoading(true);
            // Fetch latest updates (limit 50)
            const { data, error } = await supabase
                .from('novedades_cupos')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNovedades(data || []);
        } catch (error) {
            console.error('Error fetching global update:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header - Rionegro Style */}
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-5 shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3 text-white">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                                <Bell className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-1">Novedades Globales</h3>
                                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">
                                    Sistema PAE Rionegro
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-95"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs / Filters */}
                    <div className="flex gap-2 mt-6">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${activeTab === 'all' ? 'bg-white text-blue-600 shadow-lg' : 'bg-white/10 text-blue-100 hover:bg-white/20'}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setActiveTab('unread')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${activeTab === 'unread' ? 'bg-white text-blue-600 shadow-lg' : 'bg-white/10 text-blue-100 hover:bg-white/20'}`}
                        >
                            Sin Leer (0)
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 custom-scrollbar">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <span className="text-xs font-bold uppercase tracking-widest">Cargando reportes...</span>
                        </div>
                    ) : novedades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 border-4 border-white dark:border-gray-700 shadow-sm">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <h4 className="font-black text-gray-900 dark:text-white text-lg mb-2">Todo al día</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                                No hay reportes de novedades recientes enviados por las instituciones.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* List Items */}
                            {novedades.map((novedad) => (
                                <div key={novedad.id || Math.random()} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-2">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-black uppercase tracking-wider rounded-lg">
                                                I.E. BARRO BLANCO
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {/* Hace un momento - using formatted data if available later */}
                                                {novedad.created_at ? new Date(novedad.created_at).toLocaleDateString() : 'Reciente'}
                                            </span>
                                        </div>
                                        {Number(novedad.cupos_afectados) > 0 && (
                                            <div className="flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
                                                <ArrowDown className="w-3 h-3" />
                                                <span className="text-xs font-black">-{novedad.cupos_afectados}</span>
                                            </div>
                                        )}
                                    </div>

                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-1 line-clamp-1">
                                        {novedad.razon || 'Novedad de Cupos'}
                                    </h4>

                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                                        <span>Sede: <strong>{novedad.sede}</strong></span>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span>Grupo: <strong>{novedad.grupo || 'General'}</strong></span>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
                                        <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                            C
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-medium">Reportado por Coordinador</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-black text-sm transition-colors active:scale-[0.98]"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
