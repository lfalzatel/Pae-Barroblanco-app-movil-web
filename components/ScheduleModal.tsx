import { X, Calendar, Download, Clock, Users, FileText } from 'lucide-react';
import { generateSchedulePDF } from '../lib/pdf-generator';

interface ScheduleItem {
    time: string;
    group: string;
    notes?: string;
}

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    schedule: ScheduleItem[];
}

export default function ScheduleModal({ isOpen, onClose, date, schedule }: ScheduleModalProps) {
    if (!isOpen) return null;

    const handleDownload = () => {
        generateSchedulePDF(schedule, date);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 overflow-hidden border border-white/20 ring-1 ring-black/5">

                {/* Header */}
                <div className="p-6 flex items-center justify-between border-b border-gray-100/50 bg-gradient-to-r from-cyan-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-100 text-cyan-700 p-3 rounded-2xl shadow-sm ring-1 ring-cyan-500/10">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 leading-tight text-lg">Horario de Mañana</h3>
                            <p className="text-xs font-medium text-cyan-600 mt-0.5 capitalize">{date}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 hover:bg-black/5 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-900 hover:rotate-90"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">

                    {schedule.length > 0 ? (
                        <div className="space-y-3">
                            {schedule.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-100/50 transition-all duration-300 group"
                                >
                                    <div className="flex flex-col items-center justify-center w-16 bg-gray-50 rounded-xl p-2 border border-gray-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 transition-colors">
                                        <Clock className="w-4 h-4 text-gray-400 group-hover:text-cyan-600 mb-1" />
                                        <span className="text-xs font-bold text-gray-700 group-hover:text-cyan-800 text-center leading-tight">{item.time}</span>
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Users className="w-4 h-4 text-gray-400" />
                                            <span className="font-bold text-gray-900">{item.group}</span>
                                        </div>
                                        {item.notes && (
                                            <div className="flex items-start gap-2 text-xs text-gray-500 mt-1 pl-6">
                                                <FileText className="w-3 h-3 mt-0.5 opacity-50" />
                                                <span>{item.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 opacity-60">
                            <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No hay horario programado para mañana.</p>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50/80 backdrop-blur-md border-t border-gray-100/50 flex gap-3">
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
        </div>
    );
}
