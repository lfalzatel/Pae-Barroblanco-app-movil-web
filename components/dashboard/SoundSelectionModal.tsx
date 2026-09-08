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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#121212] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 pb-3 border-b border-amber-500/20 bg-amber-950/20 flex items-start justify-between relative">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
                            <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider leading-tight">
                                {title}
                            </h3>
                            <p className="text-[10px] font-bold text-amber-200/60 uppercase tracking-widest mt-0.5">
                                {subtitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-amber-400/60 hover:text-amber-300 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Options List */}
                <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1">
                    {options.map((opt) => {
                        const isSelected = currentSelected === opt.id;
                        return (
                            <div
                                key={opt.id}
                                onClick={() => setCurrentSelected(opt.id)}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                    isSelected
                                        ? 'bg-amber-500/10 border-amber-400/80 text-amber-300 shadow-md shadow-amber-500/5'
                                        : 'bg-[#1a1a1a] border-gray-800 text-gray-300 hover:border-amber-500/40 hover:bg-[#222]'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div
                                        className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                            isSelected
                                                ? 'bg-amber-400 border-amber-400 text-black'
                                                : 'border-gray-600 bg-transparent'
                                        }`}
                                    >
                                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black uppercase tracking-wider truncate flex items-center gap-1.5">
                                            <span>{opt.icon}</span>
                                            <span>{opt.label}</span>
                                        </p>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">
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
                                    className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 active:scale-95 transition-all"
                                >
                                    <Play className="w-3 h-3 fill-amber-300" />
                                    <span>Escuchar</span>
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-amber-500/20 bg-[#151515] grid grid-cols-2 gap-3">
                    <button
                        onClick={onClose}
                        className="py-2.5 px-4 rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-400/20 active:scale-95 transition-all"
                    >
                        Guardar Tono
                    </button>
                </div>
            </div>
        </div>
    );
}
