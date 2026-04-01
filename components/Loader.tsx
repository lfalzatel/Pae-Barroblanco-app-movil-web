'use client';

import { Utensils } from 'lucide-react';

interface LoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loader({ message = 'Cargando...', fullScreen = false }: LoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${fullScreen ? 'min-h-screen bg-gray-50 dark:bg-gray-900' : 'p-8'} transition-colors duration-300`}>
      <div className="relative mb-4">
        {/* Orbiting Ring */}
        <div className="absolute inset-[-8px] border-4 border-emerald-500/20 rounded-full"></div>
        <div className="absolute inset-[-8px] border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        
        {/* Center Icon */}
        <div className="w-12 h-12 bg-blue-600 dark:bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
          <Utensils className="w-6 h-6 text-white" />
        </div>
      </div>
      
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 animate-pulse uppercase tracking-[0.2em]">
        {message}
      </p>
    </div>
  );
}
