'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar } from 'lucide-react';

export default function HorarioPage() {
    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/dashboard"
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </Link>
                <h1 className="text-2xl font-black text-gray-900">Horario Escolar</h1>
            </div>

            <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <div className="bg-orange-50 p-6 rounded-full mb-6">
                    <Calendar className="w-12 h-12 text-orange-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Módulo en Desarrollo</h2>
                <p className="text-gray-500 max-w-md">
                    Esta sección está siendo preparada para mostrar los horarios de atención y distribución del PAE.
                    ¡Pronto estará disponible!
                </p>
                <Link
                    href="/dashboard"
                    className="mt-8 px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                >
                    Volver al Inicio
                </Link>
            </div>
        </div>
    );
}
