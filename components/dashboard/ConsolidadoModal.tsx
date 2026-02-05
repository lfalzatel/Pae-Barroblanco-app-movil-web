import { useState } from 'react';
import { X, FileDown, School, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useModalBack } from '@/hooks/useModalBack';

interface ConsolidadoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ConsolidadoModal({ isOpen, onClose }: ConsolidadoModalProps) {
    useModalBack(isOpen, onClose, 'consolidado-modal');

    // Datos Estáticos Basados en el Reporte (IE BARRO BLANCO)
    // Estructura: Grado/Grupo -> RI/AM, RI/PM, CAJM, CAJT, ALMUERZO, MT, NOVEDAD
    const data = [
        { grupo: 'PREESCOLAR', ri_am: 0, ri_pm: 0, cajm: 14, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'AULA SORDOS', ri_am: 0, ri_pm: 0, cajm: 11, cajt: 0, almuerzo: 11, mt: 0, novedad: '' },
        { grupo: 'PRIMERO', ri_am: 0, ri_pm: 0, cajm: 35, cajt: 0, almuerzo: 39, mt: 0, novedad: '' },
        { grupo: 'SEGUNDO', ri_am: 0, ri_pm: 0, cajm: 35, cajt: 0, almuerzo: 39, mt: 0, novedad: '' },
        { grupo: 'TERCERO', ri_am: 0, ri_pm: 0, cajm: 28, cajt: 0, almuerzo: 37, mt: 0, novedad: '' },
        { grupo: 'CUARTO 1', ri_am: 0, ri_pm: 0, cajm: 20, cajt: 0, almuerzo: 28, mt: 0, novedad: '' },
        { grupo: 'CUARTO 2', ri_am: 0, ri_pm: 0, cajm: 20, cajt: 0, almuerzo: 28, mt: 0, novedad: '' },
        { grupo: 'QUINTO 1', ri_am: 0, ri_pm: 0, cajm: 24, cajt: 0, almuerzo: 30, mt: 0, novedad: '' },
        { grupo: 'QUINTO 2', ri_am: 0, ri_pm: 0, cajm: 24, cajt: 0, almuerzo: 27, mt: 0, novedad: '' },
        { grupo: 'SEXTO 1', ri_am: 0, ri_pm: 0, cajm: 22, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'SEXTO 2', ri_am: 0, ri_pm: 0, cajm: 22, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'SEXTO 3', ri_am: 0, ri_pm: 0, cajm: 23, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'SEXTO 4', ri_am: 0, ri_pm: 0, cajm: 23, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'SÉPTIMO 1', ri_am: 0, ri_pm: 0, cajm: 31, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'SÉPTIMO 2', ri_am: 0, ri_pm: 0, cajm: 31, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'SÉPTIMO 3', ri_am: 0, ri_pm: 0, cajm: 31, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'OCTAVO 1', ri_am: 0, ri_pm: 0, cajm: 33, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'OCTAVO 2', ri_am: 0, ri_pm: 0, cajm: 32, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'NOVENO 1', ri_am: 0, ri_pm: 0, cajm: 33, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'NOVENO 2', ri_am: 0, ri_pm: 0, cajm: 33, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'DÉCIMO 1', ri_am: 0, ri_pm: 0, cajm: 27, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'DÉCIMO 2', ri_am: 0, ri_pm: 0, cajm: 22, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'ONCE 1', ri_am: 0, ri_pm: 0, cajm: 23, cajt: 0, almuerzo: 0, mt: 0, novedad: '' },
        { grupo: 'ONCE 2', ri_am: 0, ri_pm: 0, cajm: 25, cajt: 0, almuerzo: 0, mt: 0, novedad: '' }
    ];

    const totals = data.reduce((acc, curr) => ({
        cajm: acc.cajm + curr.cajm,
        cajt: acc.cajt + curr.cajt,
        almuerzo: acc.almuerzo + curr.almuerzo,
        ri_am: acc.ri_am + curr.ri_am,
        ri_pm: acc.ri_pm + curr.ri_pm
    }), { cajm: 0, cajt: 0, almuerzo: 0, ri_am: 0, ri_pm: 0 });

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Consolidado Barroblanco");
        XLSX.writeFile(wb, "Consolidado_Cupos_PAE.xlsx");
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
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-5xl relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-blue-600 p-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4 text-white">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <School className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">Consolidado de Cupos</h3>
                            <p className="text-blue-100 text-sm font-medium">I.E. BARRO BLANCO - Sede Principal</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                        title="Cerrar"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content Container with Scroll */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {/* Warning Banner */}
                    <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-blue-900 dark:text-white mb-1">Información Estática</h4>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                Este reporte muestra la proyección base asignada. Los cambios diarios por novedades se reflejan en la vista "Cupos para Mañana".
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-black uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3 text-left border-r dark:border-gray-700">Grupo / Grado</th>
                                    <th className="px-2 py-3 text-center bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400">RI / AM</th>
                                    <th className="px-2 py-3 text-center bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400">RI / PM</th>
                                    <th className="px-2 py-3 text-center bg-cyan-50 dark:bg-cyan-900/10 text-cyan-700 dark:text-cyan-400">CAJM</th>
                                    <th className="px-2 py-3 text-center bg-cyan-50 dark:bg-cyan-900/10 text-cyan-700 dark:text-cyan-400">CAJT</th>
                                    <th className="px-2 py-3 text-center bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400">ALMUERZO</th>
                                    <th className="px-2 py-3 text-center text-gray-500">M. TÉCNICA</th>
                                    <th className="px-4 py-3 text-left text-gray-500">NOVEDAD</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {data.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="px-4 py-2 font-bold text-gray-700 dark:text-gray-300 border-r dark:border-gray-700">
                                            {row.grupo}
                                        </td>
                                        <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400">{row.ri_am || '-'}</td>
                                        <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400">{row.ri_pm || '-'}</td>
                                        <td className="px-2 py-2 text-center font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50/30 dark:bg-cyan-900/5">{row.cajm || '-'}</td>
                                        <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400">{row.cajt || '-'}</td>
                                        <td className="px-2 py-2 text-center font-bold text-green-600 dark:text-green-400 bg-green-50/30 dark:bg-green-900/5">{row.almuerzo || '-'}</td>
                                        <td className="px-2 py-2 text-center text-gray-400">{row.mt || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-gray-500 italic max-w-[200px] truncate">{row.novedad}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 dark:bg-gray-800 font-black border-t-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white sticky bottom-0">
                                <tr>
                                    <td className="px-4 py-3 text-right border-r dark:border-gray-700">TOTAL COMPLEMENTOS:</td>
                                    <td className="px-2 py-3 text-center">{totals.ri_am}</td>
                                    <td className="px-2 py-3 text-center">{totals.ri_pm}</td>
                                    <td className="px-2 py-3 text-center text-cyan-600 dark:text-cyan-400">{totals.cajm}</td>
                                    <td className="px-2 py-3 text-center">{totals.cajt}</td>
                                    <td className="px-2 py-3 text-center text-green-600 dark:text-green-400">{totals.almuerzo}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0 flex justify-end gap-3">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-green-200 dark:shadow-none"
                    >
                        <FileDown className="w-5 h-5" />
                        Descargar Excel
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>

            </div>
        </div>
    );
}
