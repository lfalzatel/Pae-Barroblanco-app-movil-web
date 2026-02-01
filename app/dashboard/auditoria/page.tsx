'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    ShieldAlert,
    Search,
    RefreshCcw,
    ChevronLeft,
    ChevronRight,
    Eye,
    FileJson,
    X
} from 'lucide-react';

interface AuditLog {
    id: string;
    table_name: string;
    operation: string;
    old_data: any;
    new_data: any;
    changed_at: string;
    changed_by: string;
    usuario_nombre?: string;
    usuario_email?: string;
}

export default function AuditoriaPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const ITEMS_PER_PAGE = 20;

    // Filters
    const [tableFilter, setTableFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('');

    // Modal for Details
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        checkAdminAndFetch();
    }, [page, tableFilter, userFilter]);

    const checkAdminAndFetch = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.push('/');
            return;
        }

        // Verify Admin Role securely
        const { data: profile } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', session.user.id)
            .single();

        if (profile?.rol !== 'admin') {
            router.push('/dashboard');
            return;
        }

        fetchLogs();
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('audit_logs')
                .select('*', { count: 'exact' });

            if (tableFilter !== 'all') {
                query = query.eq('table_name', tableFilter);
            }

            // Note: Ordering by nested JSON or joined fields often requires triggers/functions
            // Here we filter by exact UUID if user provides it, or client side logic if needed.
            // For now, simple direct filters.

            query = query
                .order('changed_at', { ascending: false })
                .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

            const { data, count, error } = await query;

            if (error) throw error;

            // Enhance with user data (Manual Join for performance/simplicity)
            const enhancedLogs = await Promise.all((data || []).map(async (log) => {
                if (!log.changed_by) return log;

                // Try fetch generic user info from public profile table (usuarios)
                // Adjust this if your user table is different
                const { data: uData } = await supabase
                    .from('usuarios')
                    .select('nombre, email')
                    .eq('id', log.changed_by)
                    .single();

                return {
                    ...log,
                    usuario_nombre: uData?.nombre || 'Desconocido',
                    usuario_email: uData?.email || 'N/A'
                };
            }));

            setLogs(enhancedLogs);
            setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));

        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDiff = (log: AuditLog) => {
        if (log.operation === 'INSERT') return { added: log.new_data };
        if (log.operation === 'DELETE') return { removed: log.old_data };

        // UPDATE: Compare fields
        const changes: any = { before: {}, after: {} };
        const oldD = log.old_data || {};
        const newD = log.new_data || {};

        Object.keys(newD).forEach(key => {
            if (JSON.stringify(oldD[key]) !== JSON.stringify(newD[key])) {
                changes.before[key] = oldD[key];
                changes.after[key] = newD[key];
            }
        });

        return changes;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 p-4 md:p-8 animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                            <ShieldAlert className="w-8 h-8 text-cyan-600" />
                            Auditoría del Sistema
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
                            Historial detallado de cambios y seguridad (Solo Admin)
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={fetchLogs}
                            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                        >
                            <RefreshCcw className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tabla</label>
                        <select
                            value={tableFilter}
                            onChange={(e) => setTableFilter(e.target.value)}
                            className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                        >
                            <option value="all">Todas</option>
                            <option value="asistencia_pae">Asistencia PAE</option>
                            <option value="estudiantes">Estudiantes</option>
                        </select>
                    </div>
                    {/* Future: User Search/Filter */}
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-left border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha / Hora</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Usuario</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Acción</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Tabla</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {logs.length === 0 && !loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                            No se encontraron registros de auditoría
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {new Date(log.changed_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono">
                                                    {new Date(log.changed_at).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 flex items-center justify-center text-xs font-bold">
                                                        {log.usuario_nombre?.charAt(0) || '?'}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{log.usuario_nombre}</span>
                                                        <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{log.usuario_email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest
                                    ${log.operation === 'INSERT' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        log.operation === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}
                                `}>
                                                    {log.operation}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                                    {log.table_name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            className="p-2 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-xs font-bold text-gray-500">
                            Página {page + 1} de {totalPages || 1}
                        </span>
                        <button
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
                    <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="text-lg font-black flex items-center gap-2 text-gray-900 dark:text-white">
                                <FileJson className="w-5 h-5 text-cyan-600" />
                                Detalle del Cambio
                            </h3>
                            <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                                    <span className="block text-[10px] font-black uppercase text-red-500 mb-2">Valor Anterior</span>
                                    <pre className="whitespace-pre-wrap word-break text-gray-700 dark:text-gray-300">
                                        {JSON.stringify(selectedLog.old_data, null, 2) || 'N/A (Insert)'}
                                    </pre>
                                </div>
                                <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl">
                                    <span className="block text-[10px] font-black uppercase text-green-500 mb-2">Valor Nuevo</span>
                                    <pre className="whitespace-pre-wrap word-break text-gray-700 dark:text-gray-300">
                                        {JSON.stringify(selectedLog.new_data, null, 2) || 'N/A (Delete)'}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-right">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl shadow-lg hover:scale-105 transition-transform"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
