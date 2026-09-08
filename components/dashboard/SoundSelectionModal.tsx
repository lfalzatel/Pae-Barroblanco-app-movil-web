'use client';

import { useState, useEffect } from 'react';
import { X, Volume2, Play, Check } from 'lucide-react';
import { useModalBack } from '@/hooks/useModalBack';

export interface SoundOption {
    id: string;
    label: string;
    sublabel?: string;
    icon: string;
    description: string;
}

interface SoundSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle: string;
    options: SoundOption[];
    selectedId: string;
    onSave: (selectedId: string) => void;
    onPreviewSound: (soundId: string) => void;
}

export default function SoundSelectionModal({
    isOpen,
    onClose,
    title,
    subtitle,
    options,
    selectedId,
    onSave,
    onPreviewSound,
}: SoundSelectionModalProps) {
    const [currentSelected, setCurrentSelected] = useState(selectedId);

    useModalBack(isOpen, onClose, 'sound-selection-modal');

    useEffect(() => {
        if (isOpen) {
            setCurrentSelected(selectedId);
        }
    }, [isOpen, selectedId]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(currentSelected);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-5 pb-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 flex items-start justify-between relative">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                            <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider leading-tight">
                                {title}
                            </h3>
                            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest mt-0.5">
                                {subtitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Options List */}
                <div className="p-4 overflow-y-auto space-y-2.5 custom-scrollbar flex-1">
                    {options.map((opt) => {
                        const isSelected = currentSelected === opt.id;
                        return (
                            <div
                                key={opt.id}
                                onClick={() => setCurrentSelected(opt.id)}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                    isSelected
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-900 dark:text-amber-200 shadow-xs'
                                        : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 hover:border-amber-400 text-gray-800 dark:text-gray-200'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div
                                        className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                            isSelected
                                                ? 'bg-amber-500 border-amber-500 text-white'
                                                : 'border-gray-300 dark:border-gray-500 bg-transparent'
                                        }`}
                                    >
                                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs font-black uppercase tracking-wider truncate flex items-center gap-1.5 ${isSelected ? 'text-amber-900 dark:text-amber-200' : 'text-gray-900 dark:text-white'}`}>
                                            <span>{opt.icon}</span>
                                            <span>{opt.label}</span>
                                        </p>
                                        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider truncate">
                                            {opt.description}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPreviewSound(opt.id);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-xs"
                                >
                                    <Play className="w-3 h-3 fill-white" />
                                    <span>Escuchar</span>
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/90 grid grid-cols-2 gap-3">
                    <button
                        onClick={onClose}
                        className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all"
                    >
                        Guardar Tono
                    </button>
                </div>
            </div>
        </div>
    );
}
