import { ChevronLeft, X, CheckCircle, XCircle, UserX, UserMinus } from 'lucide-react';
import { useRef, useEffect } from 'react';

// Helper to generate consistent avatar colors based on name
const getAvatarColor = (name: string) => {
    const colors = [
        'bg-blue-100 text-blue-600',
        'bg-indigo-100 text-indigo-600',
        'bg-purple-100 text-purple-600',
        'bg-pink-100 text-pink-600',
        'bg-rose-100 text-rose-600',
        'bg-orange-100 text-orange-600',
        'bg-emerald-100 text-emerald-600',
        'bg-teal-100 text-teal-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

interface StatsDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    category: {
        id: string;
        title: string;
        color: string;
        icon: any;
    } | null;
    data: {
        grupo: string;
        count: number;
        total: number;
        percentage: string | number;
    }[];
    deepDetailOpen: boolean;
    deepDetailTitle: string;
    deepDetailData: {
        nombre: string;
        estado: string;
        fecha: string;
        id: string;
    }[];
    onGroupSelect: (grupo: string) => void;
    onBackToSummary: () => void;
}

export default function StatsDetailModal({
    isOpen,
    onClose,
    category,
    data,
    deepDetailOpen,
    deepDetailTitle,
    deepDetailData,
    onGroupSelect,
    onBackToSummary
}: StatsDetailModalProps) {
    if (!isOpen) return null;

    // Determine deep detail icon/color based on category or individual items
    // (Assuming deep detail inherits overall category context or we use generic)
    const isDeepParams = category?.id === 'recibieron' ? { color: 'text-emerald-500 bg-emerald-50', icon: CheckCircle } :
        category?.id === 'noRecibieron' ? { color: 'text-red-500 bg-red-50', icon: XCircle } :
            category?.id === 'ausentes' ? { color: 'text-gray-500 bg-gray-50', icon: UserX } :
                { color: 'text-blue-500 bg-blue-50', icon: UserMinus };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>

            {/* Main Modal Container */}
            <div className="bg-white/90 backdrop-blur-2xl rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-white/20 ring-1 ring-black/5 flex flex-col max-h-[85vh]">

                {/* Header - Switching based on View Level */}
                {!deepDetailOpen ? (
                    // Level 1: Summary Header
                    <div className="p-6 flex items-center justify-between border-b border-gray-100/50 bg-white/40 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className={`${category?.color.split(' ')[0].replace('text-', 'bg-').replace('600', '100').replace('700', '100')} ${category?.color.split(' ')[0]} p-3 rounded-2xl shadow-sm ring-1 ring-black/5`}>
                                {category?.icon && <category.icon className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="font-black text-gray-900 leading-tight text-lg">{category?.title}</h3>
                                <p className="text-xs font-medium text-gray-500 mt-0.5">Desglose por grupos</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-black/5 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-900 hover:rotate-90"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    // Level 2: Detail Header
                    <div className="p-6 flex items-center justify-between border-b border-gray-100 bg-white/50 shrink-0 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onBackToSummary}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-900 group"
                            >
                                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            <h3 className="font-black text-gray-900 leading-tight truncate max-w-[200px] text-lg">{deepDetailTitle}</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Content Body - Scrollable */}
                <div className="overflow-y-auto custom-scrollbar relative flex-1">
                    {!deepDetailOpen ? (
                        // Level 1: Group List
                        <div className="p-6 space-y-3 pb-20">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                Distribución Acumulada
                            </p>
                            {data.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onGroupSelect(item.grupo)}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100/80 hover:border-blue-300/50 hover:bg-blue-50/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 text-left bg-white/60 backdrop-blur-sm group animate-in slide-in-from-bottom-2 fade-in fill-mode-both"
                                    style={{ animationDelay: `${idx * 40}ms` }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/60 shadow-inner text-sm font-black text-gray-700 group-hover:from-blue-500 group-hover:to-blue-600 group-hover:text-white group-hover:border-blue-500 group-hover:shadow-blue-200 transition-all duration-300">
                                            {item.grupo.replace('Grado ', '').split('-')[0]}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{item.grupo}</div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] font-medium text-gray-500 bg-gray-100/80 px-1.5 py-0.5 rounded-md group-hover:bg-blue-100/50 group-hover:text-blue-600 transition-colors">Ver estudiantes</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 pr-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-400">{item.count}/{item.total}</span>
                                            <span className="text-2xl font-black text-gray-900 tracking-tight group-hover:scale-110 transition-transform duration-300">{item.percentage}%</span>
                                        </div>
                                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${category?.color.split(' ')[0].replace('text-', 'bg-')}`} style={{ width: `${item.percentage}%` }}></div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        // Level 2: Student List
                        <div className="p-6 space-y-4 pb-20 animate-in fade-in zoom-in-95 duration-200">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">LISTADO DETALLADO</p>
                            {deepDetailData.length > 0 ? (
                                deepDetailData.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both flex items-center justify-between group"
                                        style={{ animationDelay: `${idx * 30}ms` }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black ${getAvatarColor(item.nombre)}`}>
                                                {getInitials(item.nombre)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">{item.nombre}</p>
                                                <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-wide">{item.estado}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black text-gray-300 bg-gray-50 px-2 py-1 rounded-lg">{item.fecha}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 text-center">
                                    <p className="text-gray-400 font-medium">No hay registros detallados</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-gray-50/80 backdrop-blur-md border-t border-gray-100/50 flex justify-center shrink-0">
                    {!deepDetailOpen ? (
                        <button
                            onClick={onClose}
                            className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-bold shadow-xl shadow-gray-200 hover:bg-black hover:shadow-2xl hover:shadow-gray-300 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                        >
                            Cerrar Vista
                        </button>
                    ) : (
                        <button
                            onClick={onBackToSummary}
                            className="w-full py-3.5 bg-white text-gray-900 border border-gray-200 rounded-2xl font-black hover:bg-gray-50 transition-colors shadow-sm active:scale-[0.99]"
                        >
                            Volver al resumen
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
