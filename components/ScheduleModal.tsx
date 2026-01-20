import { useState, useEffect } from 'react';
import { X, Calendar, Download, Clock, Users, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { generateSchedulePDF } from '../lib/pdf-generator';
import { supabase } from '@/lib/supabase';
import { MiniCalendar } from './ui/MiniCalendar';

interface ScheduleItem {
    time: string;
    group: string;
    notes?: string;
}

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ScheduleModal({ isOpen, onClose }: ScheduleModalProps) {
    const [date, setDate] = useState<string>('');
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Smart Business Day logic:
            // Fri/Sat -> Mon
            // Others -> +1 Day
            const now = new Date();
            const day = now.getDay();

            const target = new Date(now);
            if (day === 5) target.setDate(target.getDate() + 3); // Fri -> Mon
            else if (day === 6) target.setDate(target.getDate() + 2); // Sat -> Mon
            else target.setDate(target.getDate() + 1); // Others -> Tomorrow

            const offset = target.getTimezoneOffset() * 60000;
            setDate(new Date(target.getTime() - offset).toISOString().split('T')[0]);
            setShowCalendar(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (date) {
            fetchSchedule(date);
        }
    }, [date]);

    // ... (fetchSchedule stays same)

    const handleDownload = () => {
        generateSchedulePDF(schedule, date);
    };

    if (!isOpen) return null;

    const formattedDate = date ? new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* ... */}
            {/* Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/30">
                {loading ? (
                    <div className="py-20 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                    </div>
                ) : schedule.length > 0 ? (
                    <div className="space-y-3">
                        {schedule.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-100/50 transition-all duration-300 group"
                            >
                                <div className="flex flex-col items-center justify-center w-20 bg-gray-50 rounded-xl p-2 border border-gray-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 transition-colors shrink-0">
                                    <Clock className="w-4 h-4 text-gray-400 group-hover:text-cyan-600 mb-1" />
                                    <span className="text-[10px] font-black text-gray-700 group-hover:text-cyan-800 text-center leading-tight">
                                        {item.time.split(' - ')[0]}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                    <span className="font-black text-lg text-gray-900 truncate">{item.group}</span>

                                    {item.notes && (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 shrink-0">
                                            <FileText className="w-3 h-3" />
                                            <span className="font-medium max-w-[150px] truncate">{item.notes}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 opacity-60">
                        <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 font-medium">No hay horario programado para esta fecha.</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex gap-3 shrink-0">
                <button
                    onClick={handleDownload}
                    disabled={schedule.length === 0}
                    className="flex-1 py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold shadow-lg shadow-cyan-200 hover:shadow-xl hover:shadow-cyan-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    <Download className="w-5 h-5" />
                    Descargar PDF
                </button>

                <button
                    onClick={onClose}
                    className="px-6 py-3.5 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl font-bold transition-all duration-200"
                >
                    Cerrar
                </button>
            </div>
        </div>
        </div >
    );
}
