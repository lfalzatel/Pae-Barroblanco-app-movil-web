'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number;
  customMessages?: [string, string, string]; // Mensajes personalizados para los 3 estados
}

export function SplashScreen({ onComplete, duration = 3000, customMessages }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Verificando identidad...');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Definir mensajes (usar personalizados o por defecto)
    const msgs = customMessages || [
        'Verificando identidad...',
        'Cargando datos...',
        'Listo'
    ];

    // Progress bar animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, duration / 100);

    // Initial message
    setStatusText(msgs[0]);

    // Status text updates
    const text1 = setTimeout(() => setStatusText(msgs[1]), duration * 0.33);
    const text2 = setTimeout(() => setStatusText(msgs[2]), duration * 0.66);

    // Completion
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 500); // Wait for fade out animation
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(text1);
      clearTimeout(text2);
      clearTimeout(timer);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-gray-900 transition-opacity duration-700 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="relative flex flex-col items-center max-w-xs w-full px-6">
        {/* Logo & Spin Ring Container */}
        <div className="mb-10 relative">
          {/* Outer Glow */}
          <div className="absolute inset-0 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
          
          {/* Spinning Ring */}
          <div className="absolute -inset-4 border-t-4 border-r-4 border-transparent border-t-green-500 border-r-emerald-500/30 rounded-full animate-spin-slow"></div>
          <div className="absolute -inset-4 border-b-4 border-l-4 border-transparent border-b-green-700 border-l-green-600/20 rounded-full animate-spin-reverse"></div>

          {/* Circular Logo Wrapper */}
          <div className="relative w-44 h-44 rounded-full p-1 bg-gradient-to-tr from-green-600/50 to-emerald-400/50 shadow-[0_0_60px_rgba(64,168,81,0.4)] animate-bounce-slow">
            <div className="w-full h-full rounded-full bg-[#40a851] p-2 overflow-hidden flex items-center justify-center border-2 border-white/20 shadow-inner">
                <Image
                src="/icon-512x512.png"
                alt="Sistema PAE Logo"
                width={150}
                height={150}
                className="priority"
                priority
                />
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="text-center mb-12 space-y-2">
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">
            Sistema <span className="text-green-600">PAE</span>
          </h1>
          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.4em] translate-x-1">
            Barroblanco
          </p>
        </div>

        {/* Progress Section */}
        <div className="w-full space-y-5">
          <div className="flex justify-between items-end px-1">
            <span className="text-[10px] font-bold text-green-600/60 dark:text-green-400/50 uppercase tracking-widest animate-pulse">
              {statusText}
            </span>
            <span className="text-xs font-black text-green-600 dark:text-green-400 font-mono">
              {progress}%
            </span>
          </div>
          
          <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800/50 rounded-full overflow-hidden p-0 border border-gray-200/50 dark:border-gray-700/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-green-500 to-green-700 shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="absolute bottom-[-100px] text-center w-full">
            <p className="text-[9px] font-bold text-gray-300 dark:text-gray-700 uppercase tracking-[0.3em]">
                Institución Educativa Técnica
            </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.02); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .animate-spin-reverse {
          animation: spin-reverse 5s linear infinite;
        }
      `}</style>
    </div>
  );
}
