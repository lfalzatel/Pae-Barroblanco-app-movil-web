'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }

        // Identify iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // Capture the PWA install prompt event
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    if (isStandalone) return null;

    return (
        <div className="mt-4 flex flex-col gap-2">
            {deferredPrompt && (
                <button
                    onClick={handleInstallClick}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg"
                >
                    <Download className="w-5 h-5" />
                    Instalar Aplicación
                </button>
            )}

            {isIOS && (
                <div className="bg-gray-100 p-4 rounded-xl text-sm text-gray-700 border border-gray-200">
                    <p className="font-bold flex items-center gap-2 mb-1">
                        <span className="text-xl">📲</span> Instalar en iPhone/iPad:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 ml-1 text-xs">
                        <li>Presiona el botón <strong>Compartir</strong> <span className="text-blue-500 text-lg">⎋</span></li>
                        <li>Baja y selecciona <strong>"Agregar a Inicio"</strong> <span className="text-gray-900 border border-gray-300 rounded px-1">+</span></li>
                    </ol>
                </div>
            )}
        </div>
    );
}
