'use client';

import { useEffect, useState, useRef } from 'react';
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
    X,
    Calendar,
    ChevronDown,
    ArrowLeft,
    Clock,
    CheckCircle,
    XCircle,
    UserX,
    UserMinus,
    ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import { DateSelectionModal } from '@/components/ui/DateSelectionModal';

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

// Helper for operation badge style
const getOperationBadge = (op: string) => {
    if (op === 'INSERT') return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'CREACIÓN' };
    if (op === 'DELETE') return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'ELIMINACIÓN' };
    return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'EDICIÓN' };
};

const formatTableName = (name: string) => {
    if (name === 'asistencia_pae') return 'Asistencia PAE';
    if (name === 'estudiantes') return 'Estudiantes';
    return name;
};

export default function AuditoriaPage() {
    const router = useRouter();
    // const dateInputRef = useRef<HTMLInputElement>(null); // Removed in favor of Modal
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const ITEMS_PER_PAGE = 20;

    // Filters
    const [tableFilter, setTableFilter] = useState('all');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    });
    const INITIAL_DATE = new Date().toISOString().split('T')[0];
    const initialLoadRef = useRef(true);

    // Modal for Details
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [showTableFilter, setShowTableFilter] = useState(false);

    useEffect(() => {
        checkAdminAndFetch();
    }, [page, tableFilter, selectedDate]);

    const checkAdminAndFetch = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.push('/');
            return;
        }

        // Verify Admin Role securely
        const { data: profile } = await supabase
            .from('perfiles_publicos')
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

            // Smart Date Logic: If initial load, check if today has data. 
            // If not, fetch latest date first.
            if (initialLoadRef.current && selectedDate === INITIAL_DATE && tableFilter === 'all') {
                // Check count for today first
                const startToday = `${INITIAL_DATE}T00:00:00`;
                const endToday = `${INITIAL_DATE}T23:59:59`;

                const { count: countToday } = await supabase
                    .from('audit_logs')
                    .select('*', { count: 'exact', head: true })
                    .gte('changed_at', startToday)
                    .lte('changed_at', endToday);

                if (countToday === 0) {
                    console.log('No logs for today, searching for most recent logs...');
                    // Find latest date with records
                    const { data: lastLog } = await supabase
                        .from('audit_logs')
                        .select('changed_at')
                        .order('changed_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (lastLog && lastLog.changed_at) {
                        const lastDate = new Date(lastLog.changed_at).toISOString().split('T')[0]; // Simple UTC->Date part as stored in string often, or handle timezone as needed
                        // Actually changed_at is timestamptz.
                        // Let's use local conversion to be safe or just string split if stored as ISO
                        const lastDateLocal = new Date(lastLog.changed_at).toLocaleDateString('en-CA'); // YYYY-MM-DD

                        if (lastDateLocal !== selectedDate) {
                            console.log('Found recent logs at:', lastDateLocal);
                            setSelectedDate(lastDateLocal);
                            initialLoadRef.current = false;
                            return; // Let the useEffect trigger the new fetch with correct date
                        }
                    }
                }
            }
            initialLoadRef.current = false;


            // Actual Fetch
            const startDate = `${selectedDate}T00:00:00`;
            const endDate = `${selectedDate}T23:59:59`;

            query = query
                .gte('changed_at', startDate)
                .lte('changed_at', endDate)
                .order('changed_at', { ascending: false })
                .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

            const { data, count, error } = await query;

            if (error) throw error;

            // Enhance with user data (Batch fetch for performance and preventing 406 errors)
            const uniqueUserIds = Array.from(new Set((data || []).map(log => log.changed_by).filter(Boolean)));

            let userMap: Record<string, { nombre: string; email: string }> = {};

            if (uniqueUserIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('usuarios')
                    .select('id, nombre, email')
                    .in('id', uniqueUserIds);

                if (usersData) {
                    usersData.forEach(u => {
                        userMap[u.id] = { nombre: u.nombre, email: u.email };
                    });
                }
            }

            const enhancedLogs = (data || []).map((log) => {
                const user = log.changed_by ? userMap[log.changed_by] : null;

                return {
                    ...log,
                    usuario_nombre: user?.nombre || (log.changed_by ? 'Usuario Eliminado' : 'Sistema'),
                    usuario_email: user?.email || (log.changed_by ? 'N/A' : 'Automático')
                };
            });

            setLogs(enhancedLogs);
            setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));

        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors">

            <DateSelectionModal
                isOpen={showCalendar}
                onClose={() => setShowCalendar(false)}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                title="Seleccionar Fecha Auditoría"
            />

            {/* Header Premium (Synced with Reportes) */}
            <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 shadow-xl shadow-cyan-900/10 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:pt-6 md:pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard/perfil"
                                className="p-2 md:p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-lg border border-white/10"
                            >
                                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                            </Link>
                            <div className="relative">
                                <h1 className="text-lg md:text-2xl font-black text-white leading-none tracking-tight">Auditoría del Sistema</h1>
                                <div className="flex items-center gap-2 mt-1 opacity-90">
                                    <p className="text-[9px] md:text-[11px] font-bold text-cyan-50 uppercase tracking-[0.2em]">
                                        REGISTROS DEL {selectedDate}
                                    </p>
                                    <span className="w-1 h-1 rounded-full bg-cyan-200/50"></span>
                                    <p className="text-[9px] md:text-[10px] font-black text-cyan-100/60 uppercase tracking-widest">SEGURIDAD V1.0</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Refresh Button */}
                            <button
                                onClick={fetchLogs}
                                className="p-2 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all shadow-lg border border-white/10 active:scale-95 group"
                                title="Actualizar registro"
                            >
                                <RefreshCcw className={`w-5 h-5 md:w-6 md:h-6 ${loading ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Date Picker Premium */}
                            <button
                                onClick={() => setShowCalendar(true)}
                                className="p-2 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all shadow-lg border border-white/10 active:scale-95"
                            >
                                <Calendar className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto space-y-6 px-4 md:px-8 py-8">

                {/* Filters - Restore Location with New Style */}
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Filter Dropdown (Custom Style Adapted for Body) */}
                    <div className="relative min-w-[240px]">
                        <button
                            onClick={() => setShowTableFilter(!showTableFilter)}
                            className="w-full p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl transition-all shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 active:scale-95 flex items-center gap-2 justify-between group"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="bg-cyan-50 dark:bg-cyan-900/30 p-1.5 rounded-lg text-cyan-600 dark:text-cyan-400">
                                    <FileJson className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] uppercase font-black tracking-widest truncate">
                                    {tableFilter === 'all' ? 'Todas las tablas' : formatTableName(tableFilter)}
                                </span>
                            </div>
                            {showTableFilter ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-cyan-500 transition-colors" />}
                        </button>

                        {showTableFilter && (
                            <>
                                <div className="fixed inset-0 z-[60]" onClick={() => setShowTableFilter(false)}></div>
                                <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden z-[70] animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                                    <div className="p-1.5 space-y-1">
                                        {[
                                            { id: 'all', label: 'Todas las tablas' },
                                            { id: 'asistencia_pae', label: 'Asistencia PAE' },
                                            { id: 'estudiantes', label: 'Estudiantes' },
                                            { id: 'usuarios', label: 'Usuarios' }
                                        ].map((option) => (
                                            <button
                                                key={option.id}
                                                onClick={() => { setTableFilter(option.id); setShowTableFilter(false); }}
                                                className={`w-full text-left px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${tableFilter === option.id
                                                    ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                                                    }`}
                                            >
                                                {option.label}
                                                {tableFilter === option.id && <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>


                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-left border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha / Hora</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Usuario</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Evento / Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {logs.length === 0 && !loading ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                            No se encontraron registros de auditoría
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const badge = getOperationBadge(log.operation);
                                        return (
                                            <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                        {new Date(log.changed_at).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-xs text-gray-500 font-mono">
                                                        {new Date(log.changed_at).toLocaleTimeString()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 flex items-center justify-center text-xs font-black shrink-0">
                                                            {log.usuario_nombre?.charAt(0) || '?'}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate max-w-[150px]">{log.usuario_nombre}</span>
                                                            <span className="text-[10px] text-gray-400 truncate max-w-[150px] block" title={log.usuario_email}>
                                                                {log.usuario_email?.split('@')[0]}<span className="opacity-50">@{log.usuario_email?.split('@')[1] || ''}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex flex-col items-end gap-1.5">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${badge.bg} ${badge.text}`}>
                                                            {badge.label}
                                                        </span>
                                                        <button
                                                            onClick={() => setSelectedLog(log)}
                                                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                                                            title="Ver Detalle"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
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

            {/* Detail Modal - Glassmorphism Style */}
            {selectedLog && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedLog(null)} />
                    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl w-full max-w-3xl rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 border border-white/20 ring-1 ring-black/5">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100/50 dark:border-white/10 bg-white/40 dark:bg-white/5 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-black/5">
                                    <FileJson className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                                        Detalle del Cambio
                                    </h3>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                                        ID: <span className="font-mono text-xs">{selectedLog.id.slice(0, 8)}...</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-2.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white hover:rotate-90"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

                            {/* Metadata Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Responsable</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-[10px] font-black">
                                            {selectedLog.usuario_nombre?.charAt(0) || '?'}
                                        </div>
                                        <div className="truncate text-sm font-bold text-gray-700 dark:text-gray-200">
                                            {selectedLog.usuario_nombre}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Acción</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${getOperationBadge(selectedLog.operation).bg} ${getOperationBadge(selectedLog.operation).text}`}>
                                        {selectedLog.operation}
                                    </span>
                                </div>
                                <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Tabla</span>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 font-mono">
                                        {selectedLog.table_name}
                                    </span>
                                </div>
                            </div>

                            {/* Data Diff */}
                            <div className="grid grid-cols-1 gap-4">
                                {selectedLog.old_data && (
                                    <div className="flex flex-col gap-2">
                                        <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                            Datos Anteriores
                                        </h4>
                                        <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 overflow-hidden">
                                            <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                                                {JSON.stringify(selectedLog.old_data, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}

                                {selectedLog.new_data && (
                                    <div className="flex flex-col gap-2">
                                        <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                            Datos Nuevos
                                        </h4>
                                        <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl p-4 overflow-hidden">
                                            <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                                                {JSON.stringify(selectedLog.new_data, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-100/50 dark:border-white/10 shrink-0">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
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
