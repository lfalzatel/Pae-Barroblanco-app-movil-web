'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useModalBack } from '@/hooks/useModalBack';
import {
    Users,
    X,
    Calendar,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Clock,
    Info,
    School
} from 'lucide-react';

interface StudentHistoryModalProps {
    student: {
        id: string;
        nombre: string;
        matricula?: string;
        grupo?: string;
        grado?: string;
        sede?: string;
    } | null;
    onClose: () => void;
}

export default function StudentHistoryModal({ student, onClose }: StudentHistoryModalProps) {
    const [studentHistory, setStudentHistory] = useState<any[]>([]);
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [selectedStudentDate, setSelectedStudentDate] = useState<any | null>(null);

    // Modal back button hooks
    useModalBack(!!student, onClose, 'student-history-modal');
    useModalBack(!!selectedStudentDate, () => setSelectedStudentDate(null), 'student-date-detail-modal');

    useEffect(() => {
        if (!student) {
            setStudentHistory([]);
            setSelectedStudentDate(null);
            return;
        }

        const fetchHistory = async () => {
            const { data } = await supabase
                .from('asistencia_pae')
                .select('*')
                .eq('estudiante_id', student.id)
                .order('fecha', { ascending: false });

            if (data) {
                setStudentHistory(data);
            }
        };

        fetchHistory();
    }, [student]);

    if (!student) return null;

    return (
        <>
            {/* Modal Principal Estudiante Detalle (Historial) */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[9990] animate-in fade-in duration-300"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-[2.5rem] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-gray-800"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white relative shrink-0">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl shadow-inner border border-white/10">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl md:text-2xl tracking-tight leading-none uppercase">
                                        {student.nombre}
                                    </h3>
                                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-80 mt-1.5 text-cyan-50">
                                        Historial Académico - PAE
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="mt-8 grid grid-cols-3 gap-3">
                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                                <div className="text-xl md:text-2xl font-black">
                                    {studentHistory.filter(a => {
                                        const thirtyDaysAgo = new Date();
                                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'recibio';
                                    }).length}
                                </div>
                                <div className="text-[9px] uppercase font-black tracking-widest opacity-70">Recibió</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                                <div className="text-xl md:text-2xl font-black">
                                    {studentHistory.filter(a => {
                                        const thirtyDaysAgo = new Date();
                                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'no_recibio';
                                    }).length}
                                </div>
                                <div className="text-[9px] uppercase font-black tracking-widest opacity-70">No Recibió</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
                                <div className="text-xl md:text-2xl font-black text-white/60">
                                    {studentHistory.filter(a => {
                                        const thirtyDaysAgo = new Date();
                                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                                        return a.fecha >= thirtyDaysAgo.toISOString().split('T')[0] && a.estado === 'ausente';
                                    }).length}
                                </div>
                                <div className="text-[9px] uppercase font-black tracking-widest opacity-70">Ausente</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-8 overflow-y-auto space-y-8 bg-white custom-scrollbar-premium dark:bg-gray-800">
                        {/* Vista de Calendario (Mini Grid) */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-cyan-600" />
                                    Mapa de Asistencia
                                </h4>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                                        className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-white transition-colors dark:bg-gray-700 dark:border-gray-600"
                                    >
                                        <ChevronLeft className="w-3 h-3 text-cyan-600" />
                                    </button>
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest min-w-[100px] text-center">
                                        {currentMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                                        className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-white transition-colors dark:bg-gray-700 dark:border-gray-600"
                                    >
                                        <ChevronRight className="w-3 h-3 text-cyan-600" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100/50 shadow-inner dark:bg-gray-900/50 dark:border-gray-700/50">
                                {/* Headers */}
                                <div className="grid grid-cols-7 gap-1.5 mb-2">
                                    {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => (
                                        <div key={d} className="text-center text-[9px] font-black text-gray-300 tracking-tighter">{d}</div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-1.5">
                                    {(() => {
                                        const year = currentMonth.getFullYear();
                                        const month = currentMonth.getMonth();
                                        const firstDay = new Date(year, month, 1);
                                        const lastDay = new Date(year, month + 1, 0);

                                        const days = [];
                                        let startDayOfWeek = firstDay.getDay();
                                        let leadingEmpty = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

                                        for (let i = 0; i < leadingEmpty; i++) {
                                            days.push(null);
                                        }
                                        for (let i = 1; i <= lastDay.getDate(); i++) {
                                            days.push(new Date(year, month, i));
                                        }

                                        return days.map((d, i) => {
                                            if (!d) return <div key={`empty-${i}`} className="aspect-square"></div>;

                                            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            const record = studentHistory.find(r => r.fecha === dateStr);
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                            const hasNovelty = record?.novedad_tipo || record?.novedad_descripcion;
                                            const isFuture = dateStr > todayStr;

                                            return (
                                                <button
                                                    key={dateStr}
                                                    onClick={() => record && setSelectedStudentDate(record)}
                                                    disabled={!record}
                                                    className={`aspect-square rounded-xl flex flex-col items-center justify-center relative border transition-all duration-300 ${isFuture ? 'opacity-10 bg-gray-100 border-transparent cursor-default dark:bg-gray-800' :
                                                            record ? (
                                                                record.estado === 'recibio' ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-100 active:scale-90' :
                                                                    record.estado === 'no_recibio' ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-100 active:scale-90' :
                                                                        'bg-gray-400 border-gray-300 text-white active:scale-90'
                                                            ) : isWeekend ? 'bg-gray-100 border-transparent text-gray-300 dark:bg-gray-700/50 dark:text-gray-500' : 'bg-white border-gray-100 text-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500'
                                                        }`}
                                                >
                                                    <span className="text-[10px] font-black">{d.getDate()}</span>
                                                    {hasNovelty && (
                                                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shadow-sm shadow-amber-200"></div>
                                                    )}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest justify-center pt-2 text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-1.5 transition-opacity hover:opacity-100"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200"></div> Recibió</div>
                                <div className="flex items-center gap-1.5 transition-opacity hover:opacity-100"><div className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-sm shadow-rose-200"></div> No recibió</div>
                                <div className="flex items-center gap-1.5 transition-opacity hover:opacity-100"><div className="w-2.5 h-2.5 bg-amber-400 rounded-full shadow-sm shadow-amber-200"></div> Novedad</div>
                            </div>
                        </div>

                        {/* Novedades Recientes */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                Observación Directiva
                            </h4>
                            <div className="space-y-3">
                                {studentHistory.filter(a => a.novedad_tipo || a.novedad_descripcion).length > 0 ? (
                                    studentHistory.filter(a => a.novedad_tipo || a.novedad_descripcion).slice(0, 3).map((a, i) => (
                                        <div key={i} className="bg-amber-50/50 p-5 rounded-[2rem] border border-amber-100/50 shadow-sm relative overflow-hidden group dark:bg-amber-900/10 dark:border-amber-800/30">
                                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <School className="w-12 h-12 text-amber-600" />
                                            </div>
                                            <div className="flex justify-between items-start mb-2 relative">
                                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{a.novedad_tipo || 'General'}</span>
                                                <span className="text-[9px] font-black text-amber-400 uppercase">{new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                                            </div>
                                            <p className="text-sm text-amber-900 font-bold leading-relaxed relative italic">"{a.novedad_descripcion || 'Sin descripción detallada'}"</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-gray-50 p-8 rounded-[2rem] border border-dashed border-gray-200 text-center dark:bg-gray-800/50 dark:border-gray-700">
                                        <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3 dark:text-gray-600" />
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest dark:text-gray-500">Sin novedades críticas</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Línea de Tiempo Completa */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Línea de Tiempo Completa</h4>
                            <div className="space-y-2">
                                {studentHistory.length > 0 ? (
                                    studentHistory.map((h, i) => (
                                        <div key={i} className="flex justify-between items-center p-4 bg-gray-50/50 border border-gray-100/50 rounded-2xl hover:bg-white transition-colors duration-300 dark:bg-gray-700/20 dark:border-gray-700/30 dark:hover:bg-gray-700/50">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-3 h-3 rounded-full shadow-sm hover:scale-125 transition-transform ${h.estado === 'recibio' ? 'bg-emerald-500 shadow-emerald-100' : h.estado === 'no_recibio' ? 'bg-rose-500 shadow-rose-100' : 'bg-gray-400'}`}></div>
                                                <div>
                                                    <p className="text-sm font-black text-gray-700 dark:text-gray-200">{new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest dark:text-gray-500">{h.estado === 'recibio' ? 'Operación Normal' : 'Ausencia / Novedad'}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${h.estado === 'recibio' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : h.estado === 'no_recibio' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>{h.estado.replace('_', ' ')}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-gray-300 text-sm font-black uppercase tracking-widest">Esperando primer registro...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Secundario Detalle Día Estudiante */}
            {selectedStudentDate && (
                <div
                    className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setSelectedStudentDate(null)}
                >
                    <div
                        className="bg-white rounded-[2.5rem] w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar-premium dark:bg-gray-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest leading-none mb-1.5">Detalle del Registro</p>
                                <h3 className="text-xl font-black capitalize leading-none tracking-tight">
                                    {new Date(selectedStudentDate.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedStudentDate(null)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 bg-white dark:bg-gray-800">
                            {/* Status Badge */}
                            <div className={`p-5 rounded-3xl flex items-center gap-4 shadow-xl shadow-cyan-900/5 ${selectedStudentDate.estado === 'recibio' ? 'bg-emerald-50/50 border border-emerald-100/50 dark:bg-emerald-900/10 dark:border-emerald-800/30' :
                                selectedStudentDate.estado === 'no_recibio' ? 'bg-rose-50/50 border border-rose-100/50 dark:bg-rose-900/10 dark:border-rose-800/30' :
                                    'bg-gray-50/50 border border-gray-100/50 dark:bg-gray-700/30 dark:border-gray-600/30'
                                }`}>
                                <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center shadow-lg ${selectedStudentDate.estado === 'recibio' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                                    selectedStudentDate.estado === 'no_recibio' ? 'bg-rose-500 text-white shadow-rose-200' :
                                        'bg-gray-400 text-white shadow-gray-200'
                                    }`}>
                                    {selectedStudentDate.estado === 'recibio' && <CheckCircle2 className="w-7 h-7" />}
                                    {selectedStudentDate.estado === 'no_recibio' && <X className="w-7 h-7" />}
                                    {selectedStudentDate.estado === 'ausente' && <AlertCircle className="w-7 h-7" />}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 leading-none">Status</p>
                                    <p className={`text-xl font-black uppercase tracking-tight ${selectedStudentDate.estado === 'recibio' ? 'text-emerald-600' :
                                        selectedStudentDate.estado === 'no_recibio' ? 'text-rose-600' :
                                            'text-gray-600'
                                        }`}>
                                        {selectedStudentDate.estado.replace('_', ' ')}
                                    </p>
                                </div>
                            </div>

                            {/* Time Info */}
                            <div className="flex items-center gap-4 p-4 bg-cyan-50/50 rounded-2xl border border-cyan-100/30 dark:bg-cyan-900/10 dark:border-cyan-800/20">
                                <div className="bg-white p-2.5 rounded-xl shadow-sm">
                                    <Clock className="w-5 h-5 text-cyan-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest leading-none mb-1 dark:text-cyan-400">Hora de Registro</p>
                                    <p className="text-sm font-black text-gray-700 dark:text-gray-200">
                                        {new Date(selectedStudentDate.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>

                            {/* Novelties */}
                            {(selectedStudentDate.novedad_tipo || selectedStudentDate.novedad_descripcion) && (
                                <div className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100/50 relative overflow-hidden group dark:bg-amber-900/10 dark:border-amber-800/30">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Info className="w-10 h-10 text-amber-600" />
                                    </div>
                                    <div className="flex items-center gap-2 mb-3 relative">
                                        <AlertCircle className="w-4 h-4 text-amber-500" />
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Novedad Registrada</p>
                                    </div>
                                    {selectedStudentDate.novedad_tipo && (
                                        <p className="font-black text-amber-900 mb-2 relative leading-tight">{selectedStudentDate.novedad_tipo}</p>
                                    )}
                                    {selectedStudentDate.novedad_descripcion && (
                                        <p className="text-sm text-amber-800 font-bold italic border-l-2 border-amber-200 pl-3 py-1 relative leading-relaxed">"{selectedStudentDate.novedad_descripcion}"</p>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={() => setSelectedStudentDate(null)}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-gray-200"
                            >
                                Confirmar Lectura
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
