'use client';

import { Calendar, XCircle } from 'lucide-react';
import { MiniCalendar } from '@/components/ui/MiniCalendar';

interface DateSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string;
    onSelectDate: (date: string) => void;
    title?: string;
}

export function DateSelectionModal({
    isOpen,
    onClose,
    selectedDate,
    onSelectDate,
    title = 'Seleccionar Fecha'
}: DateSelectionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-[2.5rem] w-full max-w-[90vw] md:max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-white/20 mx-auto">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-br from-cyan-600 to-cyan-700 flex items-center justify-between text-white">
                    <h3 className="font-black flex items-center gap-3 uppercase text-[11px] tracking-[0.2em]">
                        <Calendar className="w-5 h-5" />
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-all hover:rotate-90"
                    >
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 bg-white dark:bg-gray-900">
                    <MiniCalendar
                        selectedDate={selectedDate}
                        onSelectDate={(date) => {
                            onSelectDate(date);
                            onClose();
                        }}
                        mode="manual" // Simple mode without extra data fetching by default
                        showCounters={false}
                    />
                </div>
                <div className="p-6 pt-0 bg-white dark:bg-gray-900">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-cyan-100 hover:bg-cyan-700 active:scale-[0.98] transition-all"
                    >
                        LISTO, VOLVER
                    </button>
                </div>
            </div>
        </div>
    );
}
